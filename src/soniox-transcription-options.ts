import { z } from 'zod/v4';

export type SonioxTranscriptionModelId = 'stt-async-v3' | (string & {});

const sonioxContextSchema = z
  .object({
    general: z
      .array(
        z.object({
          key: z.string(),
          value: z.string(),
        }),
      )
      .nullish(),
    text: z.string().nullish(),
    terms: z.array(z.string()).nullish(),
    translationTerms: z
      .array(
        z.object({
          source: z.string(),
          target: z.string(),
        }),
      )
      .nullish(),
  })
  .partial();

const sonioxTranslationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('one_way'),
    targetLanguage: z.string(),
  }),
  z.object({
    type: z.literal('two_way'),
    languageA: z.string(),
    languageB: z.string(),
  }),
]);

export const sonioxTranscriptionProviderOptionsSchema = z.object({
  /**
   * Language hints to improve recognition.
   */
  languageHints: z.array(z.string()).nullish(),
  /**
   * Whether to enable automatic language identification.
   */
  enableLanguageIdentification: z.boolean().nullish(),
  /**
   * Whether to enable speaker diarization.
   */
  enableSpeakerDiarization: z.boolean().nullish(),
  /**
   * Additional transcription context to improve accuracy.
   */
  context: z.union([z.string(), sonioxContextSchema]).nullish(),
  /**
   * Optional client-defined reference ID for the transcription.
   */
  clientReferenceId: z.string().nullish(),
  /**
   * Webhook URL for transcription completion notifications.
   */
  webhookUrl: z.string().nullish(),
  /**
   * Webhook authentication header name.
   */
  webhookAuthHeaderName: z.string().nullish(),
  /**
   * Webhook authentication header value.
   */
  webhookAuthHeaderValue: z.string().nullish(),
  /**
   * Translation configuration for the transcription.
   */
  translation: sonioxTranslationSchema.nullish(),
});

export type SonioxTranscriptionProviderOptions = z.infer<
  typeof sonioxTranscriptionProviderOptionsSchema
>;
