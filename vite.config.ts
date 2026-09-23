import { defineConfig, PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "node:fs";
import tsconfigPaths from "vite-tsconfig-paths";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
const virtualRouteFileChangeReloadPlugin: PluginOption = {
	name: "watch-config-restart",
	configureServer(server) {
		server.watcher.add("./src/routes.ts");
		server.watcher.on("change", (path) => {
			if (path.endsWith("src/routes.ts")) {
				console.log("Virtual route changed");
				server.restart();
			}
		});
	}
};
/**
 * `config.json` is served at the web root so a deployment can replace it
 * without a rebuild, but it also has to be importable as the bundled fallback.
 * Keeping it in `public/` would satisfy the first and break the second — Vite
 * refuses JS imports from the public directory. So it lives in `src/`, and this
 * plugin puts it on the web root in both dev and build from that one source.
 */
const APP_CONFIG_SOURCE = path.resolve(__dirname, "src/config/app-config.json");

const appConfigPlugin: PluginOption = {
	name: "serve-app-config",
	configureServer(server) {
		server.middlewares.use((req, res, next) => {
			if (req.url?.split("?")[0] !== "/config.json") return next();
			res.setHeader("Content-Type", "application/json");
			res.setHeader("Cache-Control", "no-store");
			res.end(fs.readFileSync(APP_CONFIG_SOURCE));
		});
	},
	generateBundle() {
		this.emitFile({
			type: "asset",
			fileName: "config.json",
			source: fs.readFileSync(APP_CONFIG_SOURCE, "utf-8")
		});
	}
};

// https://vite.dev/config/
export default defineConfig({
	// Relative, so every asset URL resolves against the <base href> the
	// container injects. Without this they are absolute from / and the app
	// only works when it owns the origin root.
	base: "./",
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
			"~": path.resolve(__dirname)
		}
	},
	plugins: [
		tsconfigPaths(),
		nodePolyfills({ globals: { Buffer: true } }),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
			routesDirectory: path.resolve(__dirname, "src/pages"),
			virtualRouteConfig: "./src/routes.ts",
			generatedRouteTree: "./src/routeTree.gen.ts"
		}),
		react(),
		appConfigPlugin,
		virtualRouteFileChangeReloadPlugin
	],
	server: {
		port: 3000
	}
});
