import type { AnswerSource, FormBlock } from "@/lib/api-service";
import type { FormRow } from "@/lib/forms/rows";
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
	/** What the answer drew on, in the API's order. Set only on an answered card. */
	sources?: AnswerSource[];
	actions?: { id: string; label: string }[];
	showListenRow?: boolean;
	isError?: boolean;
	failedUserText?: string;
	failedLanguage?: string;
	responseLanguage?: LanguageCode;
	/** A form the assistant asked the farmer to fill in, below the text. */
	form?: FormBlock;
};

/** The farmer's sent form, as they see it: label and value, secrets as dots. */
export type FormSubmissionMessage = MessageBase & {
	type: "form_submission";
	formId: string;
	rows: FormRow[];
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

export type ChatMessage =
	| TextMessage
	| CardMessage
	| QuickRepliesMessage
	| SystemMessage
	| AudioMessage
	| ImageMessage
	| FormSubmissionMessage;
