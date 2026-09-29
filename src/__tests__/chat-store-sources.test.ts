import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The shipped config, with every optional surface off and the real API path.
vi.mock("@/lib/config/runtime-config", async () => {
	const { default: shipped } = await import("@/config/app-config.json");
	const config = { ...shipped, stubs: { enabled: false }, features: {} };
	return { getConfig: () => config };
});

import apiService, { ApiError, type FinalAnswer } from "@/lib/api-service";
import { useChatStore } from "@/hooks/store/chat";
import type { CardMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";

/**
 * The sources are what an answer drew on. They belong on an answered card
 * and nowhere else: a failed turn has no answer to credit.
 */
const answer = (extra: Partial<FinalAnswer> = {}): FinalAnswer => ({
	sessionId: "s-1",
	messageId: "m-1",
	assistantMessageId: "a-1",
	traceId: "t-1",
	outcome: { status: "answered", cause: null },
	content: [{ type: "text", text: "Light rain after 3 pm.", citations: [] }],
	sources: [{ id: "src_1", name: "IMD", url: "https://mausam.imd.gov.in/" }],
	...extra
});

const lastCard = (): CardMessage => {
	const card = useChatStore.getState().messages.at(-1);
	if (card?.type !== "card") throw new Error("The last message is not a card");
	return card;
};

describe("chat store sources", () => {
	beforeEach(() => {
		useChatStore.getState().clearChat();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps the sources on an answered card", async () => {
		vi.spyOn(apiService, "sendUserQuery").mockResolvedValue(answer());

		await useChatStore.getState().sendText("Weather tomorrow?", "en");

		expect(lastCard().sources).toEqual([{ id: "src_1", name: "IMD", url: "https://mausam.imd.gov.in/" }]);
	});

	it("leaves them off a turn that completed with an error", async () => {
		vi.spyOn(apiService, "sendUserQuery").mockResolvedValue(
			answer({ error: { code: "provider_unavailable", message: "down", retryable: true } })
		);

		await useChatStore.getState().sendText("Weather tomorrow?", "en");

		expect(lastCard().isError).toBe(true);
		expect(lastCard().sources).toBeUndefined();
	});

	it("leaves them off a turn that failed outright", async () => {
		vi.spyOn(apiService, "sendUserQuery").mockRejectedValue(
			new ApiError({ code: "upstream_error", message: "broken", retryable: true })
		);

		await useChatStore.getState().sendText("Weather tomorrow?", "en");

		expect(lastCard().isError).toBe(true);
		expect(lastCard().sources).toBeUndefined();
	});
});
