# Flat when spoiled, multiplied when clean

No new rendering technique is involved, so none of the usual art references fit. The change is a payout rule in `QuebecChain.h`.

The seven banks are the lap, the picnic, the court, the ovation, the rescue, the convoy and the last page. Bases are 100, 160, 240, 340, 460, 600 and 780. A clean bank pays base times one more than the chain already held. A spoiled bank pays the base and leaves the chain at zero, so the next clean beat can start again at one.

A miss is a window the beat already had: the blinking beam, a decoy or early panel, ink on the return, a lap that times out or is retried, and a convoy pull while the beam is still painting. Recovering a step with R does not spoil the chain. A race replay does not clear it.

The card reads the stake from the same rule. The v1 slot still writes only Version and CompletedMissions.
