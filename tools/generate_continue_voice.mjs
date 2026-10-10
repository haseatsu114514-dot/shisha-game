#!/usr/bin/env node
// Claude Code / Mac 用: VOICEVOX ENGINE(127.0.0.1:50021) からコンティニュー音声を作る。
// 追加のnpm依存なし。Node 20+, ffmpeg, ffprobe, VOICEVOX ENGINE が必要。
// 例: node tools/generate_continue_voice.mjs --target sumi
//     node tools/generate_continue_voice.mjs --target premium_tsumugi --speaker 8
//     node tools/generate_continue_voice.mjs --list
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const i = flags.indexOf(name);
  return i >= 0 && flags[i + 1] ? flags[i + 1] : fallback;
};
const target = arg("--target", "sumi");
const host = arg("--engine", "http://127.0.0.1:50021").replace(/\/$/, "");
const speakerName = arg("--voice", target === "sumi" ? "麒ヶ島宗麟" : null);
const explicitSpeaker = arg("--speaker");
const baseSpeed = Number(arg("--speed", target === "sumi" ? "1.48" : "1.10"));
const dryRun = flags.includes("--dry-run");
if (!(baseSpeed > 0 && baseSpeed <= 3)) throw new Error("--speed は 0 より大きく 3 以下に指定してください");

function expressionFrom(file, name) {
  const text = fs.readFileSync(path.join(repo, file), "utf8");
  const marker = `export const ${name} =`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`${file}: ${name} が見つかりません`);
  let pos = text.indexOf("=", start) + 1;
  while (/\s/.test(text[pos])) pos++;
  const opener = text[pos];
  if (opener !== "[" && opener !== "{") throw new Error("想定外の台本形式");
  const closer = opener === "[" ? "]" : "}";
  let depth = 0, quote = null, escaped = false;
  for (let i = pos; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === opener) depth++;
    if (c === closer && --depth === 0) return text.slice(pos, i + 1);
  }
  throw new Error("台本の終了位置が検出できません");
}
function scripts() {
  const sumi = vm.runInNewContext("(" + expressionFrom("remake/js/chapters/gameover.js", "SUMI_CONTINUE_SCRIPTS") + ")");
  const premium = vm.runInNewContext("(" + expressionFrom("remake/js/chapters/continue-premium.js", "PREMIUM_CONTINUE_SCRIPTS") + ")");
  return [...sumi, ...Object.values(premium)];
}
const selected = scripts().filter(x => target === "all" || target === "sumi" && x.id.startsWith("premium_") === false || x.id === target);
if (target !== "all" && !selected.length) throw new Error("対象がありません: " + target);
if (dryRun) {
  for (const s of selected) console.log(`${s.id} — ${s.cues.length}行 / ${s.duration}秒予定`);
  process.exit(0);
}
function command(bin, args) {
  return execFileSync(bin, args, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" }).trim();
}
function duration(file) {
  return Number(command("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]));
}
function tempoChain(ratio) {
  const result = [];
  while (ratio > 2) { result.push("atempo=2"); ratio /= 2; }
  while (ratio < .5) { result.push("atempo=0.5"); ratio *= 2; }
  result.push(`atempo=${ratio.toFixed(5)}`);
  return result.join(",");
}
async function requestJson(endpoint, method = "GET", body = null) {
  const r = await fetch(host + endpoint, {
    method, headers: body ? { "Content-Type": "application/json" } : {}, body: body && JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`VOICEVOX ${endpoint}: HTTP ${r.status} — ${await r.text()}`);
  return r.json();
}
let speakers;
try { speakers = await requestJson("/speakers"); }
catch (e) {
  throw new Error(`VOICEVOX ENGINEに接続できません (${host})。公式アプリでエンジンを起動してから再実行してください。詳細: ${e.message}`);
}
if (flags.includes("--list")) {
  for (const sp of speakers) for (const style of sp.styles) console.log(`${sp.name} / ${style.name}: ${style.id}`);
  process.exit(0);
}
const voice = speakerName && speakers.find(s => s.name === speakerName);
const style = Number.isInteger(Number(explicitSpeaker)) && explicitSpeaker != null
  ? Number(explicitSpeaker) : voice?.styles?.[0]?.id;
if (!Number.isInteger(style)) throw new Error("話者が不明です。--list で確認して --voice または --speaker を指定してください");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suien-continue-"));
const outDir = path.join(repo, "assets/audio/voice/continue");
fs.mkdirSync(outDir, { recursive: true });
try {
  for (const s of selected) {
    console.log(`\n合成: ${s.id} (speaker=${style})`);
    const wavs = [];
    for (let i = 0; i < s.cues.length; i++) {
      const cue = s.cues[i];
      const qs = new URLSearchParams({ text: cue.text, speaker: String(style) });
      const query = await requestJson("/audio_query?" + qs, "POST");
      query.speedScale = baseSpeed;
      query.pitchScale = target === "sumi" ? -0.03 : 0;
      query.intonationScale = target === "sumi" ? 1.15 : 1.0;
      const response = await fetch(host + "/synthesis?speaker=" + style, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query),
      });
      if (!response.ok) throw new Error(`音声合成失敗: ${response.status} ${await response.text()}`);
      const wav = path.join(tmp, `${s.id}_${i}.wav`);
      fs.writeFileSync(wav, Buffer.from(await response.arrayBuffer()));
      wavs.push(wav);
    }
    const inputs = wavs.flatMap(x => ["-i", x]);
    const parts = [];
    for (let i = 0; i < s.cues.length; i++) {
      const slot = (s.cues[i + 1]?.at ?? s.duration) - s.cues[i].at;
      const original = duration(wavs[i]);
      if (!(slot > 0 && original > 0)) throw new Error("キューの秒数が不正: " + s.id);
      const speed = original / slot;
      // 台詞をキュー長に合わせる。スミさんは高速、つむぎはゆっくりが基調。
      parts.push(`[${i}:a]aresample=44100,${tempoChain(speed)},apad=whole_dur=${slot.toFixed(3)},atrim=0:${slot.toFixed(3)},asetpts=PTS-STARTPTS[v${i}]`);
      console.log(`  ${i + 1}/${s.cues.length}: ${original.toFixed(2)}s → ${slot.toFixed(2)}s (tempo ${speed.toFixed(2)}x)`);
    }
    const chain = s.cues.map((_, i) => `[v${i}]`).join("");
    parts.push(`${chain}concat=n=${s.cues.length}:v=0:a=1[out]`);
    const basename = s.id.startsWith("premium_") ? s.id : "sumi_" + s.id;
    const output = path.join(outDir, basename + ".mp3");
    command("ffmpeg", ["-y", "-loglevel", "error", ...inputs, "-filter_complex", parts.join(";"), "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "160k", output]);
    console.log(`完成: ${path.relative(repo, output)} (${duration(output).toFixed(2)}s)`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log("\n音声ファイルを確認後、各 continue 台本の audio に '../assets/audio/voice/continue/<id>.mp3' を設定してください。");
console.log("本編公開前に使用音声の正規クレジット・イントネーション・字幕タイミングを確認してください。");
