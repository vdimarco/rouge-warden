#!/bin/sh
# Encode the blockout frames into a silent 1080p H.264 driving video.
# Usage: anime/pacer/encode.sh <frames-dir> <out.mp4>
set -e
ffmpeg -y -framerate 24 -i "$1/f_%04d.png" -an -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -vf "scale=1920:1080" -movflags +faststart "$2"
