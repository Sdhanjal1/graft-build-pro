#!/bin/bash
# mix-audio.sh <silent-video.mp4> <output.mp4>
# Layers music + SFX onto a silent Remotion render using ffmpeg's built-in aac.
set -e
IN="$1"
OUT="$2"
AUD=/dev-server/remotion/public/audio
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN" | awk '{printf "%d", $1*1000}')

ffmpeg -y -i "$IN" \
  -stream_loop -1 -i "$AUD/music.mp3" \
  -i "$AUD/whoosh.mp3" \
  -i "$AUD/pop.mp3" \
  -i "$AUD/cash.mp3" \
  -i "$AUD/whoosh.mp3" \
  -filter_complex "\
    [1:a]volume=0.22[mus];\
    [2:a]volume=0.6,adelay=0|0[s1];\
    [3:a]volume=0.95,adelay=10600|10600[s2];\
    [4:a]volume=0.75,adelay=20100|20100[s3];\
    [5:a]volume=0.5,adelay=18000|18000[s4];\
    [mus][s1][s2][s3][s4]amix=inputs=5:duration=first:dropout_transition=0:normalize=0[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest "$OUT" 2>&1 | tail -3
echo "OK: $OUT"
