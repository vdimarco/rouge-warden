// Offline UE 5.x API stub: single-cast, multicast and dynamic delegates.
// Bind/Add functions spell out the exact member-function-pointer type, so a handler
// with the wrong signature is rejected just as in UE.
#pragma once
#include "UEStub/Strings.h"

class UObject;
class FDelegateHandle
{
public:
    enum EGenerateNewHandleType { GenerateNewHandle };
    FDelegateHandle();
    explicit FDelegateHandle(EGenerateNewHandleType);
    bool IsValid() const;
    void Reset();
    bool operator==(const FDelegateHandle& Rhs) const;
    bool operator!=(const FDelegateHandle& Rhs) const;
};
uint32 GetTypeHash(const FDelegateHandle& Key);

template <bool Const, typename Class, typename FuncType> struct TMemFunPtrType;
template <typename Class, typename RetType, typename... ArgTypes> struct TMemFunPtrType<false, Class, RetType(ArgTypes...)> { typedef RetType (Class::*Type)(ArgTypes...); };
template <typename Class, typename RetType, typename... ArgTypes> struct TMemFunPtrType<true, Class, RetType(ArgTypes...)> { typedef RetType (Class::*Type)(ArgTypes...) const; };

namespace UEStub
{
    template <typename F, typename Ret, typename... Params>
    constexpr bool IsCallableAs = std::is_invocable_r_v<Ret, F&, Params...>;
}

template <typename DelegateSignature, typename UserPolicy = void> class TDelegate;
template <typename InRetValType, typename... ParamTypes, typename UserPolicy>
class TDelegate<InRetValType(ParamTypes...), UserPolicy>
{
public:
    typedef InRetValType RetValType;
    typedef InRetValType TFuncType(ParamTypes...);
    template <typename UserClass, typename... VarTypes> using TMethodPtr = typename TMemFunPtrType<false, UserClass, RetValType(ParamTypes..., std::decay_t<VarTypes>...)>::Type;
    template <typename UserClass, typename... VarTypes> using TConstMethodPtr = typename TMemFunPtrType<true, UserClass, RetValType(ParamTypes..., std::decay_t<VarTypes>...)>::Type;

    TDelegate() {}
    TDelegate(TYPE_OF_NULLPTR) {}
    TDelegate(const TDelegate&) {}
    TDelegate(TDelegate&&) {}
    TDelegate& operator=(const TDelegate&) { return ::UEStub::Fake<TDelegate&>(); }
    TDelegate& operator=(TDelegate&&) { return ::UEStub::Fake<TDelegate&>(); }
    ~TDelegate() {}

    template <typename... VarTypes> static TDelegate CreateStatic(RetValType (*InFunc)(ParamTypes..., std::decay_t<VarTypes>...), VarTypes&&... Vars) { return ::UEStub::Fake<TDelegate>(); }
    template <typename FunctorType, typename... VarTypes> static TDelegate CreateLambda(FunctorType&& InFunctor, VarTypes&&... Vars)
    { static_assert(UEStub::IsCallableAs<std::decay_t<FunctorType>, RetValType, ParamTypes..., VarTypes...>, "CreateLambda: lambda signature does not match the delegate"); return TDelegate(); }
    template <typename UserClass, typename FunctorType, typename... VarTypes> static TDelegate CreateWeakLambda(UserClass* InUserObject, FunctorType&& InFunctor, VarTypes&&... Vars)
    { static_assert(UEStub::IsCallableAs<std::decay_t<FunctorType>, RetValType, ParamTypes..., VarTypes...>, "CreateWeakLambda: lambda signature does not match the delegate"); return TDelegate(); }
    template <typename UserClass, typename... VarTypes> static TDelegate CreateRaw(UserClass* InUserObject, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<TDelegate>(); }
    template <typename UserClass, typename... VarTypes> static TDelegate CreateRaw(const UserClass* InUserObject, TConstMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<TDelegate>(); }
    template <typename UserClass, ESPMode Mode, typename... VarTypes> static TDelegate CreateSP(const TSharedRef<UserClass, Mode>& InUserObjectRef, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<TDelegate>(); }
    template <typename UserClass, typename... VarTypes> static TDelegate CreateSP(UserClass* InUserObject, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<TDelegate>(); }
    template <typename UserClass, typename... VarTypes> static TDelegate CreateThreadSafeSP(UserClass* InUserObject, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<TDelegate>(); }
    template <typename UObjectTemplate, typename... VarTypes> static TDelegate CreateUFunction(UObjectTemplate* InUserObject, const FName& InFunctionName, VarTypes&&... Vars) { return ::UEStub::Fake<TDelegate>(); }
    template <typename UserClass, typename... VarTypes> static TDelegate CreateUObject(UserClass* InUserObject, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<TDelegate>(); }
    template <typename UserClass, typename... VarTypes> static TDelegate CreateUObject(const UserClass* InUserObject, TConstMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<TDelegate>(); }

    template <typename... VarTypes> void BindStatic(RetValType (*InFunc)(ParamTypes..., std::decay_t<VarTypes>...), VarTypes&&... Vars) {}
    template <typename FunctorType, typename... VarTypes> void BindLambda(FunctorType&& InFunctor, VarTypes&&... Vars)
    { static_assert(UEStub::IsCallableAs<std::decay_t<FunctorType>, RetValType, ParamTypes..., VarTypes...>, "BindLambda: lambda signature does not match the delegate"); }
    template <typename UserClass, typename FunctorType, typename... VarTypes> void BindWeakLambda(UserClass* InUserObject, FunctorType&& InFunctor, VarTypes&&... Vars)
    { static_assert(UEStub::IsCallableAs<std::decay_t<FunctorType>, RetValType, ParamTypes..., VarTypes...>, "BindWeakLambda: lambda signature does not match the delegate"); }
    template <typename UserClass, typename... VarTypes> void BindRaw(UserClass* InUserObject, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) {}
    template <typename UserClass, typename... VarTypes> void BindRaw(const UserClass* InUserObject, TConstMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) {}
    template <typename UserClass, ESPMode Mode, typename... VarTypes> void BindSP(const TSharedRef<UserClass, Mode>& InUserObjectRef, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) {}
    template <typename UserClass, typename... VarTypes> void BindSP(UserClass* InUserObject, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) {}
    template <typename UObjectTemplate, typename... VarTypes> void BindUFunction(UObjectTemplate* InUserObject, const FName& InFunctionName, VarTypes&&... Vars) {}
    template <typename UserClass, typename... VarTypes> void BindUObject(UserClass* InUserObject, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) {}
    template <typename UserClass, typename... VarTypes> void BindUObject(const UserClass* InUserObject, TConstMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) {}

    RetValType Execute(ParamTypes... Params) const { return ::UEStub::Fake<RetValType>(); }
    template <typename R = RetValType, std::enable_if_t<std::is_void_v<R>, int> = 0> bool ExecuteIfBound(ParamTypes... Params) const { return ::UEStub::Fake<bool>(); }
    bool IsBound() const { return ::UEStub::Fake<bool>(); }
    bool IsBoundToObject(void const* InUserObject) const { return ::UEStub::Fake<bool>(); }
    void Unbind() {}
    void Clear() {}
    FDelegateHandle GetHandle() const { return ::UEStub::Fake<FDelegateHandle>(); }
    TDelegate& GetDelegateForManualSet() { return *this; }
};

template <typename DelegateSignature, typename UserPolicy = void> class TMulticastDelegate;
template <typename... ParamTypes, typename UserPolicy>
class TMulticastDelegate<void(ParamTypes...), UserPolicy>
{
public:
    typedef TDelegate<void(ParamTypes...), UserPolicy> FDelegate;
    template <typename UserClass, typename... VarTypes> using TMethodPtr = typename TMemFunPtrType<false, UserClass, void(ParamTypes..., std::decay_t<VarTypes>...)>::Type;
    template <typename UserClass, typename... VarTypes> using TConstMethodPtr = typename TMemFunPtrType<true, UserClass, void(ParamTypes..., std::decay_t<VarTypes>...)>::Type;

    TMulticastDelegate() {}
    TMulticastDelegate(const TMulticastDelegate&) {}
    TMulticastDelegate& operator=(const TMulticastDelegate&) { return ::UEStub::Fake<TMulticastDelegate&>(); }
    ~TMulticastDelegate() {}

    FDelegateHandle Add(const FDelegate& InNewDelegate) { return ::UEStub::Fake<FDelegateHandle>(); }
    FDelegateHandle Add(FDelegate&& InNewDelegate) { return ::UEStub::Fake<FDelegateHandle>(); }
    template <typename... VarTypes> FDelegateHandle AddStatic(void (*InFunc)(ParamTypes..., std::decay_t<VarTypes>...), VarTypes&&... Vars) { return ::UEStub::Fake<FDelegateHandle>(); }
    template <typename FunctorType, typename... VarTypes> FDelegateHandle AddLambda(FunctorType&& InFunctor, VarTypes&&... Vars)
    { static_assert(UEStub::IsCallableAs<std::decay_t<FunctorType>, void, ParamTypes..., VarTypes...>, "AddLambda: lambda signature does not match the delegate"); return FDelegateHandle(); }
    template <typename UserClass, typename FunctorType, typename... VarTypes> FDelegateHandle AddWeakLambda(UserClass* InUserObject, FunctorType&& InFunctor, VarTypes&&... Vars)
    { static_assert(UEStub::IsCallableAs<std::decay_t<FunctorType>, void, ParamTypes..., VarTypes...>, "AddWeakLambda: lambda signature does not match the delegate"); return FDelegateHandle(); }
    template <typename UserClass, typename... VarTypes> FDelegateHandle AddRaw(UserClass* InUserObject, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<FDelegateHandle>(); }
    template <typename UserClass, typename... VarTypes> FDelegateHandle AddRaw(const UserClass* InUserObject, TConstMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<FDelegateHandle>(); }
    template <typename UserClass, ESPMode Mode, typename... VarTypes> FDelegateHandle AddSP(const TSharedRef<UserClass, Mode>& InUserObjectRef, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<FDelegateHandle>(); }
    template <typename UserClass, typename... VarTypes> FDelegateHandle AddSP(UserClass* InUserObject, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<FDelegateHandle>(); }
    template <typename UObjectTemplate, typename... VarTypes> FDelegateHandle AddUFunction(UObjectTemplate* InUserObject, const FName& InFunctionName, VarTypes&&... Vars) { return ::UEStub::Fake<FDelegateHandle>(); }
    template <typename UserClass, typename... VarTypes> FDelegateHandle AddUObject(UserClass* InUserObject, TMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<FDelegateHandle>(); }
    template <typename UserClass, typename... VarTypes> FDelegateHandle AddUObject(const UserClass* InUserObject, TConstMethodPtr<UserClass, VarTypes...> InFunc, VarTypes&&... Vars) { return ::UEStub::Fake<FDelegateHandle>(); }
    bool Remove(FDelegateHandle Handle) { return ::UEStub::Fake<bool>(); }
    int32 RemoveAll(const void* InUserObject) { return ::UEStub::Fake<int32>(); }
    void Clear() {}
    bool IsBound() const { return ::UEStub::Fake<bool>(); }
    bool IsBoundToObject(void const* InUserObject) const { return ::UEStub::Fake<bool>(); }
    void Broadcast(ParamTypes... Params) const {}
};

// Dynamic (reflected) delegates. AddDynamic/BindDynamic check the handler signature exactly.
template <typename... ParamTypes>
class TBaseDynamicDelegate
{
public:
    template <typename UserClass> using TMethodPtrResolver = void (UserClass::*)(ParamTypes...);
    template <typename UserClass> void __Internal_BindDynamic(UserClass* InUserObject, void (UserClass::*InMethodPtr)(ParamTypes...), FName InFunctionName) {}
    void BindUFunction(UObject* InObject, const FName& InFunctionName) {}
    bool IsBound() const { return ::UEStub::Fake<bool>(); }
    bool IsBoundToObject(void const* InUserObject) const { return ::UEStub::Fake<bool>(); }
    void Unbind() {}
    void Clear() {}
    FName GetFunctionName() const { return ::UEStub::Fake<FName>(); }
    UObject* GetUObject() const { return ::UEStub::Fake<UObject*>(); }
    void Execute(ParamTypes... Params) const {}
    void ExecuteIfBound(ParamTypes... Params) const {}
};
template <typename RetType, typename... ParamTypes>
class TBaseDynamicDelegateRet
{
public:
    template <typename UserClass> void __Internal_BindDynamic(UserClass* InUserObject, RetType (UserClass::*InMethodPtr)(ParamTypes...), FName InFunctionName) {}
    void BindUFunction(UObject* InObject, const FName& InFunctionName) {}
    bool IsBound() const { return ::UEStub::Fake<bool>(); }
    void Unbind() {}
    void Clear() {}
    RetType Execute(ParamTypes... Params) const { return ::UEStub::Fake<RetType>(); }
};
template <typename... ParamTypes>
class TBaseDynamicMulticastDelegate
{
public:
    template <typename UserClass> void __Internal_AddDynamic(UserClass* InUserObject, void (UserClass::*InMethodPtr)(ParamTypes...), FName InFunctionName) {}
    template <typename UserClass> void __Internal_AddUniqueDynamic(UserClass* InUserObject, void (UserClass::*InMethodPtr)(ParamTypes...), FName InFunctionName) {}
    template <typename UserClass> void __Internal_RemoveDynamic(UserClass* InUserObject, void (UserClass::*InMethodPtr)(ParamTypes...), FName InFunctionName) {}
    template <typename UserClass> bool __Internal_IsAlreadyBound(UserClass* InUserObject, void (UserClass::*InMethodPtr)(ParamTypes...), FName InFunctionName) const { return ::UEStub::Fake<bool>(); }
    void Add(const TBaseDynamicDelegate<ParamTypes...>& InDelegate) {}
    void AddUnique(const TBaseDynamicDelegate<ParamTypes...>& InDelegate) {}
    void Remove(const TBaseDynamicDelegate<ParamTypes...>& InDelegate) {}
    void RemoveAll(const UObject* Object) {}
    void Clear() {}
    bool IsBound() const { return ::UEStub::Fake<bool>(); }
    bool Contains(const UObject* InObject, FName InFunctionName) const { return ::UEStub::Fake<bool>(); }
    void Broadcast(ParamTypes... Params) const {}
};

#define STATIC_FUNCTION_FNAME(str) FName(str)
// Binding a dynamic delegate needs the target to be a UFUNCTION: UE compiles the bind and then
// ensures at runtime ("Unable to bind delegate to ... (function might not be marked as a UFUNCTION)").
// The stub UHT gives every game UCLASS a constexpr list of its UFUNCTIONs, so this is checked here.
namespace UEStub
{
    template <size_t N>
    struct TFixedString
    {
        char Chars[N];
        consteval TFixedString(const char (&S)[N]) { for (size_t I = 0; I < N; ++I) Chars[I] = S[I]; }
        constexpr std::string_view FunctionName() const
        {
            std::string_view V(Chars, N - 1);
            const size_t Colons = V.rfind("::");
            if (Colons != std::string_view::npos) V = V.substr(Colons + 2);
            while (!V.empty() && (V.back() == ' ' || V.back() == ')')) V.remove_suffix(1);
            return V;
        }
    };
    template <typename T> struct TMemberFunctionClass { using Type = void; };
    template <typename C, typename F> struct TMemberFunctionClass<F C::*> { using Type = C; };
    template <TFixedString Expr, typename PtrType>
    consteval bool IsBindableUFunction()
    {
        using C = typename TMemberFunctionClass<std::remove_cvref_t<PtrType>>::Type;
        if constexpr (requires { C::UEStubIsUFunction(std::string_view()); }) return C::UEStubIsUFunction(Expr.FunctionName());
        else return true; // engine class or not a member pointer: nothing to check
    }
    template <bool bIsUFunction>
    FName CheckedUFunctionName(const TCHAR* Name)
    {
        static_assert(bIsUFunction, "AddDynamic/BindDynamic: the bound function is not declared with UFUNCTION() (UE fails the bind at runtime)");
        return FName(Name);
    }
}
#define UESTUB_DYNAMIC_FNAME(FuncName) ::UEStub::CheckedUFunctionName<::UEStub::IsBindableUFunction<#FuncName, decltype(FuncName)>()>(TEXT(#FuncName))
#define AddDynamic(UserObject, FuncName) __Internal_AddDynamic(UserObject, FuncName, UESTUB_DYNAMIC_FNAME(FuncName))
#define AddUniqueDynamic(UserObject, FuncName) __Internal_AddUniqueDynamic(UserObject, FuncName, UESTUB_DYNAMIC_FNAME(FuncName))
#define RemoveDynamic(UserObject, FuncName) __Internal_RemoveDynamic(UserObject, FuncName, STATIC_FUNCTION_FNAME(TEXT(#FuncName)))
#define IsAlreadyBound(UserObject, FuncName) __Internal_IsAlreadyBound(UserObject, FuncName, STATIC_FUNCTION_FNAME(TEXT(#FuncName)))
#define BindDynamic(UserObject, FuncName) __Internal_BindDynamic(UserObject, FuncName, UESTUB_DYNAMIC_FNAME(FuncName))

// ---------------------------------------------------------------- declaration macros
// Parameter lists are written as (Type1, Name1, Type2, Name2...) in UE; the macros below keep the types.
#define UESTUB_TYPES_0()
#define UESTUB_TYPES_2(T1, N1) T1
#define UESTUB_TYPES_4(T1, N1, T2, N2) T1, T2
#define UESTUB_TYPES_6(T1, N1, T2, N2, T3, N3) T1, T2, T3
#define UESTUB_TYPES_8(T1, N1, T2, N2, T3, N3, T4, N4) T1, T2, T3, T4
#define UESTUB_TYPES_10(T1, N1, T2, N2, T3, N3, T4, N4, T5, N5) T1, T2, T3, T4, T5
#define UESTUB_TYPES_12(T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6) T1, T2, T3, T4, T5, T6
#define UESTUB_TYPES_14(T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6, T7, N7) T1, T2, T3, T4, T5, T6, T7
#define UESTUB_TYPES_16(T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6, T7, N7, T8, N8) T1, T2, T3, T4, T5, T6, T7, T8
#define UESTUB_TYPES_18(T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6, T7, N7, T8, N8, T9, N9) T1, T2, T3, T4, T5, T6, T7, T8, T9

#define DECLARE_DELEGATE(DelegateName) typedef TDelegate<void()> DelegateName;
#define DECLARE_DELEGATE_OneParam(DelegateName, P1) typedef TDelegate<void(P1)> DelegateName;
#define DECLARE_DELEGATE_TwoParams(DelegateName, P1, P2) typedef TDelegate<void(P1, P2)> DelegateName;
#define DECLARE_DELEGATE_ThreeParams(DelegateName, P1, P2, P3) typedef TDelegate<void(P1, P2, P3)> DelegateName;
#define DECLARE_DELEGATE_FourParams(DelegateName, P1, P2, P3, P4) typedef TDelegate<void(P1, P2, P3, P4)> DelegateName;
#define DECLARE_DELEGATE_FiveParams(DelegateName, P1, P2, P3, P4, P5) typedef TDelegate<void(P1, P2, P3, P4, P5)> DelegateName;
#define DECLARE_DELEGATE_SixParams(DelegateName, P1, P2, P3, P4, P5, P6) typedef TDelegate<void(P1, P2, P3, P4, P5, P6)> DelegateName;
#define DECLARE_DELEGATE_RetVal(R, DelegateName) typedef TDelegate<R()> DelegateName;
#define DECLARE_DELEGATE_RetVal_OneParam(R, DelegateName, P1) typedef TDelegate<R(P1)> DelegateName;
#define DECLARE_DELEGATE_RetVal_TwoParams(R, DelegateName, P1, P2) typedef TDelegate<R(P1, P2)> DelegateName;
#define DECLARE_DELEGATE_RetVal_ThreeParams(R, DelegateName, P1, P2, P3) typedef TDelegate<R(P1, P2, P3)> DelegateName;
#define DECLARE_DELEGATE_RetVal_FourParams(R, DelegateName, P1, P2, P3, P4) typedef TDelegate<R(P1, P2, P3, P4)> DelegateName;
#define DECLARE_MULTICAST_DELEGATE(DelegateName) typedef TMulticastDelegate<void()> DelegateName;
#define DECLARE_MULTICAST_DELEGATE_OneParam(DelegateName, P1) typedef TMulticastDelegate<void(P1)> DelegateName;
#define DECLARE_MULTICAST_DELEGATE_TwoParams(DelegateName, P1, P2) typedef TMulticastDelegate<void(P1, P2)> DelegateName;
#define DECLARE_MULTICAST_DELEGATE_ThreeParams(DelegateName, P1, P2, P3) typedef TMulticastDelegate<void(P1, P2, P3)> DelegateName;
#define DECLARE_MULTICAST_DELEGATE_FourParams(DelegateName, P1, P2, P3, P4) typedef TMulticastDelegate<void(P1, P2, P3, P4)> DelegateName;
#define DECLARE_MULTICAST_DELEGATE_FiveParams(DelegateName, P1, P2, P3, P4, P5) typedef TMulticastDelegate<void(P1, P2, P3, P4, P5)> DelegateName;
#define DECLARE_MULTICAST_DELEGATE_SixParams(DelegateName, P1, P2, P3, P4, P5, P6) typedef TMulticastDelegate<void(P1, P2, P3, P4, P5, P6)> DelegateName;
#define DECLARE_TS_MULTICAST_DELEGATE(DelegateName) DECLARE_MULTICAST_DELEGATE(DelegateName)
#define DECLARE_TS_MULTICAST_DELEGATE_OneParam(DelegateName, P1) DECLARE_MULTICAST_DELEGATE_OneParam(DelegateName, P1)
#define DECLARE_TS_MULTICAST_DELEGATE_TwoParams(DelegateName, P1, P2) DECLARE_MULTICAST_DELEGATE_TwoParams(DelegateName, P1, P2)
#define DECLARE_EVENT(OwningType, EventName) typedef TMulticastDelegate<void()> EventName;
#define DECLARE_EVENT_OneParam(OwningType, EventName, P1) typedef TMulticastDelegate<void(P1)> EventName;
#define DECLARE_EVENT_TwoParams(OwningType, EventName, P1, P2) typedef TMulticastDelegate<void(P1, P2)> EventName;
#define DECLARE_EVENT_ThreeParams(OwningType, EventName, P1, P2, P3) typedef TMulticastDelegate<void(P1, P2, P3)> EventName;

#define DECLARE_DYNAMIC_DELEGATE(DelegateName) class DelegateName : public TBaseDynamicDelegate<> {};
#define DECLARE_DYNAMIC_DELEGATE_OneParam(DelegateName, T1, N1) class DelegateName : public TBaseDynamicDelegate<T1> {};
#define DECLARE_DYNAMIC_DELEGATE_TwoParams(DelegateName, T1, N1, T2, N2) class DelegateName : public TBaseDynamicDelegate<T1, T2> {};
#define DECLARE_DYNAMIC_DELEGATE_ThreeParams(DelegateName, T1, N1, T2, N2, T3, N3) class DelegateName : public TBaseDynamicDelegate<T1, T2, T3> {};
#define DECLARE_DYNAMIC_DELEGATE_FourParams(DelegateName, T1, N1, T2, N2, T3, N3, T4, N4) class DelegateName : public TBaseDynamicDelegate<T1, T2, T3, T4> {};
#define DECLARE_DYNAMIC_DELEGATE_RetVal(R, DelegateName) class DelegateName : public TBaseDynamicDelegateRet<R> {};
#define DECLARE_DYNAMIC_DELEGATE_RetVal_OneParam(R, DelegateName, T1, N1) class DelegateName : public TBaseDynamicDelegateRet<R, T1> {};
#define DECLARE_DYNAMIC_DELEGATE_RetVal_TwoParams(R, DelegateName, T1, N1, T2, N2) class DelegateName : public TBaseDynamicDelegateRet<R, T1, T2> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE(DelegateName) class DelegateName : public TBaseDynamicMulticastDelegate<> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(DelegateName, T1, N1) class DelegateName : public TBaseDynamicMulticastDelegate<T1> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(DelegateName, T1, N1, T2, N2) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(DelegateName, T1, N1, T2, N2, T3, N3) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_FourParams(DelegateName, T1, N1, T2, N2, T3, N3, T4, N4) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_FiveParams(DelegateName, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4, T5> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_SixParams(DelegateName, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4, T5, T6> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_SevenParams(DelegateName, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6, T7, N7) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4, T5, T6, T7> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_EightParams(DelegateName, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6, T7, N7, T8, N8) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4, T5, T6, T7, T8> {};
#define DECLARE_DYNAMIC_MULTICAST_DELEGATE_NineParams(DelegateName, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6, T7, N7, T8, N8, T9, N9) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4, T5, T6, T7, T8, T9> {};
#define DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE(DelegateName, OwningClass, DelegateVar) class DelegateName : public TBaseDynamicMulticastDelegate<> {};
#define DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_OneParam(DelegateName, OwningClass, DelegateVar, T1, N1) class DelegateName : public TBaseDynamicMulticastDelegate<T1> {};
#define DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_TwoParams(DelegateName, OwningClass, DelegateVar, T1, N1, T2, N2) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2> {};
#define DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_ThreeParams(DelegateName, OwningClass, DelegateVar, T1, N1, T2, N2, T3, N3) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3> {};
#define DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_FourParams(DelegateName, OwningClass, DelegateVar, T1, N1, T2, N2, T3, N3, T4, N4) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4> {};
#define DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_FiveParams(DelegateName, OwningClass, DelegateVar, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4, T5> {};
#define DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_SixParams(DelegateName, OwningClass, DelegateVar, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4, T5, T6> {};

#define DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_SevenParams(DelegateName, OwningClass, DelegateVar, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6, T7, N7) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4, T5, T6, T7> {};
#define DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_EightParams(DelegateName, OwningClass, DelegateVar, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6, T7, N7, T8, N8) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4, T5, T6, T7, T8> {};
#define DECLARE_DYNAMIC_MULTICAST_SPARSE_DELEGATE_NineParams(DelegateName, OwningClass, DelegateVar, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6, T7, N7, T8, N8, T9, N9) class DelegateName : public TBaseDynamicMulticastDelegate<T1, T2, T3, T4, T5, T6, T7, T8, T9> {};
#define DECLARE_DYNAMIC_DELEGATE_FiveParams(DelegateName, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5) class DelegateName : public TBaseDynamicDelegate<T1, T2, T3, T4, T5> {};
#define DECLARE_DYNAMIC_DELEGATE_SixParams(DelegateName, T1, N1, T2, N2, T3, N3, T4, N4, T5, N5, T6, N6) class DelegateName : public TBaseDynamicDelegate<T1, T2, T3, T4, T5, T6> {};
#define DECLARE_DELEGATE_SevenParams(DelegateName, P1, P2, P3, P4, P5, P6, P7) typedef TDelegate<void(P1, P2, P3, P4, P5, P6, P7)> DelegateName;
#define DECLARE_DELEGATE_RetVal_FiveParams(R, DelegateName, P1, P2, P3, P4, P5) typedef TDelegate<R(P1, P2, P3, P4, P5)> DelegateName;
#define DECLARE_MULTICAST_DELEGATE_SevenParams(DelegateName, P1, P2, P3, P4, P5, P6, P7) typedef TMulticastDelegate<void(P1, P2, P3, P4, P5, P6, P7)> DelegateName;
#define DECLARE_TS_MULTICAST_DELEGATE_ThreeParams(DelegateName, P1, P2, P3) DECLARE_MULTICAST_DELEGATE_ThreeParams(DelegateName, P1, P2, P3)
#define DECLARE_EVENT_FourParams(OwningType, EventName, P1, P2, P3, P4) typedef TMulticastDelegate<void(P1, P2, P3, P4)> EventName;

typedef TDelegate<void()> FSimpleDelegate;
typedef TMulticastDelegate<void()> FSimpleMulticastDelegate;
typedef TDelegate<bool(float)> FTickerDelegate;
