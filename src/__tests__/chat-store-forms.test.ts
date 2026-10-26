/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/runtime-config", async () => {
	const { default: shipped } = await import("@/config/app-config.json");
	const config = { ...shipped, stubs: { enabled: false }, features: { forms: true } };
	return { getConfig: () => config };
});

import apiService, { type ChatTurn, type FinalAnswer, type FormBlock } from "@/lib/api-service";
import { useChatStore } from "@/hooks/store/chat";
import { loadForm } from "@/lib/forms/form-storage";

/**
 * A form arrives on an assistant card, is sent back as one `form` item, and
 * the reply decides where it stands: filed, open with errors, or open again.
 */
const form: FormBlock = {
	type: "form",
	formId: "f-1",
	context: { scheme: "PMFBY", category: "Grievance", action: "support" },
	fields: [
		{ name: "applicantPhone", label: "Phone", kind: "text", required: true },
		{
			name: "season",
			label: "Season",
			kind: "select",
			options: [{ value: "Kharif", label: "Kharif (monsoon)" }]
		},
		{ name: "otp", label: "OTP", kind: "secret" }
	]
};

const values = { applicantPhone: "9876543210", season: "Kharif", otp: "123456" };

const answer = (extra: Partial<FinalAnswer> = {}): FinalAnswer => ({
	sessionId: "s-1",
	messageId: "m-1",
	assistantMessageId: crypto.randomUUID(),
	traceId: "t-1",
	outcome: { status: "answered", cause: null },
	content: [{ type: "text", text: "Done.", citations: [] }],
	sources: [],
	...extra
});

const offerForm = async () => {
	vi.spyOn(apiService, "sendUserQuery").mockResolvedValueOnce(
		answer({
			outcome: { status: "requires_input", cause: null },
			content: [{ type: "text", text: "I need a few details.", citations: [] }, form]
		})
	);
	await useChatStore.getState().sendText("I want to file a PMFBY grievance", "en");
};

const sentTurn = (): ChatTurn => {
	const calls = vi.mocked(apiService.sendUserQuery).mock.calls;
	return calls.at(-1)![0];
};

describe("chat store forms", () => {
	beforeEach(() => {
		useChatStore.getState().clearChat();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps the form on the assistant card and leaves the input open", async () => {
		await offerForm();

		const card = useChatStore.getState().messages.at(-1);
		expect(card?.type === "card" && card.form?.formId).toBe("f-1");
		expect(useChatStore.getState().forms["f-1"]?.status).toBe("open");
		expect(useChatStore.getState().isInputLocked).toBe(false);
		expect(loadForm("f-1")?.form.formId).toBe("f-1");
	});

	it("sends one form item with the form's id and context, a new submission id and every value", async () => {
		await offerForm();
		vi.mocked(apiService.sendUserQuery).mockResolvedValueOnce(answer());

		await useChatStore.getState().submitForm("f-1", values, "en");

		const turn = sentTurn();
		expect(turn.query).toBeUndefined();
		expect(turn.content).toEqual([
			{
				type: "form",
				formId: "f-1",
				context: form.context,
				submissionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
				fields: [
					{ name: "applicantPhone", value: "9876543210" },
					{ name: "season", value: "Kharif" },
					{ name: "otp", value: "123456" }
				]
			}
		]);
	});

	it("shows the farmer what they sent, with option labels and secrets as dots", async () => {
		await offerForm();
		vi.mocked(apiService.sendUserQuery).mockResolvedValueOnce(answer());

		await useChatStore.getState().submitForm("f-1", values, "en");

		const sent = useChatStore.getState().messages.find((m) => m.type === "form_submission");
		expect(sent?.type === "form_submission" && sent.rows).toEqual([
			{ label: "Phone", value: "9876543210" },
			{ label: "Season", value: "Kharif (monsoon)" },
			{ label: "OTP", value: "••••••" }
		]);
		expect(JSON.stringify(useChatStore.getState())).not.toContain("123456");
	});

	it("marks the form filed when the reply is answered", async () => {
		await offerForm();
		vi.mocked(apiService.sendUserQuery).mockResolvedValueOnce(answer());

		await useChatStore.getState().submitForm("f-1", values, "en");

		expect(useChatStore.getState().forms["f-1"]?.status).toBe("filed");
		expect(loadForm("f-1")).toBeNull();
	});

	const formError = () =>
		answer({
			outcome: { status: "requires_input", cause: "invalid_input" },
			content: [
				{ type: "text", text: "Please fix one detail.", citations: [] },
				{
					type: "form_error",
					formId: "f-1",
					context: form.context,
					submissionId: "x",
					fields: [{ name: "applicantPhone", label: "Phone", error: "Enter the 10-digit phone." }]
				}
			]
		});

	const providerDown = () =>
		answer({
			outcome: { status: "unavailable", cause: "provider_unavailable" },
			content: [{ type: "text", text: "Not filed. Please try again later.", citations: [] }],
			error: { code: "provider_unavailable", message: "down", retryable: true }
		});

	const cardsWithForm = () =>
		useChatStore.getState().messages.filter((m) => m.type === "card" && m.form?.formId === "f-1");

	it("puts a form_error on the form's fields and opens it again", async () => {
		await offerForm();
		vi.mocked(apiService.sendUserQuery).mockResolvedValueOnce(formError());

		await useChatStore.getState().submitForm("f-1", values, "en");

		expect(useChatStore.getState().forms["f-1"]).toEqual({
			status: "open",
			errors: { applicantPhone: "Enter the 10-digit phone." },
			asked: ["applicantPhone"]
		});
	});

	it("remembers which fields were asked again after the fix is filed", async () => {
		await offerForm();
		vi.mocked(apiService.sendUserQuery).mockResolvedValueOnce(formError()).mockResolvedValueOnce(answer());

		await useChatStore.getState().submitForm("f-1", values, "en");
		await useChatStore.getState().submitForm("f-1", values, "en");

		expect(useChatStore.getState().forms["f-1"]).toEqual({
			status: "filed",
			errors: {},
			asked: ["applicantPhone"]
		});
	});

	it("draws a form with errors again under the newest reply, and only there", async () => {
		await offerForm();
		vi.mocked(apiService.sendUserQuery).mockResolvedValueOnce(formError());

		await useChatStore.getState().submitForm("f-1", values, "en");

		expect(cardsWithForm()).toHaveLength(1);
		expect(cardsWithForm()[0]).toBe(useChatStore.getState().messages.at(-1));
	});

	it("leaves the filed form where it was", async () => {
		await offerForm();
		const offeredOn = useChatStore.getState().messages.at(-1)?.id;
		vi.mocked(apiService.sendUserQuery).mockResolvedValueOnce(answer());

		await useChatStore.getState().submitForm("f-1", values, "en");

		expect(cardsWithForm()[0]?.id).toBe(offeredOn);
	});

	it("closes the form where it was when the system is down, with no Retry button", async () => {
		await offerForm();
		const offeredOn = useChatStore.getState().messages.at(-1)?.id;
		vi.mocked(apiService.sendUserQuery).mockResolvedValueOnce(providerDown());

		await useChatStore.getState().submitForm("f-1", values, "en");

		expect(useChatStore.getState().forms["f-1"]?.status).toBe("closed");
		expect(cardsWithForm()[0]?.id).toBe(offeredOn);
		expect(loadForm("f-1")).toBeNull();
		const card = useChatStore.getState().messages.at(-1);
		expect(card?.type === "card" && card.isError && card.failedUserText).toBeFalsy();
	});

	it("closes the form when the send fails outright", async () => {
		await offerForm();
		vi.mocked(apiService.sendUserQuery).mockRejectedValueOnce(new Error("offline"));

		await useChatStore.getState().submitForm("f-1", values, "en");

		expect(useChatStore.getState().forms["f-1"]?.status).toBe("closed");
	});

	it("sends once when submitted twice while sending", async () => {
		await offerForm();
		vi.mocked(apiService.sendUserQuery).mockResolvedValueOnce(answer());

		await Promise.all([
			useChatStore.getState().submitForm("f-1", values, "en"),
			useChatStore.getState().submitForm("f-1", values, "en")
		]);

		expect(apiService.sendUserQuery).toHaveBeenCalledTimes(2); // the offer, then one submit
	});

	it("leaves the form open when the farmer types a question instead", async () => {
		await offerForm();
		vi.mocked(apiService.sendUserQuery).mockResolvedValueOnce(answer());

		await useChatStore.getState().sendText("What is the premium for wheat?", "en");

		expect(useChatStore.getState().forms["f-1"]?.status).toBe("open");
	});

	it("forgets every form on Clear chat", async () => {
		await offerForm();

		useChatStore.getState().clearChat();

		expect(useChatStore.getState().forms).toEqual({});
		expect(loadForm("f-1")).toBeNull();
	});
});
