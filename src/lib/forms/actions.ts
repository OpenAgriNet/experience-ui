import type { FormAction, FormBlock } from "@/lib/api-service";

/** Buttons this client knows how to send. Any other name is skipped, as the API asks. */
const KNOWN_ACTIONS = new Set(["resend_init"]);

export function knownActions(form: FormBlock): FormAction[] {
	return (form.actions ?? []).filter((action) => KNOWN_ACTIONS.has(action.name));
}
