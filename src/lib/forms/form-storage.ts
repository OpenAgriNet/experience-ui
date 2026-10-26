import type { FormBlock } from "@/lib/api-service";

/**
 * Each offered form, kept in localStorage under `form:<formId>`: the form,
 * where it stands, its latest errors and what the farmer has typed so far.
 *
 * A secret field (an OTP) is never written: it is saved empty. Storage can be
 * full, blocked or missing, so every call here swallows its error and the
 * form carries on without it.
 */

/** `closed`: not filed because the system was down. The farmer is told to try later, not offered the form again. */
export type FormStatus = "open" | "sending" | "filed" | "closed";

export type SavedForm = {
	form: FormBlock;
	status: FormStatus;
	/** The latest error per field name. */
	errors: Record<string, string>;
	/** The fields asked again after the DSS flagged them. Unset: the whole form. */
	asked?: string[];
	values: Record<string, string>;
};

const PREFIX = "form:";

export function saveForm(saved: SavedForm): void {
	const values = { ...saved.values };
	for (const field of saved.form.fields) {
		if (field.kind === "secret") values[field.name] = "";
	}
	try {
		localStorage.setItem(PREFIX + saved.form.formId, JSON.stringify({ ...saved, values }));
	} catch {
		// The form still works; only a remount loses what was typed.
	}
}

export function loadForm(formId: string): SavedForm | null {
	try {
		const raw = localStorage.getItem(PREFIX + formId);
		return raw ? (JSON.parse(raw) as SavedForm) : null;
	} catch {
		return null;
	}
}

export function removeForm(formId: string): void {
	try {
		localStorage.removeItem(PREFIX + formId);
	} catch {
		// Nothing to do.
	}
}

/** Every saved form, for Clear chat and a fresh start. */
export function clearForms(): void {
	try {
		const keys = Object.keys(localStorage).filter((key) => key.startsWith(PREFIX));
		for (const key of keys) localStorage.removeItem(key);
	} catch {
		// Nothing to do.
	}
}
