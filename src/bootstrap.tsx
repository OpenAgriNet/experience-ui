/**
 * Application bootstrap.
 *
 * Imported dynamically by `src/main.tsx` once runtime configuration has
 * loaded. Everything reachable from here may read configuration at import
 * time; nothing here may be imported statically from `main.tsx`.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import { Loader } from "./components";
import { queryClient } from "./hooks";
import PageNotFound from "./pages/error/404";
import DefaultError from "./pages/error/default-error";
import { createRouteProgress } from "./config/route-progress";
import { LanguageProvider } from "./components/LanguageProvider";
import { AuthProvider } from "./lib/auth";
import { ConfigProvider } from "./hooks/ConfigProvider";

const routeProgress = createRouteProgress();

const router = createRouter({
	routeTree,
	// Without this the router matches paths against the origin root, so every
	// route 404s when the app is served from a sub-path — while the page itself
	// loads fine, which makes it look like something else.
	basepath: import.meta.env.BASE_URL,
	context: { queryClient },
	defaultPendingComponent: () => (
		<div className="bg-background flex h-screen w-screen items-center justify-center">
			<Loader />
		</div>
	),
	defaultNotFoundComponent: PageNotFound,
	defaultErrorComponent: DefaultError
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

router.subscribe("onBeforeLoad", ({ pathChanged }) => {
	if (pathChanged) {
		routeProgress.start();
	}
});

router.subscribe("onResolved", () => {
	routeProgress.done();
});

export const mount = (): void => {
	createRoot(document.getElementById("root")!).render(
		<StrictMode>
			<AuthProvider>
				<ConfigProvider>
					<LanguageProvider>
						<RouterProvider router={router} />
					</LanguageProvider>
				</ConfigProvider>
			</AuthProvider>
		</StrictMode>
	);
};
