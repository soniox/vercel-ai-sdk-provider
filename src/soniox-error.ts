import { z } from 'zod/v4';
import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';

export const sonioxErrorDataSchema = z.object({
  status_code: z.number().nullish(),
  error_type: z.string().nullish(),
  message: z.string().nullish(),
  validation_errors: z
    .array(
      z.object({
        error_type: z.string().nullish(),
        location: z.string().nullish(),
        message: z.string().nullish(),
      }),
    )
    .nullish(),
  request_id: z.string().nullish(),
});

export type SonioxErrorData = z.infer<typeof sonioxErrorDataSchema>;

export const sonioxFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: sonioxErrorDataSchema,
  errorToMessage: data =>
    data.message ?? data.error_type ?? 'Soniox API error',
});
