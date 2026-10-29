import { describe, expect, it } from "vitest";
import { fieldsToSchema, toFormData, toValues } from "@/lib/forms/json-schema";
import type { FormField } from "@/lib/api-service";

/**
 * The DSS sends a form as a field list (#205). RJSF draws JSON Schema, so the
 * list is turned into one: dotted names nest, options become `oneOf`, and the
 * kind picks the widget.
 */
const fields: FormField[] = [
	{ name: "applicantPhone", label: "Phone used at enrolment", kind: "text", required: true, pattern: "^[6-9][0-9]{9}$" },
	{
		name: "season",
		label: "Season",
		kind: "select",
		required: true,
		options: [
			{ value: "Kharif", label: "Kharif (monsoon)" },
			{ value: "Rabi", label: "Rabi" }
		]
	},
	{ name: "otp", label: "OTP", kind: "secret", minLength: 6, maxLength: 6 },
	{ name: "grievance.description", label: "What went wrong", kind: "textarea", required: true, minLength: 10 }
];

describe("fieldsToSchema", () => {
	it("turns every field into a string property, in order, with its label and rules", () => {
		const { schema } = fieldsToSchema(fields);

		expect(Object.keys(schema.properties ?? {})).toEqual(["applicantPhone", "season", "otp", "grievance"]);
		expect(schema.properties?.applicantPhone).toEqual({
			type: "string",
			title: "Phone used at enrolment",
			pattern: "^[6-9][0-9]{9}$"
		});
		expect(schema.properties?.otp).toEqual({ type: "string", title: "OTP", minLength: 6, maxLength: 6 });
	});

	it("turns options into oneOf choices, labelled", () => {
		const { schema } = fieldsToSchema(fields);

		expect(schema.properties?.season).toEqual({
			type: "string",
			title: "Season",
			oneOf: [
				{ const: "Kharif", title: "Kharif (monsoon)" },
				{ const: "Rabi", title: "Rabi" }
			]
		});
	});

	it("nests a dotted name, required at every level when the field is", () => {
		const { schema } = fieldsToSchema(fields);

		expect(schema.required).toEqual(["applicantPhone", "season", "grievance"]);
		expect(schema.properties?.grievance).toEqual({
			type: "object",
			required: ["description"],
			properties: { description: { type: "string", title: "What went wrong", minLength: 10 } }
		});
	});

	it("picks the widget from the kind", () => {
		const { uiSchema } = fieldsToSchema(fields);

		expect(uiSchema).toEqual({
			otp: { "ui:widget": "password" },
			grievance: { description: { "ui:widget": "textarea" } }
		});
	});

	it("keeps a text field with an empty options list a text field, as the DSS sends it", () => {
		const { schema } = fieldsToSchema([
			{ name: "applicantMobile", label: "Applicant mobile", kind: "text", required: true, pattern: "^[6-9][0-9]{9}$", options: [] }
		]);

		expect(schema.properties?.applicantMobile).toEqual({
			type: "string",
			title: "Applicant mobile",
			pattern: "^[6-9][0-9]{9}$"
		});
	});
});

describe("form data and values", () => {
	it("turns dotted values into nested form data and back", () => {
		const values = { applicantPhone: "9876543210", "grievance.description": "Claim not paid" };

		const data = toFormData(values);
		expect(data).toEqual({ applicantPhone: "9876543210", grievance: { description: "Claim not paid" } });
		expect(toValues(data)).toEqual(values);
	});

	it("drops empty values when flattening", () => {
		expect(toValues({ applicantPhone: undefined, grievance: {} })).toEqual({});
	});
});
