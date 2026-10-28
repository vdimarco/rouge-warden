// EXPECT: incomplete type 'UCharacterMovementComponent'
// Character.h only forward-declares the movement component; using it needs
// GameFramework/CharacterMovementComponent.h.
#include "GameFramework/Character.h"

void Sprint(ACharacter* Character)
{
    Character->GetCharacterMovement()->MaxWalkSpeed = 900.f;
}
