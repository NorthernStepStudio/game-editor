"""
Generate Original UI Vector Assets (Inkscape)
Northern Step Studio — Street Yun Original Asset Pipeline

Replaces third-party Kenney UI textures with 100% original Studio-owned SVG/PNG assets:
- Buttons (Yellow gloss, Green gloss, Orange gloss, Dark panel)
- Icons (Stars filled/outline, Checkmark)
- HUD Badges & Indicators
"""

import os
import subprocess

INKSCAPE = r"D:\dev\Northern Step Studio\tools\inkscape\inkscape\bin\inkscape.exe"
UI_DIR = r"D:\dev\Northern Step Studio\games\Yun\assets\ui"
SVG_DIR = os.path.join(UI_DIR, "svg")
os.makedirs(SVG_DIR, exist_ok=True)

# 1. Yellow Glossy Button (190 x 48 px template for 9-slice)
SVG_BUTTON_YELLOW = """<svg xmlns="http://www.w3.org/2000/svg" width="190" height="48" viewBox="0 0 190 48">
  <defs>
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FCD34D" />
      <stop offset="50%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
    <linearGradient id="glossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0" />
    </linearGradient>
  </defs>
  <!-- Drop Shadow -->
  <rect x="0" y="4" width="190" height="44" rx="8" ry="8" fill="#B45309" />
  <!-- Main Body -->
  <rect x="0" y="0" width="190" height="44" rx="8" ry="8" fill="url(#bodyGrad)" stroke="#78350F" stroke-width="1.5" />
  <!-- Gloss Highlight -->
  <path d="M 4 2 Q 8 2 12 2 L 178 2 Q 186 2 186 6 L 186 18 Q 95 24 4 18 Z" fill="url(#glossGrad)" />
</svg>"""

# 2. Green Glossy Button (190 x 48 px)
SVG_BUTTON_GREEN = """<svg xmlns="http://www.w3.org/2000/svg" width="190" height="48" viewBox="0 0 190 48">
  <defs>
    <linearGradient id="greenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#34D399" />
      <stop offset="50%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="greenGloss" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0" />
    </linearGradient>
  </defs>
  <!-- Drop Shadow -->
  <rect x="0" y="4" width="190" height="44" rx="8" ry="8" fill="#047857" />
  <!-- Main Body -->
  <rect x="0" y="0" width="190" height="44" rx="8" ry="8" fill="url(#greenGrad)" stroke="#064E3B" stroke-width="1.5" />
  <!-- Gloss Highlight -->
  <path d="M 4 2 Q 8 2 12 2 L 178 2 Q 186 2 186 6 L 186 18 Q 95 24 4 18 Z" fill="url(#greenGloss)" />
</svg>"""

# 3. Orange Glossy Button (190 x 48 px)
SVG_BUTTON_ORANGE = """<svg xmlns="http://www.w3.org/2000/svg" width="190" height="48" viewBox="0 0 190 48">
  <defs>
    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FB923C" />
      <stop offset="50%" stop-color="#F97316" />
      <stop offset="100%" stop-color="#EA580C" />
    </linearGradient>
    <linearGradient id="orangeGloss" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0" />
    </linearGradient>
  </defs>
  <!-- Drop Shadow -->
  <rect x="0" y="4" width="190" height="44" rx="8" ry="8" fill="#C2410C" />
  <!-- Main Body -->
  <rect x="0" y="0" width="190" height="44" rx="8" ry="8" fill="url(#orangeGrad)" stroke="#7C2D12" stroke-width="1.5" />
  <!-- Gloss Highlight -->
  <path d="M 4 2 Q 8 2 12 2 L 178 2 Q 186 2 186 6 L 186 18 Q 95 24 4 18 Z" fill="url(#orangeGloss)" />
</svg>"""

# 4. Filled Gold Star (48 x 48 px)
SVG_STAR_FILLED = """<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <linearGradient id="starGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FDE047" />
      <stop offset="60%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#D97706" />
    </linearGradient>
  </defs>
  <!-- Drop shadow -->
  <polygon points="24,3 30.5,16.5 45.5,18.5 34.5,29 37.5,44 24,36.5 10.5,44 13.5,29 2.5,18.5 17.5,16.5" 
           fill="#78350F" transform="translate(0, 2)" />
  <!-- Star body -->
  <polygon points="24,3 30.5,16.5 45.5,18.5 34.5,29 37.5,44 24,36.5 10.5,44 13.5,29 2.5,18.5 17.5,16.5" 
           fill="url(#starGrad)" stroke="#B45309" stroke-width="1.5" stroke-linejoin="round" />
</svg>"""

# 5. Star Outline (48 x 48 px)
SVG_STAR_OUTLINE = """<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <polygon points="24,3 30.5,16.5 45.5,18.5 34.5,29 37.5,44 24,36.5 10.5,44 13.5,29 2.5,18.5 17.5,16.5" 
           fill="none" stroke="#D1D5DB" stroke-width="2.5" stroke-linejoin="round" />
</svg>"""

# 6. Checkmark Icon (36 x 36 px)
SVG_CHECKMARK = """<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="16" fill="#10B981" stroke="#047857" stroke-width="1.5" />
  <polyline points="10,18 16,24 26,12" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
</svg>"""

ASSETS = [
    ("nss_button_yellow_gloss", SVG_BUTTON_YELLOW),
    ("nss_button_green_gloss",  SVG_BUTTON_GREEN),
    ("nss_button_orange_gloss", SVG_BUTTON_ORANGE),
    ("nss_star_filled",         SVG_STAR_FILLED),
    ("nss_star_outline",        SVG_STAR_OUTLINE),
    ("nss_icon_check",          SVG_CHECKMARK),
]

for name, svg_content in ASSETS:
    svg_path = os.path.join(SVG_DIR, f"{name}.svg")
    png_path = os.path.join(UI_DIR, f"{name}.png")
    
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    
    # Export PNG via Inkscape CLI
    cmd = [INKSCAPE, svg_path, f"--export-filename={png_path}"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        print(f"Generated NSS Vector Asset: {png_path} ({os.path.getsize(png_path)} bytes)")
    else:
        print(f"Error on {name}: {res.stderr}")

print("\nOriginal UI Vector Asset Generation Complete!")
