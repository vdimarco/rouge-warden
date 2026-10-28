// Offline UE 5.x API stub: LWC math types (UE::Math::TVector<double> etc.), colors, FMath.
#pragma once
#include "UEStub/Strings.h"
#include <cmath>

namespace EAxis { enum Type { None, X, Y, Z }; }
namespace EAxisList { enum Type { None = 0, X = 1, Y = 2, Z = 4, Screen = 8, XY = X | Y, XZ = X | Z, YZ = Y | Z, XYZ = X | Y | Z, All = XYZ | Screen }; }

struct FLinearColor;
struct FColor;
template <typename T> struct TIntPoint;
template <typename T> struct TIntVector3;
template <typename T> struct TIntVector2;
template <typename T> struct TIntVector4;
using FIntPoint = TIntPoint<int32>;
using FInt64Point = TIntPoint<int64>;
using FIntVector = TIntVector3<int32>;
using FIntVector3 = TIntVector3<int32>;
using FIntVector2 = TIntVector2<int32>;
using FIntVector4 = TIntVector4<int32>;
using FUintVector = TIntVector3<uint32>;

namespace UE::Math
{
    template <typename T> struct TVector;
    template <typename T> struct TVector2;
    template <typename T> struct TVector4;
    template <typename T> struct TRotator;
    template <typename T> struct TQuat;
    template <typename T> struct TMatrix;
    template <typename T> struct TTransform;
    template <typename T> struct TPlane;
    template <typename T> struct TBox;
    template <typename T> struct TBox2;
    template <typename T> struct TSphere;
    template <typename T, typename TExtent = T> struct TBoxSphereBounds;
    template <typename T> struct TRay;

#define UESTUB_ARITH(FArg) typename FArg, std::enable_if_t<std::is_arithmetic_v<FArg>, int> = 0

    template <typename T>
    struct TVector
    {
        static_assert(std::is_floating_point_v<T>, "T must be floating point");
        using FReal = T;
        T X;
        T Y;
        T Z;

        static const TVector ZeroVector;
        static const TVector OneVector;
        static const TVector UpVector;
        static const TVector DownVector;
        static const TVector ForwardVector;
        static const TVector BackwardVector;
        static const TVector RightVector;
        static const TVector LeftVector;
        static const TVector XAxisVector;
        static const TVector YAxisVector;
        static const TVector ZAxisVector;
        static TVector Zero() { return TVector(0, 0, 0); }
        static TVector One() { return TVector(1, 1, 1); }
        static TVector UnitX() { return TVector(1, 0, 0); }
        static TVector UnitY() { return TVector(0, 1, 0); }
        static TVector UnitZ() { return TVector(0, 0, 1); }

        TVector() = default;
        explicit constexpr TVector(T InF) : X(InF), Y(InF), Z(InF) {}
        constexpr TVector(T InX, T InY, T InZ) : X(InX), Y(InY), Z(InZ) {}
        explicit TVector(const TVector2<T> V, T InZ);
        TVector(const TVector4<T>& V);
        explicit TVector(const FLinearColor& InColor);
        template <typename IntType> explicit TVector(TIntVector3<IntType> InVector);
        template <typename IntType> explicit TVector(TIntPoint<IntType> A);
        explicit TVector(EForceInit);
        template <typename FArg, std::enable_if_t<!std::is_same_v<T, FArg>, int> = 0>
        explicit TVector(const TVector<FArg>& From) : X((T)From.X), Y((T)From.Y), Z((T)From.Z) {}

        TVector operator^(const TVector& V) const;
        TVector Cross(const TVector& V2) const;
        static TVector CrossProduct(const TVector& A, const TVector& B);
        T operator|(const TVector& V) const;
        T Dot(const TVector& V) const;
        static T DotProduct(const TVector& A, const TVector& B);
        TVector operator+(const TVector& V) const;
        TVector operator-(const TVector& V) const;
        template <UESTUB_ARITH(FArg)> TVector operator-(FArg Bias) const;
        template <UESTUB_ARITH(FArg)> TVector operator+(FArg Bias) const;
        template <UESTUB_ARITH(FArg)> TVector operator*(FArg Scale) const;
        template <UESTUB_ARITH(FArg)> TVector operator/(FArg Scale) const;
        TVector operator*(const TVector& V) const;
        TVector operator/(const TVector& V) const;
        bool operator==(const TVector& V) const;
        bool operator!=(const TVector& V) const;
        bool Equals(const TVector& V, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool AllComponentsEqual(T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        TVector operator-() const;
        TVector operator+=(const TVector& V);
        TVector operator-=(const TVector& V);
        template <UESTUB_ARITH(FArg)> TVector operator*=(FArg Scale);
        template <UESTUB_ARITH(FArg)> TVector operator/=(FArg Scale);
        TVector operator*=(const TVector& V);
        TVector operator/=(const TVector& V);
        T& operator[](int32 Index);
        T operator[](int32 Index) const;
        T& Component(int32 Index);
        T Component(int32 Index) const;
        T GetComponentForAxis(EAxis::Type Axis) const;
        void SetComponentForAxis(EAxis::Type Axis, T Component);
        void Set(T InX, T InY, T InZ);
        T GetMax() const;
        T GetAbsMax() const;
        T GetMin() const;
        T GetAbsMin() const;
        TVector ComponentMin(const TVector& Other) const;
        TVector ComponentMax(const TVector& Other) const;
        static TVector Min(const TVector& A, const TVector& B);
        static TVector Max(const TVector& A, const TVector& B);
        static TVector Min3(const TVector& A, const TVector& B, const TVector& C);
        static TVector Max3(const TVector& A, const TVector& B, const TVector& C);
        TVector GetAbs() const;
        T Size() const;
        T Length() const;
        T SizeSquared() const;
        T SquaredLength() const;
        T Size2D() const;
        T SizeSquared2D() const;
        bool IsNearlyZero(T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool IsZero() const;
        bool IsUnit(T LengthSquaredTolerance = UE_KINDA_SMALL_NUMBER) const;
        bool IsNormalized() const;
        bool Normalize(T Tolerance = UE_SMALL_NUMBER);
        TVector GetUnsafeNormal() const;
        TVector GetUnsafeNormal2D() const;
        TVector GetSafeNormal(T Tolerance = UE_SMALL_NUMBER, const TVector& ResultIfZero = ZeroVector) const;
        TVector GetSafeNormal2D(T Tolerance = UE_SMALL_NUMBER, const TVector& ResultIfZero = ZeroVector) const;
        void ToDirectionAndLength(TVector& OutDir, double& OutLength) const;
        void ToDirectionAndLength(TVector& OutDir, float& OutLength) const;
        TVector GetSignVector() const;
        TVector Projection() const;
        TVector GridSnap(const T& GridSz) const;
        TVector BoundToCube(T Radius) const;
        TVector BoundToBox(const TVector& Min, const TVector& Max) const;
        TVector GetClampedToSize(T Min, T Max) const;
        TVector GetClampedToSize2D(T Min, T Max) const;
        TVector GetClampedToMaxSize(T MaxSize) const;
        TVector GetClampedToMaxSize2D(T MaxSize) const;
        void AddBounded(const TVector& V, T Radius = MAX_int16);
        TVector Reciprocal() const;
        bool IsUniform(T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        TVector MirrorByVector(const TVector& MirrorNormal) const;
        TVector MirrorByPlane(const TPlane<T>& Plane) const;
        TVector RotateAngleAxis(const T AngleDeg, const TVector& Axis) const;
        TVector RotateAngleAxisRad(const T AngleRad, const TVector& Axis) const;
        T CosineAngle2D(TVector B) const;
        TVector ProjectOnTo(const TVector& A) const;
        TVector ProjectOnToNormal(const TVector& Normal) const;
        TRotator<T> ToOrientationRotator() const;
        TQuat<T> ToOrientationQuat() const;
        TRotator<T> Rotation() const;
        void FindBestAxisVectors(TVector& Axis1, TVector& Axis2) const;
        void UnwindEuler();
        bool ContainsNaN() const;
        FString ToString() const;
        FString ToCompactString() const;
        bool InitFromString(const FString& InSourceString);
        TVector2<T> UnitCartesianToSpherical() const;
        T HeadingAngle() const;
        static void CreateOrthonormalBasis(TVector& XAxis, TVector& YAxis, TVector& ZAxis);
        static bool PointsAreSame(const TVector& P, const TVector& Q);
        static bool PointsAreNear(const TVector& Point1, const TVector& Point2, T Dist);
        static T PointPlaneDist(const TVector& Point, const TVector& PlaneBase, const TVector& PlaneNormal);
        static TVector PointPlaneProject(const TVector& Point, const TPlane<T>& Plane);
        static TVector PointPlaneProject(const TVector& Point, const TVector& PlaneBase, const TVector& PlaneNormal);
        static TVector VectorPlaneProject(const TVector& V, const TVector& PlaneNormal);
        static T Dist(const TVector& V1, const TVector& V2);
        static T Distance(const TVector& V1, const TVector& V2);
        static T DistXY(const TVector& V1, const TVector& V2);
        static T Dist2D(const TVector& V1, const TVector& V2);
        static T DistSquared(const TVector& V1, const TVector& V2);
        static T DistSquaredXY(const TVector& V1, const TVector& V2);
        static T DistSquared2D(const TVector& V1, const TVector& V2);
        static T BoxPushOut(const TVector& Normal, const TVector& Size);
        static bool Parallel(const TVector& Normal1, const TVector& Normal2, T ParallelCosineThreshold = UE_THRESH_NORMALS_ARE_PARALLEL);
        static bool Coincident(const TVector& Normal1, const TVector& Normal2, T ParallelCosineThreshold = UE_THRESH_NORMALS_ARE_PARALLEL);
        static bool Orthogonal(const TVector& Normal1, const TVector& Normal2, T OrthogonalCosineThreshold = UE_THRESH_NORMALS_ARE_ORTHOGONAL);
        static bool Coplanar(const TVector& Base1, const TVector& Normal1, const TVector& Base2, const TVector& Normal2, T ParallelCosineThreshold = UE_THRESH_NORMALS_ARE_PARALLEL);
        static T Triple(const TVector& X, const TVector& Y, const TVector& Z);
        static TVector RadiansToDegrees(const TVector& RadVector);
        static TVector DegreesToRadians(const TVector& DegVector);
        static T EvaluateBezier(const TVector* ControlPoints, int32 NumPoints, TArray<TVector>& OutPoints);
        static TVector SlerpVectorToDirection(TVector& V, TVector& Direction, T Alpha);
        static TVector SlerpNormals(TVector& NormalA, TVector& NormalB, T Alpha);
    };
    template <typename T, UESTUB_ARITH(T2)> TVector<T> operator*(T2 Scale, const TVector<T>& V);

    template <typename T>
    struct TVector2
    {
        static_assert(std::is_floating_point_v<T>, "T must be floating point");
        using FReal = T;
        T X;
        T Y;
        static const TVector2 ZeroVector;
        static const TVector2 UnitVector;
        static const TVector2 Unit45Deg;
        static TVector2 Zero() { return TVector2(0, 0); }
        static TVector2 One() { return TVector2(1, 1); }
        static TVector2 UnitX() { return TVector2(1, 0); }
        static TVector2 UnitY() { return TVector2(0, 1); }

        TVector2() = default;
        constexpr TVector2(T InX, T InY) : X(InX), Y(InY) {}
        explicit constexpr TVector2(T InF) : X(InF), Y(InF) {}
        template <typename IntType> TVector2(TIntPoint<IntType> InPos);
        explicit TVector2(EForceInit);
        explicit TVector2(const TVector<T>& V);
        explicit TVector2(const TVector4<T>& V);
        template <typename FArg, std::enable_if_t<!std::is_same_v<T, FArg>, int> = 0>
        explicit TVector2(const TVector2<FArg>& From) : X((T)From.X), Y((T)From.Y) {}

        TVector2 operator+(const TVector2& V) const;
        TVector2 operator-(const TVector2& V) const;
        template <UESTUB_ARITH(FArg)> TVector2 operator*(FArg Scale) const;
        template <UESTUB_ARITH(FArg)> TVector2 operator/(FArg Scale) const;
        template <UESTUB_ARITH(FArg)> TVector2 operator+(FArg A) const;
        template <UESTUB_ARITH(FArg)> TVector2 operator-(FArg A) const;
        TVector2 operator*(const TVector2& V) const;
        TVector2 operator/(const TVector2& V) const;
        T operator|(const TVector2& V) const;
        T operator^(const TVector2& V) const;
        T Dot(const TVector2& V) const;
        T Cross(const TVector2& V) const;
        static T DotProduct(const TVector2& A, const TVector2& B);
        static T CrossProduct(const TVector2& A, const TVector2& B);
        static T DistSquared(const TVector2& V1, const TVector2& V2);
        static T Distance(const TVector2& V1, const TVector2& V2);
        static TVector2 Max(const TVector2& A, const TVector2& B);
        static TVector2 Min(const TVector2& A, const TVector2& B);
        static TVector2 Clamp(const TVector2& V, const TVector2& MinValue, const TVector2& MaxValue);
        bool operator==(const TVector2& V) const;
        bool operator!=(const TVector2& V) const;
        bool operator<(const TVector2& Other) const;
        bool operator>(const TVector2& Other) const;
        bool operator<=(const TVector2& Other) const;
        bool operator>=(const TVector2& Other) const;
        TVector2 operator-() const;
        TVector2 operator+=(const TVector2& V);
        TVector2 operator-=(const TVector2& V);
        template <UESTUB_ARITH(FArg)> TVector2 operator*=(FArg Scale);
        template <UESTUB_ARITH(FArg)> TVector2 operator/=(FArg V);
        TVector2 operator*=(const TVector2& V);
        TVector2 operator/=(const TVector2& V);
        T& operator[](int32 Index);
        T operator[](int32 Index) const;
        T& Component(int32 Index);
        T Component(int32 Index) const;
        bool ComponentwiseAllLessThan(const TVector2& Other) const;
        bool ComponentwiseAllGreaterThan(const TVector2& Other) const;
        bool Equals(const TVector2& V, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        void Set(T InX, T InY);
        T GetMax() const;
        T GetAbsMax() const;
        T GetMin() const;
        T Size() const;
        T Length() const;
        T SizeSquared() const;
        T SquaredLength() const;
        TVector2 GetRotated(T AngleDeg) const;
        TVector2 GetSafeNormal(T Tolerance = UE_SMALL_NUMBER) const;
        void Normalize(T Tolerance = UE_SMALL_NUMBER);
        bool IsNearlyZero(T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        void ToDirectionAndLength(TVector2& OutDir, double& OutLength) const;
        void ToDirectionAndLength(TVector2& OutDir, float& OutLength) const;
        bool IsZero() const;
        FIntPoint IntPoint() const;
        FIntPoint IntPoint(EForceInit) const;
        TVector2 RoundToVector() const;
        TVector2 ClampAxes(T MinAxisVal, T MaxAxisVal) const;
        TVector2 GetClampedToSize(T Min, T Max) const;
        TVector2 GetClampedToMaxSize(T MaxSize) const;
        TVector2 GetSignVector() const;
        TVector2 GetAbs() const;
        FString ToString() const;
        bool InitFromString(const FString& InSourceString);
        bool ContainsNaN() const;
        TVector<T> SphericalToUnitCartesian() const;
    };
    template <typename T, UESTUB_ARITH(T2)> TVector2<T> operator*(T2 Scale, const TVector2<T>& V);

    template <typename T>
    struct TVector4
    {
        T X;
        T Y;
        T Z;
        T W;
        TVector4() = default;
        TVector4(T InX, T InY, T InZ, T InW = 1) : X(InX), Y(InY), Z(InZ), W(InW) {}
        TVector4(const TVector<T>& InVector, T InW = 1);
        TVector4(const FLinearColor& InColor);
        TVector4(const FLinearColor& InColor, T InOverrideW);
        TVector4(TVector2<T> InXY, TVector2<T> InZW);
        explicit TVector4(EForceInit);
        template <typename FArg, std::enable_if_t<!std::is_same_v<T, FArg>, int> = 0> explicit TVector4(const TVector4<FArg>& From);
        T& operator[](int32 ComponentIndex);
        T operator[](int32 ComponentIndex) const;
        TVector4 operator-() const;
        TVector4 operator+(const TVector4& V) const;
        TVector4 operator+=(const TVector4& V);
        TVector4 operator-(const TVector4& V) const;
        TVector4 operator-=(const TVector4& V);
        template <UESTUB_ARITH(FArg)> TVector4 operator*(FArg Scale) const;
        template <UESTUB_ARITH(FArg)> TVector4 operator/(FArg Scale) const;
        TVector4 operator*(const TVector4& V) const;
        TVector4 operator/(const TVector4& V) const;
        bool operator==(const TVector4& V) const;
        bool operator!=(const TVector4& V) const;
        TVector4 operator^(const TVector4& V) const;
        T& Component(int32 Index);
        bool Equals(const TVector4& V, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool IsUnit3(T LengthSquaredTolerance = UE_KINDA_SMALL_NUMBER) const;
        FString ToString() const;
        TVector4 GetSafeNormal(T Tolerance = UE_SMALL_NUMBER) const;
        TVector4 GetUnsafeNormal3() const;
        TRotator<T> ToOrientationRotator() const;
        TQuat<T> ToOrientationQuat() const;
        TRotator<T> Rotation() const;
        void Set(T InX, T InY, T InZ, T InW);
        T Size3() const;
        T SizeSquared3() const;
        T Size() const;
        T SizeSquared() const;
        bool ContainsNaN() const;
        bool IsNearlyZero3(T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        TVector4 Reflect3(const TVector4& Normal) const;
    };

    template <typename T>
    struct TRotator
    {
        static_assert(std::is_floating_point_v<T>, "T must be floating point");
        using FReal = T;
        T Pitch;
        T Yaw;
        T Roll;
        static const TRotator ZeroRotator;
        TRotator() = default;
        explicit constexpr TRotator(T InF) : Pitch(InF), Yaw(InF), Roll(InF) {}
        constexpr TRotator(T InPitch, T InYaw, T InRoll) : Pitch(InPitch), Yaw(InYaw), Roll(InRoll) {}
        explicit TRotator(EForceInit);
        explicit TRotator(const TQuat<T>& Quat);
        template <typename FArg, std::enable_if_t<!std::is_same_v<T, FArg>, int> = 0>
        explicit TRotator(const TRotator<FArg>& From) : Pitch((T)From.Pitch), Yaw((T)From.Yaw), Roll((T)From.Roll) {}
        TRotator operator+(const TRotator& R) const;
        TRotator operator-(const TRotator& R) const;
        template <UESTUB_ARITH(FArg)> TRotator operator*(FArg Scale) const;
        template <UESTUB_ARITH(FArg)> TRotator operator*=(FArg Scale);
        bool operator==(const TRotator& R) const;
        bool operator!=(const TRotator& V) const;
        TRotator operator+=(const TRotator& R);
        TRotator operator-=(const TRotator& R);
        TRotator operator-() const;
        bool IsNearlyZero(T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool IsZero() const;
        bool Equals(const TRotator& R, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        TRotator Add(T DeltaPitch, T DeltaYaw, T DeltaRoll);
        TRotator GetInverse() const;
        TRotator GridSnap(const TRotator& RotGrid) const;
        TVector<T> Vector() const;
        TQuat<T> Quaternion() const;
        TVector<T> Euler() const;
        TVector<T> RotateVector(const TVector<T>& V) const;
        TVector<T> UnrotateVector(const TVector<T>& V) const;
        TRotator Clamp() const;
        TRotator GetNormalized() const;
        TRotator GetDenormalized() const;
        T GetComponentForAxis(EAxis::Type Axis) const;
        void SetComponentForAxis(EAxis::Type Axis, T Component);
        void Normalize();
        void GetWindingAndRemainder(TRotator& Winding, TRotator& Remainder) const;
        T GetManhattanDistance(const TRotator& Rotator) const;
        TRotator GetEquivalentRotator() const;
        void SetClosestToMe(TRotator& MakeClosest) const;
        FString ToString() const;
        FString ToCompactString() const;
        bool InitFromString(const FString& InSourceString);
        bool ContainsNaN() const;
        static T ClampAxis(T Angle);
        static T NormalizeAxis(T Angle);
        static uint8 CompressAxisToByte(T Angle);
        static T DecompressAxisFromByte(uint8 Angle);
        static uint16 CompressAxisToShort(T Angle);
        static T DecompressAxisFromShort(uint16 Angle);
        static TRotator MakeFromEuler(const TVector<T>& Euler);
    };
    template <typename T, UESTUB_ARITH(FArg)> TRotator<T> operator*(FArg Scale, const TRotator<T>& R);

    template <typename T>
    struct alignas(16) TQuat
    {
        static_assert(std::is_floating_point_v<T>, "T must be floating point");
        using FReal = T;
        T X;
        T Y;
        T Z;
        T W;
        static const TQuat Identity;
        TQuat() = default;
        explicit TQuat(EForceInit);
        constexpr TQuat(T InX, T InY, T InZ, T InW) : X(InX), Y(InY), Z(InZ), W(InW) {}
        explicit TQuat(const TRotator<T>& R);
        explicit TQuat(const TMatrix<T>& M);
        TQuat(TVector<T> Axis, T AngleRad);
        template <typename FArg, std::enable_if_t<!std::is_same_v<T, FArg>, int> = 0> explicit TQuat(const TQuat<FArg>& From);
        TQuat operator+(const TQuat& Q) const;
        TQuat operator+=(const TQuat& Q);
        TQuat operator-(const TQuat& Q) const;
        TQuat operator-() const;
        TQuat operator-=(const TQuat& Q);
        TQuat operator*(const TQuat& Q) const;
        TQuat operator*=(const TQuat& Q);
        TVector<T> operator*(const TVector<T>& V) const;
        TMatrix<T> operator*(const TMatrix<T>& M) const;
        template <UESTUB_ARITH(FArg)> TQuat operator*=(const FArg Scale);
        template <UESTUB_ARITH(FArg)> TQuat operator*(const FArg Scale) const;
        template <UESTUB_ARITH(FArg)> TQuat operator/=(const FArg Scale);
        template <UESTUB_ARITH(FArg)> TQuat operator/(const FArg Scale) const;
        bool Identical(const TQuat* Q, const uint32 PortFlags) const;
        bool operator==(const TQuat& Q) const;
        bool operator!=(const TQuat& Q) const;
        T operator|(const TQuat& Q) const;
        static TQuat MakeFromEuler(const TVector<T>& Euler);
        static TQuat MakeFromRotator(const TRotator<T>& R);
        static TQuat MakeFromVectors(const TVector<T>& Vector1, const TVector<T>& Vector2);
        TVector<T> Euler() const;
        void Normalize(T Tolerance = UE_SMALL_NUMBER);
        TQuat GetNormalized(T Tolerance = UE_SMALL_NUMBER) const;
        bool IsNormalized() const;
        T Size() const;
        T SizeSquared() const;
        T GetAngle() const;
        void ToAxisAndAngle(TVector<T>& Axis, float& Angle) const;
        void ToAxisAndAngle(TVector<T>& Axis, double& Angle) const;
        TVector<T> ToRotationVector() const;
        static TQuat MakeFromRotationVector(const TVector<T>& RotationVector);
        void ToSwingTwist(const TVector<T>& InTwistAxis, TQuat& OutSwing, TQuat& OutTwist) const;
        T GetTwistAngle(const TVector<T>& TwistAxis) const;
        TVector<T> RotateVector(TVector<T> V) const;
        TVector<T> UnrotateVector(TVector<T> V) const;
        TQuat Log() const;
        TQuat Exp() const;
        TQuat Inverse() const;
        void EnforceShortestArcWith(const TQuat& OtherQuat);
        TVector<T> GetAxisX() const;
        TVector<T> GetAxisY() const;
        TVector<T> GetAxisZ() const;
        TVector<T> GetForwardVector() const;
        TVector<T> GetRightVector() const;
        TVector<T> GetUpVector() const;
        TVector<T> Vector() const;
        TRotator<T> Rotator() const;
        TMatrix<T> ToMatrix() const;
        TVector<T> GetRotationAxis() const;
        T AngularDistance(const TQuat& Q) const;
        bool Equals(const TQuat& Q, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool IsIdentity(T Tolerance = UE_SMALL_NUMBER) const;
        bool ContainsNaN() const;
        FString ToString() const;
        bool InitFromString(const FString& InSourceString);
        static TQuat FindBetween(const TVector<T>& Vector1, const TVector<T>& Vector2);
        static TQuat FindBetweenNormals(const TVector<T>& Normal1, const TVector<T>& Normal2);
        static TQuat FindBetweenVectors(const TVector<T>& Vector1, const TVector<T>& Vector2);
        static T Error(const TQuat& Q1, const TQuat& Q2);
        static T ErrorAutoNormalize(const TQuat& A, const TQuat& B);
        static TQuat FastLerp(const TQuat& A, const TQuat& B, const T Alpha);
        static TQuat FastBilerp(const TQuat& P00, const TQuat& P10, const TQuat& P01, const TQuat& P11, T FracX, T FracY);
        static TQuat Slerp_NotNormalized(const TQuat& Quat1, const TQuat& Quat2, T Slerp);
        static TQuat Slerp(const TQuat& Quat1, const TQuat& Quat2, T Slerp);
        static TQuat SlerpFullPath_NotNormalized(const TQuat& quat1, const TQuat& quat2, T Alpha);
        static TQuat SlerpFullPath(const TQuat& quat1, const TQuat& quat2, T Alpha);
        static TQuat Squad(const TQuat& quat1, const TQuat& tang1, const TQuat& quat2, const TQuat& tang2, T Alpha);
    };

    template <typename T>
    struct TPlane : public TVector<T>
    {
        T W;
        TPlane() = default;
        TPlane(const TVector4<T>& V);
        TPlane(T InX, T InY, T InZ, T InW);
        TPlane(TVector<T> InNormal, T InW);
        TPlane(TVector<T> InBase, const TVector<T>& InNormal);
        TPlane(TVector<T> A, TVector<T> B, TVector<T> C);
        explicit TPlane(EForceInit);
        bool IsValid() const;
        TVector<T> GetOrigin() const;
        const TVector<T>& GetNormal() const;
        T PlaneDot(const TVector<T>& P) const;
        bool Normalize(T Tolerance = UE_SMALL_NUMBER);
        TPlane Flip() const;
        TPlane TransformBy(const TMatrix<T>& M) const;
        bool Equals(const TPlane& V, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
    };

    template <typename T>
    struct alignas(16) TMatrix
    {
        alignas(16) T M[4][4];
        static const TMatrix Identity;
        TMatrix() = default;
        explicit TMatrix(EForceInit);
        TMatrix(const TPlane<T>& InX, const TPlane<T>& InY, const TPlane<T>& InZ, const TPlane<T>& InW);
        TMatrix(const TVector<T>& InX, const TVector<T>& InY, const TVector<T>& InZ, const TVector<T>& InW);
        void SetIdentity();
        TMatrix operator*(const TMatrix& Other) const;
        void operator*=(const TMatrix& Other);
        TMatrix operator+(const TMatrix& Other) const;
        void operator+=(const TMatrix& Other);
        TMatrix operator*(T Other) const;
        void operator*=(T Other);
        bool operator==(const TMatrix& Other) const;
        bool Equals(const TMatrix& Other, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool operator!=(const TMatrix& Other) const;
        TVector4<T> TransformFVector4(const TVector4<T>& V) const;
        TVector4<T> TransformPosition(const TVector<T>& V) const;
        TVector<T> InverseTransformPosition(const TVector<T>& V) const;
        TVector4<T> TransformVector(const TVector<T>& V) const;
        TVector<T> InverseTransformVector(const TVector<T>& V) const;
        TMatrix GetTransposed() const;
        T Determinant() const;
        T RotDeterminant() const;
        TMatrix InverseFast() const;
        TMatrix Inverse() const;
        TMatrix TransposeAdjoint() const;
        void RemoveScaling(T Tolerance = UE_SMALL_NUMBER);
        TMatrix GetMatrixWithoutScale(T Tolerance = UE_SMALL_NUMBER) const;
        TVector<T> ExtractScaling(T Tolerance = UE_SMALL_NUMBER);
        TVector<T> GetScaleVector(T Tolerance = UE_SMALL_NUMBER) const;
        TMatrix RemoveTranslation() const;
        TMatrix ConcatTranslation(const TVector<T>& Translation) const;
        bool ContainsNaN() const;
        void ScaleTranslation(const TVector<T>& Scale3D);
        T GetMinimumAxisScale() const;
        T GetMaximumAxisScale() const;
        TMatrix ApplyScale(T Scale) const;
        TVector<T> GetOrigin() const;
        TVector<T> GetScaledAxis(EAxis::Type Axis) const;
        void GetScaledAxes(TVector<T>& X, TVector<T>& Y, TVector<T>& Z) const;
        TVector<T> GetUnitAxis(EAxis::Type Axis) const;
        void GetUnitAxes(TVector<T>& X, TVector<T>& Y, TVector<T>& Z) const;
        void SetAxis(int32 i, const TVector<T>& Axis);
        void SetOrigin(const TVector<T>& NewOrigin);
        void SetAxes(const TVector<T>* Axis0 = nullptr, const TVector<T>* Axis1 = nullptr, const TVector<T>* Axis2 = nullptr, const TVector<T>* Origin = nullptr);
        TVector<T> GetColumn(int32 i) const;
        void SetColumn(int32 i, TVector<T> Value);
        TRotator<T> Rotator() const;
        TQuat<T> ToQuat() const;
        bool GetFrustumNearPlane(TPlane<T>& OutPlane) const;
        void Mirror(EAxis::Type MirrorAxis, EAxis::Type FlipAxis);
        FString ToString() const;
    };

    template <typename T>
    struct alignas(16) TTransform
    {
        using FReal = T;
        static const TTransform Identity;
        TTransform();
        explicit TTransform(const TVector<T>& InTranslation);
        explicit TTransform(const TQuat<T>& InRotation);
        explicit TTransform(const TRotator<T>& InRotation);
        TTransform(const TQuat<T>& InRotation, const TVector<T>& InTranslation, const TVector<T>& InScale3D = TVector<T>::OneVector);
        TTransform(const TRotator<T>& InRotation, const TVector<T>& InTranslation, const TVector<T>& InScale3D = TVector<T>::OneVector);
        explicit TTransform(const TMatrix<T>& InMatrix);
        TTransform(const TVector<T>& InX, const TVector<T>& InY, const TVector<T>& InZ, const TVector<T>& InTranslation);
        explicit TTransform(ENoInit);
        template <typename FArg, std::enable_if_t<!std::is_same_v<T, FArg>, int> = 0> explicit TTransform(const TTransform<FArg>& From);
        FString ToHumanReadableString() const;
        FString ToString() const;
        bool InitFromString(const FString& InSourceString);
        TMatrix<T> ToMatrixWithScale() const;
        TMatrix<T> ToInverseMatrixWithScale() const;
        TTransform Inverse() const;
        TMatrix<T> ToMatrixNoScale() const;
        void Blend(const TTransform& Atom1, const TTransform& Atom2, float Alpha);
        void BlendWith(const TTransform& OtherAtom, float Alpha);
        TTransform operator+(const TTransform& Atom) const;
        TTransform& operator+=(const TTransform& Atom);
        TTransform operator*(T Mult) const;
        TTransform& operator*=(T Mult);
        TTransform operator*(const TTransform& Other) const;
        void operator*=(const TTransform& Other);
        TTransform operator*(const TQuat<T>& Other) const;
        void operator*=(const TQuat<T>& Other);
        void ScaleTranslation(const TVector<T>& InScale3D);
        void ScaleTranslation(const T& Scale);
        void RemoveScaling(T Tolerance = UE_SMALL_NUMBER);
        T GetMaximumAxisScale() const;
        T GetMinimumAxisScale() const;
        TTransform GetRelativeTransform(const TTransform& Other) const;
        TTransform GetRelativeTransformReverse(const TTransform& Other) const;
        void SetToRelativeTransform(const TTransform& ParentTransform);
        TVector4<T> TransformFVector4(const TVector4<T>& V) const;
        TVector4<T> TransformFVector4NoScale(const TVector4<T>& V) const;
        TVector<T> TransformPosition(const TVector<T>& V) const;
        TVector<T> TransformPositionNoScale(const TVector<T>& V) const;
        TVector<T> InverseTransformPosition(const TVector<T>& V) const;
        TVector<T> InverseTransformPositionNoScale(const TVector<T>& V) const;
        TVector<T> TransformVector(const TVector<T>& V) const;
        TVector<T> TransformVectorNoScale(const TVector<T>& V) const;
        TVector<T> InverseTransformVector(const TVector<T>& V) const;
        TVector<T> InverseTransformVectorNoScale(const TVector<T>& V) const;
        TQuat<T> TransformRotation(const TQuat<T>& Q) const;
        TQuat<T> InverseTransformRotation(const TQuat<T>& Q) const;
        TTransform GetScaled(T Scale) const;
        TTransform GetScaled(TVector<T> Scale) const;
        TVector<T> GetScaledAxis(EAxis::Type InAxis) const;
        TVector<T> GetUnitAxis(EAxis::Type InAxis) const;
        void Mirror(EAxis::Type MirrorAxis, EAxis::Type FlipAxis);
        TVector<T> GetLocation() const;
        TRotator<T> Rotator() const;
        T GetDeterminant() const;
        void SetLocation(const TVector<T>& Origin);
        bool ContainsNaN() const;
        bool IsValid() const;
        bool RotationEquals(const TTransform& Other, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool TranslationEquals(const TTransform& Other, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool Scale3DEquals(const TTransform& Other, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool Equals(const TTransform& Other, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool Identical(const TTransform* Other, uint32 PortFlags) const;
        bool EqualsNoScale(const TTransform& Other, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        static void Multiply(TTransform* OutTransform, const TTransform* A, const TTransform* B);
        void SetComponents(const TQuat<T>& InRotation, const TVector<T>& InTranslation, const TVector<T>& InScale3D);
        void SetIdentity();
        void SetIdentityZeroScale();
        void MultiplyScale3D(const TVector<T>& Scale3DMultiplier);
        void SetTranslation(const TVector<T>& NewTranslation);
        void CopyTranslation(const TTransform& Other);
        void ConcatenateRotation(const TQuat<T>& DeltaRotation);
        void AddToTranslation(const TVector<T>& DeltaTranslation);
        static TVector<T> AddTranslations(const TTransform& A, const TTransform& B);
        static TVector<T> SubtractTranslations(const TTransform& A, const TTransform& B);
        void SetRotation(const TQuat<T>& NewRotation);
        void CopyRotation(const TTransform& Other);
        void SetScale3D(const TVector<T>& NewScale3D);
        void CopyScale3D(const TTransform& Other);
        void SetTranslationAndScale3D(const TVector<T>& NewTranslation, const TVector<T>& NewScale3D);
        void NormalizeRotation();
        bool IsRotationNormalized() const;
        TQuat<T> GetRotation() const;
        TVector<T> GetTranslation() const;
        TVector<T> GetScale3D() const;
        void CopyRotationPart(const TTransform& SrcBA);
        void CopyTranslationAndScale3D(const TTransform& SrcBA);
        void SetFromMatrix(const TMatrix<T>& InMatrix);
        void Accumulate(const TTransform& SourceAtom);
        static bool AnyHasNegativeScale(const TVector<T>& InScale3D, const TVector<T>& InOtherScale3D);
        static TVector<T> GetSafeScaleReciprocal(const TVector<T>& InScale, T Tolerance = UE_SMALL_NUMBER);
    private:
        TQuat<T> Rotation;
        TVector<T> Translation;
        TVector<T> Scale3D;
    };

    template <typename T>
    struct TBox
    {
        TVector<T> Min;
        TVector<T> Max;
        uint8 IsValid;
        TBox() = default;
        explicit TBox(EForceInit);
        TBox(const TVector<T>& InMin, const TVector<T>& InMax);
        TBox(const TVector<T>* Points, int32 Count);
        explicit TBox(const TArray<TVector<T>>& Points);
        bool operator==(const TBox& Other) const;
        bool operator!=(const TBox& Other) const;
        bool Equals(const TBox& Other, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        TBox& operator+=(const TVector<T>& Other);
        TBox operator+(const TVector<T>& Other) const;
        TBox& operator+=(const TBox& Other);
        TBox operator+(const TBox& Other) const;
        TVector<T>& operator[](int32 Index);
        T ComputeSquaredDistanceToPoint(const TVector<T>& Point) const;
        T ComputeSquaredDistanceToBox(const TBox& Box) const;
        TBox ExpandBy(T W) const;
        TBox ExpandBy(const TVector<T>& V) const;
        TBox ExpandBy(const TVector<T>& Neg, const TVector<T>& Pos) const;
        TBox ShiftBy(const TVector<T>& Offset) const;
        TBox MoveTo(const TVector<T>& Destination) const;
        TVector<T> GetCenter() const;
        void GetCenterAndExtents(TVector<T>& Center, TVector<T>& Extents) const;
        TVector<T> GetClosestPointTo(const TVector<T>& Point) const;
        TVector<T> GetExtent() const;
        TVector<T> GetSize() const;
        T GetVolume() const;
        bool Intersect(const TBox& Other) const;
        bool IntersectXY(const TBox& Other) const;
        TBox Overlap(const TBox& Other) const;
        TBox InverseTransformBy(const TTransform<T>& M) const;
        bool IsInside(const TVector<T>& In) const;
        bool IsInsideOrOn(const TVector<T>& In) const;
        bool IsInside(const TBox& Other) const;
        bool IsInsideXY(const TVector<T>& In) const;
        bool IsInsideXY(const TBox& Other) const;
        TBox TransformBy(const TMatrix<T>& M) const;
        TBox TransformBy(const TTransform<T>& M) const;
        TBox TransformProjectBy(const TMatrix<T>& ProjM) const;
        FString ToString() const;
        static TBox BuildAABB(const TVector<T>& Origin, const TVector<T>& Extent);
    };

    template <typename T>
    struct TBox2
    {
        TVector2<T> Min;
        TVector2<T> Max;
        bool bIsValid;
        TBox2() = default;
        explicit TBox2(EForceInit);
        TBox2(const TVector2<T>& InMin, const TVector2<T>& InMax);
        TBox2& operator+=(const TVector2<T>& Other);
        TBox2 operator+(const TVector2<T>& Other) const;
        TVector2<T> GetCenter() const;
        TVector2<T> GetExtent() const;
        TVector2<T> GetSize() const;
        T GetArea() const;
        bool Intersect(const TBox2& Other) const;
        bool IsInside(const TVector2<T>& TestPoint) const;
        TBox2 ExpandBy(const T W) const;
        TBox2 ShiftBy(const TVector2<T>& Offset) const;
        TVector2<T> GetClosestPointTo(const TVector2<T>& Point) const;
    };

    template <typename T>
    struct TSphere
    {
        TVector<T> Center;
        T W;
        TSphere() = default;
        explicit TSphere(EForceInit);
        TSphere(TVector<T> InV, T InW);
        bool IsInside(const TSphere& Other, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool IsInside(const TVector<T>& In, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        bool Intersects(const TSphere& Other, T Tolerance = UE_KINDA_SMALL_NUMBER) const;
        TSphere TransformBy(const TMatrix<T>& M) const;
        T GetVolume() const;
    };

    template <typename T, typename TExtent>
    struct TBoxSphereBounds
    {
        TVector<T> Origin;
        TVector<TExtent> BoxExtent;
        TExtent SphereRadius;
        TBoxSphereBounds() = default;
        explicit TBoxSphereBounds(EForceInit);
        TBoxSphereBounds(const TVector<T>& InOrigin, const TVector<TExtent>& InBoxExtent, TExtent InSphereRadius);
        explicit TBoxSphereBounds(const TBox<T>& Box);
        TBoxSphereBounds(const TBox<T>& Box, const TSphere<T>& Sphere);
        explicit TBoxSphereBounds(const TSphere<T>& Sphere);
        TBoxSphereBounds operator+(const TBoxSphereBounds& Other) const;
        bool operator==(const TBoxSphereBounds& Other) const;
        TBox<T> GetBox() const;
        TVector<T> GetBoxExtrema(uint32 Extrema) const;
        TSphere<T> GetSphere() const;
        TBoxSphereBounds ExpandBy(T ExpandAmount) const;
        TBoxSphereBounds TransformBy(const TMatrix<T>& M) const;
        TBoxSphereBounds TransformBy(const TTransform<T>& M) const;
        T ComputeSquaredDistanceFromBoxToPoint(const TVector<T>& Point) const;
        FString ToString() const;
    };

    template <typename T>
    struct TRay
    {
        TVector<T> Origin;
        TVector<T> Direction;
        TRay() = default;
        TRay(const TVector<T>& Origin, const TVector<T>& Direction, bool bDirectionIsNormalized = false);
        TVector<T> PointAt(T RayParameter) const;
        T GetParameter(const TVector<T>& Point) const;
        T DistSquared(const TVector<T>& Point) const;
        TVector<T> ClosestPoint(const TVector<T>& Point) const;
    };

    template <typename T> struct TRotationMatrix : public TMatrix<T>
    {
        explicit TRotationMatrix(const TRotator<T>& Rot);
        static TMatrix<T> Make(TRotator<T> const& Rot);
        static TMatrix<T> Make(TQuat<T> const& Rot);
        static TMatrix<T> MakeFromX(TVector<T> const& XAxis);
        static TMatrix<T> MakeFromY(TVector<T> const& YAxis);
        static TMatrix<T> MakeFromZ(TVector<T> const& ZAxis);
        static TMatrix<T> MakeFromXY(TVector<T> const& XAxis, TVector<T> const& YAxis);
        static TMatrix<T> MakeFromXZ(TVector<T> const& XAxis, TVector<T> const& ZAxis);
        static TMatrix<T> MakeFromYX(TVector<T> const& YAxis, TVector<T> const& XAxis);
        static TMatrix<T> MakeFromYZ(TVector<T> const& YAxis, TVector<T> const& ZAxis);
        static TMatrix<T> MakeFromZX(TVector<T> const& ZAxis, TVector<T> const& XAxis);
        static TMatrix<T> MakeFromZY(TVector<T> const& ZAxis, TVector<T> const& YAxis);
    };
    template <typename T> struct TRotationTranslationMatrix : public TMatrix<T> { TRotationTranslationMatrix(const TRotator<T>& Rot, const TVector<T>& Origin); static TMatrix<T> Make(const TRotator<T>& Rot, const TVector<T>& Origin); };
    template <typename T> struct TQuatRotationMatrix : public TMatrix<T> { explicit TQuatRotationMatrix(const TQuat<T>& Q); static TMatrix<T> Make(const TQuat<T>& Q); };
    template <typename T> struct TQuatRotationTranslationMatrix : public TMatrix<T> { TQuatRotationTranslationMatrix(const TQuat<T>& Q, const TVector<T>& Origin); static TMatrix<T> Make(const TQuat<T>& Q, const TVector<T>& Origin); };
    template <typename T> struct TScaleMatrix : public TMatrix<T> { explicit TScaleMatrix(T Scale); explicit TScaleMatrix(const TVector<T>& Scale); static TMatrix<T> Make(T Scale); static TMatrix<T> Make(const TVector<T>& Scale); };
    template <typename T> struct TTranslationMatrix : public TMatrix<T> { explicit TTranslationMatrix(const TVector<T>& Delta); static TMatrix<T> Make(TVector<T> const& Delta); };
    template <typename T> struct TScaleRotationTranslationMatrix : public TMatrix<T> { TScaleRotationTranslationMatrix(const TVector<T>& Scale, const TRotator<T>& Rot, const TVector<T>& Origin); };
    template <typename T> struct TInverseRotationMatrix : public TMatrix<T> { explicit TInverseRotationMatrix(const TRotator<T>& Rot); };
    template <typename T> struct TRotationAboutPointMatrix : public TRotationTranslationMatrix<T> { TRotationAboutPointMatrix(const TRotator<T>& Rot, const TVector<T>& Origin); static TMatrix<T> Make(const TRotator<T>& Rot, const TVector<T>& Origin); static TMatrix<T> Make(const TQuat<T>& Rot, const TVector<T>& Origin); };
    template <typename T> struct TLookAtMatrix : public TMatrix<T> { TLookAtMatrix(const TVector<T>& EyePosition, const TVector<T>& LookAtPosition, const TVector<T>& UpVector); };
    template <typename T> struct TLookFromMatrix : public TMatrix<T> { TLookFromMatrix(const TVector<T>& EyePosition, const TVector<T>& LookDirection, const TVector<T>& UpVector); };
}

using FVector = UE::Math::TVector<double>;
using FVector3d = UE::Math::TVector<double>;
using FVector3f = UE::Math::TVector<float>;
using FVector2D = UE::Math::TVector2<double>;
using FVector2d = UE::Math::TVector2<double>;
using FVector2f = UE::Math::TVector2<float>;
using FVector4 = UE::Math::TVector4<double>;
using FVector4d = UE::Math::TVector4<double>;
using FVector4f = UE::Math::TVector4<float>;
using FRotator = UE::Math::TRotator<double>;
using FRotator3d = UE::Math::TRotator<double>;
using FRotator3f = UE::Math::TRotator<float>;
using FQuat = UE::Math::TQuat<double>;
using FQuat4d = UE::Math::TQuat<double>;
using FQuat4f = UE::Math::TQuat<float>;
using FMatrix = UE::Math::TMatrix<double>;
using FMatrix44d = UE::Math::TMatrix<double>;
using FMatrix44f = UE::Math::TMatrix<float>;
using FTransform = UE::Math::TTransform<double>;
using FTransform3d = UE::Math::TTransform<double>;
using FTransform3f = UE::Math::TTransform<float>;
using FPlane = UE::Math::TPlane<double>;
using FPlane4f = UE::Math::TPlane<float>;
using FBox = UE::Math::TBox<double>;
using FBox3d = UE::Math::TBox<double>;
using FBox3f = UE::Math::TBox<float>;
using FBox2D = UE::Math::TBox2<double>;
using FBox2f = UE::Math::TBox2<float>;
using FSphere = UE::Math::TSphere<double>;
using FBoxSphereBounds = UE::Math::TBoxSphereBounds<double, double>;
using FBoxSphereBounds3f = UE::Math::TBoxSphereBounds<float, float>;
using FRay = UE::Math::TRay<double>;
using FRotationMatrix = UE::Math::TRotationMatrix<double>;
using FRotationTranslationMatrix = UE::Math::TRotationTranslationMatrix<double>;
using FQuatRotationMatrix = UE::Math::TQuatRotationMatrix<double>;
using FQuatRotationTranslationMatrix = UE::Math::TQuatRotationTranslationMatrix<double>;
using FScaleMatrix = UE::Math::TScaleMatrix<double>;
using FTranslationMatrix = UE::Math::TTranslationMatrix<double>;
using FScaleRotationTranslationMatrix = UE::Math::TScaleRotationTranslationMatrix<double>;
using FInverseRotationMatrix = UE::Math::TInverseRotationMatrix<double>;
using FRotationAboutPointMatrix = UE::Math::TRotationAboutPointMatrix<double>;
using FLookAtMatrix = UE::Math::TLookAtMatrix<double>;
using FLookFromMatrix = UE::Math::TLookFromMatrix<double>;

template <typename T> uint32 GetTypeHash(const UE::Math::TVector<T>& Vector);
template <typename T> uint32 GetTypeHash(const UE::Math::TVector2<T>& Vector);
template <typename T> uint32 GetTypeHash(const UE::Math::TRotator<T>& Rotator);
template <typename T> uint32 GetTypeHash(const UE::Math::TQuat<T>& Quat);
template <typename T> uint32 GetTypeHash(const UE::Math::TTransform<T>& Transform);
template <typename T> uint32 GetTypeHash(const UE::Math::TBox<T>& Box);

// ---------------------------------------------------------------- integer points/vectors
template <typename InIntType>
struct TIntPoint
{
    using IntType = InIntType;
    IntType X;
    IntType Y;
    static const TIntPoint ZeroValue;
    static const TIntPoint NoneValue;
    TIntPoint() = default;
    TIntPoint(IntType InX, IntType InY) : X(InX), Y(InY) {}
    explicit TIntPoint(IntType InXY) : X(InXY), Y(InXY) {}
    explicit TIntPoint(EForceInit);
    template <typename OtherIntType> explicit TIntPoint(TIntPoint<OtherIntType> Other);
    IntType& operator[](IntType Index);
    IntType operator[](IntType Index) const;
    bool operator==(const TIntPoint& Other) const;
    bool operator!=(const TIntPoint& Other) const;
    TIntPoint& operator*=(IntType Scale);
    TIntPoint& operator/=(IntType Divisor);
    TIntPoint& operator+=(const TIntPoint& Other);
    TIntPoint& operator-=(const TIntPoint& Other);
    TIntPoint operator*(IntType Scale) const;
    TIntPoint operator/(IntType Divisor) const;
    TIntPoint operator+(const TIntPoint& Other) const;
    TIntPoint operator-(const TIntPoint& Other) const;
    TIntPoint operator*(const TIntPoint& Other) const;
    TIntPoint operator/(const TIntPoint& Other) const;
    TIntPoint ComponentMin(const TIntPoint& Other) const;
    TIntPoint ComponentMax(const TIntPoint& Other) const;
    IntType GetMax() const;
    IntType GetMin() const;
    IntType Size() const;
    IntType SizeSquared() const;
    FString ToString() const;
    static TIntPoint DivideAndRoundUp(TIntPoint Lhs, IntType Divisor);
};
template <typename InIntType>
struct TIntVector3
{
    using IntType = InIntType;
    IntType X;
    IntType Y;
    IntType Z;
    static const TIntVector3 ZeroValue;
    static const TIntVector3 NoneValue;
    TIntVector3() = default;
    TIntVector3(IntType InX, IntType InY, IntType InZ) : X(InX), Y(InY), Z(InZ) {}
    explicit TIntVector3(IntType InValue) : X(InValue), Y(InValue), Z(InValue) {}
    explicit TIntVector3(FVector InVector);
    explicit TIntVector3(EForceInit);
    const IntType& operator()(int32 ComponentIndex) const;
    IntType& operator()(int32 ComponentIndex);
    const IntType& operator[](int32 ComponentIndex) const;
    IntType& operator[](int32 ComponentIndex);
    bool operator==(const TIntVector3& Other) const;
    bool operator!=(const TIntVector3& Other) const;
    TIntVector3& operator*=(IntType Scale);
    TIntVector3& operator/=(IntType Divisor);
    TIntVector3& operator+=(const TIntVector3& Other);
    TIntVector3& operator-=(const TIntVector3& Other);
    TIntVector3 operator*(IntType Scale) const;
    TIntVector3 operator/(IntType Divisor) const;
    TIntVector3 operator+(const TIntVector3& Other) const;
    TIntVector3 operator-(const TIntVector3& Other) const;
    IntType GetMax() const;
    IntType GetMin() const;
    IntType Size() const;
    bool IsZero() const;
    FString ToString() const;
};
template <typename InIntType> struct TIntVector2 { InIntType X; InIntType Y; TIntVector2() = default; TIntVector2(InIntType InX, InIntType InY) : X(InX), Y(InY) {} bool operator==(const TIntVector2& Other) const; };
template <typename InIntType> struct TIntVector4 { InIntType X; InIntType Y; InIntType Z; InIntType W; TIntVector4() = default; TIntVector4(InIntType InX, InIntType InY, InIntType InZ, InIntType InW) : X(InX), Y(InY), Z(InZ), W(InW) {} };
template <typename T> uint32 GetTypeHash(const TIntPoint<T>& InPoint);
template <typename T> uint32 GetTypeHash(const TIntVector3<T>& Vector);

// ---------------------------------------------------------------- colors
enum class EGammaSpace : uint8 { Linear, Pow22, sRGB, Invalid };

struct FLinearColor
{
    float R;
    float G;
    float B;
    float A;
    static const FLinearColor White;
    static const FLinearColor Gray;
    static const FLinearColor Black;
    static const FLinearColor Transparent;
    static const FLinearColor Red;
    static const FLinearColor Green;
    static const FLinearColor Blue;
    static const FLinearColor Yellow;
    FLinearColor() = default;
    explicit FLinearColor(EForceInit);
    constexpr FLinearColor(float InR, float InG, float InB, float InA = 1.0f) : R(InR), G(InG), B(InB), A(InA) {}
    FLinearColor(const FColor& Color);
    explicit FLinearColor(const FVector3f& Vector);
    explicit FLinearColor(const FVector3d& Vector);
    explicit FLinearColor(const FVector4f& Vector);
    explicit FLinearColor(const FVector4d& Vector);
    FColor ToRGBE() const;
    static FLinearColor FromSRGBColor(const FColor& Color);
    static FLinearColor FromPow22Color(const FColor& Color);
    float& Component(int32 Index);
    const float& Component(int32 Index) const;
    FLinearColor operator+(const FLinearColor& ColorB) const;
    FLinearColor& operator+=(const FLinearColor& ColorB);
    FLinearColor operator-(const FLinearColor& ColorB) const;
    FLinearColor& operator-=(const FLinearColor& ColorB);
    FLinearColor operator*(const FLinearColor& ColorB) const;
    FLinearColor& operator*=(const FLinearColor& ColorB);
    FLinearColor operator*(float Scalar) const;
    FLinearColor& operator*=(float Scalar);
    FLinearColor operator/(const FLinearColor& ColorB) const;
    FLinearColor& operator/=(const FLinearColor& ColorB);
    FLinearColor operator/(float Scalar) const;
    FLinearColor& operator/=(float Scalar);
    FLinearColor GetClamped(float InMin = 0.0f, float InMax = 1.0f) const;
    bool operator==(const FLinearColor& ColorB) const;
    bool operator!=(const FLinearColor& Other) const;
    bool Equals(const FLinearColor& ColorB, float Tolerance = UE_KINDA_SMALL_NUMBER) const;
    FLinearColor CopyWithNewOpacity(float NewOpacity) const;
    static FLinearColor MakeFromHSV8(uint8 H, uint8 S, uint8 V);
    static FLinearColor MakeRandomColor();
    static FLinearColor MakeRandomSeededColor(int32 Seed);
    static FLinearColor MakeFromColorTemperature(float Temp);
    static float Dist(const FLinearColor& V1, const FLinearColor& V2);
    FLinearColor LinearRGBToHSV() const;
    FLinearColor HSVToLinearRGB() const;
    static FLinearColor LerpUsingHSV(const FLinearColor& From, const FLinearColor& To, const float Progress);
    FColor Quantize() const;
    FColor QuantizeRound() const;
    FColor ToFColor(const bool bSRGB) const;
    FColor ToFColorSRGB() const;
    FLinearColor Desaturate(float Desaturation) const;
    float ComputeLuminance() const;
    float GetLuminance() const;
    float GetMax() const;
    float GetMin() const;
    bool IsAlmostBlack() const;
    FString ToString() const;
    bool InitFromString(const FString& InSourceString);
};
inline FLinearColor operator*(float Scalar, const FLinearColor& Color) { return Color * Scalar; }
uint32 GetTypeHash(const FLinearColor& LinearColor);

struct FColor
{
    uint8 B;
    uint8 G;
    uint8 R;
    uint8 A;
    static const FColor White;
    static const FColor Black;
    static const FColor Transparent;
    static const FColor Red;
    static const FColor Green;
    static const FColor Blue;
    static const FColor Yellow;
    static const FColor Cyan;
    static const FColor Magenta;
    static const FColor Orange;
    static const FColor Purple;
    static const FColor Turquoise;
    static const FColor Silver;
    static const FColor Emerald;
    FColor() = default;
    explicit FColor(EForceInit);
    constexpr FColor(uint8 InR, uint8 InG, uint8 InB, uint8 InA = 255) : B(InB), G(InG), R(InR), A(InA) {}
    explicit FColor(uint32 InColor);
    uint32& DWColor();
    const uint32& DWColor() const;
    bool operator==(const FColor& C) const;
    bool operator!=(const FColor& C) const;
    void operator+=(const FColor& C);
    FLinearColor FromRGBE() const;
    static FColor FromHex(const FString& HexString);
    static FColor MakeRandomColor();
    static FColor MakeRedToGreenColorFromScalar(float Scalar);
    static FColor MakeFromColorTemperature(float Temp);
    FColor WithAlpha(uint8 Alpha) const;
    FLinearColor ReinterpretAsLinear() const;
    FString ToHex() const;
    FString ToString() const;
    bool InitFromString(const FString& InSourceString);
    uint32 ToPackedARGB() const;
    uint32 ToPackedABGR() const;
    uint32 ToPackedRGBA() const;
    uint32 ToPackedBGRA() const;
};
uint32 GetTypeHash(const FColor& Color);

// ---------------------------------------------------------------- FMath
#define UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(Func) \
    template <typename Arg1, typename Arg2, std::enable_if_t<!std::is_same_v<Arg1, Arg2> && std::is_arithmetic_v<Arg1> && std::is_arithmetic_v<Arg2> && (std::is_floating_point_v<Arg1> || std::is_floating_point_v<Arg2>), int> = 0> \
    static auto Func(Arg1 A, Arg2 B) -> decltype(A * B) { using ArgType = decltype(A * B); return Func((ArgType)A, (ArgType)B); }
#define UESTUB_RESOLVE_FLOAT_AMBIGUITY_3_ARGS(Func) \
    template <typename Arg1, typename Arg2, typename Arg3, std::enable_if_t<!(std::is_same_v<Arg1, Arg2> && std::is_same_v<Arg2, Arg3>) && std::is_arithmetic_v<Arg1> && std::is_arithmetic_v<Arg2> && std::is_arithmetic_v<Arg3> && (std::is_floating_point_v<Arg1> || std::is_floating_point_v<Arg2> || std::is_floating_point_v<Arg3>), int> = 0> \
    static auto Func(Arg1 A, Arg2 B, Arg3 C) -> decltype(A * B * C) { using ArgType = decltype(A * B * C); return Func((ArgType)A, (ArgType)B, (ArgType)C); }

struct FMath
{
    // basic templates
    template <class T> static constexpr T Abs(const T A) { return (A < (T)0) ? -A : A; }
    template <class T> static constexpr T Sign(const T A) { return (A > (T)0) ? (T)1 : ((A < (T)0) ? (T)-1 : (T)0); }
    template <class T> static constexpr T Max(const T A, const T B) { return (B < A) ? A : B; }
    template <class T> static constexpr T Min(const T A, const T B) { return (A < B) ? A : B; }
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(Max)
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(Min)
    template <class T> static constexpr T Max3(const T A, const T B, const T C) { return Max(Max(A, B), C); }
    template <class T> static constexpr T Min3(const T A, const T B, const T C) { return Min(Min(A, B), C); }
    template <class T> static constexpr int32 Max3Index(const T A, const T B, const T C);
    template <class T> static constexpr int32 Min3Index(const T A, const T B, const T C);
    template <class T, class Allocator> static T Max(const TArray<T, Allocator>& Values, int32* MaxIndex = nullptr);
    template <class T, class Allocator> static T Min(const TArray<T, Allocator>& Values, int32* MinIndex = nullptr);
    template <class T> static constexpr T Square(const T A) { return A * A; }
    template <class T> static constexpr T Cube(const T A) { return A * A * A; }
    template <class T> static constexpr T Clamp(const T X, const T MinValue, const T MaxValue) { return (X < MinValue) ? MinValue : (X < MaxValue) ? X : MaxValue; }
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_3_ARGS(Clamp)
    template <class T> static constexpr T Wrap(const T X, const T Min, const T Max);
    template <class T> static constexpr T GridSnap(T Location, T Grid) { return Location; }
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(GridSnap)
    template <class T> static constexpr T DivideAndRoundUp(T Dividend, T Divisor);
    template <class T> static constexpr T DivideAndRoundDown(T Dividend, T Divisor);
    template <class T> static constexpr T DivideAndRoundNearest(T Dividend, T Divisor);
    template <class T> static constexpr bool IsPowerOfTwo(T Value);
    template <class T> static constexpr bool IsWithin(const T& TestValue, const T& MinValue, const T& MaxValue) { return ((TestValue >= MinValue) && (TestValue < MaxValue)); }
    template <class T> static constexpr bool IsWithinInclusive(const T& TestValue, const T& MinValue, const T& MaxValue) { return ((TestValue >= MinValue) && (TestValue <= MaxValue)); }
    template <class T, class U> static constexpr T Lerp(const T& A, const T& B, const U& Alpha) { return (T)(A + Alpha * (B - A)); }
    template <class T1, class T2, class T3, std::enable_if_t<!std::is_same_v<T1, T2>, int> = 0>
    static auto Lerp(const T1& A, const T2& B, const T3& Alpha) -> decltype(A * B) { using ABType = decltype(A * B); return Lerp(ABType(A), ABType(B), Alpha); }
    template <class T, class U> static T LerpStable(const T& A, const T& B, U Alpha) { return (T)((A * (1.0 - Alpha)) + (B * Alpha)); }
    template <class T, class U> static T BiLerp(const T& P00, const T& P10, const T& P01, const T& P11, const U& FracX, const U& FracY);
    template <class T, class U> static T CubicInterp(const T& P0, const T& T0, const T& P1, const T& T1, const U& A);
    template <class T, class U> static T CubicInterpDerivative(const T& P0, const T& T0, const T& P1, const T& T1, const U& A);
    template <class T> static constexpr T SmoothStep(T A, T B, T X) { return X < A ? (T)0 : (X >= B ? (T)1 : (T)0); }
    template <class T> static constexpr auto RadiansToDegrees(T const& RadVal) -> decltype(RadVal * (180.f / UE_PI)) { return RadVal * (180.f / UE_PI); }
    template <class T> static constexpr auto DegreesToRadians(T const& DegVal) -> decltype(DegVal * (UE_PI / 180.f)) { return DegVal * (UE_PI / 180.f); }
    template <class T, class U> static T InterpEaseIn(const T& A, const T& B, float Alpha, float Exp);
    template <class T, class U> static T InterpEaseOut(const T& A, const T& B, float Alpha, float Exp);
    template <class T> static T InterpEaseIn(const T& A, const T& B, float Alpha, float Exp);
    template <class T> static T InterpEaseOut(const T& A, const T& B, float Alpha, float Exp);
    template <class T> static T InterpEaseInOut(const T& A, const T& B, float Alpha, float Exp);
    template <class T> static T InterpStep(const T& A, const T& B, float Alpha, int32 Steps);
    template <class T> static T InterpSinIn(const T& A, const T& B, float Alpha);
    template <class T> static T InterpSinOut(const T& A, const T& B, float Alpha);
    template <class T> static T InterpSinInOut(const T& A, const T& B, float Alpha);
    template <class T> static T InterpExpoIn(const T& A, const T& B, float Alpha);
    template <class T> static T InterpExpoOut(const T& A, const T& B, float Alpha);
    template <class T> static T InterpExpoInOut(const T& A, const T& B, float Alpha);
    template <class T> static T InterpCircularIn(const T& A, const T& B, float Alpha);
    template <class T> static T InterpCircularOut(const T& A, const T& B, float Alpha);
    template <class T> static T InterpCircularInOut(const T& A, const T& B, float Alpha);

    // trig and powers
    static float Sin(float Value);
    static double Sin(double Value);
    static float Cos(float Value);
    static double Cos(double Value);
    static float Tan(float Value);
    static double Tan(double Value);
    static float Asin(float Value);
    static double Asin(double Value);
    static float Acos(float Value);
    static double Acos(double Value);
    static float Atan(float Value);
    static double Atan(double Value);
    static float Atan2(float Y, float X);
    static double Atan2(double Y, double X);
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(Atan2)
    static float Sinh(float Value);
    static double Sinh(double Value);
    static float FastAsin(float Value);
    static void SinCos(float* ScalarSin, float* ScalarCos, float Value);
    static void SinCos(double* ScalarSin, double* ScalarCos, double Value);
    static float Sqrt(float Value);
    static double Sqrt(double Value);
    static float InvSqrt(float F);
    static double InvSqrt(double F);
    static float InvSqrtEst(float F);
    static double InvSqrtEst(double F);
    static float Pow(float A, float B);
    static double Pow(double A, double B);
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(Pow)
    static float Exp(float Value);
    static double Exp(double Value);
    static float Exp2(float Value);
    static double Exp2(double Value);
    static float Loge(float Value);
    static double Loge(double Value);
    static float LogX(float Base, float Value);
    static double LogX(double Base, double Value);
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(LogX)
    static float Log2(float Value);
    static double Log2(double Value);
    static float Fmod(float X, float Y);
    static double Fmod(double X, double Y);
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(Fmod)
    static float Frac(float Value);
    static double Frac(double Value);
    static float Fractional(float Value);
    static double Fractional(double Value);
    static float Modf(const float InValue, float* OutIntPart);
    static double Modf(const double InValue, double* OutIntPart);
    static float CopySign(float X, float Y);
    static double CopySign(double X, double Y);

    // rounding
    static int32 TruncToInt32(float F);
    static int32 TruncToInt32(double F);
    static int64 TruncToInt64(double F);
    static int32 TruncToInt(float F);
    static int64 TruncToInt(double F);
    static float TruncToFloat(float F);
    static double TruncToFloat(double F);
    static double TruncToDouble(double F);
    static int32 FloorToInt32(float F);
    static int32 FloorToInt32(double F);
    static int64 FloorToInt64(double F);
    static int32 FloorToInt(float F);
    static int64 FloorToInt(double F);
    static float FloorToFloat(float F);
    static double FloorToFloat(double F);
    static double FloorToDouble(double F);
    static int32 RoundToInt32(float F);
    static int32 RoundToInt32(double F);
    static int64 RoundToInt64(double F);
    static int32 RoundToInt(float F);
    static int64 RoundToInt(double F);
    static float RoundToFloat(float F);
    static double RoundToFloat(double F);
    static double RoundToDouble(double F);
    static int32 CeilToInt32(float F);
    static int32 CeilToInt32(double F);
    static int64 CeilToInt64(double F);
    static int32 CeilToInt(float F);
    static int64 CeilToInt(double F);
    static float CeilToFloat(float F);
    static double CeilToFloat(double F);
    static double CeilToDouble(double F);
    static float RoundHalfToZero(float F);
    static double RoundHalfToZero(double F);
    static float RoundHalfFromZero(float F);
    static double RoundHalfFromZero(double F);
    static float RoundToZero(float F);
    static double RoundToZero(double F);
    static float RoundFromZero(float F);
    static double RoundFromZero(double F);
    static float RoundToNegativeInfinity(float F);
    static float RoundToPositiveInfinity(float F);
    template <class T> static T Quantize(T Value, T QuantizationStep);

    // classification
    static bool IsNaN(float A);
    static bool IsNaN(double A);
    static bool IsFinite(float A);
    static bool IsFinite(double A);
    static bool IsNegativeOrNegativeZero(float A);
    static bool IsNegativeOrNegativeZero(double A);
    static bool IsNearlyEqual(float A, float B, float ErrorTolerance = UE_SMALL_NUMBER);
    static bool IsNearlyEqual(double A, double B, double ErrorTolerance = UE_DOUBLE_SMALL_NUMBER);
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(IsNearlyEqual)
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_3_ARGS(IsNearlyEqual)
    static bool IsNearlyZero(float Value, float ErrorTolerance = UE_SMALL_NUMBER);
    static bool IsNearlyZero(double Value, double ErrorTolerance = UE_DOUBLE_SMALL_NUMBER);
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(IsNearlyZero)
    static bool IsNearlyEqualByULP(float A, float B, int32 MaxUlps = 4);
    static bool IsNearlyEqualByULP(double A, double B, int32 MaxUlps = 4);

    // random
    static void RandInit(int32 Seed);
    static void SRandInit(int32 Seed);
    static int32 GetRandSeed();
    static float SRand();
    static int32 Rand();
    static int32 Rand32();
    static int64 Rand64();
    static float FRand();
    static int32 RandHelper(int32 A);
    static int64 RandHelper64(int64 A);
    static int32 RandRange(int32 Min, int32 Max);
    static int64 RandRange(int64 Min, int64 Max);
    static float RandRange(float InMin, float InMax);
    static double RandRange(double InMin, double InMax);
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(RandRange)
    static float FRandRange(float InMin, float InMax);
    static double FRandRange(double InMin, double InMax);
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_2_ARGS(FRandRange)
    static bool RandBool();
    static FVector VRand();
    static FVector VRandCone(FVector const& Dir, float ConeHalfAngleRad);
    static FVector VRandCone(FVector const& Dir, float HorizontalConeHalfAngleRad, float VerticalConeHalfAngleRad);
    static FVector2D RandPointInCircle(float CircleRadius);
    static FVector RandPointInBox(const FBox& Box);
    static FVector GetReflectionVector(const FVector& Direction, const FVector& SurfaceNormal);

    // interpolation (UE5 templated scalar forms)
    template <typename T1, typename T2 = T1, typename T3 = T2, typename T4 = T3>
    static auto FInterpTo(T1 Current, T2 Target, T3 DeltaTime, T4 InterpSpeed) -> decltype(Current * Target * DeltaTime * InterpSpeed) { return Current; }
    template <typename T1, typename T2 = T1, typename T3 = T2, typename T4 = T3>
    static auto FInterpConstantTo(T1 Current, T2 Target, T3 DeltaTime, T4 InterpSpeed) -> decltype(Current * Target * DeltaTime * InterpSpeed) { return Current; }
    static FVector VInterpNormalRotationTo(const FVector& Current, const FVector& Target, float DeltaTime, float RotationSpeedDegrees);
    static FVector VInterpConstantTo(const FVector& Current, const FVector& Target, float DeltaTime, float InterpSpeed);
    static FVector VInterpTo(const FVector& Current, const FVector& Target, float DeltaTime, float InterpSpeed);
    static FVector2D Vector2DInterpConstantTo(const FVector2D& Current, const FVector2D& Target, float DeltaTime, float InterpSpeed);
    static FVector2D Vector2DInterpTo(const FVector2D& Current, const FVector2D& Target, float DeltaTime, float InterpSpeed);
    static FRotator RInterpConstantTo(const FRotator& Current, const FRotator& Target, float DeltaTime, float InterpSpeed);
    static FRotator RInterpTo(const FRotator& Current, const FRotator& Target, float DeltaTime, float InterpSpeed);
    static FQuat QInterpConstantTo(const FQuat& Current, const FQuat& Target, float DeltaTime, float InterpSpeed);
    static FQuat QInterpTo(const FQuat& Current, const FQuat& Target, float DeltaTime, float InterpSpeed);
    static FLinearColor CInterpTo(const FLinearColor& Current, const FLinearColor& Target, float DeltaTime, float InterpSpeed);
    template <class T> static T InterpCircularTo(T Current, T Target, T DeltaTime, T InterpSpeed);

    // angles
    template <typename T> static T ClampAngle(T AngleDegrees, T MinAngleDegrees, T MaxAngleDegrees);
    UESTUB_RESOLVE_FLOAT_AMBIGUITY_3_ARGS(ClampAngle)
    template <typename T, typename T2> static auto FindDeltaAngleDegrees(T A1, T2 A2) -> decltype(A1 * A2) { return A2 - A1; }
    template <typename T, typename T2> static auto FindDeltaAngleRadians(T A1, T2 A2) -> decltype(A1 * A2) { return A2 - A1; }
    template <typename T> static T UnwindRadians(T A);
    template <typename T> static T UnwindDegrees(T A);
    static void WindRelativeAnglesDegrees(float InAngle0, float& InOutAngle1);
    static void WindRelativeAnglesDegrees(double InAngle0, double& InOutAngle1);
    static float FixedTurn(float InCurrent, float InDesired, float InDeltaRate);
    static void CartesianToPolar(const float X, const float Y, float& OutRad, float& OutAng);
    static void CartesianToPolar(const double X, const double Y, double& OutRad, double& OutAng);
    static void PolarToCartesian(const float Rad, const float Ang, float& OutX, float& OutY);
    static void PolarToCartesian(const double Rad, const double Ang, double& OutX, double& OutY);
    static float GetRangePct(float MinValue, float MaxValue, float Value);
    static double GetRangePct(double MinValue, double MaxValue, double Value);
    static float GetRangePct(FVector2f const& Range, float Value);
    static double GetRangePct(FVector2d const& Range, double Value);
    static float GetRangeValue(FVector2f const& Range, float Pct);
    static double GetRangeValue(FVector2d const& Range, double Pct);
    template <class T> static T GetMappedRangeValueClamped(const UE::Math::TVector2<T>& InputRange, const UE::Math::TVector2<T>& OutputRange, const T Value);
    template <class T> static T GetMappedRangeValueUnclamped(const UE::Math::TVector2<T>& InputRange, const UE::Math::TVector2<T>& OutputRange, const T Value);
    static float GetMappedRangeValueClamped(const FVector2f& InputRange, const FVector2f& OutputRange, const float Value);
    static double GetMappedRangeValueClamped(const FVector2d& InputRange, const FVector2d& OutputRange, const double Value);
    static float GetMappedRangeValueUnclamped(const FVector2f& InputRange, const FVector2f& OutputRange, const float Value);
    static double GetMappedRangeValueUnclamped(const FVector2d& InputRange, const FVector2d& OutputRange, const double Value);
    static float MakePulsatingValue(const double InCurrentTime, const float InPulsesPerSecond, const float InPhase = 0.0f);
    static float PerlinNoise1D(const float Value);
    static float PerlinNoise2D(const FVector2D& Location);
    static float PerlinNoise3D(const FVector& Location);
    template <class T> static T WeightedMovingAverage(T CurrentSample, T PreviousSample, T Weight);
    template <class T> static T DynamicWeightedMovingAverage(T CurrentSample, T PreviousSample, T MaxDistance, T MinWeight, T MaxWeight);

    // geometry
    static FVector ClosestPointOnLine(const FVector& LineStart, const FVector& LineEnd, const FVector& Point);
    static FVector ClosestPointOnInfiniteLine(const FVector& LineStart, const FVector& LineEnd, const FVector& Point);
    static FVector ClosestPointOnSegment(const FVector& Point, const FVector& StartPoint, const FVector& EndPoint);
    static FVector2D ClosestPointOnSegment2D(const FVector2D& Point, const FVector2D& StartPoint, const FVector2D& EndPoint);
    static float PointDistToLine(const FVector& Point, const FVector& Direction, const FVector& Origin, FVector& OutClosestPoint);
    static float PointDistToLine(const FVector& Point, const FVector& Direction, const FVector& Origin);
    static float PointDistToSegment(const FVector& Point, const FVector& StartPoint, const FVector& EndPoint);
    static float PointDistToSegmentSquared(const FVector& Point, const FVector& StartPoint, const FVector& EndPoint);
    static void SegmentDistToSegment(FVector A1, FVector B1, FVector A2, FVector B2, FVector& OutP1, FVector& OutP2);
    static void SegmentDistToSegmentSafe(FVector A1, FVector B1, FVector A2, FVector B2, FVector& OutP1, FVector& OutP2);
    static float GetTForSegmentPlaneIntersect(const FVector& StartPoint, const FVector& EndPoint, const FPlane& Plane);
    static bool SegmentPlaneIntersection(const FVector& StartPoint, const FVector& EndPoint, const FPlane& Plane, FVector& out_IntersectionPoint);
    static bool SegmentIntersection2D(const FVector& SegmentStartA, const FVector& SegmentEndA, const FVector& SegmentStartB, const FVector& SegmentEndB, FVector& out_IntersectionPoint);
    static FVector LinePlaneIntersection(const FVector& Point1, const FVector& Point2, const FVector& PlaneOrigin, const FVector& PlaneNormal);
    static FVector LinePlaneIntersection(const FVector& Point1, const FVector& Point2, const FPlane& Plane);
    static FVector RayPlaneIntersection(const FVector& RayOrigin, const FVector& RayDirection, const FPlane& Plane);
    static bool LineSphereIntersection(const FVector& Start, const FVector& Dir, double Length, const FVector& Origin, double Radius);
    static bool LineBoxIntersection(const FBox& Box, const FVector& Start, const FVector& End, const FVector& Direction);
    static bool LineExtentBoxIntersection(const FBox& inBox, const FVector& Start, const FVector& End, const FVector& Extent, FVector& HitLocation, FVector& HitNormal, float& HitTime);
    static bool PointBoxIntersection(const FVector& Point, const FBox& Box);
    static bool SphereAABBIntersection(const FVector& SphereCenter, const double RadiusSquared, const FBox& AABB);
    static bool SphereAABBIntersection(const FSphere& Sphere, const FBox& AABB);
    static bool IntersectPlanes2(FVector& I, FVector& D, const FPlane& P1, const FPlane& P2);
    static bool IntersectPlanes3(FVector& I, const FPlane& P1, const FPlane& P2, const FPlane& P3);
    static FVector ComputeBaryCentric2D(const FVector& Point, const FVector& A, const FVector& B, const FVector& C);
    static bool GetDotDistance(FVector2D& OutDotDist, const FVector& Direction, const FVector& AxisX, const FVector& AxisY, const FVector& AxisZ);
    static FVector2D GetAzimuthAndElevation(const FVector& Direction, const FVector& AxisX, const FVector& AxisY, const FVector& AxisZ);
    static bool PointsAreCoplanar(const TArray<FVector>& Points, const float Tolerance = 0.1f);
    static float TruncateToHalfIfClose(float F, float Tolerance = UE_SMALL_NUMBER);
    static uint32 FloorLog2(uint32 Value);
    static uint64 FloorLog2_64(uint64 Value);
    static uint32 CeilLogTwo(uint32 Arg);
    static uint64 CeilLogTwo64(uint64 Arg);
    static uint32 RoundUpToPowerOfTwo(uint32 Arg);
    static uint64 RoundUpToPowerOfTwo64(uint64 V);
    static uint32 CountBits(uint64 Bits);
    static uint32 CountLeadingZeros(uint32 Value);
    static uint64 CountLeadingZeros64(uint64 Value);
    static uint32 CountTrailingZeros(uint32 Value);
    static uint64 CountTrailingZeros64(uint64 Value);
    static uint32 MortonCode2(uint32 x);
    static float Floor(float F);
    static double Floor(double F);
};

#undef UESTUB_ARITH

// ---------------------------------------------------------------- FRandomStream
struct FRandomStream
{
    FRandomStream();
    FRandomStream(int32 InSeed);
    explicit FRandomStream(FName InName);
    void Initialize(int32 InSeed);
    void Initialize(FName InName);
    void Reset() const;
    int32 GetInitialSeed() const;
    void GenerateNewSeed();
    float GetFraction() const;
    uint32 GetUnsignedInt() const;
    FVector GetUnitVector() const;
    int32 GetCurrentSeed() const;
    float FRand() const;
    int32 RandHelper(int32 A) const;
    int32 RandRange(int32 Min, int32 Max) const;
    float FRandRange(float InMin, float InMax) const;
    double FRandRange(double InMin, double InMax) const;
    FVector VRand() const;
    FVector VRandCone(FVector const& Dir, float ConeHalfAngleRad) const;
    FVector VRandCone(FVector const& Dir, float HorizontalConeHalfAngleRad, float VerticalConeHalfAngleRad) const;
    FString ToString() const;
};

// ---------------------------------------------------------------- ranges and curves (minimal)
template <typename ElementType> class TRange
{
public:
    TRange();
    explicit TRange(const ElementType& A);
    TRange(const ElementType& A, const ElementType& B);
    bool Contains(const ElementType& Element) const;
    ElementType GetLowerBoundValue() const;
    ElementType GetUpperBoundValue() const;
    bool IsEmpty() const;
};
typedef TRange<float> FFloatRange;
typedef TRange<double> FDoubleRange;
typedef TRange<int32> FInt32Range;
template <typename ElementType> struct TInterval
{
    ElementType Min;
    ElementType Max;
    TInterval();
    TInterval(ElementType InMin, ElementType InMax);
    ElementType Size() const;
    bool IsValid() const;
    bool Contains(const ElementType& Element) const;
    void Include(ElementType X);
    ElementType Clamp(ElementType X) const;
    ElementType Interpolate(float Alpha) const;
};
typedef TInterval<float> FFloatInterval;
typedef TInterval<int32> FInt32Interval;
