# Design
After base animation, solve each arm using measured world-space limb lengths. Orient the right wrist to aim its attached weapon; never rotate a weapon independently of its hand. Solve the support hand toward the rifle fore-end or pistol grip. Clamp reach to avoid stretching. Existing melee animation is unchanged.

Follow-up: exponentially smooth the visual aiming orientation using elapsed animation time, with immediate alignment on firing. Add muzzle sockets to ranged props and use them for shot effects; chest-to-muzzle obstruction prevents a protruding barrel firing through cover. Nest the Golden Eagle's scale beneath its attachment root so attachment scale compensation does not erase its size.
