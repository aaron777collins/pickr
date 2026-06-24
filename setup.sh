#!/usr/bin/env bash
set -euo pipefail

# Pickr v0.4.0 — One-liner setup
# Usage: curl -fsSL https://raw.githubusercontent.com/aaron777collins/pickr/main/setup.sh | bash

REPO="https://github.com/aaron777collins/pickr.git"
DIR="pickr"

echo "=============================="
echo "  Pickr v0.4.0 — Setup"
echo "=============================="
echo

# ── Detect OS ──────────────────────────────────────────────────────────────────
OS="$(uname -s)"
case "$OS" in
  Linux*)  PLATFORM=linux ;;
  Darwin*) PLATFORM=mac ;;
  *)       echo "Unsupported OS: $OS"; exit 1 ;;
esac

# ── Install system deps ───────────────────────────────────────────────────────
install_linux_deps() {
  echo "[1/6] Installing system dependencies..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq \
    cmake build-essential libopenblas-dev liblapack-dev \
    libgtk-3-dev libwebkit2gtk-4.1-dev libsoup-3.0-dev librsvg2-dev \
    ffmpeg curl git python3 python3-venv python3-pip >/dev/null 2>&1
  echo "  Done."
}

install_mac_deps() {
  echo "[1/6] Installing system dependencies..."
  if ! command -v brew &>/dev/null; then
    echo "  Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  brew install cmake ffmpeg python3 2>/dev/null || true
  echo "  Done."
}

# ── Install Node.js (via nvm if missing) ──────────────────────────────────────
ensure_node() {
  if command -v node &>/dev/null; then
    echo "[2/6] Node.js found: $(node --version)"
  else
    echo "[2/6] Installing Node.js 20 via nvm..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 20
    echo "  Done."
  fi
}

# ── Install Rust (via rustup if missing) ──────────────────────────────────────
ensure_rust() {
  if command -v cargo &>/dev/null; then
    echo "[3/6] Rust found: $(rustc --version)"
  else
    echo "[3/6] Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    echo "  Done."
  fi
}

# ── Clone repo ────────────────────────────────────────────────────────────────
clone_repo() {
  if [ -d "$DIR" ]; then
    echo "[4/6] Pickr directory exists, pulling latest..."
    cd "$DIR" && git pull && cd ..
  else
    echo "[4/6] Cloning Pickr..."
    git clone "$REPO" "$DIR"
  fi
}

# ── Frontend setup ────────────────────────────────────────────────────────────
setup_frontend() {
  echo "[5/6] Installing frontend dependencies..."
  cd "$DIR"
  npm install --silent
  cd ..
  echo "  Done."
}

# ── Sidecar setup ─────────────────────────────────────────────────────────────
setup_sidecar() {
  echo "[6/6] Setting up Python sidecar..."
  cd "$DIR/sidecar"
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -q -e ".[dev]"
  pip install -q -e ".[faces]" 2>/dev/null || echo "  (face_recognition skipped — dlib build failed, core features still work)"
  deactivate
  cd ../..
  echo "  Done."
}

# ── Run it ─────────────────────────────────────────────────────────────────────
main() {
  case "$PLATFORM" in
    linux) install_linux_deps ;;
    mac)   install_mac_deps ;;
  esac

  ensure_node
  ensure_rust
  clone_repo
  setup_frontend
  setup_sidecar

  echo
  echo "=============================="
  echo "  Pickr is ready!"
  echo "=============================="
  echo
  echo "  cd pickr"
  echo "  npm run tauri dev    # launch the desktop app"
  echo "  npm run dev          # frontend only (http://localhost:1420)"
  echo
}

main
