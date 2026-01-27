import {
  TranscriptionModelV3,
  ProviderV3,
  NoSuchModelError,
} from "@ai-sdk/provider";
import {
  FetchFunction,
  loadApiKey,
  withUserAgentSuffix,
} from "@ai-sdk/provider-utils";
import { SonioxTranscriptionModel } from "./soniox-transcription-model";
import { SonioxTranscriptionModelId } from "./soniox-transcription-options";
import { VERSION } from "./version";

export interface SonioxProvider extends ProviderV3 {
  (modelId: string, settings?: {}): {
    transcription: SonioxTranscriptionModel;
  };

  /**
Creates a model for transcription.
   */
  transcription(modelId: SonioxTranscriptionModelId): TranscriptionModelV3;

  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

export interface SonioxProviderSettings {
  /**
API key for authenticating requests.
     */
  apiKey?: string;

  /**
Base URL for Soniox API requests.
   */
  apiBaseUrl?: string;

  /**
Custom headers to include in the requests.
     */
  headers?: Record<string, string>;

  /**
Custom fetch implementation. You can use it as a middleware to intercept requests,
or to provide a custom fetch implementation for e.g. testing.
    */
  fetch?: FetchFunction;

  /**
Polling interval for async transcription status checks in milliseconds.
     */
  pollingIntervalMs?: number;

  /**
   * Timeout for transcription job polling in milliseconds.
   * Default: 300,000 (5 minutes).
   */
  timeoutMs?: number;
}

/**
Create a Soniox provider instance.
 */
export function createSoniox(
  options: SonioxProviderSettings = {}
): SonioxProvider {
  const getHeaders = () =>
    withUserAgentSuffix(
      {
        authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: "SONIOX_API_KEY",
          description: "Soniox",
        })}`,
        ...options.headers,
      },
      `soniox/vercel-ai-sdk-provider/${VERSION}`
    );

  const apiBaseUrl = options.apiBaseUrl ?? "https://api.soniox.com";

  const createTranscriptionModel = (modelId: SonioxTranscriptionModelId) =>
    new SonioxTranscriptionModel(modelId, {
      provider: `soniox.transcription`,
      url: ({ path }) => new URL(path, apiBaseUrl).toString(),
      headers: getHeaders,
      fetch: options.fetch,
      pollingIntervalMs: options.pollingIntervalMs,
      timeoutMs: options.timeoutMs,
    });

  const provider = function (modelId: SonioxTranscriptionModelId) {
    return {
      transcription: createTranscriptionModel(modelId),
    };
  };

  provider.specificationVersion = "v3" as const;
  provider.transcription = createTranscriptionModel;
  provider.transcriptionModel = createTranscriptionModel;

  provider.languageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: "languageModel",
      message: "Soniox does not provide language models",
    });
  };

  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: "embeddingModel",
      message: "Soniox does not provide embedding models",
    });
  };
  provider.textEmbeddingModel = provider.embeddingModel;

  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({
      modelId,
      modelType: "imageModel",
      message: "Soniox does not provide image models",
    });
  };

  return provider as SonioxProvider;
}

/**
Default Soniox provider instance.
 */
export const soniox = createSoniox();
