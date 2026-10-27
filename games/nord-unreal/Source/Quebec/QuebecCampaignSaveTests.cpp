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

    UQuebecCampaignSaveGame* OldDay = NewObject<UQuebecCampaignSaveGame>();
    OldDay->Version = 9;
    OldDay->CompletedMissions = 2;
    OldDay->PondStep = 6;
    OldDay->CourtStep = 4;
    OldDay->ShowStep = 5;
    OldDay->RescueMask = 7;
    OldDay->ConvoyStep = 4;
    OldDay->BlankStep = 4;
    OldDay->TourStep = 3;
    OldDay->HomeStep = 3;
    OldDay->EscortStep = 2;
    OldDay->ShadeStep = 2;
    OldDay->GrabStep = 2;
    OldDay->CutStep = 2;
    OldDay->ChaseStep = 2;
    OldDay->FinaleStep = 5;
    OldDay->FollowStep = 1;
    TestFalse(TEXT("A version-9 slot carrying the gap is rejected"),OldDay->IsSupported());

    UQuebecCampaignSaveGame* Gap = NewObject<UQuebecCampaignSaveGame>();
    Gap->Version = 10;
    Gap->CompletedMissions = 2;
    Gap->PondStep = 6;
    Gap->CourtStep = 4;
    Gap->ShowStep = 5;
    Gap->RescueMask = 7;
    Gap->ConvoyStep = 4;
    Gap->BlankStep = 4;
    Gap->TourStep = 3;
    Gap->HomeStep = 3;
    Gap->EscortStep = 2;
    Gap->ShadeStep = 2;
    Gap->GrabStep = 2;
    Gap->CutStep = 2;
    Gap->ChaseStep = 2;
    Gap->FinaleStep = 5;
    Gap->FollowStep = 1;
    TestTrue(TEXT("Follow tail is accepted before serialization"),Gap->IsSupported());
    TArray<uint8> GapBytes;
    if (!TestTrue(TEXT("Follow tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Gap,GapBytes))) return false;
    const UQuebecCampaignSaveGame* GapReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(GapBytes));
    if (!TestNotNull(TEXT("Follow tail reloads using engine save format"),GapReload)) return false;
    TestTrue(TEXT("Reloaded follow tail remains supported"),GapReload->IsSupported());
    TestEqual(TEXT("Follow schema survives serialization"),GapReload->Version,10);
    TestEqual(TEXT("Follow step survives serialization"),GapReload->FollowStep,1);
    TestEqual(TEXT("The day stays banked beside the gap"),GapReload->FinaleStep,5);
    Gap->FinaleStep = 1;
    TestFalse(TEXT("A gap before the day is banked is rejected"),Gap->IsSupported());

    UQuebecCampaignSaveGame* OldGap = NewObject<UQuebecCampaignSaveGame>();
    OldGap->Version = 10;
    OldGap->CompletedMissions = 2;
    OldGap->PondStep = 6;
    OldGap->CourtStep = 4;
    OldGap->ShowStep = 5;
    OldGap->RescueMask = 7;
    OldGap->ConvoyStep = 4;
    OldGap->BlankStep = 4;
    OldGap->TourStep = 3;
    OldGap->HomeStep = 3;
    OldGap->EscortStep = 2;
    OldGap->ShadeStep = 2;
    OldGap->GrabStep = 2;
    OldGap->CutStep = 2;
    OldGap->ChaseStep = 2;
    OldGap->FinaleStep = 5;
    OldGap->FollowStep = 2;
    OldGap->RollStep = 1;
    TestFalse(TEXT("A version-10 slot carrying the cart is rejected"),OldGap->IsSupported());

    UQuebecCampaignSaveGame* Cart = NewObject<UQuebecCampaignSaveGame>();
    Cart->Version = 11;
    Cart->CompletedMissions = 2;
    Cart->PondStep = 6;
    Cart->CourtStep = 4;
    Cart->ShowStep = 5;
    Cart->RescueMask = 7;
    Cart->ConvoyStep = 4;
    Cart->BlankStep = 4;
    Cart->TourStep = 3;
    Cart->HomeStep = 3;
    Cart->EscortStep = 2;
    Cart->ShadeStep = 2;
    Cart->GrabStep = 2;
    Cart->CutStep = 2;
    Cart->ChaseStep = 2;
    Cart->FinaleStep = 5;
    Cart->FollowStep = 2;
    Cart->RollStep = 1;
    TestTrue(TEXT("Cart tail is accepted before serialization"),Cart->IsSupported());
    TArray<uint8> CartBytes;
    if (!TestTrue(TEXT("Cart tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Cart,CartBytes))) return false;
    const UQuebecCampaignSaveGame* CartReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(CartBytes));
    if (!TestNotNull(TEXT("Cart tail reloads using engine save format"),CartReload)) return false;
    TestTrue(TEXT("Reloaded cart tail remains supported"),CartReload->IsSupported());
    TestEqual(TEXT("Cart schema survives serialization"),CartReload->Version,11);
    TestEqual(TEXT("Cart step survives serialization"),CartReload->RollStep,1);
    TestEqual(TEXT("The gap stays banked beside the cart"),CartReload->FollowStep,2);
    Cart->FollowStep = 1;
    TestFalse(TEXT("A cart before the gap is banked is rejected"),Cart->IsSupported());

    UQuebecCampaignSaveGame* OldCart = NewObject<UQuebecCampaignSaveGame>();
    OldCart->Version = 11;
    OldCart->CompletedMissions = 2;
    OldCart->PondStep = 6;
    OldCart->CourtStep = 4;
    OldCart->ShowStep = 5;
    OldCart->RescueMask = 7;
    OldCart->ConvoyStep = 4;
    OldCart->BlankStep = 4;
    OldCart->TourStep = 3;
    OldCart->HomeStep = 3;
    OldCart->EscortStep = 2;
    OldCart->ShadeStep = 2;
    OldCart->GrabStep = 2;
    OldCart->CutStep = 2;
    OldCart->ChaseStep = 2;
    OldCart->FinaleStep = 5;
    OldCart->FollowStep = 2;
    OldCart->RollStep = 2;
    OldCart->BellStep = 1;
    TestFalse(TEXT("A version-11 slot carrying the bells is rejected"),OldCart->IsSupported());

    UQuebecCampaignSaveGame* Bells = NewObject<UQuebecCampaignSaveGame>();
    Bells->Version = 12;
    Bells->CompletedMissions = 2;
    Bells->PondStep = 6;
    Bells->CourtStep = 4;
    Bells->ShowStep = 5;
    Bells->RescueMask = 7;
    Bells->ConvoyStep = 4;
    Bells->BlankStep = 4;
    Bells->TourStep = 3;
    Bells->HomeStep = 3;
    Bells->EscortStep = 2;
    Bells->ShadeStep = 2;
    Bells->GrabStep = 2;
    Bells->CutStep = 2;
    Bells->ChaseStep = 2;
    Bells->FinaleStep = 5;
    Bells->FollowStep = 2;
    Bells->RollStep = 2;
    Bells->BellStep = 1;
    TestTrue(TEXT("Bell tail is accepted before serialization"),Bells->IsSupported());
    TArray<uint8> BellBytes;
    if (!TestTrue(TEXT("Bell tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Bells,BellBytes))) return false;
    const UQuebecCampaignSaveGame* BellReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(BellBytes));
    if (!TestNotNull(TEXT("Bell tail reloads using engine save format"),BellReload)) return false;
    TestTrue(TEXT("Reloaded bell tail remains supported"),BellReload->IsSupported());
    TestEqual(TEXT("Bell schema survives serialization"),BellReload->Version,12);
    TestEqual(TEXT("Bell step survives serialization"),BellReload->BellStep,1);
    TestEqual(TEXT("The cart stays banked beside the bells"),BellReload->RollStep,2);
    Bells->RollStep = 1;
    TestFalse(TEXT("Bells before the cart is banked are rejected"),Bells->IsSupported());

    UQuebecCampaignSaveGame* OldBells = NewObject<UQuebecCampaignSaveGame>();
    OldBells->Version = 12;
    OldBells->CompletedMissions = 2;
    OldBells->PondStep = 6;
    OldBells->CourtStep = 4;
    OldBells->ShowStep = 5;
    OldBells->RescueMask = 7;
    OldBells->ConvoyStep = 4;
    OldBells->BlankStep = 4;
    OldBells->TourStep = 3;
    OldBells->HomeStep = 3;
    OldBells->EscortStep = 2;
    OldBells->ShadeStep = 2;
    OldBells->GrabStep = 2;
    OldBells->CutStep = 2;
    OldBells->ChaseStep = 2;
    OldBells->FinaleStep = 5;
    OldBells->FollowStep = 2;
    OldBells->RollStep = 2;
    OldBells->BellStep = 3;
    OldBells->BlockStep = 1;
    TestFalse(TEXT("A version-12 slot carrying the block is rejected"),OldBells->IsSupported());

    UQuebecCampaignSaveGame* Road = NewObject<UQuebecCampaignSaveGame>();
    Road->Version = 13;
    Road->CompletedMissions = 2;
    Road->PondStep = 6;
    Road->CourtStep = 4;
    Road->ShowStep = 5;
    Road->RescueMask = 7;
    Road->ConvoyStep = 4;
    Road->BlankStep = 4;
    Road->TourStep = 3;
    Road->HomeStep = 3;
    Road->EscortStep = 2;
    Road->ShadeStep = 2;
    Road->GrabStep = 2;
    Road->CutStep = 2;
    Road->ChaseStep = 2;
    Road->FinaleStep = 5;
    Road->FollowStep = 2;
    Road->RollStep = 2;
    Road->BellStep = 3;
    Road->BlockStep = 1;
    TestTrue(TEXT("Block tail is accepted before serialization"),Road->IsSupported());
    TArray<uint8> RoadBytes;
    if (!TestTrue(TEXT("Block tail serializes using engine save format"),UGameplayStatics::SaveGameToMemory(Road,RoadBytes))) return false;
    const UQuebecCampaignSaveGame* RoadReload = Cast<UQuebecCampaignSaveGame>(UGameplayStatics::LoadGameFromMemory(RoadBytes));
    if (!TestNotNull(TEXT("Block tail reloads using engine save format"),RoadReload)) return false;
    TestTrue(TEXT("Reloaded block tail remains supported"),RoadReload->IsSupported());
    TestEqual(TEXT("Block schema survives serialization"),RoadReload->Version,13);
    TestEqual(TEXT("Block step survives serialization"),RoadReload->BlockStep,1);
    TestEqual(TEXT("The bells stay banked beside the block"),RoadReload->BellStep,3);
    Road->BellStep = 1;
    TestFalse(TEXT("A block before the bells are banked is rejected"),Road->IsSupported());

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
