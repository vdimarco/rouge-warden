// Offline UE 5.x API stub: EngineUtils.h (actor iterators)
#pragma once
#include "Engine/World.h"
#include "GameFramework/Actor.h"
enum class EActorIteratorFlags { AllActors = 0x0, OnlyActiveLevels = 0x1, SkipPendingKill = 0x2, OnlySelectedActors = 0x4 };
ENUM_CLASS_FLAGS(EActorIteratorFlags)
template <typename ActorType>
class TActorIterator
{
    static_assert(std::is_base_of_v<AActor, ActorType>, "TActorIterator can only be used with actors");
public:
    explicit TActorIterator(const UWorld* InWorld, TSubclassOf<ActorType> InClass = ActorType::StaticClass(), EActorIteratorFlags InFlags = EActorIteratorFlags::OnlyActiveLevels | EActorIteratorFlags::SkipPendingKill);
    ActorType* operator*() const;
    ActorType* operator->() const;
    TActorIterator& operator++();
    explicit operator bool() const;
    bool operator!() const;
};
template <typename ActorType>
class TActorRange
{
public:
    explicit TActorRange(const UWorld* InWorld, TSubclassOf<ActorType> InClass = ActorType::StaticClass(), EActorIteratorFlags InFlags = EActorIteratorFlags::OnlyActiveLevels | EActorIteratorFlags::SkipPendingKill);
    struct FIter { ActorType* operator*() const; FIter& operator++(); bool operator!=(const FIter&) const; };
    FIter begin() const;
    FIter end() const;
};
class FActorIterator
{
public:
    explicit FActorIterator(const UWorld* InWorld, const EActorIteratorFlags InFlags = EActorIteratorFlags::OnlyActiveLevels | EActorIteratorFlags::SkipPendingKill);
    AActor* operator*() const;
    AActor* operator->() const;
    FActorIterator& operator++();
    explicit operator bool() const;
};
template <typename T> class TSelectedActorIterator : public TActorIterator<T> { public: using TActorIterator<T>::TActorIterator; };
