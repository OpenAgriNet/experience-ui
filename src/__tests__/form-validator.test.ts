import { describe, expect, it } from "vitest";
import type { RJSFSchema } from "@rjsf/utils";
import { validator } from "@/lib/forms/validator";

/**
 * The form validator checks the schema `fieldsToSchema` builds without
 * compiling it to code, so it runs under the container's CSP, which has no
 * `unsafe-eval`. Its errors keep the shape RJSF and `farmerMessages` expect.
 */
const schema: RJSFSchema = {
	type: "object",
	required: ["applicantPhone", "season", "grievance"],
	properties: {
		applicantPhone: { type: "string", title: "Phone", pattern: "^[6-9][0-9]{9}$" },
		season: {
			type: "string",
			title: "Season",
			oneOf: [
				{ const: "Kharif", title: "Kharif" },
				{ const: "Rabi", title: "Rabi" }
			]
		},
		otp: { type: "string", title: "OTP", minLength: 6, maxLength: 6 },
		grievance: {
			type: "object",
			required: ["description"],
			properties: { description: { type: "string", title: "What went wrong", minLength: 10 } }
		}
	}
};

describe("form validator", () => {
	it("names a missing nested field the way RJSF expects", () => {
		const { errors } = validator.validateFormData(
			{ applicantPhone: "9090909090", season: "Kharif", grievance: {} },
			schema
		);

		expect(errors).toEqual([
			expect.objectContaining({
				name: "required",
				property: ".grievance.description",
				params: { missingProperty: "description" }
			})
		]);
	});

	it("reports a pattern miss and a length limit on the field", () => {
		const { errors } = validator.validateFormData(
			{
				applicantPhone: "123",
				season: "Kharif",
				otp: "12",
				grievance: { description: "did not get payment" }
			},
			schema
		);

		expect(errors).toEqual([
			expect.objectContaining({ name: "pattern", property: ".applicantPhone" }),
			expect.objectContaining({ name: "minLength", property: ".otp", params: { limit: 6 } })
		]);
	});

	it("reports a value outside the options as oneOf, as Ajv did", () => {
		const { errors } = validator.validateFormData(
			{
				applicantPhone: "9090909090",
				season: "Summer",
				grievance: { description: "did not get payment" }
			},
			schema
		);

		// `farmerMessages` drops the per-option `const` errors and keeps `oneOf`.
		expect(errors.map((error) => error.name)).toEqual(["oneOf", "const", "const"]);
		expect(errors[0]?.property).toBe(".season");
	});

	it("passes a filled form and says so through isValid", () => {
		const data = {
			applicantPhone: "9090909090",
			season: "Rabi",
			otp: "123456",
			grievance: { description: "did not get payment" }
		};

		expect(validator.validateFormData(data, schema)).toEqual({ errors: [], errorSchema: {} });
		expect(validator.isValid(schema, data, schema)).toBe(true);
		expect(validator.isValid(schema, { ...data, otp: "1" }, schema)).toBe(false);
	});
});
