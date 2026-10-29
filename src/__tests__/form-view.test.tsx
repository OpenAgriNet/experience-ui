/**
 * @vitest-environment happy-dom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/runtime-config", async () => {
	const { default: shipped } = await import("@/config/app-config.json");
	const config = { ...shipped, stubs: { enabled: false }, features: { forms: true } };
	return { getConfig: () => config };
});
vi.mock("@/components/LanguageProvider", () => ({
	useLanguage: () => ({ language: "en", t: (key: string) => key })
}));

import { FormView } from "@/components/screens-component/chat-screen/components/bubbles/form-view";
import { useChatStore } from "@/hooks/store/chat";
import { saveForm } from "@/lib/forms/form-storage";
import type { FormBlock } from "@/lib/api-service";

/**
 * The form a farmer fills in, sent by the DSS as fields (#205) and drawn by
 * RJSF: every kind drawn, a failing field stops the pop-up, the pop-up reads
 * back every field, and only Confirm sends, with dotted names.
 */
const form: FormBlock = {
	type: "form",
	formId: "f-1",
	context: {},
	fields: [
		{ name: "applicantPhone", label: "Phone", kind: "text", required: true, pattern: "^[6-9][0-9]{9}$" },
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
		{ name: "otp", label: "OTP", kind: "secret" },
		{ name: "grievance.description", label: "What went wrong", kind: "textarea", required: true, minLength: 10 }
	]
};

let container: HTMLDivElement;
let root: Root;
let submitForm: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<void>>>;

const field = (name: string) =>
	container.querySelector<HTMLInputElement & HTMLSelectElement>(`[name="${name}"]`);

/** Set a value the way React sees a farmer type it. */
const type = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) =>
	act(() => {
		const proto = Object.getPrototypeOf(el) as object;
		Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
		el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
	});

const click = (label: string) =>
	act(() => {
		const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
		if (!button) throw new Error(`No button "${label}"`);
		button.click();
	});

const hasButton = (label: string) => [...container.querySelectorAll("button")].some((b) => b.textContent?.trim() === label);

const render = () => act(() => root.render(<FormView form={form} />));

const selectOption = (name: string, label: string) => {
	const select = field(name)!;
	const option = [...select.options].find((o) => o.textContent === label)!;
	return type(select, option.value);
};

const fillValid = async () => {
	await type(field("root_applicantPhone")!, "9876543210");
	await selectOption("root_season", "Kharif (monsoon)");
	await type(field("root_otp")!, "123456");
	await type(field("root_grievance_description")!, "My claim was not paid.");
};

describe("form view", () => {
	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		localStorage.clear();
		submitForm = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
		useChatStore.setState({ forms: { "f-1": { status: "open", errors: {} } }, submitForm });
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it("draws every field with its label and the right input", async () => {
		await render();

		expect(container.textContent).toContain("Phone");
		expect(field("root_applicantPhone")?.type).toBe("text");
		expect(field("root_season")?.tagName).toBe("SELECT");
		expect(container.textContent).toContain("Kharif (monsoon)");
		expect(field("root_otp")?.type).toBe("password");
		expect(field("root_grievance_description")?.tagName).toBe("TEXTAREA");
	});

	it("starts every field empty, with no choice made for the farmer", async () => {
		await render();

		expect(field("root_season")?.value).toBe("");
	});

	it("shows the error under a failing field and opens no pop-up", async () => {
		await render();
		await type(field("root_applicantPhone")!, "123");
		await click("Submit");

		expect(container.textContent).toContain("Enter a valid value.");
		expect(container.textContent).toContain("This field is required.");
		expect(document.querySelector('[role="dialog"]')).toBeNull();
	});

	it("reads back every field and sends the values with dotted names", async () => {
		await render();
		await fillValid();
		await click("Submit");

		const dialog = document.querySelector('[role="dialog"]')!;
		expect(dialog.textContent).toContain("Kharif (monsoon)");
		expect(dialog.textContent).toContain("••••••");
		expect(dialog.textContent).not.toContain("123456");

		await click("Confirm");
		expect(submitForm).toHaveBeenCalledWith(
			"f-1",
			{
				applicantPhone: "9876543210",
				season: "Kharif",
				otp: "123456",
				"grievance.description": "My claim was not paid."
			},
			"en",
			expect.any(Function)
		);
	});

	it("goes back to the form with every value on Edit, and sends nothing", async () => {
		await render();
		await fillValid();
		await click("Submit");
		await click("Edit");

		expect(document.querySelector('[role="dialog"]')).toBeNull();
		expect(field("root_applicantPhone")?.value).toBe("9876543210");
		expect(submitForm).not.toHaveBeenCalled();
	});

	it("locks the form and says it was not submitted when the system was down", async () => {
		useChatStore.setState({ forms: { "f-1": { status: "closed", errors: {} } } });
		await render();

		expect(field("root_applicantPhone")?.disabled).toBe(true);
		expect(container.textContent).toContain("Not submitted");
		expect(hasButton("Submit")).toBe(false);
	});

	it("locks the form once it is filed", async () => {
		useChatStore.setState({ forms: { "f-1": { status: "filed", errors: {} } } });
		await render();

		expect(field("root_applicantPhone")?.disabled).toBe(true);
		expect(container.textContent).toContain("Submitted");
		expect(hasButton("Submit")).toBe(false);
	});

	describe("after the DSS flagged a field", () => {
		const errors = { applicantPhone: "This phone is not the one used at enrolment." };
		const filled = { applicantPhone: "9876540000", season: "Kharif", "grievance.description": "My claim was not paid." };

		const renderFlagged = (values: Record<string, string>) => {
			saveForm({ form, status: "open", errors, asked: ["applicantPhone"], values });
			useChatStore.setState({ forms: { "f-1": { status: "open", errors, asked: ["applicantPhone"] } } });
			return render();
		};

		it("asks only for the flagged field, with its error", async () => {
			await renderFlagged(filled);

			expect(container.textContent).toContain("This phone is not the one used at enrolment.");
			expect(container.textContent).not.toContain("What went wrong");
			expect(container.textContent).not.toContain("Season");
		});

		it("still reads back every field in the pop-up", async () => {
			await renderFlagged(filled);
			await type(field("root_applicantPhone")!, "9876543210");
			await click("Submit");

			const dialog = document.querySelector('[role="dialog"]')!;
			expect(dialog.textContent).toContain("9876543210");
			expect(dialog.textContent).toContain("Kharif (monsoon)");
			expect(dialog.textContent).toContain("My claim was not paid.");
		});

		it("shows a hidden field too when it fails the check", async () => {
			await renderFlagged({ ...filled, season: "" });
			await type(field("root_applicantPhone")!, "9876543210");
			await click("Submit");

			expect(container.textContent).toContain("Season");
			expect(container.textContent).toContain("This field is required.");
			expect(document.querySelector('[role="dialog"]')).toBeNull();
		});

		it("keeps showing only the asked fields once filed", async () => {
			await renderFlagged(filled);
			act(() => useChatStore.setState({ forms: { "f-1": { status: "filed", errors: {}, asked: ["applicantPhone"] } } }));

			expect(field("root_applicantPhone")?.disabled).toBe(true);
			expect(container.textContent).not.toContain("Season");
			expect(container.textContent).toContain("Submitted");
		});
	});
});
