#!/usr/bin/env bash
# Waits for each roster build in Matterhorn and dresses it as soon as it finishes.
root="$(cd "$(dirname "$0")/../.." && pwd)"
for pair in "04 luna" "05 ace" "06 neo" "07 mika" "08 zen" "09 jet" "10 nami" "11 rae" "12 sol"; do
  set -- $pair
  while true; do
    status=$(curl -s http://127.0.0.1:3001/api/foundry/jobs | python -c "
import json,sys
j=[x for x in json.load(sys.stdin)['jobs'] if x['assetId']=='roster_$1_$2_v01']
print(j[0]['status'] if j else 'missing')")
    case "$status" in succeeded) break;; failed|cancelled|missing) echo "SKIP $2 $status"; continue 2;; esac
    sleep 20
  done
  "$root/tools/characters/dress_from_library.sh" "$1" "$2" | sed "s/^/$2: /"
  echo "DONE $2"
done
