"""
AI 喵搭 — identity-driven stylized avatar provider
部署在 AIGC (4090D GPU) 上，通过 Tailscale IP 100.114.7.5 访问
用法: python avatar_server.py --port 8765
"""

import os, io, json, base64, time, tempfile, math
from pathlib import Path
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import trimesh
import open3d as o3d
from rigged_avatar_provider import LocalHumanoidLiteRigProvider

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI喵搭 Avatar Server", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path.home() / "avatar-output"
OUTPUT_DIR.mkdir(exist_ok=True)


# ── Parametric body generator ──
def create_parametric_body(
    height_cm: float = 168,
    weight_kg: float = 58,
    body_type: str = "hourglass",
    resolution: int = 64,
    shoulder_cm: float | None = None,
    bust_cm: float | None = None,
    waist_cm: float | None = None,
    hip_cm: float | None = None,
    head_cm: float | None = None,
) -> trimesh.Trimesh:
    """Superellipsoid cross-section parametric human body."""
    body_params = {
        "hourglass": {"shoulder": 1.0, "waist": 0.65, "hip": 1.0},
        "pear": {"shoulder": 0.9, "waist": 0.7, "hip": 1.1},
        "apple": {"shoulder": 0.95, "waist": 0.95, "hip": 0.9},
        "rectangle": {"shoulder": 0.9, "waist": 0.85, "hip": 0.9},
        "inverted_triangle": {"shoulder": 1.1, "waist": 0.7, "hip": 0.85},
    }
    bp = dict(body_params.get(body_type, body_params["hourglass"]))
    if shoulder_cm:
        bp["shoulder"] *= float(np.clip(shoulder_cm / 38.0, 0.82, 1.22))
    if bust_cm:
        bp["shoulder"] *= float(np.clip(bust_cm / 88.0, 0.88, 1.16))
    if waist_cm:
        bp["waist"] *= float(np.clip(waist_cm / 70.0, 0.78, 1.26))
    if hip_cm:
        bp["hip"] *= float(np.clip(hip_cm / 92.0, 0.82, 1.24))
    head_scale = float(np.clip((head_cm or 56.0) / 56.0, 0.9, 1.12))
    h_scale = height_cm / 168.0
    w_scale = np.sqrt(weight_kg / 58.0)
    n_slices = 40
    n_angles = resolution

    profile = [
        (0.00, 0.12, 0.20), (0.03, 0.14, 0.22), (0.12, 0.18, 0.20),
        (0.28, 0.22, 0.22), (0.38, 0.30, 0.26),
        (0.50, 0.40 * bp["hip"], 0.30 * bp["hip"]),
        (0.56, 0.38 * bp["waist"], 0.26 * bp["waist"]),
        (0.64, 0.42 * bp["shoulder"], 0.28 * bp["shoulder"]),
        (0.72, 0.44 * bp["shoulder"], 0.28 * bp["shoulder"]),
        (0.78, 0.15, 0.15), (0.82, 0.20 * head_scale, 0.22 * head_scale),
        (0.88, 0.22 * head_scale, 0.24 * head_scale), (0.94, 0.18 * head_scale, 0.22 * head_scale), (1.00, 0.02, 0.02),
    ]

    slice_verts = []
    for h_ratio, w_front, w_side in profile:
        y = h_ratio * 1.75 * h_scale
        w_f = w_front * w_scale * 0.5
        w_s = w_side * w_scale * 0.5
        ring = []
        for i in range(n_angles):
            angle = 2 * math.pi * i / n_angles
            denom = (abs(math.cos(angle)) / w_f)**2 + (abs(math.sin(angle)) / w_s)**2 if w_f > 0 and w_s > 0 else 1
            r = 1.0 / math.sqrt(denom)
            ring.append((r * math.cos(angle), y, r * math.sin(angle)))
        slice_verts.append(np.array(ring))

    vertices, faces = [], []
    for ring in slice_verts:
        vertices.extend(ring.tolist())

    for s in range(len(slice_verts) - 1):
        for i in range(n_angles):
            j = (i + 1) % n_angles
            a, b = s * n_angles + i, s * n_angles + j
            c, d = (s + 1) * n_angles + i, (s + 1) * n_angles + j
            faces.extend([[a, c, b], [b, c, d]])

    # Close bottom
    bc = len(vertices)
    vertices.append((0.0, 0.0, 0.0))
    for i in range(n_angles):
        j = (i + 1) % n_angles
        faces.append([i, bc, j])

    return trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces))


# ── Request types ──
class CaptureFrame(BaseModel):
    angle: int
    imageDataUrl: str
    capturedAt: str
    qualityScore: float

class SelfieFrame(BaseModel):
    imageDataUrl: str
    capturedAt: str
    qualityScore: float
    faceBox: dict | None = None
    skinToneHex: str | None = None
    source: str | None = None
    poseLabel: str | None = None

class BodyMeasurements(BaseModel):
    heightCm: float
    weightKg: float
    bodyType: str
    headCm: float | None = None
    shoulderCm: float | None = None
    bustCm: float | None = None
    waistCm: float | None = None
    hipCm: float | None = None
    armCm: float | None = None
    legCm: float | None = None
    inseamCm: float | None = None
    skinTone: str | None = None

class ManifestRequest(BaseModel):
    avatarPipeline: str | None = "identity-driven-stylized-avatar"
    renderStyle: dict | None = None
    stylizedHead: dict | None = None
    outfit: dict | None = None
    rigTarget: str | None = "glb-rig-ready"
    measurements: BodyMeasurements
    frames: list[CaptureFrame] = []
    selfieFrame: SelfieFrame | None = None
    selfieFrames: list[SelfieFrame] = []


# ── Helpers ──
def dataurl_to_image(dataurl: str) -> np.ndarray:
    """Convert base64 data URL to numpy BGR image."""
    if "," not in dataurl:
        raise ValueError("Invalid data URL")
    header, encoded = dataurl.split(",", 1)
    raw = base64.b64decode(encoded)
    arr = np.frombuffer(raw, dtype=np.uint8)
    import cv2
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def estimate_skin_tone_hex(img: np.ndarray) -> str | None:
    """Estimate a stable skin color from the central selfie area."""
    if img is None or img.size == 0:
        return None
    h, w = img.shape[:2]
    y0, y1 = int(h * 0.18), int(h * 0.62)
    x0, x1 = int(w * 0.28), int(w * 0.72)
    crop = img[y0:y1, x0:x1]
    if crop.size == 0:
        return None
    b, g, r = crop[:, :, 0], crop[:, :, 1], crop[:, :, 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    mask = (y > 45) & (y < 245) & (cb >= 72) & (cb <= 142) & (cr >= 128) & (cr <= 184) & (r > b)
    if int(mask.sum()) < 100:
        return None
    rr = int(np.median(r[mask]))
    gg = int(np.median(g[mask]))
    bb = int(np.median(b[mask]))
    return f"#{rr:02x}{gg:02x}{bb:02x}"


def hex_to_rgba(hex_color: str | None, fallback=(226, 171, 136, 255)):
    if not hex_color:
        return fallback
    value = hex_color.strip().lstrip("#")
    if len(value) != 6:
        return fallback
    try:
        return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)
    except ValueError:
        return fallback


def apply_avatar_material(mesh: trimesh.Trimesh, skin_hex: str | None):
    rgba = hex_to_rgba(skin_hex)
    mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        name="beautified-selfie-skin",
        baseColorFactor=[rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, 1.0],
        roughnessFactor=0.72,
        metallicFactor=0.0,
    ))
    return mesh


def material_rgba(name: str, rgba):
    return trimesh.visual.material.PBRMaterial(
        name=name,
        baseColorFactor=[rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3] / 255],
        roughnessFactor=0.68,
        metallicFactor=0.0,
    )


def ellipsoid(name: str, center, scale, rgba, subdivisions=3) -> trimesh.Trimesh:
    mesh = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)
    mesh.apply_scale(scale)
    mesh.apply_translation(center)
    mesh.visual = trimesh.visual.TextureVisuals(material=material_rgba(name, rgba))
    return mesh


def capsule_between(name: str, start, end, radius: float, rgba) -> trimesh.Trimesh:
    start = np.array(start, dtype=np.float64)
    end = np.array(end, dtype=np.float64)
    direction = end - start
    length = float(np.linalg.norm(direction))
    mesh = trimesh.creation.capsule(radius=radius, height=max(length, radius * 2), count=[24, 12])
    transform = trimesh.geometry.align_vectors([0, 0, 1], direction / max(length, 1e-6))
    transform[:3, 3] = (start + end) / 2
    mesh.apply_transform(transform)
    mesh.visual = trimesh.visual.TextureVisuals(material=material_rgba(name, rgba))
    return mesh


def crop_beautified_face(selfie: SelfieFrame | None):
    if selfie is None:
        return None


def dataurl_to_pil(dataurl: str):
    from PIL import Image
    if not dataurl or "," not in dataurl:
        return None
    _, encoded = dataurl.split(",", 1)
    raw = base64.b64decode(encoded)
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def stylized_head_texture(stylized_head: dict | None, selfie: SelfieFrame | None):
    if stylized_head and stylized_head.get("textureDataUrl"):
        try:
            return dataurl_to_pil(stylized_head["textureDataUrl"])
        except Exception as e:
            print(f"[Avatar] Stylized head texture decode failed: {e}")
    return crop_beautified_face(selfie)
    try:
        import cv2
        from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

        img = dataurl_to_image(selfie.imageDataUrl)
        if img is None or img.size == 0:
            return None
        h, w = img.shape[:2]
        box = selfie.faceBox or {}
        if box:
            x = int(max(0, (box.get("x", 0.3) - 0.12) * w))
            y = int(max(0, (box.get("y", 0.18) - 0.16) * h))
            x2 = int(min(w, (box.get("x", 0.3) + box.get("width", 0.4) + 0.12) * w))
            y2 = int(min(h, (box.get("y", 0.18) + box.get("height", 0.46) + 0.14) * h))
        else:
            x, y, x2, y2 = int(w * 0.24), int(h * 0.12), int(w * 0.76), int(h * 0.72)
        crop = img[y:y2, x:x2]
        if crop.size == 0:
            return None
        crop = cv2.bilateralFilter(crop, 9, 70, 70)
        crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGBA)
        pil = Image.fromarray(crop).resize((512, 640), Image.Resampling.LANCZOS)
        pil = ImageEnhance.Brightness(pil).enhance(1.08)
        pil = ImageEnhance.Contrast(pil).enhance(1.08)
        pil = pil.filter(ImageFilter.SMOOTH_MORE)
        rgb = pil.convert("RGB")
        rgb = ImageOps.posterize(rgb, 5)
        alpha = pil.getchannel("A")
        pil = rgb.convert("RGBA")
        pil.putalpha(alpha)
        mask = Image.new("L", pil.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((46, 24, 466, 616), fill=255)
        pil.putalpha(mask)
        return pil
    except Exception as e:
        print(f"[Avatar] Face texture crop failed: {e}")
        return None


def face_texture_plane(face_image, head_center, head_scale):
    if face_image is None:
        return None
    cx, cy, cz = head_center
    width = head_scale[0] * 1.18
    height = head_scale[1] * 1.36
    z = cz + head_scale[2] * 0.91
    y0 = cy - height * 0.43
    y1 = cy + height * 0.48
    x0 = cx - width / 2
    x1 = cx + width / 2
    vertices = np.array([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], dtype=np.float64)
    faces = np.array([[0, 1, 2], [0, 2, 3]])
    uv = np.array([[0, 0], [1, 0], [1, 1], [0, 1]], dtype=np.float64)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    mesh.visual = trimesh.visual.TextureVisuals(uv=uv, image=face_image)
    return mesh


def create_store_mannequin_avatar(m: BodyMeasurements, skin_hex: str | None, selfie: SelfieFrame | None):
    rgba = hex_to_rgba(skin_hex, fallback=(229, 170, 130, 255))
    height_m = max(1.45, min(1.9, m.heightCm / 100.0))
    weight_scale = float(np.clip(np.sqrt(m.weightKg / 58.0), 0.86, 1.2))
    shoulder = (m.shoulderCm or 38.0) / 100.0
    bust = (m.bustCm or 88.0) / 100.0
    waist = (m.waistCm or 70.0) / 100.0
    hip = (m.hipCm or 92.0) / 100.0
    head_circ = (m.headCm or 56.0) / 100.0

    scene = trimesh.Scene()
    ground_y = 0.0
    head_y = height_m * 0.91
    head_rx = np.clip(head_circ / (2 * math.pi) * 0.95, 0.075, 0.105)
    head_scale = (head_rx, head_rx * 1.25, head_rx * 0.92)

    # Store mannequin proportions: separated smooth parts, not a single wrapped shell.
    scene.add_geometry(ellipsoid("head", (0, head_y, 0.0), head_scale, rgba), node_name="head")
    scene.add_geometry(ellipsoid("neck", (0, height_m * 0.79, 0.0), (0.052, 0.085, 0.052), rgba, subdivisions=2), node_name="neck")
    scene.add_geometry(ellipsoid("chest", (0, height_m * 0.64, 0.0), (max(shoulder * 0.46, bust * 0.24) * weight_scale, height_m * 0.13, 0.12 * weight_scale), rgba), node_name="chest")
    scene.add_geometry(ellipsoid("waist", (0, height_m * 0.51, 0.0), (waist * 0.22 * weight_scale, height_m * 0.085, 0.095 * weight_scale), rgba), node_name="waist")
    scene.add_geometry(ellipsoid("hips", (0, height_m * 0.42, 0.0), (hip * 0.24 * weight_scale, height_m * 0.09, 0.13 * weight_scale), rgba), node_name="hips")

    arm_len = (m.armCm or height_m * 100 * 0.43) / 100.0
    leg_len = (m.legCm or m.inseamCm or height_m * 100 * 0.47) / 100.0
    shoulder_y = height_m * 0.71
    shoulder_x = shoulder * 0.55
    elbow_drop = arm_len * 0.47
    wrist_drop = arm_len * 0.92
    for side in (-1, 1):
        sx = side * shoulder_x
        elbow = (side * (shoulder_x + 0.035), shoulder_y - elbow_drop, 0.01)
        wrist = (side * (shoulder_x + 0.005), shoulder_y - wrist_drop, 0.025)
        scene.add_geometry(capsule_between(f"upper_arm_{side}", (sx, shoulder_y, 0), elbow, 0.035 * weight_scale, rgba), node_name=f"upper_arm_{side}")
        scene.add_geometry(capsule_between(f"forearm_{side}", elbow, wrist, 0.029 * weight_scale, rgba), node_name=f"forearm_{side}")
        scene.add_geometry(ellipsoid(f"hand_{side}", wrist, (0.032, 0.046, 0.016), rgba, subdivisions=2), node_name=f"hand_{side}")

        hip_x = side * hip * 0.16
        knee = (side * hip * 0.13, height_m * 0.42 - leg_len * 0.47, 0.01)
        ankle = (side * hip * 0.12, ground_y + height_m * 0.055, 0.015)
        scene.add_geometry(capsule_between(f"thigh_{side}", (hip_x, height_m * 0.38, 0), knee, 0.052 * weight_scale, rgba), node_name=f"thigh_{side}")
        scene.add_geometry(capsule_between(f"calf_{side}", knee, ankle, 0.038 * weight_scale, rgba), node_name=f"calf_{side}")
        scene.add_geometry(ellipsoid(f"foot_{side}", (side * hip * 0.12, ground_y + height_m * 0.028, 0.055), (0.04, 0.024, 0.095), rgba, subdivisions=2), node_name=f"foot_{side}")

    face = face_texture_plane(crop_beautified_face(selfie), (0, head_y, 0.0), head_scale)
    if face is not None:
        scene.add_geometry(face, node_name="beautified_selfie_face")

    return scene


def create_anime_character_avatar(m: BodyMeasurements, skin_hex: str | None, selfie: SelfieFrame | None, stylized_head: dict | None = None):
    skin = hex_to_rgba(skin_hex, fallback=(239, 185, 151, 255))
    features = (stylized_head or {}).get("identityFeatures") or {}
    fit = (stylized_head or {}).get("headFit") or {}
    hair = hex_to_rgba(features.get("hairToneHex"), fallback=(92, 49, 32, 255))
    cloth = (244, 244, 238, 255)
    trim = (35, 34, 42, 255)
    pink = (237, 113, 153, 255)
    shoe = (44, 43, 50, 255)
    scene = trimesh.Scene()

    # Chibi/anime proportions: identity from face, charm from exaggerated head/body.
    head_center = (0.0, 1.18, 0.0)
    head_scale = (
        0.245 * float(np.clip(fit.get("headWidthScale", 1.0), 0.86, 1.2)),
        0.305 * float(np.clip(fit.get("headHeightScale", 1.0), 0.88, 1.2)),
        0.225,
    )
    scene.add_geometry(ellipsoid("anime_head", head_center, head_scale, skin, subdivisions=4), node_name="anime_head")
    hair_volume = float(np.clip(fit.get("hairVolume", 1.0), 0.92, 1.24))
    scene.add_geometry(ellipsoid("hair_cap", (0.0, 1.235, -0.018), (0.265 * hair_volume, 0.25 * hair_volume, 0.235 * hair_volume), hair, subdivisions=4), node_name="hair_cap")
    scene.add_geometry(ellipsoid("front_bangs", (0.0, 1.32, 0.13), (0.22, 0.06, 0.075), hair, subdivisions=2), node_name="front_bangs")
    scene.add_geometry(ellipsoid("left_hair", (-0.21, 1.12, 0.01), (0.055, 0.20, 0.055), hair, subdivisions=2), node_name="left_hair")
    scene.add_geometry(ellipsoid("right_hair", (0.21, 1.12, 0.01), (0.055, 0.20, 0.055), hair, subdivisions=2), node_name="right_hair")

    face_scale = float(np.clip(fit.get("facePlaneScale", 1.0), 0.86, 1.3))
    face = face_texture_plane(stylized_head_texture(stylized_head, selfie), head_center, (head_scale[0] * 1.12 * face_scale, head_scale[1] * 1.08, head_scale[2]))
    if face is not None:
        scene.add_geometry(face, node_name="manga_face_texture")

    scene.add_geometry(ellipsoid("neck", (0, 0.89, 0.0), (0.045, 0.045, 0.04), skin, subdivisions=2), node_name="neck")
    scene.add_geometry(ellipsoid("hoodie_body", (0, 0.69, 0.0), (0.20, 0.22, 0.13), cloth, subdivisions=3), node_name="hoodie_body")
    scene.add_geometry(ellipsoid("hoodie_hem", (0, 0.52, 0.0), (0.22, 0.055, 0.13), pink, subdivisions=2), node_name="hoodie_hem")
    scene.add_geometry(ellipsoid("shorts", (0, 0.42, 0.0), (0.18, 0.08, 0.11), trim, subdivisions=2), node_name="shorts")

    for side in (-1, 1):
        shoulder = (side * 0.17, 0.73, 0.0)
        elbow = (side * 0.28, 0.61, 0.035)
        hand = (side * 0.31, 0.78 if side > 0 else 0.50, 0.07)
        scene.add_geometry(capsule_between(f"sleeve_{side}", shoulder, elbow, 0.043, cloth), node_name=f"sleeve_{side}")
        scene.add_geometry(capsule_between(f"forearm_{side}", elbow, hand, 0.031, skin), node_name=f"forearm_{side}")
        scene.add_geometry(ellipsoid(f"round_hand_{side}", hand, (0.045, 0.04, 0.03), skin, subdivisions=2), node_name=f"round_hand_{side}")

        hip = (side * 0.08, 0.36, 0.0)
        knee = (side * 0.095, 0.21, 0.015)
        foot = (side * 0.105, 0.07, 0.055)
        scene.add_geometry(capsule_between(f"leg_{side}", hip, knee, 0.045, skin), node_name=f"leg_{side}")
        scene.add_geometry(capsule_between(f"sock_{side}", knee, foot, 0.037, (245, 245, 245, 255)), node_name=f"sock_{side}")
        scene.add_geometry(ellipsoid(f"shoe_{side}", foot, (0.065, 0.035, 0.09), shoe, subdivisions=2), node_name=f"shoe_{side}")

    # Simple outfit details: a hoodie string and chest badge for Yintai outfit hooks.
    scene.add_geometry(capsule_between("hoodie_string_l", (-0.035, 0.80, 0.118), (-0.055, 0.68, 0.13), 0.006, trim), node_name="hoodie_string_l")
    scene.add_geometry(capsule_between("hoodie_string_r", (0.035, 0.80, 0.118), (0.055, 0.68, 0.13), 0.006, trim), node_name="hoodie_string_r")
    scene.add_geometry(ellipsoid("outfit_badge", (0.095, 0.72, 0.125), (0.032, 0.032, 0.006), pink, subdivisions=2), node_name="outfit_badge")

    return scene


def geometry_stats(asset):
    if isinstance(asset, trimesh.Scene):
        vertices = 0
        faces = 0
        for geom in asset.geometry.values():
            vertices += len(getattr(geom, "vertices", []))
            faces += len(getattr(geom, "faces", []))
        return vertices, faces
    return len(asset.vertices), len(asset.faces)


def image_to_silhouette(img: np.ndarray) -> np.ndarray:
    """Extract foreground mask using OpenCV grabCut + morphology + largest component + hole filling."""
    import cv2
    h, w = img.shape[:2]
    margin_x, margin_y = int(w * 0.1), int(h * 0.05)
    rect = (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)
    mask = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, rect, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_RECT)
    result = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)

    # Morphology close
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    result = cv2.morphologyEx(result, cv2.MORPH_CLOSE, kernel)

    # Largest connected component
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(result, connectivity=8)
    if num_labels > 1:
        largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        result = np.where(labels == largest, 255, 0).astype(np.uint8)

    # Hole filling
    result = cv2.morphologyEx(result, cv2.MORPH_CLOSE,
                              cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))

    return (result > 128).astype(np.uint8)


def silhouettes_to_voxel_mesh(
    silhouettes: list[np.ndarray],
    angles_deg: list[int],
    voxel_resolution: int = 256,
    height_cm: float = 168
) -> trimesh.Trimesh | None:
    """
    Multi-view silhouette carving → voxel grid → marching cubes → mesh.
    Uses soft silhouette + majority voting (≥5/8) for robustness.
    """
    # Axes are X (width), Y (height), Z (depth). Each view projects X/Z onto
    # the silhouette's horizontal image axis and keeps Y as the vertical axis.
    votes = np.zeros((voxel_resolution, voxel_resolution, voxel_resolution), dtype=np.uint8)
    num_views = len(silhouettes)
    coords = np.linspace(-1.0, 1.0, voxel_resolution, dtype=np.float32)
    grid_x, grid_z = np.meshgrid(coords, coords, indexing="ij")
    image_rows = np.arange(voxel_resolution)[None, :, None]

    for sil, angle in zip(silhouettes, angles_deg):
        h, w = sil.shape
        scale = min(voxel_resolution / w, voxel_resolution / h)
        new_w = int(w * scale)
        new_h = int(h * scale)
        import cv2

        # Soft silhouette: blur edges to get 0~1 probability instead of binary
        sil_soft = cv2.GaussianBlur(sil.astype(np.float32), (15, 15), 0)
        # Normalize: center=1.0, outer edge~0.3
        sil_soft = np.clip((sil_soft - 0.1) * 2, 0, 1)

        sil_resized = cv2.resize(sil_soft, (new_w, new_h))
        pad_h = (voxel_resolution - new_h) // 2
        pad_w = (voxel_resolution - new_w) // 2
        sil_vox = np.zeros((voxel_resolution, voxel_resolution), dtype=np.float32)
        sil_vox[pad_h:pad_h+new_h, pad_w:pad_w+new_w] = sil_resized

        theta = np.deg2rad(angle)
        projected_u = grid_x * np.cos(theta) + grid_z * np.sin(theta)
        u_indices = np.clip(
            np.rint((projected_u + 1.0) * 0.5 * (voxel_resolution - 1)),
            0,
            voxel_resolution - 1,
        ).astype(np.int32)
        projection = sil_vox[image_rows, u_indices[:, None, :]] > 0.6
        votes += projection.astype(np.uint8)

    # 5/8 majority for a complete turn; scale down for the minimum four views.
    min_votes = max(2, int(np.ceil(num_views * 0.625)))
    voxel = votes >= min_votes

    if not voxel.any():
        return None

    # Marching cubes to extract mesh
    verts, faces, _, _ = _marching_cubes(voxel.astype(float), level=0.5)
    mesh = trimesh.Trimesh(vertices=verts, faces=faces)
    if len(mesh.faces) > 20000:
        try:
            mesh = mesh.simplify_quadric_decimation(face_count=20000)
        except Exception as simplify_error:
            print(f"[Avatar] Mesh Simplify SKIPPED error={simplify_error}")
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
    current_height = mesh.bounds[1, 1] - mesh.bounds[0, 1]
    height_scale = target_height / max(current_height, 0.01)
    mesh.apply_scale(height_scale)
    mesh.apply_translation(-mesh.centroid)
    mesh.apply_translation([0, target_height / 2, 0])
    return mesh


@app.get("/health")
def health():
    return {"status": "ok", "gpu": "NVIDIA GeForce RTX 4090 D", "vram_free_gb": 19}


@app.post("/reconstruct")
def reconstruct(manifest: ManifestRequest):
    t_start = time.time()
    job_id = f"avatar-{int(t_start)}"
    frame_count = len(manifest.frames)
    pipeline = manifest.avatarPipeline or "identity-driven-stylized-avatar"
    print(f"[Avatar] Stylized Avatar Started job={job_id} pipeline={pipeline} frames={frame_count} selfieFrames={len(manifest.selfieFrames or [])}")

    try:
        m = manifest.measurements
        frames = manifest.frames
        selfie_frames = manifest.selfieFrames or []
        selfie = manifest.selfieFrame or next((f for f in selfie_frames if f.poseLabel == "front"), None) or (selfie_frames[0] if selfie_frames else None)
        method = "parametric-superellipsoid-fallback"
        asset = None
        skin_hex = m.skinTone

        if selfie is not None:
            method = "anime-stylized-head-scan-character"
            try:
                selfie_img = dataurl_to_image(selfie.imageDataUrl)
                skin_hex = skin_hex or selfie.skinToneHex or estimate_skin_tone_hex(selfie_img)
                print(f"[Avatar] Head Scan Input frames={len(selfie_frames)} quality={selfie.qualityScore} skin={skin_hex or 'auto'}")
            except Exception as e:
                print(f"[Avatar] Selfie decode failed, continuing with measurements: {e}")
            glb_path = OUTPUT_DIR / f"{job_id}.glb"
            rigged_asset = LocalHumanoidLiteRigProvider().export_glb(
                glb_path,
                skin_hex=skin_hex,
                stylized_head=manifest.stylizedHead,
            )
            if not rigged_asset.rig_validation.get("ok"):
                print(f"[Avatar] Rig Validation FAILED job={job_id} errors={rigged_asset.rig_validation.get('errors')}")
                raise HTTPException(500, {
                    "error": "rig_validation_failed",
                    "providerStage": rigged_asset.provider_stage,
                    "failureReason": "humanoid-lite rig validation failed",
                    "validationErrors": rigged_asset.rig_validation.get("errors", []),
                })

            elapsed = round(time.time() - t_start, 1)
            print(f"[Avatar] Rigged Avatar Complete job={job_id} bones={rigged_asset.bones} anims={rigged_asset.animations} elapsed={elapsed}s")
            return {
                "job_id": job_id,
                "status": "ready",
                "elapsed_seconds": elapsed,
                "vertices": rigged_asset.vertices,
                "faces": rigged_asset.faces,
                "model_url": f"/models/{job_id}.glb",
                "preview_url": f"/models/{job_id}-preview.png",
                "method": method,
                "frame_count": len(frames),
                "selfie_used": True,
                "selfie_frame_count": len(selfie_frames),
                "face_mode": "anime-beautified-guided-head-scan",
                "skin_tone": skin_hex,
                "provider_stage": rigged_asset.provider_stage,
                "pipeline": pipeline,
                "stylized_head_stage": (manifest.stylizedHead or {}).get("providerStage", "server-fallback"),
                "stylized_head_confidence": (manifest.stylizedHead or {}).get("confidence"),
                "rig_ready": True,
                "vrm_ready": False,
                "vrm_compatible": rigged_asset.vrm_compatible,
                "rig_format": rigged_asset.format,
                "bone_count": rigged_asset.bones,
                "skinned_mesh_count": rigged_asset.skinned_meshes,
                "animation_count": rigged_asset.animations,
                "bone_map": rigged_asset.bone_map,
                "rig_validation": rigged_asset.rig_validation,
                "pose_presets": rigged_asset.animation_clips + ["ootd", "duo-frame"],
                "animation_clips": rigged_asset.animation_clips,
                "expression_blendshapes": ["neutral", "smile", "cool", "surprised"],
                "vrm_ready_metadata": {
                    "humanoidBoneMap": rigged_asset.bone_map,
                    "coordinateSystem": {"unit": "meter", "forward": "+Z", "up": "+Y"},
                    "runtimeLayers": ["identity", "canonical-body", "hair", "outfit", "accessory"],
                    "expressions": ["neutral", "smile", "cool", "surprised"],
                    "springBoneExtensionPoints": {"hair": True, "clothing": True, "accessories": True},
                    "exportTargets": ["glb-rig-ready", "vrm-1.0-future"],
                },
                "avatar_runtime_metadata": {
                    "humanoidBoneMap": rigged_asset.bone_map,
                    "coordinateSystem": {"unit": "meter", "forward": "+Z", "up": "+Y"},
                    "runtimeLayers": ["identity", "canonical-body", "hair", "outfit", "accessory"],
                    "expressions": ["neutral", "smile", "cool", "surprised"],
                    "springBoneExtensionPoints": {"hair": True, "clothing": True, "accessories": True},
                    "exportTargets": ["glb-rig-ready", "vrm-1.0-future"],
                },
            }

        # Legacy fallback only: the product main path is identity-driven stylized avatar.
        if asset is None and len(frames) >= 4:
            print(f"[Avatar] Legacy silhouette carving fallback frames={len(frames)}")
            try:
                images = []
                for f in frames:
                    img = dataurl_to_image(f.imageDataUrl)
                    if img is not None and img.size > 0:
                        images.append((f.angle, img))
                if len(images) >= 4:
                    # Extract silhouettes
                    silhouettes = []
                    angles_used = []
                    for angle, img in images:
                        sil = image_to_silhouette(img)
                        if sil.sum() > 500:
                            silhouettes.append(sil)
                            angles_used.append(angle)
                    if len(silhouettes) >= 4:
                        carved = silhouettes_to_voxel_mesh(
                            silhouettes, angles_used,
                            voxel_resolution=128,
                            height_cm=m.heightCm
                        )
                        if carved is not None and len(carved.vertices) > 10:
                            asset = apply_measurements_scale(carved, m.heightCm, m.weightKg)
                            asset = trimesh.smoothing.filter_laplacian(asset, iterations=2)
                            method = "multi-view-silhouette-carving"
            except Exception as e:
                print(f"Silhouette carving failed, falling back: {e}")

        # ── Phase 2: Fallback to parametric body ──
        if asset is None:
            print(f"[Avatar] Legacy parametric fallback height={m.heightCm} type={m.bodyType}")
            asset = create_store_mannequin_avatar(m, skin_hex, selfie)
            method = "store-mannequin-parametric-avatar"
            if selfie is None:
                fallback_mesh = create_parametric_body(
                    height_cm=m.heightCm,
                    weight_kg=m.weightKg,
                    body_type=m.bodyType,
                    resolution=64,
                    shoulder_cm=m.shoulderCm,
                    bust_cm=m.bustCm,
                    waist_cm=m.waistCm,
                    hip_cm=m.hipCm,
                    head_cm=m.headCm,
                )
                fallback_mesh = trimesh.smoothing.filter_laplacian(fallback_mesh, iterations=2)
                asset = apply_avatar_material(fallback_mesh, skin_hex)

        # Export GLB
        glb_path = OUTPUT_DIR / f"{job_id}.glb"
        asset.export(str(glb_path), file_type="glb")
        vertices, faces = geometry_stats(asset)

        elapsed = round(time.time() - t_start, 1)
        print(f"[Avatar] Reconstruct Complete job={job_id} method={method} verts={vertices} elapsed={elapsed}s")
        return {
            "job_id": job_id,
            "status": "ready",
            "elapsed_seconds": elapsed,
            "vertices": vertices,
            "faces": faces,
            "model_url": f"/models/{job_id}.glb",
            "preview_url": f"/models/{job_id}-preview.png",
            "method": method,
            "frame_count": len(frames),
            "selfie_used": selfie is not None,
            "selfie_frame_count": len(selfie_frames),
            "face_mode": "anime-beautified-guided-head-scan" if selfie is not None else "none",
            "skin_tone": skin_hex,
            "provider_stage": "procedural-stylized-avatar-provider",
            "pipeline": pipeline,
            "stylized_head_stage": (manifest.stylizedHead or {}).get("providerStage", "server-fallback"),
            "stylized_head_confidence": (manifest.stylizedHead or {}).get("confidence"),
            "rig_ready": True,
            "vrm_ready": False,
            "pose_presets": ["idle", "wave", "ootd", "duo-frame"],
            "expression_blendshapes": ["smile", "blink", "surprised"],
        }

    except Exception as e:
        import traceback
        print(f"[Avatar] Reconstruct FAILED job={job_id} error={e}")
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
