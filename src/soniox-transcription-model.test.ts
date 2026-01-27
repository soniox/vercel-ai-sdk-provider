import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { createSoniox } from "./soniox-provider";
import { SonioxTranscriptionModel } from "./soniox-transcription-model";

vi.mock("./version", () => ({
  VERSION: "0.0.0-test",
}));

const audioData = await readFile(path.join(__dirname, "transcript-test.mp3"));
const provider = createSoniox({ apiKey: "test-api-key" });
const model = provider.transcription("stt-async-v3");

const server = createTestServer({
  "https://api.soniox.com/v1/files": {
    response: {
      type: "json-value",
      body: {
        id: "file-123",
      },
    },
  },
  "https://api.soniox.com/v1/files/file-123": {
    response: {
      type: "empty",
    },
  },
  "https://api.soniox.com/v1/transcriptions": {},
  "https://api.soniox.com/v1/transcriptions/transcription-123": {},
  "https://api.soniox.com/v1/transcriptions/transcription-123/transcript": {},
});

describe("doGenerate", () => {
  function prepareJsonResponse({
    headers,
  }: {
    headers?: Record<string, string>;
  } = {}) {
    server.urls["https://api.soniox.com/v1/transcriptions"].response = {
      type: "json-value",
      body: {
        id: "transcription-123",
        status: "queued",
      },
    };

    server.urls[
      "https://api.soniox.com/v1/transcriptions/transcription-123"
    ].response = {
      type: "json-value",
      body: {
        id: "transcription-123",
        status: "completed",
        audio_duration_ms: 16079,
      },
    };

    server.urls[
      "https://api.soniox.com/v1/transcriptions/transcription-123/transcript"
    ].response = {
      type: "json-value",
      headers,
      body: {
        id: "transcription-123",
        text: "Hello",
        tokens: [
          {
            text: "Hel",
            start_ms: 10,
            end_ms: 90,
            confidence: 0.95,
            language: "en",
          },
          {
            text: "lo",
            start_ms: 110,
            end_ms: 160,
            confidence: 0.98,
            language: "en",
          },
        ],
      },
    };
  }

  it("should upload audio for transcription", async () => {
    prepareJsonResponse();

    await model.doGenerate({
      audio: audioData,
      mediaType: "audio/wav",
    });

    expect(server.calls[0].requestUrl).toBe("https://api.soniox.com/v1/files");
    const multipart = await server.calls[0].requestBodyMultipart;
    expect(multipart?.file).toBeInstanceOf(File);
  });

  it("should pass headers", async () => {
    prepareJsonResponse();

    const provider = createSoniox({
      apiKey: "test-api-key",
      headers: {
        "Custom-Provider-Header": "provider-header-value",
      },
    });

    await provider.transcription("stt-async-v3").doGenerate({
      audio: audioData,
      mediaType: "audio/wav",
      headers: {
        "Custom-Request-Header": "request-header-value",
      },
    });

    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: "Bearer test-api-key",
      "content-type": expect.stringMatching(
        /^multipart\/form-data; boundary=----formdata-undici-\d+$/
      ),
      "custom-provider-header": "provider-header-value",
      "custom-request-header": "request-header-value",
    });
    expect(server.calls[0].requestUserAgent).toContain(
      `soniox/vercel-ai-sdk-provider/0.0.0-test`
    );
  });

  it("should upload audio before creating a transcription", async () => {
    prepareJsonResponse();

    await model.doGenerate({
      audio: audioData,
      mediaType: "audio/wav",
    });

    expect(server.calls[0].requestUrl).toBe("https://api.soniox.com/v1/files");
  });

  it("should map segments, language, and provider metadata", async () => {
    prepareJsonResponse();

    const result = await model.doGenerate({
      audio: audioData,
      mediaType: "audio/wav",
    });

    expect(result.text).toBe("Hello");
    expect(result.durationInSeconds).toBeCloseTo(16.079);
    expect(result.language).toBe("en");
    expect(result.segments).toEqual([
      {
        text: "Hel",
        startSecond: 0.01,
        endSecond: 0.09,
      },
      {
        text: "lo",
        startSecond: 0.11,
        endSecond: 0.16,
      },
    ]);
    expect(result.providerMetadata?.soniox?.tokens).toHaveLength(2);
  });

  it("should include response data with timestamp, modelId and headers", async () => {
    prepareJsonResponse({
      headers: {
        "x-request-id": "test-request-id",
      },
    });

    const testDate = new Date(0);
    const customModel = new SonioxTranscriptionModel("stt-async-v3", {
      provider: "test-provider",
      url: ({ path }) => `https://api.soniox.com${path}`,
      headers: () => ({}),
      _internal: {
        currentDate: () => testDate,
      },
    });

    const result = await customModel.doGenerate({
      audio: audioData,
      mediaType: "audio/wav",
    });

    expect(result.response).toMatchObject({
      timestamp: testDate,
      modelId: "stt-async-v3",
      headers: {
        "content-type": "application/json",
        "x-request-id": "test-request-id",
      },
    });
  });

  it("should cleanup resources on abort during polling", async () => {
    prepareJsonResponse();

    // Mock polling to stay in 'queued' status
    server.urls[
      "https://api.soniox.com/v1/transcriptions/transcription-123"
    ].response = {
      type: "json-value",
      body: {
        id: "transcription-123",
        status: "queued",
      },
    };

    const abortController = new AbortController();

    // Start doGenerate with a small polling interval for testing
    const provider = createSoniox({
      apiKey: "test-api-key",
      pollingIntervalMs: 100,
    });
    const model = provider.transcription("stt-async-v3");

    const promise = model.doGenerate({
      audio: audioData,
      mediaType: "audio/wav",
      abortSignal: abortController.signal,
    });

    // Wait for the first few requests to complete
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    abortController.abort();

    await expect(promise).rejects.toThrow();

    // Verify cleanup calls
    const deleteFileCall = server.calls.find(
      (c) =>
        c.requestUrl === "https://api.soniox.com/v1/files/file-123" &&
        c.requestMethod === "DELETE"
    );
    const deleteTranscriptionCall = server.calls.find(
      (c) =>
        c.requestUrl ===
          "https://api.soniox.com/v1/transcriptions/transcription-123" &&
        c.requestMethod === "DELETE"
    );

    expect(deleteFileCall).toBeDefined();
    expect(deleteTranscriptionCall).toBeDefined();
  });
});
