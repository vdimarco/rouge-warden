"""Plateau species trees: Weber & Penn branching, autumn leaf cards and a bark texture (stdlib Python).

Run from games/nord-unreal:
    python3 Scripts/blender/plateau_trees.py --no-render     # OBJs, textures and manifest (stdlib only, ~30 s)
    <blender-python> Scripts/blender/plateau_trees.py        # the same, then the Cycles contact sheet (~4 min)
    python3 Scripts/test_plateau_tree_kinds.py               # checks; --rebuild also builds twice and compares bytes

Writes Data/Plateau/ReplicaGeometry/Trees/: one OBJ per kind (norway_maple, silver_maple, honey_locust, linden,
ash, elm, small, conifer, larch) with two material groups (usemtl <kind>_bark and <kind>_leaves) and a mtllib line
naming its Tree_<model>.mtl (the two newmtl names, so an importer that reads the library names the same slots), and
for every kind but small a young tree (Tree_<kind>_young.obj: a nursery tree a few years after planting, single
leader; a street tree's crown is raised to 2.1 m, a lawn conifer keeps its low branches), the autumn leaf atlas and
the bark texture (three PNG maps each, in the Scripts/plateau_textures.py format) and manifest.json in the shared
Trees format {kinds: {kind: {obj, materials {bark, leaves}, height_cm, trunk_cm, ..., young {obj, materials,
height_cm, trunk_cm, ...}}}, materials, texture_sets}. The contact sheet goes to
Preview/Replica/trees_contact_sheet.png.

The conifer kind stands for the inventory's pines, spruces, firs, cedars and hemlocks (Pinus, Picea, Abies, Thuja,
Tsuga), the larch kind for its tamaracks and European larches (Larix). Both are Weber & Penn's conical shape 0 on
one leader to the top. Their limbs grow in whorls, as in the Branch Rings option of Blender's Sapling add-on
(add_curve_sapling/utils.py snaps the trunk's child points to nrings heights). The low whorls sweep down and their
tips turn up (nCurve, then nCurveBack), and the laterals lie flat, alternately left and right, as spruce sprays do.
Needle-cluster cards cover the twigs and the outer limbs. The conifer stays dark green, with a few old inner needles
yellowing. The larch is gold in late October and has dropped a quarter of its needles. Its cards show short-shoot
rosettes. Daniel Wesslén and Stefan Seipel adapted Weber & Penn to spruce and pine in "The Virtual Forest" (SIGRAD
2004, https://ep.liu.se/ecp/013/016/ecp01316.pdf); their health parameter, which drops leaves at random, is this
generator's leaf_retention.

The elm kind is the vase: American elm (Ulmus americana) and the other elms, and hackberry (Celtis occidentalis),
whose crowns the city prunes the same way. Its trunk forks low into five ascending leaders that keep their angle
(Weber & Penn clones with almost no AttractionUp), its limbs follow the inverse-conical ShapeRatio (long at the top,
short low down, so the crown is wide at the top and narrow at the fork) and arch out, and its twigs droop (negative
AttractionUp): the vase form botanists describe, "the trunk divides into several erect limbs strongly arched above
and terminating in numerous slender, pendulous branchlets" (Lady Bird Johnson Wildflower Center, Ulmus americana,
https://www.wildflower.org/plants/result.php?id_plant=ULAM; Flora of North America and the Minnesota DNR say the
same), built from the Weber & Penn parameters below. The young kinds stand for the inventory's new plantings (a 5 cm
trunk, about 4.3 m tall by research-plateau.md 10.4): the same species, leaves and bark, smaller cards, a single
leader and a crown raised clear of the sidewalk.

Technique. The branching is the parametric model of Weber and Penn, "Creation and Rendering of Realistic Trees"
(SIGGRAPH 1995), the model Blender's Sapling add-on implements (Sapling is not bundled with the bpy 5.1 module,
so the recursion is written here): a trunk with a flared, tapered radius, optional clones (trunk splits into
leaders), and recursive child stems whose number, length (the ShapeRatio crown envelope), radius (RatioPower),
down angle (with the negative-variation rule that tilts low limbs down and high ones up), helical or opposite
rotation, curvature and AttractionUp follow the paper's formulas. Leaves are the last level, as in the paper,
but each leaf is a folded cluster card (a twig with 2-14 leaves) cut out of an alpha-masked atlas, the way
SpeedTree and game foliage use leaf cards; the card normals are bent toward the crown's ellipsoid normal and
kept from pointing fully down, after SpeedTree's leaf "puffiness" and normal-range settings, and every card's
front faces out of the crown. Crowns are pruned up: no limb starts below the clearance and no branch dips under
it, as the borough prunes street trees over sidewalks. Late October: most leaves have turned yellow to orange,
some red, the inner and lower ones stay greener longer, and many have fallen (leaf_retention keeps a share of
the cards; sparse cards show bare twigs). The atlas and the bark are painted with the plateau_textures.py
primitives (serrated leaflets from signed distances, Worley cells), so the textures are generated, not scanned.
The silver maple's five deep lobes join over a central blade: the lobes' signed distances and an ellipse round the
leaf base are merged with Inigo Quilez's polynomial smooth minimum (https://iquilezles.org/articles/smin), so the
sinuses end in a rounded crease two thirds of the way in instead of running to the petiole.

Axes: centimetres, x east, y north, z up, pivot at the trunk base. The OBJ stores Blender/game-local (x, y, z)
unchanged (the Scripts/blender/plateau_props.py convention); Unreal's OBJ import flips Y, which a tree does not
mind. Manifest bounds are Unreal-local (x, -y, z). Leaf UVs address the atlas (0..1, v up, OBJ convention);
bark UVs are metres (u around the stem in whole bark tiles, v along it).
"""
import argparse
import hashlib
import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT / 'Scripts') not in sys.path:
    sys.path.insert(0, str(ROOT / 'Scripts'))
import plateau_textures as PT  # noqa: E402  (stdlib texture primitives: Canvas, leaflet, cells, PNG writer)

LAYER = 'Trees'
OUT = ROOT / 'Data/Plateau/ReplicaGeometry/Trees'
SHEET = ROOT / 'Preview/Replica/trees_contact_sheet.png'
SHEET_GRID = (6, 2)          # contact sheet tiles (400 x 500 px): the kinds, the young trees, a street row, the atlas
GENERATOR = 'Scripts/blender/plateau_trees.py'
KINDS = ('norway_maple', 'silver_maple', 'honey_locust', 'linden', 'ash', 'elm', 'small', 'conifer', 'larch')
MATURE = tuple(k for k in KINDS if k != 'small')
CONIFERS = ('conifer', 'larch')     # whorled cones with needle cards; the conifer is evergreen, the larch turns gold
# Plex yard-tree kinds that are not species: maple is the Norway maple. (elm was linden until the vase kind came.)
ALIASES = {'maple': 'norway_maple'}
TRIANGLE_TARGET = {'mature': 30000, 'small': 15000, 'young': 8000}
YOUNG = '_young'           # model name suffix of a kind's young street tree
UP = (0., 0., 1.)

# ------------------------------------------------------------------------------------------------ species
# Weber & Penn parameters per kind, in the paper's names where one exists (levels[n] is level n + 1: limbs,
# then branchlets that carry the leaf cards). Heights, trunk diameters at 1.3 m (DBH) and pruning follow mature
# Plateau street and yard trees: 12-18 m, trunks 25-60 cm, crowns raised to about 3 m; the small kind is a
# yard tree (Amur maple or serviceberry type). Leaf colour cells and retention are for late October.
SPECIES = {
    'norway_maple': {
        'name': 'Norway maple (Acer platanoides)', 'seed': 4101, 'height_cm': 1450., 'dbh_cm': 48., 'prune_cm': 300.,
        'shape': 1, 'flare': .55, 'ratio_power': 1.25, 'lean_deg': 2.5,
        'trunk': {'split_cm': 450., 'leaders': 3, 'split_angle': 31., 'split_angle_v': 7., 'curve_v': 6.,
                  'leader_res': 6, 'leader_attraction': .25, 'leader_curve_v': 14., 'sides': 14},
        'levels': [
            {'length': .6, 'length_v': .08, 'branches': 24, 'down': 68., 'down_v': -24., 'rotate': 140., 'rotate_v': 35.,
             'curve_res': 6, 'curve': -6., 'curve_back': 0., 'curve_v': 30., 'attraction': .32, 'sides': 7},
            {'length': .46, 'length_v': .1, 'branches': 13, 'down': 48., 'down_v': 14., 'rotate': 140., 'rotate_v': 30.,
             'curve_res': 4, 'curve': 0., 'curve_back': 0., 'curve_v': 40., 'attraction': .12, 'sides': 4},
        ],
        'leaves': {'cards': 10, 'retention': .8, 'card_cm': 62., 'down': 52., 'down_v': 22., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 32.,
                   'cells': {'nm_yellow': .38, 'nm_mixed': .3, 'nm_green': .16, 'nm_sparse': .16}},
        'bark': {'colour': '#5E564D', 'note': 'grey-brown, shallow interlacing ridges'},
    },
    'silver_maple': {
        'name': 'Silver maple (Acer saccharinum)', 'seed': 4202, 'height_cm': 1700., 'dbh_cm': 58., 'prune_cm': 330.,
        'shape': 7, 'flare': .6, 'ratio_power': 1.2, 'lean_deg': 3.,
        'trunk': {'split_cm': 270., 'leaders': 3, 'split_angle': 29., 'split_angle_v': 6., 'curve_v': 5.,
                  'leader_res': 7, 'leader_attraction': .22, 'leader_curve_v': 12., 'sides': 14},
        'levels': [
            {'length': .42, 'length_v': .08, 'branches': 27, 'down': 50., 'down_v': -18., 'rotate': 140., 'rotate_v': 40.,
             'curve_res': 6, 'curve': 12., 'curve_back': 0., 'curve_v': 28., 'attraction': .2, 'sides': 7},
            {'length': .5, 'length_v': .1, 'branches': 12, 'down': 56., 'down_v': 15., 'rotate': 140., 'rotate_v': 30.,
             'curve_res': 4, 'curve': 14., 'curve_back': 0., 'curve_v': 30., 'attraction': -.35, 'sides': 4},
        ],
        'leaves': {'cards': 9, 'retention': .62, 'card_cm': 62., 'down': 60., 'down_v': 22., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 35., 'cells': {'sm_yellow': .4, 'sm_orange': .3, 'sm_sparse': .3}},
        'bark': {'colour': '#8A857C', 'note': 'light grey, long loose plates on old trunks'},
    },
    'honey_locust': {
        'name': 'Thornless honey locust (Gleditsia triacanthos var. inermis)', 'seed': 4303, 'height_cm': 1350.,
        'dbh_cm': 40., 'prune_cm': 320., 'shape': 2, 'flare': .45, 'ratio_power': 1.3, 'lean_deg': 3.5,
        'trunk': {'split_cm': 390., 'leaders': 2, 'split_angle': 31., 'split_angle_v': 6., 'curve_v': 8.,
                  'leader_res': 6, 'leader_attraction': .2, 'leader_curve_v': 16., 'sides': 13},
        'levels': [
            {'length': .56, 'length_v': .08, 'branches': 18, 'down': 66., 'down_v': -20., 'rotate': 140., 'rotate_v': 40.,
             'curve_res': 6, 'curve': -10., 'curve_back': 0., 'curve_v': 34., 'attraction': .3, 'sides': 7},
            {'length': .46, 'length_v': .1, 'branches': 11, 'down': 50., 'down_v': 15., 'rotate': 140., 'rotate_v': 30.,
             'curve_res': 4, 'curve': 0., 'curve_back': 0., 'curve_v': 40., 'attraction': .05, 'sides': 4},
        ],
        'leaves': {'cards': 7, 'retention': .46, 'card_cm': 70., 'down': 50., 'down_v': 25., 'rotate': 137.5,
                   'rotate_v': 15., 'twist_v': 40., 'cells': {'hl_gold': .55, 'hl_sparse': .45}},
        'bark': {'colour': '#4D433B', 'note': 'dark grey-brown, scaly plates'},
    },
    'linden': {
        'name': 'Linden (Tilia cordata / T. americana)', 'seed': 4404, 'height_cm': 1400., 'dbh_cm': 42.,
        'prune_cm': 300., 'shape': 7, 'flare': .45, 'ratio_power': 1.3, 'lean_deg': 1.5,
        'trunk': {'split_cm': None, 'leaders': 1, 'curve_v': 4., 'sides': 13},
        'levels': [
            {'length': .4, 'length_v': .06, 'branches': 32, 'down': 58., 'down_v': -20., 'rotate': 140., 'rotate_v': 20.,
             'curve_res': 6, 'curve': -8., 'curve_back': 0., 'curve_v': 22., 'attraction': .5, 'sides': 7},
            {'length': .46, 'length_v': .1, 'branches': 12, 'down': 50., 'down_v': 12., 'rotate': 140., 'rotate_v': 25.,
             'curve_res': 4, 'curve': 0., 'curve_back': 0., 'curve_v': 30., 'attraction': .18, 'sides': 4},
        ],
        'leaves': {'cards': 9, 'retention': .64, 'card_cm': 50., 'down': 52., 'down_v': 20., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 30., 'cells': {'li_yellow': .56, 'li_mixed': .44}},
        'bark': {'colour': '#6A6157', 'note': 'grey-brown, narrow vertical ridges'},
    },
    'ash': {
        'name': 'Green ash (Fraxinus pennsylvanica)', 'seed': 4505, 'height_cm': 1550., 'dbh_cm': 44.,
        'prune_cm': 310., 'shape': 1, 'flare': .45, 'ratio_power': 1.25, 'lean_deg': 2.,
        'trunk': {'split_cm': 560., 'leaders': 2, 'split_angle': 22., 'split_angle_v': 5., 'curve_v': 5.,
                  'leader_res': 6, 'leader_attraction': .3, 'leader_curve_v': 12., 'sides': 13},
        'levels': [
            {'length': .45, 'length_v': .07, 'branches': 22, 'opposite': True, 'down': 56., 'down_v': -20.,
             'rotate': 90., 'rotate_v': 15., 'curve_res': 6, 'curve': -6., 'curve_back': 0., 'curve_v': 22.,
             'attraction': .5, 'sides': 7},
            {'length': .42, 'length_v': .1, 'branches': 10, 'opposite': True, 'down': 46., 'down_v': 10.,
             'rotate': 90., 'rotate_v': 15., 'curve_res': 4, 'curve': 0., 'curve_back': 0., 'curve_v': 25.,
             'attraction': .3, 'sides': 4},
        ],
        'leaves': {'cards': 9, 'retention': .5, 'card_cm': 80., 'down': 48., 'down_v': 20., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 30., 'cells': {'as_yellow': .55, 'as_maroon': .15, 'as_sparse': .3}},
        'bark': {'colour': '#77726A', 'note': 'grey, interlacing diamond ridges'},
    },
    'elm': {
        # The vase: a low fork into five ascending leaders that hold their angle (little AttractionUp), limbs
        # longest high on the leaders (inverse-conical ShapeRatio 6) arching out (positive curve), twigs drooping
        # (negative AttractionUp). Elms and hackberries drop early: by late October half the leaves are down.
        'name': 'Elm and hackberry, vase form (Ulmus americana, U. pumila, Celtis occidentalis)', 'seed': 4707,
        'height_cm': 1650., 'dbh_cm': 52., 'prune_cm': 320., 'shape': 6, 'flare': .6, 'ratio_power': 1.2,
        'lean_deg': 2.,
        'trunk': {'split_cm': 380., 'leaders': 5, 'split_angle': 31., 'split_angle_v': 5., 'curve_v': 4.,
                  'leader_res': 7, 'leader_attraction': -.03, 'leader_curve_v': 8., 'sides': 14},
        'levels': [
            {'length': .42, 'length_v': .06, 'branches': 30, 'down': 44., 'down_v': -12., 'rotate': 140., 'rotate_v': 35.,
             'curve_res': 6, 'curve': 24., 'curve_back': 0., 'curve_v': 22., 'attraction': -.1, 'sides': 7},
            {'length': .5, 'length_v': .1, 'branches': 14, 'down': 50., 'down_v': 14., 'rotate': 140., 'rotate_v': 30.,
             'curve_res': 4, 'curve': 20., 'curve_back': 0., 'curve_v': 30., 'attraction': -.5, 'sides': 4},
        ],
        'leaves': {'cards': 12, 'retention': .6, 'card_cm': 64., 'down': 58., 'down_v': 22., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 34., 'cells': {'el_yellow': .5, 'el_mixed': .25, 'el_sparse': .25}},
        'bark': {'colour': '#665D55', 'note': 'dark grey-brown, deep interlacing ridges (elm), corky warts (hackberry)'},
    },
    'small': {
        'name': 'Small yard tree (Amur maple / serviceberry type)', 'seed': 4606, 'height_cm': 650., 'dbh_cm': 17.,
        'prune_cm': 160., 'shape': 1, 'flare': .35, 'ratio_power': 1.25, 'lean_deg': 3.,
        'trunk': {'split_cm': 115., 'leaders': 3, 'split_angle': 30., 'split_angle_v': 8., 'curve_v': 6.,
                  'leader_res': 5, 'leader_attraction': .2, 'leader_curve_v': 16., 'sides': 10},
        'levels': [
            {'length': .5, 'length_v': .08, 'branches': 20, 'down': 56., 'down_v': -20., 'rotate': 140., 'rotate_v': 35.,
             'curve_res': 5, 'curve': -6., 'curve_back': 0., 'curve_v': 30., 'attraction': .35, 'sides': 6},
            {'length': .46, 'length_v': .1, 'branches': 9, 'down': 46., 'down_v': 15., 'rotate': 140., 'rotate_v': 30.,
             'curve_res': 3, 'curve': 0., 'curve_back': 0., 'curve_v': 35., 'attraction': .12, 'sides': 4},
        ],
        'leaves': {'cards': 8, 'retention': .66, 'card_cm': 44., 'down': 52., 'down_v': 22., 'rotate': 137.5,
                   'rotate_v': 12., 'twist_v': 32., 'cells': {'sx_red': .5, 'sx_orange': .5}},
        'bark': {'colour': '#6E655B', 'note': 'smooth grey-brown'},
    },
    'conifer': {
        # Weber & Penn shape 0 (conical) on one leader. Level 1 grows in whorls (Sapling's Branch Rings): about
        # five limbs a ring, each ring turned by about the golden angle. The negative DownAngleV gives low limbs
        # about 115 degrees and high ones about 70. nCurve then nCurveBack droops a limb and turns its tip up.
        # The laterals are planar, so each limb ends in a flat spray. Cards sit on the twigs and the outer limbs.
        # Park conifers are limbed up to about 2 m for mowing and sight lines. Pines shed some inner needles in
        # October.
        'name': 'Conifer: pine, spruce, fir, cedar and hemlock (Pinus nigra, P. sylvestris, Picea glauca, '
                'P. pungens, Abies, Thuja occidentalis, Tsuga canadensis)', 'seed': 4808,
        'height_cm': 1400., 'dbh_cm': 38., 'prune_cm': 190., 'shape': 0, 'flare': .45, 'ratio_power': 1.3,
        'lean_deg': 1.,
        'trunk': {'split_cm': None, 'leaders': 1, 'curve_v': 2., 'sides': 12},
        'levels': [
            {'length': .27, 'length_v': .03, 'branches': 80, 'whorls': 16, 'down': 88., 'down_v': -28.,
             'rotate': 137.5, 'rotate_v': 16., 'curve_res': 5, 'curve': 24., 'curve_back': -36., 'curve_v': 12.,
             'attraction': .06, 'sides': 5},
            {'length': .4, 'length_v': .08, 'branches': 6, 'planar': True, 'down': 56., 'down_v': 10.,
             'rotate': 180., 'rotate_v': 14., 'curve_res': 3, 'curve': 0., 'curve_back': 0., 'curve_v': 16.,
             'attraction': .04, 'sides': 3},
        ],
        'leaves': {'cards': 8, 'limb_cards': 10, 'retention': .94, 'card_cm': 70., 'down': 28., 'down_v': 14.,
                   'rotate': 137.5, 'rotate_v': 25., 'twist_v': 16.,
                   'cells': {'cf_spruce': .3, 'cf_pine': .32, 'cf_blue': .2, 'cf_inner': .18}},
        'bark': {'colour': '#56483F',
                 'note': 'dark grey-brown, furrowed plates (Austrian pine) and thin scales (spruce)'},
    },
    'larch': {
        # The same whorled cone, more open: fewer limbs, held nearer level, branchlets that hang (negative
        # AttractionUp) and short-shoot rosettes of gold needles. Tamaracks turn in late October and drop their
        # needles into November, so a quarter are down.
        'name': 'Larch, gold in late October (Larix laricina, L. decidua)', 'seed': 4909, 'height_cm': 1450.,
        'dbh_cm': 34., 'prune_cm': 220., 'shape': 0, 'flare': .4, 'ratio_power': 1.3, 'lean_deg': 1.5,
        'trunk': {'split_cm': None, 'leaders': 1, 'curve_v': 3., 'sides': 12},
        'levels': [
            {'length': .25, 'length_v': .05, 'branches': 56, 'whorls': 14, 'down': 84., 'down_v': -22.,
             'rotate': 137.5, 'rotate_v': 24., 'curve_res': 5, 'curve': 12., 'curve_back': -18., 'curve_v': 16.,
             'attraction': .04, 'sides': 5},
            {'length': .48, 'length_v': .1, 'branches': 6, 'down': 58., 'down_v': 14., 'rotate': 140.,
             'rotate_v': 30., 'curve_res': 3, 'curve': 10., 'curve_back': 0., 'curve_v': 24., 'attraction': -.3,
             'sides': 3},
        ],
        'leaves': {'cards': 10, 'limb_cards': 8, 'retention': .74, 'card_cm': 64., 'down': 36., 'down_v': 18.,
                   'rotate': 137.5, 'rotate_v': 25., 'twist_v': 24.,
                   'cells': {'lx_gold': .5, 'lx_amber': .3, 'lx_sparse': .2}},
        'bark': {'colour': '#6A4F42', 'note': 'reddish brown, thin flaking scales'},
    },
}

# Young street trees: the inventory's new plantings (DHP 5 cm, about 4.3 m), one per mature kind. A nursery tree a
# few years in the ground: one straight leader, no fork, a narrow crown raised to 2.1 m over the sidewalk, fewer and
# shorter limbs, smaller leaf cards; the species' own leaf cells, retention and bark. Crown shape per kind.
YOUNG_SHAPE = {'norway_maple': 7, 'silver_maple': 7, 'honey_locust': 2, 'linden': 0, 'ash': 7, 'elm': 4,
               'conifer': 0, 'larch': 0}
# A young conifer is a nursery tree on a lawn: the same whorled cone at 5 m, furnished almost to the ground, as
# nursery spruces, pines and larches are. These replace the mature kind's values.
YOUNG_CONIFER = {
    'conifer': {'prune_cm': 45., 'l1': {'length': .32, 'branches': 44, 'whorls': 11, 'curve_res': 4, 'sides': 4},
                'l2': {'length': .42, 'branches': 4}, 'leaves': {'cards': 7, 'limb_cards': 9}},
    'larch': {'prune_cm': 55., 'l1': {'length': .24, 'branches': 33, 'whorls': 10, 'curve_res': 4, 'sides': 4},
              'l2': {'length': .48, 'branches': 4}, 'leaves': {'cards': 9, 'limb_cards': 8}},
}


def young_species(kind):
    P = SPECIES[kind]
    l1, l2 = P['levels']
    if kind in YOUNG_CONIFER:
        Y = YOUNG_CONIFER[kind]
        return {'name': P['name'] + ', young', 'seed': P['seed'] + 50, 'height_cm': 500., 'dbh_cm': 7.,
                'prune_cm': Y['prune_cm'], 'shape': YOUNG_SHAPE[kind], 'flare': .25, 'ratio_power': 1.3,
                'lean_deg': .5, 'trunk': {'split_cm': None, 'leaders': 1, 'curve_v': 2., 'sides': 8},
                'levels': [dict(l1, **Y['l1']), dict(l2, **Y['l2'])],
                'leaves': dict(P['leaves'], card_cm=round(P['leaves']['card_cm'] * .5, 1), **Y['leaves']),
                'bark': P['bark'], 'mature': kind}
    return {'name': P['name'] + ', young street tree', 'seed': P['seed'] + 50, 'height_cm': 500., 'dbh_cm': 7.,
            'prune_cm': 210., 'shape': YOUNG_SHAPE[kind], 'flare': .25, 'ratio_power': 1.3, 'lean_deg': 1.,
            'trunk': {'split_cm': None, 'leaders': 1, 'curve_v': 3., 'sides': 8},
            'levels': [dict(l1, length=.34, branches=14, curve_res=4, sides=5, attraction=max(.2, l1['attraction'])),
                       dict(l2, length=.44, branches=7, curve_res=3, sides=3)],
            'leaves': dict(P['leaves'], card_cm=round(P['leaves']['card_cm'] * .6, 1)),
            'bark': P['bark'], 'mature': kind}


YOUNG_KINDS = tuple(k for k in KINDS if k in YOUNG_SHAPE)
SPECIES.update({k + YOUNG: young_species(k) for k in YOUNG_KINDS})
MODELS = KINDS + tuple(k + YOUNG for k in YOUNG_KINDS)     # every mesh the generator writes


def kind_of(model):
    """The kind a model belongs to: the kind itself, or the mature kind of a young model."""
    return SPECIES[model].get('mature', model)


def target_of(model):
    return TRIANGLE_TARGET['young' if model.endswith(YOUNG) else 'small' if model == 'small' else 'mature']

LEAF_KEY = 'Tree_Leaves_Autumn'
PUFFINESS = .55          # card normal -> crown ellipsoid normal blend (SpeedTree's leaf "puffiness")
MIN_NORMAL_Z = -.3       # no card normal points further down than this (SpeedTree's normal range)
FOLD = .14               # card centre line raised by this share of the card width: a shallow V
MIN_RADIUS_CM = .45
CARD_HANG_CM = 25.      # no leaf card corner hangs more than this below the pruned height

# ------------------------------------------------------------------------------------------------ vectors


def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def length(a):
    return math.sqrt(dot(a, a))


def norm(a):
    n = length(a)
    return (a[0] / n, a[1] / n, a[2] / n) if n > 1e-12 else (0., 0., 1.)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def rotate(v, k, angle):
    """Rodrigues: v rotated by angle (radians) about the unit axis k (right-handed)."""
    c, s = math.cos(angle), math.sin(angle)
    kv = cross(k, v)
    kd = dot(k, v) * (1. - c)
    return (v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd)


def rotate_frame(frame, k, angle):
    return tuple(rotate(v, k, angle) for v in frame)


def bend_toward_up(frame, angle):
    """Rotate a frame so its z turns toward world up by angle (radians; negative droops)."""
    z = frame[2]
    axis = cross(z, UP)
    if length(axis) < 1e-9:
        if z[2] > 0.:
            return frame                  # already vertical
        axis = frame[0]                   # straight down: any horizontal axis turns it up
    return rotate_frame(frame, norm(axis), angle)


# ------------------------------------------------------------------------------------------------ Weber & Penn


def shape_ratio(shape, ratio):
    """Weber & Penn's ShapeRatio(shape, ratio) for the predefined crown shapes 0-7 (Table 1 of the paper)."""
    ratio = min(1., max(0., ratio))
    if shape == 0:      # conical
        return .2 + .8 * ratio
    if shape == 1:      # spherical
        return .2 + .8 * math.sin(math.pi * ratio)
    if shape == 2:      # hemispherical
        return .2 + .8 * math.sin(.5 * math.pi * ratio)
    if shape == 3:      # cylindrical
        return 1.
    if shape == 4:      # tapered cylindrical
        return .5 + .5 * ratio
    if shape == 5:      # flame
        return ratio / .7 if ratio <= .7 else (1. - ratio) / .3
    if shape == 6:      # inverse conical
        return 1. - .8 * ratio
    if shape == 7:      # tend flame
        return .5 + .5 * ratio / .7 if ratio <= .7 else .5 + .5 * (1. - ratio) / .3
    raise ValueError(shape)


def flare_factor(flare, t):
    """Weber & Penn trunk flare: flareZ = Flare * (100^y - 1) / 100 + 1 with y = 1 - 8 Z, clamped at 0."""
    y = max(0., 1. - 8. * t)
    return flare * (100. ** y - 1.) / 100. + 1.


class Stem:
    """A stem polyline: points[0..res], the frame each segment advanced along, and its radius rule."""

    def __init__(self, level, points, frames, radius_at, parent=None, offset=0., index=0):
        self.level, self.points, self.frames, self._radius = level, points, frames, radius_at
        self.parent, self.offset, self.index = parent, offset, index
        self.seg = [length(sub(b, a)) for a, b in zip(points, points[1:])]
        self.cum = [0.]
        for s in self.seg:
            self.cum.append(self.cum[-1] + s)
        self.length = self.cum[-1]
        self.radius0 = radius_at(0.)
        self.children = 0
        self.t = 0.

    def radius(self, t):
        return self._radius(min(1., max(0., t)))

    def at(self, t):
        """(point, segment frame, radius) at the fraction t of the stem's length."""
        d = min(1., max(0., t)) * self.length
        for i in range(len(self.seg)):
            if d <= self.cum[i + 1] or i == len(self.seg) - 1:
                f = 0. if self.seg[i] < 1e-9 else (d - self.cum[i]) / self.seg[i]
                return lerp(self.points[i], self.points[i + 1], min(1., max(0., f))), self.frames[i], self.radius(t)
        raise AssertionError

    def ring_frame(self, i):
        """The frame of ring i: z mitred between the neighbouring segments, x kept from the segment frame."""
        n = len(self.frames)
        a, b = self.frames[max(0, i - 1)], self.frames[min(n - 1, i)]
        z = norm(add(a[2], b[2]))
        x = norm(sub(b[0], mul(z, dot(b[0], z))))
        return x, cross(z, x), z


def grow(level, origin, frame, length_cm, radius_at, p, rng, floor_z, fractions=None):
    """One Weber & Penn stem: per segment the nCurve / nCurveBack / nCurveV rotation about the stem's x axis,
    then AttractionUp (curve_up = AttractionUp * declination / nCurveRes), then the pruning floor."""
    res = len(fractions) if fractions else p['curve_res']
    fractions = fractions or [1. / res] * res
    pts, frames = [origin], []
    f = frame
    curve, back, var = p.get('curve', 0.), p.get('curve_back', 0.), p.get('curve_v', 0.)
    attraction = p.get('attraction', 0.)
    for i in range(res):
        if back == 0.:
            angle = curve / res
        else:
            angle = (curve if i < res / 2. else back) / (res / 2.)
        angle += (rng.random() * 2. - 1.) * var / res
        f = rotate_frame(f, f[0], math.radians(angle))
        if attraction:
            declination = math.acos(min(1., max(-1., f[2][2])))
            bend = attraction * declination / res
            f = bend_toward_up(f, max(-math.pi + declination, min(declination, bend)))
        seg = length_cm * fractions[i]
        here = pts[-1]
        if floor_z is not None and seg > 1e-6:
            need = (floor_z - here[2]) / seg
            if f[2][2] < need <= 1.:
                f = bend_toward_up(f, math.acos(max(-1., f[2][2])) - math.acos(need))
        frames.append(f)
        pts.append(add(here, mul(f[2], seg)))
    return pts, frames


def child_frame(parent_frame, spin, down):
    """Rotate about the parent's z by spin, then tilt the z away from the parent's z by down (degrees)."""
    f = rotate_frame(parent_frame, parent_frame[2], math.radians(spin))
    return rotate_frame(f, f[0], math.radians(down))


def generate(kind, height=None):
    """The stems and leaf cards of one kind, deterministic from its seed; height overrides the stem length
    scale (build_kind calibrates it so the finished tree, leaves included, stands at height_cm)."""
    P = SPECIES[kind]
    rng = random.Random(P['seed'])
    H, prune, T = height or P['height_cm'], P['prune_cm'], P['trunk']
    clearance = prune - 15.
    bh = breast_height(P)
    t_bh = bh / H
    r_base = P['dbh_cm'] / 2. / ((1. - t_bh) * flare_factor(P['flare'], t_bh))

    def trunk_radius(t_abs):
        return r_base * (1. - t_abs) * flare_factor(P['flare'], t_abs)

    lean_axis = rotate((1., 0., 0.), UP, rng.random() * math.tau)
    frame0 = rotate_frame(((1., 0., 0.), (0., 1., 0.), (0., 0., 1.)), lean_axis, math.radians(P['lean_deg']))
    stems = []
    split = T.get('split_cm')
    trunk_len = split if split else H
    # Rings at the flare, at the 1.3 m breast height (the DBH the manifest records) and evenly above.
    marks = sorted({0., 20., 50., 90., 180.} | {bh})
    marks = [m for m in marks if m <= bh or m < trunk_len - 30.]
    rest = max(1, round((trunk_len - marks[-1]) / 110.))
    marks += [marks[-1] + (trunk_len - marks[-1]) * (i + 1) / rest for i in range(rest)]
    fractions = [(b - a) / trunk_len for a, b in zip(marks, marks[1:])]
    trunk_p = {'curve': 0., 'curve_v': T.get('curve_v', 0.), 'attraction': .0}
    pts, frames = grow(0, (0., 0., 0.), frame0, trunk_len, None, trunk_p, rng, None, fractions)
    # The trunk radius follows the absolute height fraction so that leaders continue its taper.
    trunk = Stem(0, pts, frames, lambda t, L=trunk_len: max(.6, trunk_radius(t * L / H)), offset=0.)
    stems.append(trunk)
    level0 = [trunk]
    if split:
        top, top_frame = pts[-1], frames[-1]
        n = T['leaders']
        r_split = trunk_radius(split / H)
        leader_p = {'curve': 0., 'curve_v': T.get('leader_curve_v', 10.), 'attraction': T.get('leader_attraction', .2),
                    'curve_res': T.get('leader_res', 6)}
        phase = rng.random() * 360.
        for i in range(n):
            angle = T['split_angle'] + (rng.random() * 2. - 1.) * T['split_angle_v']
            f = child_frame(top_frame, phase + i * 360. / n + (rng.random() - .5) * 30., angle)
            remain = (H - split) / math.cos(math.radians(angle * .6))
            r0 = r_split * n ** -.38
            lpts, lframes = grow(0, top, f, remain, None, leader_p, rng, None)
            stems.append(Stem(0, lpts, lframes, lambda t, r0=r0: r0 * (1. - t) + .3, offset=split, index=i + 1))
            level0.append(stems[-1])
    L0 = H
    levels = P['levels']
    # ---- level 1: limbs from the trunk and leaders above the pruned height (paper: 1Branches over the trunk)
    p1 = levels[0]
    spans = []
    for s in level0:
        # Limbs start 20 cm above the pruned height, measured as height on the trunk or a leaning leader.
        a = height_fraction(s, prune + 20.)
        spans.append((s, a, .97 if s is not trunk or not split else 1.))
    usable = [(s, a, b) for s, a, b in spans if b - a > .02]
    total = sum((b - a) * s.length for s, a, b in usable)
    limbs = []
    for s, a, b in usable:
        n = max(1, round(p1['branches'] * (b - a) * s.length / total))
        limbs += spawn(s, n, a, b, 1, p1, P, rng, L0, prune, clearance)
    stems += limbs
    # ---- level 2: branchlets (stems = 2Branches * (0.2 + 0.8 * (length_child / length_parent) / length_max))
    p2 = levels[1]
    twigs = []
    for s in limbs:
        lmax = p1['length'] + p1['length_v']
        ref = H if s.parent.level == 0 else s.parent.length
        n = max(1, round(p2['branches'] * (.2 + .8 * (s.length / ref) / lmax)))
        twigs += spawn(s, n, .25, .98, 2, p2, P, rng, L0, prune, clearance)
    stems += twigs
    cards = leaf_cards(kind, twigs, rng, clearance)
    if P['leaves'].get('limb_cards'):
        # Needles clothe a conifer's limbs too, from a bare inner third out to the tip.
        cards += leaf_cards(kind, limbs, rng, clearance, P['leaves']['limb_cards'])
    return stems, cards


def height_fraction(stem, z):
    """The first fraction of a stem's length at which it reaches height z (1 if it never does)."""
    for i in range(len(stem.seg)):
        z0, z1 = stem.points[i][2], stem.points[i + 1][2]
        if z1 >= z:
            f = 0. if z0 >= z or z1 - z0 < 1e-9 else (z - z0) / (z1 - z0)
            return (stem.cum[i] + f * stem.seg[i]) / stem.length
    return 1.


def spawn(parent, n, a, b, level, p, P, rng, L0, prune, clearance):
    """n children of a stem between the fractions a and b of its length (Weber & Penn child rules)."""
    out = []
    spin = rng.random() * 360.
    opposite = p.get('opposite', False)
    whorls = p.get('whorls') if level == 1 else None
    slots = []
    if whorls:
        # Sapling's Branch Rings (add_curve_sapling/utils.py snaps the trunk's child points to nrings heights): the
        # limbs grow in whorls at even heights, n / whorls a ring give or take one, spread evenly round the stem,
        # each ring turned from the one below by rotate.
        rings = max(1, min(whorls, n))
        for k in range(rings):
            t = a + (b - a) * (k + .5 + (rng.random() - .5) * .3) / rings
            count = max(2, round(n / rings + (rng.random() - .5) * 2.))
            spin += p['rotate'] + (rng.random() * 2. - 1.) * p['rotate_v']
            for j in range(count):
                slots.append((t, spin + j * 360. / count + (rng.random() - .5) * p['rotate_v']))
    elif p.get('planar'):
        # Spruce and fir laterals: alternately left and right of their limb, in its plane (a spin of 90 degrees
        # turns the limb's horizontal x axis into the tilt axis), so the limb ends in a flat spray.
        spin = 90. + (rng.random() - .5) * 20.
        for k in range(n):
            t = a + (b - a) * (k + .5 + (rng.random() - .5) * .7) / n
            spin += p['rotate'] + (rng.random() * 2. - 1.) * p['rotate_v']
            slots.append((t, spin))
    elif opposite:
        pairs = max(1, (n + 1) // 2)
        for k in range(pairs):
            t = a + (b - a) * (k + .5 + (rng.random() - .5) * .5) / pairs
            spin += p['rotate'] + (rng.random() * 2. - 1.) * p['rotate_v']
            slots += [(t, spin), (t, spin + 180. + (rng.random() - .5) * 20.)]
        slots = slots[:max(n, 1)]
    else:
        for k in range(n):
            t = a + (b - a) * (k + .5 + (rng.random() - .5) * .7) / n
            spin += p['rotate'] + (rng.random() * 2. - 1.) * p['rotate_v']
            slots.append((t, spin))
    for t, angle in slots:
        t = min(b, max(a, t))
        point, frame, r_here = parent.at(t)
        offset_abs = parent.offset + t * parent.length          # metres of stem below this child (paper: offset)
        if level == 1:
            ratio = (L0 - offset_abs) / (L0 - prune)
            lmax = p['length'] + (rng.random() * 2. - 1.) * p['length_v']
            child_len = L0 * lmax * shape_ratio(P['shape'], ratio)
            parent_len = L0
        else:
            lmax = p['length'] + (rng.random() * 2. - 1.) * p['length_v']
            child_len = lmax * (parent.length - .6 * t * parent.length)
            parent_len = parent.length
        if child_len < 8.:
            continue
        if p['down_v'] >= 0.:
            down = p['down'] + (rng.random() * 2. - 1.) * p['down_v']
        else:
            base = prune if level == 1 else 0.
            span = (parent_len - base) if level == 1 else parent_len
            r = (parent_len - (offset_abs if level == 1 else t * parent.length)) / span if span > 0 else 0.
            down = p['down'] + p['down_v'] * (1. - 2. * shape_ratio(0, r)) + (rng.random() - .5) * 8.
        f = child_frame(frame, angle, down)
        r0 = parent.radius0 * (child_len / parent_len) ** P['ratio_power']
        # Paper: a child is never thicker than its parent where it grows; no twig thinner than MIN_RADIUS_CM either,
        # so the parent's thin tip spawns nothing.
        r0 = min(max(MIN_RADIUS_CM, r0), .82 * r_here)
        if r0 < MIN_RADIUS_CM * .5:
            continue
        # Start on the parent's axis, so the child grows out of the parent's surface.
        pts, frames = grow(level, point, f, child_len, None, p, rng, clearance)
        child = Stem(level, pts, frames, lambda tt, r0=r0: max(.12, r0 * (1. - tt)), parent=parent, offset=0.,
                     index=len(out))
        child.t = t                       # where it grows out of its parent (fraction of the parent's length)
        out.append(child)
        parent.children += 1
    return out


def leaf_cards(kind, twigs, rng, clearance, per_stem=None):
    """Leaf cards along the last level (paper: leaves_per_branch = Leaves * ShapeRatio(4, offset / length_parent)),
    each kept with the kind's late-October retention; per_stem gives every stem that many cards instead (a
    conifer's limbs)."""
    L = SPECIES[kind]['leaves']
    needles = kind_of(kind) in CONIFERS
    cards = []
    for s in twigs:
        # Where the twig sits along its limb (0 at the limb base, 1 at its tip): outer twigs carry more cards.
        n = per_stem if per_stem is not None else round(L['cards'] * shape_ratio(4, s.t))
        phi = rng.random() * 360.
        for j in range(n):
            keep = rng.random() < L['retention']
            t = .3 + .7 * (j + .3 + .5 * rng.random()) / max(1, n)
            phi += L['rotate'] + (rng.random() * 2. - 1.) * L['rotate_v']
            down = L['down'] + (rng.random() * 2. - 1.) * L['down_v']
            twist = (rng.random() * 2. - 1.) * L['twist_v']
            size = L['card_cm'] * (.85 + .3 * rng.random())
            pick = rng.random()
            if not keep:
                continue
            point, frame, r = s.at(t)
            d = child_frame(frame, phi, down)[2]
            base = add(point, mul(d, r * .8))
            if base[2] < clearance + 10.:
                continue
            card = {'base': base, 'dir': d, 'twist': twist, 'size': size, 'pick': pick}
            if needles:
                card['at_base'] = True        # a needle spray faces out of the crown where it joins its twig
            cards.append(card)
    return cards


# ------------------------------------------------------------------------------------------------ atlas cells
# The leaf atlas: 8 x 4 cells of 256 px (2048 x 1024, row-major from the top left; 26 used, the rest left clear for
# later kinds), each a twig with leaves seen face-on, base at the bottom centre. Colours are sRGB; 'stage' is how
# far the cell's leaves have turned (green 0 .. fully turned 1): the inner and lower cards of a crown take the
# greener cells more often, the outer and upper ones the turned cells. A needle cell's stage is its exposure
# instead: the fresh sprays (1) take the outer cards and the old inner needles that yellow before they drop (0.3)
# the sheltered ones, the reverse of a broadleaf.
ATLAS = {'name': 'TreeLeaves', 'key': 'tree_leaves', 'size_px': (2048, 1024), 'cell_px': 256, 'seed': 2611,
         'pad_px': 10}
BARK = {'name': 'TreeBark', 'key': 'tree_bark', 'size_px': (512, 1024), 'tile_m': (1.0, 2.0), 'seed': 2612}
YELLOW = (226., 184., 46.)
GOLD = (232., 176., 34.)
ORANGE = (214., 116., 30.)
RED = (176., 46., 30.)
MAROON = (118., 44., 58.)
GREEN = (98., 124., 46.)
LIME = (166., 160., 48.)
PALE = (228., 200., 92.)
BROWN = (142., 98., 52.)
# Needles: dark Austrian pine and Norway spruce, mid and light green, the glaucous blue-green of Colorado and white
# spruce and Scots pine, an old inner needle yellowing before it drops, and the tamarack's late-October golds.
NEEDLE_DARK = (38., 60., 36.)
NEEDLE = (56., 82., 46.)
NEEDLE_LIGHT = (86., 110., 58.)
GLAUCOUS = (104., 132., 118.)
GLAUCOUS_DARK = (70., 98., 88.)
NEEDLE_OLD = (178., 146., 66.)
LARCH_GOLD = (230., 180., 50.)
LARCH_PALE = (240., 206., 98.)
LARCH_AMBER = (206., 140., 42.)
LARCH_LIME = (186., 174., 72.)
CELLS = {
    # name: (leaf form, leaves, palette [(weight, colour, edge colour, edge amount)], sparse twig, stage)
    'nm_yellow': ('norway', 15, [(.6, YELLOW, ORANGE, .2), (.25, GOLD, BROWN, .25), (.15, LIME, YELLOW, .4)], False, .9),
    'nm_mixed': ('norway', 15, [(.4, YELLOW, YELLOW, 0.), (.35, LIME, YELLOW, .45), (.25, GREEN, YELLOW, .5)], False, .5),
    'nm_green': ('norway', 13, [(.6, GREEN, LIME, .35), (.4, LIME, YELLOW, .4)], False, .15),
    'nm_sparse': ('norway', 3, [(.7, YELLOW, BROWN, .3), (.3, ORANGE, BROWN, .3)], True, 1.),
    'sm_yellow': ('silver', 15, [(.55, PALE, YELLOW, .3), (.3, YELLOW, ORANGE, .3), (.15, LIME, PALE, .3)], False, .8),
    'sm_orange': ('silver', 13, [(.45, ORANGE, RED, .35), (.3, YELLOW, ORANGE, .4), (.25, RED, MAROON, .2)], False, 1.),
    'li_yellow': ('linden', 15, [(.6, YELLOW, BROWN, .2), (.25, PALE, YELLOW, .2), (.15, LIME, YELLOW, .3)], False, .85),
    'li_mixed': ('linden', 14, [(.4, LIME, YELLOW, .4), (.3, YELLOW, BROWN, .3), (.15, GREEN, LIME, .3),
                               (.15, BROWN, BROWN, 0.)], False, .4),
    'as_yellow': ('ash', 5, [(.7, YELLOW, GOLD, .2), (.3, LIME, YELLOW, .4)], False, .8),
    'as_maroon': ('ash', 4, [(.55, MAROON, RED, .3), (.45, YELLOW, MAROON, .4)], False, 1.),
    'as_sparse': ('ash', 1, [(1., YELLOW, BROWN, .3)], True, 1.),
    'hl_gold': ('locust', 5, [(.75, GOLD, YELLOW, .1), (.25, YELLOW, LIME, .2)], False, .9),
    'hl_sparse': ('locust', 2, [(.7, GOLD, BROWN, .2), (.3, LIME, GOLD, .3)], True, .8),
    'sx_red': ('amur', 15, [(.55, RED, MAROON, .3), (.3, ORANGE, RED, .4), (.15, MAROON, RED, .2)], False, 1.),
    'sx_orange': ('amur', 15, [(.5, ORANGE, RED, .4), (.3, YELLOW, ORANGE, .5), (.2, GREEN, ORANGE, .5)], False, .6),
    'sm_sparse': ('silver', 3, [(.6, PALE, BROWN, .3), (.4, YELLOW, ORANGE, .3)], True, 1.),
    # Elms and hackberries turn a clear or dull yellow and drop early.
    'el_yellow': ('elm', 15, [(.6, YELLOW, GOLD, .25), (.25, PALE, YELLOW, .3), (.15, GOLD, BROWN, .3)], False, .85),
    'el_mixed': ('elm', 14, [(.4, LIME, YELLOW, .4), (.35, YELLOW, BROWN, .3), (.25, GREEN, LIME, .3)], False, .45),
    'el_sparse': ('elm', 4, [(.6, YELLOW, BROWN, .35), (.4, BROWN, BROWN, 0.)], True, 1.),
    # Needle cells. The leaves column counts the laterals of a spray, the shoots of a pine tuft and the side shoots
    # of a larch branchlet. The edge colour is the needle tip's.
    'cf_spruce': ('spruce', 10, [(.45, NEEDLE, NEEDLE_LIGHT, .3), (.35, NEEDLE_DARK, NEEDLE, .25),
                                (.2, NEEDLE_LIGHT, NEEDLE_LIGHT, 0.)], False, 1.),
    'cf_blue': ('spruce', 10, [(.55, GLAUCOUS, (138., 160., 140.), .35), (.45, GLAUCOUS_DARK, GLAUCOUS, .3)], False,
                1.),
    'cf_pine': ('pine', 4, [(.5, NEEDLE_DARK, NEEDLE, .35), (.3, NEEDLE, NEEDLE_LIGHT, .3),
                            (.2, GLAUCOUS_DARK, GLAUCOUS, .3)], False, 1.),
    'cf_inner': ('spruce', 6, [(.5, NEEDLE_DARK, NEEDLE, .2), (.3, NEEDLE_OLD, BROWN, .3),
                               (.2, NEEDLE, NEEDLE_OLD, .4)], True, .3),
    'lx_gold': ('larch', 4, [(.55, LARCH_GOLD, LARCH_PALE, .3), (.3, LARCH_PALE, LARCH_GOLD, .2),
                              (.15, LARCH_AMBER, LARCH_GOLD, .3)], False, 1.),
    'lx_amber': ('larch', 4, [(.45, LARCH_AMBER, LARCH_GOLD, .3), (.35, LARCH_GOLD, LARCH_AMBER, .3),
                               (.2, LARCH_LIME, LARCH_GOLD, .3)], False, .7),
    'lx_sparse': ('larch', 1, [(.6, LARCH_GOLD, BROWN, .3), (.4, LARCH_AMBER, BROWN, .3)], True, 1.),
}
CELL_ORDER = list(CELLS)
# Leaf forms: lobes (turn offset, length share, half-width share, teeth) drawn with plateau_textures.leaflet, and
# the leaf length as a share of the cell. A form with a palm joins its lobes over a central blade: an ellipse
# (centre along the midrib, half-width, half-length, as shares of the leaf length) merged with the lobes by a
# smooth minimum of blend x the leaf length (_palmate).
FORMS = {
    'norway': {'size': .26, 'lobes': [(-.24, .42, .27, 3), (.24, .42, .27, 3), (-.12, .8, .3, 3), (.12, .8, .3, 3),
                                     (0., .95, .3, 3)], 'petiole': .45, 'opposite': True},
    # Silver maple: five deep, narrow lobes; the sinuses run two thirds of the way to the base, then the blade is
    # whole (palmately lobed, not compound).
    'silver': {'size': .26, 'lobes': [(-.23, .45, .16, 6), (.23, .45, .16, 6), (-.11, .85, .18, 7), (.11, .85, .18, 7),
                                     (0., 1., .17, 8)], 'palm': (.1, .23, .17), 'blend': .05, 'acute': True,
               'petiole': .5, 'opposite': True},
    'amur': {'size': .25, 'lobes': [(-.1, .52, .22, 6), (.1, .52, .22, 6), (0., 1., .22, 9)], 'petiole': .3,
             'opposite': True},
    'linden': {'size': .24, 'cordate': True, 'petiole': .35, 'opposite': False},
    'ash': {'size': .56, 'pinnate': 3, 'petiole': .08, 'opposite': True},
    'locust': {'size': .52, 'bipinnate': 5, 'petiole': .06, 'opposite': False},
    # Elm: a small ovate, doubly serrate blade with a lopsided base, alternate in two ranks along the twig (two
    # overlapping blades a hair apart in angle and width give the asymmetry).
    'elm': {'size': .24, 'lobes': [(-.012, 1., .27, 11), (.016, .93, .21, 11)], 'petiole': .18, 'opposite': False},
    # Needle forms (_needle_cell), seen from above. needle: the needle length range as shares of the cell. A mature
    # tree's 65-70 cm card is about 3.4 px a cm, so the needles are drawn a little long for it (spruce and larch 3
    # to 4.5 cm, pine 13 to 19 cm) to hold up in the mips. A spruce spray: laterals alternately left and right,
    # longest low down, every twig clothed in needles on both sides and over the top. A pine tuft: a leading shoot
    # and up to three side shoots, each a brush of long needles leaning forward toward a brown bud. A larch
    # branchlet: a long shoot and side shoots with a short shoot every 9 px, each a rosette of 22 to 36 soft needles.
    'spruce': {'needles': 'spray', 'needle': (.04, .058)},
    'pine': {'needles': 'tuft', 'needle': (.18, .25)},
    'larch': {'needles': 'rosette', 'needle': (.042, .062)},
}
NEEDLE_FORMS = tuple(f for f, F in FORMS.items() if 'needles' in F)
COLS, ROWS = ATLAS['size_px'][0] // ATLAS['cell_px'], ATLAS['size_px'][1] // ATLAS['cell_px']
assert len(CELLS) <= COLS * ROWS


def cell_rect(index, cell=ATLAS['cell_px'], size=ATLAS['size_px']):
    """Pixel rectangle (x0, y0, x1, y1) of a cell, row-major from the top left of the image."""
    row, col = divmod(index, size[0] // cell)
    return col * cell, row * cell, (col + 1) * cell, (row + 1) * cell


def cell_uv(index, cell=ATLAS['cell_px'], size=ATLAS['size_px'], pad=ATLAS['pad_px']):
    """OBJ UV rectangle (u0, v0, u1, v1) inside the padding, v up (v0 is the cell's bottom edge, the twig base)."""
    x0, y0, x1, y1 = cell_rect(index, cell, size)
    width, height = size
    return ((x0 + pad) / width, 1. - (y1 - pad) / height, (x1 - pad) / width, 1. - (y0 + pad) / height)


def _pick(palette, x):
    acc = 0.
    for entry in palette:
        acc += entry[0]
        if x < acc:
            return entry
    return palette[-1]


def _petiole(cv, x0, y0, x1, y1, radius, colour, z):
    steps = int(math.hypot(x1 - x0, y1 - y0) / .7) + 1
    for k in range(steps + 1):
        f = k / steps
        PT.disc(cv, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, radius, colour, z, .7)


def _turn(dx, dy):
    """plateau_textures turns of the image direction (dx, dy) (x right, y down)."""
    return (math.atan2(dy, dx) / math.tau) % 1.


def smin(a, b, k):
    """Inigo Quilez's polynomial smooth minimum (https://iquilezles.org/articles/smin): min(a, b) with the crease
    where the two meet rounded over a band of width k."""
    h = min(1., max(0., .5 + .5 * (b - a) / k))
    return b + (a - b) * h - k * h * (1. - h)


def _palmate(cv, x, y, size, turn, colour, edge_colour, edge_amount, blotch, shade, z, F, u, rough=.6, lift=.25,
             vein=(1.18, 1.12, 1.)):
    """A palmately lobed blade from (x, y) toward `turn` (px): the form's lobes, each the plateau_textures.leaflet
    profile with its saw teeth, joined over a central blade (an ellipse round the base) by smin, so each sinus ends
    in a rounded crease. Signed distances in px, negative inside. The edge colour creeps in from the margin and
    toward the lobe tips, and the midribs run lighter to the base, as leaflet paints them."""
    W, H = cv.w, cv.h
    R, G, B, HT, RO, CA, AL = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity, cv.alpha
    lobes = []
    acute = F.get('acute', False)      # lobes widest halfway, tapering straight to a point (t (1 - t))
    for offset, scale, width, teeth in F['lobes']:
        s_, c_ = PT.sin_cos(turn + offset + (u - .5) * .02)
        L = size * scale
        lobes.append((c_, s_, L, 1. / L, width * L * (3.3 if acute else 2.598), teeth))
    along, half_w, half_l = F['palm']
    s0, c0 = PT.sin_cos(turn)
    pcx, pcy = c0 * size * along, s0 * size * along
    rw, rl = size * half_w, size * half_l
    r_min = min(rw, rl)
    k = size * F['blend']
    band = size * .08                  # the margin band the edge colour lives in
    reach = size * max(lobe[1] for lobe in F['lobes']) + 2.
    for py in range(max(0, math.floor(y - reach)), min(H, math.floor(y + reach) + 2)):
        qy = py + .5 - y
        row = py * W
        for px in range(max(0, math.floor(x - reach)), min(W, math.floor(x + reach) + 2)):
            qx = px + .5 - x
            ex, ey = qx - pcx, qy - pcy
            pa, pb = (ex * c0 + ey * s0) / rl, (ey * c0 - ex * s0) / rw
            d = (math.sqrt(pa * pa + pb * pb) - 1.) * r_min
            best, tip, mid = d, 0., 0.
            for dx, dy, L, inv_l, kw, teeth in lobes:
                tl = qx * dx + qy * dy
                s = qy * dx - qx * dy
                s = s if s >= 0. else -s
                t = tl * inv_l
                if t <= 0.:
                    dl = math.sqrt(tl * tl + s * s)
                elif t >= 1.:
                    dl = math.sqrt((tl - L) * (tl - L) + s * s)
                else:
                    w = kw * t * ((1. - t) if acute else math.sqrt(1. - t))
                    if teeth and t > .2:
                        saw = t * teeth
                        w *= 1. - .1 * (saw - math.floor(saw))
                    dl = s - w
                    m = 1. - PT.smooth(0., 1.3, s)
                    if m > mid:
                        mid = m
                if dl < best:
                    best, tip = dl, min(1., max(0., t))
                d = smin(d, dl, k)
            if d >= .5:
                continue
            a = 1. if d <= -.5 else .5 - d
            i = row + px
            rel = 1. - min(1., -d / band) if d < 0. else 1.
            e = edge_amount * PT.smooth(.45, 1., max(rel, tip * tip))
            kk = shade * (1. + .28 * (blotch[i] - .5))
            vr, vg, vb = 1. + (vein[0] - 1.) * mid, 1. + (vein[1] - 1.) * mid, 1. + (vein[2] - 1.) * mid
            cr = (colour[0] + (edge_colour[0] - colour[0]) * e) * kk * vr
            cg = (colour[1] + (edge_colour[1] - colour[1]) * e) * kk * vg
            cb = (colour[2] + (edge_colour[2] - colour[2]) * e) * kk * vb
            hgt = z + lift * (1. - rel * rel) - .05 * mid
            R[i] += (cr - R[i]) * a
            G[i] += (cg - G[i]) * a
            B[i] += (cb - B[i]) * a
            HT[i] += (hgt - HT[i]) * a
            RO[i] += (rough - RO[i]) * a
            CA[i] -= CA[i] * a
            if AL is not None and a > AL[i]:
                AL[i] = a


def _leaf(cv, form, x, y, size, turn, colour, edge, amount, blotch, shade, z, u):
    F = FORMS[form]
    if 'palm' in F:
        _palmate(cv, x, y, size, turn, colour, edge, amount, blotch, shade, z, F, u)
    elif 'lobes' in F:
        for offset, scale, width, teeth in F['lobes']:
            PT.leaflet(cv, x, y, turn + offset + (u - .5) * .02, size * scale, size * scale * width, z, colour, edge,
                       amount, blotch, teeth, .6, shade)
    elif F.get('cordate'):
        s, c = PT.sin_cos(turn)
        tip = (x + c * size, y + s * size)
        for side in (-1., 1.):
            PT.leaflet(cv, tip[0], tip[1], turn + .5 + side * .035, size * 1.04, size * .42, z, colour, edge, amount,
                       blotch, 14, .6, shade)
    elif F.get('pinnate'):
        s, c = PT.sin_cos(turn)
        rach = size
        _petiole(cv, x, y, x + c * rach, y + s * rach, .9, tuple(v * .75 for v in colour), z - .1)
        leaflet = size * .38
        PT.leaflet(cv, x + c * rach * .98, y + s * rach * .98, turn, leaflet, leaflet * .27, z, colour, edge, amount,
                   blotch, 8, .6, shade)
        for k in range(F['pinnate']):
            f = .3 + .23 * k
            for side in (-1., 1.):
                PT.leaflet(cv, x + c * rach * f, y + s * rach * f, turn + side * .15, leaflet * (.84 + .06 * k),
                           leaflet * .26, z, colour, edge, amount, blotch, 8, .6, shade)
    elif F.get('bipinnate'):
        s, c = PT.sin_cos(turn)
        rach = size
        _petiole(cv, x, y, x + c * rach, y + s * rach, .7, tuple(v * .7 for v in colour), z - .1)
        for k in range(F['bipinnate']):
            f = .2 + .17 * k
            px, py = x + c * rach * f, y + s * rach * f
            for side in (-1., 1.):
                pt = turn + side * .16
                ps, pc = PT.sin_cos(pt)
                pin = rach * (.38 - .04 * k)
                _petiole(cv, px, py, px + pc * pin, py + ps * pin, .4, tuple(v * .7 for v in colour), z - .1)
                n = 6
                for m in range(n):
                    g = .2 + .78 * m / n
                    for side2 in (-1., 1.):
                        PT.leaflet(cv, px + pc * pin * g, py + ps * pin * g, pt + side2 * .15, size * .085,
                                   size * .085 * .3, z, colour, edge, amount, blotch, 0, .6, shade, lift=.08)


CELL_MARGIN = 64        # each cell is painted on its own canvas this much larger on every side, then cropped


def _strand(cv, pts, r0, r1, colour, tip, tip_amount, z, blotch, shade, rough=.62, gloss=.16, lift=.12):
    """A tapered stroke along the polyline pts (px), radius r0 to r1: a needle or a twig, painted over what is below
    in short capsules, anti-aliased. Its colour turns toward tip along its length (by tip_amount at the end), and
    its middle line is lighter and raised (a glossy needle)."""
    W, H = cv.w, cv.h
    R, G, B, HT, RO, CA, AL = cv.r, cv.g, cv.b, cv.height, cv.rough, cv.cavity, cv.alpha
    seg = [math.dist(p, q) for p, q in zip(pts, pts[1:])]
    total = sum(seg) or 1.
    nodes, fr, acc = [pts[0]], [0.], 0.
    for (p, q), L in zip(zip(pts, pts[1:]), seg):
        n = max(1, math.ceil(L / 4.))
        for j in range(1, n + 1):
            nodes.append((p[0] + (q[0] - p[0]) * j / n, p[1] + (q[1] - p[1]) * j / n))
            fr.append((acc + L * j / n) / total)
        acc += L
    for (ax, ay), (bx, by), fa, fb in zip(nodes, nodes[1:], fr, fr[1:]):
        ra, rb = r0 + (r1 - r0) * fa, r0 + (r1 - r0) * fb
        ex, ey = bx - ax, by - ay
        ll = ex * ex + ey * ey
        rm = max(ra, rb) + 1.
        for py in range(max(0, math.floor(min(ay, by) - rm)), min(H, math.floor(max(ay, by) + rm) + 1)):
            qy = py + .5 - ay
            row = py * W
            for px in range(max(0, math.floor(min(ax, bx) - rm)), min(W, math.floor(max(ax, bx) + rm) + 1)):
                qx = px + .5 - ax
                h = (qx * ex + qy * ey) / ll if ll > 1e-12 else 0.
                h = 0. if h < 0. else 1. if h > 1. else h
                dx, dy = qx - ex * h, qy - ey * h
                dist = math.sqrt(dx * dx + dy * dy)
                r = ra + (rb - ra) * h
                sd = r - dist
                if sd <= -.5:
                    continue
                a = 1. if sd >= .5 else sd + .5
                i = row + px
                f = fa + (fb - fa) * h
                e = tip_amount * f * f
                c = 1. - dist / r if dist < r else 0.
                kk = shade * (1. + .28 * (blotch[i] - .5)) * (1. + gloss * c)
                cr = (colour[0] + (tip[0] - colour[0]) * e) * kk
                cg = (colour[1] + (tip[1] - colour[1]) * e) * kk
                cb = (colour[2] + (tip[2] - colour[2]) * e) * kk
                hgt = z + lift * c
                R[i] += (cr - R[i]) * a
                G[i] += (cg - G[i]) * a
                B[i] += (cb - B[i]) * a
                HT[i] += (hgt - HT[i]) * a
                RO[i] += (rough - RO[i]) * a
                CA[i] -= CA[i] * a
                if AL is not None and a > AL[i]:
                    AL[i] = a


def _needle_cell(cv, F, count, palette, sparse, rng, blotch):
    """A needle cluster on a cell canvas, seen from above, base at the bottom centre (the FORMS notes): a spruce or
    fir spray, a pine tuft or a larch twig of short-shoot rosettes. Needles that would leave the cell are
    shortened, then dropped."""
    S, pad = ATLAS['cell_px'], ATLAS['pad_px']
    lo, hi = CELL_MARGIN + pad + 4, CELL_MARGIN + S - pad - 4
    bx, by = CELL_MARGIN + S * .5, CELL_MARGIN + S - pad - 2
    nl0, nl1 = F['needle']
    form = F['needles']
    state = {'z': .2}

    def inside(x, y):
        return lo <= x <= hi and lo <= y <= hi

    def polyline(x, y, turn, length, bend=0., steps=6):
        """Points from (x, y) toward turn, curving by bend turns over the length."""
        pts = [(x, y)]
        for k in range(steps):
            s, c = PT.sin_cos(turn + bend * (k + .5) / steps)
            x, y = x + c * length / steps, y + s * length / steps
            pts.append((x, y))
        return pts

    def needle(x, y, turn, length, r0=.8, r1=.28, bend=0.):
        _, colour, tip, amount = _pick(palette, rng.random())
        tone = .86 + .28 * rng.random()
        colour = tuple(min(255., v * tone) for v in colour)
        for _ in range(6):
            pts = polyline(x, y, turn, length, bend, 2 if length < 16. else 5)
            if all(inside(*p) for p in pts):
                _strand(cv, pts, r0, r1, colour, tip, amount, state['z'], blotch, .92 + .08 * rng.random())
                state['z'] += .0003
                return
            length *= .8
            if length < 4.:
                return

    def twig(pts, r0, r1, colour):
        _strand(cv, pts, r0, r1, colour, colour, 0., .1, blotch, 1., rough=.8, gloss=.1, lift=.3)

    def along(pts):
        """(x, y, heading turn, fraction) every 1.7 px along a polyline."""
        out, total = [], sum(math.dist(p, q) for p, q in zip(pts, pts[1:]))
        acc = 0.
        for p, q in zip(pts, pts[1:]):
            L = math.dist(p, q)
            heading = _turn(q[0] - p[0], q[1] - p[1])
            n = max(1, round(L / 1.7))
            for j in range(n):
                f = (acc + L * j / n) / total
                out.append((p[0] + (q[0] - p[0]) * j / n, p[1] + (q[1] - p[1]) * j / n, heading, f))
            acc += L
        return out

    up = .75 + (rng.random() - .5) * .04          # the main axis heads up the cell (y down), a little askew
    if form == 'spray':
        main = polyline(bx, by, up, by - lo - 8., (rng.random() - .5) * .05, 12)
        axes = [(main, 1.)]
        for k in range(count):
            f = .12 + .74 * (k + .3 + .4 * rng.random()) / count
            px, py = main[min(12, round(f * 12))]
            side = -1. if k % 2 else 1.
            heading = up + side * (.13 + .04 * rng.random())
            L = S * (.46 - .3 * f) * (.85 + .3 * rng.random())
            lateral = polyline(px, py, heading, L, -side * .03, 6)
            while not all(inside(*p) for p in lateral) and L > 12.:
                L *= .85
                lateral = polyline(px, py, heading, L, -side * .03, 6)
            axes.append((lateral, .75))
            if not sparse and L > S * .18:
                for g in (.35, .6, .85):
                    qx, qy = lateral[round(g * 6)]
                    sub = polyline(qx, qy, heading + side * .12, L * .38 * (1.1 - .4 * g), 0., 3)
                    if all(inside(*p) for p in sub):
                        axes.append((sub, .55))
        for pts, w in axes:
            twig(pts, 2.2 * w, .9 * w, (118., 84., 54.))
        for pts, w in axes:
            for k, (x, y, heading, f) in enumerate(along(pts)):
                length = S * (nl0 + (nl1 - nl0) * rng.random()) * (1. - .3 * f) * (.8 + .2 * w)
                for side in (-1., 1.):
                    if sparse and rng.random() < .35:
                        continue
                    needle(x, y, heading + side * (.1 + .08 * rng.random()), length * (.85 + .3 * rng.random()))
                if k % 2 == 0:
                    needle(x, y, heading + (rng.random() - .5) * .08, length * .8)
    elif form == 'tuft':
        # A pine shoot cluster: a leading shoot and count - 1 side shoots fanning from low on it, each a dense
        # brush of long paired needles that spread wide at its base and lean forward toward the tip, and a bud.
        L0 = S * .4
        main = polyline(bx, by, up, L0, (rng.random() - .5) * .04, 8)
        shoots = [main]
        for k in range(count - 1):
            side = -1. if k % 2 else 1.
            px, py = main[2]
            shoots.append(polyline(px, py, up + side * (.075 + .03 * rng.random()), L0 * (.68 + .1 * rng.random()),
                                   -side * .025, 6))
        for pts in shoots:
            twig(pts, 2.6, 1.6, (112., 86., 60.))
        for pts in shoots:
            for x, y, heading, f in along(pts):
                if f < .12:
                    continue
                for side in (-1., 1.):
                    if sparse and rng.random() < .35:
                        continue
                    spread = (.03 + .17 * rng.random()) * (1.25 - .7 * f)
                    length = S * (nl0 + (nl1 - nl0) * rng.random()) * (.8 + .2 * f)
                    needle(x, y, heading + side * spread, length, .95, .3, side * (rng.random() - .3) * .03)
        for pts in shoots:
            ex, ey = pts[-1]
            PT.disc(cv, ex, ey, 3.2, (138., 92., 54.), state['z'] + .3, .7)
    else:
        # A larch branchlet: a long shoot and count side shoots (pendulous, seen from above), with a short shoot
        # every 10 px or so, alternately left and right, each a rosette of soft needles all round; on a sparse
        # card many short shoots are already bare.
        main = polyline(bx, by, up, by - lo - 12., (rng.random() - .5) * .06, 12)
        twigs = [main]
        for k in range(count):
            side = -1. if k % 2 else 1.
            f = .22 + .5 * (k + .5) / max(1, count)
            fork = main[round(f * 12)]
            L = S * (.34 + .1 * rng.random()) * (1. - .45 * f)
            twigs.append(polyline(fork[0], fork[1], up + side * (.11 + .05 * rng.random()), L, -side * .03, 8))
        for k, pts in enumerate(twigs):
            twig(pts, 1.9 if k == 0 else 1.3, .7, (104., 82., 66.))
        for pts in twigs:
            total = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
            spurs = max(2, round(total / 9.))
            n = len(pts) - 1
            heading = _turn(pts[-1][0] - pts[0][0], pts[-1][1] - pts[0][1])
            for k in range(spurs):
                f = .08 + .86 * (k + .5) / spurs
                x, y = pts[min(n, round(f * n))]
                side = -1. if k % 2 else 1.
                s_, c_ = PT.sin_cos(heading + side * .17)
                sx, sy = x + c_ * 3., y + s_ * 3.
                PT.disc(cv, sx, sy, 1.6, (96., 74., 58.), state['z'] + .2, .8)
                if sparse and rng.random() < .4:
                    continue                # a bare short shoot: its needles are down
                for j in range(22 + int(rng.random() * 15) - (10 if sparse else 0)):
                    turn = heading + side * .17 + (rng.random() - .5) * .9
                    needle(sx, sy, turn, S * (nl0 + (nl1 - nl0) * rng.random()), .7, .25)
            # Single needles round the growing tip of the long shoot.
            for x, y, h, f in along(pts):
                if f > .88:
                    for side in (-1., 1.):
                        needle(x, y, h + side * (.09 + .06 * rng.random()), S * nl0 * .9, .6, .22)

def paint_cell(cv, index, blotch):
    """One cluster on a cell canvas: a twig from the bottom centre with leaves (opposite pairs or alternate)."""
    name = CELL_ORDER[index]
    form, count, palette, sparse, _ = CELLS[name]
    F = FORMS[form]
    S = ATLAS['cell_px']
    x0 = y0 = CELL_MARGIN
    x1 = y1 = CELL_MARGIN + S
    pad = ATLAS['pad_px']
    rng = random.Random(ATLAS['seed'] * 100 + index)
    if 'needles' in F:
        return _needle_cell(cv, F, count, palette, sparse, rng, blotch)
    twig_colour = (92., 70., 52.)
    bx, by = x0 + S * .5, y1 - pad - 2
    top_x = x0 + S * (.5 + (rng.random() - .5) * .16)
    top_y = y0 + pad + S * (.5 if F['size'] > .4 else .36)
    # The twig: a gently bowed line, thinning toward the tip; sparse cards fork once or twice.
    segs = 24
    pts = []
    bow = (rng.random() - .5) * S * .12
    for k in range(segs + 1):
        f = k / segs
        pts.append((bx + (top_x - bx) * f + math.sin(math.pi * f) * bow, by + (top_y - by) * f))
    for k in range(segs):
        r = 2.6 - 1.6 * k / segs
        _petiole(cv, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], r, twig_colour, .2)
    forks = []
    if sparse:
        for k, side in ((9, -1.), (15, 1.)):
            fx, fy = pts[k]
            ex, ey = fx + side * S * .2, fy - S * .16
            _petiole(cv, fx, fy, ex, ey, 1.3, twig_colour, .2)
            forks.append((fx, fy, ex, ey))
    size = S * F['size']
    # Leaf anchors along the upper twig, in opposite pairs (maples, ash) or alternate (linden, locust), fanned
    # 30-75 degrees off the twig and smaller toward its tip, plus a terminal leaf; compound leaves radiate from
    # the tip. Later anchors sit lower and are drawn first, so the tip leaves overlap them as on a real shoot.
    anchors = []
    if F.get('pinnate') or F.get('bipinnate'):
        fan = [0., -.13, .13, -.24, .24][:count]
        for a in fan:
            anchors.append((segs, a, 1. - .25 * abs(a) / .24))
    else:
        anchors.append((segs, 0., .85))
        k, side, step = segs - 2, -1., 3 if count > 6 else 5
        while len(anchors) < count and k > 5:
            f = k / segs
            spread = .11 + .14 * (1. - f) + (rng.random() - .5) * .05
            scale = .8 + .35 * (1. - f)
            if F['opposite']:
                anchors += [(k, -spread, scale), (k, spread, scale)]
                k -= step
            else:
                anchors.append((k, side * spread, scale))
                side, k = -side, k - max(2, step - 1)
        anchors = anchors[:count]
    leaves = []
    for k, offset, scale in anchors:
        px, py = pts[min(k, segs)]
        if sparse and forks and offset:
            fx, fy, ex, ey = forks[0 if offset < 0 else -1]
            px, py = ex, ey
        tx, ty = pts[min(segs, k + 1)][0] - pts[max(0, k - 1)][0], pts[min(segs, k + 1)][1] - pts[max(0, k - 1)][1]
        turn = _turn(tx, ty) + offset + (rng.random() - .5) * .03
        leaves.append((k + rng.random() * 3., px, py, turn, scale, rng.random(), rng.random(), rng.random()))
    leaves.sort(key=lambda r: r[0])
    for order, (_, px, py, turn, scale, u1, u2, u3) in enumerate(leaves):
        z = order / max(1, len(leaves) - 1)
        _, colour, edge, amount = _pick(palette, u1)
        tone = .9 + .2 * u2
        colour = tuple(min(255., c * tone) for c in colour)
        s, c = PT.sin_cos(turn)
        lsize = size * scale * (.9 + .2 * u3)
        stalk = lsize * F['petiole']
        lx, ly = px + c * stalk, py + s * stalk
        # Keep the blade inside the cell: pull the blade base back along its petiole until its far end fits.
        reach = lsize * (1.05 if 'lobes' in F else 1.)
        for _ in range(12):
            ex, ey = lx + c * reach, ly + s * reach
            if x0 + pad + 4 <= ex <= x1 - pad - 4 and y0 + pad + 4 <= ey <= y1 - pad - 4:
                break
            lx, ly = lx - c * reach * .08, ly - s * reach * .08
            reach *= .96
            lsize *= .96
        _petiole(cv, px, py, lx, ly, .9, tuple(v * .62 for v in colour), .3 + z)
        shade = .8 + .2 * z
        _leaf(cv, form, lx, ly, lsize, turn, colour, edge, amount * (.6 + .8 * u2), blotch, shade, 1. + z, u3)


def atlas_maps():
    """The leaf atlas canvas result (diff RGBA rows, heights, roughness, cavity) and per-cell statistics."""
    W, H = ATLAS['size_px']
    S = ATLAS['cell_px']
    C = S + 2 * CELL_MARGIN
    pad = ATLAS['pad_px']
    cv = PT.Canvas(W, H, (196., 146., 60.), 0., .7, alpha=0.)
    blotch = PT.field(PT.Fbm(ATLAS['seed'] + 1, C, C, ((12, 12), (24, 24), (48, 48)), (.5, .3, .2)), C)
    for index in range(len(CELL_ORDER)):
        cell = PT.Canvas(C, C, (196., 146., 60.), 0., .7, alpha=0.)
        paint_cell(cell, index, blotch)
        x0, y0, _, _ = cell_rect(index)
        for y in range(S):
            src = (y + CELL_MARGIN) * C + CELL_MARGIN
            dst = (y0 + y) * W + x0
            fy = min(y, S - 1 - y)
            for x in range(S):
                fade = PT.smooth(pad * .5, pad - 1., min(fy, x, S - 1 - x))
                i, j = dst + x, src + x
                cv.r[i], cv.g[i], cv.b[i] = cell.r[j], cell.g[j], cell.b[j]
                cv.height[i], cv.rough[i], cv.cavity[i] = cell.height[j], cell.rough[j], cell.cavity[j]
                cv.alpha[i] = cell.alpha[j] * fade
    # Edge padding: transparent texels take their cell's mean leaf colour, so mips and bilinear filtering never
    # pull a halo of another colour into the cut-out edge.
    stats = {}
    for index, name in enumerate(CELL_ORDER):
        x0, y0, x1, y1 = cell_rect(index)
        sr = sg = sb = n = 0.
        for y in range(y0, y1):
            o = y * W
            for x in range(x0, x1):
                i = o + x
                if cv.alpha[i] >= .5:
                    sr, sg, sb, n = sr + cv.r[i], sg + cv.g[i], sb + cv.b[i], n + 1
        mean = (sr / n, sg / n, sb / n)
        for y in range(y0, y1):
            o = y * W
            for x in range(x0, x1):
                i = o + x
                if cv.alpha[i] < .02:
                    cv.r[i], cv.g[i], cv.b[i] = mean
                    cv.height[i] = 0.
        stats[name] = {'cover': round(n / ((x1 - x0) * (y1 - y0)), 4), 'mean_srgb': [round(v, 1) for v in mean]}
    px = ATLAS['cell_px'] / 60.    # nominal: a 60 cm card over a 256 px cell
    return cv.result(px, px, {'cells': CELL_ORDER, 'cell_px': ATLAS['cell_px'], 'cols': COLS, 'rows': ROWS,
                              'pad_px': ATLAS['pad_px'],
                              'cell_stats': stats}, wrap_y=False)


def bark_maps():
    """Bark: Worley plates stretched 8x along the stem (F2 - F1 gives the furrows), the rows sheared by a slow
    noise so the furrows wander and interlace, fibrous striations along the plates and lichen on some tops."""
    W, H = BARK['size_px']
    seed = BARK['seed']
    px = W / (BARK['tile_m'][0] * 100.)
    stretch = 8
    h2 = H // stretch
    ids, border, _ = PT.cells(seed, W, h2, 6.5 * px, .95)
    fine = PT.noise1d(seed + 5, W, 128)
    shear = PT.noise1d(seed + 6, H, 6)
    fbm = PT.field(PT.Fbm(seed + 7, W, H, ((8, 16), (16, 32), (64, 128)), (.5, .3, .2)), H)
    lichen = PT.field(PT.Fbm(seed + 9, W, H, ((4, 8), (8, 16)), (.6, .4)), H)
    cv = PT.Canvas(W, H, (110., 100., 90.), 0., .85)
    furrow = (58., 50., 44.)
    for y in range(H):
        t = (y + .5) / stretch - .5
        j0 = math.floor(t)
        f = t - j0
        r0, r1 = (j0 % h2) * W, ((j0 + 1) % h2) * W
        dx = int((shear[y] - .5) * 3.5 * px)
        for x in range(W):
            i = y * W + x
            xs = (x + dx) % W
            b = border[r0 + xs] * (1. - f) + border[r1 + xs] * f
            cell = ids[r0 + xs] if f < .5 else ids[r1 + xs]
            tone = .88 + .24 * PT.unit(seed, 77, cell)
            plate = PT.smooth(1., 6.5, b)
            stri = fine[xs]
            hgt = 1.3 * plate + .45 * stri * plate + .25 * fbm[i]
            k = tone * (.9 + .2 * fbm[i]) * (.86 + .28 * stri)
            cr, cg, cb = 132. * k, 122. * k, 110. * k
            cr, cg, cb = (furrow[0] + (cr - furrow[0]) * plate, furrow[1] + (cg - furrow[1]) * plate,
                          furrow[2] + (cb - furrow[2]) * plate)
            moss = PT.smooth(.64, .76, lichen[i]) * plate * .5
            cr, cg, cb = cr + (128. - cr) * moss, cg + (136. - cg) * moss, cb + (110. - cb) * moss
            cv.r[i], cv.g[i], cv.b[i] = cr, cg, cb
            cv.height[i] = hgt
            cv.rough[i] = .97 - .12 * plate
            cv.cavity[i] = 1. - PT.smooth(0., 3., b)
    return cv.result(px, px, {'plates_cm': [6.5, 52.], 'stretch': stretch, 'furrow': 'Worley F2 - F1 under 1.3 cm',
                              'shear_cm': 3.5})


def texture_set(spec, g, surface, uv, tile_m, keys):
    """{file: png bytes} and an index entry in the textures.json set format (plateau_textures.build)."""
    width, height = spec['size_px']
    channels = g['channels']
    px_x, px_y = g['px']
    maps = {'diff': g['diff'], 'nor_dx': PT.normal_rows(g['heights'], px_x, px_y, g['wrap_y']),
            'rough': PT.mask_rows(g['rough'], g['heights'], g['cavity'])}
    alpha = [r[3::4] for r in g['diff']] if channels == 4 else None
    mean = PT.linear_mean(g['diff'], channels)
    entry = {'name': spec['name'], 'size_px': [width, height], 'tile_m': list(tile_m),
             'tiling': [round(1 / tile_m[0], 6), round(1 / tile_m[1], 6)], 'mean_linear': mean,
             'roughness_mean': round(PT.channel_mean(maps['rough'], 0, alpha), 4), 'layout': g['layout'], 'maps': {},
             'surface': surface, 'material': dict(PT.SURFACES[surface]), 'keys': list(keys), 'uv': uv,
             'alpha': channels == 4, 'base_color_srgb': PT.to_srgb_hex(mean)}
    if alpha is not None:
        entry['coverage'] = round(sum(sum(1 for v in a if v >= 128) for a in alpha) / (width * height), 4)
    files = {}
    for role in PT.ROLES:
        raw = PT.raw_stream(maps[role])
        data = PT.png(width, height, raw, channels if role == 'diff' else 3)
        name = f'T_Replica_{spec["name"]}_{role}.png'
        files[name] = data
        entry['maps'][role] = {'file': name, **PT.IMPORT[role], 'sha256': hashlib.sha256(data).hexdigest(),
                               'raw_sha256': hashlib.sha256(raw).hexdigest()}
        if role == 'diff' and channels == 4:
            entry['maps'][role]['alpha'] = True
    return files, entry


def build_textures():
    bark_keys = [bark_key(k) for k in KINDS]
    leaf_files, leaf_entry = texture_set(ATLAS, atlas_maps(), 'foliage', 'atlas', (1., 1.), [LEAF_KEY])
    leaf_entry['uv_note'] = 'OBJ UVs address the atlas directly (0..1, v up); tiling 1'
    bark_files, bark_entry = texture_set(BARK, bark_maps(), 'wall', 'metres', BARK['tile_m'], bark_keys)
    bark_entry['uv_note'] = 'u metres around the stem in whole tiles, v metres along it'
    return {**leaf_files, **bark_files}, {ATLAS['key']: leaf_entry, BARK['key']: bark_entry}


def bark_key(kind):
    return 'Bark_' + ''.join(w.capitalize() for w in kind.split('_'))


# ------------------------------------------------------------------------------------------------ mesh


class Mesh:
    def __init__(self):
        self.v, self.vt, self.vn = [], [], []
        self.faces = {'bark': [], 'leaves': []}

    def vert(self, p):
        self.v.append(p)
        return len(self.v) - 1

    def uv(self, u, v):
        self.vt.append((u, v))
        return len(self.vt) - 1

    def normal(self, n):
        self.vn.append(n)
        return len(self.vn) - 1


def sides_for(stem, P):
    if stem.level == 0:
        return P['trunk']['sides']
    s = P['levels'][stem.level - 1]['sides']
    if stem.radius0 < 1.:
        return min(s, 3)
    if stem.radius0 < 2.5:
        return min(s, 4)
    return s


def add_stem(mesh, stem, sides, tile_u, v_offset):
    """A tube along the stem: one ring per point, closed by a tip vertex; metre UVs in whole bark tiles."""
    n = len(stem.points)
    circ_m = math.tau * stem.radius0 / 100.
    reps = max(1, round(circ_m / tile_u))
    rings, uvs, normals = [], [], []
    for i in range(n):
        x, y, z = stem.ring_frame(i)
        r = stem.radius(stem.cum[i] / stem.length if stem.length else 0.)
        ring, nring = [], []
        for k in range(sides):
            a = math.tau * k / sides
            d = add(mul(x, math.cos(a)), mul(y, math.sin(a)))
            ring.append(mesh.vert(add(stem.points[i], mul(d, r))))
            nring.append(mesh.normal(d))
        v = v_offset + stem.cum[i] / 100.
        uvs.append([mesh.uv(reps * tile_u * k / sides, v) for k in range(sides + 1)])
        rings.append(ring)
        normals.append(nring)
    faces = mesh.faces['bark']
    for i in range(len(rings) - 1):
        A, B, NA, NB, UA, UB = rings[i], rings[i + 1], normals[i], normals[i + 1], uvs[i], uvs[i + 1]
        for k in range(sides):
            k2 = (k + 1) % sides
            a, b, c, d = (A[k], UA[k], NA[k]), (A[k2], UA[k + 1], NA[k2]), (B[k2], UB[k + 1], NB[k2]), (B[k], UB[k], NB[k])
            faces.append((a, b, c))
            faces.append((a, c, d))
    # Tip: a short cone beyond the last ring (a full-width cap where the trunk splits into leaders).
    tz = stem.frames[-1][2]
    r_end = stem.radius(1.)
    tip = mesh.vert(add(stem.points[-1], mul(tz, max(.3, r_end * .7))))
    tn = mesh.normal(tz)
    tuv = mesh.uv(reps * tile_u * .5, v_offset + (stem.length + max(.3, r_end * .7)) / 100.)
    A, NA, UA = rings[-1], normals[-1], uvs[-1]
    for k in range(sides):
        k2 = (k + 1) % sides
        faces.append(((A[k], UA[k], NA[k]), (A[k2], UA[k + 1], NA[k2]), (tip, tuv, tn)))


def crown_ellipsoid(cards):
    xs = [c['base'][0] for c in cards]
    ys = [c['base'][1] for c in cards]
    zs = [c['base'][2] for c in cards]
    centre = ((min(xs) + max(xs)) / 2., (min(ys) + max(ys)) / 2., (min(zs) + max(zs)) / 2.)
    radii = (max(50., (max(xs) - min(xs)) / 2.), max(50., (max(ys) - min(ys)) / 2.), max(50., (max(zs) - min(zs)) / 2.))
    return centre, radii


def ellipsoid_normal(p, centre, radii):
    q = sub(p, centre)
    return norm((q[0] / radii[0] ** 2, q[1] / radii[1] ** 2, q[2] / radii[2] ** 2))


def choose_cell(kind, card, centre, radii):
    """A weighted cell pick: exposed (outer, upper) cards favour turned cells, sheltered ones greener cells."""
    weights = SPECIES[kind]['leaves']['cells']
    q = sub(card['base'], centre)
    e = math.sqrt((q[0] / radii[0]) ** 2 + (q[1] / radii[1]) ** 2 + (q[2] / radii[2]) ** 2)
    exposure = min(1., max(0., .55 * min(1., e) + .45 * (q[2] / radii[2] * .5 + .5)))
    table = []
    for name, w in weights.items():
        stage = CELLS[name][4]
        table.append((name, w * ((.5 + exposure) if stage >= .5 else (1.5 - exposure))))
    total = sum(w for _, w in table)
    x, acc = card['pick'] * total, 0.
    for name, w in table:
        acc += w
        if x < acc:
            return name
    return table[-1][0]


def card_points(card, centre, radii):
    """The six corners of a folded card and its front normal (facing out of the crown)."""
    d, size, b = card['dir'], card['size'], card['base']
    n0 = sub(UP, mul(d, dot(UP, d)))
    if length(n0) < 1e-3:
        n0 = cross(d, (1., 0., 0.))
    n0 = rotate(norm(n0), d, math.radians(card['twist']))
    radial = ellipsoid_normal(b if card.get('at_base') else add(b, mul(d, size * .5)), centre, radii)
    if dot(n0, radial) < 0.:
        n0 = mul(n0, -1.)
    w = norm(cross(d, n0))
    half = size * .5
    fold = mul(n0, size * FOLD)
    top = add(b, mul(d, size))
    pts = [add(b, mul(w, -half * .8)), add(b, mul(fold, .3)), add(b, mul(w, half * .8)),
           add(top, mul(w, -half)), add(top, fold), add(top, mul(w, half))]
    return pts, n0


def add_card(mesh, card, cell_index, centre, radii):
    """A folded cluster card: 2 rows x 3 columns, 4 triangles, the front facing out of the crown."""
    pts, n0 = card_points(card, centre, radii)
    u0, v0, u1, v1 = cell_uv(cell_index)
    um = (u0 + u1) * .5
    du = (u1 - u0) * .5
    uvs = [(um - du * .8, v0), (um, v0), (um + du * .8, v0), (u0, v1), (um, v1), (u1, v1)]
    ids = []
    for p, (u, v) in zip(pts, uvs):
        nrm = norm(lerp(n0, ellipsoid_normal(p, centre, radii), PUFFINESS))
        if nrm[2] < MIN_NORMAL_Z:
            # Keep the heading, lift the normal to MIN_NORMAL_Z (SpeedTree's normal range), still unit length.
            h = math.hypot(nrm[0], nrm[1])
            hx, hy = (nrm[0] / h, nrm[1] / h) if h > 1e-6 else (1., 0.)
            k = math.sqrt(1. - MIN_NORMAL_Z * MIN_NORMAL_Z)
            nrm = (hx * k, hy * k, MIN_NORMAL_Z)
        ids.append((mesh.vert(p), mesh.uv(u, v), mesh.normal(nrm)))
    f = mesh.faces['leaves']
    # (b0, b1, t1, t0) runs counter-clockwise about +n0: (b1 - b0) is +w, (t0 - b0) is +d and w x d = n0.
    for a, bb, c, dd in ((0, 1, 4, 3), (1, 2, 5, 4)):
        f.append((ids[a], ids[bb], ids[c]))
        f.append((ids[a], ids[c], ids[dd]))
    return n0


def tree_top(stems, cards):
    tops = [p[2] for s in stems for p in s.points]
    tops += [c['base'][2] + max(0., c['dir'][2]) * c['size'] for c in cards]
    return max(tops)


def calibrated(kind):
    """Stems and cards of one kind with the stem length scale calibrated (three passes) so the tree's top, leaf
    cards included, lands on height_cm; the trunk diameter and the pruned height stay absolute."""
    P = SPECIES[kind]
    scale = P['height_cm']
    for _ in range(3):
        stems, cards = generate(kind, scale)
        scale *= P['height_cm'] / tree_top(stems, cards)
    return generate(kind, scale)


def build_kind(kind):
    """Mesh and statistics of one kind."""
    P = SPECIES[kind]
    stems, cards = calibrated(kind)
    mesh = Mesh()
    rng = random.Random(P['seed'] + 99)
    for stem in stems:
        add_stem(mesh, stem, sides_for(stem, P), BARK['tile_m'][0], round(rng.random() * 2., 3))
    centre, radii = crown_ellipsoid(cards)
    floor_z = P['prune_cm'] - CARD_HANG_CM
    cards = [c for c in cards if min(p[2] for p in card_points(c, centre, radii)[0]) >= floor_z]
    usage = {}
    outward = 0
    for card in cards:
        name = choose_cell(kind, card, centre, radii)
        usage[name] = usage.get(name, 0) + 1
        n0 = add_card(mesh, card, CELL_ORDER.index(name), centre, radii)
        outward += dot(n0, ellipsoid_normal(card['base'], centre, radii)) >= 0.
    bark_v = {i for face in mesh.faces['bark'] for i, _, _ in face}
    leaf_v = {i for face in mesh.faces['leaves'] for i, _, _ in face}
    zs = [mesh.v[i][2] for i in leaf_v]
    limbs = [s for s in stems if s.level == 1]
    stats = {'stems': [sum(1 for s in stems if s.level == lv) for lv in range(3)], 'cards': len(cards),
             'cell_usage': dict(sorted(usage.items())), 'outward_cards': outward,
             'crown_base_cm': round(min(zs), 1), 'clear_trunk_cm': round(min(s.points[0][2] for s in limbs), 1),
             'crown_centre_cm': [round(c, 1) for c in centre], 'crown_radii_cm': [round(r, 1) for r in radii],
             'bark_vertices': len(bark_v), 'leaf_vertices': len(leaf_v)}
    return mesh, stems, stats


def _fmt(x, digits):
    s = f'{x:.{digits}f}'
    return '0.' + '0' * digits if s.lstrip('-').strip('0.') == '' else s


def mtl_name(model):
    return f'Tree_{model}.mtl'


def write_mtl(path, model):
    """The model's material library: one newmtl per usemtl of its OBJ (bark, then leaves) with a plain diffuse
    colour, the bark tint and the main colour of the kind's commonest leaf cell. It only names the slots: the apply
    step imports without materials and sets the bark and leaves materials by slot name."""
    P = SPECIES[model]
    bark = P['bark']['colour']
    cell = max(P['leaves']['cells'].items(), key=lambda kv: kv[1])[0]
    leaf = CELLS[cell][2][0][1]
    colours = {'bark': [int(bark[i:i + 2], 16) for i in (1, 3, 5)], 'leaves': leaf}
    lines = [f'# {GENERATOR}: material slots of Tree_{model}.obj']
    for slot in ('bark', 'leaves'):
        lines += [f'newmtl {model}_{slot}', 'Kd ' + ' '.join(_fmt(c / 255., 4) for c in colours[slot])]
    data = ('\n'.join(lines) + '\n').encode()
    path.write_bytes(data)
    return hashlib.sha256(data).hexdigest()


def write_obj(path, kind, mesh):
    """Triangles per material group; v, vt and vn deduplicated by their printed form, so the file is stable. The
    mtllib line names the model's material library (write_mtl), written next to it."""
    lines = [f'# {GENERATOR}: {SPECIES[kind]["name"]}', f'mtllib {mtl_name(kind)}', f'o SM_Tree_{kind}']
    vmap, vtmap, vnmap = {}, {}, {}
    vl, vtl, vnl = [], [], []

    def ref(table, out, key):
        if key not in table:
            table[key] = len(out) + 1
            out.append(key)
        return table[key]
    body = []
    counts = {}
    for slot in ('bark', 'leaves'):
        body.append(f'usemtl {kind}_{slot}')
        counts[slot] = len(mesh.faces[slot])
        for face in mesh.faces[slot]:
            keys = [f'v {_fmt(mesh.v[vi][0], 2)} {_fmt(mesh.v[vi][1], 2)} {_fmt(mesh.v[vi][2], 2)}' for vi, _, _ in face]
            if len(set(keys)) < 3:
                counts[slot] -= 1                 # a triangle that collapses at print precision
                continue
            refs = []
            for key, (vi, ti, ni) in zip(keys, face):
                t, n = mesh.vt[ti], mesh.vn[ni]
                a = ref(vmap, vl, key)
                b = ref(vtmap, vtl, f'vt {_fmt(t[0], 4)} {_fmt(t[1], 4)}')
                c = ref(vnmap, vnl, f'vn {_fmt(n[0], 4)} {_fmt(n[1], 4)} {_fmt(n[2], 4)}')
                refs.append(f'{a}/{b}/{c}')
            body.append('f ' + ' '.join(refs))
    data = '\n'.join(lines + vl + vtl + vnl + body) + '\n'
    path.write_bytes(data.encode())
    verts = [tuple(float(c) for c in s.split()[1:]) for s in vl]
    return hashlib.sha256(data.encode()).hexdigest(), counts, verts


def breast_height(P):
    """Where the trunk diameter is measured: 1.3 m, or 15 cm under a fork that comes lower (multi-stem trees)."""
    split = P['trunk'].get('split_cm')
    return min(130., split - 15.) if split else 130.


def trunk_dbh(stems, P):
    """Diameter of the trunk mesh at breast height, from its ring radius (the trunk has a ring there)."""
    trunk = stems[0]
    bh = breast_height(P)
    i = min(range(len(trunk.points)), key=lambda k: abs(trunk.points[k][2] - bh))
    return 2. * trunk.radius(trunk.cum[i] / trunk.length)


def model_entry(out_dir, model):
    """Write one model's OBJ (a kind, or a kind's young tree) and return its manifest entry."""
    P = SPECIES[model]
    kind = kind_of(model)
    mesh, stems, stats = build_kind(model)
    file_name = f'Tree_{model}.obj'
    digest, counts, verts = write_obj(out_dir / file_name, model, mesh)
    mtl_digest = write_mtl(out_dir / mtl_name(model), model)
    height = max(v[2] for v in verts)
    xs, ys = [v[0] for v in verts], [v[1] for v in verts]
    bounds = [round(min(xs), 1), round(-max(ys), 1), round(min(v[2] for v in verts), 1), round(max(xs), 1),
              round(-min(ys), 1), round(height, 1)]
    tris = {'bark': counts['bark'], 'leaves': counts['leaves'], 'total': counts['bark'] + counts['leaves']}
    return {
        'name': P['name'], 'obj': file_name, 'sha256': digest, 'mtl': mtl_name(model), 'mtl_sha256': mtl_digest,
        'materials': {'bark': bark_key(kind), 'leaves': LEAF_KEY},
        'slots': {'bark': f'{model}_bark', 'leaves': f'{model}_leaves'},
        'height_cm': round(height, 1), 'trunk_cm': round(trunk_dbh(stems, P), 1),
        'trunk_at_cm': breast_height(P),
        'crown_width_cm': round(max(bounds[3] - bounds[0], bounds[4] - bounds[1]), 1),
        'crown_base_cm': stats['crown_base_cm'], 'clear_trunk_cm': stats['clear_trunk_cm'],
        'prune_cm': P['prune_cm'], 'leaf_retention': P['leaves']['retention'], 'triangles': tris,
        'triangle_target': target_of(model),
        'bounds_cm': bounds, 'seed': P['seed'], 'stems_per_level': stats['stems'], 'cards': stats['cards'],
        'outward_cards': stats['outward_cards'], 'cell_usage': stats['cell_usage'],
        'crown_centre_cm': stats['crown_centre_cm'], 'crown_radii_cm': stats['crown_radii_cm'],
        'weber_penn': {k: P[k] for k in ('shape', 'flare', 'ratio_power')} | {'trunk': P['trunk'],
                                                                              'levels': P['levels'],
                                                                              'leaves': P['leaves']},
    }


def build(out_dir, textures=True):
    """Write every kind's OBJ, the textures and the manifest; return the manifest."""
    out_dir.mkdir(parents=True, exist_ok=True)
    tex_files, sets = build_textures() if textures else ({}, {})
    for name, data in sorted(tex_files.items()):
        (out_dir / name).write_bytes(data)
    leaf_entry = sets.get(ATLAS['key'])
    materials = {}
    kinds = {}
    for kind in KINDS:
        P = SPECIES[kind]
        bk = bark_key(kind)
        materials[bk] = {'base_color_srgb': P['bark']['colour'], 'roughness': .92, 'metallic': 0.,
                         'texture': f'{LAYER}/T_Replica_{BARK["name"]}_diff.png', 'note': P['bark']['note']}
        kinds[kind] = model_entry(out_dir, kind)
        if kind in YOUNG_KINDS:
            # The young street tree: its own OBJ, the kind's bark and leaves.
            kinds[kind]['young'] = model_entry(out_dir, kind + YOUNG)
    leaves_spec = {'base_color_srgb': leaf_entry['base_color_srgb'] if leaf_entry else '#C8902E', 'roughness': .6,
                   'metallic': 0., 'texture': f'{LAYER}/T_Replica_{ATLAS["name"]}_diff.png', 'foliage': True,
                   'note': 'one autumn atlas for every kind; masked (clip .5), two-sided foliage'}
    materials[LEAF_KEY] = leaves_spec
    manifest = {
        'layer': LAYER, 'generator': GENERATOR,
        'frame': 'tree-local: x east, y north, z up, cm; pivot at the trunk base. OBJ stores (x, y, z) as authored '
                 '(the plateau_props.py convention); bounds_cm are Unreal-local (x, -y, z)',
        'unreal_destination': '/Game/Plateau/Replica/Trees',
        'technique': {
            'branching': 'Weber & Penn, "Creation and Rendering of Realistic Trees", SIGGRAPH 1995 (the model of '
                         'Blender\'s Sapling add-on; recursion written here because Sapling is not bundled)',
            'leaves': 'alpha-masked leaf cluster cards from an atlas (SpeedTree-style leaf cards), normals bent to '
                      'the crown ellipsoid (SpeedTree leaf puffiness) and clamped from pointing down',
            'textures': 'Scripts/plateau_textures.py primitives: signed-distance serrated leaflets, Worley bark plates',
            'conifers': 'Weber & Penn shape 0 (conical) on one leader; limbs in whorls after the Branch Rings option '
                        'of Blender\'s Sapling add-on (add_curve_sapling/utils.py); planar spruce laterals; '
                        'needle-cluster cards on twigs and outer limbs; Wesslen and Seipel, "The Virtual Forest", '
                        'SIGRAD 2004 (Weber & Penn for spruce and pine, health = leaf_retention)',
            'palmate': 'silver maple lobes joined over a central blade with Inigo Quilez\'s polynomial smooth minimum '
                       '(iquilezles.org/articles/smin)',
        },
        'aliases': ALIASES,
        'materials': materials,
        'texture_sets': sets,
        'atlas_cells': {name: {'index': i, 'uv': [round(c, 6) for c in cell_uv(i)], 'form': CELLS[name][0],
                               'stage': CELLS[name][4], 'sparse': CELLS[name][3]} for i, name in enumerate(CELL_ORDER)},
        'kinds': kinds,
        'counts': {'kinds': len(kinds), 'young': sum(1 for v in kinds.values() if 'young' in v),
                   'triangles': {k: v['triangles']['total'] for k, v in kinds.items()},
                   'young_triangles': {k: v['young']['triangles']['total'] for k, v in kinds.items() if 'young' in v},
                   'textures': len(tex_files)},
        'source_sha256': {GENERATOR: hashlib.sha256((ROOT / GENERATOR).read_bytes()).hexdigest(),
                          'Scripts/plateau_textures.py': hashlib.sha256((ROOT / 'Scripts/plateau_textures.py')
                                                                        .read_bytes()).hexdigest()},
    }
    text = json.dumps(manifest, indent=1, ensure_ascii=False) + '\n'
    (out_dir / 'manifest.json').write_text(text)
    return manifest


# ------------------------------------------------------------------------------------------------ contact sheet


def read_obj(path):
    """(positions, uvs, normals, {slot: [((vi, ti, ni) x 3)]}) of an OBJ written by write_obj."""
    v, vt, vn, faces, slot = [], [], [], {}, None
    for line in path.read_text().splitlines():
        tag, _, rest = line.partition(' ')
        if tag == 'v':
            v.append(tuple(float(c) for c in rest.split()))
        elif tag == 'vt':
            vt.append(tuple(float(c) for c in rest.split()))
        elif tag == 'vn':
            vn.append(tuple(float(c) for c in rest.split()))
        elif tag == 'usemtl':
            slot = 'leaves' if rest.endswith('_leaves') else 'bark'
            faces.setdefault(slot, [])
        elif tag == 'f':
            faces[slot].append(tuple(tuple(int(i) - 1 for i in tok.split('/')) for tok in rest.split()))
    return v, vt, vn, faces


def render_sheet(out_dir, manifest, sheet_path, samples=40):  # pragma: no cover - needs bpy
    import bpy
    from mathutils import Euler, Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.transparent_max_bounces = 32
    scene.cycles.max_bounces = 6
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (.5, .6, .75, 1)
    bg.inputs['Strength'].default_value = .8
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.4
    sun.data.angle = math.radians(3)
    sun.rotation_euler = Euler((math.radians(62), 0, math.radians(-40)), 'XYZ')   # a low October sun
    scene.collection.objects.link(sun)
    ground = bpy.data.meshes.new('ground')
    ground.from_pydata([(-200, -200, 0), (200, -200, 0), (200, 200, 0), (-200, 200, 0)], [], [(0, 1, 2, 3)])
    gmat = bpy.data.materials.new('ground')
    gmat.use_nodes = True
    gmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.3, .3, .29, 1)
    ground.materials.append(gmat)
    scene.collection.objects.link(bpy.data.objects.new('ground', ground))
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.lens = 50
    scene.collection.objects.link(cam)
    scene.camera = cam

    def image(name):
        img = bpy.data.images.load(str(out_dir / name))
        return img

    def srgb_lin(c):
        return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4

    sets = manifest['texture_sets']
    leaf_set, bark_set = sets[ATLAS['key']], sets[BARK['key']]

    def normal_dx(nt, tex):
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(tex.outputs['Color'], sep.inputs['Color'])
        inv = nt.nodes.new('ShaderNodeMath')
        inv.operation = 'SUBTRACT'
        inv.inputs[0].default_value = 1.
        nt.links.new(sep.outputs[1], inv.inputs[1])
        comb = nt.nodes.new('ShaderNodeCombineColor')
        nt.links.new(sep.outputs[0], comb.inputs[0])
        nt.links.new(inv.outputs[0], comb.inputs[1])
        nt.links.new(sep.outputs[2], comb.inputs[2])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(comb.outputs['Color'], nm.inputs['Color'])
        return nm

    def bark_material(key):
        spec = manifest['materials'][key]
        mat = bpy.data.materials.new(key)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes['Principled BSDF']
        coords = nt.nodes.new('ShaderNodeMapping')
        uvn = nt.nodes.new('ShaderNodeTexCoord')
        nt.links.new(uvn.outputs['UV'], coords.inputs['Vector'])
        coords.inputs['Scale'].default_value = (bark_set['tiling'][0], bark_set['tiling'][1], 1)
        texs = {}
        for role in PT.ROLES:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = image(bark_set['maps'][role]['file'])
            if role != 'diff':
                t.image.colorspace_settings.name = 'Non-Color'
            nt.links.new(coords.outputs['Vector'], t.inputs['Vector'])
            texs[role] = t
        hexcol = spec['base_color_srgb']
        target = [srgb_lin(int(hexcol[i:i + 2], 16) / 255) for i in (1, 3, 5)]
        tint = [min(8., c / m) for c, m in zip(target, bark_set['mean_linear'])]
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.
        nt.links.new(texs['diff'].outputs['Color'], mix.inputs['A'])
        mix.inputs['B'].default_value = (*tint, 1)
        nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(texs['rough'].outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs[0], bsdf.inputs['Roughness'])
        nt.links.new(normal_dx(nt, texs['nor_dx']).outputs['Normal'], bsdf.inputs['Normal'])
        return mat

    def leaf_material():
        mat = bpy.data.materials.new(LEAF_KEY)
        mat.use_nodes = True
        nt = mat.node_tree
        out = nt.nodes['Material Output']
        bsdf = nt.nodes['Principled BSDF']
        texs = {}
        for role in PT.ROLES:
            t = nt.nodes.new('ShaderNodeTexImage')
            t.image = image(leaf_set['maps'][role]['file'])
            t.interpolation = 'Linear'
            if role == 'diff':
                t.image.alpha_mode = 'CHANNEL_PACKED'
            else:
                t.image.colorspace_settings.name = 'Non-Color'
            texs[role] = t
        nt.links.new(texs['diff'].outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = .6
        nt.links.new(normal_dx(nt, texs['nor_dx']).outputs['Normal'], bsdf.inputs['Normal'])
        trans = nt.nodes.new('ShaderNodeBsdfTranslucent')
        dim = nt.nodes.new('ShaderNodeMix')
        dim.data_type = 'RGBA'
        dim.blend_type = 'MULTIPLY'
        dim.inputs['Factor'].default_value = 1.
        nt.links.new(texs['diff'].outputs['Color'], dim.inputs['A'])
        dim.inputs['B'].default_value = (.65, .65, .65, 1)
        nt.links.new(dim.outputs['Result'], trans.inputs['Color'])
        foliage = nt.nodes.new('ShaderNodeMixShader')
        foliage.inputs['Fac'].default_value = .3
        nt.links.new(bsdf.outputs['BSDF'], foliage.inputs[1])
        nt.links.new(trans.outputs['BSDF'], foliage.inputs[2])
        clip = nt.nodes.new('ShaderNodeMath')
        clip.operation = 'GREATER_THAN'
        clip.inputs[1].default_value = .5
        nt.links.new(texs['diff'].outputs['Alpha'], clip.inputs[0])
        cut = nt.nodes.new('ShaderNodeMixShader')
        hole = nt.nodes.new('ShaderNodeBsdfTransparent')
        nt.links.new(clip.outputs[0], cut.inputs['Fac'])
        nt.links.new(hole.outputs['BSDF'], cut.inputs[1])
        nt.links.new(foliage.outputs['Shader'], cut.inputs[2])
        nt.links.new(cut.outputs['Shader'], out.inputs['Surface'])
        return mat

    leaf_mat = leaf_material()
    entries = dict(model_entries(manifest))
    bark_by_key = {}
    for k in entries.values():
        key = k['materials']['bark']
        if key not in bark_by_key:
            bark_by_key[key] = bark_material(key)
    bark_mats = {m: bark_by_key[k['materials']['bark']] for m, k in entries.items()}
    data = {m: read_obj(out_dir / k['obj']) for m, k in entries.items()}

    def tree_object(kind, coll, loc=(0, 0, 0), yaw=0.):
        v, vt, vn, faces = data[kind]
        objs = []
        for slot in ('bark', 'leaves'):
            tris = faces[slot]
            mesh = bpy.data.meshes.new(f'{kind}_{slot}')
            mesh.from_pydata([(x / 100, y / 100, z / 100) for x, y, z in v], [], [tuple(c[0] for c in f) for f in tris])
            uv = mesh.uv_layers.new(name='UVMap')
            loops = [vt[c[1]] for f in tris for c in f]
            uv.data.foreach_set('uv', [x for p in loops for x in p])
            mesh.normals_split_custom_set([vn[c[2]] for f in tris for c in f])
            mesh.materials.append(leaf_mat if slot == 'leaves' else bark_mats[kind])
            obj = bpy.data.objects.new(f'{kind}_{slot}', mesh)
            obj.location = loc
            obj.rotation_euler = (0, 0, math.radians(yaw))
            coll.objects.link(obj)
            objs.append(obj)
        return objs

    def label(text):
        curve = bpy.data.curves.new('label', 'FONT')
        curve.body = text
        curve.align_x = 'CENTER'
        curve.size = .026
        obj = bpy.data.objects.new('label', curve)
        m = bpy.data.materials.new('label')
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0, 0, 0, 1)
        obj.data.materials.append(m)
        scene.collection.objects.link(obj)
        obj.parent = cam
        obj.location = (0, -.33, -1.0)
        obj.visible_shadow = False
        return obj

    def aim(target, distance, azimuth, elevation):
        az, el = math.radians(azimuth), math.radians(elevation)
        back = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
        cam.location = Vector(target) + back * distance
        cam.rotation_euler = (-back).to_track_quat('-Z', 'Y').to_euler()

    import numpy as np
    tw, th, cols, rows = 400, 500, SHEET_GRID[0], SHEET_GRID[1]
    scene.render.resolution_x, scene.render.resolution_y = tw, th
    scene.render.resolution_percentage = 100
    tiles = []
    for kind in KINDS:
        k = manifest['kinds'][kind]
        text = (f'{kind}\n{k["height_cm"] / 100:.1f} m, trunk {k["trunk_cm"]:.0f} cm, '
                f'{k["triangles"]["total"]:,} tris')
        tiles.append((text, [(kind, (0, 0, 0), 0.)], k['height_cm'] / 100))
    young = [m for m in entries if m.endswith(YOUNG)]
    tiles.append((f'young trees ({len(young)}), {entries[young[0]]["height_cm"] / 100:.0f} m\n'
                  'street crowns over 2.1 m, lawn conifers low',
                  [(m, (-.95 * (len(young) - 1) + 1.9 * i, 2.5 * (i % 2), 0), 25. * i) for i, m in enumerate(young)],
                  'young'))
    row = [('elm', -10.), ('linden', -2.), ('ash_young', 3.), ('norway_maple', 9.)]
    tiles.append(('street row\n3 m clearance line, 1.75 m figure', [(k, (x, 0, 0), 30. * i) for i, (k, x) in
                                                                     enumerate(row)], 'row'))
    tiles.append((f'leaf atlas ({COLS} x {ROWS} cells)\nand bark (2 m tile)', [], 'atlas'))
    assert len(tiles) == cols * rows, len(tiles)
    sheet = np.full((th * rows, tw * cols, 4), .3, dtype=np.float32)
    import tempfile
    tmp = Path(tempfile.mkdtemp(prefix='plateau_trees_'))
    for idx, (text, items, view) in enumerate(tiles):
        coll = bpy.data.collections.new(f'tile{idx}')
        scene.collection.children.link(coll)
        for name, loc, yaw in items:
            tree_object(name, coll, loc, yaw)
        if view == 'row':
            fig = bpy.data.meshes.new('figure')
            fig.from_pydata([(x, y, z) for z in (0, 1.75) for x, y in ((-.22, -.12), (.22, -.12), (.22, .12), (-.22, .12))],
                            [], [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)])
            fm = bpy.data.materials.new('figure')
            fm.use_nodes = True
            fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.05, .12, .4, 1)
            fig.materials.append(fm)
            fo = bpy.data.objects.new('figure', fig)
            fo.location = (2.2, -3., 0)
            coll.objects.link(fo)
            bar = bpy.data.meshes.new('clearance')
            bar.from_pydata([(-14, -3.5, 2.98), (12, -3.5, 2.98), (12, -3.5, 3.02), (-14, -3.5, 3.02)], [], [(0, 1, 2, 3)])
            bm = bpy.data.materials.new('clearance')
            bm.use_nodes = True
            bm.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (1, .1, .1, 1)
            bm.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 2.
            bar.materials.append(bm)
            coll.objects.link(bpy.data.objects.new('clearance', bar))
            aim((-1., 0, 7.), 52., -90., 5.)
        elif view == 'young':
            aim((0, 1.2, 2.6), 31., -90., 6.)
        elif view == 'atlas':
            plane = bpy.data.meshes.new('atlas')
            plane.from_pydata([(-3.6, 0, 3.), (3.6, 0, 3.), (3.6, 0, 6.6), (-3.6, 0, 6.6)], [], [(0, 1, 2, 3)])
            uv = plane.uv_layers.new(name='UVMap')
            uv.data.foreach_set('uv', [0, 0, 1, 0, 1, 1, 0, 1])
            plane.materials.append(leaf_mat)
            coll.objects.link(bpy.data.objects.new('atlas', plane))
            strip = bpy.data.meshes.new('bark')
            strip.from_pydata([(-3.6, 0, .6), (3.6, 0, .6), (3.6, 0, 2.6), (-3.6, 0, 2.6)], [], [(0, 1, 2, 3)])
            uv = strip.uv_layers.new(name='UVMap')
            uv.data.foreach_set('uv', [0, 0, 7.2, 0, 7.2, 2, 0, 2])
            strip.materials.append(bark_mats['norway_maple'])
            coll.objects.link(bpy.data.objects.new('bark', strip))
            aim((0, 0, 3.6), 14., -90., 0.)
        else:
            k = manifest['kinds'][items[0][0]]
            size = max(k['height_cm'] / 100, k['crown_width_cm'] / 100 * 1.3)
            aim((0, 0, k['height_cm'] / 200 + .4), size * 1.85, -60., 8.)
        lab = label(text)
        for other in bpy.data.collections:
            other.hide_render = other is not coll
        scene.render.filepath = str(tmp / f'tile{idx:02d}.png')
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(scene.render.filepath)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(th, tw, 4)
        r, c = divmod(idx, cols)
        sheet[(rows - 1 - r) * th:(rows - r) * th, c * tw:(c + 1) * tw] = px
        bpy.data.images.remove(img)
        bpy.data.objects.remove(lab)
        coll.hide_render = True
    sheet[..., 3] = 1.
    out = bpy.data.images.new('sheet', tw * cols, th * rows, alpha=False)
    out.pixels[:] = sheet.ravel()
    sheet_path.parent.mkdir(parents=True, exist_ok=True)
    out.filepath_raw = str(sheet_path)
    out.file_format = 'PNG'
    out.save()


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default=str(OUT))
    parser.add_argument('--sheet', default=str(SHEET))
    parser.add_argument('--no-render', action='store_true')
    parser.add_argument('--render-only', action='store_true', help='render the sheet from the files on disk')
    parser.add_argument('--samples', type=int, default=40)
    args = parser.parse_args(argv)
    out = Path(args.out)
    if args.render_only:
        manifest = json.loads((out / 'manifest.json').read_text())
    else:
        manifest = build(out)
        for model, k in model_entries(manifest):
            t = k['triangles']
            print(f'{model:19s} {k["height_cm"] / 100:5.1f} m  trunk {k["trunk_cm"]:5.1f} cm  crown base '
                  f'{k["crown_base_cm"]:5.0f} cm  width {k["crown_width_cm"] / 100:4.1f} m  {t["bark"]:6d} bark + '
                  f'{t["leaves"]:5d} leaf = {t["total"]:6d} tris ({k["cards"]} cards)')
        print('->', out)
    if not args.no_render:
        render_sheet(out, manifest, Path(args.sheet), args.samples)
        print('contact sheet ->', args.sheet)
    over = [m for m, v in model_entries(manifest) if v['triangles']['total'] > v['triangle_target']]
    return 1 if over else 0


def model_entries(manifest):
    """(model, entry) for every mesh in a manifest: each kind, then its young tree."""
    out = []
    for kind, k in manifest['kinds'].items():
        out.append((kind, k))
        if 'young' in k:
            out.append((kind + YOUNG, k['young']))
    return out


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    sys.exit(main(argv))
