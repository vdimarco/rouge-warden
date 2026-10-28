# Design: a filmic shoulder and a warm lift

## Source

Krzysztof Narkowicz, ACES Filmic Tone Mapping Curve. The fitted rational curve shoulders highlights the way a filmic display transform does. Unreal's post process exposes that as the tone-curve amount, with color gain, gamma, and offset beside it.

## Choice

`QuebecGrade.h` sets the tone-curve amount to 1, gamma to 1, gain to (1.06, 1.02, 0.94), and offset to (0.012, 0.008, 0.004). `ApplySkyGrading` writes those on the view. The offline shade applies the same gain, offset, and fitted curve to the dusk frame. The shafts stay visible. The opening look stays at pitch −16 and the socket at (0, 70, 110). The opening weather stays clear.
