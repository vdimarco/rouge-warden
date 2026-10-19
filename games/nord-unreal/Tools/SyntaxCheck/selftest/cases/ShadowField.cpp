// EXPECT: declaration shadows a field of 'AShadowActor'
// A local variable hides a member of an AActor subclass (UE builds with -Wshadow -Werror).
#include "GameFramework/Actor.h"

class AShadowActor : public AActor
{
public:
    void Move(float DeltaSeconds);
private:
    float Speed = 300.f;
};

void AShadowActor::Move(float DeltaSeconds)
{
    const float Speed = 2.f * DeltaSeconds;
    SetActorLocation(GetActorLocation() + FVector(Speed, 0.f, 0.f));
}
