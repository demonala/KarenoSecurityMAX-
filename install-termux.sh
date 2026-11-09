#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "┏━⟦ KARENO // TERMUX INSTALLER ⟧"
echo "╟──▸ Updating Termux packages and verifying Node.js LTS..."
pkg update -y
pkg install -y nodejs git

echo "╟──▸ Linking kareno binary globally in Termux PATH..."
npm link

echo "┗━━▸ Installation complete. Run 'kareno' from any directory."
