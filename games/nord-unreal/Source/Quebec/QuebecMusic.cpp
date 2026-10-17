#include "QuebecGameplay.h"

#include "Components/AudioComponent.h"
#include "Engine/World.h"
#include "Sound/SoundBase.h"

void AQuebecController::UpdateMusic(bool bRacing)
{
    if (!IsLocalController()) return;
    USoundBase* Desired = bRacing ? RaceMusic.Get() : NeighborhoodMusic.Get();
    if (MusicAudio->Sound == Desired) return;
    MusicAudio->Stop();
    MusicAudio->SetSound(Desired);
    if (Desired && GetWorld()->AllowAudioPlayback()) MusicAudio->FadeIn(.35f);
    UE_LOG(LogTemp, Display, TEXT("NORD_MUSIC_SELECTED %s"), *GetNameSafe(Desired));
}
