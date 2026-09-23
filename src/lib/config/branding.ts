import { getConfig } from "@/lib/config/runtime-config";

/**
 * Applies the parts of the brand that live outside React.
 *
 * `index.html` is served before `/config.json` has been fetched, so the tab's
 * title and icon cannot be baked into the markup. They are written here
 * instead, after configuration resolves and before the app mounts. The values
 * in `index.html` are the neutral fallbacks shown for the moment in between.
 *
 * `logo`, `favicon` and `assistantAvatar` are URLs, not file names. A
 * root-relative path is served from `public/`; an absolute URL is fetched from
 * wherever it points, so a deployment can put its assets on a CDN without
 * touching the image.
 */
export const applyBranding = (): void => {
	const { brand } = getConfig();

	if (brand.documentTitle) {
		document.title = brand.documentTitle;
	}

	// Same treatment as the other brand assets: a CDN URL is absolute and left
	// alone, a path is relative to wherever the app is served from.
	const favicon = brand.favicon && !/^[a-z]+:\/\//i.test(brand.favicon)
		? `${import.meta.env.BASE_URL}${brand.favicon.replace(/^\//, "")}`
		: brand.favicon;

	if (favicon) {
		const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
		const link = existing ?? document.createElement("link");
		link.rel = "icon";
		link.href = favicon;
		// The markup declares a type for its own SVG fallback. A configured
		// icon may be any format, so let the browser sniff it instead.
		link.removeAttribute("type");
		if (!existing) {
			document.head.appendChild(link);
		}
	}
};
