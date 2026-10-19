// Offline UE 5.x API stub: Misc/MemStack.h
#pragma once
#include "CoreMinimal.h"
class FMemStackBase { public: int32 GetByteCount() const; bool IsEmpty() const; };
class FMemStack : public FMemStackBase { public: static FMemStack& Get(); };
class FMemMark
{
public:
    FMemMark(FMemStackBase& InMem);
    ~FMemMark();
    void Pop();
    FMemMark(const FMemMark&) = delete;
};
template <uint32 Alignment = 0> class TMemStackAllocator {};
