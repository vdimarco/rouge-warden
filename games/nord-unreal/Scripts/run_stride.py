"""How far one play of the hoodie run travels.

Sprint is 800 cm/s. The clip plays at that speed divided by 600, so one
cycle covers 600 cm on the ground.
"""


def cycle_cm(sprint_cm_per_second, rate_reference_cm):
    rate = sprint_cm_per_second / rate_reference_cm
    return sprint_cm_per_second / rate
