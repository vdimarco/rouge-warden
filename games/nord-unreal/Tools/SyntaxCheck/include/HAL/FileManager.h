// Offline UE 5.x API stub: HAL/FileManager.h (Core). Only the directory and file queries game code is likely to use.
#pragma once
#include "CoreMinimal.h"
class IFileManager
{
public:
    virtual ~IFileManager();
    static IFileManager& Get();
    virtual bool MakeDirectory(const TCHAR* Path, bool Tree = false) = 0;
    virtual bool DeleteDirectory(const TCHAR* Path, bool RequireExists = false, bool Tree = false) = 0;
    virtual bool DirectoryExists(const TCHAR* InDirectory) = 0;
    virtual bool FileExists(const TCHAR* Filename) = 0;
    virtual int64 FileSize(const TCHAR* Filename) = 0;
    virtual bool Delete(const TCHAR* Filename, bool RequireExists = false, bool EvenReadOnly = false, bool Quiet = false) = 0;
    virtual bool Move(const TCHAR* Dest, const TCHAR* Src, bool Replace = true, bool EvenIfReadOnly = false, bool Attributes = false, bool bDoNotRetryOrError = false) = 0;
    virtual void FindFiles(TArray<FString>& FileNames, const TCHAR* Filename, bool Files, bool Directories) = 0;
    virtual void FindFilesRecursive(TArray<FString>& FileNames, const TCHAR* StartDirectory, const TCHAR* Filename, bool Files, bool Directories, bool bClearFileNames = true) = 0;
};
