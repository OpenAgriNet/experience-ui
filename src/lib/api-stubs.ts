/**
 * Local stub layer — answers with canned data instead of calling the backend.
 *
 * Controlled by the `stubs` block in config.json. When disabled, every export
 * here is inert and the app talks to the real API.
 *
 * This exists so the UI can be run with no backend. For chat, the stub does
 * not short-circuit the client: it returns a Response carrying the same
 * event stream the Experience API sends (contract §5.1), so the real parser
 * and event handling run on every stubbed reply. The older endpoints below
 * return plain objects, because the surfaces that call them are switched off.
 *
 * Every stubbed chat reply ends with a line saying so, because these are
 * plausible-looking agricultural answers and must never be mistaken for real
 * advice.
 */

import { getConfig } from '@/lib/config/runtime-config';
import type {
  ApiErrorBody,
  ChatTurnRequest,
  FinalAnswer,
  SuggestionItem,
  TranscriptionResponse,
} from '@/lib/api-service';

let hasWarned = false;

/**
 * Read lazily rather than at module load. Configuration is fetched before React
 * mounts, but this module is also imported by tests and by anything that runs
 * outside that boot path, where reading at import time would throw.
 */
export const stubsEnabled = (): boolean => {
  const enabled = getConfig().stubs.enabled === true;

  if (enabled && !hasWarned) {
    hasWarned = true;
    console.warn(
      '[stub] API stubs are enabled: no backend is being contacted and all data is fabricated. ' +
        'Set stubs.enabled to false in config.json before deploying.'
    );
  }

  return enabled;
};

/** Log every stubbed call so it's obvious nothing real is happening. */
const stubLog = (endpoint: string, detail?: unknown): void => {
  console.info(`[stub] ${endpoint}`, detail ?? '');
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// --- POST /v1/chat -------------------------------------------------------

const STUB_NOTE = '_This is a stubbed response — no backend was contacted._';

type StubReply = Pick<FinalAnswer, 'outcome' | 'content' | 'sources'> & {
  error?: Omit<ApiErrorBody, 'traceId'>;
};

/**
 * One reply per kind of outcome the client has to draw (§5.3), in a cycle:
 * three answers, a refusal, and a turn that failed after the DSS accepted it.
 * The last one shows Retry and stays out of history, so both can be checked
 * with stubs on.
 */
const CHAT_REPLIES: StubReply[] = [
  {
    outcome: { status: 'answered', cause: null },
    content: [
      {
        type: 'text',
        text: `### Wheat sowing advice

For **Pune district**, the recommended sowing window for irrigated wheat is **1–15 November**.

**Seed rate:** 100–125 kg/ha
**Spacing:** 22.5 cm between rows

1. Apply a basal dose of 60 kg N, 60 kg P and 40 kg K per hectare.
2. Give the first irrigation 20–25 days after sowing (crown root stage) — this one matters most for yield.
3. Watch for yellow rust from late December onward.

${STUB_NOTE}`,
        citations: [{ sourceId: 'src_1', start: 0, end: 24 }],
      },
    ],
    sources: [{ id: 'src_1', name: 'Package of Practices, MPKV Rahuri', url: 'https://mpkv.ac.in/' }],
  },
  {
    outcome: { status: 'answered', cause: null },
    content: [
      {
        type: 'text',
        text: `### Mandi prices

Indicative rates for your area today:

| Commodity | Min | Max | Modal |
|---|---|---|---|
| Wheat | ₹2,150 | ₹2,480 | ₹2,320 |
| Onion | ₹1,100 | ₹1,850 | ₹1,450 |
| Soybean | ₹4,200 | ₹4,750 | ₹4,500 |

Prices are per quintal and vary by grade and moisture content.

${STUB_NOTE}`,
        citations: [],
      },
    ],
    sources: [],
  },
  {
    outcome: { status: 'answered', cause: null },
    content: [
      {
        type: 'text',
        text: `### PM-Kisan Samman Nidhi

Eligible landholding farmer families receive **₹6,000 per year**, paid in three equal instalments of ₹2,000.

**To check your status:**
1. Visit the PM-Kisan portal.
2. Open *Beneficiary Status*.
3. Enter your registered mobile or Aadhaar number.

If an instalment is pending, the usual cause is incomplete e-KYC or a name mismatch with bank records.

${STUB_NOTE}`,
        citations: [],
      },
    ],
    sources: [],
  },
  {
    outcome: { status: 'rejected', cause: 'out_of_scope' },
    content: [
      {
        type: 'refusal',
        text: `I can help with farming questions — crops, livestock, weather, market prices and government schemes — but not with this one.

${STUB_NOTE}`,
      },
    ],
    sources: [],
  },
  {
    outcome: { status: 'unavailable', cause: 'provider_unavailable' },
    content: [
      {
        type: 'text',
        text: `The market price service is not responding right now. Please try again in a few minutes.

${STUB_NOTE}`,
        citations: [],
      },
    ],
    sources: [],
    error: {
      code: 'provider_unavailable',
      message: 'Upstream price provider timed out after 30s',
      retryable: true,
      retryAfterSeconds: 30,
    },
  },
];

let chatReplyIndex = 0;

const frame = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/**
 * The frames one stubbed turn streams, as the API would write them (§5.1):
 * `started`, a comment line as a keep-alive would be, a `delta` per word of
 * each text item, then `completed` with the whole answer. Pure, so the
 * stream's content can be tested without its timing.
 */
export const stubChatFrames = (request: ChatTurnRequest): string[] => {
  const reply = CHAT_REPLIES[chatReplyIndex % CHAT_REPLIES.length] as StubReply;
  chatReplyIndex += 1;

  const ids = {
    sessionId: request.sessionId,
    messageId: request.messageId,
    assistantMessageId: crypto.randomUUID(),
    traceId: crypto.randomUUID(),
  };
  let sequence = 0;
  const next = () => ++sequence;

  const frames = [frame('started', { sequence: next(), ...ids }), ': ping\n\n'];

  for (const item of reply.content) {
    if (item.type !== 'text') continue; // a refusal arrives whole, in completed
    for (const word of item.text.match(/\S+\s*/g) ?? []) {
      frames.push(frame('delta', { sequence: next(), text: word }));
    }
  }

  const answer: FinalAnswer = {
    ...ids,
    outcome: reply.outcome,
    content: reply.content,
    sources: reply.sources,
    ...(reply.error && { error: { ...reply.error, traceId: ids.traceId } }),
  };
  frames.push(frame('completed', { sequence: next(), ...answer }));

  return frames;
};

/**
 * What fetch would return for POST /v1/chat: a 200 whose body streams the
 * frames above, a word at a time, so the typing indicator and the streaming
 * text behave as they would against the real API.
 */
export const stubChatResponse = async (request: ChatTurnRequest): Promise<Response> => {
  stubLog('POST /v1/chat', request);
  const frames = stubChatFrames(request);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      await delay(400);
      for (const chunk of frames) {
        controller.enqueue(encoder.encode(chunk));
        await delay(18);
      }
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
};

// --- Older endpoints, switched off ------------------------------------------

/** POST /api/image/upload */
export const stubUploadImage = async (file: File): Promise<{ image_id: string }> => {
  stubLog('POST /api/image/upload', { name: file.name, size: file.size });
  await delay(500);
  return { image_id: `stub-image-${Date.now()}` };
};

/** GET /api/suggest/ */
export const stubGetSuggestions = async (): Promise<SuggestionItem[]> => {
  stubLog('GET /api/suggest/');
  await delay(250);
  return [
    { question: 'What is the best time to sow wheat?' },
    { question: "What are today's mandi prices for onion?" },
    { question: 'How do I apply for PM-Kisan?' },
    { question: 'Which fertiliser suits black cotton soil?' },
  ];
};

/** POST /api/transcribe/ */
export const stubTranscribeAudio = async (): Promise<TranscriptionResponse> => {
  stubLog('POST /api/transcribe/');
  await delay(700);
  return {
    text: 'What is the subsidy for a 45 HP tractor in Maharashtra?',
    lang_code: 'en',
    status: 'success',
  };
};

/**
 * POST /api/tts/
 *
 * `audio_data` is a 1-sample silent WAV, base64 encoded. Real audio isn't
 * needed — this only has to decode without throwing in the audio pipeline.
 */
const SILENT_WAV_BASE64 =
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export const stubGetTranscript = async (sessionId: string) => {
  stubLog('POST /api/tts/', { sessionId });
  await delay(400);
  return {
    data: {
      status: 'success',
      audio_data: SILENT_WAV_BASE64,
      session_id: sessionId,
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as never,
  };
};

