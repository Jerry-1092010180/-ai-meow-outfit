"""Humanoid-lite rigged GLB provider for stylized avatars.

This module intentionally owns rigging/export. The main avatar provider should
call it, not mix skeleton/skinning logic into avatar_server.py.
"""

from __future__ import annotations

import base64
import io
import json
import math
import struct
from dataclasses import dataclass
from typing import Any

import numpy as np


BONE_NAMES = [
    "Root",
    "Hips",
    "Spine",
    "Chest",
    "Neck",
    "Head",
    "LeftShoulder",
    "LeftUpperArm",
    "LeftLowerArm",
    "LeftHand",
    "RightShoulder",
    "RightUpperArm",
    "RightLowerArm",
    "RightHand",
    "LeftUpperLeg",
    "LeftLowerLeg",
    "LeftFoot",
    "RightUpperLeg",
    "RightLowerLeg",
    "RightFoot",
]

HUMANOID_BONE_MAP = {name: name for name in BONE_NAMES}


@dataclass
class RiggedAvatarAsset:
    vertices: int
    faces: int
    bones: int
    skinned_meshes: int
    animations: int
    bone_map: dict[str, str]
    animation_clips: list[str]
    rig_validation: dict[str, Any]
    provider_stage: str = "local-humanoid-lite-rig-provider"
    format: str = "glb-rig-ready"
    vrm_compatible: bool = True


def _rgba(hex_color: str | None, fallback=(229, 170, 130, 255)):
    if not hex_color:
        return fallback
    value = str(hex_color).strip().lstrip("#")
    if len(value) != 6:
        return fallback
    try:
        return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)
    except ValueError:
        return fallback


def _dataurl_to_png_bytes(dataurl: str | None) -> bytes | None:
    if not dataurl or "," not in dataurl:
        return None
    _, encoded = dataurl.split(",", 1)
    raw = base64.b64decode(encoded)
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(raw)).convert("RGBA")
        out = io.BytesIO()
        img.save(out, format="PNG")
        return out.getvalue()
    except Exception:
        return raw


def _quat_from_euler(rx=0.0, ry=0.0, rz=0.0):
    cx, sx = math.cos(rx / 2), math.sin(rx / 2)
    cy, sy = math.cos(ry / 2), math.sin(ry / 2)
    cz, sz = math.cos(rz / 2), math.sin(rz / 2)
    return [
        sx * cy * cz - cx * sy * sz,
        cx * sy * cz + sx * cy * sz,
        cx * cy * sz - sx * sy * cz,
        cx * cy * cz + sx * sy * sz,
    ]


def _mat4_translation_inverse(t):
    m = np.eye(4, dtype=np.float32)
    m[0, 3] = -t[0]
    m[1, 3] = -t[1]
    m[2, 3] = -t[2]
    return m.T.reshape(-1).tolist()


class MeshBuilder:
    def __init__(self):
        self.primitives: list[dict[str, Any]] = []

    def add_ellipsoid(self, name, center, scale, material, bone, rings=16, segments=24):
        positions = []
        normals = []
        uvs = []
        indices = []
        cx, cy, cz = center
        sx, sy, sz = scale
        for r in range(rings + 1):
            v = r / rings
            theta = math.pi * v
            for s in range(segments):
                u = s / segments
                phi = math.tau * u
                x = math.sin(theta) * math.cos(phi)
                y = math.cos(theta)
                z = math.sin(theta) * math.sin(phi)
                positions.append([cx + x * sx, cy + y * sy, cz + z * sz])
                n = np.array([x / max(sx, 1e-5), y / max(sy, 1e-5), z / max(sz, 1e-5)], dtype=np.float32)
                n = n / max(np.linalg.norm(n), 1e-5)
                normals.append(n.tolist())
                uvs.append([u, 1 - v])
        for r in range(rings):
            for s in range(segments):
                a = r * segments + s
                b = r * segments + ((s + 1) % segments)
                c = (r + 1) * segments + s
                d = (r + 1) * segments + ((s + 1) % segments)
                indices.extend([a, c, b, b, c, d])
        self._add_primitive(name, positions, normals, uvs, indices, material, [(bone, 1.0)])

    def add_capsule(self, name, start, end, radius, material, bone, segments=20):
        start = np.array(start, dtype=np.float32)
        end = np.array(end, dtype=np.float32)
        axis = end - start
        length = float(np.linalg.norm(axis))
        axis = axis / max(length, 1e-5)
        up = np.array([0, 1, 0], dtype=np.float32)
        if abs(float(np.dot(axis, up))) > 0.9:
            up = np.array([1, 0, 0], dtype=np.float32)
        side = np.cross(axis, up)
        side = side / max(np.linalg.norm(side), 1e-5)
        up2 = np.cross(side, axis)
        positions = []
        normals = []
        uvs = []
        rings = [start, end]
        for ri, center in enumerate(rings):
            for s in range(segments):
                u = s / segments
                angle = math.tau * u
                n = math.cos(angle) * side + math.sin(angle) * up2
                positions.append((center + n * radius).tolist())
                normals.append(n.tolist())
                uvs.append([u, ri])
        indices = []
        for s in range(segments):
            a = s
            b = (s + 1) % segments
            c = segments + s
            d = segments + ((s + 1) % segments)
            indices.extend([a, c, b, b, c, d])
        self._add_primitive(name, positions, normals, uvs, indices, material, [(bone, 1.0)])

    def add_face_plane(self, center, scale, material):
        cx, cy, cz = center
        sx, sy, sz = scale
        z = cz + sz * 0.93
        positions = [
            [cx - sx * 0.58, cy - sy * 0.42, z],
            [cx + sx * 0.58, cy - sy * 0.42, z],
            [cx + sx * 0.58, cy + sy * 0.48, z],
            [cx - sx * 0.58, cy + sy * 0.48, z],
        ]
        normals = [[0, 0, 1]] * 4
        uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
        self._add_primitive("face_texture", positions, normals, uvs, [0, 1, 2, 0, 2, 3], material, [("Head", 1.0)])

    def _add_primitive(self, name, positions, normals, uvs, indices, material, influences):
        joints = [BONE_NAMES.index(influences[0][0]), 0, 0, 0]
        weights = [float(influences[0][1]), 0.0, 0.0, 0.0]
        self.primitives.append(
            {
                "name": name,
                "positions": np.array(positions, dtype=np.float32),
                "normals": np.array(normals, dtype=np.float32),
                "uvs": np.array(uvs, dtype=np.float32),
                "indices": np.array(indices, dtype=np.uint16),
                "joints": np.tile(np.array(joints, dtype=np.uint16), (len(positions), 1)),
                "weights": np.tile(np.array(weights, dtype=np.float32), (len(positions), 1)),
                "material": material,
            }
        )


class GLBWriter:
    def __init__(self):
        self.buffer = bytearray()
        self.buffer_views = []
        self.accessors = []
        self.images = []
        self.textures = []
        self.materials = []

    def _align(self):
        while len(self.buffer) % 4:
            self.buffer.append(0)

    def add_blob(self, data: bytes, target: int | None = None):
        self._align()
        offset = len(self.buffer)
        self.buffer.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            view["target"] = target
        self.buffer_views.append(view)
        return len(self.buffer_views) - 1

    def add_accessor(self, array, component_type, accessor_type, target=None):
        data = array.tobytes()
        view = self.add_blob(data, target)
        accessor = {
            "bufferView": view,
            "componentType": component_type,
            "count": int(len(array)),
            "type": accessor_type,
        }
        if accessor_type in ("VEC2", "VEC3", "VEC4", "SCALAR") and component_type == 5126:
            accessor["min"] = np.min(array, axis=0).tolist() if array.ndim > 1 else [float(np.min(array))]
            accessor["max"] = np.max(array, axis=0).tolist() if array.ndim > 1 else [float(np.max(array))]
        self.accessors.append(accessor)
        return len(self.accessors) - 1

    def add_image_texture(self, png_bytes: bytes):
        view = self.add_blob(png_bytes)
        self.images.append({"bufferView": view, "mimeType": "image/png"})
        self.textures.append({"source": len(self.images) - 1})
        return len(self.textures) - 1

    def add_material(self, name, rgba, texture_index=None):
        mat = {
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": [rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3] / 255],
                "metallicFactor": 0,
                "roughnessFactor": 0.82,
            },
        }
        if texture_index is not None:
            mat["pbrMetallicRoughness"]["baseColorTexture"] = {"index": texture_index}
            mat["alphaMode"] = "BLEND"
        self.materials.append(mat)
        return len(self.materials) - 1

    def build_glb(self, gltf: dict[str, Any]):
        gltf["buffers"] = [{"byteLength": len(self.buffer)}]
        gltf["bufferViews"] = self.buffer_views
        gltf["accessors"] = self.accessors
        if self.images:
            gltf["images"] = self.images
            gltf["textures"] = self.textures
        gltf["materials"] = self.materials
        json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        while len(json_bytes) % 4:
            json_bytes += b" "
        bin_bytes = bytes(self.buffer)
        while len(bin_bytes) % 4:
            bin_bytes += b"\x00"
        total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
        return b"glTF" + struct.pack("<II", 2, total) + struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes + struct.pack("<I4s", len(bin_bytes), b"BIN\x00") + bin_bytes


class LocalHumanoidLiteRigProvider:
    def export_glb(self, output_path, skin_hex: str | None, stylized_head: dict | None = None) -> RiggedAvatarAsset:
        writer = GLBWriter()
        skin = _rgba(skin_hex, (239, 185, 151, 255))
        features = (stylized_head or {}).get("identityFeatures") or {}
        fit = (stylized_head or {}).get("headFit") or {}
        hair = _rgba(features.get("hairToneHex"), (92, 49, 32, 255))
        cloth = (244, 244, 238, 255)
        accent = (237, 113, 153, 255)
        dark = (35, 34, 42, 255)
        shoe = (44, 43, 50, 255)

        texture = _dataurl_to_png_bytes((stylized_head or {}).get("textureDataUrl"))
        skin_mat = writer.add_material("skin_toon", skin)
        hair_mat = writer.add_material("hair_toon", hair)
        cloth_mat = writer.add_material("outfit_primary", cloth)
        accent_mat = writer.add_material("outfit_accent", accent)
        dark_mat = writer.add_material("outfit_dark", dark)
        shoe_mat = writer.add_material("shoe_dark", shoe)
        face_mat = writer.add_material("stylized_face_texture", (255, 255, 255, 255), writer.add_image_texture(texture)) if texture else skin_mat

        b = MeshBuilder()
        head_scale = (
            0.245 * float(np.clip(fit.get("headWidthScale", 1.0), 0.86, 1.2)),
            0.305 * float(np.clip(fit.get("headHeightScale", 1.0), 0.88, 1.2)),
            0.225,
        )
        head_center = (0.0, 1.18, 0.0)
        b.add_ellipsoid("head", head_center, head_scale, skin_mat, "Head", rings=18, segments=28)
        b.add_ellipsoid("hair_cap", (0, 1.235, -0.018), (0.28, 0.26, 0.24), hair_mat, "Head", rings=14, segments=24)
        b.add_ellipsoid("left_hair", (-0.21, 1.12, 0.01), (0.055, 0.20, 0.055), hair_mat, "Head", rings=10, segments=16)
        b.add_ellipsoid("right_hair", (0.21, 1.12, 0.01), (0.055, 0.20, 0.055), hair_mat, "Head", rings=10, segments=16)
        b.add_face_plane(head_center, (head_scale[0] * float(np.clip(fit.get("facePlaneScale", 1.0), 0.86, 1.3)), head_scale[1], head_scale[2]), face_mat)

        b.add_ellipsoid("neck", (0, 0.92, 0), (0.045, 0.05, 0.04), skin_mat, "Neck", rings=8, segments=16)
        b.add_ellipsoid("chest", (0, 0.70, 0), (0.20, 0.22, 0.13), cloth_mat, "Chest", rings=14, segments=22)
        b.add_ellipsoid("hips", (0, 0.44, 0), (0.17, 0.11, 0.11), dark_mat, "Hips", rings=12, segments=20)
        b.add_ellipsoid("hem", (0, 0.54, 0), (0.22, 0.055, 0.13), accent_mat, "Spine", rings=8, segments=18)

        for side, label in [(-1, "Left"), (1, "Right")]:
            sx = side * 0.17
            b.add_capsule(f"{label}UpperArm", (sx, 0.75, 0), (side * 0.28, 0.62, 0.035), 0.043, cloth_mat, f"{label}UpperArm")
            b.add_capsule(f"{label}LowerArm", (side * 0.28, 0.62, 0.035), (side * 0.31, 0.78 if side > 0 else 0.50, 0.07), 0.031, skin_mat, f"{label}LowerArm")
            b.add_ellipsoid(f"{label}Hand", (side * 0.31, 0.78 if side > 0 else 0.50, 0.07), (0.045, 0.04, 0.03), skin_mat, f"{label}Hand", rings=8, segments=14)
            b.add_capsule(f"{label}UpperLeg", (side * 0.08, 0.38, 0), (side * 0.095, 0.22, 0.015), 0.045, skin_mat, f"{label}UpperLeg")
            b.add_capsule(f"{label}LowerLeg", (side * 0.095, 0.22, 0.015), (side * 0.105, 0.08, 0.055), 0.037, cloth_mat, f"{label}LowerLeg")
            b.add_ellipsoid(f"{label}Foot", (side * 0.105, 0.06, 0.07), (0.065, 0.035, 0.09), shoe_mat, f"{label}Foot", rings=8, segments=14)

        local_transforms = self._bone_local_transforms()
        global_transforms = self._global_transforms(local_transforms)
        nodes = self._nodes(local_transforms)

        mesh_primitives = []
        vertices = 0
        faces = 0
        validation_errors = []
        for primitive in b.primitives:
            vertices += len(primitive["positions"])
            faces += len(primitive["indices"]) // 3
            weight_sums = primitive["weights"].sum(axis=1)
            if not np.allclose(weight_sums, 1.0, atol=1e-4):
                validation_errors.append(f"weights_not_normalized:{primitive['name']}")
            mesh_primitives.append(
                {
                    "attributes": {
                        "POSITION": writer.add_accessor(primitive["positions"], 5126, "VEC3", 34962),
                        "NORMAL": writer.add_accessor(primitive["normals"], 5126, "VEC3", 34962),
                        "TEXCOORD_0": writer.add_accessor(primitive["uvs"], 5126, "VEC2", 34962),
                        "JOINTS_0": writer.add_accessor(primitive["joints"], 5123, "VEC4", 34962),
                        "WEIGHTS_0": writer.add_accessor(primitive["weights"], 5126, "VEC4", 34962),
                    },
                    "indices": writer.add_accessor(primitive["indices"], 5123, "SCALAR", 34963),
                    "material": primitive["material"],
                }
            )

        inverse_bind = np.array([_mat4_translation_inverse(global_transforms[name]) for name in BONE_NAMES], dtype=np.float32)
        ibm_accessor = writer.add_accessor(inverse_bind.reshape((len(BONE_NAMES), 16)), 5126, "MAT4")
        mesh_node_index = len(nodes)
        nodes.append({"name": "AvatarSkinnedMesh", "mesh": 0, "skin": 0})
        root_children = nodes[0].setdefault("children", [])
        root_children.append(mesh_node_index)

        animations = self._animations(writer)
        gltf = {
            "asset": {"version": "2.0", "generator": "AI Meow LocalHumanoidLiteRigProvider"},
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": nodes,
            "meshes": [{"name": "StylizedAvatarSkinnedMesh", "primitives": mesh_primitives}],
            "skins": [{"name": "HumanoidLiteSkin", "skeleton": BONE_NAMES.index("Hips"), "joints": list(range(len(BONE_NAMES))), "inverseBindMatrices": ibm_accessor}],
            "animations": animations,
            "extras": {
                "humanoidBoneMap": HUMANOID_BONE_MAP,
                "vrmCompatibility": {
                    "unit": "meter",
                    "forward": "+Z",
                    "up": "+Y",
                    "expressionBlendshapes": ["neutral", "smile", "cool", "surprised"],
                    "springBoneReady": False,
                },
            },
        }
        validation = validate_rigged_avatar(gltf, b.primitives, validation_errors)
        if not validation["ok"]:
            return RiggedAvatarAsset(vertices, faces, len(BONE_NAMES), 0, 0, HUMANOID_BONE_MAP, [], validation)

        with open(output_path, "wb") as f:
            f.write(writer.build_glb(gltf))
        return RiggedAvatarAsset(vertices, faces, len(BONE_NAMES), 1, len(animations), HUMANOID_BONE_MAP, ["idle", "confident-pose"], validation)

    def _bone_local_transforms(self):
        return {
            "Root": (0, 0, 0),
            "Hips": (0, 0.43, 0),
            "Spine": (0, 0.15, 0),
            "Chest": (0, 0.18, 0),
            "Neck": (0, 0.18, 0),
            "Head": (0, 0.14, 0),
            "LeftShoulder": (-0.14, 0.0, 0),
            "LeftUpperArm": (-0.06, -0.03, 0),
            "LeftLowerArm": (-0.10, -0.13, 0.035),
            "LeftHand": (-0.03, -0.12, 0.035),
            "RightShoulder": (0.14, 0.0, 0),
            "RightUpperArm": (0.06, -0.03, 0),
            "RightLowerArm": (0.10, -0.13, 0.035),
            "RightHand": (0.03, -0.12, 0.035),
            "LeftUpperLeg": (-0.08, -0.05, 0),
            "LeftLowerLeg": (-0.015, -0.16, 0.015),
            "LeftFoot": (-0.01, -0.14, 0.04),
            "RightUpperLeg": (0.08, -0.05, 0),
            "RightLowerLeg": (0.015, -0.16, 0.015),
            "RightFoot": (0.01, -0.14, 0.04),
        }

    def _nodes(self, local):
        children = {
            "Root": ["Hips"],
            "Hips": ["Spine", "LeftUpperLeg", "RightUpperLeg"],
            "Spine": ["Chest"],
            "Chest": ["Neck", "LeftShoulder", "RightShoulder"],
            "Neck": ["Head"],
            "LeftShoulder": ["LeftUpperArm"],
            "LeftUpperArm": ["LeftLowerArm"],
            "LeftLowerArm": ["LeftHand"],
            "RightShoulder": ["RightUpperArm"],
            "RightUpperArm": ["RightLowerArm"],
            "RightLowerArm": ["RightHand"],
            "LeftUpperLeg": ["LeftLowerLeg"],
            "LeftLowerLeg": ["LeftFoot"],
            "RightUpperLeg": ["RightLowerLeg"],
            "RightLowerLeg": ["RightFoot"],
        }
        nodes = []
        for name in BONE_NAMES:
            node = {"name": name, "translation": list(local[name])}
            child_indices = [BONE_NAMES.index(child) for child in children.get(name, [])]
            if child_indices:
                node["children"] = child_indices
            nodes.append(node)
        return nodes

    def _global_transforms(self, local):
        parent = {}
        for node in self._nodes(local):
            for child_index in node.get("children", []):
                parent[BONE_NAMES[child_index]] = node["name"]
        out = {}
        for name in BONE_NAMES:
            p = np.array(local[name], dtype=np.float32)
            cur = name
            while cur in parent:
                cur = parent[cur]
                p += np.array(local[cur], dtype=np.float32)
            out[name] = p
        return out

    def _animations(self, writer: GLBWriter):
        times = np.array([0, 1, 2], dtype=np.float32)
        time_accessor = writer.add_accessor(times, 5126, "SCALAR")

        def sampler_for(rotations):
            accessor = writer.add_accessor(np.array(rotations, dtype=np.float32), 5126, "VEC4")
            return {"input": time_accessor, "output": accessor, "interpolation": "LINEAR"}

        idle_samplers = [
            sampler_for([_quat_from_euler(), _quat_from_euler(0.04, 0.02, 0), _quat_from_euler()]),
            sampler_for([_quat_from_euler(), _quat_from_euler(0, 0, -0.06), _quat_from_euler()]),
            sampler_for([_quat_from_euler(), _quat_from_euler(0, 0, 0.06), _quat_from_euler()]),
        ]
        idle_channels = [
            {"sampler": 0, "target": {"node": BONE_NAMES.index("Head"), "path": "rotation"}},
            {"sampler": 1, "target": {"node": BONE_NAMES.index("LeftUpperArm"), "path": "rotation"}},
            {"sampler": 2, "target": {"node": BONE_NAMES.index("RightUpperArm"), "path": "rotation"}},
        ]

        confident_samplers = [
            sampler_for([_quat_from_euler(), _quat_from_euler(0, 0.16, 0), _quat_from_euler(0, 0.16, 0)]),
            sampler_for([_quat_from_euler(), _quat_from_euler(-0.2, 0, -0.95), _quat_from_euler(-0.2, 0, -0.95)]),
            sampler_for([_quat_from_euler(), _quat_from_euler(0.4, 0.1, 0.18), _quat_from_euler(0.4, 0.1, 0.18)]),
            sampler_for([_quat_from_euler(), _quat_from_euler(0.06, -0.2, 0.05), _quat_from_euler(0.06, -0.2, 0.05)]),
        ]
        confident_channels = [
            {"sampler": 0, "target": {"node": BONE_NAMES.index("Chest"), "path": "rotation"}},
            {"sampler": 1, "target": {"node": BONE_NAMES.index("LeftUpperArm"), "path": "rotation"}},
            {"sampler": 2, "target": {"node": BONE_NAMES.index("RightUpperArm"), "path": "rotation"}},
            {"sampler": 3, "target": {"node": BONE_NAMES.index("Head"), "path": "rotation"}},
        ]
        return [
            {"name": "idle", "samplers": idle_samplers, "channels": idle_channels},
            {"name": "confident-pose", "samplers": confident_samplers, "channels": confident_channels},
        ]


def validate_rigged_avatar(gltf: dict[str, Any], primitives: list[dict[str, Any]], existing_errors=None):
    errors = list(existing_errors or [])
    names = [node["name"] for node in gltf["nodes"]]
    for name in BONE_NAMES:
        if name not in names:
            errors.append(f"missing_bone:{name}")
    skin = gltf["skins"][0]
    if len(skin["joints"]) != len(BONE_NAMES):
        errors.append("joint_count_mismatch")
    if "inverseBindMatrices" not in skin:
        errors.append("missing_inverse_bind_matrices")
    mesh_node = next((node for node in gltf["nodes"] if node.get("mesh") == 0), None)
    if not mesh_node or mesh_node.get("skin") != 0:
        errors.append("mesh_node_missing_skin")
    for primitive in primitives:
        if len(primitive["joints"]) != len(primitive["positions"]):
            errors.append(f"missing_joint_weights:{primitive['name']}")
        sums = primitive["weights"].sum(axis=1)
        if not np.allclose(sums, 1.0, atol=1e-4):
            errors.append(f"weight_sum_invalid:{primitive['name']}")
    for animation in gltf.get("animations", []):
        for channel in animation["channels"]:
            node_index = channel["target"]["node"]
            if node_index >= len(gltf["nodes"]):
                errors.append(f"animation_target_missing:{animation['name']}")
    return {
        "ok": len(errors) == 0,
        "errors": errors,
        "bones": len(BONE_NAMES),
        "skinnedMeshes": 1 if len(errors) == 0 else 0,
        "animations": len(gltf.get("animations", [])),
    }
