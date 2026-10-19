// Offline UE 5.x API stub: Engine/Font.h
#pragma once
#include "UEStub/UObjectCore.h"
class UFont : public UObject
{
    UESTUB_UCLASS_BODY(UFont, UObject)
    UFont(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    int32 LegacyFontSize;
    float EmScale;
    float Ascent;
    float Descent;
    int32 Kerning;
    float ScalingFactor;
    void GetCharSize(TCHAR InCh, float& Width, float& Height) const;
    int8 GetCharKerning(TCHAR First, TCHAR Second) const;
    int16 GetStringSize(const TCHAR* Text) const;
    int16 GetStringHeightSize(const TCHAR* Text) const;
    float GetMaxCharHeight() const;
};
