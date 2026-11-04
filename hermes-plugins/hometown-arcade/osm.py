"""Get OpenStreetMap data: geocode a place, download an area, parse it.

Every source turns into the same list of plain elements:

    {"type": "node", "id": 1, "tags": {...}, "lat": 45.5, "lon": -73.5}
    {"type": "way", "id": 2, "tags": {...}, "geometry": [(lat, lon), ...]}
    {"type": "relation", "id": 3, "tags": {...},
     "members": [{"role": "outer", "geometry": [(lat, lon), ...]}, ...]}

Network calls use only the Python standard library. They go to Nominatim (one
search per build, only when the caller gives a place name), then Overpass. When
every Overpass server fails, a small area comes from the OpenStreetMap editing
API instead.
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Optional

USER_AGENT = "hometown-arcade/1.0 (Hermes Agent plugin; +https://github.com/vdimarco/rouge-warden)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
OSM_API_MAP_URL = "https://api.openstreetmap.org/api/0.6/map"
# The editing API refuses large boxes, and it is meant for editors, so use it
# only as a last resort for small maps.
OSM_API_MAX_DEG2 = 0.0004
MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024

LATLON_RE = re.compile(r"^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$")


class OSMError(RuntimeError):
    """A download or parse failed in a way the agent should hear about."""


def _request(url: str, data: Optional[bytes] = None, timeout: float = 60.0) -> bytes:
    req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (https URLs only)
        body = resp.read(MAX_DOWNLOAD_BYTES + 1)
    if len(body) > MAX_DOWNLOAD_BYTES:
        raise OSMError("the map download is too large; use a smaller radius_m")
    return body


def parse_latlon(text: str) -> Optional[tuple[float, float]]:
    m = LATLON_RE.match(text or "")
    if not m:
        return None
    lat, lon = float(m.group(1)), float(m.group(2))
    if -90 <= lat <= 90 and -180 <= lon <= 180:
        return lat, lon
    return None


def geocode(place: str, timeout: float = 20.0) -> dict[str, Any]:
    """Find a place with Nominatim. Returns {lat, lon, name, display_name}."""
    direct = parse_latlon(place)
    if direct:
        return {"lat": direct[0], "lon": direct[1], "name": place.strip(), "display_name": place.strip()}
    query = urllib.parse.urlencode({"q": place, "format": "jsonv2", "limit": 1, "addressdetails": 0})
    try:
        body = _request(f"{NOMINATIM_URL}?{query}", timeout=timeout)
        results = json.loads(body.decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        raise OSMError(f"could not look up {place!r} on Nominatim: {exc}") from exc
    if not results:
        raise OSMError(f"Nominatim found no place called {place!r}; try a fuller address or 'lat,lon'")
    top = results[0]
    name = top.get("name") or top.get("display_name", place).split(",")[0]
    return {
        "lat": float(top["lat"]),
        "lon": float(top["lon"]),
        "name": name,
        "display_name": top.get("display_name", place),
    }


def overpass_query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    b = f"({s:.6f},{w:.6f},{n:.6f},{e:.6f})"
    parts = [
        f'way["building"]{b};',
        f'relation["building"]{b};',
        f'way["building:part"]{b};',
        f'way["highway"]{b};',
        f'way["natural"~"^(water|wood|scrub|grassland|beach|sand)$"]{b};',
        f'relation["natural"="water"]{b};',
        f'way["waterway"~"^(riverbank|river|canal|stream)$"]{b};',
        f'way["water"]{b};',
        f'way["leisure"~"^(park|garden|pitch|playground|golf_course|dog_park|common)$"]{b};',
        f'relation["leisure"="park"]{b};',
        f'way["landuse"~"^(grass|forest|meadow|recreation_ground|cemetery|village_green|park)$"]{b};',
        f'way["amenity"~"^(parking|school|university)$"]{b};',
        f'way["railway"~"^(rail|tram|light_rail|subway)$"]{b};',
        f'node["natural"="tree"]{b};',
        f'nwr["name"]["amenity"]{b};',
        f'nwr["name"]["shop"]{b};',
        f'nwr["name"]["tourism"]{b};',
        f'nwr["name"]["leisure"]{b};',
        f'nwr["name"]["historic"]{b};',
        f'nwr["name"]["craft"]{b};',
        f'node["name"]["railway"="station"]{b};',
    ]
    return "[out:json][timeout:40];(" + "".join(parts) + ");out geom qt;"


def fetch_overpass(bbox: tuple[float, float, float, float], urls: Optional[list[str]] = None,
                   timeout: float = 45.0) -> list[dict[str, Any]]:
    """Try each server in turn. A busy public server can hang, so each gets ``timeout`` seconds."""
    data = urllib.parse.urlencode({"data": overpass_query(bbox)}).encode("ascii")
    errors: list[str] = []
    for url in urls or OVERPASS_URLS:
        if not str(url).startswith("https://"):
            errors.append(f"{url}: only https Overpass servers are used")
            continue
        try:
            body = _request(url, data=data, timeout=timeout)
            return parse_overpass_json(json.loads(body.decode("utf-8")))
        except (urllib.error.URLError, TimeoutError, ValueError, OSError, OSMError) as exc:
            errors.append(f"{urllib.parse.urlparse(url).netloc}: {exc}")
            time.sleep(0.5)
    raise OSMError("every Overpass server failed: " + "; ".join(errors))


def fetch_osm_api(bbox: tuple[float, float, float, float], timeout: float = 90.0) -> list[dict[str, Any]]:
    s, w, n, e = bbox
    if (n - s) * (e - w) > OSM_API_MAX_DEG2:
        raise OSMError("the area is too large for the OpenStreetMap API fallback; use radius_m 600 or less")
    query = urllib.parse.urlencode({"bbox": f"{w:.6f},{s:.6f},{e:.6f},{n:.6f}"})
    try:
        body = _request(f"{OSM_API_MAP_URL}?{query}", timeout=timeout)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise OSMError(f"the OpenStreetMap API failed: {exc}") from exc
    return parse_osm_xml(body)


def fetch_area(bbox: tuple[float, float, float, float], overpass_urls: Optional[list[str]] = None) -> tuple[list[dict[str, Any]], str]:
    """Download an area. Returns (elements, source name)."""
    try:
        return fetch_overpass(bbox, overpass_urls), "overpass"
    except OSMError as first:
        try:
            return fetch_osm_api(bbox), "openstreetmap-api"
        except OSMError as second:
            raise OSMError(f"{first}. Fallback: {second}") from second


def parse_overpass_json(doc: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for el in doc.get("elements", []):
        kind = el.get("type")
        tags = el.get("tags") or {}
        if kind == "node":
            out.append({"type": "node", "id": el.get("id"), "tags": tags, "lat": el["lat"], "lon": el["lon"]})
        elif kind == "way":
            geom = [(g["lat"], g["lon"]) for g in el.get("geometry") or [] if g]
            if geom:
                out.append({"type": "way", "id": el.get("id"), "tags": tags, "geometry": geom})
        elif kind == "relation":
            members = []
            for m in el.get("members") or []:
                if m.get("type") == "way" and m.get("geometry"):
                    members.append({"role": m.get("role") or "outer",
                                    "geometry": [(g["lat"], g["lon"]) for g in m["geometry"] if g]})
            if members:
                out.append({"type": "relation", "id": el.get("id"), "tags": tags, "members": members})
    return out


def _xml_tags(el: ET.Element) -> dict[str, str]:
    return {t.get("k"): t.get("v") for t in el.findall("tag") if t.get("k") is not None}


def parse_osm_xml(source: bytes | str | Path) -> list[dict[str, Any]]:
    """Parse OSM XML (an .osm export or the editing API's reply)."""
    try:
        if isinstance(source, (str, Path)) and not str(source).lstrip().startswith("<"):
            root = ET.parse(str(source)).getroot()
        else:
            root = ET.fromstring(source if isinstance(source, bytes) else source.encode("utf-8"))
    except (ET.ParseError, OSError) as exc:
        raise OSMError(f"could not read the OSM XML: {exc}") from exc
    nodes: dict[str, tuple[float, float]] = {}
    out: list[dict[str, Any]] = []
    for n in root.iter("node"):
        try:
            lat, lon = float(n.get("lat")), float(n.get("lon"))
        except (TypeError, ValueError):
            continue
        nodes[n.get("id")] = (lat, lon)
        tags = _xml_tags(n)
        if tags:
            out.append({"type": "node", "id": int(n.get("id")), "tags": tags, "lat": lat, "lon": lon})
    ways: dict[str, list[tuple[float, float]]] = {}
    for w in root.iter("way"):
        geom = [nodes[nd.get("ref")] for nd in w.findall("nd") if nd.get("ref") in nodes]
        if len(geom) < 2:
            continue
        ways[w.get("id")] = geom
        out.append({"type": "way", "id": int(w.get("id")), "tags": _xml_tags(w), "geometry": geom})
    for r in root.iter("relation"):
        members = []
        for m in r.findall("member"):
            if m.get("type") == "way" and m.get("ref") in ways:
                members.append({"role": m.get("role") or "outer", "geometry": ways[m.get("ref")]})
        if members:
            out.append({"type": "relation", "id": int(r.get("id")), "tags": _xml_tags(r), "members": members})
    return out


def load_file(path: str | Path) -> list[dict[str, Any]]:
    """Read a local .osm (XML) or Overpass .json file."""
    p = Path(path).expanduser()
    if not p.is_file():
        raise OSMError(f"no such file: {p}")
    if p.suffix.lower() == ".json":
        try:
            return parse_overpass_json(json.loads(p.read_text(encoding="utf-8")))
        except ValueError as exc:
            raise OSMError(f"could not read {p.name} as Overpass JSON: {exc}") from exc
    return parse_osm_xml(p)


def bounds_of(elements: list[dict[str, Any]]) -> Optional[tuple[float, float, float, float]]:
    lats: list[float] = []
    lons: list[float] = []
    for el in elements:
        if el["type"] == "node":
            lats.append(el["lat"]); lons.append(el["lon"])
        elif el["type"] == "way":
            for lat, lon in el["geometry"]:
                lats.append(lat); lons.append(lon)
    if not lats:
        return None
    return (min(lats), min(lons), max(lats), max(lons))
