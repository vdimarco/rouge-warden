"""A park tree's crown is a checked-in canopy, not an ellipsoid.

Broadleaf files are Canopy{style}_{variant}.obj from the environment refresh.
Each one keeps Leaf0, Leaf1 and Leaf2: a shaded underside, a mid mass, and a
sunlit cap, with the masses sitting on the limbs. Conifers use Canopy2_0.
The falling-leaf cards stay at ten slots. The opening aim stays.
"""

LEAF_SHADE = (0.48, 0.82, 1.08)


def canopy_name(tree):
    style = int(tree["style"])
    variant = 0 if style == 2 else (int(tree["seed"]) // 11) % 4
    return f"Canopy{style}_{variant}.obj"


def crown_place(tree, radius_cm, zmin, zmax):
    """Scale a canopy so its top is the tree height and its width is the crown.

    The vertical span matches the old ellipsoid: the bottom sits at 23 percent
    of the height and the top sits on the height.
    """
    span = float(zmax) - float(zmin)
    sxy = float(tree["crown_radius_cm"]) / float(radius_cm)
    sz = float(tree["height_cm"]) * 0.77 / span
    z0 = float(tree["height_cm"]) - float(zmax) * sz
    return sxy, sz, z0
