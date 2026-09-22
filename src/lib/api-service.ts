import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { environment } from '@/lib/config/environment';
import {
  stubsEnabled,
  stubGetSuggestions,
  stubGetTranscript,
  stubSendUserQuery,
  stubTranscribeAudio,
  stubUploadImage,
  stubVoid,
} from '@/lib/api-stubs';

export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface ChatResponse {
  response: string;
  status: string;
  qid?: string;
}

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

interface TelemetryFeedbackPayload {
  qid: string;
  session_id: string;
  message_id?: string;
  feedback_type: string;
  feedback_text: string;
  question_text: string;
  answer_text: string;
}

interface TelemetryErrorPayload {
  qid: string;
  session_id: string;
  error_text: string;
  question_text?: string;
  message_id?: string;
}

type UiTelemetryEvent = {
  event_name: string;
  category: string;
  time: string;
  metadata: Record<string, unknown>;
};

interface ImageUploadResponse {
  image_id: string;
}

const CHAT_QID_HEADER = "X-QID";
const SSE_KEEPALIVE_MARKER = "SSE_KEEPALIVE";

// Constants

const stripSseKeepAliveMarkers = (chunk: string): string =>
  chunk
    .split(/\r?\n/)
    .filter((line) => line.trim() !== SSE_KEEPALIVE_MARKER)
    .join('\n');


class ApiService {
  private apiUrl: string = environment.apiUrl;
  private locationData: LocationData | null = null;
  private currentSessionId: string | null = null;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  }

  
  
  async sendUserQuery(
    msg: string,
    session: string,
    sourceLang: string,
    targetLang: string,
    onStreamData?: (_data: string) => void,
    onResponseStarted?: () => void
  ): Promise<ChatResponse> {
    try {
      if (stubsEnabled()) {
        return await stubSendUserQuery(msg, onStreamData, onResponseStarted);
      }

      
      const params = {
        session_id: session,
        query: msg,
        source_lang: sourceLang,
        target_lang: targetLang,
        ...(this.locationData && {
          latitude: String(this.locationData.latitude),
          longitude: String(this.locationData.longitude)
        })
      };

      if (onStreamData) {
        // Handle streaming response
        const response = await fetch(`${this.apiUrl}/api/chat/?${new URLSearchParams(params)}`, {
          method: 'GET'
        });


        if (!response.ok) {
          const responseQid = response.headers.get(CHAT_QID_HEADER) || undefined;
          if (response.status === 429) {
            const error = new Error('Rate limit exceeded');
            (error as any).status = 429;
            if (responseQid) (error as any).qid = responseQid;
            throw error;
          }
          const error = new Error(`HTTP error! status: ${response.status}`);
          (error as any).status = response.status;
          if (responseQid) (error as any).qid = responseQid;
          throw error;
        }

        const responseQid = response.headers.get(CHAT_QID_HEADER) || undefined;
        onResponseStarted?.();

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        let fullResponse = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const displayChunk = stripSseKeepAliveMarkers(chunk);

          if (chunk.includes(SSE_KEEPALIVE_MARKER) && !displayChunk.trim()) {
            continue;
          }

          fullResponse += displayChunk;
          onStreamData(displayChunk);
        }

        return { response: fullResponse, status: 'success', qid: responseQid };
      } else {
        // Regular non-streaming request
        const config = {
          params,
        };
        const response = await this.axiosInstance.get('/api/chat/', config);
        const responseQid = response.headers[CHAT_QID_HEADER.toLowerCase()] as string | undefined;
        onResponseStarted?.();
        return {
          ...response.data,
          qid: response.data?.qid || responseQid
        };
      }
    } catch (error) {
      const responseQid = axios.isAxiosError(error)
        ? error.response?.headers?.[CHAT_QID_HEADER.toLowerCase()]
        : undefined;
      if (responseQid) {
        (error as any).qid = responseQid;
      }
      console.error('Error sending user query:', error);
      throw error;
    }
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

      const response = await fetch(`${this.apiUrl}/api/image/upload`, {
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
    session: string,
    sourceLang: string,
    targetLang: string,
    onStreamData?: (_data: string) => void,
    onResponseStarted?: () => void
  ): Promise<ChatResponse> {
    // Step 1: Upload image to get image ID
    const uploadResult = await this.uploadImage(imageFile);
    const imageId = uploadResult.image_id;

    // Step 2: Send the image UUID along with a request message.
    // The backend resolves this ID to a localhost image URL internally.
    const query = `please do the pest analysis for this image ${imageId}`;

    return this.sendUserQuery(query, session, sourceLang, targetLang, onStreamData, onResponseStarted);
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

      const response = await this.axiosInstance.get('/api/suggest/', config);
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

      const response = await this.axiosInstance.post('/api/transcribe/', payload, config);
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
    
    return this.axiosInstance.post(`/api/tts/`, {
      session_id: sessionId,
      text: text,
      target_lang: targetLang
    }, config);
  }

  async submitPositiveFeedback(messageId: string): Promise<void> {
    try {
      await this.submitTelemetryFeedback({
        qid: messageId,
        session_id: this.currentSessionId || "",
        message_id: messageId,
        feedback_type: "like",
        feedback_text: "Liked the response",
        question_text: "",
        answer_text: ""
      });
    } catch (error) {
      console.error('Error submitting positive feedback:', error);
      throw error;
    }
  }

  async submitNegativeFeedback(messageId: string, reason: string, feedback: string): Promise<void> {
    try {
      await this.submitTelemetryFeedback({
        qid: messageId,
        session_id: this.currentSessionId || "",
        message_id: messageId,
        feedback_type: "dislike",
        feedback_text: feedback || reason || "Negative feedback",
        question_text: "",
        answer_text: ""
      });
    } catch (error) {
      console.error('Error submitting negative feedback:', error);
      throw error;
    }
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

  async submitTelemetryFeedback(payload: TelemetryFeedbackPayload): Promise<void> {
    if (stubsEnabled()) return stubVoid('POST /api/telemetry/feedback', payload);


    await this.axiosInstance.post('/api/telemetry/feedback', payload, {
    });
  }

  async submitTelemetryError(payload: TelemetryErrorPayload): Promise<void> {
    if (stubsEnabled()) return stubVoid('POST /api/telemetry/error', payload);


    await this.axiosInstance.post('/api/telemetry/error', payload, {
    });
  }

  trackUiTelemetryEvent(event: Omit<UiTelemetryEvent, "time"> & { time?: string }): void {
    void this.submitUiTelemetryEvent(event);
  }

  private async submitUiTelemetryEvent(event: Omit<UiTelemetryEvent, "time"> & { time?: string }): Promise<void> {
    try {
      if (stubsEnabled()) return await stubVoid('POST /api/telemetry/events', event);


      const metadata = {
        ...(event.metadata || {}),
        ...(this.currentSessionId && !event.metadata?.sid ? { sid: this.currentSessionId } : {})
      };

      const payload: UiTelemetryEvent[] = [{
        event_name: event.event_name,
        category: event.category,
        time: event.time || new Date().toISOString(),
        metadata
      }];

      await this.axiosInstance.post('/api/telemetry/events', payload, {
      });
    } catch {
      // UI telemetry must never block or surface errors to users.
    }
  }

}

const apiService = new ApiService();
export default apiService;
