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
// Without its trailing slash, if any, as the client reads it.
const apiBaseUrl: string = JSON.parse(fs.readFileSync(APP_CONFIG_SOURCE, "utf-8")).api.baseUrl.replace(/\/+$/, "");

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
	// Where the app will be mounted. Baked in at build time, so an image built
	// with a sub-path only serves from that path. Supplied by the Docker build
	// arg VITE_BASE_PATH; "/" is the default and means the origin root.
	base: process.env.VITE_BASE_PATH || "/",
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
		port: 3000,
		// With stubs off, calls to api.baseUrl go to a local Experience API the
		// way the front proxy routes them in deployment: same origin for the
		// browser, the prefix stripped before it reaches the API. The path is
		// read from the same config file the app uses, so the two cannot drift.
		// The API's own port is the default; DEV_API_URL overrides it.
		proxy: {
			[apiBaseUrl]: {
				target: process.env.DEV_API_URL || "http://localhost:8078",
				rewrite: (requestPath) => requestPath.slice(apiBaseUrl.length)
			}
		}
	}
});
