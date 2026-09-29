import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/LanguageProvider", () => ({
	useLanguage: () => ({ language: "en", t: (key: string) => ({ source: "Source", sources: "Sources" })[key] ?? key })
}));

import {
	AnswerSources,
	formatSources
} from "@/components/screens-component/chat-screen/components/bubbles/answer-sources";

/**
 * Below an answer the user sees where it came from, numbered from 1 in the
 * order the API sent them. Copy writes the same list, so a pasted answer
 * keeps its sources.
 */
const IMD = { id: "src_1", name: "IMD", url: "https://mausam.imd.gov.in/" };
const MPKV = { id: "src_7", name: "Package of Practices, MPKV Rahuri" };

describe("formatSources", () => {
	it("is empty when there are no sources", () => {
		expect(formatSources([], "Sources")).toBe("");
	});

	it("numbers each source from 1 under the label", () => {
		expect(formatSources([IMD, MPKV], "Sources")).toBe("Sources:\n[1]: IMD\n[2]: Package of Practices, MPKV Rahuri");
	});
});

describe("AnswerSources", () => {
	const render = (sources: Parameters<typeof AnswerSources>[0]["sources"]) =>
		renderToStaticMarkup(<AnswerSources sources={sources} />);

	it("renders nothing without sources", () => {
		expect(render([])).toBe("");
		expect(render(undefined)).toBe("");
	});

	it("says Source for one and Sources for more", () => {
		expect(render([IMD])).toContain("Source:");
		expect(render([IMD, MPKV])).toContain("Sources:");
	});

	it("shows each name by its number, without the url", () => {
		const html = render([IMD, MPKV]);

		expect(html).toContain("[1]: IMD");
		expect(html).toContain("[2]: Package of Practices, MPKV Rahuri");
		expect(html).not.toContain("mausam.imd.gov.in");
		expect(html).not.toContain("<a");
	});
});
