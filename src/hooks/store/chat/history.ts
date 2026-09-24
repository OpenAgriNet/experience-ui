import type { ChatMessage } from "@/components/screens-component/chat-screen/components/bubbles/chat-types";
import type { HistoryItem } from "@/lib/api-service";

/**
 * What the client sends as `history` (contract §4.1): every completed
 * exchange, oldest first, as the user's text and then the assistant's final
 * text. The API stores nothing, so this is the whole conversation each time.
 *
 * One rule does it: a user text message counts when the message right after
 * it is an assistant card that is not an error. That covers the list in §4.1.
 *
 * - A turn that failed, whether by an error response, an error event or a
 *   completed that carried error, is an error card. It and its question stay
 *   out, so Retry sends the question once, as `query`.
 * - The question being sent now has no answer yet, so it stays out too. It
 *   goes as `query`.
 * - A refusal, a "could not find that" or a "which district?" is an ordinary
 *   card and stays in. The DSS needs the question it asked to read the reply.
 * - Image messages and anything else are skipped.
 *
 * Built at send time, when nothing is streaming, so a card's body is the
 * final text: every content item joined by a blank line.
 */
export function buildHistory(messages: ChatMessage[]): HistoryItem[] {
	const history: HistoryItem[] = [];

	for (let i = 0; i + 1 < messages.length; i += 1) {
		const question = messages[i];
		const answer = messages[i + 1];
		if (question?.role !== "user" || question.type !== "text") continue;
		if (answer?.role !== "assistant" || answer.type !== "card" || answer.isError) continue;
		// §4 rejects empty text on either side.
		if (!question.text.trim() || !answer.body.trim()) continue;

		history.push({ role: "user", text: question.text }, { role: "assistant", text: answer.body });
	}

	return history;
}
