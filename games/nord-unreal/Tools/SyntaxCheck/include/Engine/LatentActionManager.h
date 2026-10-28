// Offline UE 5.x API stub: Engine/LatentActionManager.h
#pragma once
#include "UEStub/UObjectCore.h"
struct FLatentActionInfo
{
    int32 Linkage;
    int32 UUID;
    FName ExecutionFunction;
    TObjectPtr<UObject> CallbackTarget;
    FLatentActionInfo();
    FLatentActionInfo(int32 InLinkage, int32 InUUID, const TCHAR* InFunctionName, UObject* InCallbackTarget);
};
class FPendingLatentAction
{
public:
    virtual ~FPendingLatentAction() {}
    virtual void UpdateOperation(class FLatentResponse& Response);
    virtual void NotifyObjectDestroyed();
    virtual void NotifyActionAborted();
};
struct FLatentActionManager
{
    template <typename ActionType> ActionType* FindExistingAction(UObject* InActionObject, int32 UUID);
    void AddNewAction(UObject* InActionObject, int32 UUID, FPendingLatentAction* NewAction);
    void RemoveActionsForObject(TWeakObjectPtr<UObject> InObject);
    int32 GetNumActionsForObject(TWeakObjectPtr<UObject> InObject);
};
