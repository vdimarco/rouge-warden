import json
import unittest

from helpers import FIXTURE, sub

geo = sub("geo")
osm = sub("osm")
world = sub("world")


class WorldTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.elements = osm.load_file(FIXTURE)
        cls.w = world.build_world(cls.elements, (45.5268, -73.5698), 220, "Parc La Fontaine")

    def test_fixture_parses(self):
        kinds = {e["type"] for e in self.elements}
        self.assertEqual(kinds, {"node", "way", "relation"})

    def test_world_has_city_parts(self):
        w = self.w
        self.assertGreater(len(w["buildings"]), 25)
        self.assertGreater(sum(1 for r in w["roads"] if r["k"] in ("major", "street")), 6)
        self.assertGreater(sum(1 for r in w["roads"] if r["k"] == "path"), 50)
        self.assertTrue(any(a["k"] == 0 for a in w["areas"]), "the park ponds are water")
        self.assertTrue(any(a["k"] == 1 for a in w["areas"]), "the park is green")
        self.assertGreater(len(w["trees"]) // 2, 300)
        self.assertIn("Rue Rachel Est", w["streets"])

    def test_everything_is_inside_the_map(self):
        half = self.w["half"] + 0.11
        for r in self.w["roads"]:
            for v in r["p"]:
                self.assertLessEqual(abs(v), half)
        for a in self.w["areas"]:
            for v in a["p"]:
                self.assertLessEqual(abs(v), half)

    def test_triangles_index_their_rings(self):
        for item in self.w["buildings"] + self.w["areas"]:
            n = len(item["p"]) // 2
            self.assertEqual(len(item["t"]) % 3, 0)
            self.assertTrue(all(0 <= i < n for i in item["t"]))
        for b in self.w["buildings"]:
            self.assertGreaterEqual(b["h"], 2)
            self.assertIn(b["c"], range(8))

    def test_places_have_ids_names_and_streets(self):
        pois = self.w["pois"]
        self.assertGreater(len(pois), 5)
        self.assertEqual(len({p["id"] for p in pois}), len(pois))
        self.assertTrue(any(p.get("st") for p in pois))
        brief = world.summary(self.w)["top_places"][0]
        self.assertTrue({"id", "name", "type", "from_centre"} <= set(brief))

    def test_spawn_is_on_a_road_and_not_in_a_building(self):
        s = self.w["spawn"]
        for b in self.w["buildings"]:
            ring = list(zip(b["p"][0::2], b["p"][1::2]))
            self.assertFalse(geo.point_in_ring((s["x"], s["y"]), ring))
        self.assertLess(abs(s["x"]) + abs(s["y"]), 200)

    def test_added_trees_stay_off_roads(self):
        mapped = {(round(e["lat"], 7), round(e["lon"], 7)) for e in self.elements
                  if e["type"] == "node" and e["tags"].get("natural") == "tree"}
        proj = geo.Projection(45.5268, -73.5698)
        mapped_xy = {(round(x, 1), round(y, 1)) for x, y in (proj.xy(*m) for m in mapped)}
        roads = [r for r in self.w["roads"] if r["k"] != "rail"]
        t = self.w["trees"]
        for i in range(0, len(t), 2):
            p = (t[i], t[i + 1])
            if p in mapped_xy:
                continue
            for r in roads:
                f = r["p"]
                for j in range(0, len(f) - 2, 2):
                    d = geo.distance_to_segment(p, (f[j], f[j + 1]), (f[j + 2], f[j + 3]))
                    self.assertGreaterEqual(d, r["w"] / 2 + 1.4, (p, r.get("n")))

    def test_world_is_small_json(self):
        size = len(json.dumps(self.w, separators=(",", ":")))
        self.assertLess(size, 600_000)

    def test_heights_from_tags(self):
        self.assertEqual(world.building_height({"height": "21 m"}, 1), 21.0)
        self.assertAlmostEqual(world.building_height({"building:levels": "3"}, 1), 10.6)
        h = world.building_height({"building": "house"}, 99)
        self.assertTrue(5 < h < 10)

    def test_road_styles(self):
        self.assertEqual(world.road_style({"highway": "primary"})[0], "major")
        self.assertEqual(world.road_style({"highway": "footway"})[0], "path")
        self.assertIsNone(world.road_style({"highway": "proposed"}))
        self.assertEqual(world.road_style({"highway": "residential", "width": "11"}), ("street", 11.0))

    def test_overpass_json_parses(self):
        doc = {"elements": [
            {"type": "node", "id": 1, "lat": 45.5, "lon": -73.5, "tags": {"natural": "tree"}},
            {"type": "way", "id": 2, "tags": {"highway": "residential", "name": "Rue Test"},
             "geometry": [{"lat": 45.5, "lon": -73.5}, {"lat": 45.501, "lon": -73.5}]},
            {"type": "relation", "id": 3, "tags": {"natural": "water"},
             "members": [{"type": "way", "role": "outer", "geometry": [{"lat": 45.5, "lon": -73.5}, {"lat": 45.5001, "lon": -73.5}]}]},
        ]}
        els = osm.parse_overpass_json(doc)
        self.assertEqual([e["type"] for e in els], ["node", "way", "relation"])
        self.assertIn("way[\"building\"]", osm.overpass_query((45.5, -73.6, 45.6, -73.5)))
        self.assertEqual(osm.parse_latlon("45.5, -73.6"), (45.5, -73.6))
        self.assertIsNone(osm.parse_latlon("Montréal"))


if __name__ == "__main__":
    unittest.main()
