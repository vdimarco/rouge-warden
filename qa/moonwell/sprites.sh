#!/bin/sh
# Builds public/moonwell/assets/sprites.webp (1024 x 512) from the source art, with ImageMagick.
# Row 1, 256 px cells: bumper, moon portal, star, pearl (cut from pinball-atlas.png by their distance from its navy ground).
# Row 2: the left flipper (320 x 215 at 0,256; the game mirrors it for the right one) and the ball (128 x 128 at 320,256).
# Run from the repository root: sh qa/moonwell/sprites.sh
set -e
A=public/moonwell/assets
T=$(mktemp -d)
convert $A/pinball-atlas.png \( +clone -fill 'rgb(4,15,33)' -colorize 100 \) -compose difference -composite \
  -colorspace gray -level 2%,14% $T/mask.png
convert $A/pinball-atlas.png $T/mask.png -alpha off -compose copy_opacity -composite $T/cut.png
cell() { convert $T/cut.png -crop "$1" +repage -resize 256x256 $T/$2.png; }
cell 490x490+67+75 bumper
cell 530x530+675+54 portal
cell 440x440+93+684 star
cell 340x340+767+748 pearl
convert $A/scene-sprites.png -crop 538x361+40+397 +repage -resize 320x215 $T/flipper.png
convert $A/scene-sprites.png -crop 280x280+487+827 +repage -resize 128x128 $T/ball.png
convert -size 1024x512 xc:none \
  $T/bumper.png -geometry +0+0 -composite $T/portal.png -geometry +256+0 -composite \
  $T/star.png -geometry +512+0 -composite $T/pearl.png -geometry +768+0 -composite \
  $T/flipper.png -geometry +0+256 -composite $T/ball.png -geometry +320+256 -composite \
  -define webp:alpha-quality=90 -quality 88 $A/sprites.webp
# The far layer in play: the left part of the painting (the meadow, the pond and the
# bridge, with no pinball parts), mirrored so it repeats with no seam.
convert $A/moon-islands.png -crop 800x620+0+130 +repage $T/far.png
convert $T/far.png \( $T/far.png -flop \) +append -resize 1400x -quality 78 $A/far-islands.webp
rm -rf $T
ls -la $A/sprites.webp $A/far-islands.webp
