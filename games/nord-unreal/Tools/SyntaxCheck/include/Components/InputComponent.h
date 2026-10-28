// Offline UE 5.x API stub: Components/InputComponent.h
#pragma once
#include "Components/ActorComponent.h"
#include "InputCoreTypes.h"

DECLARE_DELEGATE(FInputActionHandlerSignature);
DECLARE_DELEGATE_OneParam(FInputActionHandlerWithKeySignature, FKey);
DECLARE_DELEGATE_OneParam(FInputAxisHandlerSignature, float);
DECLARE_DELEGATE_OneParam(FInputVectorAxisHandlerSignature, FVector);
DECLARE_DELEGATE_TwoParams(FInputTouchHandlerSignature, ETouchIndex::Type, FVector);
DECLARE_DYNAMIC_DELEGATE(FInputActionHandlerDynamicSignature);
DECLARE_DYNAMIC_DELEGATE_OneParam(FInputAxisHandlerDynamicSignature, float, AxisValue);

struct FInputChord
{
    FKey Key;
    uint32 bShift : 1;
    uint32 bCtrl : 1;
    uint32 bAlt : 1;
    uint32 bCmd : 1;
    FInputChord();
    FInputChord(const FKey InKey);
    FInputChord(const FKey InKey, const bool bInShift, const bool bInCtrl, const bool bInAlt, const bool bInCmd);
    bool IsValidChord() const;
    FText GetInputText(const bool bLongDisplayName = true) const;
    bool operator==(const FInputChord& Other) const;
};

struct FInputActionUnifiedDelegate
{
    bool IsBound() const;
    bool IsBoundToObject(void const* Object) const;
    template <class UserClass> void BindDelegate(UserClass* Object, typename FInputActionHandlerSignature::template TMethodPtr<UserClass> Func);
    template <class UserClass> void BindDelegate(UserClass* Object, typename FInputActionHandlerWithKeySignature::template TMethodPtr<UserClass> Func);
    template <class DelegateType, class UserClass, typename... VarTypes> void BindDelegate(UserClass* Object, typename DelegateType::template TMethodPtr<UserClass, VarTypes...> Func, VarTypes&&... Vars);
    void BindDelegate(UObject* Object, const FName FuncName);
    FInputActionHandlerSignature& GetDelegateForManualSet();
    FInputActionHandlerWithKeySignature& GetDelegateWithKeyForManualSet();
    void Unbind();
    void Execute(const FKey Key) const;
};
struct FInputAxisUnifiedDelegate
{
    bool IsBound() const;
    template <class UserClass> void BindDelegate(UserClass* Object, typename FInputAxisHandlerSignature::template TMethodPtr<UserClass> Func);
    void BindDelegate(UObject* Object, const FName FuncName);
    FInputAxisHandlerSignature& GetDelegateForManualSet();
    void Unbind();
    void Execute(const float AxisValue) const;
};
struct FInputBinding
{
    uint8 bConsumeInput : 1;
    uint8 bExecuteWhenPaused : 1;
    FInputBinding();
};
struct FInputActionBinding : public FInputBinding
{
    TEnumAsByte<EInputEvent> KeyEvent;
    FInputActionUnifiedDelegate ActionDelegate;
    FInputActionBinding();
    FInputActionBinding(const FName InActionName, const enum EInputEvent InKeyEvent);
    FName GetActionName() const;
    bool IsPaired() const;
    int32 GetHandle() const;
};
struct FInputKeyBinding : public FInputBinding
{
    FInputChord Chord;
    TEnumAsByte<EInputEvent> KeyEvent;
    FInputActionUnifiedDelegate KeyDelegate;
    FInputKeyBinding();
    FInputKeyBinding(const FInputChord InChord, const enum EInputEvent InKeyEvent);
};
struct FInputAxisBinding : public FInputBinding
{
    FName AxisName;
    FInputAxisUnifiedDelegate AxisDelegate;
    float AxisValue;
    FInputAxisBinding();
    FInputAxisBinding(const FName InAxisName);
};
struct FInputAxisKeyBinding : public FInputBinding
{
    float AxisValue;
    FKey AxisKey;
    FInputAxisUnifiedDelegate AxisDelegate;
    FInputAxisKeyBinding();
    FInputAxisKeyBinding(const FKey InAxisKey);
};
struct FInputTouchBinding : public FInputBinding
{
    TEnumAsByte<EInputEvent> KeyEvent;
    FInputTouchBinding();
    FInputTouchBinding(const enum EInputEvent InKeyEvent);
};
struct FInputVectorAxisBinding : public FInputBinding
{
    FVector AxisValue;
    FKey AxisKey;
    FInputVectorAxisBinding();
    FInputVectorAxisBinding(const FKey InAxisKey);
};

class UInputComponent : public UActorComponent
{
    UESTUB_UCLASS_BODY(UInputComponent, UActorComponent)
    UInputComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    TArray<FInputKeyBinding> KeyBindings;
    TArray<FInputTouchBinding> TouchBindings;
    TArray<FInputAxisBinding> AxisBindings;
    TArray<FInputAxisKeyBinding> AxisKeyBindings;
    TArray<FInputVectorAxisBinding> VectorAxisBindings;
    int32 Priority;
    uint8 bBlockInput : 1;

    template <class UserClass>
    FInputActionBinding& BindAction(const FName ActionName, const EInputEvent KeyEvent, UserClass* Object, typename FInputActionHandlerSignature::template TMethodPtr<UserClass> Func);
    template <class UserClass>
    FInputActionBinding& BindAction(const FName ActionName, const EInputEvent KeyEvent, UserClass* Object, typename FInputActionHandlerWithKeySignature::template TMethodPtr<UserClass> Func);
    template <class DelegateType, class UserClass, typename... VarTypes>
    FInputActionBinding& BindAction(const FName ActionName, const EInputEvent KeyEvent, UserClass* Object, typename DelegateType::template TMethodPtr<UserClass, VarTypes...> Func, VarTypes... Vars);
    FInputActionBinding& AddActionBinding(FInputActionBinding Binding);
    void ClearActionBindings();
    FInputActionBinding& GetActionBinding(const int32 BindingIndex) const;
    int32 GetNumActionBindings() const;
    void RemoveActionBinding(const int32 BindingIndex);
    void RemoveActionBinding(FName ActionName, EInputEvent KeyEvent);
    void RemoveActionBindingForHandle(const int32 Handle);
    template <class UserClass>
    FInputAxisBinding& BindAxis(const FName AxisName, UserClass* Object, typename FInputAxisHandlerSignature::template TMethodPtr<UserClass> Func);
    FInputAxisBinding& BindAxis(const FName AxisName);
    template <class UserClass>
    FInputAxisKeyBinding& BindAxisKey(const FKey AxisKey, UserClass* Object, typename FInputAxisHandlerSignature::template TMethodPtr<UserClass> Func);
    template <class UserClass>
    FInputVectorAxisBinding& BindVectorAxis(const FKey AxisKey, UserClass* Object, typename FInputVectorAxisHandlerSignature::template TMethodPtr<UserClass> Func);
    template <class UserClass>
    FInputKeyBinding& BindKey(const FInputChord Chord, const EInputEvent KeyEvent, UserClass* Object, typename FInputActionHandlerSignature::template TMethodPtr<UserClass> Func);
    template <class UserClass>
    FInputKeyBinding& BindKey(const FKey Key, const EInputEvent KeyEvent, UserClass* Object, typename FInputActionHandlerSignature::template TMethodPtr<UserClass> Func);
    template <class UserClass>
    FInputKeyBinding& BindKey(const FKey Key, const EInputEvent KeyEvent, UserClass* Object, typename FInputActionHandlerWithKeySignature::template TMethodPtr<UserClass> Func);
    template <class UserClass>
    FInputTouchBinding& BindTouch(const EInputEvent KeyEvent, UserClass* Object, typename FInputTouchHandlerSignature::template TMethodPtr<UserClass> Func);
    float GetAxisValue(const FName AxisName) const;
    float GetAxisKeyValue(const FKey AxisKey) const;
    FVector GetVectorAxisValue(const FKey AxisKey) const;
    bool HasBindings() const;
    void ClearBindingValues();
    void ClearAxisBindings();
    void RemoveAxisBinding(const FName AxisName);
};
