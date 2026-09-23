import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/**
 * The flags decide whether a surface exists at all, so the failure that
 * matters is a flag reading true when it was never configured. These pin the
 * default-closed behaviour and that an override actually lands.
 */
const stubFetchedConfig = (body: unknown) => {
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
};

describe("feature flags", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("turns on only what the deployment asked for", async () => {
		stubFetchedConfig({ features: { voiceInput: true } });

		const { loadRuntimeConfig } = await import("@/lib/config/runtime-config");
		await loadRuntimeConfig();
		const { FEATURES } = await import("@/lib/config/features");

		expect(FEATURES.voiceInput).toBe(true);
		expect(FEATURES.textToSpeech).toBe(false);
		expect(FEATURES.imageQuestions).toBe(false);
		expect(FEATURES.languageSelector).toBe(false);
	});

	it("treats anything other than true as off", async () => {
		// A deployment writing "true" or 1 into the JSON should not silently
		// enable a surface that has no backend.
		stubFetchedConfig({ features: { voiceInput: "true", suggestions: 1, geolocation: null } });

		const { loadRuntimeConfig } = await import("@/lib/config/runtime-config");
		await loadRuntimeConfig();
		const { FEATURES } = await import("@/lib/config/features");

		expect(FEATURES.voiceInput).toBe(false);
		expect(FEATURES.suggestions).toBe(false);
		expect(FEATURES.geolocation).toBe(false);
	});

	it("still yields a usable set of flags when config.json is unreachable", async () => {
		// The values are whatever the bundled config says; what matters is that
		// an unreachable config.json leaves every flag defined and boolean,
		// rather than undefined, which would read as off by accident.
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { loadRuntimeConfig } = await import("@/lib/config/runtime-config");
		await loadRuntimeConfig();
		const { FEATURES } = await import("@/lib/config/features");

		expect(Object.keys(FEATURES)).toHaveLength(6);
		expect(Object.values(FEATURES).every((v) => typeof v === "boolean")).toBe(true);
		warn.mockRestore();
	});
});
