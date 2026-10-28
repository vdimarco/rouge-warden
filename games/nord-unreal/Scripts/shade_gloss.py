"""GGX specular for a wet road and a car clearcoat.

Walter, Microfacet Models for Refraction through Rough Surfaces (EGSR 2007).
Schlick, An Inexpensive BRDF Model for Physically-based Rendering (1994).
Karis, Real Shading in Unreal Engine 4 (SIGGRAPH 2013), for the sky weight.
The numbers match QuebecGloss.h.
"""
import math

import numpy as np

WET_ROUGHNESS = 0.15
CAR_ROUGHNESS = 0.22
WET_F0 = 0.04
CAR_F0 = 0.04
SPECULAR_SCALE = 1.0


def _unit(vector):
    return vector / np.maximum(np.linalg.norm(vector, axis=-1, keepdims=True), 1e-6)


def env_weight(roughness, nov, f0):
    """Karis split-sum scale and bias. nov is the clamped n·v."""
    nov = np.clip(np.asarray(nov, dtype=np.float64), 0.0, 1.0)
    roughness = np.float64(roughness)
    f0 = np.float64(f0)
    c0 = np.array([-1.0, -0.0275, -0.572, 0.022])
    c1 = np.array([1.0, 0.0425, 1.04, -0.04])
    row = roughness * c0 + c1
    a004 = np.minimum(row[0] * row[0], np.exp2(-9.28 * nov)) * row[0] + row[1]
    ab = np.array([-1.04, 1.04]) * np.asarray(a004)[..., None] + row[2:]
    return np.clip((f0 * ab[..., 0] + ab[..., 1]) * SPECULAR_SCALE, 0.0, 1.0)


def ggx_direct(normal, view, light, roughness, f0):
    """Specular radiance for a white light. view points from the surface toward the camera."""
    normal = _unit(np.asarray(normal, dtype=np.float64))
    view = _unit(np.asarray(view, dtype=np.float64))
    light = _unit(np.asarray(light, dtype=np.float64))
    nov = np.clip(np.sum(normal * view, axis=-1), 0.0, 1.0)
    nol = np.clip(np.sum(normal * light, axis=-1), 0.0, 1.0)
    half = _unit(light + view)
    noh = np.clip(np.sum(normal * half, axis=-1), 0.0, 1.0)
    voh = np.clip(np.sum(view * half, axis=-1), 0.0, 1.0)
    alpha = np.float64(roughness) * np.float64(roughness)
    alpha2 = alpha * alpha
    denom = noh * noh * (alpha2 - 1.0) + 1.0
    distribution = alpha2 / (math.pi * denom * denom)
    k = (np.float64(roughness) + 1.0) ** 2 / 8.0
    geometry = (nov / (nov * (1.0 - k) + k)) * (nol / (nol * (1.0 - k) + k))
    fresnel = np.float64(f0) + (1.0 - np.float64(f0)) * (1.0 - voh) ** 5
    direct = distribution * geometry * fresnel / (4.0 * np.maximum(nov, 1e-4)) * SPECULAR_SCALE
    return np.where(nol > 0.0, direct, 0.0)


def reflect_view(normal, view):
    """Direction of the reflected view ray, for a sky sample."""
    normal = _unit(np.asarray(normal, dtype=np.float64))
    view = _unit(np.asarray(view, dtype=np.float64))
    ray = -view
    return ray - 2.0 * np.sum(ray * normal, axis=-1, keepdims=True) * normal
