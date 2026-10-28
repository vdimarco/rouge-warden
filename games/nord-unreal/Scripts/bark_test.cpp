// Standalone test for Source/Quebec/QuebecBarks.h. Built by Scripts/test_barks.py.

#ifdef QUEBEC_BARKS_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecBarks.h"

#include <cstdarg>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace
{
    int Failures = 0;
    int Assertions = 0;

    __attribute__((format(printf, 2, 3))) void Expect(bool Condition, const char* Format, ...)
    {
        ++Assertions;
        if (Condition) return;
        ++Failures;
        std::va_list Arguments;
        va_start(Arguments, Format);
        std::fputs("FAIL: ", stderr);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }
}

int main()
{
    using namespace QuebecBarks;
    Expect(LineCount == 11, "eleven givers");
    Expect(std::strcmp(Line(0), "My superpower? A hole lot of courage.") == 0, "bagel line");
    Expect(std::strcmp(Line(2), "Stay cheesy, Montreal. The fries are counting on you.") == 0, "poutine line");
    Expect(std::strcmp(Line(10), "The bag has everything. Except a sensible explanation.") == 0, "plunger line");
    Expect(std::strcmp(Line(-4), Line(0)) == 0, "low style clamps");
    Expect(std::strcmp(Line(40), Line(10)) == 0, "high style clamps");

    int Covered = 0;
    for (int Style = 0; Style < LineCount; ++Style)
    {
        const FSpan Piece = Span(Style);
        Expect(Piece.Begin == Covered, "line %d does not continue the buffer", Style);
        Expect(Piece.Count > SampleRate && Piece.Count < SampleRate * 6, "line %d length", Style);
        Covered += Piece.Count;
        Expect(Line(Style)[0] != '\0', "line %d text", Style);
    }
    Expect(Covered == PcmSamples, "the lines fill the buffer");

    std::vector<std::int16_t> Pcm(static_cast<std::size_t>(PcmSamples));
    Expect(Decode(Pcm.data(), PcmSamples) == PcmSamples, "decode length");

    for (int Style = 0; Style < LineCount; ++Style)
    {
        const FSpan Piece = Span(Style);
        const std::int16_t* Samples = Pcm.data() + Piece.Begin;
        double Energy = 0.;
        int Crossings = 0;
        int Peak = 0;
        for (int Frame = 0; Frame < Piece.Count; ++Frame)
        {
            const int Sample = Samples[Frame];
            Energy += static_cast<double>(Sample) * static_cast<double>(Sample);
            if (std::abs(Sample) > Peak) Peak = std::abs(Sample);
            if (Frame > 0 && ((Samples[Frame - 1] < 0 && Sample >= 0) || (Samples[Frame - 1] >= 0 && Sample < 0))) ++Crossings;
        }
        const double Rms = std::sqrt(Energy / static_cast<double>(Piece.Count));
        const double Rate = static_cast<double>(Crossings) / static_cast<double>(Piece.Count);
        Expect(Rms > 800., "line %d is quiet", Style);
        Expect(Peak > 4000 && Peak <= 32767, "line %d peak", Style);
        Expect(Rate > 0.02 && Rate < 0.30, "line %d is not speech-like", Style);
        int Edge = 0;
        for (int Frame = 0; Frame < 24; ++Frame)
        {
            if (std::abs(Samples[Frame]) > Edge) Edge = std::abs(Samples[Frame]);
            if (std::abs(Samples[Piece.Count - 1 - Frame]) > Edge) Edge = std::abs(Samples[Piece.Count - 1 - Frame]);
        }
        Expect(Edge < 600, "line %d edge is loud", Style);
        unsigned int Hash = 2166136261u;
        for (int Frame = 0; Frame < Piece.Count; ++Frame)
        {
            Hash ^= static_cast<unsigned int>(static_cast<std::uint16_t>(Samples[Frame]));
            Hash *= 16777619u;
        }
        Expect(Hash != 2166136261u, "line %d hashes empty", Style);
        for (int Other = 0; Other < Style; ++Other)
        {
            const FSpan Earlier = Span(Other);
            unsigned int OtherHash = 2166136261u;
            const std::int16_t* EarlierSamples = Pcm.data() + Earlier.Begin;
            for (int Frame = 0; Frame < Earlier.Count; ++Frame)
            {
                OtherHash ^= static_cast<unsigned int>(static_cast<std::uint16_t>(EarlierSamples[Frame]));
                OtherHash *= 16777619u;
            }
            Expect(Hash != OtherHash, "line %d repeats giver %d", Style, Other);
        }
    }

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
