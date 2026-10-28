// Offline UE 5.x API stub: Components/SplineComponent.h
#pragma once
#include "Components/PrimitiveComponent.h"
namespace ESplineCoordinateSpace { enum Type : int { Local, World }; }
namespace ESplinePointType { enum Type : int { Linear, Curve, Constant, CurveClamped, CurveCustomTangent }; }
struct FSplinePoint
{
    float InputKey;
    FVector Position;
    FVector ArriveTangent;
    FVector LeaveTangent;
    FRotator Rotation;
    FVector Scale;
    TEnumAsByte<ESplinePointType::Type> Type;
    FSplinePoint();
    FSplinePoint(float InInputKey, const FVector& InPosition, ESplinePointType::Type InType = ESplinePointType::Curve);
};
class USplineComponent : public UPrimitiveComponent
{
    UESTUB_UCLASS_BODY(USplineComponent, UPrimitiveComponent)
    USplineComponent(const FObjectInitializer& ObjectInitializer = FObjectInitializer::Get());
    float Duration;
    bool bStationaryEndpoints;
    bool bDrawDebug;
    FLinearColor EditorUnselectedSplineSegmentColor;
    void UpdateSpline();
    int32 GetNumberOfSplinePoints() const;
    int32 GetNumberOfSplineSegments() const;
    float GetSplineLength() const;
    void SetClosedLoop(bool bInClosedLoop, bool bUpdateSpline = true);
    bool IsClosedLoop() const;
    void ClearSplinePoints(bool bUpdateSpline = true);
    void AddSplinePoint(const FVector& Position, ESplineCoordinateSpace::Type CoordinateSpace, bool bUpdateSpline = true);
    void AddSplinePointAtIndex(const FVector& Position, int32 Index, ESplineCoordinateSpace::Type CoordinateSpace, bool bUpdateSpline = true);
    void AddPoint(const FSplinePoint& Point, bool bUpdateSpline = true);
    void AddPoints(const TArray<FSplinePoint>& Points, bool bUpdateSpline = true);
    void RemoveSplinePoint(const int32 Index, bool bUpdateSpline = true);
    void SetSplinePoints(const TArray<FVector>& Points, ESplineCoordinateSpace::Type CoordinateSpace, bool bUpdateSpline = true);
    void SetLocationAtSplinePoint(int32 PointIndex, const FVector& InLocation, ESplineCoordinateSpace::Type CoordinateSpace, bool bUpdateSpline = true);
    void SetTangentAtSplinePoint(int32 PointIndex, const FVector& InTangent, ESplineCoordinateSpace::Type CoordinateSpace, bool bUpdateSpline = true);
    void SetSplinePointType(int32 PointIndex, ESplinePointType::Type Type, bool bUpdateSpline = true);
    ESplinePointType::Type GetSplinePointType(int32 PointIndex) const;
    FVector GetLocationAtSplinePoint(int32 PointIndex, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FVector GetDirectionAtSplinePoint(int32 PointIndex, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FVector GetTangentAtSplinePoint(int32 PointIndex, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FRotator GetRotationAtSplinePoint(int32 PointIndex, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FTransform GetTransformAtSplinePoint(int32 PointIndex, ESplineCoordinateSpace::Type CoordinateSpace, bool bUseScale = false) const;
    float GetDistanceAlongSplineAtSplinePoint(int32 PointIndex) const;
    float GetDistanceAlongSplineAtSplineInputKey(float InKey) const;
    float GetInputKeyAtDistanceAlongSpline(float Distance) const;
    FVector GetLocationAtDistanceAlongSpline(float Distance, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FVector GetDirectionAtDistanceAlongSpline(float Distance, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FVector GetTangentAtDistanceAlongSpline(float Distance, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FVector GetRightVectorAtDistanceAlongSpline(float Distance, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FVector GetUpVectorAtDistanceAlongSpline(float Distance, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FRotator GetRotationAtDistanceAlongSpline(float Distance, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FTransform GetTransformAtDistanceAlongSpline(float Distance, ESplineCoordinateSpace::Type CoordinateSpace, bool bUseScale = false) const;
    FVector GetLocationAtTime(float Time, ESplineCoordinateSpace::Type CoordinateSpace, bool bUseConstantVelocity = false) const;
    FVector GetLocationAtSplineInputKey(float InKey, ESplineCoordinateSpace::Type CoordinateSpace) const;
    float FindInputKeyClosestToWorldLocation(const FVector& WorldLocation) const;
    FVector FindLocationClosestToWorldLocation(const FVector& WorldLocation, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FVector FindDirectionClosestToWorldLocation(const FVector& WorldLocation, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FRotator FindRotationClosestToWorldLocation(const FVector& WorldLocation, ESplineCoordinateSpace::Type CoordinateSpace) const;
    FTransform FindTransformClosestToWorldLocation(const FVector& WorldLocation, ESplineCoordinateSpace::Type CoordinateSpace, bool bUseScale = false) const;
};
