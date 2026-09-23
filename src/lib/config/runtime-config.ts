/**
 * Runtime configuration.
 *
 * `config.json` is fetched from the deployed origin before React mounts, so a
 * deployment can be rebranded by replacing one file — no rebuild and no fork.
 * The copy bundled at build time is the fallback, used when the fetch fails or
 * the served file cannot be parsed. Both come from src/config/app-config.json:
 * a Vite plugin serves it at /config.json in dev and emits it to dist/ on
 * build, so there is one source file and nothing to keep in sync.
 *
 * Read it with `getConfig()`. That throws before `loadRuntimeConfig()` has
 * resolved, which is deliberate: some modules read configuration at import
 * time, and returning defaults instead would leave the app running on
 * build-time values with no visible symptom. See `src/main.tsx` for the
 * ordering that guarantees this.
 */
import bundledConfig from "@/config/app-config.json";

export type AppConfig = typeof bundledConfig;

const CONFIG_URL = "config.json";

let active: AppConfig = bundledConfig;
let loaded = false;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Deep-merge the served config over the bundled one, so a deployment can
 * override `brand.appName` alone without restating the whole file. Arrays are
 * replaced rather than concatenated: a served `languages` list is the list.
 */
const merge = (base: unknown, override: unknown): unknown => {
	if (!isPlainObject(base) || !isPlainObject(override)) return override;

	const merged: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(override)) {
		merged[key] = key in base ? merge(base[key], value) : value;
	}
	return merged;
};

export const loadRuntimeConfig = async (): Promise<void> => {
	try {
		// `no-store` keeps a stale config out of the browser cache. The served
		// response carries no explicit Cache-Control header today, so without
		// this a redeployed config could be ignored for returning visitors.
		const response = await fetch(CONFIG_URL, { cache: "no-store" });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		active = merge(bundledConfig, await response.json()) as AppConfig;
	} catch (error) {
		console.warn(`[config] could not load ${CONFIG_URL}; using the bundled configuration.`, error);
	} finally {
		loaded = true;
	}
};

export const getConfig = (): AppConfig => {
	if (!loaded) {
		throw new Error(
			"getConfig() was called before loadRuntimeConfig() resolved. Modules that read " +
				"configuration at import time must be reached through src/bootstrap.tsx."
		);
	}
	return active;
};
