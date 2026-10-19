// Offline UE 5.x API stub: Misc/Parse.h
#pragma once
#include "CoreMinimal.h"
struct FParse
{
    static bool Value(const TCHAR* Stream, const TCHAR* Match, FName& Name);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, uint32& Value);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, struct FGuid& Guid);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, uint8& Value);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, int8& Value);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, uint16& Value);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, int16& Value);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, float& Value);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, double& Value);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, int32& Value);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, TCHAR* Value, int32 MaxLen, bool bShouldStopOnSeparator = true, const TCHAR** OptStreamGotTo = nullptr);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, FString& Value, bool bShouldStopOnSeparator = true, const TCHAR** OptStreamGotTo = nullptr);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, FText& Value, const TCHAR* Namespace = nullptr);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, uint64& Value);
    static bool Value(const TCHAR* Stream, const TCHAR* Match, int64& Value);
    static bool Bool(const TCHAR* Stream, const TCHAR* Match, bool& OnOff);
    static bool Param(const TCHAR* Stream, const TCHAR* Param);
    static bool Command(const TCHAR** Stream, const TCHAR* Match, bool bParseMightTriggerExecution = true);
    static bool Token(const TCHAR*& Str, FString& Arg, bool UseEscape);
    static bool Line(const TCHAR** Stream, FString& Result, bool Exact = false);
    static bool Expression(const TCHAR* Str, float& Value);
    static uint32 HexNumber(const TCHAR* HexString);
};
