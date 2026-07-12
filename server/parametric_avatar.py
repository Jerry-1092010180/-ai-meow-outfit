"""
参数化人体 GLB 生成器
基于身高/体重/身型直接生成高质量 3D 人体模型
不需要照片对齐，结果稳定可靠
"""

import numpy as np
import trimesh
import math

def create_parametric_body(
    height_cm: float = 168,
    weight_kg: float = 58,
    body_type: str = "hourglass",
    resolution: int = 64
) -> trimesh.Trimesh:
    """
    Build a realistic human body mesh from measurements.
    Uses superellipsoid cross-sections scaled to body type.
    """

    # Body type parameters (relative widths at shoulder/waist/hip)
    body_params = {
        "hourglass": {"shoulder": 1.0, "waist": 0.65, "hip": 1.0},
        "pear": {"shoulder": 0.9, "waist": 0.7, "hip": 1.1},
        "apple": {"shoulder": 0.95, "waist": 0.95, "hip": 0.9},
        "rectangle": {"shoulder": 0.9, "waist": 0.85, "hip": 0.9},
        "inverted_triangle": {"shoulder": 1.1, "waist": 0.7, "hip": 0.85},
    }
    bp = body_params.get(body_type, body_params["hourglass"])

    # Scale factors from measurements
    h_scale = height_cm / 168.0
    w_scale = math.sqrt(weight_kg / 58.0)

    n_slices = 40  # Vertical resolution
    n_angles = resolution  # Horizontal resolution

    vertices = []
    faces = []

    # Define body profile: (height_ratio, width_front, width_side, label)
    # height_ratio: 0=feet, 1=top of head
    profile = [
        (0.00, 0.12, 0.20),   # feet
        (0.03, 0.14, 0.22),   # ankles
        (0.12, 0.18, 0.20),   # calves
        (0.28, 0.22, 0.22),   # knees
        (0.38, 0.30, 0.26),   # thighs
        (0.50, 0.40 * bp["hip"], 0.30 * bp["hip"]),  # hips
        (0.56, 0.38 * bp["waist"], 0.26 * bp["waist"]),  # waist
        (0.64, 0.42 * bp["shoulder"], 0.28 * bp["shoulder"]),  # chest
        (0.72, 0.44 * bp["shoulder"], 0.28 * bp["shoulder"]),  # shoulders
        (0.78, 0.15, 0.15),   # neck
        (0.82, 0.20, 0.22),   # head base
        (0.88, 0.22, 0.24),   # head mid
        (0.94, 0.18, 0.22),   # head top
        (1.00, 0.02, 0.02),   # crown
    ]

    # Generate vertices per slice
    slice_verts = []
    for h_ratio, w_front, w_side in profile:
        y = h_ratio * 1.75 * h_scale  # Total height ~1.75m scaled
        w_f = w_front * w_scale * 0.5  # half-width front
        w_s = w_side * w_scale * 0.5   # half-width side

        ring = []
        for i in range(n_angles):
            angle = 2 * math.pi * i / n_angles
            # Superellipse cross-section
            r = 1.0 / ((abs(math.cos(angle)) / w_f)**2 + (abs(math.sin(angle)) / w_s)**2)**0.5 if w_f > 0 and w_s > 0 else w_f
            x = r * math.cos(angle)
            z = r * math.sin(angle)
            ring.append((x, y, z))
        slice_verts.append(ring)

    # Flatten vertices
    for ring in slice_verts:
        vertices.extend(ring)

    # Build faces between adjacent slices
    for s in range(len(slice_verts) - 1):
        for i in range(n_angles):
            j = (i + 1) % n_angles
            a = s * n_angles + i
            b = s * n_angles + j
            c = (s + 1) * n_angles + i
            d = (s + 1) * n_angles + j
            faces.append([a, c, b])
            faces.append([b, c, d])

    # Close bottom
    bottom_center = len(vertices)
    vertices.append((0, 0, 0))
    for i in range(n_angles):
        j = (i + 1) % n_angles
        faces.append([i, bottom_center, j])

    return trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))


if __name__ == "__main__":
    import time

    body_types = ["hourglass", "pear", "apple", "rectangle", "inverted_triangle"]

    for bt in body_types:
        t0 = time.time()
        mesh = create_parametric_body(height_cm=168, weight_kg=58, body_type=bt)
        mesh = trimesh.smoothing.filter_laplacian(mesh, iterations=2)

        out = f"/home/jerry/avatar-output/body-{bt}.glb"
        mesh.export(out)
        print(f"✅ {bt:20s} | {len(mesh.vertices):5d} verts {len(mesh.faces):5d} faces | {time.time()-t0:.2f}s | {out}")

    print("\nDone! 5 body types exported.")
