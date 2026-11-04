"""Maps on disk, missions, results, and the game page.

Layout under the plugin's data folder::

    maps/<map_id>/meta.json      title, place, centre, size, source, created
    maps/<map_id>/world.json     geometry from world.build_world
    maps/<map_id>/missions.json  missions the agent wrote
    maps/<map_id>/results.json   runs the game sent back
    maps/<map_id>/index.html     the self-contained page (works from file:// too)
"""

from __future__ import annotations

import difflib
import hashlib
import json
import math
import os
import re
import threading
import time
import unicodedata
from pathlib import Path
from typing import Any, Optional

from . import geo

PLUGIN_NAME = "hometown-arcade"
WEB = Path(__file__).resolve().parent / "web"
MAP_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
VEHICLES = {"car": 13.0, "bike": 7.0, "foot": 4.5}  # cruising m/s for par times
TIMES = ("day", "dusk", "night")
MAX_MISSIONS = 24
MAX_STOPS = 12
MAX_RESULTS = 500
_lock = threading.RLock()
DATA_ROOT_OVERRIDE: Optional[Path] = None  # tests point this at a scratch folder


class GameError(ValueError):
    """A request the agent can fix (unknown map, unknown place, bad value)."""


def data_dir() -> Path:
    if DATA_ROOT_OVERRIDE is not None:
        root = Path(DATA_ROOT_OVERRIDE)
        (root / "maps").mkdir(parents=True, exist_ok=True)
        return root
    try:
        from plugins.plugin_storage import plugin_data_dir  # Hermes's per-plugin storage helper
        root = plugin_data_dir(PLUGIN_NAME)
    except Exception:  # running outside Hermes (tests, a plain checkout)
        home = Path(os.environ.get("HERMES_HOME") or Path.home() / ".hermes")
        root = home / "plugin-data" / PLUGIN_NAME
        root.mkdir(parents=True, exist_ok=True)
    maps = root / "maps"
    maps.mkdir(parents=True, exist_ok=True)
    return root


def maps_dir() -> Path:
    return data_dir() / "maps"


def slug(text: str, limit: int = 40) -> str:
    t = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii").lower()
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return (t[:limit].rstrip("-") or "map")


def make_map_id(title: str, lat: float, lon: float, radius: float) -> str:
    h = hashlib.blake2b(f"{lat:.5f},{lon:.5f},{radius:.0f}".encode(), digest_size=3).hexdigest()
    return f"{slug(title)}-{h}"


def map_path(map_id: str) -> Path:
    if not isinstance(map_id, str) or not MAP_ID_RE.fullmatch(map_id):
        raise GameError(f"not a map id: {map_id!r}")
    p = maps_dir() / map_id
    if not (p / "world.json").is_file():
        known = ", ".join(m["map_id"] for m in list_maps()[:8]) or "none yet"
        raise GameError(f"no map called {map_id!r}. Maps: {known}")
    return p


def _write_json(path: Path, data: Any) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def save_map(map_id: str, world: dict[str, Any], meta: dict[str, Any]) -> Path:
    with _lock:
        p = maps_dir() / map_id
        p.mkdir(parents=True, exist_ok=True)
        _write_json(p / "world.json", world)
        _write_json(p / "meta.json", meta)
        if not (p / "missions.json").exists():
            _write_json(p / "missions.json", [])
        write_page(map_id)
        return p


def load_world(map_id: str) -> dict[str, Any]:
    return _read_json(map_path(map_id) / "world.json", {})


def load_meta(map_id: str) -> dict[str, Any]:
    return _read_json(map_path(map_id) / "meta.json", {})


def load_missions(map_id: str) -> list[dict[str, Any]]:
    return _read_json(map_path(map_id) / "missions.json", [])


def load_results(map_id: str) -> list[dict[str, Any]]:
    return _read_json(map_path(map_id) / "results.json", [])


def list_maps() -> list[dict[str, Any]]:
    out = []
    root = maps_dir()
    for p in sorted(root.iterdir() if root.exists() else [], key=lambda q: q.stat().st_mtime, reverse=True):
        meta = _read_json(p / "meta.json", None)
        if not meta or not (p / "world.json").is_file():
            continue
        missions = _read_json(p / "missions.json", [])
        results = _read_json(p / "results.json", [])
        out.append({"map_id": p.name, "title": meta.get("title"), "place": meta.get("place"),
                    "size_m": meta.get("size_m"), "missions": len(missions), "runs": len(results),
                    "file": str(p / "index.html")})
    return out


def _script_json(data: Any) -> str:
    """JSON that is safe inside a <script> element."""
    return (json.dumps(data, ensure_ascii=False, separators=(",", ":"))
            .replace("</", "<\\/").replace("<!--", "<\\!--").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def render_page(map_id: str, results_url: str = "") -> str:
    world = load_world(map_id)
    missions = load_missions(map_id)
    meta = load_meta(map_id)
    config = {"mapId": map_id, "resultsUrl": results_url, "time": meta.get("time", "day")}
    html = (WEB / "game.html").read_text(encoding="utf-8")
    js = (WEB / "game.js").read_text(encoding="utf-8")
    title = (world.get("title") or "Hometown").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return (html.replace("@@TITLE@@", title)
                .replace("@@WORLD@@", _script_json(world))
                .replace("@@MISSIONS@@", _script_json(missions))
                .replace("@@CONFIG@@", _script_json(config))
                .replace("@@GAME_JS@@", js.replace("</script", "<\\/script")))


def write_page(map_id: str) -> Path:
    p = maps_dir() / map_id / "index.html"
    tmp = p.with_suffix(".tmp")
    tmp.write_text(render_page(map_id), encoding="utf-8")
    os.replace(tmp, p)
    return p


# ---------- places ----------

def _fold(text: str) -> str:
    t = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def find_places(world: dict[str, Any], query: str = "", kind: str = "", limit: int = 20) -> list[dict[str, Any]]:
    q, k = _fold(query), _fold(kind)
    scored = []
    for p in world.get("pois", []):
        name, typ = _fold(p["n"]), _fold(p["k"])
        if k and k not in typ and k not in _fold(p.get("g", "")):
            continue
        if q:
            if q in name or q in typ or (p.get("st") and q in _fold(p["st"])):
                s = 3.0 if name.startswith(q) else 2.0
            else:
                s = difflib.SequenceMatcher(None, q, name).ratio()
                if s < 0.6:
                    continue
        else:
            s = p.get("s", 0) / 10
        scored.append((s, p))
    scored.sort(key=lambda sp: (-sp[0], -sp[1].get("s", 0)))
    return [sp[1] for sp in scored[:max(1, min(limit, 100))]]


def resolve_place(world: dict[str, Any], ref: str, proj: Optional[geo.Projection] = None) -> dict[str, Any]:
    """Turn a place id ("p3"), a place name, or "lat,lon" into {n, x, y}."""
    ref = (ref or "").strip()
    if not ref:
        raise GameError("a stop needs a place")
    pois = world.get("pois", [])
    for p in pois:
        if p["id"] == ref:
            return {"n": p["n"], "x": p["x"], "y": p["y"]}
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$", ref)
    if m and proj is not None:
        x, y = proj.xy(float(m.group(1)), float(m.group(2)))
        half = world.get("half", 0)
        if abs(x) > half or abs(y) > half:
            raise GameError(f"{ref} is outside this map ({round(half * 2)} m across)")
        return {"n": ref, "x": round(x, 1), "y": round(y, 1)}
    hits = find_places(world, ref, limit=3)
    if hits and (_fold(ref) in _fold(hits[0]["n"]) or difflib.SequenceMatcher(None, _fold(ref), _fold(hits[0]["n"])).ratio() >= 0.75):
        return {"n": hits[0]["n"], "x": hits[0]["x"], "y": hits[0]["y"]}
    near = ", ".join(f'{h["id"]} {h["n"]}' for h in hits) or ", ".join(f'{p["id"]} {p["n"]}' for p in pois[:5])
    raise GameError(f"no place matches {ref!r}. Try a place id from hometown_places. Close: {near}")


def snap_to_road(world: dict[str, Any], x: float, y: float, drivable_only: bool = False) -> tuple[float, float, float, float]:
    """Nearest point on a road or path. Returns (x, y, heading, distance)."""
    best = (x, y, 0.0, float("inf"))
    for r in world.get("roads", []):
        if r["k"] in ("rail", "water") or (drivable_only and r["k"] == "path"):
            continue
        f = r["p"]
        for i in range(0, len(f) - 2, 2):
            ax, ay, bx, by = f[i], f[i + 1], f[i + 2], f[i + 3]
            dx, dy = bx - ax, by - ay
            l2 = dx * dx + dy * dy
            t = 0.0 if l2 < 1e-9 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / l2))
            qx, qy = ax + t * dx, ay + t * dy
            d = math.hypot(x - qx, y - qy)
            if d < best[3]:
                best = (qx, qy, math.atan2(dy, dx), d)
    return best


def _clean_text(text: Any, limit: int) -> str:
    t = re.sub(r"\s+", " ", str(text or "")).strip()
    t = "".join(ch for ch in t if ch.isprintable())
    return t[:limit]


def add_mission(map_id: str, name: str, brief: str, stops: list[dict[str, Any]], *, vehicle: str = "car",
                time_limit_s: Optional[float] = None, time_of_day: str = "", start: str = "",
                replace: bool = False) -> dict[str, Any]:
    world = load_world(map_id)
    meta = load_meta(map_id)
    proj = geo.Projection(meta["center"]["lat"], meta["center"]["lon"]) if meta.get("center") else None
    name = _clean_text(name, 60)
    if not name:
        raise GameError("a mission needs a name")
    if vehicle not in VEHICLES:
        raise GameError(f"vehicle must be one of {', '.join(VEHICLES)}")
    if time_of_day and time_of_day not in TIMES:
        raise GameError(f"time_of_day must be one of {', '.join(TIMES)}")
    if not isinstance(stops, list) or not stops:
        raise GameError("a mission needs at least one stop")
    if len(stops) > MAX_STOPS:
        raise GameError(f"a mission can have at most {MAX_STOPS} stops")

    if start:
        s = resolve_place(world, start, proj)
        sx, sy, sa, _ = snap_to_road(world, s["x"], s["y"], drivable_only=vehicle != "foot")
        start_pos = {"x": round(sx, 1), "y": round(sy, 1), "a": round(sa, 3), "n": s["n"]}
    else:
        sp = world.get("spawn") or {"x": 0, "y": 0, "a": 0}
        start_pos = {"x": sp["x"], "y": sp["y"], "a": sp["a"]}

    out_stops = []
    route = 0.0
    px, py = start_pos["x"], start_pos["y"]
    for i, raw in enumerate(stops):
        if isinstance(raw, str):
            raw = {"place": raw}
        if not isinstance(raw, dict):
            raise GameError(f"stop {i + 1} must be an object with a place")
        place = resolve_place(world, str(raw.get("place") or raw.get("id") or raw.get("name") or ""), proj)
        x, y = place["x"], place["y"]
        # Put the marker where the player can reach it: on the nearest street or path.
        rx, ry, _, d = snap_to_road(world, x, y, drivable_only=vehicle == "car")
        if d > 6 and d < float("inf"):
            x, y = rx, ry
        stop = {"n": place["n"], "x": round(x, 1), "y": round(y, 1),
                "line": _clean_text(raw.get("line") or f"Go to {place['n']}", 120)}
        if raw.get("done"):
            stop["done"] = _clean_text(raw["done"], 80)
        out_stops.append(stop)
        route += math.hypot(x - px, y - py)
        px, py = x, y

    speed = VEHICLES[vehicle]
    par = round(route * 1.35 / speed + 2.5 * len(out_stops), 1)
    if time_limit_s is None:
        limit = round(max(par * 1.7, 30) / 5) * 5
    else:
        limit = max(0.0, float(time_limit_s))
        if 0 < limit < 10:
            raise GameError("time_limit_s must be 0 (no limit) or at least 10 seconds")
    mission = {
        "id": slug(name, 32), "name": name, "brief": _clean_text(brief, 240), "vehicle": vehicle,
        "par": par, "limit": round(limit, 1), "stops": out_stops, "start": start_pos,
        "route_m": round(route), "created": int(time.time()),
    }
    if time_of_day:
        mission["time"] = time_of_day
    with _lock:
        missions = load_missions(map_id)
        existing = [m for m in missions if m["id"] == mission["id"]]
        if existing and not replace:
            n = 2
            while any(m["id"] == f"{mission['id']}-{n}" for m in missions):
                n += 1
            mission["id"] = f"{mission['id']}-{n}"
        missions = [m for m in missions if m["id"] != mission["id"]]
        if len(missions) >= MAX_MISSIONS:
            raise GameError(f"this map already has {MAX_MISSIONS} missions; remove one first")
        missions.append(mission)
        _write_json(map_path(map_id) / "missions.json", missions)
        write_page(map_id)
    return mission


def remove_mission(map_id: str, mission_id: str) -> bool:
    with _lock:
        missions = load_missions(map_id)
        kept = [m for m in missions if m["id"] != mission_id]
        if len(kept) == len(missions):
            return False
        _write_json(map_path(map_id) / "missions.json", kept)
        write_page(map_id)
        return True


RESULT_FIELDS = {
    "mission": str, "completed": bool, "reason": str, "time_s": (int, float), "stops_done": int,
    "stops_total": int, "crashes": int, "top_speed_kmh": (int, float), "vehicle": str, "stars": int,
    "time_of_day": str,
}


def record_result(payload: dict[str, Any]) -> dict[str, Any]:
    """Check and store one run sent by the game page."""
    if not isinstance(payload, dict):
        raise GameError("result must be a JSON object")
    map_id = payload.get("map")
    p = map_path(map_id)
    missions = {m["id"]: m for m in load_missions(map_id)}
    row: dict[str, Any] = {}
    for key, typ in RESULT_FIELDS.items():
        v = payload.get(key)
        if v is None:
            continue
        if typ is bool:
            if not isinstance(v, bool):
                raise GameError(f"{key} must be true or false")
        elif not isinstance(v, typ) or isinstance(v, bool):
            raise GameError(f"{key} has the wrong type")
        if isinstance(v, str):
            v = _clean_text(v, 64)
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            if not math.isfinite(v) or v < 0 or v > 1e6:
                raise GameError(f"{key} is out of range")
        row[key] = v
    if row.get("mission") not in missions:
        raise GameError("unknown mission")
    row["at"] = int(time.time())
    with _lock:
        results = load_results(map_id)
        results.append(row)
        _write_json(p / "results.json", results[-MAX_RESULTS:])
    return row


def score_report(map_id: str) -> dict[str, Any]:
    missions = load_missions(map_id)
    results = load_results(map_id)
    report = []
    for m in missions:
        runs = [r for r in results if r.get("mission") == m["id"]]
        wins = [r for r in runs if r.get("completed")]
        best = min((r["time_s"] for r in wins if "time_s" in r), default=None)
        entry = {
            "mission_id": m["id"], "name": m["name"], "par_s": m["par"], "limit_s": m["limit"],
            "stops": len(m["stops"]), "vehicle": m["vehicle"], "runs": len(runs), "completed": len(wins),
            "best_time_s": best, "beat_par": best is not None and best <= m["par"],
        }
        if runs:
            entry["avg_crashes"] = round(sum(r.get("crashes", 0) for r in runs) / len(runs), 1)
            entry["fails"] = sorted({r.get("reason") for r in runs if not r.get("completed") and r.get("reason")})
            entry["last"] = [{k: r.get(k) for k in ("completed", "time_s", "crashes", "stars", "stops_done", "at")}
                             for r in runs[-3:]]
        report.append(entry)
    return {"map_id": map_id, "missions": report, "total_runs": len(results)}
