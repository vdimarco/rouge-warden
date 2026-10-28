#pragma once

namespace QuebecShade
{
    // Krzysztof Narkowicz, ACES Filmic Tone Mapping Curve. The view blends the
    // engine filmic curve fully on. Gamma stays 1. Gain and offset are a warm grade
    // that lifts the dusk without flattening the shafts.
    inline constexpr float ToneCurveAmount = 1.f;
    inline constexpr float GradeGainR = 1.06f;
    inline constexpr float GradeGainG = 1.02f;
    inline constexpr float GradeGainB = 0.94f;
    inline constexpr float GradeOffsetR = 0.012f;
    inline constexpr float GradeOffsetG = 0.008f;
    inline constexpr float GradeOffsetB = 0.004f;
}
