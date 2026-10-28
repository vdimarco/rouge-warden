// Offline UE 5.x API stub: GameFramework/PlayerInput.h
#pragma once
#include "UEStub/UObjectCore.h"
#include "InputCoreTypes.h"
#include "InputKeyEventArgs.h"
#include "Engine/EngineBaseTypes.h"
class UInputComponent;
class APlayerController;
struct FInputActionKeyMapping
{
    FName ActionName;
    uint8 bShift : 1;
    uint8 bCtrl : 1;
    uint8 bAlt : 1;
    uint8 bCmd : 1;
    FKey Key;
    FInputActionKeyMapping(const FName InActionName = NAME_None, const FKey InKey = EKeys::Invalid, const bool bInShift = false, const bool bInCtrl = false, const bool bInAlt = false, const bool bInCmd = false);
};
struct FInputAxisKeyMapping
{
    FName AxisName;
    float Scale;
    FKey Key;
    FInputAxisKeyMapping(const FName InAxisName = NAME_None, const FKey InKey = EKeys::Invalid, const float InScale = 1.f);
};
class UPlayerInput : public UObject
{
    UESTUB_UCLASS_BODY(UPlayerInput, UObject)
    UPlayerInput(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<FInputActionKeyMapping> ActionMappings;
    TArray<FInputAxisKeyMapping> AxisMappings;
    virtual bool InputKey(const FInputKeyEventArgs& Params);
    virtual bool InputTouch(uint32 Handle, ETouchType::Type Type, const FVector2D& TouchLocation, float Force, FDateTime DeviceTimestamp, uint32 TouchpadIndex);
    virtual void ProcessInputStack(const TArray<UInputComponent*>& InputComponentStack, const float DeltaTime, const bool bGamePaused);
    virtual void FlushPressedKeys();
    bool IsPressed(FKey InKey) const;
    bool WasJustPressed(FKey InKey) const;
    bool WasJustReleased(FKey InKey) const;
    float GetTimeDown(FKey InKey) const;
    float GetKeyValue(FKey InKey) const;
    float GetRawKeyValue(FKey InKey) const;
    FVector GetRawVectorKeyValue(FKey InKey) const;
    FVector GetProcessedVectorKeyValue(FKey InKey) const;
    bool IsAltPressed() const;
    bool IsCtrlPressed() const;
    bool IsShiftPressed() const;
    bool IsCmdPressed() const;
    const TArray<FInputActionKeyMapping>& GetKeysForAction(const FName ActionName) const;
    const TArray<FInputAxisKeyMapping>& GetKeysForAxis(const FName AxisName) const;
    void AddActionMapping(const FInputActionKeyMapping& KeyMapping);
    void RemoveActionMapping(const FInputActionKeyMapping& KeyMapping);
    void AddAxisMapping(const FInputAxisKeyMapping& KeyMapping);
    void RemoveAxisMapping(const FInputAxisKeyMapping& KeyMapping);
    void ForceRebuildingKeyMaps(const bool bRestoreDefaults = false);
    APlayerController* GetOuterAPlayerController() const;
};
