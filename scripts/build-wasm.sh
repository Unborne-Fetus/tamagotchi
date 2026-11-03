#!/usr/bin/env bash
set -euo pipefail

# Build reproducibly without copying, downloading or bundling proprietary firmware.
# TamaLIB is GPL-2.0-or-later; its exact upstream revision is pinned below.
TAMALIB_COMMIT="ce304d55f9a73c60232ce3f552e7983db3fa399c"
mkdir -p vendor dist/emu
if [ ! -d vendor/tamalib/.git ]; then
  git clone --quiet https://github.com/jcrona/tamalib.git vendor/tamalib
fi
git -C vendor/tamalib fetch --quiet origin "$TAMALIB_COMMIT"
git -C vendor/tamalib checkout --quiet --detach "$TAMALIB_COMMIT"

# TamaLIB HAL includes ../hal_types.h from vendor/tamalib.
cp vendor/tamalib/hal_types.h.template hal_types.h
command -v emcc >/dev/null || { echo "Install emsdk before building the emulator"; exit 1; }

emcc -std=c11 -O2 \
  native/p1_bridge.c \
  vendor/tamalib/cpu.c vendor/tamalib/hw.c vendor/tamalib/tamalib.c \
  -sWASM=1 -sMODULARIZE=1 -sEXPORT_ES6=1 \
  -sEXPORT_NAME=createP1Module -sENVIRONMENT=worker \
  -sALLOW_MEMORY_GROWTH=1 -sFILESYSTEM=0 \
  -sEXPORTED_FUNCTIONS="['_malloc','_free','_p1_init','_p1_button','_p1_ticks','_p1_run','_p1_lcd_ptr','_p1_icons','_p1_sound_deci_hz','_p1_rom_hash','_p1_is_ready','_p1_snapshot_bytes','_p1_save','_p1_load']" \
  -o dist/emu/p1_wasm.mjs

cp vendor/tamalib/LICENSE dist/emu/TAMALIB_LICENSE.txt
printf 'TamaLIB (c) Jean-Christophe Rona, GPLv2 or later; source https://github.com/jcrona/tamalib at %s\nPocket P1 bridge (c) project contributors, GPLv2 or later; source https://github.com/Unborne-Fetus/tamagotchi\nNO PROPRIETARY ROM INCLUDED.\n' "$TAMALIB_COMMIT" > dist/emu/THIRD_PARTY.txt
test -s dist/emu/p1_wasm.mjs
test -s dist/emu/p1_wasm.wasm
echo "Built ROM-free hardware emulator."
