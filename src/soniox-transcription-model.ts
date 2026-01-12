import {
  AISDKError,
  SharedV3Warning,
  TranscriptionModelV3,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  convertBase64ToUint8Array,
  createJsonResponseHandler,
  delay,
  getFromApi,
  mediaTypeToExtension,
  parseProviderOptions,
  postFormDataToApi,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { SonioxConfig } from './soniox-config';
import { sonioxFailedResponseHandler } from './soniox-error';
import {
  SonioxTranscriptionModelId,
  sonioxTranscriptionProviderOptionsSchema,
} from './soniox-transcription-options';
import {
  SonioxCreateTranscriptionRequest,
  SonioxTranscriptToken,
} from './soniox-api-types';

const sonioxUploadResponseSchema = z.object({
  id: z.string(),
});

const sonioxCreateTranscriptionResponseSchema = z.object({
  id: z.string(),
  status: z.string().nullish(),
});

const sonioxTranscriptionStatusResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  audio_duration_ms: z.number().nullish(),
  error_message: z.string().nullish(),
});

const sonioxTranscriptResponseSchema = z.object({
  id: z.string(),
  text: z.string().nullish(),
  tokens: z
    .array(
      z.object({
        text: z.string(),
        start_ms: z.number().nullish(),
        end_ms: z.number().nullish(),
        confidence: z.number().nullish(),
        speaker: z.union([z.number(), z.string()]).nullish(),
        language: z.string().nullish(),
        translation_status: z.string().nullish(),
      }),
    )
    .nullish(),
});

interface SonioxTranscriptionModelConfig extends SonioxConfig {
  _internal?: {
    currentDate?: () => Date;
  };
  pollingIntervalMs?: number;
}

export class SonioxTranscriptionModel implements TranscriptionModelV3 {
  readonly specificationVersion = 'v3';
  private readonly POLLING_INTERVAL_MS = 1000;

  get provider(): string {
    return this.config.provider;
  }

  constructor(
    readonly modelId: SonioxTranscriptionModelId,
    private readonly config: SonioxTranscriptionModelConfig,
  ) {}

  private mapContext(
    context: z.infer<
      typeof sonioxTranscriptionProviderOptionsSchema
    >['context'],
  ): SonioxCreateTranscriptionRequest['context'] | undefined {
    if (!context) return undefined;

    if (typeof context === 'string') {
      return context;
    }

    return {
      general: context.general ?? undefined,
      text: context.text ?? undefined,
      terms: context.terms ?? undefined,
      translation_terms: context.translationTerms ?? undefined,
    };
  }

  private mapTranslation(
    translation: z.infer<
      typeof sonioxTranscriptionProviderOptionsSchema
    >['translation'],
  ): SonioxCreateTranscriptionRequest['translation'] | undefined {
    if (!translation) return undefined;

    if (translation.type === 'one_way') {
      return {
        type: 'one_way',
        target_language: translation.targetLanguage,
      };
    }

    return {
      type: 'two_way',
      language_a: translation.languageA,
      language_b: translation.languageB,
    };
  }

  private buildSegments(tokens: SonioxTranscriptToken[] | null | undefined) {
    if (!tokens) return [];

    // Soniox tokens that are trasncription tokens will always have start_ms and end_ms
    // But translation tokens we want to skip here. And are exposed in providerMetadata.soniox.tokens
    return tokens
      .filter(
        token =>
          typeof token.start_ms === 'number' &&
          typeof token.end_ms === 'number',
      )
      .map(token => ({
        text: token.text,
        startSecond: token.start_ms! / 1000,
        endSecond: token.end_ms! / 1000,
      }));
  }

  // Soniox returns language for each token, so we need to find the most common language
  private getLanguageFromTokens(
    tokens: SonioxTranscriptToken[] | null | undefined,
  ) {
    if (!tokens) return undefined;

    const counts = new Map<string, number>();
    for (const token of tokens) {
      const language = token.language ?? undefined;
      if (!language) continue;
      counts.set(language, (counts.get(language) ?? 0) + 1);
    }

    let bestLanguage: string | undefined;
    let bestCount = 0;
    for (const [language, count] of counts) {
      if (count > bestCount) {
        bestLanguage = language;
        bestCount = count;
      }
    }

    return bestLanguage;
  }

  private async tryDeleteResource({
    path,
    headers,
    warnings,
    description,
  }: {
    path: string;
    headers: Record<string, string | undefined>;
    warnings: SharedV3Warning[];
    description: string;
  }) {
    const fetch = this.config.fetch ?? globalThis.fetch;

    try {
      const filteredHeaders = Object.fromEntries(
        Object.entries(headers).filter(([, value]) => value !== undefined),
      ) as Record<string, string>;

      const response = await fetch(
        this.config.url({ path, modelId: this.modelId }),
        {
          method: 'DELETE',
          headers: filteredHeaders,
        },
      );

      if (!response.ok) {
        let responseText = '';
        try {
          responseText = await response.text();
        } catch {
          responseText = '';
        }

        throw new Error(
          `HTTP ${response.status} ${response.statusText}${responseText ? `: ${responseText}` : ''}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push({
        type: 'other',
        message: `Failed to auto-delete ${description}: ${message}`,
      });
    }
  }

  async doGenerate(
    options: Parameters<TranscriptionModelV3['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<TranscriptionModelV3['doGenerate']>>> {
    const currentDate = this.config._internal?.currentDate?.() ?? new Date();
    const warnings: SharedV3Warning[] = [];

    const sonioxOptions = await parseProviderOptions({
      provider: 'soniox',
      providerOptions: options.providerOptions,
      schema: sonioxTranscriptionProviderOptionsSchema,
    });

    let fileId: string | undefined;
    let transcriptionId: string | undefined;
    const requestHeaders = combineHeaders(
      this.config.headers(),
      options.headers,
    );

    try {
      const blob =
        options.audio instanceof Uint8Array
          ? new Blob([options.audio as BlobPart])
          : new Blob([convertBase64ToUint8Array(options.audio) as BlobPart]);

      const fileExtension = mediaTypeToExtension(options.mediaType);
      const formData = new FormData();
      formData.append(
        'file',
        new File([blob], `audio.${fileExtension}`, {
          type: options.mediaType,
        }),
      );

      const { value: uploadResponse } = await postFormDataToApi({
        url: this.config.url({
          path: '/v1/files',
          modelId: this.modelId,
        }),
        headers: requestHeaders,
        formData,
        failedResponseHandler: sonioxFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          sonioxUploadResponseSchema,
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch,
      });

      fileId = uploadResponse.id;

      const body: SonioxCreateTranscriptionRequest = {
        model: this.modelId,
        file_id: fileId,
        language_hints: sonioxOptions?.languageHints ?? undefined,
        enable_language_identification:
          sonioxOptions?.enableLanguageIdentification ?? undefined,
        enable_speaker_diarization:
          sonioxOptions?.enableSpeakerDiarization ?? undefined,
        context: this.mapContext(sonioxOptions?.context),
        client_reference_id: sonioxOptions?.clientReferenceId ?? undefined,
        webhook_url: sonioxOptions?.webhookUrl ?? undefined,
        webhook_auth_header_name:
          sonioxOptions?.webhookAuthHeaderName ?? undefined,
        webhook_auth_header_value:
          sonioxOptions?.webhookAuthHeaderValue ?? undefined,
        translation: this.mapTranslation(sonioxOptions?.translation),
      };

      const { value: submitResponse } = await postJsonToApi({
        url: this.config.url({
          path: '/v1/transcriptions',
          modelId: this.modelId,
        }),
        headers: requestHeaders,
        body,
        failedResponseHandler: sonioxFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          sonioxCreateTranscriptionResponseSchema,
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch,
      });

      transcriptionId = submitResponse.id;

      const pollingInterval =
        this.config.pollingIntervalMs ?? this.POLLING_INTERVAL_MS;
      const timeoutMs = 3 * 60 * 1000;
      const startTime = Date.now();

      let statusResponse:
        | z.infer<typeof sonioxTranscriptionStatusResponseSchema>
        | undefined;

      while (true) {
        if (Date.now() - startTime > timeoutMs) {
          throw new AISDKError({
            message: 'Transcription job polling timed out',
            name: 'TranscriptionJobPollingTimedOut',
            cause: statusResponse,
          });
        }

        if (options.abortSignal?.aborted) {
          throw new Error('Transcription request was aborted');
        }

        const { value } = await getFromApi({
          url: this.config.url({
            path: `/v1/transcriptions/${submitResponse.id}`,
            modelId: this.modelId,
          }),
          headers: requestHeaders,
          failedResponseHandler: sonioxFailedResponseHandler,
          successfulResponseHandler: createJsonResponseHandler(
            sonioxTranscriptionStatusResponseSchema,
          ),
          abortSignal: options.abortSignal,
          fetch: this.config.fetch,
        });

        statusResponse = value;

        if (statusResponse.status === 'completed') {
          break;
        }

        if (statusResponse.status === 'error') {
          throw new AISDKError({
            message: `Transcription failed: ${statusResponse.error_message ?? 'Unknown error'}`,
            name: 'TranscriptionJobFailed',
            cause: statusResponse,
          });
        }

        await delay(pollingInterval);
      }

      const {
        value: transcriptResponse,
        responseHeaders,
        rawValue: rawResponse,
      } = await getFromApi({
        url: this.config.url({
          path: `/v1/transcriptions/${submitResponse.id}/transcript`,
          modelId: this.modelId,
        }),
        headers: requestHeaders,
        failedResponseHandler: sonioxFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          sonioxTranscriptResponseSchema,
        ),
        abortSignal: options.abortSignal,
        fetch: this.config.fetch,
      });

      const tokens = transcriptResponse.tokens ?? [];
      const segments = this.buildSegments(tokens);
      const language = this.getLanguageFromTokens(tokens);

      return {
        text: transcriptResponse.text ?? '',
        segments,
        language,
        durationInSeconds:
          typeof statusResponse.audio_duration_ms === 'number'
            ? statusResponse.audio_duration_ms / 1000
            : undefined,
        warnings,
        response: {
          timestamp: currentDate,
          modelId: this.modelId,
          headers: responseHeaders,
          body: rawResponse,
        },
        providerMetadata: {
          soniox: {
            tokens,
          },
        },
      };
    } finally {
      if (transcriptionId) {
        await this.tryDeleteResource({
          path: `/v1/transcriptions/${transcriptionId}`,
          headers: requestHeaders,
          warnings,
          description: `transcription ${transcriptionId}`,
        });
      }

      if (fileId) {
        await this.tryDeleteResource({
          path: `/v1/files/${fileId}`,
          headers: requestHeaders,
          warnings,
          description: `file ${fileId}`,
        });
      }
    }
  }
}
