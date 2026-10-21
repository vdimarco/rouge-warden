# Shaded walls take the street's warm light

## Source

No global-illumination pass fit these cel bands. The warm multiply is only the shade band, and only under the street air. The height split is the 18 m layer already in this shader, from Carsten Wenzel, "Real-time Atmospheric Effects in Games" (SIGGRAPH 2006), the height only. The cool shade above that line stays the comic cel from `comicCelX`.

## Decisions

- One mix at the end of the wall colour. Windows keep their own light. The lit band is left alone.
- The mix fades from full at 8 m to none at 20 m, so the lower floors change and the roofs do not.
- No new pass, no `gl_FragCoord`, and the headset draws the same wall shader.
