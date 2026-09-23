import { getConfig } from "@/lib/config/runtime-config";

/**
 * Which optional surfaces the client offers.
 *
 * Chat is the product and has no flag. Everything else here needs a backend
 * that does not exist yet, so each is off until something can serve it.
 *
 * A flag being off means the control is not rendered and its network path is
 * never entered — not that it is shown disabled. A greyed-out button is still
 * a claim that the feature exists.
 *
 * Read once at module init, which is safe because configuration is immutable
 * after `loadRuntimeConfig()` resolves. Nothing in the app may import this
 * before that; see the note in `src/main.tsx`.
 */
export type FeatureName =
	| "voiceInput"
	| "textToSpeech"
	| "imageQuestions"
	| "suggestions"
	| "geolocation"
	| "languageSelector";

const configured = getConfig().features ?? {};

export const FEATURES: Record<FeatureName, boolean> = {
	voiceInput: configured.voiceInput === true,
	textToSpeech: configured.textToSpeech === true,
	imageQuestions: configured.imageQuestions === true,
	suggestions: configured.suggestions === true,
	geolocation: configured.geolocation === true,
	languageSelector: configured.languageSelector === true
};
