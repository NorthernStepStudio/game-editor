#!/usr/bin/env bash
# Build a roster character straight from Yun's approved template: recipe colours + toolkit hair, no AI needed.
# Usage: tools/characters/dress_from_template.sh <nn> <id>     e.g. 08 zen
set -euo pipefail
nn="$1"; id="$2"
root="$(cd "$(dirname "$0")/../.." && pwd)"
dir="$root/artifacts/yun-character-candidate/roster/$id"
template="$root/artifacts/yun-character-candidate/yun_urban_adventurer/checkpoints/chibi-v10/yun_urban_chibi_v10.blend"
blender="$(node -e "import('file:///$(cygpath -m "$root" | sed 's/ /%20/g')/core/out/index.js').then(m=>console.log(m.findBlenderExecutable()))")"
win() { cygpath -m "$1"; }
MSYS2_ARG_CONV_EXCL='*' "$blender" --background --factory-startup --python "$(win "$root/tools/characters/dress_character.py")" -- \
  "$(win "$template")" "$(win "$dir/recipe.json")" "$(win "$dir")" "${id}_chibi_v02" 2>&1 | grep -E "DRESSED|Error|Traceback|line [0-9]" || true
python "$root/tools/characters/sheet_board.py" "$dir" "$root/docs/yun/roster/${nn}-${id}.png" "$dir/board.png"
