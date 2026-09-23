import { describe, expect, it, vi } from "vitest";

import type { ChatTurnRequest, FinalAnswer } from "@/lib/api-service";
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
			for (const item of answer.content) expect(item.text).toContain("stubbed response");
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
