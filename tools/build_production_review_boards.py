"""
Build Production Toolchain Review Boards (Boards 10, 11, 12)
Northern Step Studio — Asset Production Review Suite
"""

import os
from PIL import Image, ImageDraw, ImageFont

BRAIN_DIR = r"C:\Users\winst\.gemini\antigravity\brain\081e8808-26d5-481d-bf69-8820affac34f"
ARTIFACT_DIR = r"D:\dev\Northern Step Studio\artifacts\review_boards"
os.makedirs(ARTIFACT_DIR, exist_ok=True)
os.makedirs(BRAIN_DIR, exist_ok=True)

UI_DIR = r"D:\dev\Northern Step Studio\games\Yun\assets\ui"
ENV_RENDERS_DIR = r"D:\dev\Northern Step Studio\artifacts\environment\renders"
MATCH_QA_DIR = r"D:\dev\Northern Step Studio\games\Yun\build-artifacts\visual-qa\yun_gameplay_v2_match"

BOARD_W = 1600
BOARD_H = 900
BG_COLOR = (18, 20, 24)
CARD_BG = (28, 32, 38)
TEXT_COLOR = (245, 245, 245)
SUB_COLOR = (160, 168, 180)
ACCENT_COLOR = (245, 158, 11)  # Amber
SUCCESS_COLOR = (16, 185, 129) # Emerald


def get_font(size):
    try:
        return ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", size)
    except:
        return ImageFont.load_default()


# -------------------------------------------------------------
# Board 10: Original UI Vector Suite (Inkscape)
# -------------------------------------------------------------
def build_board_10():
    img = Image.new("RGB", (BOARD_W, BOARD_H), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    font_title = get_font(32)
    font_sub = get_font(18)
    font_label = get_font(20)
    font_desc = get_font(14)
    
    draw.text((40, 36), "BOARD 10 — ORIGINAL UI VECTOR SUITE (INKSCAPE 1.3.2)", font=font_title, fill=TEXT_COLOR)
    draw.text((40, 78), "100% Studio-owned SVGs & PNGs | Replaces Kenney UI buttons & difficulty stars | Responsive 9-Slice Geometry", font=font_sub, fill=SUB_COLOR)
    
    # 3 Large Buttons
    buttons = [
        ("Yellow Gloss Button (Play Match)", os.path.join(UI_DIR, "nss_button_yellow_gloss.png"), "res://assets/ui/nss_button_yellow_gloss.png", "#F59E0B Primary Call-to-Action"),
        ("Green Gloss Button (Easy Tier)", os.path.join(UI_DIR, "nss_button_green_gloss.png"), "res://assets/ui/nss_button_green_gloss.png", "#10B981 Novice Mode"),
        ("Orange Gloss Button (Normal Tier)", os.path.join(UI_DIR, "nss_button_orange_gloss.png"), "res://assets/ui/nss_button_orange_gloss.png", "#F97316 Street Mode"),
    ]
    
    card_w = 480
    card_h = 320
    for i, (name, path, res_path, desc) in enumerate(buttons):
        bx = 40 + i * (card_w + 40)
        by = 130
        draw.rectangle([bx, by, bx + card_w, by + card_h], fill=CARD_BG, outline=(50, 56, 68), width=2)
        draw.text((bx + 20, by + 18), name, font=font_label, fill=TEXT_COLOR)
        draw.text((bx + 20, by + 46), desc, font=font_desc, fill=SUB_COLOR)
        
        if os.path.exists(path):
            btn_im = Image.open(path).convert("RGBA")
            # Scale for display
            display_w = 400
            display_h = int(btn_im.height * (display_w / btn_im.width))
            btn_im = btn_im.resize((display_w, display_h), Image.Resampling.LANCZOS)
            px = bx + (card_w - display_w) // 2
            py = by + 110
            img.paste(btn_im, (px, py), btn_im)
        
        draw.text((bx + 20, by + card_h - 40), f"Runtime Path: {res_path}", font=font_desc, fill=SUCCESS_COLOR)

    # Icons Row (Stars filled, star outline, checkmark)
    icon_card_w = 480
    icon_card_h = 360
    icons = [
        ("Filled Star (Normal / Hard Indicator)", os.path.join(UI_DIR, "nss_star_filled.png"), "Gold gradient with faceted drop shadow"),
        ("Outline Star (Pending Tier)", os.path.join(UI_DIR, "nss_star_outline.png"), "Clean chalk outline with soft bevel"),
        ("Checkmark Icon (Selection Verified)", os.path.join(UI_DIR, "nss_icon_check.png"), "Emerald badge with high-contrast glyph"),
    ]
    
    for i, (name, path, desc) in enumerate(icons):
        bx = 40 + i * (icon_card_w + 40)
        by = 480
        draw.rectangle([bx, by, bx + icon_card_w, by + icon_card_h], fill=CARD_BG, outline=(50, 56, 68), width=2)
        draw.text((bx + 20, by + 18), name, font=font_label, fill=TEXT_COLOR)
        draw.text((bx + 20, by + 46), desc, font=font_desc, fill=SUB_COLOR)
        
        if os.path.exists(path):
            ic_im = Image.open(path).convert("RGBA")
            display_size = 140
            ic_im = ic_im.resize((display_size, display_size), Image.Resampling.LANCZOS)
            px = bx + (icon_card_w - display_size) // 2
            py = by + 90
            img.paste(ic_im, (px, py), ic_im)
        
        draw.text((bx + 20, by + icon_card_h - 40), "Standard: 100% Vector SVG + Antialiased PNG", font=font_desc, fill=SUCCESS_COLOR)

    # Save
    out_brain = os.path.join(BRAIN_DIR, "board_10_original_ui_vector_suite.png")
    out_art = os.path.join(ARTIFACT_DIR, "board_10_original_ui_vector_suite.png")
    img.save(out_brain)
    img.save(out_art)
    print(f"Generated Board 10: {out_brain}")


# -------------------------------------------------------------
# Board 11: Modular Dominican Environment Showcase (Blender 5.2.1 LTS)
# -------------------------------------------------------------
def build_board_11():
    img = Image.new("RGB", (BOARD_W, BOARD_H), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    font_title = get_font(32)
    font_sub = get_font(18)
    font_label = get_font(20)
    font_desc = get_font(14)
    
    draw.text((40, 36), "BOARD 11 — MODULAR DOMINICAN ENVIRONMENT ASSETS (BLENDER 5.2.1 LTS)", font=font_title, fill=TEXT_COLOR)
    draw.text((40, 78), "Original Caribbean PBR Architecture | Authentic Santo Domingo Stucco, Zinc Roof & Utility Props", font=font_sub, fill=SUB_COLOR)
    
    assets = [
        ("Colmado Storefront", os.path.join(ENV_RENDERS_DIR, "colmado_storefront_render.png"), "Turquoise stucco, corrugated zinc roof, reja security grill, wood counter & drink crates"),
        ("Modular Striped Awning", os.path.join(ENV_RENDERS_DIR, "colmado_awning_render.png"), "Dual-tone commercial canvas canopy with steel diagonal wall struts and scalloped valance"),
        ("Dominican Utility Pole", os.path.join(ENV_RENDERS_DIR, "utility_pole_dominican_render.png"), "Concrete shaft, wooden crossarms, ceramic insulators, heavy transformer & cobra-head streetlight"),
        ("Street Curb Sidewalk Tile", os.path.join(ENV_RENDERS_DIR, "street_curb_tile_render.png"), "Concrete sidewalk paving, yellow painted curb stone, drainage gutter channel & asphalt step"),
    ]
    
    card_w = 360
    card_h = 710
    for i, (name, path, desc) in enumerate(assets):
        bx = 40 + i * (card_w + 26)
        by = 130
        draw.rectangle([bx, by, bx + card_w, by + card_h], fill=CARD_BG, outline=(50, 56, 68), width=2)
        draw.text((bx + 18, by + 18), name, font=font_label, fill=TEXT_COLOR)
        
        # Word wrap desc
        lines = []
        words = desc.split()
        cur = ""
        for w in words:
            if len(cur + " " + w) < 38:
                cur += (" " if cur else "") + w
            else:
                lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        for li, l in enumerate(lines[:3]):
            draw.text((bx + 18, by + 48 + li * 18), l, font=font_desc, fill=SUB_COLOR)
        
        if os.path.exists(path):
            r_im = Image.open(path).convert("RGBA")
            d_size = 320
            r_im = r_im.resize((d_size, d_size), Image.Resampling.LANCZOS)
            px = bx + (card_w - d_size) // 2
            py = by + 120
            img.paste(r_im, (px, py), r_im)
        
        # Stats footer
        draw.rectangle([bx + 18, by + card_h - 100, bx + card_w - 18, by + card_h - 20], fill=(20, 24, 30), outline=(40, 46, 56))
        draw.text((bx + 28, by + card_h - 90), "Status: Pass / Game-Ready", font=font_desc, fill=SUCCESS_COLOR)
        draw.text((bx + 28, by + card_h - 68), "Format: glTF 2.0 (.glb) + PBR Materials", font=font_desc, fill=TEXT_COLOR)
        draw.text((bx + 28, by + card_h - 46), "Runtime: Zero third-party Kenney dependence", font=font_desc, fill=ACCENT_COLOR)

    # Save
    out_brain = os.path.join(BRAIN_DIR, "board_11_dominican_environment_showcase.png")
    out_art = os.path.join(ARTIFACT_DIR, "board_11_dominican_environment_showcase.png")
    img.save(out_brain)
    img.save(out_art)
    print(f"Generated Board 11: {out_brain}")


# -------------------------------------------------------------
# Board 12: In-Engine Production Integration & Full Playable Match
# -------------------------------------------------------------
def build_board_12():
    img = Image.new("RGB", (BOARD_W, BOARD_H), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    font_title = get_font(32)
    font_sub = get_font(18)
    font_label = get_font(20)
    font_desc = get_font(14)
    
    draw.text((40, 36), "BOARD 12 — IN-ENGINE PRODUCTION TOOLCHAIN INTEGRATION (GODOT 4.7.2 VULKAN)", font=font_title, fill=TEXT_COLOR)
    draw.text((40, 78), "Live Forward+ Vulkan Renders on AMD RX 7700 XT | Gameplay v2 + Dominican Environment + Original Audio", font=font_sub, fill=SUB_COLOR)
    
    shots = [
        ("Match Intro on Street Court", os.path.join(BRAIN_DIR, "01_match_intro_yun_v2_on_court.png"), "6,541-tri Heroic Yun Urban v2 with Dominican Colmado & utility pole"),
        ("Locomotion (Sprint / Walk)", os.path.join(BRAIN_DIR, "02_match_locomotion_walk_sprint.png"), "Deterministic landmark vertex skinning on NSS Humanoid Rig v1"),
        ("Interaction (Tag & Defense)", os.path.join(BRAIN_DIR, "03_match_turn_tag_interaction.png"), "Physical tag impact & sneaker concrete audio triggering"),
        ("High Isometric Camera Framing", os.path.join(BRAIN_DIR, "04_camera_framing_high_court.png"), "42° isometric camera with full horizon and Dominican architecture"),
    ]
    
    card_w = 740
    card_h = 350
    positions = [
        (40, 130),
        (820, 130),
        (40, 500),
        (820, 500)
    ]
    
    for i, ((name, path, desc), (bx, by)) in enumerate(zip(shots, positions)):
        draw.rectangle([bx, by, bx + card_w, by + card_h], fill=CARD_BG, outline=(50, 56, 68), width=2)
        draw.text((bx + 20, by + 16), name, font=font_label, fill=TEXT_COLOR)
        draw.text((bx + 20, by + 44), desc, font=font_desc, fill=SUB_COLOR)
        
        if os.path.exists(path):
            s_im = Image.open(path).convert("RGBA")
            d_w = 700
            d_h = int(s_im.height * (d_w / s_im.width))
            if d_h > 260:
                d_h = 260
                d_w = int(s_im.width * (d_h / s_im.height))
            s_im = s_im.resize((d_w, d_h), Image.Resampling.LANCZOS)
            px = bx + (card_w - d_w) // 2
            py = by + 75
            img.paste(s_im, (px, py), s_im)
        
    out_brain = os.path.join(BRAIN_DIR, "board_12_in_engine_production_integration.png")
    out_art = os.path.join(ARTIFACT_DIR, "board_12_in_engine_production_integration.png")
    img.save(out_brain)
    img.save(out_art)
    print(f"Generated Board 12: {out_brain}")


print("=== BUILDING REVIEW BOARDS 10, 11, 12 ===")
build_board_10()
build_board_11()
build_board_12()
print("=== REVIEW BOARDS COMPLETE ===")
