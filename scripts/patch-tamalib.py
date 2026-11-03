#!/usr/bin/env python3
"""
GPL-2.0-or-later compatibility patch for pinned TamaLIB cpu.c.
The browser's local snapshots need internal clock, pin and instruction timing
values that TamaLIB's public state_t does not expose.
This script does not change CPU instruction decoding or emulator behavior.
"""
from pathlib import Path

target = Path("vendor/tamalib/cpu.c")
code = target.read_text(encoding="utf-8")
anchor = "int cpu_step(void)\n{"
local_static = "static u8_t previous_cycles = 0;"
if code.count(anchor) != 1 or code.count(local_static) != 1:
    raise SystemExit("Pinned TamaLIB source changed: refusing unsafe patch")

code = code.replace(
    anchor,
    "static u8_t p1_previous_cycles = 0;\n"
    "#define previous_cycles p1_previous_cycles\n"
    + anchor,
    1,
)
code = code.replace(
    local_static, "/* previous_cycles is file-static for exact save restoration */", 1
)

extension = r"""
/* Pocket P1 compatibility extension, GPL-2.0-or-later.
 * Pack private variables, which are missing from TamaLIB's public state_t.
 * Updating them is necessary for restoring timer phase and held input lines.
 */
#include <stdint.h>
#include <string.h>
typedef struct {
    uint32_t cpu_frequency;
    uint32_t accumulator;
    uint32_t reference_timestamp;
    uint8_t speed;
    uint8_t previous_cycles;
    uint8_t input0;
    uint8_t input1;
} p1_cpu_private_t;

uint32_t p1_cpu_private_size(void) {
    return (uint32_t)sizeof(p1_cpu_private_t);
}
void p1_cpu_private_save(uint8_t *dest) {
    p1_cpu_private_t v;
    memset(&v, 0, sizeof(v));
    v.cpu_frequency = cpu_frequency;
    v.accumulator = scaled_cycle_accumulator;
    v.reference_timestamp = ref_ts;
    v.speed = speed_ratio;
    v.previous_cycles = p1_previous_cycles;
    v.input0 = inputs[0].states;
    v.input1 = inputs[1].states;
    memcpy(dest, &v, sizeof(v));
}
void p1_cpu_private_load(const uint8_t *src) {
    p1_cpu_private_t v;
    memcpy(&v, src, sizeof(v));
    cpu_frequency = v.cpu_frequency;
    scaled_cycle_accumulator = v.accumulator;
    ref_ts = v.reference_timestamp;
    speed_ratio = v.speed;
    p1_previous_cycles = v.previous_cycles;
    inputs[0].states = v.input0;
    inputs[1].states = v.input1;
}
"""
target.write_text(code + extension, encoding="utf-8")
print("Patched pinned TamaLIB CPU snapshot interface")
