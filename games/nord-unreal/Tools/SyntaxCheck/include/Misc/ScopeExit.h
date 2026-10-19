// Offline UE 5.x API stub: Misc/ScopeExit.h
#pragma once
#include "CoreMinimal.h"
namespace ScopeExitSupport
{
    template <typename FuncType>
    class TScopeGuard
    {
    public:
        explicit TScopeGuard(FuncType&& InFunc) : Func(static_cast<FuncType&&>(InFunc)) {}
        TScopeGuard(TScopeGuard&& Other) : Func(static_cast<FuncType&&>(Other.Func)) {}
        ~TScopeGuard() { Func(); }
        TScopeGuard(const TScopeGuard&) = delete;
        TScopeGuard& operator=(const TScopeGuard&) = delete;
    private:
        FuncType Func;
    };
    struct FScopeGuardSyntaxSupport
    {
        template <typename FuncType> TScopeGuard<FuncType> operator+(FuncType&& InFunc) { return TScopeGuard<FuncType>(static_cast<FuncType&&>(InFunc)); }
    };
}
#define UE_PRIVATE_SCOPE_EXIT_JOIN(A, B) UE_PRIVATE_SCOPE_EXIT_JOIN_INNER(A, B)
#define UE_PRIVATE_SCOPE_EXIT_JOIN_INNER(A, B) A##B
#define ON_SCOPE_EXIT const auto UE_PRIVATE_SCOPE_EXIT_JOIN(ScopeGuard_, __LINE__) = ::ScopeExitSupport::FScopeGuardSyntaxSupport() + [&]()
