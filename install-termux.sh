#!/data/data/com.termux/files/usr/bin/bash
set -e

echo -e "\033[38;2;0;255;115m┏━⟦ KARENO // TERMUX MOBILE INSTALLER ⟧\033[0m"
echo -e "\033[38;2;115;140;130m╟──▸ Verifying Termux packages (nodejs, git, termux-api)...\033[0m"

pkg update -y
pkg install -y nodejs git termux-api || pkg install -y nodejs git

chmod +x ./bin/kareno.js

echo -e "\033[38;2;115;140;130m╟──▸ Registering 'kareno' command in Termux PATH ($PREFIX/bin)...\033[0m"
if [ -n "$PREFIX" ] && [ -d "$PREFIX/bin" ]; then
    ln -sf "$(pwd)/bin/kareno.js" "$PREFIX/bin/kareno"
    chmod +x "$PREFIX/bin/kareno"
    echo -e "\033[38;2;0;255;115m╟──▸ Linked successfully to $PREFIX/bin/kareno\033[0m"
fi

npm link 2>/dev/null || true

echo -e "\033[38;2;0;255;115m┗━━▸ Installation complete! Type '\033[1mkareno\033[0m\033[38;2;0;255;115m' to launch the UI.\033[0m"
