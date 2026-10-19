// Offline UE 5.x API stub: GameFramework/PlayerController.h
#pragma once
#include "GameFramework/Controller.h"
#include "InputCoreTypes.h"
#include "Engine/LatentActionManager.h"
#include "Camera/CameraTypes.h"
class AHUD;
class APlayerCameraManager;
class UPlayer;
class UPlayerInput;
class ULocalPlayer;
class UCheatManager;
class USoundBase;
class UCameraShakeBase;
class UNetConnection;
class UForceFeedbackEffect;
class SWidget;
class UGameViewportClient;
class FReply;
// input routing between game and Slate (GameFramework/PlayerController.h)
struct FInputModeDataBase
{
    virtual ~FInputModeDataBase() {}
protected:
    virtual void ApplyInputMode(FReply& SlateOperations, UGameViewportClient& GameViewportClient) const = 0;
};
struct FInputModeUIOnly : public FInputModeDataBase
{
    FInputModeUIOnly& SetWidgetToFocus(TSharedPtr<SWidget> InWidgetToFocus);
    FInputModeUIOnly& SetLockMouseToViewportBehavior(EMouseLockMode InMouseLockMode);
protected:
    virtual void ApplyInputMode(FReply& SlateOperations, UGameViewportClient& GameViewportClient) const override;
};
struct FInputModeGameAndUI : public FInputModeDataBase
{
    FInputModeGameAndUI& SetWidgetToFocus(TSharedPtr<SWidget> InWidgetToFocus);
    FInputModeGameAndUI& SetLockMouseToViewportBehavior(EMouseLockMode InMouseLockMode);
    FInputModeGameAndUI& SetHideCursorDuringCapture(bool InHideCursorDuringCapture);
protected:
    virtual void ApplyInputMode(FReply& SlateOperations, UGameViewportClient& GameViewportClient) const override;
};
struct FInputModeGameOnly : public FInputModeDataBase
{
    FInputModeGameOnly& SetConsumeCaptureMouseDown(bool InConsumeCaptureMouseDown);
protected:
    virtual void ApplyInputMode(FReply& SlateOperations, UGameViewportClient& GameViewportClient) const override;
};
namespace EControllerAnalogStick { enum Type : int { CAS_LeftStick, CAS_RightStick, CAS_MAX }; }
namespace EDynamicForceFeedbackAction { enum Type : int { Start, Update, Stop }; }
enum EViewTargetBlendFunction : int { VTBlend_Linear, VTBlend_Cubic, VTBlend_EaseIn, VTBlend_EaseOut, VTBlend_EaseInOut, VTBlend_PreBlended, VTBlend_MAX };
struct FViewTargetTransitionParams
{
    float BlendTime;
    TEnumAsByte<EViewTargetBlendFunction> BlendFunction;
    float BlendExp;
    uint32 bLockOutgoing : 1;
    FViewTargetTransitionParams();
};
DECLARE_DELEGATE_RetVal(bool, FCanUnpause);

class APlayerController : public AController
{
    UESTUB_UCLASS_BODY(APlayerController, AController)
    APlayerController(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TObjectPtr<UPlayer> Player;
    TObjectPtr<APawn> AcknowledgedPawn;
    TObjectPtr<AHUD> MyHUD;
    TObjectPtr<APlayerCameraManager> PlayerCameraManager;
    TSubclassOf<APlayerCameraManager> PlayerCameraManagerClass;
    TObjectPtr<UPlayerInput> PlayerInput;
    TObjectPtr<UCheatManager> CheatManager;
    TSubclassOf<UCheatManager> CheatClass;
    uint32 bShowMouseCursor : 1;
    uint32 bEnableClickEvents : 1;
    uint32 bEnableTouchEvents : 1;
    uint32 bEnableMouseOverEvents : 1;
    uint32 bEnableTouchOverEvents : 1;
    uint32 bForceFeedbackEnabled : 1;
    uint32 bAutoManageActiveCameraTarget : 1;
    uint32 bPlayerIsWaiting : 1;
    TEnumAsByte<EMouseCursor::Type> DefaultMouseCursor;
    TEnumAsByte<EMouseCursor::Type> CurrentMouseCursor;
    TEnumAsByte<ECollisionChannel> DefaultClickTraceChannel;
    float HitResultTraceDistance;
    FRotator RotationInput;
    float SmoothTargetViewRotationSpeed;
    uint8 NetPlayerIndex;

    AHUD* GetHUD() const;
    template <class T> T* GetHUD() const { return Cast<T>(MyHUD); }
    ULocalPlayer* GetLocalPlayer() const;
    void SetAsLocalPlayerController();
    void ClientMessage(const FString& S, FName Type = NAME_None, float MsgLifeTime = 0.f);
    void ClientPlaySound(class USoundBase* Sound, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f);
    void ClientPlaySoundAtLocation(class USoundBase* Sound, FVector Location, float VolumeMultiplier = 1.f, float PitchMultiplier = 1.f);
    void ClientSetHUD(TSubclassOf<AHUD> NewHUDClass);
    void ClientRestart(class APawn* NewPawn);
    void ClientSetViewTarget(class AActor* A, struct FViewTargetTransitionParams TransitionParams = FViewTargetTransitionParams());
    void ClientIgnoreMoveInput(bool bIgnore);
    void ClientIgnoreLookInput(bool bIgnore);
    void ClientTravel(const FString& URL, enum ETravelType TravelType, bool bSeamless = false, FGuid MapPackageGuid = FGuid());
    void ClientReturnToMainMenuWithTextReason(const FText& ReturnReason);
    void ClientStartCameraShake(TSubclassOf<class UCameraShakeBase> Shake, float Scale = 1.f, ECameraShakePlaySpace PlaySpace = ECameraShakePlaySpace::CameraLocal, FRotator UserPlaySpaceRot = FRotator::ZeroRotator);
    void ClientStopCameraShake(TSubclassOf<class UCameraShakeBase> Shake, bool bImmediately = true);
    void ClientPlayForceFeedback(class UForceFeedbackEffect* ForceFeedbackEffect, FName Tag = NAME_None, bool bLooping = false, bool bIgnoreTimeDilation = false, bool bPlayWhilePaused = false);
    void ServerRestartPlayer();
    void ServerPause();
    bool ProjectWorldLocationToScreen(FVector WorldLocation, FVector2D& ScreenLocation, bool bPlayerViewportRelative = false) const;
    bool ProjectWorldLocationToScreenWithDistance(FVector WorldLocation, FVector& ScreenLocation, bool bPlayerViewportRelative = false) const;
    bool DeprojectMousePositionToWorld(FVector& WorldLocation, FVector& WorldDirection) const;
    bool DeprojectScreenPositionToWorld(float ScreenX, float ScreenY, FVector& WorldLocation, FVector& WorldDirection) const;
    bool GetMousePosition(float& LocationX, float& LocationY) const;
    bool GetMousePosition(double& LocationX, double& LocationY) const;
    void GetViewportSize(int32& SizeX, int32& SizeY) const;
    void SetMouseLocation(const int X, const int Y);
    bool GetHitResultUnderCursor(ECollisionChannel TraceChannel, bool bTraceComplex, FHitResult& HitResult) const;
    bool GetHitResultUnderCursorByChannel(ETraceTypeQuery TraceChannel, bool bTraceComplex, FHitResult& HitResult) const;
    bool GetHitResultUnderCursorForObjects(const TArray<TEnumAsByte<EObjectTypeQuery>>& ObjectTypes, bool bTraceComplex, FHitResult& HitResult) const;
    bool GetHitResultAtScreenPosition(const FVector2D ScreenPosition, const ECollisionChannel TraceChannel, bool bTraceComplex, FHitResult& HitResult) const;
    void SetInputMode(const FInputModeDataBase& InData);
    void SetShowMouseCursor(bool bShow);
    virtual bool ShouldShowMouseCursor() const;
    virtual void SetViewTarget(class AActor* NewViewTarget, FViewTargetTransitionParams TransitionParams = FViewTargetTransitionParams());
    virtual void SetViewTargetWithBlend(class AActor* NewViewTarget, float BlendTime = 0, enum EViewTargetBlendFunction BlendFunc = VTBlend_Linear, float BlendExp = 0, bool bLockOutgoing = false);
    virtual AActor* GetViewTarget() const override;
    virtual void AutoManageActiveCameraTarget(AActor* SuggestedTarget);
    virtual FString ConsoleCommand(const FString& Command, bool bWriteToLog = true);
    virtual void PlayerTick(float DeltaTime);
    virtual void PawnLeavingGame();
    virtual void FlushPressedKeys();
    bool IsInputKeyDown(FKey Key) const;
    bool WasInputKeyJustPressed(FKey Key) const;
    bool WasInputKeyJustReleased(FKey Key) const;
    float GetInputAnalogKeyState(FKey Key) const;
    FVector GetInputVectorKeyState(FKey Key) const;
    float GetInputKeyTimeDown(FKey Key) const;
    void GetInputMouseDelta(float& DeltaX, float& DeltaY) const;
    void GetInputAnalogStickState(EControllerAnalogStick::Type WhichStick, float& StickX, float& StickY) const;
    virtual void AddYawInput(float Val);
    virtual void AddPitchInput(float Val);
    virtual void AddRollInput(float Val);
    virtual bool SetPause(bool bPause, FCanUnpause CanUnpauseDelegate = FCanUnpause());
    virtual bool IsPaused() const;
    virtual void SetCinematicMode(bool bInCinematicMode, bool bHidePlayer, bool bAffectsHUD, bool bAffectsMovement, bool bAffectsTurning);
    virtual bool CanRestartPlayer();
    virtual void ProcessPlayerInput(const float DeltaTime, const bool bGamePaused);
    virtual void EnableCheats();
    void SetControllerLightColor(FColor Color);
    void PlayDynamicForceFeedback(float Intensity, float Duration, bool bAffectsLeftLarge, bool bAffectsLeftSmall, bool bAffectsRightLarge, bool bAffectsRightSmall, TEnumAsByte<EDynamicForceFeedbackAction::Type> Action = EDynamicForceFeedbackAction::Start, FLatentActionInfo LatentInfo = FLatentActionInfo());
    UNetConnection* NetConnection;
    virtual UNetConnection* GetNetConnection() const override;
    virtual void GetPlayerViewPoint(FVector& Location, FRotator& Rotation) const override;
    virtual void TickActor(float DeltaTime, enum ELevelTick TickType, FActorTickFunction& ThisTickFunction) override;
    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
    virtual void SetPawn(APawn* InPawn) override;
    virtual void Destroyed() override;
    virtual bool IsLookInputIgnored() const override;
    virtual bool IsMoveInputIgnored() const override;
    virtual void PostInitializeComponents() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
protected:
    virtual void BeginPlay() override;
    virtual void SetupInputComponent();
    virtual void OnPossess(APawn* aPawn) override;
    virtual void OnUnPossess() override;
};
