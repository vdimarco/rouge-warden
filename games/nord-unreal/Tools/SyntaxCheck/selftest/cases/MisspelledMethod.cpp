// EXPECT: no member named 'SetSimulatePhysic' in 'UPrimitiveComponent'
// Misspelled UPrimitiveComponent method (SetSimulatePhysics).
#include "Components/PrimitiveComponent.h"

void Ragdoll(UPrimitiveComponent* Body)
{
    Body->SetSimulatePhysic(true);
}
