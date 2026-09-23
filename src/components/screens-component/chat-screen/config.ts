import { getConfig } from "@/lib/config/runtime-config";

const rootConfig = getConfig() as any;

// ============================================================================
// LANGUAGE CONFIGURATION
// ============================================================================

export type LanguageCode = "hi" | "en" | "bn" | "te" | "mr" | "ta" | "gu" | "kn" | "ml" | "as";

export type Language = {
	code: LanguageCode;
	name: string;
	nativeName: string;
	icon: string;
};

export const LANGUAGES: Record<LanguageCode, Language> = rootConfig.languages.reduce((acc: any, lang: any) => {
	acc[lang.code as LanguageCode] = lang as Language;
	return acc;
}, {} as Record<LanguageCode, Language>);

export const DEFAULT_LANGUAGE: LanguageCode = rootConfig.defaultLanguage as LanguageCode || "hi";

// ============================================================================
// CHAT CONFIGURATION
// ============================================================================

/**
 * Resolves a configured asset URL against the path the app is served from.
 *
 * A deployment may point these at a CDN, in which case the URL is absolute and
 * is left alone. A path is treated as relative to the app, so it keeps working
 * when the app is mounted under a sub-path.
 */
const brandAsset = (value: string): string => {
	if (!value) return value;
	if (/^[a-z]+:\/\//i.test(value) || value.startsWith("data:")) return value;
	return `${import.meta.env.BASE_URL}${value.replace(/^\//, "")}`;
};

export const APP_NAME: string = rootConfig.brand.appName;

export const BRAND_LOGO: string = brandAsset(rootConfig.brand.logo);

export const CHAT_ASSISTANT = {
	name: rootConfig.brand.assistantName,
	avatar: brandAsset(rootConfig.brand.assistantAvatar)
};

export const CHAT_USER = {
	name: "",
	avatar: brandAsset(rootConfig.brand.userAvatar)
};

export const THEMES = {
	light: "light",
	dark: "dark"
} as const;

export type Theme = keyof typeof THEMES;

