import http.client
import json
import unittest
from pathlib import Path

import yaml

from helpers import CENTRE, FIXTURE, PLUGIN_DIR, RecordingContext, load, sub

plugin = load()
game = sub("game")
server = sub("server")
tools = sub("tools")


def call(ctx, tool, **args):
    return json.loads(ctx.tools[tool]["handler"](args, task_id="t1", session_id="s1"))


def req(method, port, path, body=None, host=None, ctype="application/json"):
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
    headers = {"Host": host or f"127.0.0.1:{port}"}
    if body is not None:
        headers["Content-Type"] = ctype
    conn.request(method, path, body=body, headers=headers)
    r = conn.getresponse()
    data = r.read()
    conn.close()
    return r.status, data, dict(r.getheaders())


class PluginTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ctx = RecordingContext()
        plugin.register(cls.ctx)
        cls.built = call(cls.ctx, "hometown_build", place=CENTRE, osm_file=str(FIXTURE), radius_m=220,
                         title="Parc La Fontaine")
        assert "error" not in cls.built, cls.built
        cls.map_id = cls.built["map_id"]

    @classmethod
    def tearDownClass(cls):
        server.stop()

    def test_manifest_matches_registrations(self):
        manifest = yaml.safe_load((PLUGIN_DIR / "plugin.yaml").read_text())
        for field in ("name", "version", "description"):
            self.assertTrue(manifest.get(field))
        self.assertEqual(sorted(manifest["provides_tools"]), sorted(self.ctx.tools))
        self.assertEqual(manifest["provides_hooks"], self.ctx.hooks)
        self.assertIn("hometown", self.ctx.commands)
        self.assertIn("hometown-arcade", self.ctx.skills)
        for t in self.ctx.tools.values():
            self.assertEqual(t["schema"]["parameters"]["type"], "object")

    def test_build_result(self):
        b = self.built
        self.assertTrue(b["url"].startswith("http://127.0.0.1:"))
        self.assertTrue(Path(b["file"]).is_file())
        self.assertGreater(b["buildings"], 25)
        self.assertTrue(b["top_places"])
        self.assertEqual(b["source"], "file")

    def test_places_search(self):
        r = call(self.ctx, "hometown_places", map_id=self.map_id, query="theatre")
        self.assertTrue(any("Verdure" in p["name"] for p in r["places"]), r)
        r = call(self.ctx, "hometown_places", map_id=self.map_id, kind="cafe")
        self.assertTrue(all(p["type"] == "cafe" for p in r["places"]))

    def test_mission_round_trip_with_scores(self):
        top = self.built["top_places"]
        m = call(self.ctx, "hometown_mission", map_id=self.map_id, name="Park Loop",
                 brief="Show Sam the park before the show.",
                 stops=[{"place": top[0]["id"], "line": "Start at the whale", "done": "Splash!"},
                        {"place": top[1]["name"], "line": "Then the theatre"}])
        self.assertNotIn("error", m, m)
        self.assertEqual(m["mission_id"], "park-loop")
        self.assertGreater(m["par_s"], 0)
        self.assertGreaterEqual(m["limit_s"], 30)
        self.assertIn("#mission=park-loop", m["url"])
        page = Path(m["file"]).read_text()
        self.assertIn("Start at the whale", page)

        port = int(m["url"].split(":")[2].split("/")[0])
        status, body, headers = req("GET", port, f"/m/{self.map_id}/")
        self.assertEqual(status, 200)
        self.assertIn(b"Park Loop", body)
        self.assertIn(b'"resultsUrl":"/api/results"', body)
        self.assertIn("default-src 'none'", headers["Content-Security-Policy"])

        run = {"map": self.map_id, "mission": "park-loop", "completed": True, "time_s": 41.5, "stops_done": 2,
               "stops_total": 2, "crashes": 1, "top_speed_kmh": 88, "vehicle": "car", "stars": 2}
        status, body, _ = req("POST", port, "/api/results", json.dumps(run))
        self.assertEqual(status, 200, body)
        scores = call(self.ctx, "hometown_scores", map_id=self.map_id)
        entry = next(e for e in scores["missions"] if e["mission_id"] == "park-loop")
        self.assertEqual(entry["runs"], 1)
        self.assertEqual(entry["best_time_s"], 41.5)

        again = call(self.ctx, "hometown_mission", map_id=self.map_id, name="Park Loop", stops=[top[2]["id"]])
        self.assertEqual(again["mission_id"], "park-loop-2")
        replaced = call(self.ctx, "hometown_mission", map_id=self.map_id, name="Park Loop", stops=[top[2]["id"]],
                        replace=True, vehicle="bike", time_limit_s=0)
        self.assertEqual(replaced["mission_id"], "park-loop")
        self.assertEqual(replaced["limit_s"], 0)

    def test_server_refuses_bad_requests(self):
        port = server.start()
        self.assertEqual(req("GET", port, "/", host="evil.example:80")[0], 403)
        self.assertEqual(req("POST", port, "/api/results", "{}", host="evil.example")[0], 403)
        self.assertEqual(req("POST", port, "/api/results", "x" * 9000)[0], 413)
        self.assertEqual(req("POST", port, "/api/results", "{}", ctype="text/plain")[0], 415)
        self.assertEqual(req("POST", port, "/api/results", json.dumps({"map": self.map_id, "mission": "nope"}))[0], 400)
        self.assertEqual(req("POST", port, "/api/results", json.dumps({"map": "../etc", "mission": "x"}))[0], 400)
        bad_type = {"map": self.map_id, "mission": "park-loop", "time_s": "fast"}
        self.assertEqual(req("POST", port, "/api/results", json.dumps(bad_type))[0], 400)
        self.assertEqual(req("GET", port, "/m/../../private/notes/")[0], 404)
        self.assertEqual(req("GET", port, "/")[0], 200)

    def test_handlers_never_raise(self):
        bad = [{}, {"map_id": None}, {"map_id": "../../x"}, {"map_id": 7, "stops": "x"}, {"place": ""},
               {"radius_m": "wide", "place": CENTRE}, {"map_id": self.map_id, "name": "x", "stops": [{"place": "nowhere-zzz"}]},
               {"map_id": self.map_id, "name": "x", "stops": [5]}, {"map_id": self.map_id, "time_limit_s": "soon", "name": "x", "stops": ["p1"]}]
        for name, entry in self.ctx.tools.items():
            for args in bad:
                out = entry["handler"](args)
                self.assertIsInstance(out, str)
                json.loads(out)
        out = json.loads(self.ctx.tools["hometown_mission"]["handler"](
            {"map_id": self.map_id, "name": "x", "stops": [{"place": "nowhere-zzz"}]}))
        self.assertIn("no place matches", out["error"])

    def test_page_data_cannot_close_the_script(self):
        top = self.built["top_places"]
        call(self.ctx, "hometown_mission", map_id=self.map_id, name="Sneaky", brief="</script><script>alert(1)</script>",
             stops=[{"place": top[0]["id"], "line": "<!-- x"}])
        page = game.render_page(self.map_id)
        data = page.split("window.HOMETOWN_WORLD=", 1)[1].split("</script>", 1)[0]
        self.assertNotIn("</script", data)
        self.assertEqual(page.count("</script>"), 2)

    def test_maps_list_and_slash_command(self):
        maps = call(self.ctx, "hometown_maps")
        self.assertTrue(any(m["map_id"] == self.map_id for m in maps["maps"]))
        text = self.ctx.commands["hometown"]("")
        self.assertIn(self.map_id, text)

    def test_settings_are_read(self):
        ctx = RecordingContext({"default_radius_m": 5000})
        plugin.register(ctx)
        self.assertEqual(tools._radius(None), 1000)
        tools.configure(lambda k, d=None: d)
        self.assertEqual(tools._radius(None), 350)


if __name__ == "__main__":
    unittest.main()
