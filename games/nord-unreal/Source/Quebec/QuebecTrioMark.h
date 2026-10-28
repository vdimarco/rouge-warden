#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "QuebecTrioMark.generated.h"

class UMaterialInterface;
class USceneComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

/**
 * Three sidewalk posts. Walk them in order. The purse is session cash, paid once
 * to the person who tagged the first post. The rules live in QuebecTrio.h.
 * Nothing is saved. This is not a story mission.
 */
UCLASS(NotPlaceable)
class QUEBEC_API AQuebecTrio : public AActor
{
    GENERATED_BODY()
public:
    AQuebecTrio();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

    static AQuebecTrio* Find(const UWorld* World);
    // The next post, while the walk is open. Empty when it is done.
    FString WalkLine() const;

private:
    // 0, 1, 2, then 3 when the third post is tagged.
    UPROPERTY(Replicated) int32 Step = 0;
    int32 Runner = -1;
    UPROPERTY() TObjectPtr<USceneComponent> Scene;
    UPROPERTY() TObjectPtr<UStaticMesh> Cylinder;
    bool bBuilt = false;

    void BuildPosts();
    UStaticMeshComponent* AddPost(FName Name, const FVector& Point, UMaterialInterface* Paint);
    void AddCaption(FName Name, const FVector& Point, const FString& Words);
};
