/**
 * @vitest-environment happy-dom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/runtime-config", async () => {
	const { default: shipped } = await import("@/config/app-config.json");
	const config = { ...shipped, stubs: { enabled: false }, features: {} };
	return { getConfig: () => config };
});
vi.mock("@/components/LanguageProvider", () => ({
	useLanguage: () => ({ language: "en", t: (key: string) => ({ source: "Source", sources: "Sources" })[key] ?? key })
}));

import { CardBubble } from "@/components/screens-component/chat-screen/components/bubbles/card-bubble";
import type { CardMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";

/**
 * The card is where sources reach the user: under an answer, never under an
 * error, and in what Copy puts on the clipboard.
 */
const answered: CardMessage = {
	id: "a-1",
	role: "assistant",
	type: "card",
	createdAt: "2026-09-28T10:00:00.000Z",
	body: "Light rain after 3 pm.",
	showListenRow: true,
	sources: [{ id: "src_1", name: "IMD", url: "https://mausam.imd.gov.in/" }]
};

let container: HTMLDivElement;
let root: Root;

const render = (message: CardMessage) =>
	act(() => {
		root.render(<CardBubble message={message} />);
	});

describe("card bubble sources", () => {
	beforeEach(() => {
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => root.unmount());
		container.remove();
		vi.unstubAllGlobals();
	});

	it("shows the sources under an answered card", async () => {
		await render(answered);

		expect(container.textContent).toContain("Source:");
		expect(container.textContent).toContain("[1]: IMD");
	});

	it("shows none under an error card", async () => {
		await render({ ...answered, body: "Sorry, something went wrong.", isError: true, failedUserText: "Weather?" });

		expect(container.textContent).not.toContain("[1]: IMD");
	});

	it("copies the answer followed by its sources", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
		await render(answered);

		await act(async () => {
			container.querySelector<HTMLButtonElement>('button[title="Copy"]')?.click();
		});

		expect(writeText).toHaveBeenCalledWith("Light rain after 3 pm.\n\nSource:\n[1]: IMD");
	});

	it("copies only the answer when it has no sources", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
		await render({ ...answered, sources: [] });

		await act(async () => {
			container.querySelector<HTMLButtonElement>('button[title="Copy"]')?.click();
		});

		expect(writeText).toHaveBeenCalledWith("Light rain after 3 pm.");
	});
});
