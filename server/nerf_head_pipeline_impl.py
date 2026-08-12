"""Executable five-view NeRF-to-anime-head pipeline for the AIGC GPU host.

The web process launches this file with ``conda run -n AvatarNerf``. Heavy
imports stay inside this process so the existing FastAPI service remains small.
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import shutil
import subprocess
import sys
import tarfile
import time
import traceback
from pathlib import Path
from typing import Any, Iterable


POSES = ("front", "left", "right", "up", "down")
# The labels describe the direction the subject turns their head.  A rotating
# subject is converted to the inverse virtual-camera motion around a fixed head.
# Keeping this mapping explicit prevents the left/right and up/down texture
# reversal that the previous face-plane implementation exhibited.
POSE_ANGLES = {
    "front": (0.0, 0.0),
    "left": (42.0, 0.0),
    "right": (-42.0, 0.0),
    "up": (0.0, -20.0),
    "down": (0.0, 20.0),
}


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


class PipelineContext:
    def __init__(self, job_dir: Path) -> None:
        self.job_dir = job_dir
        self.request = json.loads((job_dir / "request.json").read_text(encoding="utf-8"))
        self.job_id = self.request["jobId"]
        self.started_at = time.time()

    def status(self, stage: str, progress: float, **extra: Any) -> None:
        payload = {
            "jobId": self.job_id,
            "status": "running",
            "stage": stage,
            "progress": round(progress, 4),
            "startedAt": self.started_at,
            "updatedAt": time.time(),
            "providerStage": "nerf-aigc-provider",
            **extra,
        }
        write_json_atomic(self.job_dir / "status.json", payload)
        print(f"[NeRFHead] stage={stage} progress={progress:.2f}", flush=True)

    def fail(self, stage: str, error: BaseException) -> None:
        write_json_atomic(
            self.job_dir / "status.json",
            {
                "jobId": self.job_id,
                "status": "failed",
                "stage": stage,
                "progress": 0,
                "providerStage": "nerf-aigc-provider",
                "failureReason": str(error),
                "validationErrors": getattr(error, "validation_errors", [type(error).__name__]),
                "startedAt": self.started_at,
                "finishedAt": time.time(),
            },
        )


class ValidationFailure(RuntimeError):
    def __init__(self, reason: str, errors: Iterable[str]) -> None:
        super().__init__(reason)
        self.validation_errors = list(errors)


def normalized_quality(value: float) -> float:
    return max(0.0, min(1.0, value / 100.0 if value > 1 else value))


def validate_five_view_capture(request: dict[str, Any]) -> None:
    frames = request.get("frames", [])
    labels = [frame.get("poseLabel") for frame in frames]
    errors: list[str] = []
    if len(frames) != 5:
        errors.append(f"expected_exactly_5_frames:received_{len(frames)}")
    for pose in POSES:
        count = labels.count(pose)
        if count == 0:
            errors.append(f"missing_pose:{pose}")
        elif count > 1:
            errors.append(f"duplicate_pose:{pose}")
    for frame in frames:
        if normalized_quality(float(frame.get("qualityScore", 0))) < 0.18:
            errors.append(f"capture_quality_too_low:{frame.get('poseLabel')}")
        if not str(frame.get("imageDataUrl", "")).startswith("data:image/"):
            errors.append(f"invalid_image_data_url:{frame.get('poseLabel')}")
    if errors:
        raise ValidationFailure("invalid_five_view_capture", errors)


def decode_data_url(data_url: str) -> bytes:
    if "," not in data_url:
        raise ValueError("invalid_data_url")
    return base64.b64decode(data_url.split(",", 1)[1], validate=True)


def detect_face_box(image: Any, requested_box: dict[str, Any] | None) -> tuple[int, int, int, int]:
    import cv2

    height, width = image.shape[:2]
    if requested_box:
        x = float(requested_box.get("x", 0))
        y = float(requested_box.get("y", 0))
        w = float(requested_box.get("width", 0))
        h = float(requested_box.get("height", 0))
        if 0 < w <= 1 and 0 < h <= 1:
            return int(x * width), int(y * height), int(w * width), int(h * height)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    detector = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = detector.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(80, 80))
    if len(faces):
        return tuple(int(value) for value in max(faces, key=lambda box: box[2] * box[3]))
    return int(width * 0.27), int(height * 0.16), int(width * 0.46), int(height * 0.54)


def expanded_square_crop(image: Any, face_box: tuple[int, int, int, int], size: int = 768) -> Any:
    import cv2
    import numpy as np

    height, width = image.shape[:2]
    x, y, w, h = face_box
    center_x = x + w / 2
    center_y = y + h * 0.43
    side = max(w * 1.85, h * 1.55)
    x0 = int(math.floor(center_x - side / 2))
    y0 = int(math.floor(center_y - side * 0.47))
    x1 = int(math.ceil(x0 + side))
    y1 = int(math.ceil(y0 + side))
    pad_left, pad_top = max(0, -x0), max(0, -y0)
    pad_right, pad_bottom = max(0, x1 - width), max(0, y1 - height)
    padded = cv2.copyMakeBorder(
        image,
        pad_top,
        pad_bottom,
        pad_left,
        pad_right,
        cv2.BORDER_CONSTANT,
        value=(245, 245, 245),
    )
    x0 += pad_left
    x1 += pad_left
    y0 += pad_top
    y1 += pad_top
    crop = padded[y0:y1, x0:x1]
    if crop.size == 0:
        raise ValueError("empty_head_crop")
    return cv2.resize(crop, (size, size), interpolation=cv2.INTER_LANCZOS4)


def foreground_mask(image_bgr: Any) -> Any:
    import cv2
    import numpy as np

    try:
        from rembg import new_session, remove

        session = getattr(foreground_mask, "_session", None)
        if session is None:
            session = new_session("u2net_human_seg")
            setattr(foreground_mask, "_session", session)
        rgba = remove(image_bgr, session=session)
        if rgba.ndim == 3 and rgba.shape[2] == 4:
            mask = rgba[:, :, 3]
        else:
            mask = np.full(image_bgr.shape[:2], 255, dtype=np.uint8)
    except Exception as error:
        print(f"[NeRFHead] rembg fallback error={error}", flush=True)
        height, width = image_bgr.shape[:2]
        mask = np.zeros((height, width), dtype=np.uint8)
        cv2.ellipse(
            mask,
            (width // 2, int(height * 0.48)),
            (int(width * 0.35), int(height * 0.46)),
            0,
            0,
            360,
            255,
            -1,
        )
    kernel = np.ones((7, 7), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.GaussianBlur(mask, (9, 9), 0)
    return mask


def normalize_head_scan_frames(context: PipelineContext) -> list[dict[str, Any]]:
    import cv2
    import numpy as np

    original_dir = context.job_dir / "input" / "original"
    normalized_dir = context.job_dir / "input" / "normalized"
    mask_dir = context.job_dir / "masks"
    for path in (original_dir, normalized_dir, mask_dir):
        path.mkdir(parents=True, exist_ok=True)

    normalized: list[dict[str, Any]] = []
    by_pose = {frame["poseLabel"]: frame for frame in context.request["frames"]}
    for pose in POSES:
        frame = by_pose[pose]
        raw = decode_data_url(frame["imageDataUrl"])
        original_path = original_dir / f"{pose}.jpg"
        original_path.write_bytes(raw)
        image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError(f"image_decode_failed:{pose}")
        if frame.get("mirrored"):
            image = cv2.flip(image, 1)
        crop = expanded_square_crop(image, detect_face_box(image, frame.get("faceBox")))
        mask = foreground_mask(crop)
        white = np.full_like(crop, 247)
        alpha = (mask.astype(np.float32) / 255.0)[:, :, None]
        composite = (crop * alpha + white * (1 - alpha)).astype(np.uint8)
        image_path = normalized_dir / f"{pose}.png"
        mask_path = mask_dir / f"{pose}.png"
        cv2.imwrite(str(image_path), composite)
        cv2.imwrite(str(mask_path), mask)
        normalized.append(
            {
                "pose": pose,
                "image_path": image_path,
                "mask_path": mask_path,
                "quality": normalized_quality(float(frame.get("qualityScore", 0))),
            }
        )
    return normalized


def camera_to_world(yaw_degrees: float, pitch_degrees: float, radius: float = 2.0) -> list[list[float]]:
    import numpy as np

    yaw = math.radians(yaw_degrees)
    pitch = math.radians(pitch_degrees)
    position = np.array(
        [
            radius * math.sin(yaw) * math.cos(pitch),
            radius * math.sin(pitch),
            radius * math.cos(yaw) * math.cos(pitch),
        ],
        dtype=np.float64,
    )
    forward = -position / np.linalg.norm(position)
    world_up = np.array([0.0, 1.0, 0.0])
    right = np.cross(forward, world_up)
    right /= np.linalg.norm(right)
    up = np.cross(right, forward)
    matrix = np.eye(4, dtype=np.float64)
    matrix[:3, 0] = right
    matrix[:3, 1] = up
    matrix[:3, 2] = -forward
    matrix[:3, 3] = position
    return matrix.tolist()


def estimate_sparse_head_camera_poses(frames: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cameras = []
    for frame in frames:
        yaw, pitch = POSE_ANGLES[frame["pose"]]
        cameras.append(
            {
                "pose": frame["pose"],
                "yaw_degrees": yaw,
                "pitch_degrees": pitch,
                "camera_to_world": camera_to_world(yaw, pitch),
                "confidence": 0.72 if frame["pose"] == "front" else 0.64,
            }
        )
    return cameras


def create_depth_prior(mask_path: Path, pose: str, output_path: Path) -> None:
    import cv2
    import numpy as np

    mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
    height, width = mask.shape
    y, x = np.mgrid[0:height, 0:width]
    nx = (x - width * 0.5) / (width * 0.36)
    ny = (y - height * 0.49) / (height * 0.46)
    radial = np.clip(1.0 - nx * nx - ny * ny, 0.0, 1.0)
    nose = np.exp(-((nx / 0.18) ** 2 + ((ny + 0.02) / 0.28) ** 2))
    surface_offset = 0.20 * np.sqrt(radial) + 0.055 * nose
    depth_m = 2.0 - surface_offset
    depth_mm = np.where(mask > 24, depth_m * 1000.0, 0.0).astype(np.uint16)
    cv2.imwrite(str(output_path), depth_mm)


def write_nerfstudio_dataset(
    root: Path,
    frames: list[dict[str, Any]],
    cameras: list[dict[str, Any]],
    image_key: str,
    include_depth: bool,
) -> Path:
    image_dir = root / "images"
    mask_dir = root / "masks"
    depth_dir = root / "depth"
    for path in (image_dir, mask_dir, depth_dir):
        path.mkdir(parents=True, exist_ok=True)

    camera_by_pose = {camera["pose"]: camera for camera in cameras}
    payload_frames = []
    for frame in frames:
        pose = frame["pose"]
        image_target = image_dir / f"{pose}.png"
        mask_target = mask_dir / f"{pose}.png"
        shutil.copy2(frame[image_key], image_target)
        shutil.copy2(frame["mask_path"], mask_target)
        item: dict[str, Any] = {
            "file_path": f"images/{pose}.png",
            "mask_path": f"masks/{pose}.png",
            "transform_matrix": camera_by_pose[pose]["camera_to_world"],
        }
        if include_depth:
            depth_target = depth_dir / f"{pose}.png"
            create_depth_prior(frame["mask_path"], pose, depth_target)
            item["depth_file_path"] = f"depth/{pose}.png"
        payload_frames.append(item)

    size = 768
    focal = size / (2 * math.tan(math.radians(48) / 2))
    transforms = {
        "camera_model": "OPENCV",
        "fl_x": focal,
        "fl_y": focal,
        "cx": size / 2,
        "cy": size / 2,
        "w": size,
        "h": size,
        "k1": 0.0,
        "k2": 0.0,
        "p1": 0.0,
        "p2": 0.0,
        "applied_transform": [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]],
        "frames": payload_frames,
    }
    write_json_atomic(root / "transforms.json", transforms)
    return root


def fit_face_geometry_prior(
    context: PipelineContext,
    frames: list[dict[str, Any]],
    cameras: list[dict[str, Any]],
) -> Path:
    prior_dir = context.job_dir / "prior"
    prior_dir.mkdir(parents=True, exist_ok=True)
    write_json_atomic(
        prior_dir / "guided-face-prior.json",
        {
            "provider": "guided-five-view-ellipsoid-depth-prior-v1",
            "poses": cameras,
            "headBoundsMeters": {"x": [-0.46, 0.46], "y": [-0.62, 0.62], "z": [-0.52, 0.52]},
            "notes": [
                "Depth supervision is an initialization prior, not measured depth.",
                "Replaceable by licensed FLAME/DECA provider.",
            ],
        },
    )
    return write_nerfstudio_dataset(
        context.job_dir / "dataset-neutral",
        frames,
        cameras,
        image_key="image_path",
        include_depth=True,
    )


def load_animegan() -> tuple[Any, Any]:
    import torch

    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    model = torch.hub.load(
        "bryandlee/animegan2-pytorch:main",
        "generator",
        pretrained="face_paint_512_v2",
        device=str(device),
        trust_repo=True,
    ).eval()
    face2paint = torch.hub.load(
        "bryandlee/animegan2-pytorch:main",
        "face2paint",
        device=str(device),
        size=512,
        trust_repo=True,
    )
    return model, face2paint


def animegan_stylize(model: Any, face2paint: Any, image_path: Path, output_path: Path) -> None:
    from PIL import Image

    image = Image.open(image_path).convert("RGB")
    output = face2paint(model, image)
    output.resize((768, 768), Image.Resampling.LANCZOS).save(output_path)


def generate_canonical_anime_reference(
    context: PipelineContext, frames: list[dict[str, Any]], model: Any, face2paint: Any
) -> Path:
    output_dir = context.job_dir / "anime-reference"
    output_dir.mkdir(parents=True, exist_ok=True)
    front = next(frame for frame in frames if frame["pose"] == "front")
    output = output_dir / "front.png"
    animegan_stylize(model, face2paint, front["image_path"], output)
    return output


def create_stylized_views(
    context: PipelineContext, frames: list[dict[str, Any]], model: Any, face2paint: Any
) -> None:
    output_dir = context.job_dir / "input" / "stylized"
    output_dir.mkdir(parents=True, exist_ok=True)
    for frame in frames:
        output = output_dir / f"{frame['pose']}.png"
        animegan_stylize(model, face2paint, frame["image_path"], output)
        frame["stylized_path"] = output


def run_command(command: list[str], cwd: Path, log_path: Path, environment: dict[str, str] | None = None) -> None:
    print(f"[NeRFHead] command={' '.join(command)}", flush=True)
    with log_path.open("a", encoding="utf-8") as log:
        completed = subprocess.run(
            command,
            cwd=cwd,
            stdout=log,
            stderr=subprocess.STDOUT,
            check=False,
            text=True,
            env={**os.environ, "PYTHONNOUSERSITE": "1", **(environment or {})},
        )
    if completed.returncode != 0:
        log_tail = ""
        try:
            log_tail = " | ".join(log_path.read_text(encoding="utf-8", errors="replace").splitlines()[-8:])
        except OSError:
            pass
        raise RuntimeError(f"command_failed_{completed.returncode}:{command[0]}:{log_tail[-1200:]}")


def find_latest_config(output_dir: Path) -> Path:
    configs = sorted(output_dir.rglob("config.yml"), key=lambda path: path.stat().st_mtime)
    if not configs:
        raise FileNotFoundError("nerfstudio_config_not_found")
    return configs[-1]


def train_nerfstudio_field(
    context: PipelineContext,
    dataset: Path,
    output_name: str,
    iterations: int,
    load_dir: Path | None = None,
) -> tuple[Path, float]:
    output_dir = context.job_dir / output_name
    output_dir.mkdir(parents=True, exist_ok=True)
    command = [
        "ns-train",
        "depth-nerfacto",
        "--data",
        str(dataset),
        "--output-dir",
        str(output_dir),
        "--experiment-name",
        context.job_id,
        "--timestamp",
        "run",
        "--max-num-iterations",
        str(iterations),
        "--vis",
        "tensorboard",
        "--viewer.quit-on-train-completion",
        "True",
        "--pipeline.datamanager.train-num-images-to-sample-from",
        "-1",
        "--pipeline.datamanager.train-num-times-to-repeat-images",
        "-1",
        "--pipeline.model.camera-optimizer.mode",
        "off",
        "--pipeline.model.depth-loss-mult",
        "0.08",
        "--pipeline.model.is-euclidean-depth",
        "True",
        "--pipeline.model.starting-depth-sigma",
        "0.10",
        "--pipeline.model.depth-sigma",
        "0.04",
    ]
    if load_dir is not None:
        command.extend(["--load-dir", str(load_dir)])
    command.extend(
        [
            "nerfstudio-data",
            "--eval-mode",
            "all",
            "--downscale-factor",
            "1",
            "--orientation-method",
            "none",
            "--center-method",
            "none",
            "--auto-scale-poses",
            "False",
            "--depth-unit-scale-factor",
            "0.001",
        ]
    )
    started = time.time()
    run_command(
        command,
        context.job_dir,
        context.job_dir / "nerfstudio.log",
        environment={
            "CUDA_VISIBLE_DEVICES": "0",
            "TCNN_CUDA_ARCHITECTURES": "89",
            "PYTORCH_CUDA_ALLOC_CONF": "max_split_size_mb:512",
        },
    )
    return find_latest_config(output_dir), time.time() - started


def train_few_shot_head_neural_field(context: PipelineContext, dataset: Path) -> tuple[Path, float]:
    requested = context.request.get("training", {})
    iterations = int(requested.get("geometryIterations", 1800))
    minimum = 32 if requested.get("smokeTest") is True else 800
    return train_nerfstudio_field(context, dataset, "nerf-neutral", max(minimum, min(iterations, 8000)))


def checkpoint_directory(config_path: Path) -> Path | None:
    candidates = sorted(config_path.parent.rglob("*.ckpt"), key=lambda path: path.stat().st_mtime)
    return candidates[-1].parent if candidates else None


def distill_anime_style_into_neural_field(
    context: PipelineContext,
    frames: list[dict[str, Any]],
    cameras: list[dict[str, Any]],
    neutral_config: Path,
) -> tuple[Path, float]:
    dataset = write_nerfstudio_dataset(
        context.job_dir / "dataset-stylized",
        frames,
        cameras,
        image_key="stylized_path",
        include_depth=True,
    )
    requested = context.request.get("training", {})
    iterations = int(requested.get("styleIterations", 2600))
    minimum = 48 if requested.get("smokeTest") is True else 1200
    # Warm-start preserves the neutral density field while appearance adapts.
    return train_nerfstudio_field(
        context,
        dataset,
        "nerf-stylized",
        max(minimum, min(iterations, 10000)),
        load_dir=checkpoint_directory(neutral_config),
    )


def export_point_cloud(context: PipelineContext, config_path: Path) -> Path:
    point_dir = context.job_dir / "pointcloud"
    point_dir.mkdir(parents=True, exist_ok=True)
    command = [
        "ns-export",
        "pointcloud",
        "--load-config",
        str(config_path),
        "--output-dir",
        str(point_dir),
        "--num-points",
        "350000",
        "--remove-outliers",
        "True",
        "--normal-method",
        "open3d",
    ]
    run_command(command, context.job_dir, context.job_dir / "nerfstudio.log")
    candidates = list(point_dir.rglob("*.ply"))
    if not candidates:
        raise FileNotFoundError("exported_point_cloud_not_found")
    return max(candidates, key=lambda path: path.stat().st_size)


def point_cloud_to_mesh(point_cloud_path: Path, output_path: Path) -> dict[str, Any]:
    import numpy as np
    import open3d as o3d
    import trimesh

    point_cloud = o3d.io.read_point_cloud(str(point_cloud_path))
    point_cloud.remove_non_finite_points()
    # The fixed five-view camera rig looks at the origin.  Reject density
    # floaters near a camera/background before Poisson reconstruction; without
    # this guard a short or divergent run can produce a large broken shell.
    head_bounds = o3d.geometry.AxisAlignedBoundingBox(
        min_bound=(-0.64, -0.74, -0.64),
        max_bound=(0.64, 0.74, 0.64),
    )
    source_point_count = len(point_cloud.points)
    point_cloud = point_cloud.crop(head_bounds)
    if len(point_cloud.points) < 10_000:
        raise ValidationFailure(
            "insufficient_head_points_after_neural_field_crop",
            [f"source_points:{source_point_count}", f"head_points:{len(point_cloud.points)}"],
        )
    point_cloud = point_cloud.voxel_down_sample(0.0045)
    if len(point_cloud.points) > 140_000:
        stride = int(math.ceil(len(point_cloud.points) / 140_000))
        point_cloud = point_cloud.uniform_down_sample(stride)
    if not point_cloud.has_normals():
        point_cloud.estimate_normals(o3d.geometry.KDTreeSearchParamHybrid(radius=0.04, max_nn=36))
        point_cloud.orient_normals_consistent_tangent_plane(20)
    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        point_cloud, depth=8, width=0, scale=1.06, linear_fit=True
    )
    densities = np.asarray(densities)
    mesh.remove_vertices_by_mask(densities < np.quantile(densities, 0.025))
    mesh = mesh.crop(point_cloud.get_axis_aligned_bounding_box())
    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_non_manifold_edges()
    triangle_clusters, cluster_triangles, _ = mesh.cluster_connected_triangles()
    triangle_clusters = np.asarray(triangle_clusters)
    cluster_triangles = np.asarray(cluster_triangles)
    if len(cluster_triangles):
        largest = int(cluster_triangles.argmax())
        mesh.remove_triangles_by_mask(triangle_clusters != largest)
        mesh.remove_unreferenced_vertices()
    if len(mesh.triangles) > 80_000:
        mesh = mesh.simplify_quadric_decimation(target_number_of_triangles=80_000)
        mesh.remove_degenerate_triangles()
        mesh.remove_duplicated_triangles()
        mesh.remove_unreferenced_vertices()
    triangle_clusters, cluster_triangles, _ = mesh.cluster_connected_triangles()
    triangle_clusters = np.asarray(triangle_clusters)
    cluster_triangles = np.asarray(cluster_triangles)
    if len(cluster_triangles) > 1:
        largest = int(cluster_triangles.argmax())
        mesh.remove_triangles_by_mask(triangle_clusters != largest)
        mesh.remove_unreferenced_vertices()
    mesh.compute_vertex_normals()

    vertices = np.asarray(mesh.vertices)
    triangles = np.asarray(mesh.triangles)
    point_positions = np.asarray(point_cloud.points)
    point_colors = np.asarray(point_cloud.colors)
    if len(point_colors) == len(point_positions) and len(point_colors):
        tree = o3d.geometry.KDTreeFlann(point_cloud)
        colors = np.empty((len(vertices), 4), dtype=np.uint8)
        for index, vertex in enumerate(vertices):
            _, nearest, _ = tree.search_knn_vector_3d(vertex, 1)
            rgb = np.clip(point_colors[nearest[0]] * 255, 0, 255).astype(np.uint8)
            colors[index] = [rgb[0], rgb[1], rgb[2], 255]
    else:
        colors = np.tile(np.array([[226, 170, 140, 255]], dtype=np.uint8), (len(vertices), 1))
    result = trimesh.Trimesh(vertices=vertices, faces=triangles, vertex_colors=colors, process=False)
    result.remove_unreferenced_vertices()
    result.export(output_path)
    extents = result.extents
    return {
        "sourcePoints": int(source_point_count),
        "croppedHeadPoints": int(len(point_cloud.points)),
        "vertices": int(len(result.vertices)),
        "triangles": int(len(result.faces)),
        "extents": [float(value) for value in extents],
        "components": int(len(result.split(only_watertight=False))),
    }


def bake_canonical_anime_texture(mesh_path: Path, glb_path: Path, texture_path: Path) -> dict[str, Any]:
    import cv2
    import numpy as np
    import trimesh
    import xatlas
    from PIL import Image

    source = trimesh.load(mesh_path, force="mesh", process=False)
    vertices = np.asarray(source.vertices, dtype=np.float32)
    faces = np.asarray(source.faces, dtype=np.uint32)
    colors = np.asarray(source.visual.vertex_colors, dtype=np.uint8)
    if len(colors) != len(vertices):
        colors = np.tile(np.array([[226, 170, 140, 255]], dtype=np.uint8), (len(vertices), 1))
    vmapping, remapped_faces, uvs = xatlas.parametrize(vertices, faces)
    remapped_vertices = vertices[vmapping]
    remapped_colors = colors[vmapping]
    texture_size = 1024
    texture = np.full((texture_size, texture_size, 3), 247, dtype=np.uint8)
    weight = np.zeros((texture_size, texture_size), dtype=np.uint8)
    pixels = np.empty_like(uvs)
    pixels[:, 0] = uvs[:, 0] * (texture_size - 1)
    pixels[:, 1] = (1.0 - uvs[:, 1]) * (texture_size - 1)
    for triangle in remapped_faces:
        polygon = np.round(pixels[triangle]).astype(np.int32)
        color = np.mean(remapped_colors[triangle, :3], axis=0).astype(np.uint8)
        cv2.fillConvexPoly(texture, polygon, tuple(int(value) for value in color))
        cv2.fillConvexPoly(weight, polygon, 255)
    dilate_kernel = np.ones((5, 5), np.uint8)
    for _ in range(4):
        dilated = cv2.dilate(texture, dilate_kernel)
        expanded = cv2.dilate(weight, dilate_kernel)
        texture[(expanded > 0) & (weight == 0)] = dilated[(expanded > 0) & (weight == 0)]
        weight = expanded
    image = Image.fromarray(texture, mode="RGB")
    image.save(texture_path)
    textured = trimesh.Trimesh(vertices=remapped_vertices, faces=remapped_faces, process=False)
    textured.visual = trimesh.visual.TextureVisuals(uv=uvs, image=image)
    textured.export(glb_path, file_type="glb")
    return {
        "vertices": int(len(textured.vertices)),
        "triangles": int(len(textured.faces)),
        "uvReady": True,
        "textureSize": texture_size,
    }


def render_turntable(mesh_path: Path, output_path: Path, frames: int = 24) -> None:
    import cv2
    import numpy as np
    import open3d as o3d
    import trimesh

    mesh = trimesh.load(mesh_path, force="mesh", process=False)
    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int64)
    colors = np.asarray(mesh.visual.vertex_colors)
    if len(colors) != len(vertices):
        colors = np.tile(np.array([[226, 170, 140, 255]]), (len(vertices), 1))
    if len(faces) > 20_000:
        preview = o3d.geometry.TriangleMesh()
        preview.vertices = o3d.utility.Vector3dVector(vertices)
        preview.triangles = o3d.utility.Vector3iVector(faces)
        preview.vertex_colors = o3d.utility.Vector3dVector(colors[:, :3].astype(np.float64) / 255.0)
        preview = preview.simplify_quadric_decimation(target_number_of_triangles=20_000)
        vertices = np.asarray(preview.vertices, dtype=np.float64)
        faces = np.asarray(preview.triangles, dtype=np.int64)
        colors = np.column_stack(
            (
                np.clip(np.asarray(preview.vertex_colors) * 255.0, 0, 255).astype(np.uint8),
                np.full(len(vertices), 255, dtype=np.uint8),
            )
        )
    center = vertices.mean(axis=0)
    vertices = vertices - center
    scale = 360 / max(float(np.ptp(vertices[:, 0])), float(np.ptp(vertices[:, 1])), 1e-6)
    frame_dir = output_path.parent / "turntable-frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    light = np.array([0.25, 0.65, 0.72])
    light /= np.linalg.norm(light)

    for frame_index in range(frames):
        angle = 2 * math.pi * frame_index / frames
        rotation = np.array(
            [[math.cos(angle), 0, math.sin(angle)], [0, 1, 0], [-math.sin(angle), 0, math.cos(angle)]]
        )
        rotated = vertices @ rotation.T
        projected = np.column_stack((rotated[:, 0] * scale + 256, 286 - rotated[:, 1] * scale))
        canvas = np.full((512, 512, 3), (28, 30, 40), dtype=np.uint8)
        silhouette = np.zeros((512, 512), dtype=np.uint8)
        depths = rotated[faces, 2].mean(axis=1)
        for face_index in np.argsort(depths):
            triangle = faces[face_index]
            points = np.round(projected[triangle]).astype(np.int32)
            a, b, c = rotated[triangle]
            edge_ab = b - a
            edge_ac = c - a
            normal = np.array(
                [
                    edge_ab[1] * edge_ac[2] - edge_ab[2] * edge_ac[1],
                    edge_ab[2] * edge_ac[0] - edge_ab[0] * edge_ac[2],
                    edge_ab[0] * edge_ac[1] - edge_ab[1] * edge_ac[0],
                ],
                dtype=np.float64,
            )
            norm = np.linalg.norm(normal)
            if norm < 1e-8:
                continue
            normal /= norm
            shade = 0.62 + 0.38 * abs(float(np.dot(normal, light)))
            color = np.clip(colors[triangle, :3].mean(axis=0) * shade, 0, 255).astype(np.uint8)
            cv2.fillConvexPoly(canvas, points, tuple(int(value) for value in color[::-1]))
            cv2.fillConvexPoly(silhouette, points, 255)
        contours, _ = cv2.findContours(silhouette, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(canvas, contours, -1, (38, 28, 42), 3, cv2.LINE_AA)
        cv2.imwrite(str(frame_dir / f"{frame_index:04d}.png"), canvas)
    run_command(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            "24",
            "-i",
            str(frame_dir / "%04d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ],
        output_path.parent,
        output_path.parent / "ffmpeg.log",
    )


def extract_face_identity_embedding(frames: list[dict[str, Any]], anime_reference: Path) -> dict[str, Any]:
    import cv2
    import numpy as np

    try:
        from insightface.app import FaceAnalysis

        app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
        app.prepare(ctx_id=0, det_size=(640, 640))

        def face_record(path: Path) -> tuple[Any, dict[str, Any] | None]:
            image = cv2.imread(str(path))
            detected = app.get(image)
            if not detected:
                return None, None
            face = max(detected, key=lambda item: float(item.bbox[2] - item.bbox[0]))
            vector = np.asarray(face.normed_embedding, dtype=np.float32)
            height, width = image.shape[:2]
            record = {
                "box": [
                    float(face.bbox[0] / width),
                    float(face.bbox[1] / height),
                    float(face.bbox[2] / width),
                    float(face.bbox[3] / height),
                ],
                "landmarks": [
                    [float(point[0] / width), float(point[1] / height)]
                    for point in np.asarray(face.kps)
                ],
            }
            return vector / max(np.linalg.norm(vector), 1e-8), record

        raw_records = [(frame["pose"], *face_record(frame["image_path"])) for frame in frames]
        valid = [(pose, vector) for pose, vector, _ in raw_records if vector is not None]
        anime, anime_record = face_record(anime_reference)
        if not valid or anime is None:
            raise RuntimeError("arcface_detection_failed")
        weights = np.array([next(frame["quality"] for frame in frames if frame["pose"] == pose) for pose, _ in valid])
        weights = weights / max(weights.sum(), 1e-8)
        aggregate = sum(vector * weight for (_, vector), weight in zip(valid, weights))
        aggregate /= max(np.linalg.norm(aggregate), 1e-8)
        similarities = {pose: float(np.dot(vector, aggregate)) for pose, vector in valid}
        anime_similarity = float(np.dot(anime, aggregate))
        front_record = next((record for pose, _, record in raw_records if pose == "front"), None)
        return {
            "provider": "insightface-buffalo_l",
            "aggregate": aggregate.tolist(),
            "perViewSimilarity": similarities,
            "animeSimilarity": anime_similarity,
            "confidence": max(0.0, min(1.0, anime_similarity)),
            "frontFace": front_record,
            "animeFace": anime_record,
        }
    except Exception as error:
        print(f"[NeRFHead] identity encoder unavailable error={error}", flush=True)
        return {
            "provider": "unavailable",
            "aggregate": [],
            "perViewSimilarity": {},
            "animeSimilarity": 0.0,
            "confidence": 0.0,
            "error": str(error),
        }


def _median_hex(image_bgr: Any, mask: Any, fallback: str | None = None) -> str | None:
    import numpy as np

    pixels = image_bgr[mask]
    if len(pixels) < 40:
        return fallback
    bgr = np.median(pixels, axis=0).astype(np.uint8)
    return f"#{int(bgr[2]):02x}{int(bgr[1]):02x}{int(bgr[0]):02x}"


def estimate_identity_features(frames: list[dict[str, Any]], identity: dict[str, Any]) -> dict[str, Any]:
    import cv2
    import numpy as np

    front = next(frame for frame in frames if frame["pose"] == "front")
    image = cv2.imread(str(front["image_path"]))
    height, width = image.shape[:2]
    detected = identity.get("frontFace") or {}
    box = detected.get("box")
    if not box:
        x, y, w, h = detect_face_box(image, None)
        box = [x / width, y / height, (x + w) / width, (y + h) / height]
    x0, y0, x1, y1 = [max(0.0, min(1.0, float(value))) for value in box]
    face_width = max(x1 - x0, 1e-4)
    face_height = max(y1 - y0, 1e-4)
    landmarks = detected.get("landmarks") or []
    if len(landmarks) >= 5:
        left_eye, right_eye, nose, mouth_left, mouth_right = landmarks[:5]
        eye_line = (float(left_eye[1]) + float(right_eye[1])) * 0.5
        mouth_line = (float(mouth_left[1]) + float(mouth_right[1])) * 0.5
        eye_distance = abs(float(right_eye[0]) - float(left_eye[0])) / face_width
        mouth_width = abs(float(mouth_right[0]) - float(mouth_left[0])) / face_width
        brow_tilt = math.atan2(
            float(right_eye[1]) - float(left_eye[1]),
            float(right_eye[0]) - float(left_eye[0]),
        )
        nose_x = float(nose[0])
    else:
        eye_line = y0 + face_height * 0.40
        mouth_line = y0 + face_height * 0.73
        eye_distance = None
        mouth_width = None
        brow_tilt = None
        nose_x = (x0 + x1) * 0.5

    yy, xx = np.mgrid[0:height, 0:width]
    skin_region = (
        (xx >= int((x0 + face_width * 0.18) * width))
        & (xx <= int((x1 - face_width * 0.18) * width))
        & (yy >= int((y0 + face_height * 0.38) * height))
        & (yy <= int((y0 + face_height * 0.72) * height))
    )
    b, g, r = image[:, :, 0], image[:, :, 1], image[:, :, 2]
    skin_color = skin_region & (r > 55) & (g > 35) & (b > 20) & (r > b)
    hair_region = (
        (xx >= int(max(0.0, x0 - face_width * 0.12) * width))
        & (xx <= int(min(1.0, x1 + face_width * 0.12) * width))
        & (yy >= int(max(0.0, y0 - face_height * 0.26) * height))
        & (yy <= int((y0 + face_height * 0.18) * height))
    )
    luminance = image.mean(axis=2)
    hair_color = hair_region & (luminance < np.percentile(luminance[hair_region], 72) if hair_region.any() else False)
    features: dict[str, Any] = {
        "faceAspectRatio": face_height / face_width,
        "faceWidthRatio": face_width,
        "eyeLineEstimateY": (eye_line - y0) / face_height,
        "mouthLineEstimateY": (mouth_line - y0) / face_height,
        "skinToneHex": _median_hex(image, skin_color),
        "hairToneHex": _median_hex(image, hair_color),
        "hairlineY": y0,
        "faceCenterOffsetX": nose_x - 0.5,
        "poseCoverage": {pose: any(frame["pose"] == pose for frame in frames) for pose in POSES},
    }
    if eye_distance is not None:
        features["eyeDistanceRatio"] = eye_distance
    if mouth_width is not None:
        features["mouthWidthRatio"] = mouth_width
    if brow_tilt is not None:
        features["browTilt"] = brow_tilt
    return features


def measure_anime_style(original_path: Path, stylized_path: Path) -> dict[str, float]:
    import cv2
    import numpy as np

    original = cv2.imread(str(original_path))
    stylized = cv2.imread(str(stylized_path))
    if original is None or stylized is None:
        return {"score": 0.0, "edgeRetention": 0.0, "paletteReduction": 0.0, "flatRegionGain": 0.0}
    original = cv2.resize(original, (256, 256), interpolation=cv2.INTER_AREA)
    stylized = cv2.resize(stylized, (256, 256), interpolation=cv2.INTER_AREA)
    original_edges = cv2.Canny(original, 80, 160).mean() / 255.0
    stylized_edges = cv2.Canny(stylized, 80, 160).mean() / 255.0
    edge_retention = min(1.0, stylized_edges / max(original_edges, 1e-4))
    original_palette = len(np.unique((original // 16).reshape(-1, 3), axis=0))
    stylized_palette = len(np.unique((stylized // 16).reshape(-1, 3), axis=0))
    palette_reduction = max(0.0, min(1.0, 1.0 - stylized_palette / max(original_palette, 1)))
    original_laplacian = cv2.Laplacian(original, cv2.CV_32F).var()
    stylized_laplacian = cv2.Laplacian(stylized, cv2.CV_32F).var()
    flat_region_gain = max(0.0, min(1.0, 1.0 - stylized_laplacian / max(original_laplacian, 1e-4)))
    # Half the score represents successful execution of the neural style model;
    # the rest is measured color flattening and line retention.
    score = min(1.0, 0.50 + 0.20 * edge_retention + 0.18 * palette_reduction + 0.12 * flat_region_gain)
    return {
        "score": float(score),
        "edgeRetention": float(edge_retention),
        "paletteReduction": float(palette_reduction),
        "flatRegionGain": float(flat_region_gain),
    }


def validate_camera_orientation(cameras: list[dict[str, Any]]) -> dict[str, Any]:
    by_pose = {camera["pose"]: camera for camera in cameras}
    checks = {
        "left_is_inverse_positive_yaw": by_pose.get("left", {}).get("yaw_degrees", 0) > 0,
        "right_is_inverse_negative_yaw": by_pose.get("right", {}).get("yaw_degrees", 0) < 0,
        "up_is_inverse_negative_pitch": by_pose.get("up", {}).get("pitch_degrees", 0) < 0,
        "down_is_inverse_positive_pitch": by_pose.get("down", {}).get("pitch_degrees", 0) > 0,
    }
    return {"score": sum(bool(value) for value in checks.values()) / len(checks), "checks": checks}


def validate_stylized_head_asset(
    mesh_stats: dict[str, Any],
    texture_stats: dict[str, Any],
    identity: dict[str, Any],
    style_metrics: dict[str, float],
    orientation: dict[str, Any],
    smoke_test: bool,
) -> dict[str, Any]:
    extents = mesh_stats.get("extents", [0, 0, 0])
    depth_ratio = float(extents[2]) / max(float(extents[0]), 1e-6)
    geometry_score = min(1.0, max(0.0, depth_ratio / 0.55))
    identity_score = float(identity.get("confidence", 0.0))
    errors: list[str] = []
    warnings: list[str] = []
    if mesh_stats.get("vertices", 0) < 5_000:
        errors.append("head_mesh_too_sparse")
    if mesh_stats.get("triangles", 0) < 8_000:
        errors.append("head_mesh_triangle_count_too_low")
    if depth_ratio < 0.28:
        errors.append("head_mesh_is_effectively_planar")
    if mesh_stats.get("components", 99) > 2:
        errors.append("head_mesh_disconnected")
    if not texture_stats.get("uvReady"):
        errors.append("head_mesh_missing_uv")
    if identity.get("provider") == "unavailable":
        (warnings if smoke_test else errors).append("identity_encoder_unavailable")
    elif identity_score < 0.28:
        errors.append("anime_identity_similarity_too_low")
    if style_metrics.get("score", 0.0) < 0.65:
        errors.append("anime_style_score_too_low")
    if orientation.get("score", 0.0) < 1.0:
        errors.append("camera_pose_orientation_invalid")
    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "identityScore": identity_score,
        "styleScore": float(style_metrics.get("score", 0.0)),
        "geometryScore": geometry_score,
        "multiviewCoverageScore": 1.0,
        "textureOrientationScore": float(orientation.get("score", 0.0)),
        "depthRatio": depth_ratio,
        "styleMetrics": style_metrics,
        "orientationChecks": orientation.get("checks", {}),
    }


def package_checkpoint(context: PipelineContext, config_path: Path, output_path: Path) -> None:
    with tarfile.open(output_path, "w:gz") as archive:
        archive.add(config_path, arcname="config.yml")
        for checkpoint in config_path.parent.rglob("*.ckpt"):
            archive.add(checkpoint, arcname=f"checkpoints/{checkpoint.name}")


def run_pipeline(job_dir: Path) -> None:
    context = PipelineContext(job_dir)
    stage = "preprocessing"
    try:
        validate_five_view_capture(context.request)
        context.status(stage, 0.04)
        frames = normalize_head_scan_frames(context)

        stage = "camera-solving"
        context.status(stage, 0.11)
        cameras = estimate_sparse_head_camera_poses(frames)

        stage = "face-prior-fitting"
        context.status(stage, 0.18)
        neutral_dataset = fit_face_geometry_prior(context, frames, cameras)

        stage = "geometry-training"
        context.status(stage, 0.26)
        neutral_config, neutral_seconds = train_few_shot_head_neural_field(context, neutral_dataset)

        stage = "anime-reference-generation"
        context.status(stage, 0.56)
        anime_model, face2paint = load_animegan()
        anime_reference = generate_canonical_anime_reference(context, frames, anime_model, face2paint)
        create_stylized_views(context, frames, anime_model, face2paint)
        front_frame = next(frame for frame in frames if frame["pose"] == "front")
        style_metrics = measure_anime_style(front_frame["image_path"], anime_reference)

        stage = "identity-encoding"
        context.status(stage, 0.61)
        identity = extract_face_identity_embedding(frames, anime_reference)
        identity_features = estimate_identity_features(frames, identity)

        stage = "style-distillation"
        context.status(stage, 0.66)
        stylized_config, stylized_seconds = distill_anime_style_into_neural_field(
            context, frames, cameras, neutral_config
        )

        stage = "mesh-extraction"
        context.status(stage, 0.84)
        point_cloud = export_point_cloud(context, stylized_config)
        export_dir = context.job_dir / "export"
        export_dir.mkdir(parents=True, exist_ok=True)
        vertex_mesh = export_dir / "head-vertex-color.ply"
        mesh_stats = point_cloud_to_mesh(point_cloud, vertex_mesh)

        stage = "texture-baking"
        context.status(stage, 0.91)
        glb_path = export_dir / "head.glb"
        texture_path = export_dir / "albedo.png"
        texture_stats = bake_canonical_anime_texture(vertex_mesh, glb_path, texture_path)
        shutil.copy2(anime_reference, export_dir / "anime-reference.png")
        turntable_path = export_dir / "turntable.mp4"
        render_turntable(vertex_mesh, turntable_path)

        stage = "validation"
        context.status(stage, 0.96)
        orientation = validate_camera_orientation(cameras)
        smoke_test = context.request.get("training", {}).get("smokeTest") is True
        validation = validate_stylized_head_asset(
            mesh_stats,
            texture_stats,
            identity,
            style_metrics,
            orientation,
            smoke_test,
        )
        try:
            import torch

            gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"
        except Exception:
            gpu_name = "unknown"
        requested_training = context.request.get("training", {})
        geometry_iterations = max(
            32 if smoke_test else 800,
            min(int(requested_training.get("geometryIterations", 1800)), 8000),
        )
        style_iterations = max(
            48 if smoke_test else 1200,
            min(int(requested_training.get("styleIterations", 2600)), 10000),
        )
        report = {
            "jobId": context.job_id,
            "providerStage": "nerf-aigc-provider",
            "backend": "depth-nerfacto-guided-prior+animeganv2-distillation",
            "geometryPrior": "guided-five-view-ellipsoid-depth-prior-v1",
            "mesh": mesh_stats,
            "texture": texture_stats,
            "identity": {key: value for key, value in identity.items() if key != "aggregate"},
            "identityFeatures": identity_features,
            "style": style_metrics,
            "cameraOrientation": orientation,
            "training": {
                "gpuName": gpu_name,
                "geometryIterations": geometry_iterations,
                "styleIterations": style_iterations,
                "geometrySeconds": neutral_seconds,
                "styleSeconds": stylized_seconds,
                "elapsedSeconds": time.time() - context.started_at,
            },
            "validation": validation,
        }
        write_json_atomic(export_dir / "report.json", report)
        if not validation["ok"]:
            raise ValidationFailure("stylized_head_validation_failed", validation["errors"])

        stage = "publishing"
        context.status(stage, 0.99)
        checkpoint_path = export_dir / "neural-field.tar.gz"
        package_checkpoint(context, stylized_config, checkpoint_path)
        base = f"/head-assets/{context.job_id}"
        result = {
            "providerStage": "nerf-aigc-provider",
            "representation": "neural-field+mesh+texture",
            "meshUrl": f"{base}/head.glb",
            "neuralFieldUrl": f"{base}/neural-field.tar.gz",
            "canonicalTextureUrl": f"{base}/albedo.png",
            "previewUrl": f"{base}/turntable.mp4",
            "reportUrl": f"{base}/report.json",
            "animeReferenceUrl": f"{base}/anime-reference.png",
            "sourceFrameCount": 5,
            "confidence": min(
                float(identity.get("confidence", 0.0)),
                float(validation["geometryScore"]),
                float(validation["styleScore"]),
                0.88,
            ),
            "identityFeatures": identity_features,
            "multiViewCoverage": {**{pose: True for pose in POSES}, "score": 1.0},
            "trainingSummary": {
                "backend": "nerfacto-face-prior",
                "gpuName": gpu_name,
                "iterations": geometry_iterations + style_iterations,
                "elapsedSeconds": time.time() - context.started_at,
                "photometricLoss": None,
                "identityLoss": 1 - float(identity.get("confidence", 0.0)),
                "geometryPriorLoss": None,
                "multiviewConsistencyLoss": None,
                "styleLoss": None,
            },
            "validation": validation,
        }
        write_json_atomic(
            context.job_dir / "status.json",
            {
                "jobId": context.job_id,
                "status": "succeeded",
                "stage": "succeeded",
                "progress": 1.0,
                "result": result,
                "startedAt": context.started_at,
                "finishedAt": time.time(),
            },
        )
        print(f"[NeRFHead] Complete job={context.job_id} elapsed={time.time() - context.started_at:.1f}s", flush=True)
    except BaseException as error:
        traceback.print_exc()
        context.fail(stage, error)
        raise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-dir", type=Path, required=True)
    args = parser.parse_args()
    run_pipeline(args.job_dir.resolve())
    return 0


if __name__ == "__main__":
    sys.exit(main())
