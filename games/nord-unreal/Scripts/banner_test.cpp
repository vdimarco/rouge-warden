#ifdef QUEBEC_BANNER_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecBanner.h"

#include <cstdio>
#include <cstring>

namespace
{
    int Assertions = 0;
    int Failures = 0;

    void Expect(bool Condition, const char* What)
    {
        ++Assertions;
        if (!Condition)
        {
            ++Failures;
            std::fprintf(stderr, "FAIL %s\n", What);
        }
    }

    bool HasFrench(const std::string& Text)
    {
        return Text.find("\xC3\xA9") != std::string::npos
            || Text.find("\xC3\xA8") != std::string::npos
            || Text.find("\xC3\xAA") != std::string::npos
            || Text.find("\xC3\xA0") != std::string::npos;
    }
}

int main()
{
    using namespace QuebecBanner;
    const char* Lines[] = {
        Done, Failed, KeyRetry, Abandoned, Arrested, KnockedOut, TimeUp, Crushed, Delivered,
        ThiefGone, Wrecked, Recovered, LostThief, NoGoons, LeftTheatre, TheatreSaved, Garaged,
        PoliceLost, PostersUp, FareLeft, FareDone
    };
    for (const char* Line : Lines)
        Expect(PlainEnglish(Line) && !HasFrench(Line), "a result line still uses a French accent");

    Expect(std::strcmp(Done, "MISSION DONE") == 0 && std::strcmp(Failed, "MISSION FAILED") == 0, "the plate heads left the English words");
    Expect(std::strcmp(KeyRetry, "R restarts") == 0 && std::strcmp(TouchRetry, "Menu · Recover") == 0, "the retry left the English words");

    const FPlate FailedKey = Compose(false, 0, Arrested, false, true);
    Expect(std::strcmp(FailedKey.Head, Failed) == 0, "a failure used the success head");
    Expect(FailedKey.Line == "Arrested by the police  ·  R restarts", "the keyboard failure line drifted");
    Expect(!HasFrench(FailedKey.Line), "the keyboard failure line mixed languages");

    const FPlate FailedTouch = Compose(false, 0, TimeUp, true, true);
    Expect(FailedTouch.Line == "Time ran out  ·  Menu · Recover", "the touch failure line drifted");
    Expect(!HasFrench(FailedTouch.Line), "the touch failure line mixed languages");

    const FPlate Closed = Compose(false, 0, KnockedOut, false, false);
    Expect(Closed.Line == "Knocked out", "a closed retry still offered R");

    const FPlate Paid = Compose(true, 300, Delivered, false, false);
    Expect(std::strcmp(Paid.Head, Done) == 0, "a success used the failure head");
    Expect(Paid.Line == "+300 $  ·  Three doors delivered, still hot", "the success line drifted");
    Expect(!HasFrench(Paid.Line), "the success line mixed languages");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
