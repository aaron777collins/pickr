"""Build a standalone pickr-sidecar binary using PyInstaller.

Usage:
    python build_binary.py [--target-triple x86_64-pc-windows-msvc]

The output binary lands in src-tauri/binaries/ with the Tauri naming
convention: pickr-sidecar-{target_triple}[.exe]
"""

import platform
import subprocess
import shutil
import sys
from pathlib import Path

KNOWN_TRIPLES = {
    ("Windows", "AMD64"): "x86_64-pc-windows-msvc",
    ("Windows", "x86"): "i686-pc-windows-msvc",
    ("Linux", "x86_64"): "x86_64-unknown-linux-gnu",
    ("Darwin", "x86_64"): "x86_64-apple-darwin",
    ("Darwin", "arm64"): "aarch64-apple-darwin",
}


def detect_triple():
    key = (platform.system(), platform.machine())
    return KNOWN_TRIPLES.get(key, f"{platform.machine()}-unknown-{platform.system().lower()}")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-triple", default=None)
    args = parser.parse_args()

    triple = args.target_triple or detect_triple()
    sidecar_dir = Path(__file__).parent
    repo_root = sidecar_dir.parent
    out_dir = repo_root / "src-tauri" / "binaries"
    out_dir.mkdir(parents=True, exist_ok=True)

    ext = ".exe" if platform.system() == "Windows" else ""
    final_name = f"pickr-sidecar-{triple}{ext}"

    print(f"Building pickr-sidecar for {triple}...")

    subprocess.run(
        [
            sys.executable, "-m", "PyInstaller",
            "--onefile",
            "--name", "pickr-sidecar",
            "--distpath", str(out_dir),
            "--specpath", str(sidecar_dir / "build"),
            "--workpath", str(sidecar_dir / "build" / "work"),
            str(sidecar_dir / "pickr_sidecar" / "__main__.py"),
        ],
        check=True,
        cwd=str(sidecar_dir),
    )

    built = out_dir / f"pickr-sidecar{ext}"
    target = out_dir / final_name
    if built.exists() and built != target:
        shutil.move(str(built), str(target))

    print(f"Built: {target}")


if __name__ == "__main__":
    main()
