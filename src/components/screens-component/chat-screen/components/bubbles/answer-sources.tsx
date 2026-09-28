import type { AnswerSource } from "@/lib/api-service";
import { useLanguage } from "@/components/LanguageProvider";

type Translate = ReturnType<typeof useLanguage>["t"];

/** "Source" for one, "Sources" for more, in the user's language. */
export function sourcesLabel(t: Translate, count: number): string {
	return String(t(count === 1 ? "source" : "sources"));
}

/** The list as plain text, as Copy writes it. Empty when there is nothing to credit. */
export function formatSources(sources: AnswerSource[], label: string): string {
	if (sources.length === 0) return "";
	return [`${label}:`, ...sources.map((source, i) => `[${i + 1}]: ${source.name}`)].join("\n");
}

/** Where the answer came from, numbered from 1 in the order the API sent them. */
export function AnswerSources({ sources }: { readonly sources?: AnswerSource[] }) {
	const { t } = useLanguage();
	if (!sources?.length) return null;

	return (
		<div className="mt-3 text-sm text-muted-foreground dark:text-gray-400">
			<div className="font-medium">{sourcesLabel(t, sources.length)}:</div>
			<ol className="mt-1 space-y-0.5">
				{sources.map((source, i) => (
					<li key={source.id}>{`[${i + 1}]: ${source.name}`}</li>
				))}
			</ol>
		</div>
	);
}
