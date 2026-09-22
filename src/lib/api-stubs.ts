/**
 * Local stub layer — returns canned objects instead of hitting the backend.
 *
 * Controlled by the `stubs` block in config.json. When disabled, every export
 * here is inert and the app talks to the real API exactly as before.
 *
 * This exists so the UI can be run with no backend — there is no Experience API
 * yet, and without stubs the client renders a lock screen because /api/token
 * never answers. It is a stepping stone to a real mock REST service: each
 * function below mirrors one endpoint's response shape, so the bodies can be
 * lifted into an actual server later.
 *
 * Every stubbed chat reply ends with a line saying so, because these are
 * plausible-looking agricultural answers and must never be mistaken for real
 * advice.
 */

import { getConfig } from '@/lib/config/runtime-config';
import type {
  ChatResponse,
  LocationData,
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

/**
 * Stub tokens carry a fake signature, so `jose.jwtVerify` would reject them.
 * Separate from stubsEnabled() so that verification can be kept on deliberately
 * while other endpoints are stubbed.
 */
export const skipJwtVerification = (): boolean =>
  stubsEnabled() && getConfig().stubs.skipJwtVerification !== false;

/** Log every stubbed call so it's obvious nothing real is happening. */
export const stubLog = (endpoint: string, detail?: unknown): void => {
  console.info(`[stub] ${endpoint}`, detail ?? '');
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// --- JWT ---------------------------------------------------------------

const base64UrlEncode = (value: string): string =>
  btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const normalised = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * A structurally valid JWT with a fake signature. It carries a real `exp` claim
 * so the app's expiry handling works, but it will NOT pass `jwtVerify` — stub
 * mode skips signature checks (see AuthContext.validateJWT).
 */
export const makeStubJwt = (): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    sub: 'stub-user-001',
    name: 'Stub Farmer',
    email: 'stub.farmer@example.com',
    mobile: '9000000000',
    role: 'farmer',
    farmer_id: 'STUB-FARMER-001',
    unique_id: 1001,
    is_guest_user: false,
    locations: [
      {
        location_type: 'registered_location',
        district: 'Pune',
        village: 'Wagholi',
        taluka: 'Haveli',
        lgd_code: '556123',
      },
    ],
    iat: now,
    exp: now + 24 * 60 * 60,
  };
  return [
    base64UrlEncode(JSON.stringify(header)),
    base64UrlEncode(JSON.stringify(payload)),
    'stub-signature-not-verified',
  ].join('.');
};

// --- Endpoint stubs ----------------------------------------------------

/** POST /api/token */
export const stubFetchAuthToken = async (): Promise<string> => {
  stubLog('POST /api/token');
  await delay(150);
  return makeStubJwt();
};

const CHAT_REPLIES: string[] = [
  `### Wheat sowing advice

For **Pune district**, the recommended sowing window for irrigated wheat is **1–15 November**.

**Seed rate:** 100–125 kg/ha
**Spacing:** 22.5 cm between rows

1. Apply a basal dose of 60 kg N, 60 kg P and 40 kg K per hectare.
2. Give the first irrigation 20–25 days after sowing (crown root stage) — this one matters most for yield.
3. Watch for yellow rust from late December onward.

_This is a stubbed response — no backend was contacted._`,

  `### Mandi prices

Indicative rates for your area today:

| Commodity | Min | Max | Modal |
|---|---|---|---|
| Wheat | ₹2,150 | ₹2,480 | ₹2,320 |
| Onion | ₹1,100 | ₹1,850 | ₹1,450 |
| Soybean | ₹4,200 | ₹4,750 | ₹4,500 |

Prices are per quintal and vary by grade and moisture content.

_This is a stubbed response — no backend was contacted._`,

  `### PM-Kisan Samman Nidhi

Eligible landholding farmer families receive **₹6,000 per year**, paid in three equal instalments of ₹2,000.

**To check your status:**
1. Visit the PM-Kisan portal.
2. Open *Beneficiary Status*.
3. Enter your registered mobile or Aadhaar number.

If an instalment is pending, the usual cause is incomplete e-KYC or a name mismatch with bank records.

_This is a stubbed response — no backend was contacted._`,
];

let chatReplyIndex = 0;

/**
 * GET /api/chat/
 *
 * Emulates the streaming endpoint: the reply is pushed through `onStreamData`
 * in small chunks, the same way the real SSE response is consumed.
 */
export const stubSendUserQuery = async (
  query: string,
  onStreamData?: (_data: string) => void,
  onResponseStarted?: () => void
): Promise<ChatResponse> => {
  stubLog('GET /api/chat/', { query });
  const qid = `stub-qid-${Date.now()}`;

  const reply = CHAT_REPLIES[chatReplyIndex % CHAT_REPLIES.length] as string;
  chatReplyIndex += 1;

  await delay(400);
  onResponseStarted?.();

  if (!onStreamData) {
    await delay(300);
    return { response: reply, status: 'success', qid };
  }

  // Stream in word-sized chunks so the typing indicator behaves realistically.
  const chunks = reply.match(/\S+\s*/g) ?? [reply];
  for (const chunk of chunks) {
    await delay(18);
    onStreamData(chunk);
  }

  return { response: reply, status: 'success', qid };
};

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

/** POST /api/feedback/* and /api/telemetry/* — fire and forget. */
export const stubVoid = async (endpoint: string, payload?: unknown): Promise<void> => {
  stubLog(endpoint, payload);
  await delay(120);
};

/** Default location used when the browser withholds geolocation. */
export const STUB_LOCATION: LocationData = {
  latitude: 18.5204,
  longitude: 73.8567,
};
