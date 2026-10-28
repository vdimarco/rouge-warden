// Offline UE 5.x API stub: Misc/CoreDelegates.h
#pragma once
#include "CoreMinimal.h"
class FCoreDelegates
{
public:
    static TMulticastDelegate<void()> OnExit;
    static TMulticastDelegate<void()> OnPreExit;
    static TMulticastDelegate<void()> OnPostEngineInit;
    static TMulticastDelegate<void()> OnFEngineLoopInitComplete;
    static TMulticastDelegate<void()> OnBeginFrame;
    static TMulticastDelegate<void()> OnEndFrame;
    static TMulticastDelegate<void()> ApplicationWillEnterBackgroundDelegate;
    static TMulticastDelegate<void()> ApplicationHasEnteredForegroundDelegate;
    static TMulticastDelegate<void()> ApplicationWillDeactivateDelegate;
    static TMulticastDelegate<void()> ApplicationHasReactivatedDelegate;
    static TMulticastDelegate<void()> ApplicationWillTerminateDelegate;
    static TMulticastDelegate<void(int32)> OnControllerConnectionChange_Deprecated;
};
