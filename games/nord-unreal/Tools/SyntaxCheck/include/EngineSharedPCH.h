// Offline UE 5.x API stub: EngineSharedPCH.h
//
// UBT force-includes the Engine shared PCH into every .cpp of a module whose Build.cs uses
// PCHUsage = UseExplicitOrSharedPCHs (or UseSharedPCHs) and has no PrivatePCHHeaderFile.
// The real header pulls in a large slice of Core, CoreUObject, InputCore and Engine; this
// stub lists only the headers this stub tree provides AND that the real shared PCH is
// believed to contain. Anything visible only through this file is an include-what-you-use
// gap that a non-PCH build (check.sh --no-pch) will report.
#pragma once

// Core / CoreUObject
#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "UObject/Class.h"
#include "UObject/ObjectMacros.h"
#include "UObject/UObjectGlobals.h"
#include "UObject/WeakObjectPtr.h"
#include "UObject/SoftObjectPtr.h"
#include "Templates/SubclassOf.h"
#include "Stats/Stats.h"
#include "Misc/OutputDevice.h"
#include "HAL/PlatformTime.h"

// InputCore
#include "InputCoreTypes.h"

// Engine
#include "Engine/EngineBaseTypes.h"
#include "Engine/EngineTypes.h"
#include "Engine/NetSerialization.h"
#include "Engine/HitResult.h"
#include "Engine/TimerHandle.h"
#include "CollisionQueryParams.h"
#include "WorldCollision.h"
#include "Components/ActorComponent.h"
#include "Components/SceneComponent.h"
#include "Components/PrimitiveComponent.h"
#include "Components/MeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SkinnedMeshComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Components/InputComponent.h"
#include "GameFramework/Actor.h"
#include "GameFramework/Info.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/Controller.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/DamageType.h"
#include "GameFramework/Volume.h"
#include "GameFramework/WorldSettings.h"
#include "Engine/Brush.h"
#include "Engine/Level.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/GameViewportClient.h"
#include "Engine/Player.h"
#include "Engine/LocalPlayer.h"
#include "Engine/Scene.h"
#include "Engine/StaticMesh.h"
#include "Engine/SkeletalMesh.h"
#include "Engine/Texture.h"
#include "Engine/Texture2D.h"
#include "Materials/MaterialInterface.h"
#include "Materials/Material.h"
#include "Materials/MaterialInstance.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Animation/AnimTypes.h"
#include "Animation/AnimationAsset.h"
#include "Animation/AnimSequenceBase.h"
#include "Animation/AnimMontage.h"
#include "Animation/AnimInstance.h"
#include "Animation/Skeleton.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "EngineUtils.h"
#include "TimerManager.h"
#include "UnrealClient.h"
