/*
 * Pocket P1 browser hardware adapter; new code under GPL-2.0-or-later.
 * TamaLIB (c) Jean-Christophe Rona; built separately from pinned upstream source.
 * There is intentionally NO bundled ROM.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include "../vendor/tamalib/tamalib.h"

#define P1_ROM_BYTES 16384u
#define P1_PROGRAM_WORDS 8192u
#define P1_LCD_BYTES 512u
#define P1_SNAPSHOT_MAGIC 0x50315356u  /* P1SV */
#define P1_SNAPSHOT_VERSION 1u

static u12_t program[P1_PROGRAM_WORDS];
static uint8_t matrix[P1_LCD_BYTES];
static uint8_t icons = 0;
static uint32_t buzzer_deci_hz = 0;
static uint8_t buzzer_on = 0;
static uint32_t loaded_rom_hash = 0;
static uint32_t virtual_timestamp = 0;
static uint8_t ready = 0;
static uint8_t halted = 0;

/* FNV-1a identifies which locally supplied firmware belongs to the save. */
static uint32_t checksum(const uint8_t *bytes, size_t count) {
    uint32_t hash = 2166136261u;
    size_t i;
    for (i = 0; i < count; i++) {
        hash ^= bytes[i];
        hash *= 16777619u;
    }
    return hash;
}
static void *hal_alloc(u32_t size) { return malloc(size); }
static void hal_dealloc(void *p) { free(p); }
static void hal_halt(void) { halted = 1; }
static bool_t hal_logs(log_level_t level) { (void)level; return 0; }
static void hal_log(log_level_t level, char *format, ...) { (void)level; (void)format; }
static timestamp_t hal_now(void) { return (timestamp_t)virtual_timestamp; }
static void hal_sleep(timestamp_t until) { virtual_timestamp = until; }
static void hal_frame(void) { }
static void hal_pixel(u8_t x, u8_t y, bool_t on) {
    if (x < 32u && y < 16u) matrix[y * 32u + x] = !!on;
}
static void hal_icon(u8_t index, bool_t on) {
    if (index < 8u) {
        if (on) icons |= (uint8_t)(1u << index);
        else icons &= (uint8_t)~(1u << index);
    }
}
static void hal_freq(u32_t freq) { buzzer_deci_hz = freq; }
static void hal_buzzer(bool_t on) { buzzer_on = !!on; }
static int hal_handler(void) { return 0; }
static hal_t hal = {
    .malloc = hal_alloc,
    .free = hal_dealloc,
    .halt = hal_halt,
    .is_log_enabled = hal_logs,
    .log = hal_log,
    .sleep_until = hal_sleep,
    .get_timestamp = hal_now,
    .update_screen = hal_frame,
    .set_lcd_matrix = hal_pixel,
    .set_lcd_icon = hal_icon,
    .set_frequency = hal_freq,
    .play_frequency = hal_buzzer,
    .handler = hal_handler
};

/* The ELF/wasm link exports only these p1_* calls and malloc/free. */
int p1_init(const uint8_t *bytes, uint32_t length) {
    uint32_t i;
    if (!bytes || length != P1_ROM_BYTES) return 0;
    for (i = 0; i < P1_PROGRAM_WORDS; i++) {
        uint16_t word = ((uint16_t)bytes[2*i] << 8) | bytes[2*i+1];
        if (word > 0x0fffu) return 0; /* 12-bit big-endian opcodes */
        program[i] = (u12_t)word;
    }
    if (ready) tamalib_release();
    loaded_rom_hash = checksum(bytes, length);
    memset(matrix, 0, sizeof(matrix));
    icons = 0; buzzer_deci_hz = 0; buzzer_on = 0;
    virtual_timestamp = 0; halted = 0;
    tamalib_register_hal(&hal);
    if (tamalib_init(program, NULL, 32768u)) return 0;
    ready = 1;
    return 1;
}
uint32_t p1_rom_hash(void) { return loaded_rom_hash; }
void p1_button(uint32_t button, uint32_t down) {
    if (ready && button < 3u)
        tamalib_set_button((button_t)button, down ? BTN_STATE_PRESSED : BTN_STATE_RELEASED);
}
uint32_t p1_ticks(void) {
    return ready ? *tamalib_get_state()->tick_counter : 0u;
}
/* Emulate a requested number of CPU ticks; pause after max_steps to keep worker responsive.
 * Returns 0 while still processing the requested tick quota, 1 when completed, -1 on fault.
 */
int p1_run(uint32_t requested_ticks, uint32_t max_steps) {
    uint32_t start, count = 0;
    if (!ready || halted || requested_ticks > 32768u * 60u) return -1;
    if (max_steps == 0u || max_steps > 250000u) return -1;
    start = p1_ticks();
    while ((uint32_t)(p1_ticks() - start) < requested_ticks && count < max_steps) {
        if (cpu_step()) { halted = 1; return -1; }
        count++;
    }
    return (uint32_t)(p1_ticks() - start) >= requested_ticks ? 1 : 0;
}
uint32_t p1_lcd_ptr(void) { return (uint32_t)(uintptr_t)matrix; }
uint32_t p1_icons(void) { return icons; }
uint32_t p1_sound_deci_hz(void) { return buzzer_on ? buzzer_deci_hz : 0u; }
int p1_is_ready(void) { return ready && !halted; }

/*
 * Save a stable, versioned snapshot without serializing CPU state pointers.
 * Internal TamaLIB CPU statics not exposed through state_t prevent claiming
 * mathematically exact restores after every possible instruction.
 */
typedef struct {
    uint32_t magic, version, rom_hash, bytes;
    uint16_t pc, x, y;
    uint8_t a, b, np, sp, flags;
    uint32_t tick_counter;
    uint32_t clk_2, clk_4, clk_8, clk_16, clk_32, clk_64, clk_128, clk_256;
    uint32_t prog_ts, call_depth;
    uint8_t prog_enabled, prog_data, prog_reload, cpu_halted;
    interrupt_t interrupts[INT_SLOT_NUM];
    MEM_BUFFER_TYPE memory[MEM_BUFFER_SIZE];
} p1_snapshot_t;

uint32_t p1_snapshot_bytes(void) { return (uint32_t)sizeof(p1_snapshot_t); }

int p1_save(uint8_t *out, uint32_t size) {
    p1_snapshot_t v;
    state_t *s;
    if (!ready || !out || size != sizeof(v)) return 0;
    s = tamalib_get_state();
    memset(&v, 0, sizeof(v));
    v.magic = P1_SNAPSHOT_MAGIC;
    v.version = P1_SNAPSHOT_VERSION;
    v.rom_hash = loaded_rom_hash;
    v.bytes = sizeof(v);
    v.pc = *s->pc; v.x = *s->x; v.y = *s->y;
    v.a = *s->a; v.b = *s->b; v.np = *s->np;
    v.sp = *s->sp; v.flags = *s->flags;
    v.tick_counter = *s->tick_counter;
    v.clk_2 = *s->clk_timer_2hz_timestamp;
    v.clk_4 = *s->clk_timer_4hz_timestamp;
    v.clk_8 = *s->clk_timer_8hz_timestamp;
    v.clk_16 = *s->clk_timer_16hz_timestamp;
    v.clk_32 = *s->clk_timer_32hz_timestamp;
    v.clk_64 = *s->clk_timer_64hz_timestamp;
    v.clk_128 = *s->clk_timer_128hz_timestamp;
    v.clk_256 = *s->clk_timer_256hz_timestamp;
    v.prog_ts = *s->prog_timer_timestamp;
    v.prog_enabled = *s->prog_timer_enabled;
    v.prog_data = *s->prog_timer_data;
    v.prog_reload = *s->prog_timer_rld;
    v.call_depth = *s->call_depth;
    v.cpu_halted = *s->cpu_halted;
    memcpy(v.interrupts, s->interrupts, sizeof(v.interrupts));
    memcpy(v.memory, s->memory, sizeof(v.memory));
    memcpy(out, &v, sizeof(v));
    return 1;
}
int p1_load(const uint8_t *data, uint32_t size) {
    p1_snapshot_t v;
    state_t *s;
    if (!ready || !data || size != sizeof(v)) return 0;
    memcpy(&v, data, sizeof(v));
    if (v.magic != P1_SNAPSHOT_MAGIC || v.version != P1_SNAPSHOT_VERSION ||
        v.rom_hash != loaded_rom_hash || v.bytes != sizeof(v)) return 0;
    s = tamalib_get_state();
    *s->pc = v.pc; *s->x = v.x; *s->y = v.y;
    *s->a = v.a; *s->b = v.b; *s->np = v.np;
    *s->sp = v.sp; *s->flags = v.flags;
    *s->tick_counter = v.tick_counter;
    *s->clk_timer_2hz_timestamp = v.clk_2;
    *s->clk_timer_4hz_timestamp = v.clk_4;
    *s->clk_timer_8hz_timestamp = v.clk_8;
    *s->clk_timer_16hz_timestamp = v.clk_16;
    *s->clk_timer_32hz_timestamp = v.clk_32;
    *s->clk_timer_64hz_timestamp = v.clk_64;
    *s->clk_timer_128hz_timestamp = v.clk_128;
    *s->clk_timer_256hz_timestamp = v.clk_256;
    *s->prog_timer_timestamp = v.prog_ts;
    *s->prog_timer_enabled = v.prog_enabled;
    *s->prog_timer_data = v.prog_data;
    *s->prog_timer_rld = v.prog_reload;
    *s->call_depth = v.call_depth;
    *s->cpu_halted = v.cpu_halted;
    memcpy(s->interrupts, v.interrupts, sizeof(v.interrupts));
    memcpy(s->memory, v.memory, sizeof(v.memory));
    virtual_timestamp = v.tick_counter;
    halted = v.cpu_halted;
    cpu_sync_ref_timestamp();
    tamalib_refresh_hw();
    return 1;
}
