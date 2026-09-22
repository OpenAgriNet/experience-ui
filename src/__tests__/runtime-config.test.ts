import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The loader's failure mode is silent by design — a bad fetch falls back to the
 * bundled config and the app boots looking normal. These tests pin the
 * behaviour that makes that safe, and the guard that makes an ordering mistake
 * loud instead.
 *
 * Each case imports a fresh module instance, because the loaded config is a
 * module singleton that would otherwise leak between tests.
 */
const freshModule = () => import("@/lib/config/runtime-config");

describe("runtime config", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("throws if read before the load resolves", async () => {
		const { getConfig } = await freshModule();

		expect(() => getConfig()).toThrowError(/before loadRuntimeConfig/);
	});

	it("falls back to the bundled config when the fetch fails", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { loadRuntimeConfig, getConfig } = await freshModule();
		await loadRuntimeConfig();

		expect(getConfig().theme.colors.primary).toBeTruthy();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it("falls back when the response is not ok", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { loadRuntimeConfig, getConfig } = await freshModule();
		await loadRuntimeConfig();

		expect(getConfig().defaultLanguage).toBeTruthy();
		warn.mockRestore();
	});

	it("deep-merges a partial override without dropping the rest", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ theme: { colors: { primary: "#abcdef" } } })
			})
		);

		const { loadRuntimeConfig, getConfig } = await freshModule();
		await loadRuntimeConfig();
		const config = getConfig();

		expect(config.theme.colors.primary).toBe("#abcdef");
		// Untouched siblings survive the merge.
		expect(config.theme.colors.secondary).toBeTruthy();
		expect(config.theme.fontSizes.base).toBeTruthy();
		expect(config.languages.length).toBeGreaterThan(0);
	});

	it("lets a served config switch the stub layer off", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ stubs: { enabled: false } })
			})
		);

		const { loadRuntimeConfig } = await freshModule();
		await loadRuntimeConfig();
		const { stubsEnabled } = await import("@/lib/api-stubs");

		expect(stubsEnabled()).toBe(false);
	});
});
