// Offline UE 5.x API stub: Kismet/KismetMathLibrary.h (Blueprint math helpers; doubles since LWC)
#pragma once
#include "Kismet/BlueprintFunctionLibrary.h"
namespace ELerpInterpolationMode { enum Type : int { QuatInterp, EulerInterp, DualQuatInterp }; }
namespace EEasingFunc { enum Type : int { Linear, Step, SinusoidalIn, SinusoidalOut, SinusoidalInOut, EaseIn, EaseOut, EaseInOut, ExpoIn, ExpoOut, ExpoInOut, CircularIn, CircularOut, CircularInOut }; }
class UKismetMathLibrary : public UBlueprintFunctionLibrary
{
    UESTUB_UCLASS_BODY(UKismetMathLibrary, UBlueprintFunctionLibrary)
    // random
    static bool RandomBool();
    static bool RandomBoolWithWeight(float Weight);
    static int32 RandomInteger(int32 Max);
    static int32 RandomIntegerInRange(int32 Min, int32 Max);
    static double RandomFloat();
    static double RandomFloatInRange(double Min, double Max);
    static FVector RandomUnitVector();
    static FVector RandomUnitVectorInConeInDegrees(FVector ConeDir, float ConeHalfAngleInDegrees);
    static FVector RandomUnitVectorInConeInRadians(FVector ConeDir, float ConeHalfAngleInRadians);
    static FVector RandomPointInBoundingBox(const FVector Center, const FVector HalfSize);
    static FRotator RandomRotator(bool bRoll = false);
    // float / int
    static double Lerp(double A, double B, double Alpha);
    static double FInterpTo(double Current, double Target, double DeltaTime, double InterpSpeed);
    static double FInterpTo_Constant(double Current, double Target, double DeltaTime, double InterpSpeed);
    static double MapRangeClamped(double Value, double InRangeA, double InRangeB, double OutRangeA, double OutRangeB);
    static double MapRangeUnclamped(double Value, double InRangeA, double InRangeB, double OutRangeA, double OutRangeB);
    static double NormalizeToRange(double Value, double RangeMin, double RangeMax);
    static double FClamp(double Value, double Min, double Max);
    static int32 Clamp(int32 Value, int32 Min, int32 Max);
    static double ClampAngle(double AngleDegrees, double MinAngleDegrees, double MaxAngleDegrees);
    static double NormalizeAxis(double Angle);
    static double Ease(double A, double B, double Alpha, TEnumAsByte<EEasingFunc::Type> EasingFunc, double BlendExp = 2, int32 Steps = 2);
    static double SelectFloat(double A, double B, bool bPickA);
    static bool NearlyEqual_FloatFloat(double A, double B, double ErrorTolerance = 1.e-6);
    static bool InRange_FloatFloat(double Value, double Min, double Max, bool InclusiveMin = true, bool InclusiveMax = true);
    static double DegSin(double A);
    static double DegCos(double A);
    static double DegAtan2(double Y, double X);
    static double SafeDivide(double A, double B);
    static int32 FTrunc(double A);
    static int32 Round(double A);
    static int32 FFloor(double A);
    static int32 FCeil(double A);
    // vectors
    static double Vector_Distance(FVector V1, FVector V2);
    static double Vector_Distance2D(FVector V1, FVector V2);
    static double VSize(FVector A);
    static double VSizeXY(FVector A);
    static FVector Normal(FVector A, float Tolerance = 1.e-4f);
    static FVector GetDirectionUnitVector(FVector From, FVector To);
    static FVector VInterpTo(FVector Current, FVector Target, float DeltaTime, float InterpSpeed);
    static FVector VInterpTo_Constant(FVector Current, FVector Target, float DeltaTime, float InterpSpeed);
    static FVector VLerp(FVector A, FVector B, float Alpha);
    static FVector ClampVectorSize(FVector A, double Min, double Max);
    static FVector ProjectVectorOnToVector(FVector V, FVector Target);
    static FVector ProjectVectorOnToPlane(FVector V, FVector PlaneNormal);
    static FVector MirrorVectorByNormal(FVector InVect, FVector InNormal);
    static FVector RotateAngleAxis(FVector InVect, float AngleDeg, FVector Axis);
    static FVector Cross_VectorVector(FVector A, FVector B);
    static double Dot_VectorVector(FVector A, FVector B);
    static FVector GetForwardVector(FRotator InRot);
    static FVector GetRightVector(FRotator InRot);
    static FVector GetUpVector(FRotator InRot);
    static FRotator Conv_VectorToRotator(FVector InVec);
    static FVector Conv_RotatorToVector(FRotator InRot);
    // rotators / transforms
    static FRotator FindLookAtRotation(const FVector& Start, const FVector& Target);
    static FRotator MakeRotFromX(const FVector& X);
    static FRotator MakeRotFromY(const FVector& Y);
    static FRotator MakeRotFromZ(const FVector& Z);
    static FRotator MakeRotFromXZ(const FVector& X, const FVector& Z);
    static FRotator MakeRotFromZX(const FVector& Z, const FVector& X);
    static FRotator RInterpTo(FRotator Current, FRotator Target, float DeltaTime, float InterpSpeed);
    static FRotator RInterpTo_Constant(FRotator Current, FRotator Target, float DeltaTime, float InterpSpeed);
    static FRotator RLerp(FRotator A, FRotator B, float Alpha, bool bShortestPath);
    static FRotator NormalizedDeltaRotator(FRotator A, FRotator B);
    static FRotator ComposeRotators(FRotator A, FRotator B);
    static FRotator NegateRotator(FRotator A);
    static FTransform MakeTransform(FVector Location, FRotator Rotation, FVector Scale = FVector(1.f, 1.f, 1.f));
    static FVector TransformLocation(const FTransform& T, FVector Location);
    static FVector TransformDirection(const FTransform& T, FVector Direction);
    static FVector InverseTransformLocation(const FTransform& T, FVector Location);
    static FVector InverseTransformDirection(const FTransform& T, FVector Direction);
    static FTransform TLerp(const FTransform& A, const FTransform& B, float Alpha, TEnumAsByte<ELerpInterpolationMode::Type> InterpMode = ELerpInterpolationMode::QuatInterp);
    // colors
    static FLinearColor LinearColorLerp(FLinearColor A, FLinearColor B, float Alpha);
    static FLinearColor HSVToRGB(float H, float S, float V, float A = 1.0f);
    static FColor Conv_LinearColorToColor(FLinearColor InLinearColor, bool InUseSRGB = true);
    static FLinearColor Conv_ColorToLinearColor(FColor InColor);
};
