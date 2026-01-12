# Soniox AI SDK Provider (Community)

Community-maintained Soniox provider for the [Vercel AI SDK](https://ai-sdk.dev/docs).
This package currently supports Soniox transcription models.

## Setup

Install the provider:

```bash
pnpm add @soniox/ai-sdk-provider
```

## Provider Instance

Import the default provider instance `soniox` from `@soniox/ai-sdk-provider`:

```ts
import { soniox } from '@soniox/ai-sdk-provider';
```

## createSoniox Options

You can create a custom provider instance:

```ts
import { createSoniox } from '@soniox/ai-sdk-provider';

const soniox = createSoniox({
  apiKey: process.env.SONIOX_API_KEY,
  apiBaseUrl: 'https://api.soniox.com',
  headers: {
    'X-Custom-Header': 'value',
  },
  pollingIntervalMs: 1000,
});
```

Options:
- `apiKey`: override `SONIOX_API_KEY`.
- `apiBaseUrl`: custom API base URL.
- `headers`: additional request headers.
- `fetch`: custom fetch implementation.
- `pollingIntervalMs`: transcription polling interval in milliseconds.

## Supported Model IDs

- `stt-async-v3`

## Example

```ts
import { soniox } from '@soniox/ai-sdk-provider';
import { experimental_transcribe as transcribe } from 'ai';

const { text } = await transcribe({
  model: soniox.transcription('stt-async-v3'),
  audio: new URL(
    'https://github.com/vercel/ai/raw/refs/heads/main/examples/ai-core/data/galileo.mp3',
  ),
});
```

## Authentication

Set `SONIOX_API_KEY` in your environment or pass `apiKey` when creating the provider.

## Testing With Verdaccio

Start Verdaccio:

```bash
pnpm verdaccio --config verdaccio.yaml
```

Login and publish to the local registry:

```bash
npm adduser --registry http://localhost:4873
npm run publish:local
```

Install from another project:

```bash
npm set registry http://localhost:4873
pnpm add @soniox/ai-sdk-provider
```

Reset the registry after testing:

```bash
npm set registry https://registry.npmjs.org/
```

## Documentation

- Soniox API docs: https://soniox.com/docs
- AI SDK docs: https://ai-sdk.dev/docs
