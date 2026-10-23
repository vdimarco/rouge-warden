#include "QuebecCampaign.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Kismet/GameplayStatics.h"
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCampaignSaveValidationTest,
    "Quebec.Campaign.SaveValidation", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FQuebecCampaignSaveValidationTest::RunTest(const FString& Parameters)
{
    // Invalid constructor sentinels prevent a missing/defaulted property payload
    // from being mistaken for a supported, empty campaign save.
    UQuebecCampaignSaveGame* Save = NewObject<UQuebecCampaignSaveGame>();
    TestFalse(TEXT("Uninitialized save is rejected"),Save->IsSupported());
    TArray<uint8> DefaultBytes;
    if (!TestTrue(TEXT("Default object can be serialized in memory"),UGameplayStatics::SaveGameToMemory(Save,DefaultBytes))) return false;
    UQuebecCampaignSaveGame* DefaultReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(DefaultBytes));
    if (!TestNotNull(TEXT("Default payload reloads without touching a slot"),DefaultReload)) return false;
    TestFalse(TEXT("Reloaded default payload stays invalid"),DefaultReload->IsSupported());

    Save->Version = 1;
    for (int32 Progress : {-1,3,MAX_int32})
    {
        Save->CompletedMissions = Progress;
        TestFalse(*FString::Printf(TEXT("Out-of-range progress %d is rejected"),Progress),Save->IsSupported());
    }
    Save->CompletedMissions = 1;
    for (int32 Version : {0,2,MAX_int32})
    {
        Save->Version = Version;
        TestFalse(*FString::Printf(TEXT("Unsupported schema %d is rejected"),Version),Save->IsSupported());
    }
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecCampaignSaveRoundTripTest,
    "Quebec.Campaign.SaveRoundTrip", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FQuebecCampaignSaveRoundTripTest::RunTest(const FString& Parameters)
{
    for (int32 Boundary : {0,1,2})
    {
        UQuebecCampaignSaveGame* Save = NewObject<UQuebecCampaignSaveGame>();
        Save->Version = 1;
        Save->CompletedMissions = Boundary;
        TestTrue(TEXT("Supported boundary is accepted before serialization"),Save->IsSupported());
        TArray<uint8> Bytes;
        if (!TestTrue(TEXT("Boundary serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Save,Bytes))) return false;
        const UQuebecCampaignSaveGame* Reload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(Bytes));
        if (!TestNotNull(TEXT("Boundary reloads using engine save format"),Reload)) return false;
        TestTrue(TEXT("Reloaded boundary remains supported"),Reload->IsSupported());
        TestEqual(TEXT("Schema survives serialization"),Reload->Version,1);
        TestEqual(*FString::Printf(TEXT("Mission boundary %d survives serialization"),Boundary),Reload->CompletedMissions,Boundary);
    }
    UQuebecCampaignSaveGame* Future = NewObject<UQuebecCampaignSaveGame>();
    Future->Version = 2;
    Future->CompletedMissions = 1;
    TArray<uint8> UnsupportedBytes;
    if (!TestTrue(TEXT("Future schema fixture serializes"),UGameplayStatics::SaveGameToMemory(Future,UnsupportedBytes))) return false;
    const UQuebecCampaignSaveGame* Reload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(UnsupportedBytes));
    if (!TestNotNull(TEXT("Future schema fixture reloads"),Reload)) return false;
    TestFalse(TEXT("Future schema remains rejected after engine roundtrip"),Reload->IsSupported());
    TestEqual(TEXT("Validation preserves unsupported version"),Reload->Version,2);
    TestEqual(TEXT("Validation preserves unsupported progress"),Reload->CompletedMissions,1);

    UQuebecCampaignSaveGame* Tail = NewObject<UQuebecCampaignSaveGame>();
    Tail->Version = 3;
    Tail->CompletedMissions = 2;
    Tail->PondStep = 6;
    Tail->CourtStep = 2;
    TestTrue(TEXT("Story tail is accepted before serialization"),Tail->IsSupported());
    TArray<uint8> TailBytes;
    if (!TestTrue(TEXT("Story tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Tail,TailBytes))) return false;
    const UQuebecCampaignSaveGame* TailReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(TailBytes));
    if (!TestNotNull(TEXT("Story tail reloads using engine save format"),TailReload)) return false;
    TestTrue(TEXT("Reloaded story tail remains supported"),TailReload->IsSupported());
    TestEqual(TEXT("Story schema survives serialization"),TailReload->Version,3);
    TestEqual(TEXT("Story tail keeps the race boundary"),TailReload->CompletedMissions,2);
    TestEqual(TEXT("Pond step survives serialization"),TailReload->PondStep,6);
    TestEqual(TEXT("Court step survives serialization"),TailReload->CourtStep,2);
    TestEqual(TEXT("Later beats stay at their start"),TailReload->HomeStep,0);
    TestEqual(TEXT("A version-3 tail starts the escort over"),TailReload->EscortStep,0);
    Tail->EscortStep = 1;
    TestFalse(TEXT("A version-3 slot carrying the walk is rejected"),Tail->IsSupported());

    UQuebecCampaignSaveGame* Walk = NewObject<UQuebecCampaignSaveGame>();
    Walk->Version = 4;
    Walk->CompletedMissions = 2;
    Walk->PondStep = 6;
    Walk->CourtStep = 4;
    Walk->ShowStep = 5;
    Walk->RescueMask = 7;
    Walk->ConvoyStep = 4;
    Walk->BlankStep = 4;
    Walk->TourStep = 3;
    Walk->HomeStep = 3;
    Walk->EscortStep = 1;
    TestTrue(TEXT("Escort tail is accepted before serialization"),Walk->IsSupported());
    TArray<uint8> WalkBytes;
    if (!TestTrue(TEXT("Escort tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Walk,WalkBytes))) return false;
    const UQuebecCampaignSaveGame* WalkReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(WalkBytes));
    if (!TestNotNull(TEXT("Escort tail reloads using engine save format"),WalkReload)) return false;
    TestTrue(TEXT("Reloaded escort tail remains supported"),WalkReload->IsSupported());
    TestEqual(TEXT("Escort schema survives serialization"),WalkReload->Version,4);
    TestEqual(TEXT("Escort step survives serialization"),WalkReload->EscortStep,1);
    TestEqual(TEXT("The home day stays banked beside the walk"),WalkReload->HomeStep,3);
    TestEqual(TEXT("A version-4 tail starts the crossing over"),WalkReload->ShadeStep,0);
    Walk->ShadeStep = 1;
    TestFalse(TEXT("A version-4 slot carrying the crossing is rejected"),Walk->IsSupported());
    Walk->HomeStep = 0;
    Walk->ShadeStep = 0;
    TestFalse(TEXT("A walk before the day is home is rejected"),Walk->IsSupported());

    UQuebecCampaignSaveGame* Dark = NewObject<UQuebecCampaignSaveGame>();
    Dark->Version = 5;
    Dark->CompletedMissions = 2;
    Dark->PondStep = 6;
    Dark->CourtStep = 4;
    Dark->ShowStep = 5;
    Dark->RescueMask = 7;
    Dark->ConvoyStep = 4;
    Dark->BlankStep = 4;
    Dark->TourStep = 3;
    Dark->HomeStep = 3;
    Dark->EscortStep = 2;
    Dark->ShadeStep = 1;
    TestTrue(TEXT("Crossing tail is accepted before serialization"),Dark->IsSupported());
    TArray<uint8> DarkBytes;
    if (!TestTrue(TEXT("Crossing tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Dark,DarkBytes))) return false;
    const UQuebecCampaignSaveGame* DarkReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(DarkBytes));
    if (!TestNotNull(TEXT("Crossing tail reloads using engine save format"),DarkReload)) return false;
    TestTrue(TEXT("Reloaded crossing tail remains supported"),DarkReload->IsSupported());
    TestEqual(TEXT("Crossing schema survives serialization"),DarkReload->Version,5);
    TestEqual(TEXT("Crossing step survives serialization"),DarkReload->ShadeStep,1);
    TestEqual(TEXT("The walk stays banked beside the crossing"),DarkReload->EscortStep,2);
    TestEqual(TEXT("A version-5 tail starts the grab over"),DarkReload->GrabStep,0);
    Dark->GrabStep = 1;
    TestFalse(TEXT("A version-5 slot carrying the grab is rejected"),Dark->IsSupported());
    Dark->EscortStep = 0;
    Dark->GrabStep = 0;
    TestFalse(TEXT("A crossing before the walk is banked is rejected"),Dark->IsSupported());

    UQuebecCampaignSaveGame* Held = NewObject<UQuebecCampaignSaveGame>();
    Held->Version = 6;
    Held->CompletedMissions = 2;
    Held->PondStep = 6;
    Held->CourtStep = 4;
    Held->ShowStep = 5;
    Held->RescueMask = 7;
    Held->ConvoyStep = 4;
    Held->BlankStep = 4;
    Held->TourStep = 3;
    Held->HomeStep = 3;
    Held->EscortStep = 2;
    Held->ShadeStep = 2;
    Held->GrabStep = 1;
    TestTrue(TEXT("Grab tail is accepted before serialization"),Held->IsSupported());
    TArray<uint8> HeldBytes;
    if (!TestTrue(TEXT("Grab tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Held,HeldBytes))) return false;
    const UQuebecCampaignSaveGame* HeldReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(HeldBytes));
    if (!TestNotNull(TEXT("Grab tail reloads using engine save format"),HeldReload)) return false;
    TestTrue(TEXT("Reloaded grab tail remains supported"),HeldReload->IsSupported());
    TestEqual(TEXT("Grab schema survives serialization"),HeldReload->Version,6);
    TestEqual(TEXT("Grab step survives serialization"),HeldReload->GrabStep,1);
    TestEqual(TEXT("The crossing stays banked beside the grab"),HeldReload->ShadeStep,2);
    Held->ShadeStep = 0;
    TestFalse(TEXT("A grab before the crossing is banked is rejected"),Held->IsSupported());
    Held->ShadeStep = 2;
    Held->CutStep = 1;
    TestFalse(TEXT("A version-6 slot carrying the short way is rejected"),Held->IsSupported());
    Held->CutStep = 0;

    UQuebecCampaignSaveGame* Dared = NewObject<UQuebecCampaignSaveGame>();
    Dared->Version = 7;
    Dared->CompletedMissions = 2;
    Dared->PondStep = 6;
    Dared->CourtStep = 4;
    Dared->ShowStep = 5;
    Dared->RescueMask = 7;
    Dared->ConvoyStep = 4;
    Dared->BlankStep = 4;
    Dared->TourStep = 3;
    Dared->HomeStep = 3;
    Dared->EscortStep = 2;
    Dared->ShadeStep = 2;
    Dared->GrabStep = 2;
    Dared->CutStep = 1;
    TestTrue(TEXT("Short-way tail is accepted before serialization"),Dared->IsSupported());
    TArray<uint8> DaredBytes;
    if (!TestTrue(TEXT("Short-way tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Dared,DaredBytes))) return false;
    const UQuebecCampaignSaveGame* DaredReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(DaredBytes));
    if (!TestNotNull(TEXT("Short-way tail reloads using engine save format"),DaredReload)) return false;
    TestTrue(TEXT("Reloaded short-way tail remains supported"),DaredReload->IsSupported());
    TestEqual(TEXT("Short-way schema survives serialization"),DaredReload->Version,7);
    TestEqual(TEXT("Short-way step survives serialization"),DaredReload->CutStep,1);
    TestEqual(TEXT("The grab stays banked beside the short way"),DaredReload->GrabStep,2);
    Dared->GrabStep = 0;
    TestFalse(TEXT("A short way before the grab is banked is rejected"),Dared->IsSupported());
    Dared->GrabStep = 2;
    Dared->ChaseStep = 1;
    TestFalse(TEXT("A version-7 slot carrying the chase is rejected"),Dared->IsSupported());
    Dared->ChaseStep = 0;

    UQuebecCampaignSaveGame* Tailed = NewObject<UQuebecCampaignSaveGame>();
    Tailed->Version = 8;
    Tailed->CompletedMissions = 2;
    Tailed->PondStep = 6;
    Tailed->CourtStep = 4;
    Tailed->ShowStep = 5;
    Tailed->RescueMask = 7;
    Tailed->ConvoyStep = 4;
    Tailed->BlankStep = 4;
    Tailed->TourStep = 3;
    Tailed->HomeStep = 3;
    Tailed->EscortStep = 2;
    Tailed->ShadeStep = 2;
    Tailed->GrabStep = 2;
    Tailed->CutStep = 2;
    Tailed->ChaseStep = 1;
    TestTrue(TEXT("Chase tail is accepted before serialization"),Tailed->IsSupported());
    TArray<uint8> TailedBytes;
    if (!TestTrue(TEXT("Chase tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Tailed,TailedBytes))) return false;
    const UQuebecCampaignSaveGame* TailedReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(TailedBytes));
    if (!TestNotNull(TEXT("Chase tail reloads using engine save format"),TailedReload)) return false;
    TestTrue(TEXT("Reloaded chase tail remains supported"),TailedReload->IsSupported());
    TestEqual(TEXT("Chase schema survives serialization"),TailedReload->Version,8);
    TestEqual(TEXT("Chase step survives serialization"),TailedReload->ChaseStep,1);
    TestEqual(TEXT("The short way stays banked beside the chase"),TailedReload->CutStep,2);
    Tailed->FinaleStep = 1;
    TestFalse(TEXT("A version-8 slot carrying the day is rejected"),Tailed->IsSupported());
    Tailed->FinaleStep = 0;
    Tailed->CutStep = 0;
    TestFalse(TEXT("A chase before the short way is banked is rejected"),Tailed->IsSupported());

    UQuebecCampaignSaveGame* Once = NewObject<UQuebecCampaignSaveGame>();
    Once->Version = 9;
    Once->CompletedMissions = 2;
    Once->PondStep = 6;
    Once->CourtStep = 4;
    Once->ShowStep = 5;
    Once->RescueMask = 7;
    Once->ConvoyStep = 4;
    Once->BlankStep = 4;
    Once->TourStep = 3;
    Once->HomeStep = 3;
    Once->EscortStep = 2;
    Once->ShadeStep = 2;
    Once->GrabStep = 2;
    Once->CutStep = 2;
    Once->ChaseStep = 2;
    Once->FinaleStep = 3;
    TestTrue(TEXT("Finale tail is accepted before serialization"),Once->IsSupported());
    TArray<uint8> OnceBytes;
    if (!TestTrue(TEXT("Finale tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Once,OnceBytes))) return false;
    const UQuebecCampaignSaveGame* OnceReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(OnceBytes));
    if (!TestNotNull(TEXT("Finale tail reloads using engine save format"),OnceReload)) return false;
    TestTrue(TEXT("Reloaded finale tail remains supported"),OnceReload->IsSupported());
    TestEqual(TEXT("Finale schema survives serialization"),OnceReload->Version,9);
    TestEqual(TEXT("Finale step survives serialization"),OnceReload->FinaleStep,3);
    TestEqual(TEXT("The chase stays banked beside the day"),OnceReload->ChaseStep,2);
    Once->ChaseStep = 1;
    TestFalse(TEXT("A day before the chase is banked is rejected"),Once->IsSupported());

    UQuebecCampaignSaveGame* Skip = NewObject<UQuebecCampaignSaveGame>();
    Skip->Version = 3;
    Skip->CompletedMissions = 2;
    Skip->PondStep = 2;
    Skip->CourtStep = 1;
    TestFalse(TEXT("A skipped beat is rejected"),Skip->IsSupported());
    Skip->CourtStep = 0;
    Skip->CompletedMissions = 1;
    Skip->PondStep = 1;
    TestFalse(TEXT("Story progress before the race is rejected"),Skip->IsSupported());
    Skip->Version = 1;
    Skip->CompletedMissions = 2;
    Skip->PondStep = 4;
    TestFalse(TEXT("A legacy slot carrying a pond step is rejected"),Skip->IsSupported());
    // This deliberately never writes a disk slot; on-disk preservation and
    // mission-boundary restart behavior are exercised by StorySlice integration QA.
    return true;
}
#endif
