"""Adds outfit colours (per-part colour zones of Yun's template) to the recipes of characters built from the template."""
import json
from pathlib import Path

ROOT = Path(r"D:/dev/Northern Step Studio/artifacts/yun-character-candidate/roster")
YUN_ONLY = ["Hair_Curls", "Hair_Ponytail", "Scrunchie", "Earrings", "Hip_Strap", "Bag_Patch", "Jacket_Star", "Jacket_Logo"]

# colours: skin, jacket body, panels, trim, sleeve upper, sleeve band, sleeve lower, collar, lining,
# top (CropTop), torso (Torso), glove, glove accent, shorts, hem, legs, shoe upper, shoe panel, shoe accent,
# sole, bag, bag flap, strap, belt, buckle, brows
OUTFITS = {
    "jet": dict(skin="#F2C8A6", body="#232326", panel="#F08A3C", trim="#F08A3C", up="#F08A3C", band="#F2F0EE", low="#F08A3C",
                collar="#232326", lining="#F08A3C", top="#8E8E92", torso="#8E8E92", glove="#232326", accent="#F08A3C",
                shorts="#4A4A50", hem="#2A2A2E", legs="skin", shoe="#F2F0EE", shoe_panel="#232326", shoe_accent="#F08A3C",
                sole="#F2F0EE", bag="#1E1E22", flap="#2A2A2E", strap="#1E1E22", belt="#2A2A2E", buckle="#C9C9CF", brows="#B4561F"),
    "zen": dict(skin="#8A5A3B", body="#2C4A78", panel="#8FD0F5", trim="#8FD0F5", up="#8FD0F5", band="#2C4A78", low="#8FD0F5",
                collar="#8FD0F5", lining="#2C4A78", top="#8FD0F5", torso="#8FD0F5", glove="skin", accent="skin",
                shorts="#1E1E22", hem="#2A2A2E", legs="skin", shoe="#2C4A78", shoe_panel="#8FD0F5", shoe_accent="#F2F0EE",
                sole="#F2F0EE", bag="#1E1E22", flap="#2A2A2E", strap="#1E1E22", belt="#2A2A2E", buckle="#D9B44A", brows="#2E211B"),
    "nami": dict(skin="#F3CFB2", body="#1E1E22", panel="#4FB8AE", trim="#4FB8AE", up="#1E1E22", band="#4FB8AE", low="#F4F1EE",
                 collar="#1E1E22", lining="#4FB8AE", top="#6FD1C6", torso="skin", glove="#2C2C30", accent="#4FB8AE",
                 shorts="#4FB8AE", hem="#F4F1EE", legs="skin", shoe="#F4F1EE", shoe_panel="#4FB8AE", shoe_accent="#4FB8AE",
                 sole="#F4F1EE", bag="#F2C04D", flap="#E0A830", strap="#1E1E22", belt="#1E1E22", buckle="#C9C9CF", brows="#2F7F78"),
    "rae": dict(skin="#EDBF9A", body="#EC4F9A", panel="#1E1E22", trim="#EC4F9A", up="#EC4F9A", band="#1E1E22", low="#F7A8CC",
                collar="#1E1E22", lining="#EC4F9A", top="#F4F1EE", torso="#F4F1EE", glove="#1E1E22", accent="#EC4F9A",
                shorts="#4A3027", hem="#3A2620", legs="skin", shoe="#F4F1EE", shoe_panel="#EC4F9A", shoe_accent="#1E1E22",
                sole="#F4F1EE", bag="#1E1E22", flap="#EC4F9A", strap="#1E1E22", belt="#2A2A2E", buckle="#C9C9CF", brows="#5A3020"),
    "sol": dict(skin="#8B5A3C", body="#3D8EE0", panel="#F2F0EE", trim="#F2F0EE", up="#3D8EE0", band="#F2F0EE", low="#3D8EE0",
                collar="#F2F0EE", lining="#3D8EE0", top="#1E1E22", torso="#1E1E22", glove="#8E8E92", accent="#3D8EE0",
                shorts="#1E1E22", hem="#2A2A2E", legs="skin", shoe="#F2F0EE", shoe_panel="#3D8EE0", shoe_accent="#3D8EE0",
                sole="#F2F0EE", bag="#1E1E22", flap="#2A2A2E", strap="#1E1E22", belt="#2A2A2E", buckle="#F2C04D", brows="#E6DED6"),
}

OUTFITS.update({
    "riko": dict(skin="#F2C6A4", body="#E8508A", panel="#1E1E22", trim="#E8508A", up="#E8508A", band="#1E1E22", low="#E8508A",
                 collar="#E8508A", lining="#F4F1EE", top="#F4F1EE", torso="#F4F1EE", glove="#1E1E22", accent="#F06AA8",
                 shorts="#1E1E22", hem="#2A2A2E", legs="skin", shoe="#F4F1EE", shoe_panel="#F06AA8", shoe_accent="#F06AA8",
                 sole="#F4F1EE", bag="#1E1E22", flap="#F06AA8", strap="#1E1E22", belt="#2A2A2E", buckle="#C9C9CF", brows="#4A2615"),
    "kai": dict(skin="#F0C8A2", body="#2F6BD8", panel="#2F6BD8", trim="#F2F0EE", up="#2F6BD8", band="#F2F0EE", low="#2F6BD8",
                collar="#F2F0EE", lining="#2F6BD8", top="#F4F1EE", torso="#F4F1EE", glove="skin", accent="skin",
                shorts="#1E1E22", hem="#2A2A2E", legs="skin", shoe="#F4F1EE", shoe_panel="#2F6BD8", shoe_accent="#2F6BD8",
                sole="#F4F1EE", bag="#1E1E22", flap="#2A2A2E", strap="#1E1E22", belt="#2A2A2E", buckle="#C9C9CF", brows="#1E2233"),
    "luna": dict(skin="#F3CDB0", body="#8F5BD8", panel="#8F5BD8", trim="#F2C04D", up="#8F5BD8", band="#8F5BD8", low="#F4F1EE",
                 collar="#8F5BD8", lining="#1E1E22", top="#1E1E22", torso="#1E1E22", glove="skin", accent="#8F5BD8",
                 shorts="#8C8A93", hem="#6E6C76", legs="skin", shoe="#F4F1EE", shoe_panel="#9A6BE0", shoe_accent="#9A6BE0",
                 sole="#F4F1EE", bag="#9A6BE0", flap="#F2C04D", strap="#1E1E22", belt="#2A2A2E", buckle="#F2C04D", brows="#7A55B8"),
    "ace": dict(skin="#7A4A2E", body="#D9363E", panel="#D9363E", trim="#F2F0EE", up="#F2F0EE", band="#D9363E", low="#F2F0EE",
                collar="#F2F0EE", lining="#D9363E", top="#F4F1EE", torso="#F4F1EE", glove="skin", accent="#D9363E",
                shorts="#1E1E22", hem="#2A2A2E", legs="skin", shoe="#D9363E", shoe_panel="#F4F1EE", shoe_accent="#1E1E22",
                sole="#F4F1EE", bag="#1E1E22", flap="#2A2A2E", strap="#1E1E22", belt="#2A2A2E", buckle="#C9C9CF", brows="#2A1D18"),
    "neo": dict(skin="#F1CBA8", body="#3E9E64", panel="#3E9E64", trim="#F2F0EE", up="#3E9E64", band="#F2F0EE", low="#3E9E64",
                collar="#F2F0EE", lining="#3E9E64", top="#F4F1EE", torso="#F4F1EE", glove="skin", accent="skin",
                shorts="#1E1E22", hem="#2A2A2E", legs="skin", shoe="#2E7D4F", shoe_panel="#1E1E22", shoe_accent="#F4F1EE",
                sole="#F4F1EE", bag="#1E1E22", flap="#3E9E64", strap="#1E1E22", belt="#2A2A2E", buckle="#C9C9CF", brows="#8C6A3A"),
    "mika": dict(skin="#F2CCAA", body="#F2B935", panel="#F2B935", trim="#F6E7C8", up="#F2B935", band="#F6E7C8", low="#F2B935",
                 collar="#F6E7C8", lining="#F2B935", top="#F6E7C8", torso="#F6E7C8", glove="#1E1E22", accent="#F6E7C8",
                 shorts="#9A6A3A", hem="#F6E7C8", legs="skin", shoe="#F4F1EE", shoe_panel="#F2B935", shoe_accent="#F2B935",
                 sole="#F4F1EE", bag="#1E1E22", flap="#2A2A2E", strap="#1E1E22", belt="#2A2A2E", buckle="#C9C9CF", brows="#2E2622"),
})

for cid, o in OUTFITS.items():
    name = cid.capitalize()
    path = ROOT / cid / "recipe.json"
    recipe = json.loads(path.read_text(encoding="utf-8"))
    mats = recipe.setdefault("materials", {})

    def m(key):
        value = o[key]
        if value == "skin":
            key, value = "skin", o["skin"]
        mat = f"{name}_{key.capitalize()}"
        mats[mat] = value
        return mat

    recipe["remove"] = sorted(set(recipe.get("remove", [])) | set(YUN_ONLY))
    recipe["slots"] = {
        "Head": [m("skin")],
        "Neck": [m("skin")],
        "Torso": [m("torso")],
        "CropTop": [m("top")],
        "Jacket": [m("body"), m("panel"), m("trim")],
        "Arm_L": [m("up"), m("band"), m("low")],
        "Arm_R": [m("up"), m("band"), m("low")],
        "Collar": [m("collar"), m("lining")],
        "Hand_L": [m("glove"), m("skin"), m("accent")],
        "Hand_R": [m("glove"), m("skin"), m("accent")],
        "Shorts": [m("shorts"), m("hem")],
        "Leg_L": [m("legs")],
        "Leg_R": [m("legs")],
        "Shoe_L": [m("shoe"), m("shoe_panel"), m("shoe_accent"), m("sole")],
        "Shoe_R": [m("shoe"), m("shoe_panel"), m("shoe_accent"), m("sole")],
        "Bag": [m("bag"), m("flap")],
        "Bag_Strap": [m("strap")],
        "Belt": [m("belt"), m("buckle")],
        "Eyebrows": [m("brows")],
    }
    recipe.pop("recolor", None)
    path.write_text(json.dumps(recipe, indent=1), encoding="utf-8")
    print(cid, len(mats), "materials")
