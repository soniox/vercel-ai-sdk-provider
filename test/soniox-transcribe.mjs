#!/usr/bin/env node

import { experimental_transcribe as transcribe } from 'ai';
import { createSoniox } from '../dist/index.mjs';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

// RUN: SONIOX_API_KEY=your-api-key npm run transcribe

// Parse arguments: [audio-file] [api-key]
// eslint-disable-next-line turbo/no-undeclared-env-vars
const apiKeyFromEnv = process.env.SONIOX_API_KEY;
const args = process.argv.slice(2);
const audioPath = args[0] ?? 'test/coffee_shop.mp3';
const apiKey = args[1] ?? apiKeyFromEnv;

if (!apiKey) {
  console.error('Error: API key is required.');
  console.error('Usage: npm run transcribe [audio-file] [api-key]');
  console.error('   or: SONIOX_API_KEY=your-key npm run transcribe [audio-file]');
  console.error(
    '   or: node test/soniox-transcribe.mjs [audio-file] [api-key]',
  );
  process.exit(1);
}

const soniox = createSoniox({ apiKey });

const audio = await readFile(audioPath);
const result = await transcribe({
  model: soniox.transcription('stt-async-v3'),
  audio,
});

console.log(JSON.stringify(result, null, 2));
