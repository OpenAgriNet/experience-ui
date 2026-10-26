import { describe, expect, it, vi } from "vitest";

import type { ChatTurnRequest, FinalAnswer, FormBlock } from "@/lib/api-service";
import { stubChatFrames, stubChatResponse, stubGetSuggestions } from "@/lib/api-stubs";
import { readSseEvents } from "@/lib/sse";

/**
 * The stub stands in for the Experience API, which is not deployed yet. What
 * matters is that it speaks the API's own event stream (contract §5.1), so the
 * client code that runs on a stubbed reply is the code that will run on a real
 * one. These tests read the stub through the real parser to hold it to that.
 */
const request: ChatTurnRequest = {
	sessionId: "68a3872f-3f0d-4cf6-99a3-a350132a0080",
	messageId: "1ab38d6c-6fdb-4849-8ea1-da5e80a8687c",
	query: "when should I sow wheat?",
	history: [],
	language: { source: "en", target: "en" }
};

type Parsed = { event: string; data: Record<string, unknown> };

const parse = async (frames: string[]): Promise<Parsed[]> => {
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			const encoder = new TextEncoder();
			for (const frame of frames) controller.enqueue(encoder.encode(frame));
			controller.close();
		}
	});
	const events: Parsed[] = [];
	for await (const frame of readSseEvents(body)) {
		events.push({ event: frame.event, data: JSON.parse(frame.data) });
	}
	return events;
};

const completedOf = (events: Parsed[]) => events[events.length - 1]?.data as unknown as FinalAnswer;

describe("chat stub", () => {
	it("streams started, deltas and completed in order, numbered from 1", async () => {
		const events = await parse(stubChatFrames(request));

		expect(events[0]?.event).toBe("started");
		expect(events[0]?.data).toMatchObject({ sessionId: request.sessionId, messageId: request.messageId });
		expect(events.slice(1, -1).every((e) => e.event === "delta")).toBe(true);
		expect(events[events.length - 1]?.event).toBe("completed");
		expect(events.map((e) => e.data.sequence)).toEqual(events.map((_, i) => i + 1));
	});

	it("streams the text items as deltas that join to the completed text", async () => {
		const events = await parse(stubChatFrames(request));
		const completed = completedOf(events);

		const streamed = events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
		const textItems = completed.content.filter((item) => item.type === "text").map((item) => item.text).join("");
		expect(streamed).toBe(textItems);
		expect(completed.assistantMessageId).toBe(events[0]?.data.assistantMessageId);
	});

	it("labels every reply as stubbed and cycles through a refusal and a failed turn", async () => {
		const answers: FinalAnswer[] = [];
		for (let i = 0; i < 5; i += 1) {
			answers.push(completedOf(await parse(stubChatFrames(request))));
		}

		for (const answer of answers) {
			for (const item of answer.content) expect("text" in item && item.text).toContain("stubbed response");
		}
		expect(answers.some((a) => a.content.some((item) => item.type === "refusal"))).toBe(true);
		const failed = answers.find((a) => a.error);
		expect(failed?.error).toMatchObject({ retryable: true, traceId: failed?.traceId });
	});

	it("returns an event-stream Response whose body carries the frames", async () => {
		vi.useFakeTimers();
		try {
			const response = await stubChatResponse(request);
			expect(response.ok).toBe(true);
			expect(response.headers.get("content-type")).toBe("text/event-stream");

			const collecting = (async () => {
				const seen: string[] = [];
				for await (const frame of readSseEvents(response.body as ReadableStream<Uint8Array>)) seen.push(frame.event);
				return seen;
			})();
			await vi.runAllTimersAsync();

			const seen = await collecting;
			expect(seen[0]).toBe("started");
			expect(seen[seen.length - 1]).toBe("completed");
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("other stubs", () => {
	it("returns suggestions in the shape the chat store expects", async () => {
		vi.useFakeTimers();
		try {
			const pending = stubGetSuggestions();
			await vi.runAllTimersAsync();
			const suggestions = await pending;

			expect(suggestions.length).toBeGreaterThan(0);
			expect(suggestions.every((item) => typeof item.question === "string")).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("chat stub forms", () => {
	const ask = { ...request, query: "I want to file a PMFBY grievance" };

	const submit = (form: FormBlock, phone: string): ChatTurnRequest => ({
		...request,
		query: undefined,
		content: [
			{
				type: "form",
				formId: form.formId,
				context: form.context,
				submissionId: "sub-1",
				fields: [{ name: "applicantPhone", value: phone }]
			}
		]
	});

	const offered = async (): Promise<FormBlock> => {
		const answer = completedOf(await parse(stubChatFrames(ask)));
		const form = answer.content.find((item): item is FormBlock => item.type === "form");
		if (!form) throw new Error("No form offered");
		return form;
	};

	it("offers a form after a text block when asked to file a grievance", async () => {
		const answer = completedOf(await parse(stubChatFrames(ask)));

		expect(answer.outcome.status).toBe("requires_input");
		expect(answer.content.map((item) => item.type)).toEqual(["text", "form"]);
	});

	it("offers the PMFBY grievance form in the contract's shape", async () => {
		const form = await offered();

		expect(form.context).toEqual({ schema: "PMFBYGrievance/v0.1", action: "support" });
		expect(form.fields.map((f) => f.name)).toEqual([
			"enrolmentId",
			"applicantPhone",
			"cropYear",
			"season",
			"grievance.description"
		]);
	});

	it("files a submitted form with a ticket number, labelled as stubbed", async () => {
		const answer = completedOf(await parse(stubChatFrames(submit(await offered(), "9876543210"))));

		expect(answer.outcome.status).toBe("answered");
		const [text] = answer.content;
		expect(text?.type === "text" && text.text).toMatch(/Ticket number \d+/);
		expect(text?.type === "text" && text.text).toContain("stubbed response");
	});

	it("rejects a phone ending in 0000 with a form_error for that field", async () => {
		const form = await offered();
		const answer = completedOf(await parse(stubChatFrames(submit(form, "9876540000"))));

		expect(answer.outcome).toEqual({ status: "requires_input", cause: "invalid_input" });
		expect(answer.content[1]).toMatchObject({
			type: "form_error",
			formId: form.formId,
			submissionId: "sub-1",
			fields: [{ name: "applicantPhone" }]
		});
	});
});

describe("chat stub forms when the provider is down", () => {
	it("does not file a phone ending in 1111 and says to try later", async () => {
		const ask = { ...request, query: "I want to file a PMFBY grievance" };
		const offeredAnswer = completedOf(await parse(stubChatFrames(ask)));
		const form = offeredAnswer.content.find((item): item is FormBlock => item.type === "form")!;

		const answer = completedOf(
			await parse(
				stubChatFrames({
					...request,
					query: undefined,
					content: [
						{
							type: "form",
							formId: form.formId,
							context: form.context,
							submissionId: "sub-1",
							fields: [{ name: "applicantPhone", value: "9876541111" }]
						}
					]
				})
			)
		);

		expect(answer.outcome).toEqual({ status: "unavailable", cause: "provider_unavailable" });
		expect(answer.error).toMatchObject({ code: "provider_unavailable" });
		const [text] = answer.content;
		expect(text?.type === "text" && text.text).toContain("try again later");
	});
});
