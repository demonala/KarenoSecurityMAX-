#!/data/data/com.termux/files/usr/bin/bash
set -e

echo -e "\033[38;2;6;182;212m┌─ KARENO Termux Installer ──────────────────────────┐\033[0m"
echo -e "\033[38;2;100;116;139m│ Updating packages (nodejs, git, termux-api)...     │\033[0m"

pkg update -y
pkg install -y nodejs git termux-api || pkg install -y nodejs git

chmod +x ./bin/kareno.js

if [ -n "$PREFIX" ] && [ -d "$PREFIX/bin" ]; then
    ln -sf "$(pwd)/bin/kareno.js" "$PREFIX/bin/kareno"
    chmod +x "$PREFIX/bin/kareno"
fi

npm link 2>/dev/null || true

echo -e "\033[38;2;16;185;129m└─ Installation complete! Type 'kareno' to launch. ──┘\033[0m"
