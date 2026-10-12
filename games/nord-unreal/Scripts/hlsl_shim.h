// Just enough HLSL to compile the Custom node bodies in Scripts/*.hlsl as C++ for CPU tests.
// Vectors have no swizzles, no scalar splat constructor and no implicit conversions, so a body
// that compiles here also uses only constructs the material compiler accepts in the same way.
#pragma once

#include <cmath>

namespace Hlsl
{
    struct float2
    {
        float x = 0.f, y = 0.f;
        float2() = default;
        float2(float X, float Y) : x(X), y(Y) {}
    };

    struct float3
    {
        float x = 0.f, y = 0.f, z = 0.f;
        float3() = default;
        float3(float X, float Y, float Z) : x(X), y(Y), z(Z) {}
        float3(float2 XY, float Z) : x(XY.x), y(XY.y), z(Z) {}
    };

    struct float4
    {
        float x = 0.f, y = 0.f, z = 0.f, w = 0.f;
        float4() = default;
        float4(float X, float Y, float Z, float W) : x(X), y(Y), z(Z), w(W) {}
        float4(float3 XYZ, float W) : x(XYZ.x), y(XYZ.y), z(XYZ.z), w(W) {}
    };

    inline float2 operator+(float2 A, float2 B) { return float2(A.x + B.x, A.y + B.y); }
    inline float2 operator-(float2 A, float2 B) { return float2(A.x - B.x, A.y - B.y); }
    inline float2 operator*(float2 A, float2 B) { return float2(A.x * B.x, A.y * B.y); }
    inline float2 operator/(float2 A, float2 B) { return float2(A.x / B.x, A.y / B.y); }
    inline float2 operator+(float2 A, float B) { return float2(A.x + B, A.y + B); }
    inline float2 operator-(float2 A, float B) { return float2(A.x - B, A.y - B); }
    inline float2 operator*(float2 A, float B) { return float2(A.x * B, A.y * B); }
    inline float2 operator/(float2 A, float B) { return float2(A.x / B, A.y / B); }
    inline float2 operator+(float A, float2 B) { return float2(A + B.x, A + B.y); }
    inline float2 operator-(float A, float2 B) { return float2(A - B.x, A - B.y); }
    inline float2 operator*(float A, float2 B) { return float2(A * B.x, A * B.y); }
    inline float2 operator-(float2 A) { return float2(-A.x, -A.y); }
    inline float2& operator+=(float2& A, float2 B) { return A = A + B; }
    inline float2& operator-=(float2& A, float2 B) { return A = A - B; }
    inline float2& operator*=(float2& A, float B) { return A = A * B; }

    inline float3 operator+(float3 A, float3 B) { return float3(A.x + B.x, A.y + B.y, A.z + B.z); }
    inline float3 operator-(float3 A, float3 B) { return float3(A.x - B.x, A.y - B.y, A.z - B.z); }
    inline float3 operator*(float3 A, float3 B) { return float3(A.x * B.x, A.y * B.y, A.z * B.z); }
    inline float3 operator/(float3 A, float3 B) { return float3(A.x / B.x, A.y / B.y, A.z / B.z); }
    inline float3 operator+(float3 A, float B) { return float3(A.x + B, A.y + B, A.z + B); }
    inline float3 operator-(float3 A, float B) { return float3(A.x - B, A.y - B, A.z - B); }
    inline float3 operator*(float3 A, float B) { return float3(A.x * B, A.y * B, A.z * B); }
    inline float3 operator/(float3 A, float B) { return float3(A.x / B, A.y / B, A.z / B); }
    inline float3 operator*(float A, float3 B) { return float3(A * B.x, A * B.y, A * B.z); }
    inline float3 operator-(float3 A) { return float3(-A.x, -A.y, -A.z); }
    inline float3& operator+=(float3& A, float3 B) { return A = A + B; }
    inline float3& operator+=(float3& A, float B) { return A = A + B; }
    inline float3& operator*=(float3& A, float B) { return A = A * B; }

    inline float sin(float V) { return std::sin(V); }
    inline float cos(float V) { return std::cos(V); }
    inline float sqrt(float V) { return std::sqrt(V); }
    inline float exp(float V) { return std::exp(V); }
    inline float abs(float V) { return std::fabs(V); }
    inline float floor(float V) { return std::floor(V); }
    inline float round(float V) { return std::round(V); }
    inline float frac(float V) { return V - std::floor(V); }
    inline float min(float A, float B) { return A < B ? A : B; }
    inline float max(float A, float B) { return A > B ? A : B; }
    inline float saturate(float V) { return min(max(V, 0.f), 1.f); }
    inline float lerp(float A, float B, float T) { return A + (B - A) * T; }
    inline float step(float Edge, float V) { return V >= Edge ? 1.f : 0.f; }
    inline float smoothstep(float A, float B, float V)
    {
        const float T = saturate((V - A) / (B - A));
        return T * T * (3.f - 2.f * T);
    }

    inline float2 floor(float2 V) { return float2(floor(V.x), floor(V.y)); }
    inline float3 floor(float3 V) { return float3(floor(V.x), floor(V.y), floor(V.z)); }
    inline float2 frac(float2 V) { return float2(frac(V.x), frac(V.y)); }
    inline float3 frac(float3 V) { return float3(frac(V.x), frac(V.y), frac(V.z)); }
    inline float2 min(float2 A, float2 B) { return float2(min(A.x, B.x), min(A.y, B.y)); }
    inline float3 min(float3 A, float3 B) { return float3(min(A.x, B.x), min(A.y, B.y), min(A.z, B.z)); }
    inline float2 max(float2 A, float2 B) { return float2(max(A.x, B.x), max(A.y, B.y)); }
    inline float3 max(float3 A, float3 B) { return float3(max(A.x, B.x), max(A.y, B.y), max(A.z, B.z)); }
    inline float2 lerp(float2 A, float2 B, float T) { return A + (B - A) * T; }
    inline float3 lerp(float3 A, float3 B, float T) { return A + (B - A) * T; }
    inline float dot(float2 A, float2 B) { return A.x * B.x + A.y * B.y; }
    inline float dot(float3 A, float3 B) { return A.x * B.x + A.y * B.y + A.z * B.z; }
    inline float length(float2 V) { return sqrt(dot(V, V)); }
    inline float length(float3 V) { return sqrt(dot(V, V)); }
    inline float2 normalize(float2 V) { return V / length(V); }
    inline float3 normalize(float3 V) { return V / length(V); }
}
