#pragma once

// Original spoken lines for the eleven park residents. The words are their
// dialogue. espeak-ng speaks them. Each giver has a different voice.
// No cooked asset. The samples are committed, so play does not need espeak-ng.
// 0: en-gb-x-rp+m2 pitch 28 speed 138
// 1: en-gb+m5 pitch 58 speed 128
// 2: en-us+f3 pitch 64 speed 150
// 3: en-us+m3 pitch 42 speed 156
// 4: en-us-nyc+m4 pitch 36 speed 148
// 5: en-gb-scotland+m3 pitch 34 speed 142
// 6: en-us+m1 pitch 52 speed 150
// 7: en-029+m3 pitch 40 speed 152
// 8: en-us+f4 pitch 72 speed 158
// 9: en-gb+m7 pitch 18 speed 136
// 10: en-us+f2 pitch 60 speed 146

#include <cstdint>

namespace QuebecBarks
{
    inline constexpr int SampleRate = 11025;
    inline constexpr int LineCount = 11;
    inline constexpr int Begin[LineCount] = {0, 32372, 82712, 124815, 158800, 205673, 243192, 280000, 316100, 352385, 396260};
    inline constexpr int Count[LineCount] = {32372, 50340, 42103, 33985, 46873, 37519, 36808, 36100, 36285, 43875, 47234};
    inline constexpr int PcmSamples = 443494;

    inline const char* Line(int Style)
    {
        static const char* Lines[LineCount] = {
        "My superpower? A hole lot of courage.",
        "I came for the picnic. I stayed for the existential crumbs.",
        "Stay cheesy, Montreal. The fries are counting on you.",
        "Team cottage! Montreal is our warm-up lap.",
        "Thirty-three points. One plunger. No refunds.",
        "I brought backup. It is mostly plumbing supplies.",
        "White cap, black coffee, questionable plan.",
        "I only swing for the fences. And blocked drains.",
        "This jacket is visible from orbit. You are welcome.",
        "Heavy metal. Light luggage. Emergency plunger.",
        "The bag has everything. Except a sensible explanation."
        };
        if (Style < 0) Style = 0;
        if (Style >= LineCount) Style = LineCount - 1;
        return Lines[Style];
    }

    struct FSpan
    {
        int Begin = 0;
        int Count = 0;
    };

    inline FSpan Span(int Style)
    {
        if (Style < 0) Style = 0;
        if (Style >= LineCount) Style = LineCount - 1;
        return {Begin[Style], Count[Style]};
    }

#include "QuebecBarkPcm.inc"

    inline int Decode(std::int16_t* Dest, int Capacity)
    {
        auto Value = [](char Digit) -> int
        {
            if (Digit >= 'A' && Digit <= 'Z') return Digit - 'A';
            if (Digit >= 'a' && Digit <= 'z') return Digit - 'a' + 26;
            if (Digit >= '0' && Digit <= '9') return Digit - '0' + 52;
            if (Digit == '+') return 62;
            if (Digit == '/') return 63;
            return -1;
        };
        int Samples = 0;
        int Bits = 0;
        unsigned int Acc = 0;
        for (const char* Cursor = PcmBase64; *Cursor; ++Cursor)
        {
            const int Digit = Value(*Cursor);
            if (Digit < 0) continue;
            Acc = (Acc << 6) | static_cast<unsigned int>(Digit);
            Bits += 6;
            if (Bits < 8) continue;
            Bits -= 8;
            const unsigned int Byte = (Acc >> Bits) & 0xffu;
            if ((Samples & 1) == 0)
            {
                if (Samples / 2 < Capacity) Dest[Samples / 2] = static_cast<std::int16_t>(Byte);
            }
            else if (Samples / 2 < Capacity)
            {
                const unsigned int Word = static_cast<unsigned int>(static_cast<std::uint16_t>(Dest[Samples / 2])) | (Byte << 8);
                Dest[Samples / 2] = static_cast<std::int16_t>(Word);
            }
            ++Samples;
        }
        return Samples / 2;
    }
}
