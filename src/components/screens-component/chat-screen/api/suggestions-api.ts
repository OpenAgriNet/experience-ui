/**
 * The shape of a follow-up suggestion.
 *
 * This file used to also hold a fake `fetchSuggestions` returning four
 * hardcoded English strings on a timer — scaffolding from before the stub
 * layer existed, with no caller in any commit. Real suggestions come from
 * `GET /api/suggest/` via `api-service`, behind the `suggestions` flag.
 */
export interface Suggestion {
	id: string;
	text: string;
}
