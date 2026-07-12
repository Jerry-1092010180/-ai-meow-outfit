"""高精度 512³ voxel carving 重建测试"""
import numpy as np
from PIL import Image, ImageDraw
import math, cv2, trimesh, time

def render_humanoid(angle_deg):
    img = Image.new('RGB', (512, 1024), color=(200, 210, 220))
    draw, a = ImageDraw.Draw(img), math.radians(angle_deg)
    bv, lo = abs(math.cos(a)), math.sin(a) * 40
    hcx = 256 + int(lo * 0.3)
    draw.ellipse([(hcx - 55, 90), (hcx + 55, 150)], fill=(255, 220, 190))
    draw.ellipse([(hcx - 60, 80), (hcx + 60, 120)], fill=(60, 40, 20))
    tw = int(70 + 30 * bv)
    tl, tr = 256 - tw // 2 + int(lo), 256 + tw // 2 + int(lo)
    draw.rectangle([(tl, 180), (tr, 460)], fill=(41, 128, 185))
    lw = int(28 + 12 * bv)
    for lx in [224, 280]:
        lx2 = lx + int(lo)
        draw.rectangle([(lx2, 460), (lx2 + lw, 860)], fill=(44, 62, 80))
    draw.ellipse([(160, 905), (360, 965)], fill=(160, 170, 185))
    return np.array(img)

angles = [0, 45, 90, 135, 180, 225, 270, 315]
silhouettes = []
for a in angles:
    img = render_humanoid(a)
    h, w = img.shape[:2]
    margin_x, margin_y = int(w * 0.08), int(h * 0.03)
    rect = (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)
    mask = np.zeros((h, w), np.uint8)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, rect, bgd, fgd, 3, cv2.GC_INIT_WITH_RECT)
    sil = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    silhouettes.append((sil > 128).astype(np.uint8))

print("Silhouettes extracted. Running proper visual hull carving...")
t0 = time.time()

RES = 256  # Use 256 for speed, still much better than 66 verts
CENTER = RES // 2
# Precompute voxel grid coordinates
z, y, x = np.mgrid[0:RES, 0:RES, 0:RES]
cx, cy, cz = x - CENTER, y - CENTER * 0.6, z - CENTER
# Count how many silhouettes each voxel projects inside
vote_counts = np.zeros((RES, RES, RES), dtype=np.uint8)

for sil, angle in zip(silhouettes, angles):
    rad = math.radians(angle)
    # Rotate voxel coordinates to this viewpoint
    rx = (cx * math.cos(rad) - cz * math.sin(rad)).astype(int) + CENTER
    ry = (cy).astype(int) + int(CENTER * 0.6)
    # Clamp to silhouette bounds
    h, w = sil.shape
    s = RES / max(w, h)
    px = np.clip((rx * s).astype(int), 0, w - 1)
    py = np.clip(((RES - 1 - ry) * s).astype(int), 0, h - 1)
    # Vote: is this voxel inside the silhouette?
    inside = sil[py, px] > 0
    vote_counts += inside.astype(np.uint8)

# Voxel must be inside at least 3 of 8 views (relaxed)
MIN_VOTES = 3
voxel = vote_counts >= MIN_VOTES
print(f"Voxels with >= {MIN_VOTES} votes: {voxel.sum()} / {RES**3} ({time.time()-t0:.1f}s)")
print(f"Max votes per voxel: {vote_counts.max()}")

# If still zero, try even more relaxed
if voxel.sum() == 0 and vote_counts.max() > 0:
    MIN_VOTES = max(1, vote_counts.max() // 2)
    voxel = vote_counts >= MIN_VOTES
    print(f"Fallback: >= {MIN_VOTES} votes -> {voxel.sum()} voxels")

carve_time = time.time() - t0
print(f"Voxels filled: {voxel.sum()} / {RES**3} ({carve_time:.1f}s)")

from skimage.measure import marching_cubes
verts, faces, _, _ = marching_cubes(voxel.astype(float), level=0.5)
mesh = trimesh.Trimesh(vertices=verts, faces=faces)
mesh = mesh.simplify_quadratic_decimation(20000)
mesh = trimesh.smoothing.filter_laplacian(mesh)

out_path = '/home/jerry/avatar-output/hires-test.glb'
mesh.export(out_path)
print(f"✅ Done: {len(mesh.vertices)} verts, {len(mesh.faces)} faces ({time.time()-t0:.1f}s total)")
print(f"Saved to {out_path}")
