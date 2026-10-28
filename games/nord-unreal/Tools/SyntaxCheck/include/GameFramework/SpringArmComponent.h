// Offline UE 5.x API stub: GameFramework/SpringArmComponent.h
#pragma once
#include "Components/SceneComponent.h"
class USpringArmComponent : public USceneComponent
{
    UESTUB_UCLASS_BODY(USpringArmComponent, USceneComponent)
    USpringArmComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    static const FName SocketName;
    float TargetArmLength;
    FVector SocketOffset;
    FVector TargetOffset;
    float ProbeSize;
    TEnumAsByte<ECollisionChannel> ProbeChannel;
    uint32 bDoCollisionTest : 1;
    uint32 bUsePawnControlRotation : 1;
    uint32 bInheritPitch : 1;
    uint32 bInheritYaw : 1;
    uint32 bInheritRoll : 1;
    uint32 bEnableCameraLag : 1;
    uint32 bEnableCameraRotationLag : 1;
    uint32 bUseCameraLagSubstepping : 1;
    uint32 bDrawDebugLagMarkers : 1;
    float CameraLagSpeed;
    float CameraRotationLagSpeed;
    float CameraLagMaxTimeStep;
    float CameraLagMaxDistance;
    uint32 bClampToMaxPhysicsDeltaTime : 1;
    FRotator GetTargetRotation() const;
    FVector GetUnfixedCameraPosition() const;
    bool IsCollisionFixApplied() const;
    virtual void TickComponent(float DeltaTime, enum ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
    virtual FTransform GetSocketTransform(FName InSocketName, ERelativeTransformSpace TransformSpace = RTS_World) const override;
    virtual bool HasAnySockets() const override;
};
