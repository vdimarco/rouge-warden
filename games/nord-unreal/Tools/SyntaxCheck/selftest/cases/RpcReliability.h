// EXPECT: must specify Reliable or Unreliable
// UHT rejects an RPC without Reliable/Unreliable.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "RpcReliability.generated.h"

UCLASS()
class ARpcReliability : public AActor
{
    GENERATED_BODY()
public:
    UFUNCTION(Server)
    void ServerJump();
};
