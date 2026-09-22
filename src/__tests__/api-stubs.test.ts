import { describe, expect, it, vi } from "vitest";

import { stubGetSuggestions, stubSendUserQuery } from "@/lib/api-stubs";

/**
 * The stub layer stands in for the Experience API, which does not exist yet.
 * These tests cover the two paths the chat screen actually depends on: a reply
 * that streams, and a token the auth context will accept.
 */
describe("api stubs", () => {
	it("streams a reply in chunks that reassemble into the returned text", async () => {
		vi.useFakeTimers();
		try {
			const chunks: string[] = [];
			const pending = stubSendUserQuery("when should I sow wheat?", (chunk) => chunks.push(chunk));

			await vi.runAllTimersAsync();
			const result = await pending;

			expect(chunks.length).toBeGreaterThan(1);
			expect(chunks.join("")).toBe(result.response);
			expect(result.status).toBe("success");
			expect(result.qid).toMatch(/^stub-qid-/);
		} finally {
			vi.useRealTimers();
		}
	});

	it("labels every reply as stubbed, so fabricated advice cannot pass as real", async () => {
		vi.useFakeTimers();
		try {
			const seen: string[] = [];
			// Cycle further than the number of canned replies to cover them all.
			for (let i = 0; i < 4; i += 1) {
				const pending = stubSendUserQuery(`question ${i}`);
				await vi.runAllTimersAsync();
				seen.push((await pending).response);
			}

			for (const reply of seen) {
				expect(reply).toContain("stubbed response");
			}
		} finally {
			vi.useRealTimers();
		}
	});

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
