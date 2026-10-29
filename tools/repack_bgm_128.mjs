#!/usr/bin/env node
// Usage: node tools/repack_bgm_128.mjs pack <encoded-mp3-dir> <bgm-dir> [audio.js]
//        node tools/repack_bgm_128.mjs unpack <bgm-dir> <output-mp3-dir> [audio.js]
// The caller uses ffmpeg for encoding; this script keeps the game's AES-GCM wrapper.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, webcrypto } from 'node:crypto';

const [mode, inputDir, outputDir, audioSource = 'remake/js/core/audio.js'] = process.argv.slice(2);
if (!['pack', 'unpack'].includes(mode) || !inputDir || !outputDir) {
  console.error('Usage: repack_bgm_128.mjs pack|unpack <input-dir> <output-dir> [audio.js]');
  process.exit(2);
}
const source = await fs.readFile(audioSource, 'utf8');
const magic = source.match(/const PACKED_MAGIC = "([^"]+)";/)?.[1];
const keyHex = source.match(/const PACKED_KEY = "([0-9a-f]+)";/)?.[1];
if (!magic || !keyHex || keyHex.length !== 64) throw new Error('Missing PACKED_MAGIC or PACKED_KEY in audio.js');
const header = Buffer.from(magic, 'utf8');
const key = await webcrypto.subtle.importKey('raw', Buffer.from(keyHex, 'hex'), 'AES-GCM', false, [mode === 'pack' ? 'encrypt' : 'decrypt']);
await fs.mkdir(outputDir, { recursive: true });
const names = (await fs.readdir(inputDir)).filter(name =>
  mode === 'pack' ? name.endsWith('.bgm.mp3') : name.endsWith('.bgm')).sort();
if (!names.length) throw new Error(`No .bgm ${mode === 'pack' ? 'MP3 inputs' : 'packs'} in ${inputDir}`);
for (const name of names) {
  const input = await fs.readFile(path.join(inputDir, name));
  const outputName = mode === 'pack' ? name.slice(0, -4) : `${name}.mp3`;
  let output;
  if (mode === 'pack') {
    if (input.subarray(0, 3).toString() !== 'ID3' && !(input[0] === 0xff && (input[1] & 0xe0) === 0xe0)) {
      throw new Error(`${name}: input is not an MP3`);
    }
    const nonce = randomBytes(12);
    const encrypted = Buffer.from(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: header }, key, input));
    output = Buffer.concat([header, nonce, encrypted]);
  } else {
    if (input.length < header.length + 12 + 16 || !input.subarray(0, header.length).equals(header)) {
      throw new Error(`${name}: invalid game BGM header`);
    }
    output = Buffer.from(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: input.subarray(header.length, header.length + 12), additionalData: header }, key, input.subarray(header.length + 12)));
  }
  const destination = path.join(outputDir, outputName);
  const temporary = `${destination}.tmp`;
  await fs.writeFile(temporary, output);
  await fs.rename(temporary, destination);
  console.log(`${name} -> ${outputName}: ${input.length} -> ${output.length} bytes`);
}
