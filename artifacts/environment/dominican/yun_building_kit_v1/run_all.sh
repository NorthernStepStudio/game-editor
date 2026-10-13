#!/usr/bin/env bash
# Build every design through v01-v03 (clay) and v04 in all four map colourways.
set -u
B="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
OUT="$HERE/out"
for stage in 1 2 3; do "$B" --background --factory-startup --python "$HERE/build_kit.py" -- all $stage calle "$OUT" 2>&1 | grep -E "BUILT|Error" | sed -E 's/.*"design": "([^"]+)".*"triangles": ([0-9]+).*/\1 v0'$stage' \2 tris/'; done
for cw in calle malecon parque noche; do "$B" --background --factory-startup --python "$HERE/build_kit.py" -- all 4 $cw "$OUT" 2>&1 | grep -E "BUILT|Error" | sed -E 's/.*"design": "([^"]+)".*"triangles": ([0-9]+).*/\1 v04-'$cw' \2 tris/'; done
