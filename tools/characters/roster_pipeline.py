"""Street Yun roster: character sheet -> game-ready, rigged 3D character, the same way Matterhorn does it.

For each character: cut out the front view, build it with TRELLIS on the GPU (~20 min), turn it to face forward if it came out
backwards, fit it to the game height,
paint its back from the sheet's back view, (optionally) paint the roster smile, fix its guessed depth with the sheet's
side view (invented parts removed, stretched back and long shoes brought to the sheet), rig it with the mini skeleton
(connected weights) and install it in the game. Every step is Matterhorn's own (core/out: the TRELLIS script's
prepare/finish/paint/carve modes and the mini rigger), so the button and this batch give the same result.

Usage (from the studio root, after `npm run compile`):
  python tools/characters/roster_pipeline.py ace:05-ace zen:08-zen [--smile] [--skip-build] [--no-install]
    name:sheet   roster name and its sheet in docs/yun/roster (<sheet>.png); views come from
                 artifacts/yun-character-candidate/roster/sheet-views.json (front, right, back, left boxes)
    --smile      place the roster smile from the eyes (when TRELLIS gave the face an open mouth)
    --skip-build reuse <name>-trellis/<name>_trellis_v2-raw.glb instead of building again
    --no-install leave games/Yun untouched
Results land in artifacts/yun-character-candidate/roster/<name>-trellis/: <name>_final.glb, <name>_final_rigged.glb,
renders and reports.
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROSTER = ROOT / "artifacts/yun-character-candidate/roster"
GAME_ROSTER = ROOT / "games/Yun/assets/characters/roster"
BLENDER = shutil.which("blender") or r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
TRELLIS = ROOT / ".matterhorn/tools/trellis"
REF = ROOT / ".matterhorn/tools/rig-reference/character-female-a.glb"


def core_script(module: str, name: str, out: Path) -> Path:
    """Writes one of Matterhorn's compiled Blender scripts to a file."""
    js = f"import('{(ROOT / 'core/out' / module).as_uri()}').then(m=>require('fs').writeFileSync(process.argv[1], m.{name}))"
    subprocess.run(["node", "-e", js, str(out)], check=True)
    return out


def blender(*args) -> subprocess.CompletedProcess:
    return subprocess.run([BLENDER, "--background", "--factory-startup", "--python-exit-code", "1", *map(str, args)],
                          capture_output=True, text=True)


def step(script: Path, work: Path, cfg: dict) -> dict:
    cfg["report"] = str(work / f"{cfg['mode']}-report.json")
    path = work / f"{cfg['mode']}.json"
    path.write_text(json.dumps(cfg))
    blender("--python", script, "--", path)
    report = json.loads(Path(cfg["report"]).read_text()) if Path(cfg["report"]).exists() else {}
    if not report.get("ok"):
        raise SystemExit(f"{cfg['mode']} failed: {report.get('error', 'no report')}")
    return report


def main() -> int:
    args = sys.argv[1:]
    jobs = [a.split(":", 1) for a in args if ":" in a]
    if not jobs:
        print(__doc__)
        return 1
    views = json.loads((ROSTER / "sheet-views.json").read_text())
    tmp = Path(tempfile.mkdtemp(prefix="roster-pipeline-"))
    trellis_py = core_script("foundry/assets/providers/trellis/trellisScript.js", "TRELLIS_BLENDER_SCRIPT", tmp / "trellis.py")
    rig_py = core_script("foundry/assets/providers/miniRig/rigScript.js", "MINI_RIG_SCRIPT", tmp / "rig.py")
    for who, sheet in jobs:
        if sheet not in views:
            raise SystemExit(f"{sheet}: mark its views in sheet-views.json first")
        box = views[sheet]
        sheet_png = ROOT / "docs/yun/roster" / f"{sheet}.png"
        out = ROSTER / f"{who}-trellis"
        work = tmp / who
        work.mkdir(parents=True)
        out.mkdir(parents=True, exist_ok=True)
        raw = out / f"{who}_trellis_v2-raw.glb"
        if "--skip-build" not in args or not raw.exists():
            step(trellis_py, work, {"mode": "prepare", "image": str(sheet_png), "crop": box["front"], "output": str(work / "front.png")})
            print(f"{who}: building with TRELLIS (about 20 minutes)…", flush=True)
            cli = next(p for p in (TRELLIS / "bin/trellis-cli.exe", TRELLIS / "bin/trellis-cli") if p.exists())
            subprocess.run([str(cli), "--image", str(work / "front.png"), "--output", str(raw), "--models", str(TRELLIS / "models"),
                            "--res", "512", "--require-gpu"], check=True, capture_output=True)
            for ply in out.glob("*.ply"):
                ply.unlink()
        if not (work / "front.png").exists():
            step(trellis_py, work, {"mode": "prepare", "image": str(sheet_png), "crop": box["front"], "output": str(work / "front.png")})
        step(trellis_py, work, {"mode": "finish", "model": str(raw), "front": str(work / "front.png"), "output": str(work / "fit.glb"),
                                "previewBase": str(work / "fit"), "height": 0.72, "maxFaces": 40000})
        step(trellis_py, work, {"mode": "paint", "model": str(work / "fit.glb"), "sheet": str(sheet_png),
                                "output": str(work / "painted.glb"), "views": {"back": box["back"]}})
        model = work / "painted.glb"
        if "--smile" in args:
            r = blender("--python", ROOT / "tools/characters/face_paint.py", "--", "autosmile", model, work / "smiled.glb", work / "smile.json")
            if "SMILE_OK" in r.stdout:
                model = work / "smiled.glb"
            else:
                print(f"{who}: eyes not found, smile left as built (place it with face_paint.py smile)")
        shutil.copy(model, out / f"{who}_trellis_v2.glb")
        carve = step(trellis_py, work, {"mode": "carve", "model": str(model), "sheet": str(sheet_png),
                                        "side": box.get("right") or box["left"], "output": str(out / f"{who}_final.glb")})
        (out / "carve-report.json").write_text(json.dumps(carve.get("carve"), indent=1))
        rig_dir = work / "rig"
        rig_dir.mkdir()
        (rig_dir / "cfg.json").write_text(json.dumps({"mode": "rig", "character": str(out / f"{who}_final.glb"), "reference": str(REF),
                                                     "outDir": str(rig_dir), "baseName": who, "clips": ["idle", "walk", "sprint", "jump"], "frames": 12}))
        blender("--python", rig_py, "--", rig_dir / "cfg.json")
        rig = json.loads((rig_dir / f"{who}-rig-report.json").read_text())
        if not rig.get("ok"):
            raise SystemExit(f"{who}: rigging failed: {rig.get('error')}")
        shutil.copy(rig_dir / f"{who}.glb", out / f"{who}_final_rigged.glb")
        if "--no-install" not in args:
            shutil.copy(rig_dir / f"{who}.glb", GAME_ROSTER / f"{who}.glb")
        blender("--python", ROOT / "tools/characters/render_glb.py", "--", out / f"{who}_final.glb", out)
        print(f"{who}: done | depth fix {carve.get('carve')} | rig {rig.get('weighting')}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
