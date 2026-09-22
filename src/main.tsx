import "./styles/global.css";
import { loadRuntimeConfig } from "./lib/config/runtime-config";

window.addEventListener("vite:preloadError", async (event) => {
	event.preventDefault();
	// Get current count from session storage or initialize to 0
	const reloadCount = parseInt(sessionStorage.getItem("vitePreloadErrorCount") || "0", 10);

	// Check if we've already tried 3 times
	if (reloadCount >= 2) {
		console.warn("Vite preload has failed multiple times. Stopping automatic reload.");
		// Optionally show a user-facing message here
		return;
	}

	try {
		if ("caches" in window) {
			const keys = await caches.keys();
			await Promise.all(keys.map((key) => caches.delete(key)));
		}
	} catch (cleanupError) {
		console.error(cleanupError);
	}
	//
	// Increment and save the counter
	sessionStorage.setItem("vitePreloadErrorCount", (reloadCount + 1).toString());

	console.log(`Reloading page (attempt ${reloadCount + 1} of 2)...`);
	window.location.reload(); // for example, refresh the page
});

/**
 * Configuration has to be in place before anything that reads it is imported.
 *
 * ES modules evaluate their whole static import graph before the importing
 * module's body runs, so a top-level `await` here would still be too late:
 * `./bootstrap` reaches modules that read configuration at import time. The
 * dynamic import below is what defers that evaluation until the fetch has
 * resolved. Stylesheets are imported statically above because they do not
 * depend on configuration and should not wait for it.
 */
loadRuntimeConfig()
	.then(() => import("./bootstrap"))
	.then(({ mount }) => mount())
	.catch((error) => {
		console.error("[boot] the application failed to start.", error);
	});
