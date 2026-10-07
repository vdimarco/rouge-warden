#!/usr/bin/env python3
"""Prepare the generated score as a small, continuous browser soundtrack.

Requires Python 3, numpy, ffmpeg and ffprobe. The original provider download
stays outside public/. Example, from games/river-rush:

    python3 scripts/prepare-music.py /tmp/river-epic-music/original.mp3 \
        --output public/audio/river-rush-adventure.mp3 \
        --report /tmp/river-epic-music/loop-measurements.json

The verified source is a 144 BPM instrumental cue. Remove its first four
bars and overlap four bars of the tail with the head. Both clips have the
same beat phase; the resulting 56-bar loop retains the musical dynamics.
Normalize with one fixed gain, rather than compressing the score.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile

import numpy as np


RATE = 48_000
CHANNELS = 2


def run(*args):
    return subprocess.run(args, check=True, capture_output=True)


def decode(path):
    pcm = run(
        "ffmpeg", "-v", "error", "-i", str(path), "-ac", str(CHANNELS),
        "-ar", str(RATE), "-f", "f32le", "pipe:1",
    ).stdout
    return np.frombuffer(pcm, dtype="<f4").reshape(-1, CHANNELS).copy()


def loudness(path):
    measured = run(
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-af", "loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json",
        "-f", "null", "-",
    ).stderr.decode()
    blocks = re.findall(r"\{[^{}]*\}", measured)
    if not blocks:
        raise RuntimeError("ffmpeg did not return a loudness measurement")
    data = json.loads(blocks[-1])
    return {
        "integrated_lufs": float(data["input_i"]),
        "true_peak_dbtp": float(data["input_tp"]),
        "loudness_range_lu": float(data["input_lra"]),
    }


def rms(data):
    return float(np.sqrt(np.mean(np.square(data, dtype=np.float64))))


def boundary_metrics(data):
    # Compare the exact decoded end -> start step with ordinary sample steps
    # on either side. This catches clicks and padding, not musical quality.
    quarter = RATE // 4
    local = np.concatenate((data[-quarter:], data[:quarter]))
    differences = np.max(np.abs(np.diff(local, axis=0)), axis=1)
    seam = float(np.max(np.abs(data[0] - data[-1])))
    return {
        "end_to_start_max_sample_step": seam,
        "nearby_sample_step_p95": float(np.percentile(differences, 95)),
        "nearby_sample_step_p99": float(np.percentile(differences, 99)),
        "first_100ms_rms": rms(data[:RATE // 10]),
        "last_100ms_rms": rms(data[-RATE // 10:]),
        "first_1s_rms": rms(data[:RATE]),
        "last_1s_rms": rms(data[-RATE:]),
        "minimum_100ms_rms": min(
            rms(data[i:i + RATE // 10])
            for i in range(0, len(data) - RATE // 10 + 1, RATE // 10)
        ),
    }


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--bpm", type=float, default=144)
    parser.add_argument("--source-bars", type=int, default=64)
    parser.add_argument("--trim-bars", type=int, default=4)
    parser.add_argument("--crossfade-bars", type=int, default=4)
    parser.add_argument("--beat-offset-seconds", type=float, default=0.03)
    parser.add_argument("--target-lufs", type=float, default=-18)
    args = parser.parse_args()
    if not 60 <= args.bpm <= 240:
        parser.error("BPM must be between 60 and 240")
    if not 0 <= args.trim_bars < args.source_bars:
        parser.error("Trim must retain some source bars")
    if not 0 < args.crossfade_bars < (args.source_bars - args.trim_bars) / 2:
        parser.error("Crossfade must leave a continuous middle section")

    source = decode(args.source)
    bar_samples = RATE * 240 / args.bpm
    start = round(args.trim_bars * bar_samples + args.beat_offset_seconds * RATE)
    end = round(args.source_bars * bar_samples + args.beat_offset_seconds * RATE)
    if end > len(source):
        raise RuntimeError("Source is shorter than the selected bar-aligned segment")
    overlap = round(args.crossfade_bars * bar_samples)
    clip = source[start:end]

    # Start at the beginning of the blend and finish immediately before it.
    # End -> start therefore joins adjacent original tail samples. At the
    # other join, the blend finishes on the head's original adjacent samples.
    # Equal-power curves have zero endpoint derivatives for the fading side.
    phase = np.linspace(0, math.pi / 2, overlap, dtype=np.float64)[:, None]
    blend = (
        clip[-overlap:] * np.cos(phase)
        + clip[:overlap] * np.sin(phase)
    ).astype(np.float32)
    loop = np.concatenate((blend, clip[overlap:-overlap]))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="river-music-") as work:
        raw = Path(work) / "loop.f32"
        wav = Path(work) / "loop.wav"
        raw.write_bytes(loop.astype("<f4", copy=False).tobytes())
        run(
            "ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(RATE),
            "-ac", str(CHANNELS), "-i", str(raw), "-c:a", "pcm_f32le", str(wav),
        )
        before = loudness(wav)
        gain_db = min(
            args.target_lufs - before["integrated_lufs"],
            -1.8 - before["true_peak_dbtp"],
        )

        def encode(gain):
            run(
                "ffmpeg", "-v", "error", "-y", "-i", str(wav),
                "-af", f"volume={gain:.4f}dB", "-c:a", "libmp3lame",
                "-b:a", "128k", "-ar", str(RATE), "-write_xing", "1",
                "-map_metadata", "-1", "-id3v2_version", "3",
                "-metadata", "title=River Rush Adventure",
                "-metadata", "comment=Original instrumental game score; prepared gapless loop",
                str(args.output),
            )

        encode(gain_db)
        final_loudness = loudness(args.output)
        # Lossy reconstruction can overshoot. Correct only if the measured
        # exported asset crosses the specified peak ceiling.
        if final_loudness["true_peak_dbtp"] > -1.5:
            gain_db -= final_loudness["true_peak_dbtp"] + 1.8
            encode(gain_db)
            final_loudness = loudness(args.output)
        final_pcm = decode(args.output)

    # Generation workspaces may use a restrictive umask. Runtime assets must
    # remain readable when copied into the committed static arcade build.
    args.output.chmod(0o644)

    if len(final_pcm) != len(loop):
        raise RuntimeError("MP3 gapless metadata did not preserve the exact loop sample count")
    if final_loudness["true_peak_dbtp"] > -1.5:
        raise RuntimeError("Exported soundtrack exceeds the requested true-peak ceiling")
    if args.output.stat().st_size > 2_000_000:
        raise RuntimeError("Exported soundtrack exceeds the two-megabyte asset budget")

    report = {
        "source_sha256": sha(args.source),
        "source_decoded_seconds": len(source) / RATE,
        "bpm": args.bpm,
        "source_start_seconds": start / RATE,
        "source_end_seconds": end / RATE,
        "crossfade_seconds": overlap / RATE,
        "crossfade": "bar-aligned equal-power, circular tail/head blend",
        "loop_bars": args.source_bars - args.trim_bars - args.crossfade_bars,
        "duration_seconds": len(final_pcm) / RATE,
        "decoded_sample_frames": len(final_pcm),
        "sample_rate": RATE,
        "channels": CHANNELS,
        "encoding": "MP3 128 kbps with Xing/LAME gapless delay and padding metadata",
        "gain_db": gain_db,
        "processing": "fixed gain, no dynamic compression or limiting",
        "unattenuated_loop_loudness": before,
        "exported_loudness": final_loudness,
        "uncompressed_boundary": boundary_metrics(loop * 10 ** (gain_db / 20)),
        "decoded_mp3_boundary": boundary_metrics(final_pcm),
        "bytes": args.output.stat().st_size,
        "output_sha256": sha(args.output),
        "subjective_audition": "Not performed; these measurements do not establish musical quality",
    }
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
