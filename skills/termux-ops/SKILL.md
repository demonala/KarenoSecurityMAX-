---
name: termux-ops
description: "Termux & Android ARM64 optimization, mobile terminal constraints, and package tooling."
version: 1.0.0
---
# Termux Operations Skill

- Prefer native binaries and pure JavaScript/Python/Go modules that do not require heavy C++ compilation on ARM64 unless `clang` and `make` are verified.
- Keep terminal line output within 76-80 columns to prevent mobile screen wrapping.
- Respect `$PREFIX/bin` and `$HOME` paths in Termux (`/data/data/com.termux/files/usr`).
- Minimize disk writes and memory spikes on mobile flash storage.
