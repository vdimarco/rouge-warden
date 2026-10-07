#!/bin/sh
# Encode the blockout frames into a silent 1080p H.264 driving video.
# Usage: anime/pacer/encode.sh <frames-dir> <out.mp4>
# Stops if any of the 360 frames is missing, is not 1920x1080 or does not decode,
# so a partial render cannot shift the cuts or be upscaled.
set -e
[ $# -eq 2 ] || { echo "usage: encode.sh <frames-dir> <out.mp4>" >&2; exit 2; }
[ -d "$(dirname "$2")" ] || { echo "encode.sh: $(dirname "$2") does not exist" >&2; exit 1; }
for i in $(seq -f %04g 1 360); do
  f="$1/f_$i.png"
  [ -f "$f" ] || { echo "encode.sh: missing $f" >&2; exit 1; }
  # A PNG stores its width and height as big-endian words in bytes 16-23.
  [ "$(od -An -tu1 -j16 -N8 "$f" | awk '{print $1*16777216+$2*65536+$3*256+$4 "," $5*16777216+$6*65536+$7*256+$8}')" = "1920,1080" ] ||
    { echo "encode.sh: $f is not 1920x1080" >&2; exit 1; }
done
ffmpeg -y -xerror -framerate 24 -start_number 1 -i "$1/f_%04d.png" -frames:v 360 -an -c:v libx264 -preset slow -crf 18 \
  -pix_fmt yuv420p -movflags +faststart "$2" ||
  { rm -f "$2"; echo "encode.sh: ffmpeg stopped on the error above (a frame that does not decode stops it)" >&2; exit 1; }
