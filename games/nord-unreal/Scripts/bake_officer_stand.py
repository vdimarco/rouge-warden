"""Bake the clothed idle from the CC0 civilian GLB. No Blender and no blend space.

The officer fallback is a cylinder until this mesh is imported. The bake is the
authored Idle_Neutral frame, feet on the origin, face toward +X, units centimetres.
"""
import json
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Data/Art/Plateau/Civilians/Source"
OUT = ROOT / "Data/Art/Plateau/Civilians/Prepared"


def _load_glb(path):
    data = Path(path).read_bytes()
    offset = 12
    document = None
    blob = b""
    while offset < len(data):
        length, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunk = data[offset:offset + length]
        offset += length
        if kind == b"JSON":
            document = json.loads(chunk)
        elif kind == b"BIN\x00":
            blob = chunk
    return document, blob


def _accessor(document, blob, index):
    accessor = document["accessors"][index]
    view = document["bufferViews"][accessor["bufferView"]]
    code, width = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}[accessor["componentType"]]
    components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[accessor["type"]]
    stride = view.get("byteStride", width * components)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    count = accessor["count"]
    out = np.empty((count, components), np.float64)
    for row in range(count):
        base = start + row * stride
        out[row] = [struct.unpack_from("<" + code, blob, base + channel * width)[0] for channel in range(components)]
    return out


def _quat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
        [0, 0, 0, 1],
    ], np.float64)


def _trs(translation, rotation, scale):
    frame = np.eye(4)
    frame[:3, 3] = translation
    sized = np.diag([scale[0], scale[1], scale[2], 1.0])
    return frame @ _quat(rotation) @ sized


def _to_game(points):
    """glTF centimetres after skinning are Z-up along -Z. Face points +Y; turn it to +X."""
    return np.stack([points[:, 1], -points[:, 0], -points[:, 2]], 1)


def stand_mesh(path, clip_suffix="Idle_Neutral"):
    """Return (positions, normals, triangles, material names, colors) in centimetres."""
    document, blob = _load_glb(path)
    locals_ = [[
        node.get("translation", [0, 0, 0]),
        node.get("rotation", [0, 0, 0, 1]),
        node.get("scale", [1, 1, 1]),
    ] for node in document["nodes"]]
    anim = next(item for item in document["animations"] if item["name"].endswith(clip_suffix))
    for channel in anim["channels"]:
        values = _accessor(document, blob, anim["samplers"][channel["sampler"]]["output"])
        slot = {"translation": 0, "rotation": 1, "scale": 2}[channel["target"]["path"]]
        locals_[channel["target"]["node"]][slot] = values[0].tolist()
    world = [None] * len(document["nodes"])
    children = {index: node.get("children", []) for index, node in enumerate(document["nodes"])}

    def walk(index, parent):
        world[index] = parent @ _trs(*locals_[index])
        for child in children[index]:
            walk(child, world[index])

    walk(0, np.eye(4))
    parts = []
    for index, node in enumerate(document["nodes"]):
        if "mesh" not in node:
            continue
        skin = document["skins"][node["skin"]]
        inverse = _accessor(document, blob, skin["inverseBindMatrices"]).reshape(-1, 4, 4)
        joints = np.stack([world[joint] @ inverse[n].T for n, joint in enumerate(skin["joints"])])
        mesh_world = world[index]
        for prim in document["meshes"][node["mesh"]]["primitives"]:
            position = _accessor(document, blob, prim["attributes"]["POSITION"])
            indices = _accessor(document, blob, prim["indices"]).astype(np.int32).reshape(-1, 3)
            joint_ids = _accessor(document, blob, prim["attributes"]["JOINTS_0"]).astype(np.int32)
            weights = _accessor(document, blob, prim["attributes"]["WEIGHTS_0"])
            normals = _accessor(document, blob, prim["attributes"]["NORMAL"])
            skinned = np.zeros_like(position)
            skinned_n = np.zeros_like(normals)
            ones = np.ones((len(position), 1))
            zeros = np.zeros((len(position), 1))
            for channel in range(4):
                weight = weights[:, channel][:, None]
                chosen = joints[joint_ids[:, channel]]
                skinned += weight * np.einsum("vij,vj->vi", chosen, np.concatenate([position, ones], 1))[:, :3]
                skinned_n += weight * np.einsum("vij,vj->vi", chosen, np.concatenate([normals, zeros], 1))[:, :3]
            posed = (mesh_world @ np.concatenate([skinned, ones], 1).T).T[:, :3]
            material = document["materials"][prim["material"]]
            color = material.get("pbrMetallicRoughness", {}).get("baseColorFactor", [0.8, 0.8, 0.8, 1])[:3]
            parts.append((_to_game(posed), _to_game(skinned_n), indices, material.get("name", "Stand"), np.array(color, np.float64)))
    positions = np.concatenate([part[0] for part in parts])
    shift = np.array([-(positions[:, 0].min() + positions[:, 0].max()) / 2,
                      -(positions[:, 1].min() + positions[:, 1].max()) / 2,
                      -positions[:, 2].min()])
    shifted = []
    for position, normal, indices, name, color in parts:
        shifted.append((position + shift, normal, indices, name, color))
    return shifted


def height_cm(parts):
    positions = np.concatenate([part[0] for part in parts])
    return float(positions[:, 2].max() - positions[:, 2].min())


def write_obj(parts, path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ["# clothed idle, centimetres, feet at the origin, face toward +X"]
    vertex = 1
    for position, normal, indices, name, color in parts:
        lines.append(f"usemtl {name}")
        lines.append(f"# color {color[0]:.4f} {color[1]:.4f} {color[2]:.4f}")
        for point, direction in zip(position, normal):
            lines.append(f"v {point[0]:.4f} {point[1]:.4f} {point[2]:.4f}")
            lines.append(f"vn {direction[0]:.4f} {direction[1]:.4f} {direction[2]:.4f}")
        for tri in indices:
            a, b, c = tri + vertex
            lines.append(f"f {a}//{a} {b}//{b} {c}//{c}")
        vertex += len(position)
    path.write_text("\n".join(lines) + "\n")


def main():
    for name in ("MenSuit", "MenHoodie", "MenCasual"):
        parts = stand_mesh(SOURCE / f"{name}.glb")
        destination = OUT / f"SM_{name}Stand.obj"
        write_obj(parts, destination)
        print(name, "height_cm", round(height_cm(parts), 2), "triangles", sum(len(part[2]) for part in parts), destination.name)


if __name__ == "__main__":
    main()
