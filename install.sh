#!/usr/bin/env bash
# Instaluje CLI 'drawdb' do ~/.local/bin/ jako symlink.
set -euo pipefail

TOOL_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_SRC="$TOOL_DIR/bin/drawdb"
BIN_DST="$HOME/.local/bin/drawdb"

chmod +x "$BIN_SRC"
mkdir -p "$(dirname "$BIN_DST")"

if [[ -L "$BIN_DST" ]]; then
    echo "→ Aktualizuję istniejący symlink: $BIN_DST"
elif [[ -e "$BIN_DST" ]]; then
    echo "Błąd: $BIN_DST istnieje i nie jest symlinkiem. Usuń ręcznie i uruchom ponownie." >&2
    exit 1
fi

ln -sf "$BIN_SRC" "$BIN_DST"
echo "✓ Zainstalowane: $BIN_DST → $BIN_SRC"

WORKSPACE="${DRAWDB_WORKSPACE:-$HOME/drawdb-projects}"
if [[ ! -d "$WORKSPACE" ]]; then
    mkdir -p "$WORKSPACE"
    echo "✓ Utworzono workspace projektów: $WORKSPACE"
fi

if ! command -v drawdb >/dev/null 2>&1; then
    echo ""
    echo "Uwaga: 'drawdb' nie jest w PATH. Dodaj $HOME/.local/bin do PATH w ~/.bashrc lub ~/.zshrc:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
else
    echo ""
    echo "Gotowe. Spróbuj: drawdb help"
fi
