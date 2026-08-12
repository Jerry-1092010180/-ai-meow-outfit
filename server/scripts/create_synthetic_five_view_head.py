"""Create a deterministic five-view head scan for GPU pipeline smoke tests.

This dataset validates camera semantics and the complete NeRF/export machinery.
It is deliberately marked as synthetic and must never be reported as user
personalization evidence.
"""

from __future__ import annotations

import argparse
import base64
import json
import math
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image


SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from nerf_head_pipeline_impl import POSES, POSE_ANGLES, camera_to_world  # noqa: E402


def _ellipsoid_hit(origin: np.ndarray, direction: np.ndarray, center: np.ndarray, radii: np.ndarray) -> np.ndarray:
    local_origin = (origin - center) / radii
    local_direction = direction / radii
    a = np.sum(local_direction * local_direction, axis=-1)
    b = 2.0 * np.sum(local_origin * local_direction, axis=-1)
    c = np.sum(local_origin * local_origin, axis=-1) - 1.0
    discriminant = b * b - 4.0 * a * c
    valid = discriminant >= 0
    root = np.sqrt(np.maximum(discriminant, 0.0))
    near = (-b - root) / np.maximum(2.0 * a, 1e-8)
    far = (-b + root) / np.maximum(2.0 * a, 1e-8)
    distance = np.where(near > 0, near, far)
    return np.where(valid & (distance > 0), distance, np.inf)


def render_head(yaw: float, pitch: float, size: int = 512) -> Image.Image:
    c2w = np.asarray(camera_to_world(yaw, pitch), dtype=np.float64)
    origin = c2w[:3, 3]
    focal = size / (2.0 * math.tan(math.radians(48.0) / 2.0))
    yy, xx = np.mgrid[0:size, 0:size]
    camera_rays = np.stack(
        ((xx + 0.5 - size / 2) / focal, -(yy + 0.5 - size / 2) / focal, -np.ones_like(xx)),
        axis=-1,
    )
    camera_rays /= np.linalg.norm(camera_rays, axis=-1, keepdims=True)
    directions = camera_rays @ c2w[:3, :3].T

    primitives = [
        (np.array([0.0, 0.0, 0.0]), np.array([0.43, 0.56, 0.47]), 0),
        (np.array([0.0, -0.02, 0.455]), np.array([0.075, 0.105, 0.095]), 1),
        (np.array([-0.43, 0.0, 0.0]), np.array([0.075, 0.14, 0.075]), 2),
        (np.array([0.43, 0.0, 0.0]), np.array([0.075, 0.14, 0.075]), 2),
    ]
    hits = np.stack([_ellipsoid_hit(origin, directions, center, radii) for center, radii, _ in primitives])
    primitive_index = np.argmin(hits, axis=0)
    distance = np.min(hits, axis=0)
    visible = np.isfinite(distance)
    points = origin + directions * np.where(visible, distance, 0.0)[..., None]

    centers = np.stack([item[0] for item in primitives])
    radii = np.stack([item[1] for item in primitives])
    chosen_centers = centers[primitive_index]
    chosen_radii = radii[primitive_index]
    normals = (points - chosen_centers) / np.maximum(chosen_radii * chosen_radii, 1e-8)
    normals /= np.maximum(np.linalg.norm(normals, axis=-1, keepdims=True), 1e-8)
    light = np.array([-0.35, 0.65, 0.68])
    light /= np.linalg.norm(light)
    shade = np.clip(0.68 + 0.32 * np.sum(normals * light, axis=-1), 0.48, 1.0)

    skin = np.array([234.0, 177.0, 145.0])
    image = np.full((size, size, 3), np.array([238, 241, 246]), dtype=np.float64)
    image[visible] = skin * shade[visible, None]

    x, y, z = points[..., 0], points[..., 1], points[..., 2]
    front = visible & (z > 0.24) & (primitive_index == 0)
    hair = visible & (primitive_index == 0) & ((y > 0.24) | ((z < 0.08) & (y > -0.25)))
    hair_color = np.array([60.0, 31.0, 38.0])
    image[hair] = hair_color * (0.76 + 0.24 * shade[hair, None])

    left_eye = front & ((((x + 0.145) / 0.072) ** 2 + ((y - 0.105) / 0.047) ** 2) < 1)
    right_eye = front & ((((x - 0.145) / 0.072) ** 2 + ((y - 0.105) / 0.047) ** 2) < 1)
    eye = left_eye | right_eye
    image[eye] = np.array([28.0, 24.0, 31.0])
    eye_highlight = front & (
        ((((x + 0.125) / 0.018) ** 2 + ((y - 0.125) / 0.018) ** 2) < 1)
        | ((((x - 0.125) / 0.018) ** 2 + ((y - 0.125) / 0.018) ** 2) < 1)
    )
    image[eye_highlight] = 248
    brows = front & (
        ((np.abs(y - (0.205 + 0.18 * (np.abs(x) - 0.14))) < 0.018) & (np.abs(np.abs(x) - 0.145) < 0.09))
    )
    image[brows] = np.array([70.0, 37.0, 42.0])
    mouth = front & (np.abs(y + 0.175 + 0.22 * x * x) < 0.018) & (np.abs(x) < 0.135)
    image[mouth] = np.array([163.0, 62.0, 82.0])
    nose_line = front & (np.abs(x) < 0.014) & (y > -0.08) & (y < 0.055)
    image[nose_line] = np.array([190.0, 117.0, 103.0])

    image = np.clip(image, 0, 255).astype(np.uint8)
    return Image.fromarray(image, mode="RGB")


def create_job(job_dir: Path, geometry_iterations: int, style_iterations: int) -> None:
    job_dir.mkdir(parents=True, exist_ok=True)
    source_dir = job_dir / "synthetic-source"
    source_dir.mkdir(exist_ok=True)
    frames = []
    for pose in POSES:
        yaw, pitch = POSE_ANGLES[pose]
        image = render_head(yaw, pitch)
        path = source_dir / f"{pose}.jpg"
        image.save(path, quality=94)
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        frames.append(
            {
                "id": f"synthetic-{pose}",
                "poseLabel": pose,
                "imageDataUrl": f"data:image/jpeg;base64,{encoded}",
                "width": image.width,
                "height": image.height,
                "mirrored": False,
                "qualityScore": 0.96,
                "faceBox": {"x": 0.19, "y": 0.12, "width": 0.62, "height": 0.72},
            }
        )
    request = {
        "jobId": job_dir.name,
        "identityId": "synthetic-smoke-not-a-user",
        "renderStyle": {"id": "manga-toon-3d"},
        "frames": frames,
        "training": {
            "backend": "nerfacto-face-prior",
            "geometryMode": "original-rgb-with-face-prior",
            "stylizationMode": "canonical-reference-3d-distillation",
            "outputFormat": "glb",
            "geometryIterations": geometry_iterations,
            "styleIterations": style_iterations,
            "smokeTest": True,
        },
        "testOnly": True,
        "createdAt": time.time(),
    }
    (job_dir / "request.json").write_text(json.dumps(request, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-dir", type=Path, required=True)
    parser.add_argument("--geometry-iterations", type=int, default=64)
    parser.add_argument("--style-iterations", type=int, default=96)
    args = parser.parse_args()
    create_job(args.job_dir.resolve(), args.geometry_iterations, args.style_iterations)
    print(args.job_dir.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
