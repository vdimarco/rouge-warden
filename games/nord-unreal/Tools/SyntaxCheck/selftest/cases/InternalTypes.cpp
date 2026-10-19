// EXPECT: PASS
// Containers, smart pointers and delegates instantiated with anonymous-namespace and local types.
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
namespace
{
    struct FMemory2 { float Time = 0.f; int32 Count = 0; bool operator==(const FMemory2& O) const { return Count == O.Count; } };
    uint32 GetTypeHash(const FMemory2& M) { return ::GetTypeHash(M.Count); }
    enum class EAnonKind : uint8 { A, B };
    DECLARE_DELEGATE_OneParam(FAnonDelegate, const FMemory2&);
}
float UseAll(AActor* Actor)
{
    TArray<FMemory2> Arr;
    Arr.Add(FMemory2());
    Arr.Emplace();
    Arr.AddDefaulted();
    Arr.SetNum(4);
    Arr.Reserve(8);
    Arr.RemoveAt(0);
    Arr.Insert(FMemory2(), 0);
    Arr.Sort([](const FMemory2& A, const FMemory2& B) { return A.Time < B.Time; });
    FMemory2* Found = Arr.FindByPredicate([](const FMemory2& M) { return M.Count > 1; });
    Arr.RemoveAll([](const FMemory2& M) { return M.Count == 0; });
    const int32 Idx = Arr.IndexOfByPredicate([](const FMemory2& M) { return M.Count == 2; });
    float Sum = 0.f;
    for (const FMemory2& M : Arr) Sum += M.Time;
    for (int32 I = 0; I < Arr.Num(); ++I) Sum += Arr[I].Time + Arr.Last().Time;
    Arr.Empty();
    Arr.Reset();
    TArray<FMemory2> Copy = Arr;
    Copy.Append(Arr);
    Arr = MoveTemp(Copy);
    TMap<TWeakObjectPtr<AActor>, FMemory2> Map;
    Map.Add(Actor, FMemory2());
    Map.FindOrAdd(Actor).Count++;
    if (FMemory2* P = Map.Find(Actor)) Sum += P->Time;
    Map.Remove(Actor);
    for (auto It = Map.CreateIterator(); It; ++It) { if (!It.Key().IsValid()) It.RemoveCurrent(); else Sum += It.Value().Time; }
    for (const TPair<TWeakObjectPtr<AActor>, FMemory2>& Pair : Map) Sum += Pair.Value.Time;
    for (auto& Pair : Map) Sum += Pair.Value.Time;
    Sum += Map.Num() + (Map.Contains(Actor) ? 1 : 0);
    Map[Actor].Time = 1.f;
    Map.Empty();
    TMap<EAnonKind, FMemory2> ByKind;
    ByKind.Add(EAnonKind::A);
    TSet<FMemory2> Set;
    Set.Add(FMemory2());
    Sum += Set.Contains(FMemory2()) ? 1 : 0;
    for (const FMemory2& M : Set) Sum += M.Time;
    TOptional<FMemory2> Opt;
    if (Opt.IsSet()) Sum += Opt.GetValue().Time;
    Opt = FMemory2();
    Opt.Reset();
    TSharedPtr<FMemory2> Shared = MakeShared<FMemory2>();
    TSharedRef<FMemory2> Ref = MakeShared<FMemory2>();
    TWeakPtr<FMemory2> Weak = Shared;
    if (Shared.IsValid()) Sum += Shared->Time + Ref->Time;
    if (TSharedPtr<FMemory2> Pinned = Weak.Pin()) Sum += Pinned->Time;
    TUniquePtr<FMemory2> Unique = MakeUnique<FMemory2>();
    Sum += Unique->Time;
    TFunction<FMemory2(int32)> Fn = [](int32 N) { FMemory2 M; M.Count = N; return M; };
    Sum += Fn(3).Time;
    TTuple<FMemory2, int32> Tup(FMemory2(), 1);
    Sum += Tup.Get<0>().Time;
    TArrayView<const FMemory2> View(Arr);
    Sum += View.Num();
    FAnonDelegate D = FAnonDelegate::CreateLambda([](const FMemory2& M) {});
    D.ExecuteIfBound(FMemory2());
    struct FLocal { int32 X = 0; };
    TArray<FLocal> Locals;
    Locals.Add(FLocal());
    Locals.Sort([](const FLocal& A, const FLocal& B) { return A.X < B.X; });
    for (const FLocal& L : Locals) Sum += L.X;
    TMap<FName, FLocal> LocalMap;
    LocalMap.Add(NAME_None, FLocal());
    if (FLocal* L = LocalMap.Find(NAME_None)) Sum += L->X;
    (void)Found; (void)Idx;
    return Sum;
}
