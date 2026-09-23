/**
 * @vitest-environment happy-dom
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/**
 * Branding is the one part of the configuration that has to reach the page
 * before React mounts, so it is applied imperatively rather than rendered.
 * These tests pin that a fetched override actually lands, and that the
 * in-app names follow the same source.
 *
 * Modules are reset per case because the loaded config is a module singleton.
 */
const stubFetchedConfig = (brand: Record<string, string>) => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ brand })
		})
	);
};

describe("branding", () => {
	beforeEach(() => {
		vi.resetModules();
		document.title = "";
		document.head.innerHTML = "";
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("writes the configured title and favicon onto the document", async () => {
		stubFetchedConfig({
			documentTitle: "Someone Else's Assistant",
			favicon: "https://cdn.example.test/icon.png"
		});

		const { loadRuntimeConfig } = await import("@/lib/config/runtime-config");
		const { applyBranding } = await import("@/lib/config/branding");
		await loadRuntimeConfig();
		applyBranding();

		expect(document.title).toBe("Someone Else's Assistant");
		expect(document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href).toBe(
			"https://cdn.example.test/icon.png"
		);
	});

	it("reuses the markup's icon link rather than stacking a second one", async () => {
		document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">';
		stubFetchedConfig({ favicon: "/custom.png" });

		const { loadRuntimeConfig } = await import("@/lib/config/runtime-config");
		const { applyBranding } = await import("@/lib/config/branding");
		await loadRuntimeConfig();
		applyBranding();

		const links = document.querySelectorAll('link[rel="icon"]');
		expect(links).toHaveLength(1);
		// A configured icon may be any format, so the markup's type must not stick.
		expect(links[0]?.getAttribute("type")).toBeNull();
	});

	it("feeds the assistant name and logo from the same brand block", async () => {
		stubFetchedConfig({
			appName: "Kisan Sathi",
			assistantName: "Sathi",
			logo: "https://cdn.example.test/logo.svg",
			assistantAvatar: "https://cdn.example.test/avatar.svg"
		});

		const { loadRuntimeConfig } = await import("@/lib/config/runtime-config");
		await loadRuntimeConfig();
		const { APP_NAME, BRAND_LOGO, CHAT_ASSISTANT } = await import(
			"@/components/screens-component/chat-screen/config"
		);

		expect(APP_NAME).toBe("Kisan Sathi");
		expect(CHAT_ASSISTANT.name).toBe("Sathi");
		expect(BRAND_LOGO).toBe("https://cdn.example.test/logo.svg");
		expect(CHAT_ASSISTANT.avatar).toBe("https://cdn.example.test/avatar.svg");
	});

	it("falls back to the bundled brand when config.json is unreachable", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const { loadRuntimeConfig, getConfig } = await import("@/lib/config/runtime-config");
		await loadRuntimeConfig();

		expect(getConfig().brand.appName).toBeTruthy();
		expect(getConfig().brand.logo).toBeTruthy();
		warn.mockRestore();
	});
});
