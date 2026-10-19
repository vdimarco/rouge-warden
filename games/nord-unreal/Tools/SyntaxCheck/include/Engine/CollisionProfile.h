// Offline UE 5.x API stub: Engine/CollisionProfile.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
struct FCollisionResponseTemplate
{
    TEnumAsByte<ECollisionEnabled::Type> CollisionEnabled;
    TEnumAsByte<ECollisionChannel> ObjectType;
    FName Name;
    FName ObjectTypeName;
    FCollisionResponseContainer ResponseToChannels;
    FString HelpMessage;
    bool bCanModify;
    bool IsEqual(const TEnumAsByte<ECollisionEnabled::Type> InCollisionEnabled, const TEnumAsByte<ECollisionChannel> InObjectType, const FCollisionResponseContainer& InResponseToChannels) const;
};
class UCollisionProfile : public UObject
{
    UESTUB_UCLASS_BODY(UCollisionProfile, UObject)
    UCollisionProfile(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    static UCollisionProfile* Get();
    static const FName CustomCollisionProfileName;
    static const FName NoCollision_ProfileName;
    static const FName BlockAll_ProfileName;
    static const FName PhysicsActor_ProfileName;
    static const FName BlockAllDynamic_ProfileName;
    static const FName Pawn_ProfileName;
    static const FName Vehicle_ProfileName;
    static const FName DefaultProjectile_ProfileName;
    bool GetProfileTemplate(FName ProfileName, FCollisionResponseTemplate& ProfileData) const;
    const FCollisionResponseTemplate* GetProfileByIndex(int32 Index) const;
    int32 GetNumOfProfiles() const;
    ECollisionChannel ConvertToCollisionChannel(bool TraceType, int32 Index) const;
    EObjectTypeQuery ConvertToObjectType(ECollisionChannel CollisionChannel) const;
    ETraceTypeQuery ConvertToTraceType(ECollisionChannel CollisionChannel) const;
    FName ReturnChannelNameFromContainerIndex(int32 ContainerIndex) const;
    static void GetProfileNames(TArray<TSharedPtr<FName>>& OutNameList);
};
