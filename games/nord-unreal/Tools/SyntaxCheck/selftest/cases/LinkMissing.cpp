// EXPECT: PASS
#include "LinkMissing.h"
#include "Engine/World.h"

void AQuebecLinkProbe::Run()
{
    Declared();
    ServerGo();
    const float Value = QuebecTraces::Missing(1);
    (void)Value;
    GetWorld()->SpawnActor<AQuebecLinkProbe>(AQuebecLinkProbe::StaticClass());
}

void AQuebecLinkProbe::ServerGo_Implementation() {}
