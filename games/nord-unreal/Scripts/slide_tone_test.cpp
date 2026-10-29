// A played handbrake slide screams. A straight run and a gripped turn stay quiet.
// The car is the same one the slide banner test drives. Pass a path to write the slide as a 24 kHz WAV.

#ifdef QUEBEC_SLIDE_STRICT
#include <cmath>
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "slide_car.h"
#include "../Source/Quebec/QuebecSlideTone.h"

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <vector>

namespace
{
    using namespace SlideCar;

    int Failures = 0;
    int Assertions = 0;

    __attribute__((format(printf, 2, 3))) void Expect(bool Condition, const char* Format, ...)
    {
        ++Assertions;
        if (Condition) return;
        ++Failures;
        std::va_list Arguments;
        va_start(Arguments, Format);
        std::vfprintf(stderr, Format, Arguments);
        std::fputc('\n', stderr);
        va_end(Arguments);
    }

    struct FHeard
    {
        std::vector<float> Pcm;
        std::vector<float> Gain; // One per car frame, at the end of that frame's audio.
        float PeakGain = 0.f;
        float PeakSample = 0.f;
        float BiggestStep = 0.f; // The largest gain change between two samples.
    };

    // The drive loop sets one goal per tick and eases the gain per sample, as UpdateDriveAudio does.
    FHeard Listen(const std::vector<FSample>& Trace)
    {
        FHeard Heard;
        QuebecSlideTone::FVoice Voice;
        float Gain = 0.f;
        const int PerFrame = QuebecSlideTone::SampleRate / 60;
        for (const FSample& Frame : Trace)
        {
            const float Goal = QuebecSlideTone::Target(Frame.Speed, Frame.Lateral, Frame.bBrake);
            for (int Index = 0; Index < PerFrame; ++Index)
            {
                const float Before = Gain;
                Gain = QuebecSlideTone::Follow(Gain, Goal, 1.f / static_cast<float>(QuebecSlideTone::SampleRate));
                const float Sample = Voice.Sample(Gain);
                Heard.PeakSample = std::max(Heard.PeakSample, std::fabs(Sample));
                Heard.BiggestStep = std::max(Heard.BiggestStep, std::fabs(Gain - Before));
                Heard.Pcm.push_back(Sample);
            }
            Heard.PeakGain = std::max(Heard.PeakGain, Gain);
            Heard.Gain.push_back(Gain);
        }
        return Heard;
    }

    void WriteWav(const char* Path, const std::vector<float>& Pcm)
    {
        std::FILE* File = std::fopen(Path, "wb");
        if (!File) return;
        const std::uint32_t Rate = QuebecSlideTone::SampleRate;
        const std::uint32_t Bytes = static_cast<std::uint32_t>(Pcm.size() * 2);
        auto U32 = [File](std::uint32_t Value) { std::fwrite(&Value, 4, 1, File); };
        auto U16 = [File](std::uint16_t Value) { std::fwrite(&Value, 2, 1, File); };
        std::fwrite("RIFF", 1, 4, File); U32(36 + Bytes); std::fwrite("WAVEfmt ", 1, 8, File);
        U32(16); U16(1); U16(1); U32(Rate); U32(Rate * 2); U16(2); U16(16);
        std::fwrite("data", 1, 4, File); U32(Bytes);
        for (const float Sample : Pcm)
        {
            const float Clamped = std::max(-1.f, std::min(1.f, Sample));
            const std::int16_t Value = static_cast<std::int16_t>(std::lround(Clamped * 32767.f));
            std::fwrite(&Value, 2, 1, File);
        }
        std::fclose(File);
    }

    void TestRule()
    {
        Expect(QuebecSlideTone::SampleRate == 24000, "the drive loop runs at 24 kHz");
        Expect(QuebecSlideTone::Target(2000.f, 400.f, false) == 0.f, "no brake, no scream");
        Expect(QuebecSlideTone::Target(300.f, 400.f, true) == 0.f, "a slow shove is quiet");
        Expect(QuebecSlideTone::Target(2000.f, 170.f, true) == 0.f, "a lane wiggle is quiet");
        Expect(QuebecSlideTone::Target(2000.f, 180.f, true) > .44f, "the banner's line starts the scream");
        Expect(QuebecSlideTone::Target(2000.f, -600.f, true) == 1.f, "either side screams in full");
        Expect(QuebecSlideTone::Target(-2000.f, 600.f, true) == 1.f, "a reverse slide screams too");
        Expect(QuebecSlideTone::Follow(.3f, 1.f, 0.f) == .3f, "no time, no change");
        Expect(QuebecSlideTone::Follow(.3f, 1.f, 10.f) == 1.f, "a long step lands on the goal");
        QuebecSlideTone::FVoice Quiet;
        float Silence = 0.f;
        for (int Index = 0; Index < 2400; ++Index) Silence = std::max(Silence, std::fabs(Quiet.Sample(0.f)));
        Expect(Silence == 0.f, "zero gain is silence, got %f", static_cast<double>(Silence));
    }

    void TestSession(const char* WavPath)
    {
        std::vector<FSample> Trace;
        const FPhase Slide[] = {{3.f, false, 0.f, true}, {1.2f, true, 1.f, false}, {1.f, false, 0.f, false}};
        const FCar Car = Play(Slide, 3, &Trace);
        const FHeard Heard = Listen(Trace);
        Expect(Car.Slide.Pays == 1, "the slide still pays once, got %d", Car.Slide.Pays);
        int Live = -1, Pay = -1, Loud = -1, End = -1, Quiet = -1;
        for (int Index = 0; Index < static_cast<int>(Trace.size()); ++Index)
        {
            const FSample& Frame = Trace[static_cast<std::size_t>(Index)];
            if (Live < 0 && QuebecSlideTone::Target(Frame.Speed, Frame.Lateral, Frame.bBrake) > 0.f) Live = Index;
            if (Pay < 0 && Frame.Pays == 1) Pay = Index;
            if (Loud < 0 && Heard.Gain[static_cast<std::size_t>(Index)] > .4f) Loud = Index;
            const bool bLive = QuebecSlideTone::Target(Frame.Speed, Frame.Lateral, Frame.bBrake) > 0.f;
            if (Live >= 0 && End < 0 && !bLive) End = Index;
            if (End >= 0 && Quiet < 0 && Heard.Gain[static_cast<std::size_t>(Index)] < .02f) Quiet = Index;
        }
        const float Frame = 1.f / 60.f;
        Expect(Live >= 0 && Pay >= 0 && Loud >= 0 && End >= 0 && Quiet >= 0, "live %d pay %d loud %d end %d quiet %d", Live, Pay, Loud, End, Quiet);
        Expect(Loud - Live <= 6, "the scream is loud inside 0.1 s of the shove, took %d frames", Loud - Live);
        Expect(Pay >= 0 && Heard.Gain[static_cast<std::size_t>(Pay)] > .45f, "the banner lands as the scream fades, still loud");
        Expect(Heard.PeakGain > .9f, "a full slide screams near full, peak %f", static_cast<double>(Heard.PeakGain));
        Expect(Quiet - End <= 18, "the tires go quiet inside 0.3 s of the slide's end, took %d frames", Quiet - End);
        for (int Index = Live; Index < End; ++Index)
            Expect(Heard.Gain[static_cast<std::size_t>(Index)] > 0.f, "the scream holds through the slide, frame %d", Index);
        Expect(Heard.PeakSample <= QuebecSlideTone::Peak + .001f, "peak sample %f", static_cast<double>(Heard.PeakSample));
        Expect(Heard.BiggestStep < .001f, "the gain eases without a click, biggest step %f", static_cast<double>(Heard.BiggestStep));
        const auto At = [Frame](int Index) { return static_cast<double>(static_cast<float>(Index + 1) * Frame); };
        std::printf("live %.3f loud %.3f pay %.3f end %.3f quiet %.3f peak %.3f\n", At(Live), At(Loud), At(Pay), At(End), At(Quiet),
            static_cast<double>(Heard.PeakGain));
        for (std::size_t Index = 0; Index < Trace.size(); ++Index)
            std::printf("gain %.4f %.2f %.4f %d\n", static_cast<double>(Trace[Index].Time), static_cast<double>(Trace[Index].Lateral),
                static_cast<double>(Heard.Gain[Index]), Trace[Index].Pays);
        if (WavPath) WriteWav(WavPath, Heard.Pcm);

        std::vector<FSample> Straight;
        const FPhase Gas[] = {{4.f, false, 0.f, true}};
        Play(Gas, 1, &Straight);
        Expect(Listen(Straight).PeakSample == 0.f, "a straight run is quiet");
        std::vector<FSample> Gripped;
        const FPhase NoBrake[] = {{3.f, false, 0.f, true}, {1.2f, false, 1.f, true}};
        Play(NoBrake, 2, &Gripped);
        Expect(Listen(Gripped).PeakSample == 0.f, "a gripped turn keeps only the drive-loop hiss");
        std::vector<FSample> Stopped;
        const FPhase Brake[] = {{3.f, false, 0.f, true}, {2.f, true, 0.f, false}};
        Play(Brake, 2, &Stopped);
        Expect(Listen(Stopped).PeakSample == 0.f, "a straight handbrake stop is the skid chirp only");
    }
}

int main(int Count, char** Arguments)
{
    TestRule();
    TestSession(Count > 1 ? Arguments[1] : nullptr);
    std::printf("%d failures\n", Failures);
    std::printf("%d assertions\n", Assertions);
    return Failures == 0 ? 0 : 1;
}
