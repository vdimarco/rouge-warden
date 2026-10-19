// Offline UE 5.x API stub: Misc/PackageName.h
#pragma once
#include "CoreMinimal.h"
class FPackageName
{
public:
    static FString GetShortName(const FString& LongName);
    static FString GetShortName(const TCHAR* LongName);
    static FName GetShortFName(const FString& LongName);
    static FString GetLongPackagePath(const FString& InLongPackageName);
    static FString GetLongPackageAssetName(const FString& InLongPackageName);
    static bool DoesPackageExist(const FString& LongPackageName, FString* OutFilename = nullptr, bool InAllowTextFormats = true);
    static bool IsValidLongPackageName(FStringView InLongPackageName, bool bIncludeReadOnlyRoots = false, FText* OutReason = nullptr);
    static bool IsShortPackageName(FStringView PossiblyLongName);
    static FString ObjectPathToPackageName(const FString& InObjectPath);
    static FString ObjectPathToObjectName(const FString& InObjectPath);
    static FString FilenameToLongPackageName(const FString& InFilename);
    static FString LongPackageNameToFilename(const FString& InLongPackageName, const FString& InExtension = TEXT(""));
    static bool TryConvertFilenameToLongPackageName(const FString& InFilename, FString& OutPackageName, FString* OutFailureReason = nullptr);
    static FString GetAssetPackageExtension();
    static FString GetMapPackageExtension();
};
