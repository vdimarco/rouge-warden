#include "QuebecGameplay.h"

#if WITH_DEV_AUTOMATION_TESTS
#include "Components/AudioComponent.h"
#include "Engine/World.h"
#include "Misc/AutomationTest.h"
#include "Misc/ScopeExit.h"
#include "Sound/SoundWave.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecMusicAssetsTest, "Quebec.Music.Assets",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecMusicAssetsTest::RunTest(const FString& Parameters)
{
    const AQuebecController* Controller = GetDefault<AQuebecController>();
    const USoundWave* Neighborhood = Cast<USoundWave>(Controller->NeighborhoodMusic);
    const USoundWave* Race = Cast<USoundWave>(Controller->RaceMusic);
    if (!TestNotNull(TEXT("Hard neighborhood reference for cooking"), Neighborhood) ||
        !TestNotNull(TEXT("Hard race reference for cooking"), Race) ||
        !TestNotNull(TEXT("One controller-owned component"), Controller->MusicAudio.Get())) return false;
    TestEqual(TEXT("Neighborhood package"), Neighborhood->GetPathName(), FString(TEXT("/Game/Audio/Music/NeighborhoodLoop.NeighborhoodLoop")));
    TestEqual(TEXT("Race package"), Race->GetPathName(), FString(TEXT("/Game/Audio/Music/RaceLoop.RaceLoop")));
    TestTrue(TEXT("Both prepared tracks loop"), Neighborhood->bLooping && Race->bLooping);
    TestEqual(TEXT("Neighborhood duration"), Neighborhood->Duration, 20.f, .01f);
    TestEqual(TEXT("Race duration"), Race->Duration, 14.545458f, .01f);
    TestEqual(TEXT("Neighborhood stereo"), Neighborhood->NumChannels, 2);
    TestEqual(TEXT("Race stereo"), Race->NumChannels, 2);
    const UAudioComponent* Audio = Controller->MusicAudio;
    TestTrue(TEXT("Quiet playback under existing cues"), Audio->VolumeMultiplier >= .04f && Audio->VolumeMultiplier <= .05f);
    TestTrue(TEXT("Ownership starts music explicitly"), !Audio->bAutoActivate && !Audio->bAllowSpatialization && !Audio->GetIsReplicated());
    TestTrue(TEXT("Native component teardown stops owned looping sound"), Audio->bStopWhenOwnerDestroyed && !Audio->bAutoDestroy);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FQuebecMusicSelectionTest, "Quebec.Music.LocalSelection",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
bool FQuebecMusicSelectionTest::RunTest(const FString& Parameters)
{
    UWorld::InitializationValues Initialization;
    Initialization.AllowAudioPlayback(false).CreateNavigation(false).CreateAISystem(false);
    UWorld* World = UWorld::CreateWorld(EWorldType::Game, false, NAME_None, nullptr, true,
        ERHIFeatureLevel::Num, &Initialization);
    if (!TestNotNull(TEXT("Isolated music world"), World)) return false;
    ON_SCOPE_EXIT { World->DestroyWorld(false); };
    AQuebecController* Local = World->SpawnActor<AQuebecController>();
    AQuebecController* Remote = World->SpawnActor<AQuebecController>();
    AQuebecController* Joining = World->SpawnActor<AQuebecController>();
    if (!TestNotNull(TEXT("Local controller"), Local) || !TestNotNull(TEXT("Remote controller"), Remote) ||
        !TestNotNull(TEXT("Joining controller"), Joining)) return false;
    Local->SetAsLocalPlayerController();
    Joining->SetAsLocalPlayerController();
    TestFalse(TEXT("Unowned controller is not local"), Remote->IsLocalController());
    Remote->UpdateMusic(true);
    TestNull(TEXT("Remote controller cannot select/play a second soundtrack"), Remote->MusicAudio->Sound.Get());
    // Four actual selection changes; repeated local updates must not restart the track.
    AddExpectedMessagePlain(TEXT("NORD_MUSIC_SELECTED"), ELogVerbosity::Display,
        EAutomationExpectedMessageFlags::Contains, 4);
    Local->UpdateMusic(false);
    TestSamePtr(TEXT("Normal play uses neighborhood"), Local->MusicAudio->Sound.Get(), Local->NeighborhoodMusic.Get());
    Local->UpdateMusic(false);
    Local->UpdateMusic(true);
    TestSamePtr(TEXT("Running race uses race track"), Local->MusicAudio->Sound.Get(), Local->RaceMusic.Get());
    Local->UpdateMusic(true);
    Local->UpdateMusic(false);
    TestSamePtr(TEXT("Race completion/timeout returns to neighborhood"), Local->MusicAudio->Sound.Get(), Local->NeighborhoodMusic.Get());
    Joining->UpdateMusic(true);
    TestSamePtr(TEXT("Late join selects the current race directly"), Joining->MusicAudio->Sound.Get(), Joining->RaceMusic.Get());
    return true;
}
#endif
