// Offline UE 5.x API stub: platform types, core macros, assertion macros.
// Declarations written from memory of the public UE API. Not Epic code.
#pragma once

#include <cstddef>
#include <cstdint>
#include <cfloat>
#include <climits>
#include <type_traits>
#include <utility>
#include <initializer_list>
#include <new>
#include <string_view>

// ---------------------------------------------------------------- platform
#ifndef PLATFORM_LINUX
#define PLATFORM_LINUX 1
#endif
#define PLATFORM_WINDOWS 0
#define PLATFORM_MAC 0
#define PLATFORM_ANDROID 0
#define PLATFORM_IOS 0
#define PLATFORM_DESKTOP 1
#define PLATFORM_UNIX 1
#define PLATFORM_64BITS 1
#define PLATFORM_LITTLE_ENDIAN 1
#define PLATFORM_TCHAR_IS_CHAR16 1

#ifndef WITH_EDITOR
#define WITH_EDITOR 0
#endif
#ifndef WITH_EDITORONLY_DATA
#define WITH_EDITORONLY_DATA WITH_EDITOR
#endif
#ifndef WITH_DEV_AUTOMATION_TESTS
#define WITH_DEV_AUTOMATION_TESTS 1
#endif
#ifndef WITH_PERF_AUTOMATION_TESTS
#define WITH_PERF_AUTOMATION_TESTS 0
#endif
#ifndef UE_BUILD_SHIPPING
#define UE_BUILD_SHIPPING 0
#endif
#ifndef UE_BUILD_DEBUG
#define UE_BUILD_DEBUG 0
#endif
#ifndef UE_BUILD_DEVELOPMENT
#define UE_BUILD_DEVELOPMENT 1
#endif
#ifndef UE_BUILD_TEST
#define UE_BUILD_TEST 0
#endif
#ifndef UE_GAME
#define UE_GAME 1
#endif
#ifndef UE_EDITOR
#define UE_EDITOR WITH_EDITOR
#endif
#ifndef UE_SERVER
#define UE_SERVER 0
#endif
#ifndef WITH_SERVER_CODE
#define WITH_SERVER_CODE 1
#endif
#ifndef WITH_ENGINE
#define WITH_ENGINE 1
#endif
#ifndef DO_CHECK
#define DO_CHECK 1
#endif
#ifndef DO_GUARD_SLOW
#define DO_GUARD_SLOW 0
#endif
#ifndef DO_ENSURE
#define DO_ENSURE 1
#endif
#ifndef UE_ENABLE_INCLUDE_ORDER_DEPRECATED_IN_5_2
#define UE_ENABLE_INCLUDE_ORDER_DEPRECATED_IN_5_2 0
#endif
#define ENABLE_VISUAL_LOG 0
#define CPP 1
#define STATS 0
#define ENABLE_DRAW_DEBUG (!UE_BUILD_SHIPPING)
#define UE_WITH_IRIS 0
#define WITH_PHYSX 0
#define WITH_CHAOS 1
#define PHYSICS_INTERFACE_PHYSX 0

// Module API macros. QUEBEC_API is passed on the command line (empty).
#define DLLEXPORT __attribute__((visibility("default")))
#define DLLIMPORT __attribute__((visibility("default")))
#define CORE_API
#define COREUOBJECT_API
#define ENGINE_API
#define INPUTCORE_API
#define NETCORE_API
#define ANIMGRAPHRUNTIME_API
#define PIXELSTREAMING2_API
#define PIXELSTREAMING2CORE_API
#define PHYSICSCORE_API
#define SLATECORE_API
#define SLATE_API
#define UMG_API
#define AUDIOMIXER_API
#define NO_API
#define MINIMALAPI_API

#define FORCEINLINE inline
#define FORCENOINLINE __attribute__((noinline))
#define FORCEINLINE_DEBUGGABLE inline
#define RESTRICT __restrict
#define UE_NODISCARD [[nodiscard]]
#define UE_NORETURN [[noreturn]]
#define CONSTEXPR constexpr
#define ABSTRACT
#define LIKELY(x) __builtin_expect(!!(x), 1)
#define UNLIKELY(x) __builtin_expect(!!(x), 0)
#define UE_LIKELY(x) LIKELY(x)
#define UE_UNLIKELY(x) UNLIKELY(x)
#define UE_ARRAY_COUNT(array) (sizeof(::UEStub::ArrayCountHelper(array)) - 1)
#define ARRAY_COUNT(array) UE_ARRAY_COUNT(array)
#define STRUCT_OFFSET(struc, member) offsetof(struc, member)
#define PREPROCESSOR_TO_STRING_INNER(x) #x
#define PREPROCESSOR_TO_STRING(x) PREPROCESSOR_TO_STRING_INNER(x)
#define PREPROCESSOR_JOIN_INNER(x, y) x##y
#define PREPROCESSOR_JOIN(x, y) PREPROCESSOR_JOIN_INNER(x, y)
#define ANONYMOUS_VARIABLE(Name) PREPROCESSOR_JOIN(Name, __LINE__)
#define UE_DEPRECATED(Version, Message) [[deprecated(Message " Please update your code to the new API before upgrading to the next release, otherwise your project will no longer compile.")]]
#define UE_DEPRECATED_FORGAME UE_DEPRECATED
#define PRAGMA_DISABLE_DEPRECATION_WARNINGS _Pragma("clang diagnostic push") _Pragma("clang diagnostic ignored \"-Wdeprecated-declarations\"")
#define PRAGMA_ENABLE_DEPRECATION_WARNINGS _Pragma("clang diagnostic pop")
#define PRAGMA_DISABLE_SHADOW_VARIABLE_WARNINGS _Pragma("clang diagnostic push") _Pragma("clang diagnostic ignored \"-Wshadow\"")
#define PRAGMA_ENABLE_SHADOW_VARIABLE_WARNINGS _Pragma("clang diagnostic pop")
#define PRAGMA_DISABLE_OPTIMIZATION
#define PRAGMA_ENABLE_OPTIMIZATION
#define UE_DISABLE_OPTIMIZATION
#define UE_ENABLE_OPTIMIZATION
#define THIRD_PARTY_INCLUDES_START
#define THIRD_PARTY_INCLUDES_END
#define UE_NONCOPYABLE(TypeName) TypeName(TypeName&&) = delete; TypeName(const TypeName&) = delete; TypeName& operator=(const TypeName&) = delete; TypeName& operator=(TypeName&&) = delete;
#define UE_REQUIRES(...) , std::enable_if_t<(__VA_ARGS__), int> = 0
#define TEMPLATE_REQUIRES(...) typename TEnableIf<__VA_ARGS__, int>::type = 0
#define UE_LIFETIMEBOUND
#define UE_ASSUME(x)
#define UE_STATIC_DEPRECATE(Version, bExpression, Message)
#define GCC_ALIGN(n) __attribute__((aligned(n)))
#define MS_ALIGN(n)
#define UE_PTRDIFF_TO_INT32(argument) static_cast<int32>(argument)
#define UE_PTRDIFF_TO_UINT32(argument) static_cast<uint32>(argument)
#define TYPE_OF_NULLPTR decltype(nullptr)

// ---------------------------------------------------------------- integer types (UE Linux)
typedef unsigned char uint8;
typedef unsigned short int uint16;
typedef unsigned int uint32;
typedef unsigned long long uint64;
typedef signed char int8;
typedef signed short int int16;
typedef signed int int32;
typedef signed long long int64;
typedef char ANSICHAR;
typedef char16_t WIDECHAR;
typedef char16_t TCHAR;
typedef char8_t UTF8CHAR;
typedef char16_t UTF16CHAR;
typedef char32_t UTF32CHAR;
typedef uint8 CHAR8;
typedef uint16 CHAR16;
typedef uint32 CHAR32;
typedef unsigned long SIZE_T;
typedef long SSIZE_T;
typedef intptr_t PTRINT;
typedef uintptr_t UPTRINT;
typedef int32 TYPE_OF_INDEX_NONE;

#define TEXT_PASTE(x) u ## x
#define TEXT(x) TEXT_PASTE(x)
#define UTF8TEXT_PASTE(x) u8 ## x
#define UTF8TEXT(x) UTF8TEXT_PASTE(x)
#define WIDETEXT(str) TEXT(str)
#define LINE_TERMINATOR TEXT("\n")
#define LINE_TERMINATOR_ANSI "\n"

#define MIN_uint8 ((uint8) 0x00)
#define MIN_uint16 ((uint16) 0x0000)
#define MIN_uint32 ((uint32) 0x00000000)
#define MIN_uint64 ((uint64) 0x0000000000000000)
#define MIN_int8 ((int8) -128)
#define MIN_int16 ((int16) -32768)
#define MIN_int32 ((int32) 0x80000000)
#define MIN_int64 ((int64) 0x8000000000000000)
#define MAX_uint8 ((uint8) 0xff)
#define MAX_uint16 ((uint16) 0xffff)
#define MAX_uint32 ((uint32) 0xffffffff)
#define MAX_uint64 ((uint64) 0xffffffffffffffff)
#define MAX_int8 ((int8) 0x7f)
#define MAX_int16 ((int16) 0x7fff)
#define MAX_int32 ((int32) 0x7fffffff)
#define MAX_int64 ((int64) 0x7fffffffffffffff)
#define MIN_flt (1.175494351e-38F)
#define MAX_flt (3.402823466e+38F)
#define MIN_dbl (2.2250738585072014e-308)
#define MAX_dbl (1.7976931348623158e+308)

enum { INDEX_NONE = -1 };
enum { UNICODE_BOM = 0xfeff };
enum EForceInit { ForceInit, ForceInitToZero };
enum ENoInit { NoInit };
enum EInPlace { InPlace };
enum class EAllowShrinking : uint8 { No, Yes, Default = Yes };

namespace ESearchCase { enum Type { CaseSensitive, IgnoreCase }; }
namespace ESearchDir { enum Type { FromStart, FromEnd }; }

namespace UEStub
{
    template <typename T, size_t N> char (&ArrayCountHelper(const T (&)[N]))[N + 1];
    [[noreturn]] void Unreachable();
    // A reference to "some" T for stub bodies. Defined (never run) so that templates instantiated
    // with internal-linkage or local types do not trip clang's undefined-internal diagnostics.
    template <typename T> T& DeclRef() { static std::remove_reference_t<T>* UEStubNoObject; return *UEStubNoObject; }
    template <typename R> R Fake()
    {
        if constexpr (std::is_void_v<R>) return;
        else if constexpr (std::is_lvalue_reference_v<R>) return DeclRef<std::remove_reference_t<R>>();
        else if constexpr (std::is_rvalue_reference_v<R>) return static_cast<R>(DeclRef<std::remove_reference_t<R>>());
        else return static_cast<R&&>(DeclRef<R>());
    }
}

// ---------------------------------------------------------------- enum flags
#define ENUM_CLASS_FLAGS(Enum) \
    inline constexpr Enum& operator|=(Enum& Lhs, Enum Rhs) { return Lhs = (Enum)((__underlying_type(Enum))Lhs | (__underlying_type(Enum))Rhs); } \
    inline constexpr Enum& operator&=(Enum& Lhs, Enum Rhs) { return Lhs = (Enum)((__underlying_type(Enum))Lhs & (__underlying_type(Enum))Rhs); } \
    inline constexpr Enum& operator^=(Enum& Lhs, Enum Rhs) { return Lhs = (Enum)((__underlying_type(Enum))Lhs ^ (__underlying_type(Enum))Rhs); } \
    inline constexpr Enum operator|(Enum Lhs, Enum Rhs) { return (Enum)((__underlying_type(Enum))Lhs | (__underlying_type(Enum))Rhs); } \
    inline constexpr Enum operator&(Enum Lhs, Enum Rhs) { return (Enum)((__underlying_type(Enum))Lhs & (__underlying_type(Enum))Rhs); } \
    inline constexpr Enum operator^(Enum Lhs, Enum Rhs) { return (Enum)((__underlying_type(Enum))Lhs ^ (__underlying_type(Enum))Rhs); } \
    inline constexpr bool operator!(Enum E) { return !(__underlying_type(Enum))E; } \
    inline constexpr Enum operator~(Enum E) { return (Enum)~(__underlying_type(Enum))E; }

template <typename Enum> constexpr bool EnumHasAnyFlags(Enum Flags, Enum Contains) { return (((__underlying_type(Enum))Flags) & (__underlying_type(Enum))Contains) != 0; }
template <typename Enum> constexpr bool EnumHasAllFlags(Enum Flags, Enum Contains) { return (((__underlying_type(Enum))Flags) & (__underlying_type(Enum))Contains) == ((__underlying_type(Enum))Contains); }
template <typename Enum> void EnumAddFlags(Enum& Flags, Enum FlagsToAdd);
template <typename Enum> void EnumRemoveFlags(Enum& Flags, Enum FlagsToRemove);

// ---------------------------------------------------------------- assertion macros (non-shipping semantics)
namespace UEStub
{
    bool EnsureFailed();
    [[noreturn]] void CheckFailed();
    template <typename T> constexpr bool IsContextuallyBool(const T& V) { return V ? true : false; }
}
#define check(expr) do { if (!(expr)) ::UEStub::CheckFailed(); } while (0)
#define checkSlow(expr) do { if (false) { (void)(expr); } } while (0)
#define checkf(expr, format, ...) do { if (!(expr)) { ::UEStub::Fmt::CheckFormatArgs(format __VA_OPT__(,) __VA_ARGS__); ::UEStub::CheckFailed(); } } while (0)
#define checkfSlow(expr, format, ...) do { if (false) { (void)(expr); ::UEStub::Fmt::CheckFormatArgs(format __VA_OPT__(,) __VA_ARGS__); } } while (0)
#define verify(expr) do { if (!(expr)) ::UEStub::CheckFailed(); } while (0)
#define verifyf(expr, format, ...) do { if (!(expr)) { ::UEStub::Fmt::CheckFormatArgs(format __VA_OPT__(,) __VA_ARGS__); ::UEStub::CheckFailed(); } } while (0)
#define checkNoEntry() ::UEStub::CheckFailed()
#define checkNoReentry()
#define checkNoRecursion()
#define unimplemented() ::UEStub::CheckFailed()
#define checkCode(Code) do { Code; } while (0)
#define ensure(InExpression) (!!(InExpression) || ::UEStub::EnsureFailed())
#define ensureAlways(InExpression) (!!(InExpression) || ::UEStub::EnsureFailed())
#define ensureMsgf(InExpression, InFormat, ...) (!!(InExpression) || (::UEStub::Fmt::CheckFormatArgs(InFormat __VA_OPT__(,) __VA_ARGS__), ::UEStub::EnsureFailed()))
#define ensureAlwaysMsgf(InExpression, InFormat, ...) (!!(InExpression) || (::UEStub::Fmt::CheckFormatArgs(InFormat __VA_OPT__(,) __VA_ARGS__), ::UEStub::EnsureFailed()))
#define UE_ASSUME(x)
#define UE_CHECK_IMPL(expr) check(expr)
#define LowLevelFatalError(Format, ...) ::UEStub::Fmt::CheckFormatArgs(Format __VA_OPT__(,) __VA_ARGS__)
#define UE_FORCE_CONSTEVAL(...) (__VA_ARGS__)

// Deprecated math constants (UE 5.1+): use UE_SMALL_NUMBER, UE_KINDA_SMALL_NUMBER, UE_BIG_NUMBER, UE_DOUBLE_SMALL_NUMBER...
#define UE_PI (3.1415926535897932f)
#define UE_SMALL_NUMBER (1.e-8f)
#define UE_KINDA_SMALL_NUMBER (1.e-4f)
#define UE_BIG_NUMBER (3.4e+38f)
#define UE_EULERS_NUMBER (2.71828182845904523536f)
#define UE_GOLDEN_RATIO (1.6180339887498948482045868343656381f)
#define UE_FLOAT_NON_FRACTIONAL (8388608.f)
#define UE_DOUBLE_PI (3.141592653589793238462643383279502884197169399)
#define UE_DOUBLE_SMALL_NUMBER (1.e-8)
#define UE_DOUBLE_KINDA_SMALL_NUMBER (1.e-4)
#define UE_DOUBLE_BIG_NUMBER (3.4e+38)
#define UE_DOUBLE_EULERS_NUMBER (2.7182818284590452353602874713526624977572)
#define UE_TWO_PI (6.28318530717958647692f)
#define UE_HALF_PI (1.57079632679489661923f)
#define UE_INV_PI (0.31830988618f)
#define UE_DOUBLE_TWO_PI (6.283185307179586476925286766559)
#define UE_DOUBLE_HALF_PI (1.570796326794896619231321691639751442)
#define UE_DOUBLE_INV_PI (0.31830988618379067154)
#define UE_SQRT_2 (1.4142135623730950488016887242097f)
#define UE_SQRT_3 (1.7320508075688772935274463415059f)
#define UE_INV_SQRT_2 (0.70710678118654752440084436210485f)
#define UE_DELTA (0.00001f)
#define UE_DOUBLE_DELTA (0.00001)
#define UE_THRESH_POINTS_ARE_SAME (0.00002f)
#define UE_THRESH_POINTS_ARE_NEAR (0.015f)
#define UE_THRESH_NORMALS_ARE_PARALLEL (0.999845f)
#define UE_THRESH_NORMALS_ARE_ORTHOGONAL (0.017455f)
#define UE_THRESH_VECTOR_NORMALIZED (0.01f)
#define UE_THRESH_QUAT_NORMALIZED (0.01f)
#define UE_THRESH_ZERO_NORM_SQUARED (0.0001f)
#define UE_KINDA_SMALL_NUMBER_SQUARED (UE_KINDA_SMALL_NUMBER * UE_KINDA_SMALL_NUMBER)
#define PI UE_PI
#define HALF_PI UE_HALF_PI
#define TWO_PI UE_TWO_PI
#define INV_PI UE_INV_PI
#define DOUBLE_PI UE_DOUBLE_PI
// Legacy names (UE 5.1 deprecated them in favour of UE_ prefixed ones; UE only warns, so they are accepted here).
#define SMALL_NUMBER UE_SMALL_NUMBER
#define KINDA_SMALL_NUMBER UE_KINDA_SMALL_NUMBER
#define BIG_NUMBER UE_BIG_NUMBER
#define DOUBLE_SMALL_NUMBER UE_DOUBLE_SMALL_NUMBER
#define DOUBLE_KINDA_SMALL_NUMBER UE_DOUBLE_KINDA_SMALL_NUMBER
#define DELTA UE_DELTA
#define THRESH_POINTS_ARE_SAME UE_THRESH_POINTS_ARE_SAME
#define THRESH_NORMALS_ARE_PARALLEL UE_THRESH_NORMALS_ARE_PARALLEL
#define THRESH_VECTOR_NORMALIZED UE_THRESH_VECTOR_NORMALIZED

// ---------------------------------------------------------------- template helpers used across UE code
template <bool Predicate, typename Result = void> struct TEnableIf { typedef Result type; using Type = Result; };
template <typename Result> struct TEnableIf<false, Result> {};
template <typename T> struct TRemoveReference { typedef std::remove_reference_t<T> Type; };
template <typename T> struct TRemoveCV { typedef std::remove_cv_t<T> Type; };
template <typename T> struct TDecay { typedef std::decay_t<T> Type; };
template <typename A, typename B> struct TIsSame { enum { Value = std::is_same_v<A, B> }; };
template <typename T> struct TIsArithmetic { enum { Value = std::is_arithmetic_v<T> }; };
template <typename T> struct TIsFloatingPoint { enum { Value = std::is_floating_point_v<T> }; };
template <typename T> struct TIsIntegral { enum { Value = std::is_integral_v<T> }; };
template <typename T> struct TIsPointer { enum { Value = std::is_pointer_v<T> }; };
template <typename T> struct TIsEnum { enum { Value = std::is_enum_v<T> }; };
template <typename From, typename To> struct TIsDerivedFrom { enum { Value = std::is_base_of_v<To, From>, IsDerived = Value }; };
template <typename T> struct TIsTriviallyCopyConstructible { enum { Value = std::is_trivially_copy_constructible_v<T> }; };
template <typename... Ts> struct TAnd;
template <> struct TAnd<> { enum { Value = true }; };
template <typename T, typename... Ts> struct TAnd<T, Ts...> { enum { Value = T::Value && TAnd<Ts...>::Value }; };
template <typename... Ts> struct TOr;
template <> struct TOr<> { enum { Value = false }; };
template <typename T, typename... Ts> struct TOr<T, Ts...> { enum { Value = T::Value || TOr<Ts...>::Value }; };
template <typename T> struct TNot { enum { Value = !T::Value }; };
template <typename T> struct TIdentity { typedef T Type; using type = T; };
template <typename T> using TIdentity_T = T;
template <bool B, typename T, typename F> struct TChooseClass { typedef std::conditional_t<B, T, F> Result; };
template <typename T> struct TCallTraits { typedef const T& ParamType; typedef const T& ConstReference; typedef T& Reference; typedef T ValueType; };
template <typename T> struct TTypeTraits { typedef typename TCallTraits<T>::ParamType ConstInitType; typedef typename TCallTraits<T>::ParamType ConstPointerType; };
template <typename T> struct TIsTArray { enum { Value = false }; };
template <typename T> struct TIsZeroConstructType { enum { Value = std::is_enum_v<T> || std::is_arithmetic_v<T> || std::is_pointer_v<T> }; };

template <typename T> constexpr std::remove_reference_t<T>&& MoveTemp(T&& Obj) noexcept
{
    static_assert(!std::is_const_v<std::remove_reference_t<T>>, "MoveTemp called on a const object");
    static_assert(std::is_lvalue_reference_v<T>, "MoveTemp called on an rvalue");
    return static_cast<std::remove_reference_t<T>&&>(Obj);
}
template <typename T> constexpr std::remove_reference_t<T>&& MoveTempIfPossible(T&& Obj) noexcept { return static_cast<std::remove_reference_t<T>&&>(Obj); }
template <typename T> constexpr T&& Forward(std::remove_reference_t<T>& Obj) noexcept { return static_cast<T&&>(Obj); }
template <typename T> constexpr T&& Forward(std::remove_reference_t<T>&& Obj) noexcept { return static_cast<T&&>(Obj); }
template <typename T> T CopyTemp(T& Val) { return const_cast<const T&>(Val); }
template <typename T> T CopyTemp(const T& Val) { return Val; }
template <typename T> void Swap(T& A, T& B);
template <typename T> void Exchange(T& A, T& B);
template <typename T> constexpr T Align(T Val, uint64 Alignment);
template <typename T> constexpr T AlignArbitrary(T Val, uint64 Alignment);
template <typename T, typename U> constexpr T ImplicitConv(U&& Obj) { return Obj; }
template <typename To, typename From> To BitCast(const From& Src);
template <typename T> const T& AsConst(T& Ref) { return Ref; }
template <typename T> std::add_const_t<T>& AsConst(T&& Ref) = delete;
template <typename T> T* GetData(T* Ptr);

template <typename T, typename = void> struct TIsContiguousContainer { enum { Value = false }; };

// AutoRTFM.h (transactional memory annotations; no-ops outside AutoRTFM builds)
#define AUTORTFM_DISABLE
#define AUTORTFM_DISABLE_IF(...)
#define AUTORTFM_ALWAYS_OPEN
#define AUTORTFM_ALWAYS_OPEN_NO_MEMORY_VALIDATION
#define AUTORTFM_OPEN
#define AUTORTFM_NOAUTORTFM
#define AUTORTFM_INFER
#define UE_AUTORTFM 0
#define UE_AUTORTFM_ALWAYS_OPEN
#define UE_AUTORTFM_NOAUTORTFM
namespace AutoRTFM
{
    inline bool IsClosed() { return false; }
    inline bool IsTransactional() { return false; }
    inline bool IsCommittingOrAborting() { return false; }
    template <typename FunctorType> void Open(const FunctorType& Functor) { Functor(); }
    template <typename FunctorType> void OnCommit(const FunctorType& Functor) { Functor(); }
    template <typename FunctorType> void OnAbort(const FunctorType&) {}
    template <typename FunctorType> void PushOnAbortHandler(const void*, const FunctorType&) {}
    inline void PopOnAbortHandler(const void*) {}
}

// GenericPlatformAffinity.h
enum EThreadPriority { TPri_Normal, TPri_AboveNormal, TPri_BelowNormal, TPri_Highest, TPri_Lowest, TPri_SlightlyBelowNormal, TPri_TimeCritical, TPri_Num };
