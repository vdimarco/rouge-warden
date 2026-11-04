"""Build the fixture map with two missions, serve it, print the URLs as JSON, and wait.

Used by smoke.e2e.mjs. Pass --osm and --radius to use another OSM file.
"""

import argparse
import json
import sys
import time

from helpers import CENTRE, FIXTURE, RecordingContext, load


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--osm", default=str(FIXTURE))
    ap.add_argument("--radius", type=int, default=220)
    ap.add_argument("--centre", default=CENTRE)
    ap.add_argument("--title", default="Parc La Fontaine")
    a = ap.parse_args()
    plugin = load()
    ctx = RecordingContext()
    plugin.register(ctx)
    run = lambda tool, **args: json.loads(ctx.tools[tool]["handler"](args))
    built = run("hometown_build", place=a.centre, osm_file=a.osm, radius_m=a.radius, title=a.title)
    if "error" in built:
        print(json.dumps(built)); sys.exit(1)
    places = built["top_places"]
    m1 = run("hometown_mission", map_id=built["map_id"], name="Park Loop",
             brief="Sam lands at noon. Show them the park before the show starts.",
             stops=[{"place": places[0]["id"], "line": f"Start at {places[0]['name']}", "done": "Great view!"},
                    {"place": places[1]["id"], "line": f"Then {places[1]['name']}"},
                    {"place": places[2]["id"], "line": f"Finish at {places[2]['name']}"}])
    m2 = run("hometown_mission", map_id=built["map_id"], name="Night Ride", brief="Lights off, bike on.",
             vehicle="bike", time_of_day="night", stops=[places[3]["id"], places[4]["id"]])
    print(json.dumps({"map_id": built["map_id"], "url": built["url"], "mission": m1, "mission2": m2,
                      "data": str(__import__("pathlib").Path(built["file"]).parent)}), flush=True)
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
