import { type LanguageCode } from "../../config";

export type MessageRole = "user" | "assistant" | "system";

type DeliveryStatus = "sending" | "sent" | "delivered" | "read";

type QuickReply = { id: string; label: string; payload?: string };

type MessageBase = {
	id: string;
	role: MessageRole;
	createdAt: string;
	status?: DeliveryStatus;
};

export type TextMessage = MessageBase & {
	type: "text";
	text: string;
	responseLanguage?: LanguageCode;
};

export type CardMessage = MessageBase & {
	type: "card";
	/** The API's trace id for the turn, for support. */
	traceId?: string;
	title?: string;
	body: string;
	actions?: { id: string; label: string }[];
	showListenRow?: boolean;
	isError?: boolean;
	failedUserText?: string;
	failedLanguage?: string;
	responseLanguage?: LanguageCode;
};

type QuickRepliesMessage = MessageBase & {
	type: "quick_replies";
	prompt?: string;
	replies: QuickReply[];
};

export type SystemMessage = MessageBase & {
	type: "system";
	text: string;
};

export type AudioMessage = MessageBase & {
	type: "audio";
	audioUrl: string;
	duration: number;
};

type ImageMessage = MessageBase & {
	type: "image";
	imageUrl: string;
	caption?: string;
};

export type ChatMessage = TextMessage | CardMessage | QuickRepliesMessage | SystemMessage | AudioMessage | ImageMessage;
