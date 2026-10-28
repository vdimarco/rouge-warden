#pragma once
#include "UEStub/UObjectCore.h"
struct FSoundAttenuationSettings { float FalloffDistance; uint8 bAttenuate : 1; uint8 bSpatialize : 1; };
class USoundAttenuation : public UObject
{
    UESTUB_UCLASS_BODY(USoundAttenuation, UObject)
    USoundAttenuation(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    FSoundAttenuationSettings Attenuation;
};
