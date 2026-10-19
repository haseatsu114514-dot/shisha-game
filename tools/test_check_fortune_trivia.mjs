import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.join(__dirname, 'check_fortune_trivia.cjs');

function withTempDir(fn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fortune-trivia-test-'));
  try {
    return fn(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runValidatorCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
  });
}

function writeAndRunWithByteCheck(tempDir, fileName, rawContent) {
  const filePath = path.join(tempDir, fileName);
  const beforeBytes = Buffer.from(rawContent, 'utf8');
  fs.writeFileSync(filePath, beforeBytes);

  const result = runValidatorCli([filePath]);

  const afterBytes = fs.readFileSync(filePath);
  assert.equal(
    Buffer.compare(beforeBytes, afterBytes),
    0,
    `Input file ${fileName} must remain byte-for-byte unchanged`
  );

  return result;
}

test('valid fixture with gaps, variable counts, empty list, and unknown metadata exits 0', () => {
  withTempDir((tempDir) => {
    const payload = {
      draft: true,
      note: 'Candidate fortune trivia batch',
      extraRootMeta: { version: 2 },
      characters: {
        akari: [
          {
            id: 'akari_fortune_01',
            teller: 'Teller line 1',
            reaction: 'Reaction line 1',
            extraEntryMeta: 'allowed',
          },
          {
            id: 'akari_fortune_05',
            teller: 'Teller line 5 (gap allowed)',
            reaction: 'Reaction line 5',
          },
        ],
        aoi: [
          {
            id: 'aoi_fortune_10',
            teller: 'Aoi teller',
            reaction: 'Aoi reaction',
          },
        ],
        empty_char: [],
        case_variant: [
          {
            id: 'Akari_Fortune_01',
            teller: 'Case-sensitive distinct ID',
            reaction: 'Allowed reaction',
          },
        ],
      },
    };

    const result = writeAndRunWithByteCheck(
      tempDir,
      'valid.json',
      `${JSON.stringify(payload, null, 2)}\n`
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /^OK\r?\n$/);
    assert.equal(result.stderr, '');
  });
});

test('duplicate IDs within same character and across characters exit 1 without leaking dialogue', () => {
  withTempDir((tempDir) => {
    const secretDialogue = 'SECRET_DIALOGUE_TEXT_DO_NOT_PRINT_98765';
    const payload = {
      draft: false,
      note: 'Duplicate test',
      characters: {
        char_a: [
          {
            id: 'shared_id_01',
            teller: secretDialogue,
            reaction: secretDialogue,
          },
          {
            id: 'shared_id_01',
            teller: secretDialogue,
            reaction: secretDialogue,
          },
        ],
        char_b: [
          {
            id: 'shared_id_01',
            teller: secretDialogue,
            reaction: secretDialogue,
          },
        ],
      },
    };

    const result = writeAndRunWithByteCheck(
      tempDir,
      'duplicates.json',
      JSON.stringify(payload)
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /character "char_a" index 1 field "id": duplicate id/);
    assert.match(result.stderr, /character "char_b" index 0 field "id": duplicate id/);
    assert.ok(!result.stderr.includes(secretDialogue));
    assert.ok(!result.stdout.includes(secretDialogue));
  });
});

test('blank and whitespace-only id/teller/reaction exit 1 and report location', () => {
  withTempDir((tempDir) => {
    const secretDialogue = 'SECRET_REACTION_LINE_445566';
    const payload = {
      characters: {
        suzume: [
          {
            id: '   ',
            teller: '\n\t ',
            reaction: secretDialogue,
          },
          {
            id: 'suzume_02',
            teller: 'Valid teller',
            reaction: '',
          },
        ],
      },
    };

    const result = writeAndRunWithByteCheck(
      tempDir,
      'blank_fields.json',
      JSON.stringify(payload)
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /character "suzume" index 0 field "id": must be a non-blank string/);
    assert.match(result.stderr, /character "suzume" index 0 field "teller": must be a non-blank string/);
    assert.match(result.stderr, /character "suzume" index 1 field "reaction": must be a non-blank string/);
    assert.ok(!result.stderr.includes(secretDialogue));
    assert.ok(!result.stdout.includes(secretDialogue));
  });
});

test('type errors at root, characters, character list, entry, and fields exit 1', () => {
  withTempDir((tempDir) => {
    for (const [name, invalidRoot] of [
      ['root_array.json', []],
      ['root_null.json', null],
      ['characters_missing.json', { draft: true }],
      ['characters_array.json', { characters: [] }],
      ['characters_null.json', { characters: null }],
    ]) {
      const res = writeAndRunWithByteCheck(tempDir, name, JSON.stringify(invalidRoot));
      assert.equal(res.status, 1, `Expected exit 1 for ${name}`);
    }

    const secretText = 'NEVER_LEAK_THIS_LINE_112233';
    const complexInvalid = {
      characters: {
        not_an_array: { id: 'x', teller: secretText, reaction: secretText },
        mixed_entries: [
          null,
          ['array_entry'],
          {
            id: 123,
            teller: null,
            reaction: { text: secretText },
          },
          {
            id: 'valid_id_1',
          },
        ],
      },
    };

    const result = writeAndRunWithByteCheck(
      tempDir,
      'complex_invalid.json',
      JSON.stringify(complexInvalid)
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /character "not_an_array": entries must be an array/);
    assert.match(result.stderr, /character "mixed_entries" index 0: entry must be an object/);
    assert.match(result.stderr, /character "mixed_entries" index 1: entry must be an object/);
    assert.match(result.stderr, /character "mixed_entries" index 2 field "id": must be a string/);
    assert.match(result.stderr, /character "mixed_entries" index 2 field "teller": must be a string/);
    assert.match(result.stderr, /character "mixed_entries" index 2 field "reaction": must be a string/);
    assert.match(result.stderr, /character "mixed_entries" index 3 field "teller": must be a string/);
    assert.match(result.stderr, /character "mixed_entries" index 3 field "reaction": must be a string/);
    assert.ok(!result.stderr.includes(secretText));
    assert.ok(!result.stdout.includes(secretText));
  });
});

test('invalid JSON exits 2 without leaking source snippets and leaves input unchanged', () => {
  withTempDir((tempDir) => {
    const secretSnippet = 'TOP_SECRET_BROKEN_JSON_DIALOGUE_SNIPPET';
    const brokenJson = `{"characters": {"akari": [{"id": "1", "teller": "${secretSnippet}" INVALID_TOKEN}]}}`;

    const result = writeAndRunWithByteCheck(tempDir, 'broken.json', brokenJson);

    assert.equal(result.status, 2);
    assert.ok(!result.stderr.includes(secretSnippet));
    assert.ok(!result.stdout.includes(secretSnippet));
    assert.ok(!result.stderr.includes('INVALID_TOKEN'));
  });
});

test('missing arguments, extra arguments, missing file, and directory path exit 2', () => {
  withTempDir((tempDir) => {
    const noArgs = runValidatorCli([]);
    assert.equal(noArgs.status, 2);

    const blankArg = runValidatorCli(['   ']);
    assert.equal(blankArg.status, 2);

    const twoArgs = runValidatorCli(['a.json', 'b.json']);
    assert.equal(twoArgs.status, 2);

    const missingFile = runValidatorCli([path.join(tempDir, 'does_not_exist.json')]);
    assert.equal(missingFile.status, 2);

    const dirAsInput = runValidatorCli([tempDir]);
    assert.equal(dirAsInput.status, 2);
  });
});
