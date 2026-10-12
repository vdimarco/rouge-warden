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
    // This deliberately never writes a disk slot; on-disk preservation and
    // mission-boundary restart behavior are exercised by StorySlice integration QA.
    return true;
}
#endif
