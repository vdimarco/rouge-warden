// Offline UE 5.x API stub: Misc/CommandLine.h
#pragma once
#include "CoreMinimal.h"
struct FCommandLine
{
    static const TCHAR* Get();
    static const TCHAR* GetForLogging();
    static const TCHAR* GetOriginal();
    static bool IsInitialized();
    static bool Set(const TCHAR* NewCommandLine);
    static void Append(const TCHAR* AppendString);
    static void AddToSubprocessCommandline(const TCHAR* Param);
    static const FString& GetSubprocessCommandline();
    static const TCHAR* RemoveExeName(const TCHAR* CmdLine);
    static void Parse(const TCHAR* CmdLine, TArray<FString>& Tokens, TArray<FString>& Switches);
};
