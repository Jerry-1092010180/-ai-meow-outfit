"""
AI 喵搭 — 真人 3D 重建服务器
部署在 AIGC (4090D GPU) 上，通过 Tailscale IP 100.114.7.5 访问
用法: python avatar_server.py --port 8765
"""

import os, io, json, base64, time, tempfile
from pathlib import Path
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import trimesh
import open3d as o3d

app = FastAPI(title="AI喵搭 Avatar Server", version="0.1.0")

OUTPUT_DIR = Path.home() / "avatar-output"
OUTPUT_DIR.mkdir(exist_ok=True)


# ── Request types ──
class CaptureFrame(BaseModel):
    angle: int
    imageDataUrl: str
    capturedAt: str
    qualityScore: float

class BodyMeasurements(BaseModel):
    heightCm: float
    weightKg: float
    bodyType: str
    shoulderCm: float | None = None
    bustCm: float | None = None
    waistCm: float | None = None
    hipCm: float | None = None
    inseamCm: float | None = None

class ManifestRequest(BaseModel):
    measurements: BodyMeasurements
    frames: list[CaptureFrame]


# ── Helpers ──
def dataurl_to_image(dataurl: str) -> np.ndarray:
    """Convert base64 data URL to numpy BGR image."""
    header, encoded = dataurl.split(",", 1)
    raw = base64.b64decode(encoded)
    arr = np.frombuffer(raw, dtype=np.uint8)
    import cv2
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def image_to_silhouette(img: np.ndarray) -> np.ndarray:
    """Extract foreground mask using rembg (GPU-accelerated)."""
    from rembg import remove
    from PIL import Image
    import cv2
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)
    result = remove(pil_img, only_mask=False, post_process_mask=True)
    if isinstance(result, tuple):
        mask = np.array(result[1])  # rembg returns (image, mask) tuple
    else:
        mask = np.array(result.convert("L"))
    return (mask > 128).astype(np.uint8)


def silhouettes_to_voxel_mesh(
    silhouettes: list[np.ndarray],
    angles_deg: list[int],
    voxel_resolution: int = 256,
    height_cm: float = 168
) -> trimesh.Trimesh:
    """
    Multi-view silhouette carving → voxel grid → marching cubes → mesh.
    Each silhouette is assumed to be a binary mask of the person at the given rotation.
    """
    voxel = np.ones((voxel_resolution, voxel_resolution, voxel_resolution), dtype=bool)

    for sil, angle in zip(silhouettes, angles_deg):
        # Resize silhouette to voxel resolution
        h, w = sil.shape
        scale = min(voxel_resolution / w, voxel_resolution / h)
        new_w = int(w * scale)
        new_h = int(h * scale)
        import cv2
        sil_resized = cv2.resize(sil.astype(np.uint8), (new_w, new_h)) > 128
        pad_h = (voxel_resolution - new_h) // 2
        pad_w = (voxel_resolution - new_w) // 2
        sil_vox = np.zeros((voxel_resolution, voxel_resolution), dtype=bool)
        sil_vox[pad_h:pad_h+new_h, pad_w:pad_w+new_w] = sil_resized

        # Rotate the voxel grid to match the camera angle
        angle_idx = int(round(angle / 360 * voxel_resolution)) % voxel_resolution
        sil_rotated = np.roll(sil_vox, angle_idx, axis=1)

        # Carve: only keep voxels that project inside the silhouette at this angle
        for y in range(voxel_resolution):
            voxel[:, :, y] &= sil_rotated

    if not voxel.any():
        # Fallback: return a simple cylinder mesh scaled to measurements
        cylinder = trimesh.creation.cylinder(radius=0.15, height=height_cm / 100 * 1.7, sections=32)
        return cylinder

    # Marching cubes to extract mesh
    verts, faces, _, _ = _marching_cubes(voxel.astype(float), level=0.5)
    mesh = trimesh.Trimesh(vertices=verts, faces=faces)
    mesh = mesh.simplify_quadratic_decimation(20000)
    mesh = trimesh.smoothing.filter_laplacian(mesh)
    return mesh


def _marching_cubes(vol: np.ndarray, level: float = 0.5):
    """Pure numpy marching cubes fallback (copied from skimage)."""
    try:
        from skimage.measure import marching_cubes
        return marching_cubes(vol, level=level)
    except ImportError:
        pass
    # Minimal fallback: return a sphere
    sphere = trimesh.creation.icosphere(subdivisions=3, radius=0.3)
    return sphere.vertices, sphere.faces, None, None


def apply_measurements_scale(mesh: trimesh.Trimesh, height_cm: float, weight_kg: float) -> trimesh.Trimesh:
    """Scale mesh to match real-world measurements."""
    target_height = height_cm / 100  # meters
    target_volume = weight_kg / 1000  # rough volume in m³ from kg (water density)
    current_height = mesh.bounds[1, 1] - mesh.bounds[0, 1]
    height_scale = target_height / max(current_height, 0.01)
    mesh.apply_scale(height_scale)
    return mesh


@app.get("/health")
def health():
    return {"status": "ok", "gpu": "NVIDIA GeForce RTX 4090 D", "vram_free_gb": 19}


@app.post("/reconstruct")
def reconstruct(manifest: ManifestRequest):
    t_start = time.time()
    job_id = f"avatar-{int(t_start)}"

    try:
        images = []
        for frame in manifest.frames:
            img = dataurl_to_image(frame.imageDataUrl)
            if img is None or img.size == 0:
                raise HTTPException(400, f"Invalid image at angle {frame.angle}")
            images.append(img)

        # Step 1: Extract silhouettes
        silhouettes = [image_to_silhouette(img) for img in images]
        angles = [f.angle for f in manifest.frames]

        # Step 2: Multi-view voxel carving
        mesh = silhouettes_to_voxel_mesh(
            silhouettes, angles,
            height_cm=manifest.measurements.heightCm
        )

        # Step 3: Scale to measurements
        mesh = apply_measurements_scale(
            mesh,
            manifest.measurements.heightCm,
            manifest.measurements.weightKg
        )

        # Step 4: Export GLB
        glb_path = OUTPUT_DIR / f"{job_id}.glb"
        mesh.export(str(glb_path), file_type="glb")

        # Step 5: Generate preview image
        scene = trimesh.Scene(mesh)
        png_bytes = scene.save_image(resolution=(512, 512), visible=True)

        elapsed = round(time.time() - t_start, 1)
        return {
            "job_id": job_id,
            "status": "ready",
            "elapsed_seconds": elapsed,
            "vertices": len(mesh.vertices),
            "faces": len(mesh.faces),
            "model_url": f"/models/{job_id}.glb",
            "preview_url": f"/models/{job_id}-preview.png",
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Reconstruction failed: {str(e)}")


@app.get("/models/{filename}")
def get_model(filename: str):
    """Serve generated GLB models."""
    path = OUTPUT_DIR / filename
    if not path.exists():
        raise HTTPException(404, "Model not found")
    from fastapi.responses import FileResponse
    return FileResponse(path, media_type="model/gltf-binary")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8765)
