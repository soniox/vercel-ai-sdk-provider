export type SonioxTranslation =
  | {
      type: 'one_way';
      target_language: string;
    }
  | {
      type: 'two_way';
      language_a: string;
      language_b: string;
    };

export type SonioxContext =
  | string
  | {
      general?: Array<{
        key: string;
        value: string;
      }>;
      text?: string;
      terms?: string[];
      translation_terms?: Array<{
        source: string;
        target: string;
      }>;
    };

export type SonioxCreateTranscriptionRequest = {
  model: string;
  audio_url?: string;
  file_id?: string;
  language_hints?: string[];
  enable_language_identification?: boolean;
  enable_speaker_diarization?: boolean;
  context?: SonioxContext;
  client_reference_id?: string;
  webhook_url?: string;
  webhook_auth_header_name?: string;
  webhook_auth_header_value?: string;
  translation?: SonioxTranslation;
};

export type SonioxFileUploadResponse = {
  id: string;
};

export type SonioxTranscriptionStatusResponse = {
  id: string;
  status: string;
  created_at?: string;
  model?: string;
  audio_url?: string | null;
  file_id?: string | null;
  filename?: string | null;
  language_hints?: string[];
  context?: SonioxContext | null;
  audio_duration_ms?: number | null;
  error_message?: string | null;
  webhook_url?: string | null;
  webhook_auth_header_name?: string | null;
  webhook_auth_header_value?: string | null;
  webhook_status_code?: number | null;
  client_reference_id?: string | null;
};

export type SonioxTranscriptToken = {
  text: string;
  start_ms?: number | null;
  end_ms?: number | null;
  confidence?: number | null;
  speaker?: number | string | null;
  language?: string | null;
  translation_status?: string | null;
};

export type SonioxTranscriptResponse = {
  id: string;
  text?: string | null;
  tokens?: SonioxTranscriptToken[] | null;
};
