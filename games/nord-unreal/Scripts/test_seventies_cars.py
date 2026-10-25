"""Check visible car scale, profile differences and OBJ integrity before UE import.

Run with Python alone. The car actor keeps its existing collision and wheel
centres, so these visual assets must stay near that established envelope.
Quebec has required only a rear licence plate since 1979, so each body carries
one plate, at the rear.
"""

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Data/SeventiesCars"
GEOMETRY = SOURCE / "Geometry"
EXPECTED = {
    *(f"Car70{part}{index}.obj" for index in range(3) for part in ("Body", "Cabin", "Roof")),
    "Car70Tire.obj",
    "Car70Rim.obj",
}
SLOTS = {"Paint", "Chrome", "Ink", "Rubber", "Glass", "Lens", "Red", "Amber", "Cream", "Vinyl"}
# The plate space on a body end, in centimetres: past the fascia (|x| > 219), on the car's axis
# (|y| < 16), from z -58 to -44 around the bumper bar's lower half. A plate is a Cream face, Ink
# characters and a Chrome frame. The bumper bar reaches down to z -49.3, so only Chrome below
# z -50.5 counts as a frame.
PLATE_X, PLATE_Y, PLATE_Z = 219, 16, (-58, -44)
FRAME_Z = -50.5


def bounded(value, name):
    value = float(value)
    assert math.isfinite(value) and 0 <= value <= 1, (name, value)
    return value


def subtract(a, b):
    return tuple(a[i] - b[i] for i in range(3))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def length(a):
    return math.sqrt(sum(component * component for component in a))


def plate_part(material, centre):
    """The end ('front' at +X, 'rear' at -X) whose licence plate this triangle belongs to, or None."""
    x, y, z = centre
    if abs(x) <= PLATE_X or abs(y) >= PLATE_Y or not PLATE_Z[0] < z < PLATE_Z[1]:
        return None
    if material in ("Cream", "Ink") or (material == "Chrome" and z < FRAME_Z):
        return "front" if x > 0 else "rear"
    return None


def load_obj(path):
    vertices, uvs, normals = [], [], []
    groups = []
    counts = {}
    current = None
    body_top_up = body_top_down = 0
    roof_top_x = []
    glass_x = []
    plates = {"front": {}, "rear": {}}
    for line in path.read_text().splitlines():
        if line.startswith("v "):
            point = tuple(map(float, line.split()[1:]))
            assert len(point) == 3 and all(map(math.isfinite, point)), path
            vertices.append(point)
        elif line.startswith("vt "):
            uv = tuple(map(float, line.split()[1:]))
            assert len(uv) >= 2 and all(map(math.isfinite, uv)), path
            uvs.append(uv)
        elif line.startswith("vn "):
            normal = tuple(map(float, line.split()[1:]))
            assert len(normal) == 3 and all(map(math.isfinite, normal)), path
            assert abs(length(normal) - 1) < .005, (path, normal)
            normals.append(normal)
        elif line.startswith("usemtl "):
            current = line.split(maxsplit=1)[1]
            assert current in SLOTS and current not in groups, (path, current)
            groups.append(current)
            counts[current] = 0
        elif line.startswith("f "):
            assert current is not None, path
            tokens = line.split()[1:]
            assert len(tokens) == 3, (path, tokens)
            indices = [token.split("/") for token in tokens]
            assert all(len(index) == 3 for index in indices), path
            vi, ti, ni = zip(*((int(a), int(b), int(c)) for a, b, c in indices))
            assert all(1 <= index <= len(vertices) for index in vi), path
            assert all(1 <= index <= len(uvs) for index in ti), path
            assert all(1 <= index <= len(normals) for index in ni), path
            a, b, c = (vertices[index - 1] for index in vi)
            normal = cross(subtract(b, a), subtract(c, a))
            area_twice = length(normal)
            assert area_twice > .001, (path, "degenerate triangle", vi)
            counts[current] += 1
            if path.stem.startswith("Car70Body"):
                end = plate_part(current, tuple((a[i] + b[i] + c[i]) / 3 for i in range(3)))
                if end:
                    plates[end][current] = plates[end].get(current, 0) + 1
            if path.stem.startswith("Car70Body") and current == "Paint":
                z = (a[2] + b[2] + c[2]) / 3
                if z > 2 and all(-190 < point[0] < 190 for point in (a, b, c)):
                    if normal[2] / area_twice > .7:
                        body_top_up += 1
                    elif normal[2] / area_twice < -.7:
                        body_top_down += 1
            if path.stem.startswith("Car70Roof") and current == "Paint":
                if normal[2] / area_twice > .9 and (a[2] + b[2] + c[2]) / 3 > 45:
                    roof_top_x.extend((a[0], b[0], c[0]))
            if path.stem.startswith("Car70Cabin") and current == "Glass":
                glass_x.extend((a[0], b[0], c[0]))
    assert vertices and len(vertices) == len(uvs) == len(normals), path
    assert all(counts.values()), path
    assert len(vertices) <= 100_000, (path, len(vertices))
    bounds = [(min(point[i] for point in vertices), max(point[i] for point in vertices)) for i in range(3)]
    return {
        "bounds": bounds,
        "triangles": sum(counts.values()),
        "materials": groups,
        "counts": counts,
        "body_top_up": body_top_up,
        "body_top_down": body_top_down,
        "roof_top_length": max(roof_top_x) - min(roof_top_x) if roof_top_x else 0,
        "glass_rear_x": min(glass_x) if glass_x else None,
        "maximum_radius": max(math.hypot(x, y) for x, y, _ in vertices),
        "plates": plates,
    }


def check_envelope(name, info):
    x, y, z = info["bounds"]
    if "Body" in name:
        assert -234 <= x[0] < -220 and 220 < x[1] <= 234, (name, x)
        assert -115 <= y[0] and y[1] <= 115, (name, y)
        assert -68 <= z[0] < -55 and z[1] <= 35, (name, z)
        assert 100 <= info["body_top_up"] and info["body_top_down"] <= 5, (name, info)
        assert 500 < info["triangles"] < 10_000, name
        assert info["materials"][0] == "Paint", name
        assert {"Chrome", "Ink", "Lens", "Red", "Amber"} <= set(info["materials"]), name
        # Rear plate only: Quebec has required no front plate since 1979.
        assert not info["plates"]["front"], (name, "front licence plate", info["plates"]["front"])
        rear = info["plates"]["rear"]
        assert rear.get("Cream", 0) >= 12 and rear.get("Ink", 0) >= 12 and rear.get("Chrome", 0) >= 2, (name, rear)
    elif "Cabin" in name:
        assert -210 <= x[0] < -140 and 75 < x[1] <= 90, (name, x)
        assert -90 <= y[0] and y[1] <= 90, (name, y)
        assert 9 <= z[0] and z[1] <= 70, (name, z)
        assert 8 <= info["counts"]["Glass"] and info["materials"][0] == "Glass", name
        assert 100 < info["triangles"] < 1000, name
    elif "Roof" in name:
        assert -215 <= x[0] < -100 and 75 < x[1] <= 90, (name, x)
        assert -90 <= y[0] and y[1] <= 90, (name, y)
        assert 5 <= z[0] and z[1] <= 80, (name, z)
        assert info["materials"][0] == "Paint" and "Chrome" in info["materials"], name
        assert 80 < info["roof_top_length"] < 230, (name, info["roof_top_length"])
        assert 100 < info["triangles"] < 1000, name
    elif "Tire" in name:
        assert -37 <= x[0] < -35 and 35 < x[1] <= 37, (name, x)
        assert -37 <= y[0] < -35 and 35 < y[1] <= 37, (name, y)
        assert -15 <= z[0] < -11 and 11 < z[1] <= 15, (name, z)
        assert 35 <= info["maximum_radius"] <= 37 and info["materials"][0] == "Rubber", name
        assert {"Cream", "Ink"} <= set(info["materials"]), name
        assert 500 < info["triangles"] < 2500, name
    else:
        assert "Rim" in name
        assert -24 <= x[0] < -22 and 22 < x[1] <= 24, (name, x)
        assert -24 <= y[0] < -22 and 22 < y[1] <= 24, (name, y)
        assert -5 <= z[0] and z[1] <= 5, (name, z)
        assert info["materials"][0] == "Chrome" and "Ink" in info["materials"], name
        assert 300 < info["triangles"] < 1500, name


def main():
    manifest = json.loads((SOURCE / "manifest.json").read_text())
    rows = manifest["models"]
    assert isinstance(rows, list) and {row["file"] for row in rows} == EXPECTED
    assert len(rows) == len(EXPECTED) == 11
    assert len(manifest["profiles"]) == 3 and len(set(manifest["profiles"])) == 3
    materials = manifest["materials"]
    assert set(materials) == SLOTS
    for name, values in materials.items():
        assert len(values["color"]) == 3
        [bounded(value, name + ".color") for value in values["color"]]
        bounded(values["roughness"], name + ".roughness")
        bounded(values["metallic"], name + ".metallic")
    assert materials["Chrome"]["metallic"] >= .75 and materials["Chrome"]["roughness"] < .4
    assert materials["Rubber"]["roughness"] >= .8 and materials["Rubber"]["metallic"] <= .05
    assert materials["Glass"]["color"][2] > materials["Glass"]["color"][0]
    assert materials["Glass"]["roughness"] < .4
    paints = manifest["paints"]
    assert len(paints) == 4
    assert all(len(paint) == 3 and all(0 <= bounded(value, "paint") <= 1 for value in paint) for paint in paints)
    assert all(math.dist(a, b) > .08 for i, a in enumerate(paints) for b in paints[i + 1:])
    mtl_slots = {line.split(maxsplit=1)[1] for line in (GEOMETRY / "comic.mtl").read_text().splitlines() if line.startswith("newmtl ")}
    assert mtl_slots == SLOTS
    records = {}
    for row in rows:
        name = row["file"]
        assert Path(name).name == name and Path(name).suffix == ".obj"
        info = load_obj(GEOMETRY / name)
        assert info["triangles"] == row["triangles"]
        assert info["materials"] == row["materials"]
        check_envelope(name, info)
        records[name] = info
    roof_lengths = [records[f"Car70Roof{i}.obj"]["roof_top_length"] for i in range(3)]
    assert roof_lengths[0] + 20 < roof_lengths[1] and roof_lengths[1] + 40 < roof_lengths[2], roof_lengths
    glass_rears = [records[f"Car70Cabin{i}.obj"]["glass_rear_x"] for i in range(3)]
    assert all(abs(a - b) > 15 for i, a in enumerate(glass_rears) for b in glass_rears[i + 1:]), glass_rears
    assert sum(info["triangles"] for info in records.values()) < 35_000
    print("NORD_CAR70_SOURCE_OK 11 meshes, 3 distinct silhouettes, wheel axis/radius, bounded body, rear plate only, "
          "materials and normals")


if __name__ == "__main__":
    main()
