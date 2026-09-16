#!/usr/bin/env bash
# Runs a command inside WSL with the Midnight toolchain on PATH and Node 24 active.
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
nvm use 24.11.1 >/dev/null 2>&1 || true
export PATH="$HOME/.local/bin:$PATH"
cd /mnt/c/Users/JayCul/Documents/Code/Hackathons/equivault
exec "$@"
