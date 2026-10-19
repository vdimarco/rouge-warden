// Offline UE 5.x API stub: UObject/ConstructorHelpers.h
#pragma once
#include "UEStub/UObjectCore.h"
struct ConstructorHelpers
{
    template <class T>
    struct FObjectFinder
    {
        TObjectPtr<T> Object;
        FObjectFinder(const TCHAR* ObjectToFind, uint32 InLoadFlags = LOAD_None) { (void)&T::StaticClass; }
        bool Succeeded() const;
    };
    template <class T>
    struct FObjectFinderOptional
    {
        FObjectFinderOptional(const TCHAR* InObjectToFind, uint32 InLoadFlags = LOAD_None) { (void)&T::StaticClass; }
        T* Get();
        bool Succeeded();
    };
    template <class T>
    struct FClassFinder
    {
        TSubclassOf<T> Class;
        FClassFinder(const TCHAR* ClassToFind) { (void)&T::StaticClass; }
        bool Succeeded();
    };
    static void StripObjectClass(FString& PathName, bool bAssertOnBadPath = false);
};
