import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";
import { buildHistory } from "@/hooks/store/chat/history";

/**
 * The history is the whole conversation the DSS sees. Getting it wrong is
 * silent: a follow-up just gets a worse answer. These pin the rules in
 * contract §4.1.
 */
let n = 0;
const at = () => new Date(2026, 8, 24, 10, 0, n++).toISOString();

const user = (text: string): ChatMessage => ({ id: `u${n}`, role: "user", type: "text", text, createdAt: at() });
const card = (body: string, extra: Partial<Extract<ChatMessage, { type: "card" }>> = {}): ChatMessage => ({
	id: `a${n}`,
	role: "assistant",
	type: "card",
	body,
	createdAt: at(),
	...extra
});

describe("buildHistory", () => {
	it("is empty for a fresh chat", () => {
		expect(buildHistory([])).toEqual([]);
	});

	it("lists completed exchanges oldest first, user then assistant", () => {
		const history = buildHistory([user("Weather today?"), card("Clear, 31°C."), user("And tomorrow?"), card("Light rain.")]);

		expect(history).toEqual([
			{ role: "user", text: "Weather today?" },
			{ role: "assistant", text: "Clear, 31°C." },
			{ role: "user", text: "And tomorrow?" },
			{ role: "assistant", text: "Light rain." }
		]);
	});

	it("leaves out a failed turn and its question", () => {
		const history = buildHistory([
			user("Weather today?"),
			card("Clear, 31°C."),
			user("Prices?"),
			card("Sorry, something went wrong.", { isError: true, failedUserText: "Prices?" })
		]);

		expect(history).toEqual([
			{ role: "user", text: "Weather today?" },
			{ role: "assistant", text: "Clear, 31°C." }
		]);
	});

	it("leaves out the question being sent now, which has no answer yet", () => {
		const history = buildHistory([user("Weather today?"), card("Clear, 31°C."), user("And tomorrow?")]);

		expect(history).toHaveLength(2);
		expect(history.map((h) => h.text)).not.toContain("And tomorrow?");
	});

	it("keeps refusals and questions back, which are ordinary answers", () => {
		const history = buildHistory([user("Tell me a joke"), card("I can help with farming questions only."), user("Prices?"), card("Which district?")]);

		expect(history.map((h) => h.text)).toEqual(["Tell me a joke", "I can help with farming questions only.", "Prices?", "Which district?"]);
	});

	it("skips image messages and a question with no answer between two questions", () => {
		const image: ChatMessage = { id: "img", role: "user", type: "image", imageUrl: "blob:x", createdAt: at() };
		const history = buildHistory([image, card("Looks like leaf rust."), user("Lost question"), user("Weather today?"), card("Clear.")]);

		expect(history).toEqual([
			{ role: "user", text: "Weather today?" },
			{ role: "assistant", text: "Clear." }
		]);
	});
});
