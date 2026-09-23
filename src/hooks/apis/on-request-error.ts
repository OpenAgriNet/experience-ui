/**
 * Default handler for any mutation that fails without its own onError.
 *
 * Previously a React component returning an empty <div>, used as a
 * MutationCache callback — the element went nowhere and only the logging ever
 * had an effect.
 */
export function onRequestError(error: unknown): void {
	console.error(error);
}
