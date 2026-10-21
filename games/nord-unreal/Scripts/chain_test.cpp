// Standalone test for Source/Quebec/QuebecChain.h. Built by Scripts/test_chain.py.

#ifdef QUEBEC_CHAIN_STRICT
#pragma GCC poison PI HALF_PI TWO_PI INV_PI UE_PI check checkf checkSlow verify verifyf ensure ensureMsgf TEXT SMALL_NUMBER KINDA_SMALL_NUMBER BIG_NUMBER DELTA FORCEINLINE UE_LOG FVector FString TArray
#endif
#include "../Source/Quebec/QuebecChain.h"

#include <cstdarg>
#include <cstdio>

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
    using namespace QuebecChain;
    for (int Link = 1; Link < LinkCount; ++Link)
        Expect(Base[Link] > Base[Link - 1], "base %d does not escalate", Link);

    Expect(OpenLink(false, false, false, false, false, false, false) == LinkTerrace, "the terrace is the open stake before the lap banks");
    Expect(OpenLink(true, true, false, false, false, false, false) == LinkPond, "an open picnic takes the stake");
    Expect(OpenLink(true, false, true, false, false, false, false) == LinkCourt, "an open court takes the stake");
    Expect(OpenLink(true, false, false, false, false, false, true) == LinkBlank, "the last page takes the stake");
    Expect(OpenLink(true, false, false, false, false, false, false) == -1, "a finished city has no open stake");
    Expect(OpenLink(true, true, true, true, true, true, true) == LinkPond, "the earliest open beat keeps the stake");

    int Chain = 0;
    int Mask = 0;
    int Perfect = 0;
    for (int Link = 0; Link < LinkCount; ++Link)
    {
        const int Before = Chain;
        const FBank Step = Bank(Chain, Mask, false, Link);
        Expect(Step.Pay == Base[Link] * (Before + 1), "clean link %d pay", Link);
        Expect(Step.Chain == Before + 1, "clean link %d chain", Link);
        Expect(!Step.bSpoiled, "a clean bank is not spoiled");
        Perfect += Step.Pay;
        Chain = Step.Chain;
        Mask = Step.Mask;
    }
    Expect(Chain == LinkCount, "seven clean banks hold a chain of seven");
    Expect(Mask == (1 << LinkCount) - 1, "every beat is marked paid");

    int SpoiledPay = 0;
    Chain = 0;
    Mask = 0;
    for (int Link = 0; Link < LinkCount; ++Link)
    {
        const FBank Step = Bank(0, Mask, true, Link);
        Expect(Step.Pay == Base[Link], "spoiled link %d pays the flat base", Link);
        Expect(Step.Chain == 0, "a spoiled bank does not start the chain");
        Expect(!Step.bSpoiled, "the spoil clears so the next beat can be clean");
        SpoiledPay += Step.Pay;
        Mask = Step.Mask;
    }
    Expect(Perfect > SpoiledPay * 2, "a clean run pays more than twice a spoiled run");

    const FBank Terrace = Bank(0, 0, false, LinkTerrace);
    const FBank Pond = Bank(Terrace.Chain, Terrace.Mask, false, LinkPond);
    Expect(Stake(Pond.Chain, false, LinkCourt) == Base[LinkCourt] * (Pond.Chain + 1), "a held chain raises the court stake");
    Expect(Stake(0, true, LinkCourt) == Base[LinkCourt], "a break drops the court stake to the flat base");
    const FBank Missed = Bank(0, Pond.Mask, true, LinkCourt);
    Expect(Missed.Pay == Base[LinkCourt] && Missed.Chain == 0, "the court after a miss pays flat");
    const FBank Show = Bank(Missed.Chain, Missed.Mask, false, LinkShow);
    Expect(Show.Pay == Base[LinkShow] && Show.Chain == 1, "the next clean beat starts the chain at one");

    const FBank Again = Bank(Show.Chain, Show.Mask, false, LinkShow);
    Expect(Again.Pay == 0 && Again.Chain == Show.Chain && Again.Mask == Show.Mask, "a beat pays once");

    Expect(Stake(6, false, LinkBlank) == Base[LinkBlank] * 7, "the last page at a full chain is the top stake");
    Expect(Stake(-3, false, LinkPond) == Base[LinkPond], "a negative chain is treated as zero");
    Expect(Bank(2, 0, false, -1).Pay == 0, "an unknown beat pays nothing");
    Expect(Bank(2, 0, false, 9).Pay == 0, "a beat past the list pays nothing");

    const FBank DirtyLap = Bank(0, 0, true, LinkTerrace);
    const FBank AfterDirty = Bank(DirtyLap.Chain, DirtyLap.Mask, false, LinkPond);
    Expect(DirtyLap.Pay == Base[LinkTerrace] && DirtyLap.Chain == 0, "a retried lap pays the flat terrace");
    Expect(AfterDirty.Pay == Base[LinkPond], "the picnic after a retried lap is still at one");

    std::printf("%d assertions, %d failures\n", Assertions, Failures);
    return Failures == 0 ? 0 : 1;
}
