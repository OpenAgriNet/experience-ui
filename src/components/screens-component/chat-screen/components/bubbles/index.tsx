import { AudioBubble } from "./audio-bubble";
import { CardBubble } from "./card-bubble";
import { FormSubmissionBubble } from "./form-submission-bubble";
import { ChatMessage } from "./chat-types";
import { SystemBubble } from "./system-bubble";
import { TextBubble } from "./text-bubble";
import { MessageChrome } from "../message-chrome";

type BubbleProps = { message: ChatMessage; onQuickReply?: (payload: string) => void };

export function Bubble({ message }: BubbleProps) {

	switch (message.type) {
		case "text":
			return (
				<MessageChrome role={message.role}>
					<TextBubble message={message} />
				</MessageChrome>
			);
		case "card":
			return (
				<MessageChrome role={message.role}>
					<CardBubble message={message} />
				</MessageChrome>
			);
		// case "quick_replies":
		// 	return (
		// 		<MessageChrome role={message.role} showLabel={false}>
		// 			<QuickRepliesBubble message={message} onQuickReply={onQuickReply} />
		// 		</MessageChrome>
		// 	);
		case "form_submission":
			return (
				<MessageChrome role={message.role}>
					<FormSubmissionBubble message={message} />
				</MessageChrome>
			);
		case "system":
			return <SystemBubble message={message} />;
		case "audio":
			return (
				<MessageChrome role={message.role}>
					{/** @ts-ignore - isMine missing in MessageChrome context implicitly, but Bubble component allows passing logic if needed or MessageChrome handles alignment. 
                         Actually AudioBubble needs `isMine`. 
                         Currently MessageChrome handles alignment based on role. 
                         Let's assume role="user" is mine.
                         Checking MessageList usage, it passes messages. 
                         Let's derive isMine from role.
                     */}
					<AudioBubble message={message} isMine={message.role === "user"} />
				</MessageChrome>
			);
		case "image":
			return (
				<MessageChrome role={message.role}>
					<div className="max-w-xs sm:max-w-sm">
						<img
							src={message.imageUrl}
							alt={message.caption || "Uploaded image"}
							className="rounded-lg object-cover max-h-64 w-full"
						/>
						{message.caption && (
							<p className="mt-1 text-sm text-muted-foreground">{message.caption}</p>
						)}
					</div>
				</MessageChrome>
			);
		default:
			return null;
	}
}
