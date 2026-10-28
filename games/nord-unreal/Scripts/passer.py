"""A walker and a car on the curb that already holds the bag pile.

The walker stands on the sidewalk, 700 cm past the pile along the road. The car
sits in the near lane, 1100 cm past the pile, facing the camera. The curb eye
stays. The opening aim stays.
"""

WALKER_ALONG_CM = 700.0
WALKER_LATERAL_CM = -850.0
WALKER_PHASE = 0.22
CAR_ALONG_CM = 1100.0
CAR_LATERAL_CM = -145.0


def curb_bodies(look, basis):
    """World points for the walker and the car, from the curb road basis."""
    _dist, qx, qy, fx, fy = basis
    rx, ry = -fy, fx
    yaw = look["yaw"]

    def at(along, lateral, z):
        return (
            qx + fx * along + rx * lateral,
            qy + fy * along + ry * lateral,
            z,
        )

    return {
        "walker": at(WALKER_ALONG_CM, WALKER_LATERAL_CM, 8.0),
        "walker_yaw": yaw + 180.0,
        "phase": WALKER_PHASE,
        "car": at(CAR_ALONG_CM, CAR_LATERAL_CM, 115.0),
        "car_yaw": yaw + 180.0,
    }
