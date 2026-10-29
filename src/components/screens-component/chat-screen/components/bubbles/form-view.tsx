import { useMemo, useState } from "react";
import Form from "@rjsf/core";
import type { ErrorSchema, ErrorTransformer, RJSFValidationError, UiSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { useLanguage } from "@/components/LanguageProvider";
import { useChatStore } from "@/hooks/store/chat";
import type { FormBlock } from "@/lib/api-service";
import { loadForm, saveForm } from "@/lib/forms/form-storage";
import { fieldsToSchema, toFormData, toValues } from "@/lib/forms/json-schema";
import { formRows } from "@/lib/forms/rows";
import { ConfirmDialog, FixHint, FORM_FRAME, FormFooter } from "./form-parts";
import { FORM_TEMPLATES, FORM_WIDGETS } from "./form-theme";

/**
 * The form the assistant asked for, under its card. The DSS sends fields
 * (#205); they are turned into JSON Schema, and RJSF draws and checks them.
 * Submit opens a pop-up that reads back every field before anything is sent.
 *
 * What the farmer types lives here and in the saved copy, never in the chat
 * store. Where the form stands and the DSS's errors come from the store.
 * After the DSS flags fields, only those are asked again; the pop-up still
 * reads back every field. Values leave with dotted names, as the DSS expects.
 */
export function FormView({ form }: { readonly form: FormBlock }) {
	const { language, t } = useLanguage();
	const state = useChatStore((s) => s.forms[form.formId]);
	const submitForm = useChatStore((s) => s.submitForm);

	const [values, setValues] = useState<Record<string, string>>(() => loadForm(form.formId)?.values ?? {});
	// A DSS error stays until the farmer changes that field.
	const [edited, setEdited] = useState<Set<string>>(new Set());
	// Fields not asked again that failed the check: shown, or the farmer could not fix them.
	const [failedHidden, setFailedHidden] = useState<string[]>([]);
	const [confirming, setConfirming] = useState(false);

	const status = state?.status ?? "open";
	const locked = status !== "open";
	const fields = form.fields;
	const { schema, uiSchema: baseUiSchema } = useMemo(() => fieldsToSchema(fields), [fields]);
	const asked = state?.asked;
	const shown = useMemo(() => (asked ? new Set([...asked, ...failedHidden]) : null), [asked, failedHidden]);

	const uiSchema = useMemo(
		() => hideAllBut(baseUiSchema, fields.map((f) => f.name), shown),
		[baseUiSchema, fields, shown]
	);

	const extraErrors = useMemo(() => {
		const errors = Object.entries(state?.errors ?? {}).filter(([name]) => !edited.has(name));
		return errors.length ? toErrorSchema(Object.fromEntries(errors)) : undefined;
	}, [state?.errors, edited]);

	const change = (data: unknown) => {
		const next = toValues(data);
		const changed = fields.map((f) => f.name).filter((name) => (next[name] ?? "") !== (values[name] ?? ""));
		if (changed.length === 0) return;
		setValues(next);
		setEdited((prev) => new Set([...prev, ...changed]));
		saveForm({ form, status, errors: state?.errors ?? {}, asked, values: next });
	};

	const confirm = () => {
		setConfirming(false);
		setEdited(new Set());
		setFailedHidden([]);
		void submitForm(form.formId, values, language, t);
	};

	return (
		<div className={FORM_FRAME}>
			{shown && shown.size < fields.length && !locked && (
				<div className="mb-4">
					<FixHint />
				</div>
			)}
			<Form
				schema={schema}
				uiSchema={uiSchema}
				formData={toFormData(values)}
				validator={validator}
				templates={FORM_TEMPLATES}
				widgets={FORM_WIDGETS}
				extraErrors={extraErrors}
				transformErrors={farmerMessages}
				disabled={locked}
				// A `oneOf` choice is not a default: the form starts empty (#205).
				experimental_defaultFormStateBehavior={{ constAsDefaults: "never" }}
				noHtml5Validate
				showErrorList={false}
				onChange={(event) => change(event.formData)}
				onError={(errors) => {
					if (asked) setFailedHidden(errors.map(pathOf).filter((name) => !asked.includes(name)));
				}}
				onSubmit={() => setConfirming(true)}
			>
				<div className="mt-4">
					<FormFooter status={status} />
				</div>
			</Form>

			<ConfirmDialog
				open={confirming}
				rows={formRows(form, values)}
				disabled={locked}
				onEdit={() => setConfirming(false)}
				onConfirm={confirm}
			/>
		</div>
	);
}

/** Plain words for the farmer, in place of ajv's. */
const farmerMessages: ErrorTransformer = (errors) =>
	errors
		.filter((error) => error.name !== "const")
		.map((error) => ({ ...error, message: messageFor(error) }));

function messageFor(error: RJSFValidationError): string | undefined {
	switch (error.name) {
		case "required":
			return "This field is required.";
		case "pattern":
			return "Enter a valid value.";
		case "minLength":
			return `Enter at least ${error.params?.limit} characters.`;
		case "maxLength":
			return `Enter at most ${error.params?.limit} characters.`;
		case "oneOf":
		case "enum":
			return "Choose one of the options.";
		default:
			return error.message;
	}
}

/** `.grievance.description` → `grievance.description`. A required error names its missing property. */
function pathOf(error: RJSFValidationError): string {
	const path = (error.property ?? "").replace(/^\./, "");
	if (error.name === "required" && error.params?.missingProperty && !path.endsWith(error.params.missingProperty)) {
		return path ? `${path}.${error.params.missingProperty}` : error.params.missingProperty;
	}
	return path;
}

/** Dotted names with errors → RJSF's nested error object. */
function toErrorSchema(errors: Record<string, string>): ErrorSchema {
	const schema: Record<string, unknown> = {};
	for (const [name, message] of Object.entries(errors)) {
		let node = schema;
		for (const key of name.split(".")) {
			node[key] = (node[key] as Record<string, unknown> | undefined) ?? {};
			node = node[key] as Record<string, unknown>;
		}
		node.__errors = [message];
	}
	return schema as ErrorSchema;
}

/** The uiSchema with every field outside `shown` hidden. No `shown`: the whole form. */
function hideAllBut(uiSchema: UiSchema, names: string[], shown: Set<string> | null): UiSchema {
	if (!shown) return uiSchema;
	const result: UiSchema = structuredClone(uiSchema);
	for (const name of names) {
		if (shown.has(name)) continue;
		let node = result;
		for (const key of name.split(".")) {
			node[key] = (node[key] as UiSchema | undefined) ?? {};
			node = node[key] as UiSchema;
		}
		node["ui:widget"] = "hidden";
	}
	return result;
}
