"""Tool schemas: what the model reads."""

BUILD = {
    "name": "hometown_build",
    "description": (
        "Build a drivable 3D browser game of a real place from OpenStreetMap: real buildings with "
        "heights, streets with names, parks, water and trees. Give a street address, a landmark, a "
        "neighbourhood, or 'lat,lon'. Returns a map_id, a local URL to play, the main streets, and "
        "the named places on the map (cafés, parks, shops, landmarks) with ids like 'p3' to use as "
        "mission stops. Takes 5 to 60 seconds."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "place": {"type": "string", "description": "Address, landmark or 'lat,lon', e.g. '1334 Rue Sherbrooke Est, Montréal' or '45.5268,-73.5698'."},
            "radius_m": {"type": "integer", "minimum": 120, "maximum": 1000,
                         "description": "Half the width of the square map in metres. 250 is a few blocks, 400 a neighbourhood (default 350). Bigger maps take longer."},
            "title": {"type": "string", "description": "Name shown in the game, e.g. 'Mom's block'. Default: the place name."},
            "time_of_day": {"type": "string", "enum": ["day", "dusk", "night"], "description": "Default lighting for free roam."},
            "osm_file": {"type": "string", "description": "Optional path to a local .osm (XML) or Overpass .json export to use instead of downloading. 'place' then sets the centre; without it the file's centre is used."},
            "open_browser": {"type": "boolean", "description": "Also open the game in the user's browser. Default false."},
        },
        "required": [],
    },
}

PLACES = {
    "name": "hometown_places",
    "description": (
        "Search the named places on a built map, by name, by type ('cafe', 'park', 'bakery', "
        "'school') or both. Returns ids for hometown_mission stops, the street each place is on, and "
        "how far it is from the map centre."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "map_id": {"type": "string"},
            "query": {"type": "string", "description": "Part of a name or a type, e.g. 'bagel' or 'library'."},
            "kind": {"type": "string", "description": "Only this type of place, e.g. 'restaurant'."},
            "limit": {"type": "integer", "minimum": 1, "maximum": 100, "description": "Default 20."},
        },
        "required": ["map_id"],
    },
}

MISSION = {
    "name": "hometown_mission",
    "description": (
        "Add a mission to a map: an ordered route of real stops with your own story lines, like a "
        "delivery run, a scavenger hunt, a tour for a visitor, or a race. The game shows each 'line' "
        "as the objective, puts a beacon on the stop, and times the run. Par and time limit come from "
        "the real route length. Use place ids from hometown_build or hometown_places. Missions "
        "appear in the game menu when the page reloads."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "map_id": {"type": "string"},
            "name": {"type": "string", "description": "Short title, e.g. 'Bagel Rush'."},
            "brief": {"type": "string", "description": "One or two sentences that set the scene, shown at the start."},
            "stops": {
                "type": "array", "minItems": 1, "maxItems": 12,
                "description": "Stops in order.",
                "items": {
                    "type": "object",
                    "properties": {
                        "place": {"type": "string", "description": "Place id ('p4'), place name, or 'lat,lon'."},
                        "line": {"type": "string", "description": "Objective text while driving there, e.g. 'Grab a dozen sesame at Fairmount'."},
                        "done": {"type": "string", "description": "Short line shown on arrival, e.g. 'Still warm!'."},
                    },
                    "required": ["place"],
                },
            },
            "vehicle": {"type": "string", "enum": ["car", "bike", "foot"], "description": "Default car."},
            "time_limit_s": {"type": "number", "description": "Seconds. 0 means no limit. Default: 1.7 times par."},
            "time_of_day": {"type": "string", "enum": ["day", "dusk", "night"]},
            "start": {"type": "string", "description": "Optional start place (id, name or 'lat,lon'). Default: the map's start point."},
            "replace": {"type": "boolean", "description": "Replace a mission with the same name instead of adding a copy."},
        },
        "required": ["map_id", "name", "stops"],
    },
}

OPEN = {
    "name": "hometown_open",
    "description": (
        "Start the local game server if needed and return the URL of a map, or of one mission. "
        "Runs played from this URL send their times back, so hometown_scores can read them."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "map_id": {"type": "string"},
            "mission_id": {"type": "string", "description": "Start straight into this mission."},
            "open_browser": {"type": "boolean", "description": "Also open it in the user's browser. Default false."},
        },
        "required": ["map_id"],
    },
}

SCORES = {
    "name": "hometown_scores",
    "description": (
        "Read how the player did on a map's missions: runs, completions, best time against par, "
        "crashes and why runs failed. Use it to praise, coach, or write a harder or easier next mission."
    ),
    "parameters": {"type": "object", "properties": {"map_id": {"type": "string"}}, "required": ["map_id"]},
}

MAPS = {
    "name": "hometown_maps",
    "description": "List the maps built so far, with their missions and how many runs were played.",
    "parameters": {"type": "object", "properties": {}, "required": []},
}

ALL = (BUILD, PLACES, MISSION, OPEN, SCORES, MAPS)
