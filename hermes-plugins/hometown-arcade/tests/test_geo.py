import math
import unittest

from helpers import sub

geo = sub("geo")


def tri_area(ring, idx):
    total = 0.0
    for i in range(0, len(idx), 3):
        a, b, c = ring[idx[i]], ring[idx[i + 1]], ring[idx[i + 2]]
        total += ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
    return total


class GeoTest(unittest.TestCase):
    def test_projection_round_trip(self):
        p = geo.Projection(45.5268, -73.5698)
        x, y = p.xy(45.5300, -73.5650)
        lat, lon = p.latlon(x, y)
        self.assertAlmostEqual(lat, 45.5300, places=7)
        self.assertAlmostEqual(lon, -73.5650, places=7)
        self.assertAlmostEqual(y, (45.5300 - 45.5268) * 111320, delta=0.01)

    def test_triangulate_concave_ring_covers_its_area(self):
        ring = [(0, 0), (10, 0), (10, 10), (6, 10), (6, 4), (4, 4), (4, 10), (0, 10)]  # a U shape
        idx = geo.triangulate(ring)
        self.assertEqual(len(idx) % 3, 0)
        self.assertEqual(len(idx) // 3, len(ring) - 2)
        self.assertAlmostEqual(tri_area(ring, idx), abs(geo.signed_area(ring)), places=6)

    def test_triangulate_clockwise_ring_gives_ccw_triangles(self):
        ring = [(0, 0), (0, 5), (5, 5), (5, 0)]
        idx = geo.triangulate(ring)
        self.assertAlmostEqual(tri_area(ring, idx), 25.0)

    def test_triangulate_bad_ring_still_returns_triangles(self):
        bow = [(0, 0), (4, 4), (4, 0), (0, 4)]  # self-crossing
        self.assertEqual(len(geo.triangulate(bow)) % 3, 0)
        self.assertEqual(geo.triangulate([(0, 0), (1, 1)]), [])

    def test_clip_polyline_keeps_pieces_inside(self):
        box = (-10, -10, 10, 10)
        pieces = geo.clip_polyline([(-20, 0), (0, 0), (20, 0)], box)
        self.assertEqual(len(pieces), 1)
        self.assertAlmostEqual(pieces[0][0][0], -10)
        self.assertAlmostEqual(pieces[0][-1][0], 10)
        out_and_back = geo.clip_polyline([(-5, 0), (-5, 30), (5, 30), (5, 0)], box)
        self.assertEqual(len(out_and_back), 2)
        self.assertEqual(geo.clip_polyline([(20, 20), (30, 30)], box), [])

    def test_clip_ring_to_box(self):
        ring = geo.clip_ring([(-20, -20), (20, -20), (20, 20), (-20, 20)], (-5, -5, 5, 5))
        self.assertAlmostEqual(abs(geo.signed_area(ring)), 100.0)

    def test_join_ways_closes_split_multipolygon(self):
        a = [(0, 0), (10, 0), (10, 10)]
        b = [(0, 0), (0, 10), (10, 10)]  # reversed direction on purpose
        rings = geo.join_ways([a, b])
        self.assertEqual(len(rings), 1)
        self.assertAlmostEqual(abs(geo.signed_area(rings[0])), 100.0)

    def test_simplify_drops_collinear_points(self):
        line = [(0, 0), (1, 0.01), (2, 0), (3, 0.01), (4, 0)]
        self.assertEqual(geo.simplify(line, 0.1), [(0, 0), (4, 0)])

    def test_point_in_ring(self):
        sq = [(0, 0), (4, 0), (4, 4), (0, 4)]
        self.assertTrue(geo.point_in_ring((2, 2), sq))
        self.assertFalse(geo.point_in_ring((5, 2), sq))
        self.assertAlmostEqual(geo.distance_to_segment((2, 3), (0, 0), (4, 0)), 3.0)
        self.assertAlmostEqual(math.dist(geo.centroid(sq), (2, 2)), 0.0)


if __name__ == "__main__":
    unittest.main()
