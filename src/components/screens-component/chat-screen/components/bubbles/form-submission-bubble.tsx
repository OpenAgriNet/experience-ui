import { type FormSubmissionMessage } from "./chat-types";

/** The farmer's sent form, read only. Secrets were turned to dots before they got here. */
export function FormSubmissionBubble({ message }: { readonly message: FormSubmissionMessage }) {
	return (
		<div className="max-w-full rounded-[20px] rounded-tr-md bg-[var(--secondary)] px-4 py-3 text-black shadow-sm sm:max-w-[85%] dark:bg-[var(--userBubble-dark)] dark:text-[var(--userBubbleText-dark)]">
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
				{message.rows.map((row) => (
					<div key={row.label} className="contents">
						<dt className="opacity-70">{row.label}</dt>
						<dd className="break-words font-medium">{row.value || "—"}</dd>
					</div>
				))}
			</dl>
		</div>
	);
}
