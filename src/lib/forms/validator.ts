import { Validator as SchemaValidator, type OutputUnit, type Schema } from "@cfworker/json-schema";
import type {
	CustomValidator,
	RJSFSchema,
	RJSFValidationError,
	UiSchema,
	ValidationData,
	ValidatorType
} from "@rjsf/utils";
import {
	createErrorHandler,
	getDefaultFormState,
	toErrorSchema,
	unwrapErrorHandler,
	validationDataMerge
} from "@rjsf/utils";

/**
 * RJSF's validator, on a JSON Schema checker that walks the schema instead of
 * compiling it to code. The container's CSP has no `unsafe-eval`, so Ajv's
 * `new Function` is refused there and the form could not be submitted.
 *
 * Errors keep Ajv's shape: `name` is the keyword, `property` the dotted path,
 * and `params` carries what `farmerMessages` reads (`limit`, `missingProperty`).
 */

// What Ajv 8 checks by default; the schema `fieldsToSchema` builds names none.
const DRAFT = "7";
const COLLECT_EVERY_ERROR = false;

export const validator: ValidatorType = {
	validateFormData(formData, schema, customValidate, transformErrors, uiSchema) {
		let errors = check(schema, formData);
		if (transformErrors) errors = transformErrors(errors, uiSchema);
		const result: ValidationData<unknown> = { errors, errorSchema: toErrorSchema(errors) };
		if (!customValidate) return result;
		return withCustomErrors(result, schema, formData, customValidate, uiSchema);
	},

	isValid(schema, formData) {
		return run(schema, formData).valid;
	},

	rawValidation<Result = OutputUnit>(schema: RJSFSchema, formData?: unknown) {
		return { errors: run(schema, formData).errors as Result[] };
	}
};

function run(schema: RJSFSchema, formData: unknown) {
	return new SchemaValidator(schema as Schema, DRAFT, COLLECT_EVERY_ERROR).validate(formData);
}

function check(schema: RJSFSchema, formData: unknown): RJSFValidationError[] {
	return run(schema, formData)
		.errors.filter((unit) => !CONTAINER_KEYWORDS.has(unit.keyword))
		.map((unit) => toRjsfError(unit, schema));
}

// The checker reports a failing child twice: once as its own error and once on
// the keyword that led to it. Ajv reports only the child, and that is the one
// a field shows.
const CONTAINER_KEYWORDS = new Set([
	"properties",
	"patternProperties",
	"additionalProperties",
	"unevaluatedProperties",
	"items",
	"prefixItems",
	"unevaluatedItems",
	"contains",
	"propertyNames",
	"dependentSchemas",
	"allOf",
	"$ref"
]);

function withCustomErrors(
	result: ValidationData<unknown>,
	schema: RJSFSchema,
	formData: unknown,
	customValidate: CustomValidator,
	uiSchema?: UiSchema
): ValidationData<unknown> {
	const filled = getDefaultFormState(validator, schema, formData, schema, true);
	const handler = customValidate(filled, createErrorHandler(filled), uiSchema, result.errorSchema);
	return validationDataMerge(result, unwrapErrorHandler(handler));
}

function toRjsfError(unit: OutputUnit, schema: RJSFSchema): RJSFValidationError {
	const missing = missingProperty(unit);
	const owner = dottedPath(unit.instanceLocation);
	const property = missing ? `${owner}.${missing}` : owner;
	const message = unit.error;
	return {
		name: unit.keyword,
		property,
		message,
		params: missing ? { missingProperty: missing } : limitParams(unit, schema),
		stack: `${property} ${message}`.trim(),
		schemaPath: unit.keywordLocation
	};
}

/** `#/grievance/description` → `.grievance.description`, as Ajv wrote it. */
function dottedPath(instanceLocation: string): string {
	return instanceLocation
		.replace(/^#/, "")
		.split("/")
		.map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
		.join(".");
}

// The checker names the missing property only in its message.
const MISSING_PROPERTY = /required property "([^"]+)"/;

function missingProperty(unit: OutputUnit): string | undefined {
	return unit.keyword === "required" ? MISSING_PROPERTY.exec(unit.error)?.[1] : undefined;
}

const LIMIT_KEYWORDS = new Set(["minLength", "maxLength"]);

/** Ajv's `params.limit`, read back off the schema the error points at. */
function limitParams(unit: OutputUnit, schema: RJSFSchema): Record<string, unknown> {
	if (!LIMIT_KEYWORDS.has(unit.keyword)) return {};
	return { limit: valueAt(schema, unit.keywordLocation) };
}

function valueAt(schema: RJSFSchema, keywordLocation: string): unknown {
	return keywordLocation
		.replace(/^#\/?/, "")
		.split("/")
		.filter(Boolean)
		.reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], schema);
}
