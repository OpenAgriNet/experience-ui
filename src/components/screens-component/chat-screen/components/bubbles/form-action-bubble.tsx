import { type FormActionMessage } from "./chat-types";

export function FormActionBubble({ message }: { readonly message: FormActionMessage }) {
	return (
		<div className="max-w-full rounded-[20px] rounded-tr-md bg-[var(--secondary)] px-4 py-3 text-sm font-medium text-black shadow-sm sm:max-w-[85%] dark:bg-[var(--userBubble-dark)] dark:text-[var(--userBubbleText-dark)]">
			{message.label}
		</div>
	);
}
