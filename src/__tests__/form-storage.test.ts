/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearForms, loadForm, removeForm, saveForm, type SavedForm } from "@/lib/forms/form-storage";
import type { FormBlock } from "@/lib/api-service";

const form: FormBlock = {
	type: "form",
	formId: "f-1",
	context: { scheme: "PMFBY" },
	fields: [
		{ name: "applicantPhone", label: "Phone", kind: "text" },
		{ name: "otp", label: "OTP", kind: "secret" }
	]
};

const saved = (extra: Partial<SavedForm> = {}): SavedForm => ({
	form,
	status: "open",
	errors: {},
	values: { applicantPhone: "9876543210", otp: "123456" },
	...extra
});

describe("form storage", () => {
	beforeEach(() => localStorage.clear());
	afterEach(() => vi.unstubAllGlobals());

	it("saves and loads a form by its id", () => {
		saveForm(saved());

		expect(loadForm("f-1")?.values.applicantPhone).toBe("9876543210");
		expect(loadForm("f-2")).toBeNull();
	});

	it("never writes a secret value", () => {
		saveForm(saved());

		expect(loadForm("f-1")?.values.otp).toBe("");
		expect(JSON.stringify({ ...localStorage })).not.toContain("123456");
	});

	it("removes one form, or every form and nothing else", () => {
		localStorage.setItem("language", "en");
		saveForm(saved());
		saveForm(saved({ form: { ...form, formId: "f-2" } }));

		removeForm("f-1");
		expect(loadForm("f-1")).toBeNull();
		expect(loadForm("f-2")).not.toBeNull();

		clearForms();
		expect(loadForm("f-2")).toBeNull();
		expect(localStorage.getItem("language")).toBe("en");
	});

	it("keeps working when storage throws", () => {
		const fail = () => {
			throw new Error("blocked");
		};
		vi.stubGlobal("localStorage", { setItem: fail, getItem: fail, removeItem: fail });

		expect(() => saveForm(saved())).not.toThrow();
		expect(loadForm("f-1")).toBeNull();
		expect(() => clearForms()).not.toThrow();
	});
});
