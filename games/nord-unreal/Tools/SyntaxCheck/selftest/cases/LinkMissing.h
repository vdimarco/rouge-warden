// EXPECT: PASS
// LINK-EXPECT: QuebecTraces::Missing\(int\)
// LINK-EXPECT: AQuebecLinkProbe::Declared\(\)
// LINK-EXPECT: AQuebecLinkProbe::Tick\(float\)
// LINK-REJECT: ServerGo\(|StaticClass|FObjectInitializer
// Compiles cleanly but cannot link: functions declared, called and never defined.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "LinkMissing.generated.h"

namespace QuebecTraces { float Missing(int Count); }

UCLASS()
class AQuebecLinkProbe : public AActor
{
    GENERATED_BODY()
public:
    virtual void Tick(float DeltaSeconds) override;
    void Declared();
    void Run();
    UFUNCTION(Server, Reliable) void ServerGo();
};
