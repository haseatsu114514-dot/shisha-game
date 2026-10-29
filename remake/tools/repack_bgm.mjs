#!/usr/bin/env node
// Re-encode an existing game BGM pack without putting its MP3 in the repository.
// Usage: node remake/tools/repack_bgm.mjs input.bgm output.bgm
import { createDecipheriv, createCipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const magic = Buffer.from('SUIENBGM1');
// This format key is also embedded in audio.js and pack_bgm.py; it is not DRM.
const key = Buffer.from('ac0152dff6217d519198cfba347e25d5dc5d853aaee8252f72da0bbdc626b8f2', 'hex');
const [source, output] = process.argv.slice(2);
if (!source || !output || source === output || !source.endsWith('.bgm') || !output.endsWith('.bgm')) {
  console.error('Usage: node remake/tools/repack_bgm.mjs input.bgm output.bgm');
  process.exit(2);
}
const temp = await mkdtemp(join(tmpdir(), 'shisha-bgm-'));
try {
  const packed = await readFile(source);
  if (packed.length < 37 || !packed.subarray(0, 9).equals(magic)) throw Error('Invalid BGM header');
  const decrypt = createDecipheriv('aes-256-gcm', key, packed.subarray(9, 21));
  decrypt.setAAD(magic);
  decrypt.setAuthTag(packed.subarray(-16));
  const plain = Buffer.concat([decrypt.update(packed.subarray(21, -16)), decrypt.final()]);
  const inputMp3 = join(temp, 'input.mp3');
  const outputMp3 = join(temp, 'output.mp3');
  await writeFile(inputMp3, plain);
  const encode = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', inputMp3,
    '-map', '0:a:0', '-map', '0:v?', '-map_metadata', '0', '-c:a', 'libmp3lame', '-b:a', '128k',
    '-c:v', 'copy', '-write_xing', '1', outputMp3], { encoding: 'utf8' });
  if (encode.status !== 0) throw Error(`ffmpeg failed: ${encode.stderr || encode.error}`);
  const encoded = await readFile(outputMp3);
  const nonce = randomBytes(12);
  const encrypt = createCipheriv('aes-256-gcm', key, nonce);
  encrypt.setAAD(magic);
  const repacked = Buffer.concat([magic, nonce, encrypt.update(encoded), encrypt.final(), encrypt.getAuthTag()]);
  await writeFile(output, repacked);
  console.log(`${source}: ${packed.length} -> ${repacked.length} bytes`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
