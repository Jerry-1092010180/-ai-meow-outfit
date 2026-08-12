#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

mkdir -p output build/audio
if [[ "${REUSE_VISUAL:-0}" != "1" ]]; then
  npm run render:visual
fi

voice="${VOICE:-Sandy (中文（中国大陆）)}"
rate="${VOICE_RATE:-178}"
if [[ "${REUSE_AUDIO:-0}" != "1" ]]; then
  for script in public/narration/*.txt; do
    name="$(basename "$script" .txt)"
    say -v "$voice" -r "$rate" -f "$script" -o "build/audio/$name.aiff"
  done
fi

ffmpeg -y \
  -i build/audio/01.aiff -i build/audio/02.aiff -i build/audio/03.aiff \
  -i build/audio/04.aiff -i build/audio/05.aiff -i build/audio/06.aiff \
  -i build/audio/07.aiff -i build/audio/08.aiff -i build/audio/09.aiff \
  -i build/audio/10.aiff \
  -filter_complex "[0:a]adelay=0:all=1[a0];[1:a]adelay=7000:all=1[a1];[2:a]adelay=20000:all=1[a2];[3:a]adelay=36000:all=1[a3];[4:a]adelay=50000:all=1[a4];[5:a]adelay=66000:all=1[a5];[6:a]adelay=80000:all=1[a6];[7:a]adelay=97000:all=1[a7];[8:a]adelay=111000:all=1[a8];[9:a]adelay=125000:all=1[a9];[a0][a1][a2][a3][a4][a5][a6][a7][a8][a9]amix=inputs=10:duration=longest:dropout_transition=0,alimiter=limit=0.93,apad=pad_dur=4[narration]" \
  -map "[narration]" -t 144 -c:a aac -b:a 192k output/narration.m4a

ffmpeg -y -i output/visual.mp4 -i output/narration.m4a \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -t 144 \
  -movflags +faststart output/AI喵搭-比赛演示-v2.mp4

ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate \
  -of json output/AI喵搭-比赛演示-v2.mp4 > output/video-validation.json
