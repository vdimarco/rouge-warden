"""A missing crew rig plays the casual walk, so the feet leave the idle stance.

This reads the source and samples MenCasual.glb. It does not run Unreal.
"""
import math
import unittest
from pathlib import Path

import numpy as np

from bake_officer_stand import SOURCE, _accessor, _load_glb, _to_game, _trs

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
GLB = SOURCE / "MenCasual.glb"


def _curves(document, blob, suffix):
    anim = next(item for item in document["animations"] if item["name"].endswith(suffix))
    curves = {}
    for channel in anim["channels"]:
        sampler = anim["samplers"][channel["sampler"]]
        times = _accessor(document, blob, sampler["input"]).reshape(-1)
        values = _accessor(document, blob, sampler["output"])
        curves.setdefault(channel["target"]["node"], {})[channel["target"]["path"]] = (times, values)
    duration = max(curve[0][-1] for paths in curves.values() for curve in paths.values())
    return curves, float(duration)


def _slerp(a, b, t):
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    dot = float(np.dot(a, b))
    if dot < 0:
        b = -b
        dot = -dot
    if dot > 0.9995:
        blended = a + t * (b - a)
        return blended / np.linalg.norm(blended)
    theta = math.acos(np.clip(dot, -1, 1))
    sine = math.sin(theta)
    return (math.sin((1 - t) * theta) * a + math.sin(t * theta) * b) / sine


def _sample(curve, time, path):
    times, values = curve
    if time <= times[0]:
        return values[0]
    if time >= times[-1]:
        return values[-1]
    index = int(np.searchsorted(times, time) - 1)
    span = times[index + 1] - times[index]
    blend = 0 if span < 1e-8 else (time - times[index]) / span
    if path == "rotation":
        return _slerp(values[index], values[index + 1], blend)
    return (1 - blend) * values[index] + blend * values[index + 1]


def _pose(document, blob, curves, time):
    locals_ = [[
        list(node.get("translation", [0.0, 0.0, 0.0])),
        list(node.get("rotation", [0.0, 0.0, 0.0, 1.0])),
        list(node.get("scale", [1.0, 1.0, 1.0])),
    ] for node in document["nodes"]]
    for node, paths in curves.items():
        for path, curve in paths.items():
            slot = {"translation": 0, "rotation": 1, "scale": 2}[path]
            locals_[node][slot] = _sample(curve, time, path).tolist()
    world = [None] * len(document["nodes"])
    children = {index: node.get("children", []) for index, node in enumerate(document["nodes"])}

    def walk(index, parent):
        world[index] = parent @ _trs(*locals_[index])
        for child in children[index]:
            walk(child, world[index])

    walk(0, np.eye(4))
    chunks = []
    for index, node in enumerate(document["nodes"]):
        if "mesh" not in node:
            continue
        skin = document["skins"][node["skin"]]
        inverse = _accessor(document, blob, skin["inverseBindMatrices"]).reshape(-1, 4, 4)
        joints = np.stack([world[joint] @ inverse[n].T for n, joint in enumerate(skin["joints"])])
        mesh_world = world[index]
        for prim in document["meshes"][node["mesh"]]["primitives"]:
            position = _accessor(document, blob, prim["attributes"]["POSITION"])
            joint_ids = _accessor(document, blob, prim["attributes"]["JOINTS_0"]).astype(np.int32)
            weights = _accessor(document, blob, prim["attributes"]["WEIGHTS_0"])
            skinned = np.zeros_like(position)
            ones = np.ones((len(position), 1))
            for channel in range(4):
                weight = weights[:, channel][:, None]
                chosen = joints[joint_ids[:, channel]]
                skinned += weight * np.einsum("vij,vj->vi", chosen, np.concatenate([position, ones], 1))[:, :3]
            chunks.append(_to_game((mesh_world @ np.concatenate([skinned, ones], 1).T).T[:, :3]))
    return np.concatenate(chunks)


def _feet(points):
    low = points[points[:, 2] < 6.0]
    left = low[low[:, 1] < 0]
    right = low[low[:, 1] >= 0]
    return float(left[:, 0].mean() - right[:, 0].mean())


class StrideTests(unittest.TestCase):
    def test_the_missing_rig_plays_the_casual_walk(self):
        casual = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenCasual/SK_MenCasual.SK_MenCasual")')
        walk = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenCasual/A_MenCasual_Walk.A_MenCasual_Walk")')
        idle = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenCasual/A_MenCasual_Idle.A_MenCasual_Idle")')
        stand = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenCasual/SM_MenCasualStand.SM_MenCasualStand")')
        self.assertLess(casual, stand)
        self.assertLess(walk, stand)
        self.assertLess(idle, stand)
        block = GAME[casual:stand]
        self.assertIn("CrewWalk = CasualWalk;", block)
        self.assertIn("CrewIdle = CasualIdle;", block)
        self.assertIn("GetMesh()->SetVisibility(true);", block)
        self.assertIn("CasualStand->SetVisibility(false);", block)
        self.assertIn("GetMesh()->SetRelativeRotation(FRotator(0., 0., 0.));", block)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("SwayPhase = static_cast<float>(QuebecSway::Advance(SwayPhase, DeltaSeconds, Speed));", GAME)

    def test_the_walk_clip_separates_the_feet(self):
        document, blob = _load_glb(GLB)
        idle_curves, _idle_length = _curves(document, blob, "Idle_Neutral")
        walk_curves, duration = _curves(document, blob, "|Walk")
        idle_span = abs(_feet(_pose(document, blob, idle_curves, 0.0)))
        widest = 0.0
        for step in range(12):
            span = abs(_feet(_pose(document, blob, walk_curves, duration * step / 12)))
            widest = max(widest, span)
        # Idle shoes sit together. The stride puts one foot ahead of the other by most of a pace.
        self.assertGreater(widest, idle_span + 40.0)
        self.assertGreater(duration, 1.0)
        self.assertLess(duration, 1.5)


if __name__ == "__main__":
    unittest.main()
