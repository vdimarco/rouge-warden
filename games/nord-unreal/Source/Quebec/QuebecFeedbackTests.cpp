#include "QuebecCampaign.h"
#include "QuebecGameplay.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Engine/World.h"
#include "Misc/AutomationTest.h"
#include "Sound/SoundWave.h"
#include <limits>

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecRaceResultTest, "Quebec.Feedback.RaceResults",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecRaceResultTest::RunTest(const FString& Parameters)
{
    UWorld::InitializationValues Initialization;
    Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true,
        ERHIFeatureLevel::Num, &Initialization);
    if (!TestNotNull(TEXT("Isolated race world"), World)) return false;
    AQuebecCampaign* Race = World->SpawnActor<AQuebecCampaign>();
    if (!Race) { World->DestroyWorld(false); return false; }
    TestEqual(TEXT("Reloaded completion invents no lap result"), Race->LastRaceTime, 0.f);
    Race->RaceElapsed = 75.f;
    Race->RecordRaceResult();
    TestEqual(TEXT("First clean result"), Race->LastRaceTime, 75.f);
    TestEqual(TEXT("First clean lap establishes best"), Race->BestCleanRaceTime, 75.f);
    Race->RaceElapsed = 80.f;
    Race->RecordRaceResult();
    TestEqual(TEXT("Slower replay still records its result"), Race->LastRaceTime, 80.f);
    TestEqual(TEXT("Slower replay preserves best"), Race->BestCleanRaceTime, 75.f);
    Race->RaceElapsed = 60.f;
    Race->RecordRaceResult();
    TestEqual(TEXT("Faster clean replay improves best"), Race->BestCleanRaceTime, 60.f);
    Race->bRaceRetried = true;
    Race->RaceElapsed = 10.f;
    Race->RecordRaceResult();
    TestTrue(TEXT("Recovered lap is labelled"), Race->bLastRaceRetried);
    TestEqual(TEXT("Checkpoint recovery cannot improve clean best"), Race->BestCleanRaceTime, 60.f);
    for (float Invalid : {0.f, -1.f, Race->RaceTimeLimit + 1.f, std::numeric_limits<float>::infinity(), std::numeric_limits<float>::quiet_NaN()})
    {
        Race->RaceElapsed = Invalid;
        Race->RecordRaceResult();
        TestEqual(TEXT("Invalid or timed-out elapsed preserves last valid result"), Race->LastRaceTime, 10.f);
    }
    Race->Phase = EQuebecCampaignPhase::Complete;
    Race->PondStep = 0;
    TestTrue(TEXT("An open pond step names recover instead of the lap card"),
        Race->GetStatusText().Contains(TEXT("R recovers this step")));
    Race->PondStep = AQuebecCampaign::PondBankedStep;
    const FString Status = Race->GetStatusText();
    TestTrue(TEXT("Result presents recovered time and clean session best"),
        Status.Contains(TEXT("10.0s")) && Status.Contains(TEXT("recovered")) && Status.Contains(TEXT("60.0s")));
    World->DestroyWorld(false);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecFeedbackAssetsTest, "Quebec.Feedback.SoundAssets",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecFeedbackAssetsTest::RunTest(const FString& Parameters)
{
    const AQuebecController* Controller = GetDefault<AQuebecController>();
    TestEqual(TEXT("All semantic cues are hard referenced for cooking"), Controller->FeedbackSounds.Num(), 3);
    const TCHAR* Names[] = {TEXT("Checkpoint"), TEXT("Complete"), TEXT("Dialogue")};
    for (int32 Index = 0; Index < Controller->FeedbackSounds.Num(); ++Index)
    {
        const USoundWave* Sound = Cast<USoundWave>(Controller->FeedbackSounds[Index]);
        if (!TestNotNull(Names[Index], Sound)) continue;
        TestEqual(TEXT("Cue package is the original feedback asset"), Sound->GetPathName(),
            FString::Printf(TEXT("/Game/Audio/Feedback/%s.%s"), Names[Index], Names[Index]));
        TestTrue(TEXT("Feedback is a bounded one-shot"), !Sound->bLooping && Sound->Duration > 0.f && Sound->Duration < 1.f);
    }
    return true;
}
#endif
