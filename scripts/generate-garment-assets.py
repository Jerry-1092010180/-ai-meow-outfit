#!/usr/bin/env python3
"""Generate lightweight independent GLB garment assets for the avatar demo."""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "garments"


def align4(buf: bytearray):
    while len(buf) % 4:
        buf.append(0)


def pack_array(values, fmt):
    return b"".join(struct.pack(fmt, *value) if isinstance(value, (list, tuple)) else struct.pack(fmt, value) for value in values)


def tube(rings, segments=32):
    positions, normals, uvs, indices = [], [], [], []
    for ri, ring in enumerate(rings):
        y = ring["y"]
        rx = ring["rx"]
        rz = ring["rz"]
        cx = ring.get("cx", 0)
        cz = ring.get("cz", 0)
        for si in range(segments):
            u = si / segments
            angle = math.tau * u
            x = math.cos(angle)
            z = math.sin(angle)
            positions.append([cx + x * rx, y, cz + z * rz])
            normals.append([x, 0, z])
            uvs.append([u, ri / max(1, len(rings) - 1)])
    for ri in range(len(rings) - 1):
        for si in range(segments):
            a = ri * segments + si
            b = ri * segments + ((si + 1) % segments)
            c = (ri + 1) * segments + si
            d = (ri + 1) * segments + ((si + 1) % segments)
            indices.extend([a, c, b, b, c, d])
    return positions, normals, uvs, indices


def panel(points):
    positions = points
    normals = [[0, 0, 1] for _ in points]
    uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]
    indices = [0, 1, 2, 0, 2, 3]
    return positions, normals, uvs, indices


def rgba(hex_color):
    value = hex_color.lstrip("#")
    return [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1]


class Writer:
    def __init__(self):
        self.buf = bytearray()
        self.views = []
        self.accessors = []
        self.materials = []
        self.meshes = []
        self.nodes = []

    def blob(self, data, target=None):
        align4(self.buf)
        offset = len(self.buf)
        self.buf.extend(data)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": len(data)}
        if target:
            view["target"] = target
        self.views.append(view)
        return len(self.views) - 1

    def accessor(self, data, component_type, accessor_type, target=None):
        view = self.blob(data, target)
        if accessor_type == "VEC3":
            rows = [struct.unpack("<fff", data[i:i + 12]) for i in range(0, len(data), 12)]
            minv = [min(row[j] for row in rows) for j in range(3)]
            maxv = [max(row[j] for row in rows) for j in range(3)]
        else:
            minv = maxv = None
        component_size = {5126: 4, 5123: 2}[component_type]
        type_count = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[accessor_type]
        acc = {
            "bufferView": view,
            "componentType": component_type,
            "count": len(data) // (component_size * type_count),
            "type": accessor_type,
        }
        if minv:
            acc["min"] = minv
            acc["max"] = maxv
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def material(self, name, color):
        self.materials.append({
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": rgba(color),
                "metallicFactor": 0,
                "roughnessFactor": 0.78,
            },
        })
        return len(self.materials) - 1

    def add_primitive(self, name, positions, normals, uvs, indices, material):
        pos = pack_array(positions, "<fff")
        nor = pack_array(normals, "<fff")
        tex = pack_array(uvs, "<ff")
        ind = pack_array(indices, "<H")
        prim = {
            "attributes": {
                "POSITION": self.accessor(pos, 5126, "VEC3", 34962),
                "NORMAL": self.accessor(nor, 5126, "VEC3", 34962),
                "TEXCOORD_0": self.accessor(tex, 5126, "VEC2", 34962),
            },
            "indices": self.accessor(ind, 5123, "SCALAR", 34963),
            "material": material,
        }
        self.meshes.append({"name": name, "primitives": [prim]})
        self.nodes.append({"name": name, "mesh": len(self.meshes) - 1})

    def write(self, path):
        gltf = {
            "asset": {"version": "2.0", "generator": "AI Meow RealGarmentProviderAssetGen"},
            "scene": 0,
            "scenes": [{"nodes": list(range(len(self.nodes)))}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "buffers": [{"byteLength": len(self.buf)}],
            "bufferViews": self.views,
            "accessors": self.accessors,
            "extras": {
                "assetType": "independent-garment",
                "skeletonCompatibility": "humanoid-lite-v0.1",
                "requiresRuntimeRebind": True,
            },
        }
        json_bytes = json.dumps(gltf, separators=(",", ":")).encode()
        while len(json_bytes) % 4:
            json_bytes += b" "
        bin_bytes = bytes(self.buf)
        while len(bin_bytes) % 4:
            bin_bytes += b"\0"
        total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)
        path.write_bytes(
            b"glTF" + struct.pack("<II", 2, total)
            + struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
            + struct.pack("<I4s", len(bin_bytes), b"BIN\0") + bin_bytes
        )


def blouse(path):
    w = Writer()
    ivory = w.material("silk-blouse-ivory", "#f4f1e8")
    ribbon = w.material("silk-blouse-ribbon", "#90b8d8")
    w.add_primitive("silk_blouse_body", *tube([
        {"y": 0.50, "rx": 0.238, "rz": 0.152},
        {"y": 0.63, "rx": 0.214, "rz": 0.15},
        {"y": 0.78, "rx": 0.232, "rz": 0.144},
        {"y": 0.88, "rx": 0.15, "rz": 0.112},
    ], 36), ivory)
    for side, label in [(-1, "left"), (1, "right")]:
        w.add_primitive(f"silk_blouse_{label}_sleeve", *tube([
            {"y": 0.76, "rx": 0.055, "rz": 0.058, "cx": side * 0.23, "cz": 0.016},
            {"y": 0.65, "rx": 0.046, "rz": 0.052, "cx": side * 0.29, "cz": 0.045},
            {"y": 0.55, "rx": 0.037, "rz": 0.043, "cx": side * 0.316, "cz": 0.073},
        ], 20), ivory)
    w.add_primitive("silk_blouse_bow_left", *panel([[-0.01, 0.86, 0.17], [-0.105, 0.78, 0.18], [-0.055, 0.72, 0.18], [0.015, 0.81, 0.17]]), ribbon)
    w.add_primitive("silk_blouse_bow_right", *panel([[0.01, 0.86, 0.17], [0.105, 0.78, 0.18], [0.055, 0.72, 0.18], [-0.015, 0.81, 0.17]]), ribbon)
    w.write(path)


def trench(path):
    w = Writer()
    khaki = w.material("trench-khaki-shell", "#b79a72")
    belt = w.material("trench-dark-belt", "#4b3b2d")
    w.add_primitive("trench_long_body", *tube([
        {"y": 0.33, "rx": 0.272, "rz": 0.17},
        {"y": 0.50, "rx": 0.252, "rz": 0.166},
        {"y": 0.70, "rx": 0.266, "rz": 0.162},
        {"y": 0.89, "rx": 0.16, "rz": 0.116},
    ], 36), khaki)
    for side, label in [(-1, "left"), (1, "right")]:
        w.add_primitive(f"trench_{label}_sleeve", *tube([
            {"y": 0.76, "rx": 0.064, "rz": 0.064, "cx": side * 0.235, "cz": 0.018},
            {"y": 0.63, "rx": 0.056, "rz": 0.057, "cx": side * 0.295, "cz": 0.048},
            {"y": 0.50, "rx": 0.046, "rz": 0.05, "cx": side * 0.322, "cz": 0.078},
        ], 20), khaki)
    w.add_primitive("trench_belt", *tube([{"y": 0.535, "rx": 0.255, "rz": 0.166}, {"y": 0.57, "rx": 0.248, "rz": 0.162}], 36), belt)
    w.write(path)


def dress(path):
    w = Writer()
    gold = w.material("satin-slip-champagne", "#d7b46d")
    shade = w.material("satin-slip-shadow", "#8f6f42")
    w.add_primitive("satin_dress_bodice", *tube([
        {"y": 0.54, "rx": 0.19, "rz": 0.13},
        {"y": 0.70, "rx": 0.207, "rz": 0.138},
        {"y": 0.86, "rx": 0.126, "rz": 0.104},
    ], 34), gold)
    w.add_primitive("satin_dress_skirt", *tube([
        {"y": 0.54, "rx": 0.19, "rz": 0.13},
        {"y": 0.41, "rx": 0.235, "rz": 0.145},
        {"y": 0.27, "rx": 0.292, "rz": 0.162},
        {"y": 0.15, "rx": 0.335, "rz": 0.18},
    ], 40), gold)
    w.add_primitive("satin_dress_side_shadow", *panel([[0.08, 0.52, 0.18], [0.23, 0.42, 0.18], [0.29, 0.15, 0.18], [0.12, 0.22, 0.18]]), shade)
    w.write(path)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    blouse(OUT / "theory-silk-blouse.glb")
    trench(OUT / "burberry-trench-coat.glb")
    dress(OUT / "sandro-satin-slip-dress.glb")


if __name__ == "__main__":
    main()
