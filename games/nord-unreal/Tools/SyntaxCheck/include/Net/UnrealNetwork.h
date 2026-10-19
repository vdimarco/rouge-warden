// Offline UE 5.x API stub: Net/UnrealNetwork.h (replication macros)
#pragma once
#include "UEStub/UObjectCore.h"
#include "Engine/EngineTypes.h"
struct FLifetimeProperty
{
    uint16 RepIndex;
    ELifetimeCondition Condition;
    ELifetimeRepNotifyCondition RepNotifyCondition;
    bool bIsPushBased;
    FLifetimeProperty();
};
struct FDoRepLifetimeParams
{
    ELifetimeCondition Condition = COND_None;
    ELifetimeRepNotifyCondition RepNotifyCondition = REPNOTIFY_OnChanged;
    bool bIsPushBased = false;
};
namespace UEStub
{
    template <typename T> char MemberCheck(const T&);
    template <typename Base, typename Derived> constexpr bool ValidateReplicatedClassInheritance() { return std::is_base_of_v<Base, Derived>; }
    void RegisterReplicated(TArray<FLifetimeProperty>& OutLifetimeProps, const FDoRepLifetimeParams& Params);
}
#define UESTUB_REP_CHECK(c, v) \
    static_assert(::UEStub::ValidateReplicatedClassInheritance<c, ThisClass>(), #c "." #v " is not accessible from this class."); \
    (void)sizeof(::UEStub::MemberCheck(((c*)nullptr)->v)); \
    static_assert([](auto* UEStubProbe) constexpr { return requires { std::remove_pointer_t<decltype(UEStubProbe)>::UEStubReplicated_##v; }; }((c*)nullptr), \
        "DOREPLIFETIME(" #c ", " #v "): '" #v "' is not a UPROPERTY(Replicated) or UPROPERTY(ReplicatedUsing=...) of " #c " (UE asserts at runtime)");
#define DOREPLIFETIME_WITH_PARAMS(c, v, params) { UESTUB_REP_CHECK(c, v) const FDoRepLifetimeParams UEStubRepParams = params; ::UEStub::RegisterReplicated(OutLifetimeProps, UEStubRepParams); }
#define DOREPLIFETIME_WITH_PARAMS_FAST(c, v, params) DOREPLIFETIME_WITH_PARAMS(c, v, params)
#define DOREPLIFETIME_WITH_PARAMS_FAST_STATIC_ARRAY(c, v, params) DOREPLIFETIME_WITH_PARAMS(c, v, params)
#define DOREPLIFETIME(c, v) DOREPLIFETIME_WITH_PARAMS(c, v, FDoRepLifetimeParams())
#define DOREPLIFETIME_CONDITION(c, v, cond) { FDoRepLifetimeParams UEStubRepCond; UEStubRepCond.Condition = cond; DOREPLIFETIME_WITH_PARAMS(c, v, UEStubRepCond) }
#define DOREPLIFETIME_CONDITION_NOTIFY(c, v, cond, rncond) { FDoRepLifetimeParams UEStubRepCondN; UEStubRepCondN.Condition = cond; UEStubRepCondN.RepNotifyCondition = rncond; DOREPLIFETIME_WITH_PARAMS(c, v, UEStubRepCondN) }
#define DOREPLIFETIME_ACTIVE_OVERRIDE(c, v, active) { UESTUB_REP_CHECK(c, v) (void)static_cast<bool>(active); }
#define DOREPLIFETIME_ACTIVE_OVERRIDE_FAST(c, v, active) DOREPLIFETIME_ACTIVE_OVERRIDE(c, v, active)
#define DISABLE_REPLICATED_PROPERTY(c, v) { UESTUB_REP_CHECK(c, v) }
#define DISABLE_REPLICATED_PROPERTY_FAST(c, v) DISABLE_REPLICATED_PROPERTY(c, v)
#define DISABLE_ALL_CLASS_REPLICATED_PROPERTIES(c, SuperClassBehavior)
#define RESET_REPLIFETIME_CONDITION(c, v, cond) { UESTUB_REP_CHECK(c, v) (void)(ELifetimeCondition)(cond); }
#define RESET_REPLIFETIME(c, v, params) { UESTUB_REP_CHECK(c, v) }
#define MARK_PROPERTY_DIRTY_FROM_NAME(c, v, obj) { (void)sizeof(::UEStub::MemberCheck(((c*)nullptr)->v)); (void)(obj); }
#define MARK_PROPERTY_DIRTY_FROM_NAME_STATIC_ARRAY(c, v, i, obj) MARK_PROPERTY_DIRTY_FROM_NAME(c, v, obj)
#define GET_MEMBER_NAME_CHECKED(ClassName, MemberName) ((void)sizeof(::UEStub::MemberCheck(((ClassName*)nullptr)->MemberName)), FName(TEXT(#MemberName)))
#define GET_MEMBER_NAME_STRING_CHECKED(ClassName, MemberName) ((void)sizeof(::UEStub::MemberCheck(((ClassName*)nullptr)->MemberName)), TEXT(#MemberName))
#define GET_FUNCTION_NAME_CHECKED(ClassName, FunctionName) ((void)sizeof(&ClassName::FunctionName), FName(TEXT(#FunctionName)))
