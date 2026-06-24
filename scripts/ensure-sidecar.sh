#!/usr/bin/env bash
# Ensure the sidecar binary exists for Tauri dev builds.
# In dev, we create a thin shell wrapper that delegates to the venv-installed
# pickr-sidecar. For production, CI builds a real PyInstaller binary.
set -euo pipefail

TRIPLE=$(rustc -vV | grep '^host:' | cut -d' ' -f2)
DIR="src-tauri/binaries"
mkdir -p "$DIR"

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  TARGET="$DIR/pickr-sidecar-${TRIPLE}.exe"
else
  TARGET="$DIR/pickr-sidecar-${TRIPLE}"
fi

# Skip if already exists
if [ -f "$TARGET" ]; then
  exit 0
fi

# Find the real sidecar in the venv
if [ -f "sidecar/.venv/bin/pickr-sidecar" ]; then
  REAL="$(cd sidecar/.venv/bin && pwd)/pickr-sidecar"
elif [ -f "sidecar/.venv/Scripts/pickr-sidecar.exe" ]; then
  REAL="$(cd sidecar/.venv/Scripts && pwd)/pickr-sidecar.exe"
  cp "$REAL" "$TARGET"
  exit 0
else
  echo "Warning: sidecar venv not found. Creating stub. Set up the sidecar first:"
  echo "  cd sidecar && python3 -m venv .venv && source .venv/bin/activate && pip install -e ."
  # Create a stub that prints a helpful error
  cat > "$TARGET" << 'STUB'
#!/bin/sh
echo '{"type":"error","message":"Sidecar not installed. Run: cd sidecar && python3 -m venv .venv && source .venv/bin/activate && pip install -e ."}'
exit 1
STUB
  chmod +x "$TARGET"
  exit 0
fi

# Create a wrapper script that calls the real binary
cat > "$TARGET" << WRAPPER
#!/bin/sh
exec "$REAL" "\$@"
WRAPPER
chmod +x "$TARGET"
echo "Created dev sidecar wrapper: $TARGET -> $REAL"
