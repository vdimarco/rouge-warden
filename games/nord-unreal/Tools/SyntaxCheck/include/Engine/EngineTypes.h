// Offline UE 5.x API stub: Engine/EngineTypes.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineBaseTypes.h"
#include "Engine/HitResult.h"
#include "Engine/NetSerialization.h"
#include "Engine/TimerHandle.h"

enum ECollisionChannel : int
{
    ECC_WorldStatic, ECC_WorldDynamic, ECC_Pawn, ECC_Visibility, ECC_Camera, ECC_PhysicsBody, ECC_Vehicle, ECC_Destructible,
    ECC_EngineTraceChannel1, ECC_EngineTraceChannel2, ECC_EngineTraceChannel3, ECC_EngineTraceChannel4, ECC_EngineTraceChannel5, ECC_EngineTraceChannel6,
    ECC_GameTraceChannel1, ECC_GameTraceChannel2, ECC_GameTraceChannel3, ECC_GameTraceChannel4, ECC_GameTraceChannel5, ECC_GameTraceChannel6,
    ECC_GameTraceChannel7, ECC_GameTraceChannel8, ECC_GameTraceChannel9, ECC_GameTraceChannel10, ECC_GameTraceChannel11, ECC_GameTraceChannel12,
    ECC_GameTraceChannel13, ECC_GameTraceChannel14, ECC_GameTraceChannel15, ECC_GameTraceChannel16, ECC_GameTraceChannel17, ECC_GameTraceChannel18,
    ECC_OverlapAll_Deprecated, ECC_MAX,
};
enum ECollisionResponse : int { ECR_Ignore, ECR_Overlap, ECR_Block, ECR_MAX };
namespace ECollisionEnabled { enum Type : int { NoCollision, QueryOnly, PhysicsOnly, QueryAndPhysics, ProbeOnly, QueryAndProbe }; }
enum ETraceTypeQuery : int { TraceTypeQuery1, TraceTypeQuery2, TraceTypeQuery3, TraceTypeQuery4, TraceTypeQuery5, TraceTypeQuery6, TraceTypeQuery7, TraceTypeQuery8, TraceTypeQuery9, TraceTypeQuery10, TraceTypeQuery_MAX };
enum EObjectTypeQuery : int { ObjectTypeQuery1, ObjectTypeQuery2, ObjectTypeQuery3, ObjectTypeQuery4, ObjectTypeQuery5, ObjectTypeQuery6, ObjectTypeQuery7, ObjectTypeQuery8, ObjectTypeQuery9, ObjectTypeQuery10, ObjectTypeQuery_MAX };
namespace EComponentMobility { enum Type : int { Static, Stationary, Movable }; }
enum class ETeleportType : uint8 { None, TeleportPhysics, ResetPhysics };
enum EMoveComponentFlags : int { MOVECOMP_NoFlags = 0x0000, MOVECOMP_IgnoreBases = 0x0001, MOVECOMP_SkipPhysicsMove = 0x0002, MOVECOMP_NeverIgnoreBlockingOverlaps = 0x0004, MOVECOMP_DisableBlockingOverlapDispatch = 0x0008 };
ENUM_CLASS_FLAGS(EMoveComponentFlags)
enum class EUpdateTransformFlags : int32 { None = 0x0, SkipPhysicsUpdate = 0x1, PropagateFromParent = 0x2, OnlyUpdateIfUsingSocket = 0x4 };
ENUM_CLASS_FLAGS(EUpdateTransformFlags)
enum ERelativeTransformSpace : int { RTS_World, RTS_Actor, RTS_Component, RTS_ParentBoneSpace };
enum class EAttachmentRule : uint8 { KeepRelative, KeepWorld, SnapToTarget };
enum class EDetachmentRule : uint8 { KeepRelative, KeepWorld };
struct FAttachmentTransformRules
{
    static FAttachmentTransformRules KeepRelativeTransform;
    static FAttachmentTransformRules KeepWorldTransform;
    static FAttachmentTransformRules SnapToTargetNotIncludingScale;
    static FAttachmentTransformRules SnapToTargetIncludingScale;
    FAttachmentTransformRules(EAttachmentRule InRule, bool bInWeldSimulatedBodies);
    FAttachmentTransformRules(EAttachmentRule InLocationRule, EAttachmentRule InRotationRule, EAttachmentRule InScaleRule, bool bInWeldSimulatedBodies);
    EAttachmentRule LocationRule;
    EAttachmentRule RotationRule;
    EAttachmentRule ScaleRule;
    bool bWeldSimulatedBodies;
};
struct FDetachmentTransformRules
{
    static FDetachmentTransformRules KeepRelativeTransform;
    static FDetachmentTransformRules KeepWorldTransform;
    FDetachmentTransformRules(EDetachmentRule InRule, bool bInCallModify);
    FDetachmentTransformRules(EDetachmentRule InLocationRule, EDetachmentRule InRotationRule, EDetachmentRule InScaleRule, bool bInCallModify);
    FDetachmentTransformRules(const FAttachmentTransformRules& AttachmentRules, bool bInCallModify);
    EDetachmentRule LocationRule;
    EDetachmentRule RotationRule;
    EDetachmentRule ScaleRule;
    bool bCallModify;
};
namespace EAttachLocation { enum Type : int { KeepRelativeOffset, KeepWorldPosition, SnapToTarget, SnapToTargetIncludingScale }; }
namespace EEndPlayReason { enum Type : int { Destroyed, LevelTransition, EndPlayInEditor, RemovedFromWorld, Quit }; }
enum EMovementMode : int { MOVE_None, MOVE_Walking, MOVE_NavWalking, MOVE_Falling, MOVE_Swimming, MOVE_Flying, MOVE_Custom, MOVE_MAX };
enum class ESpawnActorCollisionHandlingMethod : uint8 { Undefined, AlwaysSpawn, AdjustIfPossibleButAlwaysSpawn, AdjustIfPossibleButDontSpawnIfColliding, DontSpawnIfColliding };
enum class ESpawnActorScaleMethod : uint8 { OverrideRootScale, MultiplyWithRoot, SelectDefaultAtRuntime };
enum class ESpawnActorNameMode : uint8 { Required_Fatal, Required_ErrorAndReturnNull, Required_ReturnNull, Requested };
enum class EAutoPossessAI : uint8 { Disabled, PlacedInWorld, Spawned, PlacedInWorldOrSpawned };
namespace EAutoReceiveInput { enum Type : int { Disabled, Player0, Player1, Player2, Player3, Player4, Player5, Player6, Player7 }; }
enum ENetDormancy : int { DORM_Never, DORM_Awake, DORM_DormantAll, DORM_DormantPartial, DORM_Initial, DORM_MAX };
enum EBlendMode : int { BLEND_Opaque, BLEND_Masked, BLEND_Translucent, BLEND_Additive, BLEND_Modulate, BLEND_AlphaComposite, BLEND_AlphaHoldout, BLEND_TranslucentColoredTransmittance, BLEND_MAX };
enum ESimpleElementBlendMode : int
{
    SE_BLEND_Opaque = 0, SE_BLEND_Masked, SE_BLEND_Translucent, SE_BLEND_Additive, SE_BLEND_Modulate, SE_BLEND_MaskedDistanceField,
    SE_BLEND_MaskedDistanceFieldShadowed, SE_BLEND_TranslucentDistanceField, SE_BLEND_TranslucentDistanceFieldShadowed, SE_BLEND_AlphaComposite,
    SE_BLEND_AlphaHoldout, SE_BLEND_AlphaBlend, SE_BLEND_TranslucentAlphaOnly, SE_BLEND_TranslucentAlphaOnlyWriteAlpha, SE_BLEND_RGBA_MASK_START,
};
enum class ELightUnits : uint8 { Unitless, Candelas, Lumens, EV, Nits };
enum class EVisibilityBasedAnimTickOption : uint8 { AlwaysTickPoseAndRefreshBones, AlwaysTickPose, OnlyTickMontagesAndRefreshBonesWhenPlayingMontages, OnlyTickPoseWhenRendered, OnlyTickMontagesWhenNotRendered };
enum EPhysicalSurface : int { SurfaceType_Default, SurfaceType1, SurfaceType2, SurfaceType3, SurfaceType4, SurfaceType5, SurfaceType6, SurfaceType7, SurfaceType8, SurfaceType9, SurfaceType10, SurfaceType_Max };
namespace EWorldType { enum Type : int { None, Game, Editor, PIE, EditorPreview, GamePreview, GameRPC, Inactive }; }
enum ERadialImpulseFalloff : int { RIF_Constant, RIF_Linear, RIF_MAX };
enum class EComponentSocketType : uint8 { Invalid, Bone, Socket };
enum EMaterialParameterAssociation : int { LayerParameter, BlendParameter, GlobalParameter };
namespace EOcclusionCombineMode { enum Type : int { OCM_Minimum, OCM_Multiply }; }

struct FCollisionResponseContainer
{
    FCollisionResponseContainer();
    FCollisionResponseContainer(ECollisionResponse DefaultResponse);
    bool SetResponse(ECollisionChannel Channel, ECollisionResponse NewResponse);
    bool SetAllChannels(ECollisionResponse NewResponse);
    ECollisionResponse GetResponse(ECollisionChannel Channel) const;
    static const FCollisionResponseContainer& GetDefaultResponseContainer();
};
struct FLightingChannels { uint8 bChannel0 : 1; uint8 bChannel1 : 1; uint8 bChannel2 : 1; FLightingChannels(); };
struct FRepMovement
{
    FVector LinearVelocity;
    FVector AngularVelocity;
    FVector Location;
    FRotator Rotation;
    uint8 bSimulatedPhysicSleep : 1;
    uint8 bRepPhysics : 1;
    FRepMovement();
};
struct FMeshNaniteSettings { uint8 bEnabled : 1; };
struct FComponentReference { FName ComponentProperty; class UActorComponent* GetComponent(AActor* OwningActor) const; };
struct FMaterialParameterInfo
{
    FName Name;
    TEnumAsByte<EMaterialParameterAssociation> Association;
    int32 Index;
    FMaterialParameterInfo();
    FMaterialParameterInfo(FName InName, EMaterialParameterAssociation InAssociation = EMaterialParameterAssociation::GlobalParameter, int32 InIndex = INDEX_NONE);
};
struct FMaterialRelevance {};

class UEngineTypes
{
public:
    static ECollisionChannel ConvertToCollisionChannel(ETraceTypeQuery TraceType);
    static ECollisionChannel ConvertToCollisionChannel(EObjectTypeQuery ObjectType);
    static EObjectTypeQuery ConvertToObjectType(ECollisionChannel CollisionChannel);
    static ETraceTypeQuery ConvertToTraceType(ECollisionChannel CollisionChannel);
};
