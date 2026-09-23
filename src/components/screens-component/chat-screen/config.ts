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

export const APP_NAME: string = rootConfig.brand.appName;

export const BRAND_LOGO: string = rootConfig.brand.logo;

export const CHAT_ASSISTANT = {
	name: rootConfig.brand.assistantName,
	avatar: rootConfig.brand.assistantAvatar
};

export const CHAT_USER = {
	name: "",
	avatar: rootConfig.brand.userAvatar
};

export const THEMES = {
	light: "light",
	dark: "dark"
} as const;

export type Theme = keyof typeof THEMES;

