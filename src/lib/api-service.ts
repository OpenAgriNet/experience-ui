import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { getConfig } from '@/lib/config/runtime-config';
import {
  stubsEnabled,
  stubChatResponse,
  stubGetSuggestions,
  stubGetTranscript,
  stubTranscribeAudio,
  stubUploadImage,
} from '@/lib/api-stubs';
import { readSseEvents } from '@/lib/sse';

export interface LocationData {
  latitude: number;
  longitude: number;
}

// --- The chat contract: POST /v1/chat ------------------------------------
// Shapes follow docs/implementation/experience-api-contract.md §4–§6. The
// client branches on `content[].type` and on `error`, never on
// `outcome.status`, so a status it has never seen still renders.

export interface HistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

/** One turn from the client. `location` is added here when the browser gave one. */
export interface ChatTurn {
  sessionId: string;
  /** Id of the message in `query`. A retry sends the same one again. */
  messageId: string;
  query: string;
  /** Every completed exchange so far, oldest first. The API stores nothing. */
  history: HistoryItem[];
  language: { source: string; target: string };
}

export type ChatTurnRequest = ChatTurn & { location?: LocationData };

export interface Citation {
  sourceId: string;
  start: number;
  end: number;
}

export type AnswerContent =
  | { type: 'text'; text: string; citations?: Citation[] }
  | { type: 'refusal'; text: string };

export interface AnswerSource {
  id: string;
  name: string;
  url?: string;
}

/** The one error shape: HTTP error bodies, the `error` event and `FinalAnswer.error`. */
export interface ApiErrorBody {
  code: string;
  /** For logs. English. Never shown to the user as-is. */
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  traceId?: string;
}

/** The `completed` event, and the whole answer. Authoritative over the deltas. */
export interface FinalAnswer {
  sessionId: string;
  messageId: string;
  assistantMessageId: string;
  traceId: string;
  outcome: { status: string; cause: string | null };
  /** In order. Empty only when `error` is present. */
  content: AnswerContent[];
  sources: AnswerSource[];
  /** Present when the turn failed after the DSS accepted it. */
  error?: ApiErrorBody;
}

export interface ChatStreamHandlers {
  onStarted?: (started: { assistantMessageId: string; traceId: string }) => void;
  onDelta?: (text: string) => void;
}

/**
 * A failed call. `code` is what the client branches on (§6.1). It comes from
 * the API where the API sent one, and is made up here where it did not:
 * `history_too_large` for a bare 413, `upstream_error` for a broken stream,
 * `unknown` for any other response without a contract body.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly traceId?: string;
  /** HTTP status, when the failure was a response rather than a stream event. */
  readonly status?: number;

  constructor(body: ApiErrorBody, status?: number) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.retryable = body.retryable;
    this.retryAfterSeconds = body.retryAfterSeconds;
    this.traceId = body.traceId;
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isErrorBody = (value: unknown): value is ApiErrorBody =>
  isRecord(value) && typeof value.code === 'string' && typeof value.retryable === 'boolean';

const upstreamError = (message: string, traceId?: string): ApiError =>
  new ApiError({ code: 'upstream_error', message, retryable: true, traceId });

/** Turn a non-OK response into an ApiError, with fallbacks for a body that is not ours. */
const errorFromResponse = async (response: Response): Promise<ApiError> => {
  const body: unknown = await response.json().catch(() => undefined);
  if (isRecord(body) && isErrorBody(body.error)) {
    return new ApiError(body.error, response.status);
  }
  if (response.status === 413) {
    // Something in front of the API rejected the body size before the API
    // could say so (§6.2). Same cause, same message to the user.
    return new ApiError(
      { code: 'history_too_large', message: `HTTP 413 without a contract body`, retryable: false },
      413
    );
  }
  return new ApiError(
    {
      code: 'unknown',
      message: `HTTP ${response.status} without a contract body`,
      retryable: response.status === 429 || response.status >= 500,
    },
    response.status
  );
};

/**
 * Read the event stream to its end. Exactly one of `completed` or `error`
 * ends every stream (§5.1); a stream that closes without either is a failure,
 * never a success — the connection closing proves nothing.
 */
const readAnswer = async (
  body: ReadableStream<Uint8Array>,
  handlers: ChatStreamHandlers
): Promise<FinalAnswer> => {
  let traceId: string | undefined;

  for await (const frame of readSseEvents(body)) {
    let data: unknown;
    try {
      data = JSON.parse(frame.data);
    } catch {
      throw upstreamError(`Event "${frame.event}" did not carry JSON`, traceId);
    }
    if (!isRecord(data)) throw upstreamError(`Event "${frame.event}" was not an object`, traceId);

    switch (frame.event) {
      case 'started':
        if (typeof data.assistantMessageId !== 'string' || typeof data.traceId !== 'string') {
          throw upstreamError('started carried no assistantMessageId or traceId');
        }
        traceId = data.traceId;
        handlers.onStarted?.({ assistantMessageId: data.assistantMessageId, traceId: data.traceId });
        break;
      case 'delta':
        if (typeof data.text === 'string') handlers.onDelta?.(data.text);
        break;
      case 'completed':
        if (!Array.isArray(data.content)) throw upstreamError('completed carried no content array', traceId);
        return data as unknown as FinalAnswer;
      case 'error':
        if (!isErrorBody(data.error)) throw upstreamError('error event carried no error body', traceId);
        throw new ApiError({ traceId, ...data.error });
      default:
        // Forward compatible: an event this client does not know is skipped.
        break;
    }
  }

  throw upstreamError('The stream ended without a completed or error event', traceId);
};

// --- Older endpoints, all switched off in config ---------------------------

export interface TranscriptionResponse {
  text: string;
  lang_code: string;
  status: string;
}

export interface SuggestionItem {
  question: string;
}

interface TTSResponse {
  status: string;
  audio_data: string;
  session_id: string;
}

interface ImageUploadResponse {
  image_id: string;
}

/**
 * Where the API lives: `api.baseUrl` from config.json, used as written. An
 * absolute path such as `/api` or `/exp/api` keeps every call on the app's
 * own origin. A full URL works too, but needs CORS on the API and the CSP's
 * connect-src widened.
 *
 * Read on each call rather than at import. Configuration exists only once
 * loadRuntimeConfig() has resolved, and this module is imported by tests.
 */
const apiBaseUrl = (): string => getConfig().api.baseUrl;

class ApiService {
  private locationData: LocationData | null = null;
  private currentSessionId: string | null = null;
  private axios: AxiosInstance | null = null;

  /** Built on first use, for the same reason apiBaseUrl() is a function. */
  private get axiosInstance(): AxiosInstance {
    this.axios ??= axios.create({
      baseURL: `${apiBaseUrl()}/`,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return this.axios;
  }

  /**
   * Send one chat turn and stream the answer back.
   *
   * Resolves with the `completed` answer, which replaces whatever the deltas
   * built up. Rejects with an ApiError for an error response, an `error`
   * event, or a stream that broke. A `completed` that carries `error` is not
   * a rejection: the caller reads `error` from it (§5.3).
   *
   * With stubs on, only the network call is swapped; the stub answers with the
   * same event stream and everything after this line is the real code.
   */
  async sendUserQuery(turn: ChatTurn, handlers: ChatStreamHandlers = {}): Promise<FinalAnswer> {
    const request: ChatTurnRequest = {
      ...turn,
      ...(this.locationData && { location: this.locationData }),
    };

    const response = stubsEnabled()
      ? await stubChatResponse(request)
      : await fetch(`${apiBaseUrl()}/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(request),
        });

    if (!response.ok) {
      throw await errorFromResponse(response);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream') || !response.body) {
      throw upstreamError(`Expected an event stream, got "${contentType || 'no content type'}"`);
    }

    return readAnswer(response.body, handlers);
  }

  private parseImageUploadResponse(payload: unknown): ImageUploadResponse {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Upload response is not a valid object');
    }

    const imageId = (payload as { image_id?: unknown }).image_id;
    if (typeof imageId !== 'string' || !imageId.trim()) {
      throw new Error('Upload response missing image_id');
    }

    return { image_id: imageId.trim() };
  }

  async uploadImage(imageFile: File): Promise<ImageUploadResponse> {
    try {
      if (stubsEnabled()) {
        return await stubUploadImage(imageFile);
      }


      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await fetch(`${apiBaseUrl()}/image/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const payload = await response.json();
      return this.parseImageUploadResponse(payload);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  async sendImageQuery(
    imageFile: File,
    turn: Omit<ChatTurn, 'query'>,
    handlers: ChatStreamHandlers = {}
  ): Promise<FinalAnswer> {
    // Step 1: Upload image to get image ID
    const uploadResult = await this.uploadImage(imageFile);
    const imageId = uploadResult.image_id;

    // Step 2: Send the image UUID along with a request message.
    // The backend resolves this ID to a localhost image URL internally.
    const query = `please do the pest analysis for this image ${imageId}`;

    return this.sendUserQuery({ ...turn, query }, handlers);
  }

  async getSuggestions(session: string, targetLang: string = 'mr'): Promise<SuggestionItem[]> {
    try {
      if (stubsEnabled()) {
        return await stubGetSuggestions();
      }

      
      const params = {
        session_id: session,
        target_lang: targetLang
      };

      const config = {
        params,
      };

      const response = await this.axiosInstance.get('suggest/', config);
      return response.data.map((item: string) => ({
        question: item
      }));
    } catch (error) {
      console.error('Error getting suggestions:', error);
      throw error;
    }
  }

  async transcribeAudio(
    audioBase64: string,
    serviceType: string = 'bhashini',
    sessionId: string,
    lang_code: string
  ): Promise<TranscriptionResponse> {
    try {
      if (stubsEnabled()) {
        return await stubTranscribeAudio();
      }

      
      const payload = {
        audio_content: audioBase64,
        service_type: serviceType,
        session_id: sessionId,
        lang_code: lang_code,
      };

      const config = {
      };

      const response = await this.axiosInstance.post('transcribe/', payload, config);
      return response.data;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }

  async getTranscript(sessionId: string, text: string, targetLang: string): Promise<AxiosResponse<TTSResponse>> {
    if (stubsEnabled()) {
      return (await stubGetTranscript(sessionId)) as AxiosResponse<TTSResponse>;
    }

    
    const config = {
      timeout: 120000, // 120s timeout for TTS (can be slow on cold start)
    };
    
    return this.axiosInstance.post(`tts/`, {
      session_id: sessionId,
      text: text,
      target_lang: targetLang
    }, config);
  }

  blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const result = reader.result as string;
          const base64String = result.split(',')[1];
          if (base64String) {
            resolve(base64String);
          } else {
            reject(new Error('Failed to extract base64 from data URL'));
          }
        } catch (error) {
          console.error(error);
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  setLocationData(location: LocationData): void {
    this.locationData = location;
  }

  getLocationData(): LocationData | null {
    return this.locationData;
  }

  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }

}

const apiService = new ApiService();
export default apiService;
