#!/usr/bin/env bash
# Dress a roster character built in Matterhorn: download its Blender file, apply its hair recipe, make a sheet board.
# Usage: tools/characters/dress_from_library.sh <nn> <id>     e.g. 03 kai
set -euo pipefail
nn="$1"; id="$2"
root="$(cd "$(dirname "$0")/../.." && pwd)"
dir="$root/artifacts/yun-character-candidate/roster/$id"
asset="roster_${nn}_${id}_v01"
mkdir -p "$dir"
curl -sf -o "$dir/${id}_v01.blend" "http://127.0.0.1:3001/api/foundry/assets/$asset/files/$asset.blend"
blender="$(node -e "import('file:///$(cygpath -m "$root" | sed 's/ /%20/g')/core/out/index.js').then(m=>console.log(m.findBlenderExecutable()))")"
win() { cygpath -m "$1"; }
MSYS2_ARG_CONV_EXCL='*' "$blender" --background --factory-startup --python "$(win "$root/tools/characters/dress_character.py")" -- \
  "$(win "$dir/${id}_v01.blend")" "$(win "$dir/recipe.json")" "$(win "$dir")" "${id}_chibi_v02" 2>&1 | grep -E "DRESSED|Error|Traceback|line [0-9]" || true
python "$root/tools/characters/sheet_board.py" "$dir" "$root/docs/yun/roster/${nn}-${id}.png" "$dir/board.png"
