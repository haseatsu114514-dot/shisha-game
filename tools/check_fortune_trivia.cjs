#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const EXIT_OK = 0;
const EXIT_INVALID_DATA = 1;
const EXIT_USAGE_OR_IO = 2;

const REQUIRED_STRING_FIELDS = ['id', 'teller', 'reaction'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateFortuneTriviaData(data) {
  const errors = [];

  if (!isPlainObject(data)) {
    errors.push('root: must be a JSON object');
    return errors;
  }

  if (!isPlainObject(data.characters)) {
    errors.push('characters: must be a JSON object');
    return errors;
  }

  const seenIds = new Map();

  for (const [characterId, entries] of Object.entries(data.characters)) {
    if (!Array.isArray(entries)) {
      errors.push(`character "${characterId}": entries must be an array`);
      continue;
    }

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const prefix = `character "${characterId}" index ${index}`;

      if (!isPlainObject(entry)) {
        errors.push(`${prefix}: entry must be an object`);
        continue;
      }

      for (const field of REQUIRED_STRING_FIELDS) {
        const value = entry[field];
        if (typeof value !== 'string') {
          errors.push(`${prefix} field "${field}": must be a string`);
        } else if (value.trim().length === 0) {
          errors.push(`${prefix} field "${field}": must be a non-blank string`);
        }
      }

      if (typeof entry.id === 'string' && entry.id.trim().length > 0) {
        const firstSeen = seenIds.get(entry.id);
        if (firstSeen) {
          errors.push(
            `${prefix} field "id": duplicate id (first seen at character "${firstSeen.characterId}" index ${firstSeen.index} field "id")`
          );
        } else {
          seenIds.set(entry.id, { characterId, index });
        }
      }
    }
  }

  return errors;
}

function runCli(argv = process.argv.slice(2), io = { stdout: process.stdout, stderr: process.stderr }) {
  if (!Array.isArray(argv) || argv.length !== 1 || typeof argv[0] !== 'string' || argv[0].trim().length === 0) {
    io.stderr.write('Usage: node tools/check_fortune_trivia.cjs <input-json-path>\n');
    return EXIT_USAGE_OR_IO;
  }

  const filePath = argv[0];
  let rawText;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      io.stderr.write('Error: input path is not a regular file\n');
      return EXIT_USAGE_OR_IO;
    }
    rawText = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    const code = err && typeof err.code === 'string' ? ` (${err.code})` : '';
    io.stderr.write(`Error: failed to read input file${code}\n`);
    return EXIT_USAGE_OR_IO;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    io.stderr.write('Error: failed to parse input file as JSON\n');
    return EXIT_USAGE_OR_IO;
  }

  const errors = validateFortuneTriviaData(parsed);
  if (errors.length > 0) {
    for (const message of errors) {
      io.stderr.write(`Validation error: ${message}\n`);
    }
    return EXIT_INVALID_DATA;
  }

  io.stdout.write('OK\n');
  return EXIT_OK;
}

if (require.main === module) {
  process.exitCode = runCli();
}

module.exports = {
  EXIT_OK,
  EXIT_INVALID_DATA,
  EXIT_USAGE_OR_IO,
  validateFortuneTriviaData,
  runCli,
};
