/**
 * The shape of a follow-up suggestion.
 *
 * Suggestions come from `GET /api/suggest/` via `api-service`, behind the
 * `suggestions` flag.
 */
export interface Suggestion {
	id: string;
	text: string;
}
