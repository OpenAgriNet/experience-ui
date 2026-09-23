/**
 * @vitest-environment happy-dom
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/**
 * Turning the language picker off is the change most likely to ship broken:
 * hiding the control is not the same as pinning the language, and the
 * difference only shows for someone who visited before.
 */
describe("english pinning", () => {
	beforeEach(() => {
		vi.resetModules();
		localStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		localStorage.clear();
	});

	it("ignores a stored language when the picker is off", async () => {
		// Someone who chose Marathi on an earlier build has it in storage and,
		// with the picker gone, no way to change it back.
		localStorage.setItem("app_language", "mr");
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ features: { languageSelector: false }, defaultLanguage: "hi" })
			})
		);

		const { loadRuntimeConfig } = await import("@/lib/config/runtime-config");
		await loadRuntimeConfig();
		const { resolveInitialLanguage } = await import("@/components/LanguageProvider");

		expect(resolveInitialLanguage()).toBe("en");
	});

	it("honours the stored language when the picker is on", async () => {
		localStorage.setItem("app_language", "mr");
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ features: { languageSelector: true } })
			})
		);

		const { loadRuntimeConfig } = await import("@/lib/config/runtime-config");
		await loadRuntimeConfig();
		const { resolveInitialLanguage } = await import("@/components/LanguageProvider");

		expect(resolveInitialLanguage()).toBe("mr");
	});
});
