import { ICONS, createGame, advanceGame, performAction } from "./engine.js";

const KEY = "p1-research-prototype-v1";
const canvas = document.getElementById("lcd");
const ctx = canvas.getContext("2d", { alpha: false });
const $ = id => document.getElementById(id);
let state;
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  state = saved && saved.version === 1 ? saved : createGame();
} catch { state = createGame(); }
let screen = "main";
let selected = -1, option = 0, meterPage = 0;

const labels = ["Feed", "Light", "Toilet", "Meter", "Game", "Medicine", "Discipline", "Call"];
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
function advance() { state = advanceGame(state); save(); }
function action(name, payload) { state = performAction(state, name, Date.now(), payload); save(); }
function dots(n) { return "♥".repeat(n) + "♡".repeat(4 - n); }
function paintBits(rows, ox, oy) {
  ctx.fillStyle = "#304833";
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "#") ctx.fillRect(ox + x, oy + y, 1, 1);
  }));
}
const PIXELS = {
  egg: ["..####..", ".#....#.", "#......#", "#......#", "#......#", ".#....#.", "..####.."],
  baby: ["..####..", ".######.", "##.##.##", "########", ".#....#.", "..####.."],
  child: ["..####..", ".######.", "##.##.##", "########", "##....##", ".######.", "..#..#.."],
  teen: [".##..##.", "########", "##.##.##", "########", ".######.", "..####..", ".##..##."],
  adult: ["..#..#..", ".######.", "##.##.##", "########", "##....##", ".######.", "..#..#.."]
};
function lcd() {
  ctx.fillStyle = "#cbd8ad"; ctx.fillRect(0, 0, 32, 16);
  ctx.fillStyle = "#b4c69b";
  for (let x = 0; x < 32; x += 4) for (let y = 0; y < 16; y += 4)
    if ((x + y) % 8 === 0) ctx.fillRect(x, y, 1, 1);
  if (state.phase === "setup" || screen === "clock") {
    // Independent original-looking clock placeholder; actual glyphs TBD.
    paintBits(["###.###.###", "#.#.#.#.#.#", "#.#.#.#.#.#", "#.#.#.#.#.#", "###.###.###"], 10, 5);
    return;
  }
  if (state.phase === "egg") {
    paintBits(PIXELS.egg, 12, 5);
    return;
  }
  if (state.phase === "finished") {
    paintBits([".#....#.", "###..###", ".######.", "..####..", "...##..."], 12, 5);
    return;
  }
  if (screen === "meter") {
    const value = meterPage === 1 ? state.discipline : meterPage === 2 ? state.hunger : meterPage === 3 ? state.happiness : Math.min(4, state.ageDays);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < value ? "#304833" : "#9eaf8b";
      ctx.fillRect(3 + i * 7, 5, 5, 6);
    }
    return;
  }
  if (screen === "menu") {
    const rows = option === 0 ? ["####....", "#..#....", "####....", "#.......", "#......."] :
      ["....####", "....#..#", "....####", ".......#", ".......#"];
    paintBits(rows, 12, 6);
    return;
  }
  if (screen === "game") {
    paintBits(PIXELS[state.stage] || PIXELS.baby, state.game?.lastDirection === "left" ? 3 : 21, 5);
    return;
  }
  const poseOffset = Math.floor(Date.now() / 650) % 2;
  paintBits(PIXELS[state.stage] || PIXELS.baby, 11 + poseOffset, 5);
  for (let i = 0; i < state.waste; i++) paintBits(["##", "##"], 26 - i * 3, 12);
  if (state.sick) paintBits(["###", ".#.", "###"], 26, 1);
  if (!state.lightsOn) {
    ctx.fillStyle = "#485b3e"; ctx.fillRect(0, 0, 32, 16);
  }
}
function render() {
  advance();
  const inPet = state.phase === "alive";
  for (const [id, group] of [["top-icons", labels.slice(0, 4)], ["bottom-icons", labels.slice(4)]]) {
    $(id).replaceChildren(...group.map((text, i) => {
      const index = i + (id === "bottom-icons" ? 4 : 0);
      const el = document.createElement("span");
      el.textContent = text;
      if (inPet && selected === index && screen === "main") el.classList.add("active");
      if (index === 7 && state.call) el.classList.add("attention");
      return el;
    }));
  }
  lcd();
  const stage = state.phase === "alive" ? state.stage : state.phase;
  let heading = stage[0].toUpperCase() + stage.slice(1);
  let help = "A cycles care icons, B confirms, C cancels. A+C mutes.";
  if (state.phase === "setup") {
    heading = "Set clock";
    help = "A increases hours · B increases minutes · C starts egg.";
  } else if (state.phase === "egg") {
    help = "Egg hatches about five minutes after setting clock. B shows clock.";
  } else if (state.phase === "finished") {
    help = "Lifecycle completed. A+C starts another egg.";
  } else if (screen === "clock") {
    heading = "Clock";
    help = "B or C returns to pet. Historical clock editing is not implemented yet.";
  } else if (screen === "menu") {
    heading = selected === 0 ? "Food choice" : "Light choice";
    help = "A switches choice · B confirms · C goes back.";
  } else if (screen === "meter") {
    heading = ["Age / weight", "Discipline", "Hungry", "Happy"][meterPage];
    help = "A or B advances to next meter page · C goes back.";
  } else if (screen === "game") {
    heading = "Guess left/right";
    help = "A guesses left, B guesses right; five rounds, three wins needed · C cancels.";
  }
  $("screen-label").textContent = heading;
  $("outcome").textContent = state.phase === "setup" ?
    `${String(state.clockHour).padStart(2, "0")}:${String(state.clockMinute).padStart(2, "0")}` :
    state.phase === "egg" ? "Hatching soon" :
    state.phase === "alive" ? state.lastOutcome : "Finished";
  $("stats").replaceChildren(...[
    "Character: " + (state.character || "—"),
    "Hungry: " + dots(state.hunger),
    "Happy: " + dots(state.happiness),
    "Discipline: " + state.discipline * 25 + "%",
    "Age: " + state.ageDays + " yr",
    "Weight: " + state.weight + " g",
    "Waste: " + state.waste,
    "Attention: " + (state.call || "none")
  ].map(item => { const el = document.createElement("span"); el.textContent = item; return el; }));
  $("help").textContent = help;
}
function press(which) {
  advance();
  if (state.phase === "setup") {
    action(which === "A" ? "hour" : which === "B" ? "minute" : "confirmClock");
    return render();
  }
  if (state.phase === "finished") return render();
  if (screen === "clock") {
    if (which !== "A") screen = "main";
    return render();
  }
  if (state.phase === "egg") {
    if (which === "B") screen = "clock";
    return render();
  }
  if (screen === "menu") {
    if (which === "A") option = 1 - option;
    else if (which === "C") screen = "main";
    else {
      if (selected === 0) action(option === 0 ? "meal" : "snack");
      else action("lights", option === 0);
      screen = "main"; selected = -1;
    }
  } else if (screen === "meter") {
    if (which === "C") { screen = "main"; selected = -1; }
    else meterPage = (meterPage + 1) % 4;
  } else if (screen === "game") {
    if (which === "C") {
      action("gameCancel"); screen = "main"; selected = -1;
    } else if (state.game?.rounds === 5) action("gameStart");
    else action("guess", which === "A" ? "left" : "right");
  } else if (screen === "main") {
    if (which === "A") selected = (selected + 1) % 7;
    else if (which === "C") selected = -1;
    else if (selected < 0) screen = "clock";
    else if (selected === 0 || selected === 1) { option = 0; screen = "menu"; }
    else if (selected === 2) { action("clean"); selected = -1; }
    else if (selected === 3) { meterPage = 0; screen = "meter"; }
    else if (selected === 4) { action("gameStart"); screen = "game"; }
    else if (selected === 5) { action("medicine"); selected = -1; }
    else if (selected === 6) { action("discipline"); selected = -1; }
  }
  render();
}
$("button-a").addEventListener("click", () => press("A"));
$("button-b").addEventListener("click", () => press("B"));
$("button-c").addEventListener("click", () => press("C"));
$("combo").addEventListener("click", () => {
  if (state.phase === "finished") action("restart");
  else if (state.phase === "alive" && screen === "main") action("mute");
  screen = "main"; selected = -1; render();
});
document.addEventListener("keydown", event => {
  if (/^(INPUT|TEXTAREA)$/.test(event.target.tagName)) return;
  const key = event.key.toLowerCase();
  const map = { a: "A", b: "B", c: "C", "1": "A", "2": "B", "3": "C" };
  if (key in map) { event.preventDefault(); press(map[key]); }
  if ((key === "c" && event.shiftKey) || (key === "a" && event.shiftKey)) $("combo").click();
});
$("export").addEventListener("click", () => {
  advance();
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "virtual-pet-save.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
});
$("import-save").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.version !== 1 || typeof parsed.phase !== "string" || !Number.isFinite(parsed.updatedAt)) throw new Error("Unknown save format");
    state = parsed; screen = "main"; selected = -1; save(); render();
  } catch (error) { alert("Save import failed: " + error.message); }
  event.target.value = "";
});
setInterval(render, 1_000);
render();
