// Offline UE 5.x API stub: Engine/NetSerialization.h (quantized vectors)
#pragma once
#include "UEStub/UObjectCore.h"

struct FVector_NetQuantize : public FVector
{
    FVector_NetQuantize() = default;
    explicit FVector_NetQuantize(EForceInit E) : FVector(E) {}
    FVector_NetQuantize(double InX, double InY, double InZ) : FVector(InX, InY, InZ) {}
    FVector_NetQuantize(const FVector& InVec) : FVector(InVec) {}
};
struct FVector_NetQuantize10 : public FVector
{
    FVector_NetQuantize10() = default;
    FVector_NetQuantize10(double InX, double InY, double InZ) : FVector(InX, InY, InZ) {}
    FVector_NetQuantize10(const FVector& InVec) : FVector(InVec) {}
};
struct FVector_NetQuantize100 : public FVector
{
    FVector_NetQuantize100() = default;
    FVector_NetQuantize100(double InX, double InY, double InZ) : FVector(InX, InY, InZ) {}
    FVector_NetQuantize100(const FVector& InVec) : FVector(InVec) {}
};
struct FVector_NetQuantizeNormal : public FVector
{
    FVector_NetQuantizeNormal() = default;
    FVector_NetQuantizeNormal(double InX, double InY, double InZ) : FVector(InX, InY, InZ) {}
    FVector_NetQuantizeNormal(const FVector& InVec) : FVector(InVec) {}
};
struct FFastArraySerializerItem { int32 ReplicationID; int32 ReplicationKey; int32 MostRecentArrayReplicationKey; };
struct FFastArraySerializer
{
    void MarkItemDirty(FFastArraySerializerItem& Item);
    void MarkArrayDirty();
};
