// Offline UE 5.x API stub: GameFramework/InputSettings.h
#pragma once
#include "GameFramework/PlayerInput.h"
#include "Components/InputComponent.h"
class UInputSettings : public UObject
{
    UESTUB_UCLASS_BODY(UInputSettings, UObject)
    UInputSettings(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<FInputActionKeyMapping> ActionMappings;
    TArray<FInputAxisKeyMapping> AxisMappings;
    static UInputSettings* GetInputSettings();
    static TSubclassOf<UPlayerInput> GetDefaultPlayerInputClass();
    static TSubclassOf<UInputComponent> GetDefaultInputComponentClass();
    static void SetDefaultPlayerInputClass(TSubclassOf<UPlayerInput> NewDefaultPlayerInputClass);
    static void SetDefaultInputComponentClass(TSubclassOf<UInputComponent> NewDefaultInputComponentClass);
    void AddActionMapping(const FInputActionKeyMapping& KeyMapping, bool bForceRebuildKeymaps = true);
    void RemoveActionMapping(const FInputActionKeyMapping& KeyMapping, bool bForceRebuildKeymaps = true);
    void AddAxisMapping(const FInputAxisKeyMapping& KeyMapping, bool bForceRebuildKeymaps = true);
    void RemoveAxisMapping(const FInputAxisKeyMapping& KeyMapping, bool bForceRebuildKeymaps = true);
    void GetActionMappingByName(const FName InActionName, TArray<FInputActionKeyMapping>& OutMappings) const;
    void GetAxisMappingByName(const FName InAxisName, TArray<FInputAxisKeyMapping>& OutMappings) const;
    void ForceRebuildKeymaps();
    void SaveKeyMappings();
};
