import type { FormBlock } from "@/lib/api-service";

/** What the farmer sees for one field: its label and value. */
export type FormRow = { label: string; value: string };

const SECRET_DOTS = "••••••";

/**
 * How a filled form reads back to the farmer, in the confirm pop-up and in
 * their sent bubble: option labels for choices, dots for secrets. A fixed
 * number of dots, so not even the length of a secret shows.
 */
export function formRows(form: FormBlock, values: Record<string, string>): FormRow[] {
	return form.fields.map((field) => {
		const value = (values[field.name] ?? "").trim();
		if (field.kind === "secret") return { label: field.label, value: value ? SECRET_DOTS : "" };
		const option = field.options?.find((o) => o.value === value);
		return { label: field.label, value: option?.label ?? value };
	});
}
