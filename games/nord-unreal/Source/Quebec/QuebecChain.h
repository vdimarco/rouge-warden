#pragma once

// Session chain for the seven story banks. A clean bank pays the beat's base
// times the chain already held, then the chain grows. A miss spoils the open
// beat: it pays the flat base and the chain starts over. Not part of the v1 save.

namespace QuebecChain
{
    inline constexpr int LinkCount = 7;
    inline constexpr int LinkTerrace = 0;
    inline constexpr int LinkPond = 1;
    inline constexpr int LinkCourt = 2;
    inline constexpr int LinkShow = 3;
    inline constexpr int LinkRescue = 4;
    inline constexpr int LinkConvoy = 5;
    inline constexpr int LinkBlank = 6;
    inline constexpr int Base[LinkCount] = {100, 160, 240, 340, 460, 600, 780};

    struct FBank
    {
        int Pay = 0;
        int Chain = 0;
        int Mask = 0;
        bool bSpoiled = false;
    };

    inline int OpenLink(bool bComplete, bool bPond, bool bCourt, bool bShow, bool bRescue, bool bConvoy, bool bBlank)
    {
        if (!bComplete) return LinkTerrace;
        if (bPond) return LinkPond;
        if (bCourt) return LinkCourt;
        if (bShow) return LinkShow;
        if (bRescue) return LinkRescue;
        if (bConvoy) return LinkConvoy;
        if (bBlank) return LinkBlank;
        return -1;
    }

    inline int Multiplier(int Chain, bool bSpoiled)
    {
        if (bSpoiled) return 1;
        if (Chain < 0) Chain = 0;
        const int Mult = Chain + 1;
        return Mult > LinkCount ? LinkCount : Mult;
    }

    inline int Scaled(int Chain, bool bSpoiled, int Amount)
    {
        if (Amount <= 0) return 0;
        return Amount * Multiplier(Chain, bSpoiled);
    }

    inline int Stake(int Chain, bool bSpoiled, int Link)
    {
        if (Link < 0 || Link >= LinkCount) return 0;
        return Scaled(Chain, bSpoiled, Base[Link]);
    }

    inline FBank Bank(int Chain, int Mask, bool bSpoiled, int Link)
    {
        FBank Out;
        Out.Chain = Chain < 0 ? 0 : Chain;
        Out.Mask = Mask;
        Out.bSpoiled = bSpoiled;
        if (Link < 0 || Link >= LinkCount) return Out;
        const int Bit = 1 << Link;
        if ((Mask & Bit) != 0) return Out;
        Out.Mask = Mask | Bit;
        if (bSpoiled)
        {
            Out.Pay = Base[Link];
            Out.Chain = 0;
            Out.bSpoiled = false;
            return Out;
        }
        Out.Pay = Base[Link] * (Out.Chain + 1);
        Out.Chain = Out.Chain + 1;
        if (Out.Chain > LinkCount) Out.Chain = LinkCount;
        return Out;
    }

    // A side job can pay again. The story mask stays. A spoil pays the flat amount and clears the chain.
    inline FBank Extend(int Chain, int Mask, bool bSpoiled, int Amount)
    {
        FBank Out;
        Out.Chain = Chain < 0 ? 0 : Chain;
        Out.Mask = Mask;
        Out.bSpoiled = bSpoiled;
        if (Amount <= 0) return Out;
        Out.Pay = Scaled(Out.Chain, bSpoiled, Amount);
        Out.bSpoiled = false;
        if (bSpoiled)
        {
            Out.Chain = 0;
            return Out;
        }
        if (Out.Chain < LinkCount) ++Out.Chain;
        return Out;
    }
}
