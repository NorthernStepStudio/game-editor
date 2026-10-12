"""
Generate Original SFX Assets
Northern Step Studio — Street Yun Original Audio Pipeline

Replaces third-party Kenney sound effects with 100% Studio-owned original audio:
- sfx_tag_hit: Tactile physical tag impact (sub-thump + transient snap)
- sfx_footsteps_concrete: Granular sneaker friction on street concrete
- sfx_turn_slide: High-friction rubber pivot skid on asphalt
- sfx_whistle: Street court referee whistle with dual-tone acoustic flutter
- sfx_click: Clean tactile UI tap
- sfx_confirm: Warm melodic confirmation chime
- sfx_score: Celebratory resonant street chime

Target Standard:
- Format: 44.1 kHz, 16-bit PCM WAV + OGG Vorbis
- Loudness Target: -16 LUFS (EBU R128 / ITU-R BS.1770) for SFX
"""

import os
import wave
import struct
import subprocess
import numpy as np

SAMPLE_RATE = 44100
SFX_DIR = r"D:\dev\Northern Step Studio\games\Yun\assets\sfx"
WAV_DIR = os.path.join(SFX_DIR, "wav")
os.makedirs(WAV_DIR, exist_ok=True)


def write_wav(path: str, samples: np.ndarray):
    """Write mono 16-bit PCM WAV."""
    samples = np.clip(samples, -1.0, 1.0)
    int_samples = (samples * 32767).astype(np.int16)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(int_samples.tobytes())


def convert_and_normalize(wav_path: str, ogg_path: str, target_lufs: float = -16.0):
    """Normalize loudness via ffmpeg loudnorm and encode to OGG Vorbis."""
    cmd = [
        "ffmpeg", "-y", "-i", wav_path,
        "-af", f"loudnorm=I={target_lufs}:TP=-1.5:LRA=7",
        "-c:a", "libvorbis", "-q:a", "5",
        ogg_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error encoding {ogg_path}: {res.stderr}")
        return False
    return True


def measure_loudness(audio_path: str) -> dict:
    """Measure integrated loudness and true peak using ffmpeg ebur128 filter."""
    cmd = [
        "ffmpeg", "-nostats", "-i", audio_path,
        "-filter_complex", "ebur128=peak=true",
        "-f", "null", "-"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    out = res.stderr
    lufs = None
    peak = None
    for line in out.splitlines():
        if "I:" in line and "LUFS" in line:
            parts = line.split()
            for i, p in enumerate(parts):
                if p == "I:":
                    try:
                        lufs = float(parts[i+1])
                    except ValueError:
                        pass
        if "Peak:" in line and "dBFS" in line:
            parts = line.split()
            for i, p in enumerate(parts):
                if p == "Peak:":
                    try:
                        peak = float(parts[i+1])
                    except ValueError:
                        pass
    return {"lufs": lufs, "peak_dbfs": peak}


# 1. Tag Hit: Thump + Transient Snap
def synth_tag_hit():
    duration = 0.28
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    
    # Transient high-frequency snap (0 to 18ms)
    noise = np.random.uniform(-1, 1, len(t))
    snap_env = np.exp(-t / 0.015)
    snap = noise * snap_env * 0.75
    
    # Low-end body drop (180 Hz -> 48 Hz exponential drop)
    freq = 48.0 + 132.0 * np.exp(-t / 0.04)
    phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
    body_env = np.exp(-t / 0.065)
    body = np.sin(phase) * body_env * 0.95
    
    # Mid punch (thud punch 320 Hz -> 110 Hz)
    freq_mid = 110.0 + 210.0 * np.exp(-t / 0.03)
    phase_mid = 2 * np.pi * np.cumsum(freq_mid) / SAMPLE_RATE
    mid_env = np.exp(-t / 0.035)
    mid = np.sin(phase_mid) * mid_env * 0.5
    
    combined = snap + body + mid
    # Warm soft-clipping saturation
    combined = np.tanh(combined * 1.4)
    return combined / (np.max(np.abs(combined)) + 1e-6)


# 2. Footsteps Concrete: Gritty sneaker friction
def synth_footsteps_concrete():
    duration = 0.16
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    
    # Granular friction noise
    noise = np.random.uniform(-1, 1, len(t))
    # Two micro-strikes (heel strike + toe scuff)
    heel_env = np.exp(-t / 0.02)
    toe_t = np.maximum(0, t - 0.04)
    toe_env = np.exp(-toe_t / 0.035) * (t >= 0.04)
    
    env = heel_env * 0.8 + toe_env * 0.9
    
    # Bandpass filter simulated via difference
    filtered = np.diff(noise, prepend=0)  # highpass tilt
    footstep = filtered * env
    # Thump resonant component (120 Hz)
    thump = np.sin(2 * np.pi * 125.0 * t) * heel_env * 0.4
    
    combined = footstep * 0.8 + thump
    return combined / (np.max(np.abs(combined)) + 1e-6)


# 3. Turn Slide: Sneaker skid on asphalt
def synth_turn_slide():
    duration = 0.32
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    
    noise = np.random.uniform(-1, 1, len(t))
    # Pitch sweep squeak/skid (1400 Hz -> 950 Hz)
    carrier_freq = 950.0 + 450.0 * np.exp(-t / 0.12)
    carrier = np.sin(2 * np.pi * np.cumsum(carrier_freq) / SAMPLE_RATE)
    
    # Envelope: quick rise, gritty sustain, decay
    env = np.sin(np.pi * (t / duration) ** 0.6) * np.exp(-t / 0.22)
    
    # Modulate friction noise with tonal chirp
    skid = (noise * 0.65 + carrier * 0.35) * env
    return skid / (np.max(np.abs(skid)) + 1e-6)


# 4. Street Whistle: Dual-tone acoustic flutter
def synth_whistle():
    duration = 0.45
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    
    # 22 Hz trill flutter
    flutter = 1.0 + 0.035 * np.sin(2 * np.pi * 22.0 * t)
    f1 = 2820.0 * flutter
    f2 = 3110.0 * flutter
    
    p1 = 2 * np.pi * np.cumsum(f1) / SAMPLE_RATE
    p2 = 2 * np.pi * np.cumsum(f2) / SAMPLE_RATE
    
    tones = 0.55 * np.sin(p1) + 0.45 * np.sin(p2)
    air_noise = np.random.uniform(-1, 1, len(t)) * 0.12
    
    # Envelope: 35ms attack, gentle release
    attack = np.minimum(1.0, t / 0.035)
    release = np.exp(-np.maximum(0, t - 0.32) / 0.06)
    env = attack * release
    
    whistle = (tones + air_noise) * env
    return whistle / (np.max(np.abs(whistle)) + 1e-6)


# 5. UI Click: Snappy tactile tick
def synth_ui_click():
    duration = 0.04
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    
    snap = np.sin(2 * np.pi * 1450.0 * t) * np.exp(-t / 0.007)
    noise = np.random.uniform(-1, 1, len(t)) * np.exp(-t / 0.004) * 0.5
    click = snap + noise
    return click / (np.max(np.abs(click)) + 1e-6)


# 6. UI Confirm: Melodic positive chime
def synth_ui_confirm():
    duration = 0.38
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    
    # Note 1 (587.3 Hz D5) at t=0
    n1_env = np.exp(-t / 0.12)
    n1 = (np.sin(2 * np.pi * 587.3 * t) + 0.3 * np.sin(2 * np.pi * 1174.6 * t)) * n1_env
    
    # Note 2 (880.0 Hz A5) at t=0.08
    t2 = np.maximum(0, t - 0.08)
    n2_env = np.exp(-t2 / 0.16) * (t >= 0.08)
    n2 = (np.sin(2 * np.pi * 880.0 * t2) + 0.35 * np.sin(2 * np.pi * 1760.0 * t2)) * n2_env
    
    chime = n1 * 0.6 + n2 * 0.8
    return chime / (np.max(np.abs(chime)) + 1e-6)


# 7. Street Score: Celebratory bell chord
def synth_score_bell():
    duration = 0.85
    t = np.linspace(0, duration, int(SAMPLE_RATE * duration), endpoint=False)
    
    frequencies = [523.25, 659.25, 783.99, 1046.50]  # C Major chord
    bell = np.zeros_like(t)
    for i, freq in enumerate(frequencies):
        amp = 1.0 / (i + 1) ** 0.8
        decay = 0.28 + i * 0.08
        env = np.exp(-t / decay)
        # Fundamental + slight metallic inharmonic partial
        bell += amp * (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * (freq * 2.76) * t)) * env
    
    return bell / (np.max(np.abs(bell)) + 1e-6)


SFX_GENERATORS = [
    ("sfx_tag_hit", synth_tag_hit),
    ("sfx_footsteps_concrete", synth_footsteps_concrete),
    ("sfx_turn_slide", synth_turn_slide),
    ("sfx_whistle", synth_whistle),
    ("sfx_click", synth_ui_click),
    ("sfx_confirm", synth_ui_confirm),
    ("sfx_score", synth_score_bell),
]

print("=== GENERATING ORIGINAL SFX SUITE (NORTHERN STEP STUDIO) ===")
results = []
for name, gen_fn in SFX_GENERATORS:
    wav_path = os.path.join(WAV_DIR, f"{name}.wav")
    ogg_path = os.path.join(SFX_DIR, f"{name}.ogg")
    
    samples = gen_fn()
    write_wav(wav_path, samples)
    convert_and_normalize(wav_path, ogg_path, target_lufs=-16.0)
    
    meta = measure_loudness(ogg_path)
    file_size = os.path.getsize(ogg_path)
    print(f"Asset: {name}.ogg | Size: {file_size} B | Loudness: {meta.get('lufs')} LUFS | Peak: {meta.get('peak_dbfs')} dBFS")
    results.append({
        "name": name,
        "ogg_path": ogg_path,
        "size": file_size,
        "lufs": meta.get("lufs"),
        "peak_dbfs": meta.get("peak_dbfs")
    })

print("\nOriginal SFX Suite Generation Completed Successfully!")
