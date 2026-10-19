// Offline UE 5.x API stub: FString, FName, FText, character utilities and the
// compile-time printf format validation that UE 5.x applies to UE_LOG / FString::Printf.
#pragma once
#include "UEStub/Containers.h"

class FString;
class FName;
class FText;

// ---------------------------------------------------------------- printf format validation
namespace UEStub::Fmt
{
    enum class EArg : int { Int, Float, TStr, AStr, Ptr, NullPtr, Other };

    template <typename T> constexpr EArg Classify()
    {
        using D = std::remove_cvref_t<T>;
        if constexpr (std::is_same_v<D, std::nullptr_t>) return EArg::NullPtr;
        else if constexpr (std::is_integral_v<D> || std::is_enum_v<D>) return EArg::Int;
        else if constexpr (std::is_floating_point_v<D>) return EArg::Float;
        else if constexpr (std::is_array_v<D> || std::is_pointer_v<D>)
        {
            using P = std::remove_cv_t<std::remove_pointer_t<std::decay_t<D>>>;
            if constexpr (std::is_same_v<P, TCHAR>) return EArg::TStr;
            else if constexpr (std::is_same_v<P, char> || std::is_same_v<P, UTF8CHAR>) return EArg::AStr;
            else return EArg::Ptr;
        }
        else return EArg::Other;
    }

    // Each of these is deliberately not constexpr: reaching one during constant evaluation of a
    // format string makes the compiler print its name as the reason for the error.
    void Error_PercentS_needs_a_TCHAR_pointer__pass_STAR_MyFString_not_the_FString();
    void Error_PercentHS_needs_an_ANSICHAR_pointer();
    void Error_integer_conversion_needs_an_integer_or_enum_argument();
    void Error_float_conversion_needs_a_float_or_double_argument();
    void Error_PercentP_needs_a_pointer_argument();
    void Error_more_arguments_than_format_specifiers();
    void Error_fewer_arguments_than_format_specifiers();
    void Error_unsupported_or_truncated_format_specifier();
    void Error_class_type_passed_to_a_printf_style_function();

    template <int N, typename... Args>
    consteval void Validate(const TCHAR (&S)[N])
    {
        constexpr EArg Kinds[] = { Classify<Args>()..., EArg::Other };
        constexpr int NumArgs = sizeof...(Args);
        int Arg = 0;
        int I = 0;
        const int Len = N - 1;
        while (I < Len)
        {
            if (S[I] != u'%') { ++I; continue; }
            ++I;
            if (I >= Len) { Error_unsupported_or_truncated_format_specifier(); return; }
            if (S[I] == u'%') { ++I; continue; }
            while (I < Len && (S[I] == u'-' || S[I] == u'+' || S[I] == u' ' || S[I] == u'#' || S[I] == u'0' || S[I] == u'\'')) ++I;
            if (I < Len && S[I] == u'*') { if (Arg >= NumArgs) { Error_fewer_arguments_than_format_specifiers(); return; } if (Kinds[Arg] != EArg::Int) Error_integer_conversion_needs_an_integer_or_enum_argument(); ++Arg; ++I; }
            while (I < Len && S[I] >= u'0' && S[I] <= u'9') ++I;
            if (I < Len && S[I] == u'.')
            {
                ++I;
                if (I < Len && S[I] == u'*') { if (Arg >= NumArgs) { Error_fewer_arguments_than_format_specifiers(); return; } if (Kinds[Arg] != EArg::Int) Error_integer_conversion_needs_an_integer_or_enum_argument(); ++Arg; ++I; }
                while (I < Len && S[I] >= u'0' && S[I] <= u'9') ++I;
            }
            bool bShort = false;
            while (I < Len && (S[I] == u'h' || S[I] == u'l' || S[I] == u'L' || S[I] == u'z' || S[I] == u'j' || S[I] == u't' || S[I] == u'q' || S[I] == u'I'))
            {
                if (S[I] == u'h') bShort = true;
                if (S[I] == u'I' && I + 2 < Len && S[I + 1] == u'6' && S[I + 2] == u'4') I += 2;
                ++I;
            }
            if (I >= Len) { Error_unsupported_or_truncated_format_specifier(); return; }
            const TCHAR C = S[I++];
            if (Arg >= NumArgs) { Error_fewer_arguments_than_format_specifiers(); return; }
            const EArg K = Kinds[Arg++];
            if (K == EArg::Other)
            {
                if (C == u's' || C == u'S') Error_PercentS_needs_a_TCHAR_pointer__pass_STAR_MyFString_not_the_FString();
                else Error_class_type_passed_to_a_printf_style_function();
                continue;
            }
            switch (C)
            {
            case u'd': case u'i': case u'u': case u'x': case u'X': case u'o': case u'c': case u'C':
                if (K != EArg::Int) Error_integer_conversion_needs_an_integer_or_enum_argument();
                break;
            case u'f': case u'F': case u'e': case u'E': case u'g': case u'G': case u'a': case u'A':
                if (K != EArg::Float) Error_float_conversion_needs_a_float_or_double_argument();
                break;
            case u's':
                if (bShort) { if (K != EArg::AStr && K != EArg::NullPtr) Error_PercentHS_needs_an_ANSICHAR_pointer(); }
                else if (K != EArg::TStr && K != EArg::NullPtr) Error_PercentS_needs_a_TCHAR_pointer__pass_STAR_MyFString_not_the_FString();
                break;
            case u'S':
                if (K != EArg::AStr && K != EArg::TStr && K != EArg::NullPtr) Error_PercentS_needs_a_TCHAR_pointer__pass_STAR_MyFString_not_the_FString();
                break;
            case u'p':
                if (K != EArg::Ptr && K != EArg::TStr && K != EArg::AStr && K != EArg::NullPtr) Error_PercentP_needs_a_pointer_argument();
                break;
            default:
                Error_unsupported_or_truncated_format_specifier();
            }
        }
        if (Arg < NumArgs) Error_more_arguments_than_format_specifiers();
    }

    template <typename... Args>
    struct TFormatString
    {
        template <int N>
        consteval TFormatString(const TCHAR (&S)[N]) : Str(S) { Validate<N, Args...>(S); }
        const TCHAR* Str;
    };

    template <typename... Args>
    inline void CheckFormatArgs(TFormatString<std::type_identity_t<Args>...> Format, const Args&... InArgs) {}
}

// ---------------------------------------------------------------- character utilities
template <typename CharType> struct TChar
{
    static CharType ToUpper(CharType Char) { return ::UEStub::Fake<CharType>(); }
    static CharType ToLower(CharType Char) { return ::UEStub::Fake<CharType>(); }
    static bool IsUpper(CharType Char) { return ::UEStub::Fake<bool>(); }
    static bool IsLower(CharType Char) { return ::UEStub::Fake<bool>(); }
    static bool IsAlpha(CharType Char) { return ::UEStub::Fake<bool>(); }
    static bool IsGraph(CharType Char) { return ::UEStub::Fake<bool>(); }
    static bool IsPrint(CharType Char) { return ::UEStub::Fake<bool>(); }
    static bool IsPunct(CharType Char) { return ::UEStub::Fake<bool>(); }
    static bool IsAlnum(CharType Char) { return ::UEStub::Fake<bool>(); }
    static bool IsDigit(CharType Char) { return ::UEStub::Fake<bool>(); }
    static bool IsHexDigit(CharType Char) { return ::UEStub::Fake<bool>(); }
    static bool IsWhitespace(CharType Char) { return ::UEStub::Fake<bool>(); }
    static bool IsLinebreak(CharType Char) { return ::UEStub::Fake<bool>(); }
    static int32 ConvertCharDigitToInt(CharType Char) { return ::UEStub::Fake<int32>(); }
};
typedef TChar<TCHAR> FChar;
typedef TChar<WIDECHAR> FCharWide;
typedef TChar<ANSICHAR> FCharAnsi;

template <typename T> struct TCString
{
    typedef T CharType;
    static bool IsPureAnsi(const CharType* Str) { return ::UEStub::Fake<bool>(); }
    static bool IsNumeric(const CharType* Str) { return ::UEStub::Fake<bool>(); }
    static CharType* Strcpy(CharType* Dest, const CharType* Src) { return ::UEStub::Fake<CharType*>(); }
    static CharType* Strncpy(CharType* Dest, const CharType* Src, int32 MaxLen) { return ::UEStub::Fake<CharType*>(); }
    static CharType* Strcat(CharType* Dest, const CharType* Src) { return ::UEStub::Fake<CharType*>(); }
    static int32 Strcmp(const CharType* String1, const CharType* String2) { return ::UEStub::Fake<int32>(); }
    static int32 Strncmp(const CharType* String1, const CharType* String2, SIZE_T Count) { return ::UEStub::Fake<int32>(); }
    static int32 Stricmp(const CharType* String1, const CharType* String2) { return ::UEStub::Fake<int32>(); }
    static int32 Strnicmp(const CharType* String1, const CharType* String2, SIZE_T Count) { return ::UEStub::Fake<int32>(); }
    static int32 Strlen(const CharType* String) { return ::UEStub::Fake<int32>(); }
    static const CharType* Strstr(const CharType* String, const CharType* Find) { return ::UEStub::Fake<const CharType*>(); }
    static CharType* Strstr(CharType* String, const CharType* Find) { return ::UEStub::Fake<CharType*>(); }
    static const CharType* Strchr(const CharType* String, CharType c) { return ::UEStub::Fake<const CharType*>(); }
    static const CharType* Strrchr(const CharType* String, CharType c) { return ::UEStub::Fake<const CharType*>(); }
    static const CharType* Stristr(const CharType* String, const CharType* Find) { return ::UEStub::Fake<const CharType*>(); }
    static CharType* Stristr(CharType* String, const CharType* Find) { return ::UEStub::Fake<CharType*>(); }
    static int32 Atoi(const CharType* String) { return ::UEStub::Fake<int32>(); }
    static int64 Atoi64(const CharType* String) { return ::UEStub::Fake<int64>(); }
    static float Atof(const CharType* String) { return ::UEStub::Fake<float>(); }
    static double Atod(const CharType* String) { return ::UEStub::Fake<double>(); }
    static bool ToBool(const CharType* String) { return ::UEStub::Fake<bool>(); }
    static int32 Strtoi(const CharType* Start, CharType** End, int32 Base) { return ::UEStub::Fake<int32>(); }
    static uint64 Strtoui64(const CharType* Start, CharType** End, int32 Base) { return ::UEStub::Fake<uint64>(); }
    static const CharType* Spc(int32 NumSpaces) { return ::UEStub::Fake<const CharType*>(); }
    static const CharType* Tab(int32 NumTabs) { return ::UEStub::Fake<const CharType*>(); }
};
typedef TCString<TCHAR> FCString;
typedef TCString<ANSICHAR> FCStringAnsi;
typedef TCString<WIDECHAR> FCStringWide;

namespace UEStub
{
    struct FAnsiResult { const ANSICHAR* Get() const; int32 Length() const; };
    struct FUtf8Result { const ANSICHAR* Get() const; int32 Length() const; };
    struct FTCharResult { const TCHAR* Get() const; int32 Length() const; };
    FAnsiResult ToAnsi(const TCHAR* Str);
    FUtf8Result ToUtf8(const TCHAR* Str);
    FTCharResult FromAnsi(const ANSICHAR* Str);
    FTCharResult FromUtf8(const ANSICHAR* Str);
    FTCharResult FromUtf8(const UTF8CHAR* Str);
}
template <typename To> struct TStringCastResult { const To* Get() const; int32 Length() const; };
template <typename To, typename From> TStringCastResult<To> StringCast(const From* Str) { return ::UEStub::Fake<TStringCastResult<To>>(); }
template <typename To, typename From> TStringCastResult<To> StringCast(const From* Str, int32 Len) { return ::UEStub::Fake<TStringCastResult<To>>(); }
#define TCHAR_TO_ANSI(str) (ANSICHAR*)::UEStub::ToAnsi(static_cast<const TCHAR*>(str)).Get()
#define TCHAR_TO_UTF8(str) (ANSICHAR*)::UEStub::ToUtf8(static_cast<const TCHAR*>(str)).Get()
#define ANSI_TO_TCHAR(str) (TCHAR*)::UEStub::FromAnsi(static_cast<const ANSICHAR*>(str)).Get()
#define UTF8_TO_TCHAR(str) (TCHAR*)::UEStub::FromUtf8(str).Get()
#define TCHAR_TO_WCHAR(str) str
#define WCHAR_TO_TCHAR(str) str

// ---------------------------------------------------------------- FStringView (minimal)
template <typename CharType>
class TStringView
{
public:
    TStringView() {}
    TStringView(const CharType* InData) {}
    TStringView(const CharType* InData, int32 InSize) {}
    TStringView(const FString& InString) {}
    const CharType* GetData() const { return ::UEStub::Fake<const CharType*>(); }
    int32 Len() const { return ::UEStub::Fake<int32>(); }
    bool IsEmpty() const { return ::UEStub::Fake<bool>(); }
    CharType operator[](int32 Index) const { return ::UEStub::Fake<CharType>(); }
    bool Equals(TStringView Other, ESearchCase::Type SearchCase = ESearchCase::CaseSensitive) const { return ::UEStub::Fake<bool>(); }
    bool StartsWith(TStringView Prefix, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase) const { return ::UEStub::Fake<bool>(); }
    bool EndsWith(TStringView Suffix, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase) const { return ::UEStub::Fake<bool>(); }
    TStringView Left(int32 CharCount) const { return ::UEStub::Fake<TStringView>(); }
    TStringView Right(int32 CharCount) const { return ::UEStub::Fake<TStringView>(); }
    TStringView Mid(int32 Position, int32 CharCount = MAX_int32) const { return ::UEStub::Fake<TStringView>(); }
    const CharType* begin() const { return ::UEStub::Fake<const CharType*>(); }
    const CharType* end() const { return ::UEStub::Fake<const CharType*>(); }
};
typedef TStringView<TCHAR> FStringView;
typedef TStringView<ANSICHAR> FAnsiStringView;
typedef TStringView<UTF8CHAR> FUtf8StringView;

// ---------------------------------------------------------------- FString
struct FStringFormatArg
{
    FStringFormatArg(const int32 Value);
    FStringFormatArg(const uint32 Value);
    FStringFormatArg(const int64 Value);
    FStringFormatArg(const uint64 Value);
    FStringFormatArg(const float Value);
    FStringFormatArg(const double Value);
    FStringFormatArg(FString Value);
    FStringFormatArg(const TCHAR* Value);
    FStringFormatArg(const FStringFormatArg&);
};
typedef TArray<FStringFormatArg> FStringFormatOrderedArguments;
typedef TMap<FString, FStringFormatArg> FStringFormatNamedArguments;

class FString
{
public:
    typedef TCHAR ElementType;
    FString() = default;
    FString(FString&&) = default;
    FString(const FString&) = default;
    FString& operator=(FString&&) = default;
    FString& operator=(const FString&) = default;
    ~FString() = default;
    FString(const TCHAR* Str);
    FString(const ANSICHAR* Str);
    FString(const UTF8CHAR* Str);
    explicit FString(int32 Len, const TCHAR* Str);
    explicit FString(int32 Len, const ANSICHAR* Str);
    explicit FString(const FString& Other, int32 ExtraSlack);
    explicit FString(FStringView View);
    FString& operator=(const TCHAR* Str);

    TCHAR& operator[](int32 Index);
    const TCHAR& operator[](int32 Index) const;
    const TCHAR* operator*() const;
    TArray<TCHAR>& GetCharArray();
    const TArray<TCHAR>& GetCharArray() const;
    void Empty(int32 Slack = 0);
    void Reset(int32 NewReservedSize = 0);
    void Shrink();
    void Reserve(int32 CharacterCount);
    bool IsEmpty() const;
    bool IsValidIndex(int32 Index) const;
    int32 Len() const;
    SIZE_T GetAllocatedSize() const;
    FString& Append(const FString& Text);
    FString& Append(const TCHAR* Text);
    FString& Append(const TCHAR* Text, int32 Count);
    FString& Append(FStringView Text);
    FString& AppendChar(TCHAR InChar);
    FString& AppendChars(const TCHAR* Str, int32 Count);
    void InsertAt(int32 Index, TCHAR Character);
    void InsertAt(int32 Index, const FString& Characters);
    void RemoveAt(int32 Index, int32 Count = 1, EAllowShrinking AllowShrinking = EAllowShrinking::Default);
    bool RemoveFromStart(const TCHAR* InPrefix, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase);
    bool RemoveFromStart(const FString& InPrefix, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase);
    bool RemoveFromEnd(const TCHAR* InSuffix, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase);
    bool RemoveFromEnd(const FString& InSuffix, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase);
    void PathAppend(const TCHAR* Str, int32 StrLength);
    FString& operator+=(const FString& Str);
    FString& operator+=(const TCHAR* Str);
    FString& operator+=(TCHAR InChar);
    FString& operator+=(FStringView Str);
    FString& operator/=(const FString& Str);
    FString& operator/=(const TCHAR* Str);
    friend FString operator+(const FString& Lhs, const FString& Rhs);
    friend FString operator+(FString&& Lhs, const FString& Rhs);
    friend FString operator+(const FString& Lhs, FString&& Rhs);
    friend FString operator+(FString&& Lhs, FString&& Rhs);
    friend FString operator+(const TCHAR* Lhs, const FString& Rhs);
    friend FString operator+(const TCHAR* Lhs, FString&& Rhs);
    friend FString operator+(const FString& Lhs, const TCHAR* Rhs);
    friend FString operator+(FString&& Lhs, const TCHAR* Rhs);
    friend FString operator/(const FString& Lhs, const FString& Rhs);
    friend FString operator/(const FString& Lhs, const TCHAR* Rhs);
    friend bool operator==(const FString& Lhs, const FString& Rhs);
    friend bool operator==(const FString& Lhs, const TCHAR* Rhs);
    friend bool operator==(const TCHAR* Lhs, const FString& Rhs);
    friend bool operator!=(const FString& Lhs, const FString& Rhs);
    friend bool operator!=(const FString& Lhs, const TCHAR* Rhs);
    friend bool operator!=(const TCHAR* Lhs, const FString& Rhs);
    friend bool operator<(const FString& Lhs, const FString& Rhs);
    friend bool operator<(const FString& Lhs, const TCHAR* Rhs);
    friend bool operator<=(const FString& Lhs, const FString& Rhs);
    friend bool operator>(const FString& Lhs, const FString& Rhs);
    friend bool operator>=(const FString& Lhs, const FString& Rhs);

    FString Left(int32 Count) const;
    FString LeftChop(int32 Count) const;
    FString Right(int32 Count) const;
    FString RightChop(int32 Count) const;
    FString Mid(int32 Start, int32 Count = MAX_int32) const;
    void LeftInline(int32 Count, EAllowShrinking AllowShrinking = EAllowShrinking::Default);
    void LeftChopInline(int32 Count, EAllowShrinking AllowShrinking = EAllowShrinking::Default);
    void RightInline(int32 Count, EAllowShrinking AllowShrinking = EAllowShrinking::Default);
    void RightChopInline(int32 Count, EAllowShrinking AllowShrinking = EAllowShrinking::Default);
    void MidInline(int32 Start, int32 Count = MAX_int32, EAllowShrinking AllowShrinking = EAllowShrinking::Default);
    int32 Find(const TCHAR* SubStr, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase, ESearchDir::Type SearchDir = ESearchDir::FromStart, int32 StartPosition = INDEX_NONE) const;
    int32 Find(const FString& SubStr, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase, ESearchDir::Type SearchDir = ESearchDir::FromStart, int32 StartPosition = INDEX_NONE) const;
    bool Contains(const TCHAR* SubStr, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase, ESearchDir::Type SearchDir = ESearchDir::FromStart) const;
    bool Contains(const FString& SubStr, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase, ESearchDir::Type SearchDir = ESearchDir::FromStart) const;
    bool FindChar(TCHAR InChar, int32& Index) const;
    bool FindLastChar(TCHAR InChar, int32& Index) const;
    template <typename Predicate> int32 FindLastCharByPredicate(Predicate Pred, int32 Count) const { (void)static_cast<bool>(Pred(TCHAR())); return INDEX_NONE; }
    template <typename Predicate> int32 FindLastCharByPredicate(Predicate Pred) const { (void)static_cast<bool>(Pred(TCHAR())); return INDEX_NONE; }
    bool Equals(const FString& Other, ESearchCase::Type SearchCase = ESearchCase::CaseSensitive) const;
    int32 Compare(const FString& Other, ESearchCase::Type SearchCase = ESearchCase::CaseSensitive) const;
    bool Split(const FString& InS, FString* LeftS, FString* RightS, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase, ESearchDir::Type SearchDir = ESearchDir::FromStart) const;
    FString ToUpper() const &;
    FString ToUpper() &&;
    void ToUpperInline();
    FString ToLower() const &;
    FString ToLower() &&;
    void ToLowerInline();
    FString LeftPad(int32 ChCount) const;
    FString RightPad(int32 ChCount) const;
    bool IsNumeric() const;
    bool StartsWith(const TCHAR* InPrefix, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase) const;
    bool StartsWith(const FString& InPrefix, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase) const;
    bool EndsWith(const TCHAR* InSuffix, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase) const;
    bool EndsWith(const FString& InSuffix, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase) const;
    bool MatchesWildcard(const FString& Wildcard, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase) const;
    void TrimStartAndEndInline();
    FString TrimStartAndEnd() const &;
    FString TrimStartAndEnd() &&;
    void TrimStartInline();
    FString TrimStart() const &;
    FString TrimStart() &&;
    void TrimEndInline();
    FString TrimEnd() const &;
    FString TrimEnd() &&;
    void TrimToNullTerminator();
    FString TrimQuotes(bool* bQuotesRemoved = nullptr) const;
    int32 CullArray(TArray<FString>* InArray);
    FString Reverse() const;
    void ReverseString();
    FString Replace(const TCHAR* From, const TCHAR* To, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase) const &;
    FString Replace(const TCHAR* From, const TCHAR* To, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase) &&;
    int32 ReplaceInline(const TCHAR* SearchText, const TCHAR* ReplacementText, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase);
    void ReplaceCharInline(const TCHAR SearchChar, const TCHAR ReplacementChar, ESearchCase::Type SearchCase = ESearchCase::IgnoreCase);
    FString ReplaceQuotesWithEscapedQuotes() const &;
    FString ReplaceCharWithEscapedChar(const TArray<const TCHAR*>* Chars = nullptr) const &;
    FString ReplaceEscapedCharWithChar(const TArray<const TCHAR*>* Chars = nullptr) const &;
    FString ConvertTabsToSpaces(const int32 InSpacesPerTab) const;
    int32 ParseIntoArray(TArray<FString>& OutArray, const TCHAR* pchDelim, bool bInCullEmpty = true) const;
    int32 ParseIntoArrayWS(TArray<FString>& OutArray, const TCHAR* pchExtraDelim = nullptr, bool bInCullEmpty = true) const;
    int32 ParseIntoArrayLines(TArray<FString>& OutArray, bool bInCullEmpty = true) const;
    int32 ParseIntoArray(TArray<FString>& OutArray, const TCHAR* const* DelimArray, int32 NumDelims, bool bInCullEmpty = true) const;
    bool ToBool() const;
    TCHAR* begin();
    const TCHAR* begin() const;
    TCHAR* end();
    const TCHAR* end() const;

    template <typename... Types>
    static FString Printf(UEStub::Fmt::TFormatString<std::type_identity_t<Types>...> Fmt, Types... Args);
    template <typename... Types>
    FString& Appendf(UEStub::Fmt::TFormatString<std::type_identity_t<Types>...> Fmt, Types... Args);
    static FString Format(const TCHAR* InFormatString, const FStringFormatNamedArguments& InNamedArguments);
    static FString Format(const TCHAR* InFormatString, const FStringFormatOrderedArguments& InOrderedArguments);
    static FString Chr(TCHAR Ch);
    static FString ChrN(int32 NumCharacters, TCHAR Char);
    static FString FromInt(int32 Num);
    static FString SanitizeFloat(double InFloat, const int32 InMinFractionalDigits = 1);
    static FString FromHexBlob(const uint8* SrcBuffer, const uint32 SrcSize);
    static FString FormatAsNumber(int32 InNumber);
    static FString ConstructFromPtrSize(const TCHAR* Ptr, int32 Size);
    static FString ConcatFStrings(const FString& A, const FString& B);
    template <typename RangeType>
    static FString Join(const RangeType& Range, const TCHAR* Separator) { for (const auto& Elem : Range) { (void)FString(Elem); break; } return FString(); }
    template <typename RangeType, typename ProjectionType>
    static FString JoinBy(const RangeType& Range, const TCHAR* Separator, ProjectionType Proj) { for (const auto& Elem : Range) { (void)FString(Invoke(Proj, Elem)); break; } return FString(); }
};
uint32 GetTypeHash(const FString& S);
FString BytesToHex(const uint8* Bytes, int32 Count);
int32 HexToBytes(const FString& HexString, uint8* OutBytes);
FString BytesToString(const uint8* In, int32 Count);
bool FCharIsWhitespace(TCHAR C);

// Lex helpers
FString LexToString(int32 Value);
FString LexToString(uint32 Value);
FString LexToString(int64 Value);
FString LexToString(uint64 Value);
FString LexToString(float Value);
FString LexToString(double Value);
FString LexToString(bool Value);
FString LexToString(const TCHAR* Value);
FString LexToString(const FString& Value);
FString LexToSanitizedString(float Value);
FString LexToSanitizedString(double Value);
void LexFromString(int32& OutValue, const TCHAR* Buffer);
void LexFromString(uint32& OutValue, const TCHAR* Buffer);
void LexFromString(int64& OutValue, const TCHAR* Buffer);
void LexFromString(float& OutValue, const TCHAR* Buffer);
void LexFromString(double& OutValue, const TCHAR* Buffer);
void LexFromString(bool& OutValue, const TCHAR* Buffer);
void LexFromString(FString& OutValue, const TCHAR* Buffer);
bool LexTryParseString(int32& OutValue, const TCHAR* Buffer);
bool LexTryParseString(float& OutValue, const TCHAR* Buffer);
bool LexTryParseString(double& OutValue, const TCHAR* Buffer);

class FStringBuilderBase
{
public:
    FStringBuilderBase& Append(const TCHAR* Str);
    FStringBuilderBase& Append(const FString& Str);
    FStringBuilderBase& AppendChar(TCHAR Char);
    FStringBuilderBase& operator<<(const TCHAR* Str);
    FStringBuilderBase& operator<<(const FString& Str);
    FStringBuilderBase& operator<<(int32 Value);
    const TCHAR* operator*() const;
    const TCHAR* ToString() const;
    int32 Len() const;
    void Reset();
};
template <int32 BufferSize> class TStringBuilder : public FStringBuilderBase {};

// ---------------------------------------------------------------- FName
enum EName : uint32
{
    NAME_None = 0,
    NAME_ByteProperty, NAME_IntProperty, NAME_BoolProperty, NAME_FloatProperty, NAME_ObjectProperty, NAME_NameProperty,
    NAME_StrProperty, NAME_StructProperty, NAME_Vector, NAME_Rotator, NAME_Color, NAME_Transform, NAME_Actor, NAME_Pawn,
    NAME_Camera, NAME_Default, NAME_Game, NAME_GameNetDriver, NAME_PendingNetDriver, NAME_BeaconNetDriver, NAME_DemoNetDriver,
    NAME_Error, NAME_Log, NAME_Warning, NAME_Cmd, NAME_Init, NAME_Exit, NAME_Tick, NAME_Root, NAME_Main, NAME_Self,
    NAME_MaxHardcodedNameIndex
};
enum class ENameCase : uint8 { CaseSensitive, IgnoreCase };
enum EFindName { FNAME_Find, FNAME_Add };
#define NAME_NO_NUMBER_INTERNAL 0

class FName
{
public:
    FName() = default;
    FName(EName N);
    FName(const WIDECHAR* Name, EFindName FindType = FNAME_Add);
    FName(const ANSICHAR* Name, EFindName FindType = FNAME_Add);
    FName(const UTF8CHAR* Name, EFindName FindType = FNAME_Add);
    FName(int32 Len, const TCHAR* Name, EFindName FindType = FNAME_Add);
    FName(const TCHAR* Name, int32 InNumber, EFindName FindType = FNAME_Add);
    FName(FName Other, int32 InNumber);
    explicit FName(FStringView View, EFindName FindType = FNAME_Add);
    FString ToString() const;
    void ToString(FString& Out) const;
    void AppendString(FString& Out) const;
    FString GetPlainNameString() const;
    int32 GetNumber() const;
    void SetNumber(const int32 NewNumber);
    bool IsNone() const;
    bool IsValid() const;
    bool IsEqual(const FName& Other, const ENameCase CompareMethod = ENameCase::IgnoreCase, const bool bCompareNumber = true) const;
    int32 Compare(const FName& Other) const;
    bool LexicalLess(FName B) const;
    bool FastLess(FName B) const;
    uint32 GetComparisonIndex() const;
    uint32 GetDisplayIndex() const;
    bool operator==(FName Other) const;
    bool operator==(EName Other) const;
    bool operator==(const ANSICHAR* Other) const;
    bool operator==(const WIDECHAR* Other) const;
    static FName FindName(const TCHAR* Name);
    static FString NameToDisplayString(const FString& InDisplayName, const bool bIsBool);
};
uint32 GetTypeHash(FName Name);
FString LexToString(const FName& Name);
void LexFromString(FName& OutValue, const TCHAR* Buffer);
struct FNameLexicalLess { bool operator()(const FName& A, const FName& B) const; };
struct FNameFastLess { bool operator()(const FName& A, const FName& B) const; };

// ---------------------------------------------------------------- FText
struct FNumberFormattingOptions
{
    FNumberFormattingOptions();
    bool AlwaysSign;
    bool UseGrouping;
    int32 MinimumIntegralDigits;
    int32 MaximumIntegralDigits;
    int32 MinimumFractionalDigits;
    int32 MaximumFractionalDigits;
    FNumberFormattingOptions& SetUseGrouping(bool InValue);
    FNumberFormattingOptions& SetMinimumFractionalDigits(int32 InValue);
    FNumberFormattingOptions& SetMaximumFractionalDigits(int32 InValue);
    FNumberFormattingOptions& SetMinimumIntegralDigits(int32 InValue);
    FNumberFormattingOptions& SetMaximumIntegralDigits(int32 InValue);
    static const FNumberFormattingOptions& DefaultWithGrouping();
    static const FNumberFormattingOptions& DefaultNoGrouping();
};
class FTextFormat
{
public:
    FTextFormat();
    FTextFormat(const FText& InText);
};
class FFormatArgumentValue
{
public:
    FFormatArgumentValue();
    FFormatArgumentValue(const int32 Value);
    FFormatArgumentValue(const uint32 Value);
    FFormatArgumentValue(const int64 Value);
    FFormatArgumentValue(const uint64 Value);
    FFormatArgumentValue(const float Value);
    FFormatArgumentValue(const double Value);
    FFormatArgumentValue(const FText& Value);
    FFormatArgumentValue(FText&& Value);
};
typedef TMap<FString, FFormatArgumentValue> FFormatNamedArguments;
typedef TArray<FFormatArgumentValue> FFormatOrderedArguments;
namespace ETextComparisonLevel { enum Type { Default, Primary, Secondary, Tertiary, Quaternary, Quinary }; }

class FText
{
public:
    FText();
    FText(const FText&);
    FText(FText&&);
    FText& operator=(const FText&);
    FText& operator=(FText&&);
    ~FText();
    static const FText& GetEmpty();
    static FText FromString(const FString& String);
    static FText FromString(FString&& String);
    static FText FromName(const FName& Val);
    static FText FromStringView(FStringView InString);
    static FText AsCultureInvariant(const FString& String);
    static FText AsCultureInvariant(FString&& String);
    static FText AsCultureInvariant(FText Text);
    static FText AsNumber(float Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsNumber(double Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsNumber(int8 Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsNumber(int16 Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsNumber(int32 Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsNumber(int64 Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsNumber(uint8 Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsNumber(uint16 Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsNumber(uint32 Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsNumber(uint64 Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsPercent(float Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText AsPercent(double Val, const FNumberFormattingOptions* const Options = nullptr);
    static FText Format(FTextFormat Fmt, const FFormatNamedArguments& InArguments);
    static FText Format(FTextFormat Fmt, const FFormatOrderedArguments& InArguments);
    template <typename... ArgTypes> static FText Format(FTextFormat Fmt, ArgTypes&&... Args)
    { static_assert((std::is_constructible_v<FFormatArgumentValue, ArgTypes&&> && ...), "FText::Format arguments must be convertible to FFormatArgumentValue (numbers or FText)"); return FText(); }
    template <typename... ArgTypes> static FText FormatOrdered(FTextFormat Fmt, ArgTypes&&... Args) { return Format(Fmt, Forward<ArgTypes>(Args)...); }
    static FText Join(const FText& Delimiter, const TArray<FText>& Args);
    const FString& ToString() const;
    FString BuildSourceString() const;
    bool IsEmpty() const;
    bool IsEmptyOrWhitespace() const;
    bool IsNumeric() const;
    bool IsTransient() const;
    bool IsCultureInvariant() const;
    bool IdenticalTo(const FText& Other) const;
    bool EqualTo(const FText& Other, const ETextComparisonLevel::Type ComparisonLevel = ETextComparisonLevel::Default) const;
    bool EqualToCaseIgnored(const FText& Other) const;
    int32 CompareTo(const FText& Other, const ETextComparisonLevel::Type ComparisonLevel = ETextComparisonLevel::Default) const;
    FText ToUpper() const;
    FText ToLower() const;
    static FText TrimPrecedingAndTrailing(const FText& Text);
};
#define LOCTEXT(InKey, InTextLiteral) FText::FromString(FString(TEXT(InTextLiteral)))
#define NSLOCTEXT(InNamespace, InKey, InTextLiteral) FText::FromString(FString(TEXT(InTextLiteral)))
#define INVTEXT(InTextLiteral) FText::AsCultureInvariant(FString(TEXT(InTextLiteral)))
#define FTEXT(str) TEXT(str)
FString LexToString(const FText& Text);

namespace TextBiDi
{
    namespace ETextDirection { enum Type : uint8 { LeftToRight, RightToLeft, Mixed }; }
    class ITextBiDi
    {
    public:
        virtual ~ITextBiDi() = default;
        virtual ETextDirection::Type ComputeTextDirection(const FText& InText) = 0;
        virtual ETextDirection::Type ComputeTextDirection(const FString& InString) = 0;
        virtual ETextDirection::Type ComputeTextDirection(const TCHAR* InString, const int32 InStringStartIndex, const int32 InStringLen) = 0;
    };
    TUniquePtr<ITextBiDi> CreateTextBiDi();
    ETextDirection::Type ComputeTextDirection(const FString& InString);
}
