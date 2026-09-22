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

export const CHAT_ASSISTANT = {
	name: "Bharati",
	avatar: rootConfig.icons.assistant
};

export const CHAT_USER = {
	name: "",
	avatar: rootConfig.icons.user
};

export type FAQItem = {
	id: string;
	question: string;
	answer: string;
	image?: string;
};

export const FAQ_DATA: FAQItem[] = [
	{
		id: "1",
		question: "How can I get subsidy for farm machinery?",
		answer: "Farmers can apply for machinery subsidy through the MahaDBT portal. Subsidy amount depends on machine type, farmer category, and scheme availability.",
		image: "/faq-machinery.png"
	},
	{
		id: "2",
		question: "Why is my crop not growing properly?",
		answer: "Proper crop growth depends on soil health, water quality, and appropriate fertilizer usage. We recommend testing your soil at the nearest government lab.",
	}
];

export const THEMES = {
	light: "light",
	dark: "dark"
} as const;

export type Theme = keyof typeof THEMES;


