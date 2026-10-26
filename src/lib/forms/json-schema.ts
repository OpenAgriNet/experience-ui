import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import type { FormField } from "@/lib/api-service";

/**
 * The DSS sends a form as a field list (#205). RJSF draws JSON Schema, so the
 * list is turned into one here; everything after Submit (pop-up, sent bubble,
 * submission, saved copy) still works on the field list.
 *
 * A dotted name (`grievance.description`) nests as an object, and RJSF names
 * it back with dots through `toValues`. Every value is a string.
 */

type Schema = RJSFSchema;

/** The JSON Schema and uiSchema RJSF draws for these fields. */
export function fieldsToSchema(fields: FormField[]): { schema: Schema; uiSchema: UiSchema } {
	const schema: Schema = { type: "object", properties: {} };
	const uiSchema: UiSchema = {};

	for (const field of fields) {
		const keys = field.name.split(".");
		let node = schema;
		let ui = uiSchema;
		for (const key of keys.slice(0, -1)) {
			if (field.required) markRequired(node, key);
			node.properties![key] ??= { type: "object", properties: {} };
			node = node.properties![key] as Schema;
			ui = (ui[key] ??= {}) as UiSchema;
		}

		const key = keys.at(-1)!;
		if (field.required) markRequired(node, key);
		node.properties![key] = toProperty(field);
		const widget = WIDGETS[field.kind];
		if (widget) ui[key] = { "ui:widget": widget };
	}

	return { schema, uiSchema };
}

const WIDGETS: Partial<Record<FormField["kind"], string>> = { secret: "password", textarea: "textarea" };

function markRequired(node: Schema, key: string): void {
	node.required ??= [];
	if (!node.required.includes(key)) node.required.push(key);
}

function toProperty(field: FormField): Schema {
	const property: Schema = { type: "string", title: field.label };
	if (field.pattern !== undefined) property.pattern = field.pattern;
	if (field.minLength !== undefined) property.minLength = field.minLength;
	if (field.maxLength !== undefined) property.maxLength = field.maxLength;
	if (field.options) property.oneOf = field.options.map((o) => ({ const: o.value, title: o.label }));
	return property;
}

type FormData = Record<string, unknown>;

/** Dotted values to the nested object RJSF edits. */
export function toFormData(values: Record<string, string>): FormData {
	const data: FormData = {};
	for (const [name, value] of Object.entries(values)) {
		const keys = name.split(".");
		let node = data;
		for (const key of keys.slice(0, -1)) {
			node[key] = (node[key] as FormData | undefined) ?? {};
			node = node[key] as FormData;
		}
		node[keys.at(-1)!] = value;
	}
	return data;
}

/** RJSF's nested object back to dotted values. Empty ones are left out. */
export function toValues(data: unknown, prefix = ""): Record<string, string> {
	if (typeof data !== "object" || data === null) return {};
	return Object.entries(data).reduce<Record<string, string>>((values, [key, value]) => {
		if (typeof value === "object" && value !== null) return { ...values, ...toValues(value, `${prefix}${key}.`) };
		if (value !== undefined && value !== null && value !== "") values[prefix + key] = String(value);
		return values;
	}, {});
}
