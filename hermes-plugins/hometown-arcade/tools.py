"""Tool handlers. Each returns a JSON string and never raises."""

from __future__ import annotations

import json
import logging
import time
import webbrowser
from typing import Any, Callable, Optional

from . import game, geo, osm, server, world

logger = logging.getLogger(__name__)

DEFAULT_RADIUS = 350
MIN_RADIUS, MAX_RADIUS = 120, 1000

# Settings from plugins.entries.hometown-arcade.settings, set by register().
_get_config: Callable[[str, Any], Any] = lambda key, default=None: default


def configure(get_config: Callable[[str, Any], Any]) -> None:
    global _get_config
    _get_config = get_config


def _setting(key: str, default: Any) -> Any:
    try:
        v = _get_config(key, default)
    except Exception:
        return default
    return default if v is None else v


def _ok(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False)


def _err(msg: str, **extra: Any) -> str:
    return json.dumps({"error": msg, **extra}, ensure_ascii=False)


def _guard(fn):
    def wrapper(args: dict, **kwargs) -> str:
        try:
            return fn(args if isinstance(args, dict) else {}, **kwargs)
        except (game.GameError, osm.OSMError) as exc:
            return _err(str(exc))
        except Exception as exc:  # a handler must never raise into the agent loop
            logger.exception("hometown-arcade tool failed")
            return _err(f"unexpected error: {type(exc).__name__}: {exc}")
    wrapper.__name__ = fn.__name__
    wrapper.__doc__ = fn.__doc__
    return wrapper


def _serve(map_id: str, mission_id: str = "") -> Optional[str]:
    try:
        port = server.start(int(_setting("port", 0) or 0))
    except Exception as exc:
        logger.warning("hometown-arcade could not start its local server: %s", exc)
        return None
    return server.url_for(map_id, port, mission_id)


def _open(url: str) -> bool:
    try:
        return bool(webbrowser.open(url, new=2))
    except Exception:
        return False


def _radius(value: Any) -> int:
    default = int(_setting("default_radius_m", DEFAULT_RADIUS) or DEFAULT_RADIUS)
    if value in (None, ""):
        value = default
    try:
        r = int(round(float(value)))
    except (TypeError, ValueError):
        raise game.GameError("radius_m must be a number of metres")
    return max(MIN_RADIUS, min(MAX_RADIUS, r))


@_guard
def build(args: dict, **kwargs) -> str:
    place = str(args.get("place") or "").strip()
    osm_file = str(args.get("osm_file") or "").strip()
    radius = _radius(args.get("radius_m"))
    tod = str(args.get("time_of_day") or "day")
    if tod not in game.TIMES:
        return _err("time_of_day must be day, dusk or night")
    if not place and not osm_file:
        return _err("give a place (an address, a landmark or 'lat,lon') or an osm_file")
    started = time.time()

    if osm_file:
        elements = osm.load_file(osm_file)
        if place:
            spot = osm.geocode(place)
        else:
            b = osm.bounds_of(elements)
            if b is None:
                return _err("the OSM file has no nodes")
            spot = {"lat": (b[0] + b[2]) / 2, "lon": (b[1] + b[3]) / 2, "name": "", "display_name": osm_file}
        source = "file"
    else:
        spot = osm.geocode(place)
        proj = geo.Projection(spot["lat"], spot["lon"])
        urls = _setting("overpass_urls", None)
        if not isinstance(urls, list) or not urls:
            urls = None
        elements, source = osm.fetch_area(proj.bbox(radius + 30), urls)

    title = (str(args.get("title") or "").strip() or spot.get("name") or place or "Hometown")[:60]
    w = world.build_world(elements, (spot["lat"], spot["lon"]), radius, title)
    if not w["buildings"] and not w["roads"]:
        return _err("OpenStreetMap has no buildings or streets here. Check the place, or try a bigger radius_m.")
    map_id = game.make_map_id(title, spot["lat"], spot["lon"], radius)
    meta = {"title": title, "place": spot.get("display_name") or place, "center": w["center"],
            "size_m": round(radius * 2), "source": source, "time": tod, "created": int(time.time())}
    path = game.save_map(map_id, w, meta)
    url = _serve(map_id)
    opened = _open(url) if (url and args.get("open_browser")) else False
    info = world.summary(w)
    return _ok({
        "map_id": map_id,
        "title": title,
        "place": meta["place"],
        "url": url,
        "file": str(path / "index.html"),
        "opened_in_browser": opened,
        "source": source,
        "seconds": round(time.time() - started, 1),
        **info,
        "next": "Write one to three missions with hometown_mission using the place ids above, then share the url.",
        "attribution": world.ATTRIBUTION,
    })


@_guard
def places(args: dict, **kwargs) -> str:
    map_id = str(args.get("map_id") or "")
    w = game.load_world(map_id)
    try:
        limit = int(args.get("limit") or 20)
    except (TypeError, ValueError):
        limit = 20
    hits = game.find_places(w, str(args.get("query") or ""), str(args.get("kind") or ""), limit)
    return _ok({"map_id": map_id, "count": len(hits), "places": [world.poi_brief(p) for p in hits],
                "total_places": len(w.get("pois", []))})


@_guard
def mission(args: dict, **kwargs) -> str:
    map_id = str(args.get("map_id") or "")
    tl = args.get("time_limit_s")
    if tl is not None:
        try:
            tl = float(tl)
        except (TypeError, ValueError):
            return _err("time_limit_s must be a number of seconds")
    m = game.add_mission(
        map_id, str(args.get("name") or ""), str(args.get("brief") or ""), args.get("stops") or [],
        vehicle=str(args.get("vehicle") or "car"), time_limit_s=tl,
        time_of_day=str(args.get("time_of_day") or ""), start=str(args.get("start") or ""),
        replace=bool(args.get("replace")),
    )
    url = _serve(map_id, m["id"])
    return _ok({
        "mission_id": m["id"], "name": m["name"], "vehicle": m["vehicle"], "par_s": m["par"],
        "limit_s": m["limit"], "route_m": m["route_m"],
        "stops": [{"name": s["n"], "line": s["line"]} for s in m["stops"]],
        "url": url, "file": str(game.maps_dir() / map_id / "index.html"),
        "note": "Reload the game page to see the new mission."
                + (" Tip: the stops are close together; add farther stops for a longer run." if m["route_m"] < 200 else ""),
    })


@_guard
def open_map(args: dict, **kwargs) -> str:
    map_id = str(args.get("map_id") or "")
    game.map_path(map_id)
    mission_id = str(args.get("mission_id") or "")
    if mission_id and mission_id not in {m["id"] for m in game.load_missions(map_id)}:
        return _err(f"no mission {mission_id!r} on {map_id}")
    url = _serve(map_id, mission_id)
    if not url:
        return _err("the local game server could not start", file=str(game.maps_dir() / map_id / "index.html"))
    opened = _open(url) if args.get("open_browser") else False
    return _ok({"map_id": map_id, "url": url, "opened_in_browser": opened,
                "file": str(game.maps_dir() / map_id / "index.html")})


@_guard
def scores(args: dict, **kwargs) -> str:
    return _ok(game.score_report(str(args.get("map_id") or "")))


@_guard
def maps(args: dict, **kwargs) -> str:
    port = server.running_port()
    items = game.list_maps()
    if port:
        for m in items:
            m["url"] = server.url_for(m["map_id"], port)
    return _ok({"maps": items})


HANDLERS = {
    "hometown_build": build,
    "hometown_places": places,
    "hometown_mission": mission,
    "hometown_open": open_map,
    "hometown_scores": scores,
    "hometown_maps": maps,
}


def slash_command(raw_args: str = "", **kwargs) -> str:
    """/hometown <place> builds a map and prints its URL. /hometown alone lists maps."""
    text = (raw_args or "").strip()
    if not text or text in ("list", "maps"):
        data = json.loads(maps({}))
        rows = data.get("maps") or []
        if not rows:
            return "No maps yet. Try: /hometown 1334 Rue Sherbrooke Est, Montréal"
        return "\n".join(f"{m['title']}  ({m['map_id']}, {m['missions']} missions)  {m.get('url') or m['file']}" for m in rows)
    if text.startswith("open "):
        data = json.loads(open_map({"map_id": text[5:].strip(), "open_browser": True}))
        return data.get("error") or f"Opened {data['url']}"
    data = json.loads(build({"place": text, "open_browser": True}))
    if "error" in data:
        return f"Could not build the map: {data['error']}"
    names = ", ".join(p["name"] for p in data.get("top_places", [])[:5])
    return (f"Built {data['title']}: {data['buildings']} buildings, {len(data.get('streets', []))}+ streets, "
            f"{data['places']} places. Play: {data['url'] or data['file']}\n"
            f"Places include {names}. Ask me to write missions for it.")
