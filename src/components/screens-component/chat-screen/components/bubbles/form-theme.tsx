import type {
	BaseInputTemplateProps,
	FieldErrorProps,
	FieldTemplateProps,
	ObjectFieldTemplateProps,
	RegistryWidgetsType,
	TemplatesType,
	WidgetProps
} from "@rjsf/utils";
import { ariaDescribedByIds, enumOptionsIndexForValue, enumOptionsValueForIndex, getInputProps } from "@rjsf/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * RJSF drawn with this client's own inputs, so a form looks like the rest of
 * the chat. Only what a string-only form needs: a labelled field, a text or
 * password input, a textarea, a select, and the error under it.
 */

const FIELD_BG = "bg-white dark:bg-transparent";

function FieldTemplate({ id, label, required, hidden, displayLabel, children, errors }: FieldTemplateProps) {
	if (hidden) return <div className="hidden">{children}</div>;
	return (
		<div className="flex flex-col gap-1.5">
			{displayLabel && label && (
				<label htmlFor={id} className="text-sm font-medium text-foreground">
					{label}
					{required && <span className="text-red-600"> *</span>}
				</label>
			)}
			{children}
			{errors}
		</div>
	);
}

/**
 * The farmer's form is a flat list, even where the schema nests an object. An
 * object whose fields are all hidden takes no space.
 */
function ObjectFieldTemplate({ properties }: ObjectFieldTemplateProps) {
	const allHidden = properties.every((p) => p.hidden);
	return (
		<div className={allHidden ? "hidden" : "flex flex-col gap-4"}>{properties.map((p) => p.content)}</div>
	);
}

function FieldErrorTemplate({ errors = [] }: FieldErrorProps) {
	const shown = errors.filter((e) => typeof e === "string" && e);
	if (shown.length === 0) return null;
	return <p className="text-sm text-red-600 dark:text-red-400">{shown[0]}</p>;
}

function BaseInputTemplate(props: BaseInputTemplateProps) {
	const { id, htmlName, value, disabled, readonly, autofocus, onChange, onBlur, onFocus, options, schema, type, rawErrors } =
		props;
	const inputProps = getInputProps(schema, type, options);
	return (
		<Input
			id={id}
			name={htmlName || id}
			{...inputProps}
			value={value ?? ""}
			disabled={disabled || readonly}
			autoFocus={autofocus}
			autoComplete={inputProps.type === "password" ? "one-time-code" : "off"}
			aria-invalid={rawErrors?.length ? true : undefined}
			aria-describedby={ariaDescribedByIds(id)}
			className={FIELD_BG}
			onChange={(e) => onChange(e.target.value === "" ? options.emptyValue : e.target.value)}
			onBlur={(e) => onBlur(id, e.target.value)}
			onFocus={(e) => onFocus(id, e.target.value)}
		/>
	);
}

function TextareaWidget({ id, htmlName, value, disabled, readonly, onChange, onBlur, onFocus, options, rawErrors }: WidgetProps) {
	return (
		<Textarea
			id={id}
			name={htmlName || id}
			rows={3}
			value={value ?? ""}
			disabled={disabled || readonly}
			aria-invalid={rawErrors?.length ? true : undefined}
			aria-describedby={ariaDescribedByIds(id)}
			className={FIELD_BG}
			onChange={(e) => onChange(e.target.value === "" ? options.emptyValue : e.target.value)}
			onBlur={(e) => onBlur(id, e.target.value)}
			onFocus={(e) => onFocus(id, e.target.value)}
		/>
	);
}

function SelectWidget({ id, htmlName, value, disabled, readonly, onChange, onBlur, onFocus, options, rawErrors }: WidgetProps) {
	const { enumOptions = [], emptyValue } = options;
	const index = enumOptionsIndexForValue(value, enumOptions);
	const decode = (i: string) => (i === "" ? emptyValue : enumOptionsValueForIndex(i, enumOptions, emptyValue));
	return (
		<select
			id={id}
			name={htmlName || id}
			value={typeof index === "string" ? index : ""}
			disabled={disabled || readonly}
			aria-invalid={rawErrors?.length ? true : undefined}
			aria-describedby={ariaDescribedByIds(id)}
			onChange={(e) => onChange(decode(e.target.value))}
			onBlur={(e) => onBlur(id, decode(e.target.value))}
			onFocus={(e) => onFocus(id, decode(e.target.value))}
			className={cn(
				"border-input h-9 w-full rounded-md border bg-white px-3 text-base shadow-xs outline-none md:text-sm dark:bg-transparent",
				"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50",
				"aria-invalid:border-destructive"
			)}
		>
			<option value="">Choose…</option>
			{enumOptions.map((option, i) => (
				<option key={String(option.value)} value={String(i)}>
					{option.label}
				</option>
			))}
		</select>
	);
}

export const FORM_TEMPLATES: Partial<TemplatesType> = {
	FieldTemplate,
	ObjectFieldTemplate,
	FieldErrorTemplate,
	BaseInputTemplate
};

export const FORM_WIDGETS: RegistryWidgetsType = {
	TextareaWidget,
	SelectWidget
};
