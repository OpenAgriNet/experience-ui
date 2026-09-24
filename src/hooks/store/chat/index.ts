import { create, type StoreApi } from "zustand";
import type {
	CardMessage,
	ChatMessage,
	TextMessage
} from "@/components/screens-component/chat-screen/components/bubbles/chat-types";
import { LANGUAGES, type LanguageCode } from "@/components/screens-component/chat-screen/config";
import { FEATURES } from "@/lib/config/features";

import { type Suggestion } from "@/components/screens-component/chat-screen/api/suggestions-api";
import apiService, { ApiError, type ChatStreamHandlers, type FinalAnswer } from "@/lib/api-service";
import { shuffle, randomPick } from "@/lib/qa-utils";
import type { ToastType } from "@/components/screens-component/chat-screen/components/toast";
import { neutralizeHtmlMarkup } from "@/lib/security/html";



export type QuickAction = {
	id: string;
	title: string;
	description: string;
	icon:
		| "tractor"
		| "wheat"
		| "cow"
		| "cloud"
		| "money"
		| "document"
		| "insurance"
		| "alert"
		| "bank"
		| "search"
		| "soil"
		| "card";
	prompt: string;
};

type ChatStore = {
	messages: ChatMessage[];
	quickActions: QuickAction[];
	draft: string;
	suggestions: Suggestion[];
	isAssistantTyping: boolean;
	isInputLocked: boolean;
	isListening: boolean;
	isTranscribing: boolean;
	isFetchingSuggestions: boolean;
	sessionId: string | null;
	initializeSession: (user: any) => Promise<void>;
	sendText: (text: string, language: string, t?: any) => Promise<void>;
	sendAudio: (blob: Blob, sessionId: string, language: string) => Promise<void>;
	sendImage: (imageFile: File, language: string, t?: any) => Promise<void>;
	sendQuickAction: (id: string, language: string, t?: any) => void;
	sendQuickReply: (payload: string, language: string, t?: any) => void;
	retryLastMessage: (language: string, t?: any) => void;
	setDraft: (value: string) => void;
	startListening: () => void;
	stopListening: () => void;
	clearChat: () => void;
	setIsTranscribing: (value: boolean) => void;
	setSuggestions: (suggestions: Suggestion[]) => void;
	clearSuggestions: () => void;
	generateQuickActions: (t: any) => void;
	playTTS: (text: string, language: string, messageId: string) => Promise<void>;
	pauseTTS: () => void;
	resumeTTS: () => Promise<void>;
	stopTTS: () => void;
	currentlyPlayingId: string | null;
	ttsStatus: "playing" | "paused" | "stopped";
	toast: { message: string; type: ToastType } | null;
	setToast: (toast: { message: string; type: ToastType } | null) => void;
	fetchLocation: (t?: any) => Promise<void>;
};
const quickActionSeeds: QuickAction[] = [
	{
		id: "1",
		title: "What is the treatment for Mastitis in cow?",
		description: "",
		icon: "cow",
		prompt: "What is the treatment for Mastitis in cow?"
	},
	{
		id: "2",
		title: "What is the today’s price of amaranth in APMC Mumbai?",
		description: "",
		icon: "wheat",
		prompt: "What is the today’s price of amaranth in APMC Mumbai?"
	},
	{
		id: "3",
		title: "What is the ideal irrigation schedule for muskmelon?",
		description: "",
		icon: "cloud",
		prompt: "What is the ideal irrigation schedule for muskmelon?"
	}
];

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/jpg"]);
const NORMALIZED_IMAGE_MIME = "image/jpeg";
const NORMALIZED_IMAGE_EXTENSION = ".jpg";
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

function isSupportedImageType(file: File): boolean {
	const fileType = file.type.toLowerCase();
	if (SUPPORTED_IMAGE_TYPES.has(fileType)) return true;

	const fileName = file.name.toLowerCase();
	return fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png");
}

function replaceFileExtension(fileName: string, extension: string): string {
	const trimmedName = fileName.trim();
	if (!trimmedName) {
		return `crop-image${extension}`;
	}

	const dotIndex = trimmedName.lastIndexOf(".");
	if (dotIndex <= 0) {
		return `${trimmedName}${extension}`;
	}

	return `${trimmedName.slice(0, dotIndex)}${extension}`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const imageUrl = URL.createObjectURL(file);
		const image = new Image();

		image.onload = () => {
			URL.revokeObjectURL(imageUrl);
			resolve(image);
		};

		image.onerror = () => {
			URL.revokeObjectURL(imageUrl);
			reject(new Error("Failed to load image for normalization."));
		};

		image.src = imageUrl;
	});
}

async function normalizeImageForUpload(file: File): Promise<File> {
	const image = await loadImageFromFile(file);
	const width = image.naturalWidth || image.width;
	const height = image.naturalHeight || image.height;
	if (!width || !height) {
		throw new Error("Invalid image dimensions.");
	}

	const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
	const targetWidth = Math.max(1, Math.round(width * scale));
	const targetHeight = Math.max(1, Math.round(height * scale));

	const canvas = document.createElement("canvas");
	canvas.width = targetWidth;
	canvas.height = targetHeight;

	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Canvas is unavailable for image normalization.");
	}

	context.drawImage(image, 0, 0, targetWidth, targetHeight);

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((result) => {
			if (result) {
				resolve(result);
				return;
			}

			reject(new Error("Failed to normalize image for upload."));
		}, NORMALIZED_IMAGE_MIME, JPEG_QUALITY);
	});

	return new File([blob], replaceFileExtension(file.name, NORMALIZED_IMAGE_EXTENSION), {
		type: NORMALIZED_IMAGE_MIME,
		lastModified: Date.now()
	});
}

function makeUserMessage(text: string): TextMessage {
	return {
		id: crypto.randomUUID(),
		role: "user",
		type: "text",
		text,
		status: "sent",
		createdAt: new Date().toISOString()
	};
}

function getResponseLanguage(language: string): LanguageCode | undefined {
	return language in LANGUAGES ? (language as LanguageCode) : undefined;
}

/** The assistant's final text: every content item, in order, joined by a blank line (§4.1). */
function answerText(answer: FinalAnswer): string {
	return answer.content.map((item) => item.text).join("\n\n");
}

/** Replace the message with `card.id`, or append it when it is not there yet. */
function upsertMessage(messages: ChatMessage[], card: ChatMessage): ChatMessage[] {
	const index = messages.findIndex((m) => m.id === card.id);
	if (index === -1) return [...messages, card];
	const updated = [...messages];
	updated[index] = card;
	return updated;
}

type TurnContext = {
	/** What Retry sends again. */
	failedUserText: string;
	language: string;
	responseLanguage?: LanguageCode;
	/** Shown when the turn failed and the API sent no words of its own. */
	genericErrorMessage: string;
};

/**
 * Run one turn and keep the assistant bubble in step with the stream.
 *
 * The bubble is drawn on the first delta, not on `started`: until there is
 * text the typing indicator stays, where an empty bubble would replace it with
 * nothing. Its id is the API's `assistantMessageId`. On `completed` the
 * streamed text is replaced by the answer's `content`, which is authoritative
 * (§5.1). Resolves true when the turn produced an answer without `error`.
 */
async function streamTurn(
	set: StoreApi<ChatStore>["setState"],
	send: (handlers: ChatStreamHandlers) => Promise<FinalAnswer>,
	ctx: TurnContext
): Promise<boolean> {
	let started: { assistantMessageId: string; traceId: string } | null = null;
	let cardId: string | null = null;
	let createdAt: string | null = null;
	let streamingText = "";

	const draw = (card: Omit<CardMessage, "id" | "role" | "type" | "createdAt">) => {
		cardId ??= started?.assistantMessageId ?? crypto.randomUUID();
		createdAt ??= new Date().toISOString();
		const message: CardMessage = {
			id: cardId,
			role: "assistant",
			type: "card",
			createdAt,
			traceId: started?.traceId,
			responseLanguage: ctx.responseLanguage,
			...card
		};
		set((state) => ({ messages: upsertMessage(state.messages, message), isAssistantTyping: false }));
	};

	const drawFailure = (traceId: string | undefined, retryable: boolean, body: string) =>
		draw({
			body,
			traceId,
			isError: true,
			showListenRow: false,
			failedUserText: retryable ? ctx.failedUserText : undefined,
			failedLanguage: retryable ? ctx.language : undefined
		});

	try {
		const answer = await send({
			onStarted: (event) => {
				started = event;
			},
			onDelta: (text) => {
				streamingText += text;
				draw({ body: streamingText, showListenRow: true });
			}
		});

		const text = answerText(answer);
		if (answer.error) {
			// The DSS finished the turn but something it needed was down (§5.3).
			// Its own words when it sent any, the client's otherwise.
			drawFailure(answer.error.traceId ?? answer.traceId, answer.error.retryable, text || ctx.genericErrorMessage);
			set({ isInputLocked: false });
			return false;
		}

		draw({ body: text, showListenRow: true });
		set({ isInputLocked: false });
		return true;
	} catch (error) {
		console.error("Error sending turn:", error);
		// A failure fetch itself reports, such as no network, is worth a retry.
		const apiError = error instanceof ApiError ? error : null;
		drawFailure(apiError?.traceId, apiError ? apiError.retryable : true, ctx.genericErrorMessage);
		set({ isInputLocked: false });
		return false;
	}
}

/** After an answered turn, fetch follow-up suggestions, when that surface is on. */
async function refreshSuggestions(
	set: StoreApi<ChatStore>["setState"],
	sessionId: string,
	language: string
): Promise<void> {
	if (!FEATURES.suggestions) return;
	const suggestions = await apiService.getSuggestions(sessionId, language);
	set({
		suggestions: suggestions.map((s) => ({
			id: crypto.randomUUID(),
			text: s.question,
			label: s.question
		}))
	});
}

function makeImageMessage(imageUrl: string, caption?: string): ChatMessage {
	return {
		id: crypto.randomUUID(),
		role: "user",
		type: "image",
		imageUrl,
		caption,
		createdAt: new Date().toISOString()
	};
}

import { playTTS as playTTSHelper, pauseAudio, resumeAudio, stopAudio } from "@/lib/audio-utils";

let locationFetchPromise: Promise<void> | null = null;
let hasResolvedLocationAttempt = false;

export const useChatStore = create<ChatStore>((set, get) => ({
	messages: [],
	quickActions: quickActionSeeds,
	draft: "",
	suggestions: [],
	isAssistantTyping: false,
	isInputLocked: false,
	isListening: false,
	isTranscribing: false,
	isFetchingSuggestions: false,
	sessionId: null,
	toast: null,
	currentlyPlayingId: null,
	ttsStatus: "stopped",

	setToast: (toast) => set({ toast }),
	initializeSession: async (_user) => {
		const sid = crypto.randomUUID();
		set({ sessionId: sid });
		apiService.setSessionId(sid);
	},

	setDraft: (value) => set(() => ({ draft: value })),

	fetchLocation: (t) => {
		// Guarded here as well as at the layout, because sendText and sendImage
		// call this on every message — gating only the mount would still prompt
		// on the first question.
		if (!FEATURES.geolocation) return Promise.resolve();

		if (typeof window === "undefined" || !navigator.geolocation) {
			set({
				toast: {
					message: t ? String(t("toast.locationNotSupported.description")) : "Your browser does not support geolocation.",
					type: "error"
				}
			});
			return Promise.resolve();
		}

		if (apiService.getLocationData() || hasResolvedLocationAttempt) {
			return Promise.resolve();
		}

		if (locationFetchPromise) {
			return locationFetchPromise;
		}

		locationFetchPromise = new Promise<void>((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const latitude = position.coords.latitude;
					const longitude = position.coords.longitude;
					apiService.setLocationData({
						latitude,
						longitude,
					});
					localStorage.setItem(
						"user_location",
						JSON.stringify({ latitude, longitude, timestamp: Date.now() })
					);
					hasResolvedLocationAttempt = true;
					locationFetchPromise = null;
					resolve();
				},
				(error) => {
					const key =
						error.code === error.PERMISSION_DENIED
							? "toast.locationPermissionDenied.description"
							: error.code === error.TIMEOUT
								? "toast.locationTimeout.description"
								: error.code === error.POSITION_UNAVAILABLE
									? "toast.locationUnavailable.description"
									: "toast.locationError.description";


					hasResolvedLocationAttempt = true;
					locationFetchPromise = null;
					set({
						toast: {
							message: t ? String(t(key)) : "Could not get your location.",
							type: "error"
						}
					});
					resolve();
				},
				{
					enableHighAccuracy: false,
					timeout: 10000,
					maximumAge: 300000,
				}
			);
		});

		return locationFetchPromise;
	},


	setIsTranscribing: (value) => set(() => ({ isTranscribing: value })),
	setSuggestions: (suggestions) => set({ suggestions }),
	clearSuggestions: () => set({ suggestions: [] }),

	startListening: () => {
		get().stopTTS();
		set(() => ({ isListening: true }));
	},
	stopListening: () => set(() => ({ isListening: false })),

	clearChat: () =>
		set(() => ({
			messages: [],
			draft: "",
			suggestions: [],
			isAssistantTyping: false,
			isInputLocked: false,
			isListening: false,
			isTranscribing: false,
			isFetchingSuggestions: false
		})),

	sendText: async (text, language, t) => {
		const trimmed = text.trim();
		if (!trimmed) return;
		const safeText = neutralizeHtmlMarkup(trimmed);
		const responseLanguage = getResponseLanguage(language);

		get().stopTTS();
		await get().fetchLocation(t);

		const userMessage = makeUserMessage(safeText);
		set((state) => ({
			messages: [...state.messages, userMessage],
			draft: "",
			suggestions: [],
			isAssistantTyping: true,
			isInputLocked: true
		}));

		const { sessionId } = get();
		const currentSession = sessionId || crypto.randomUUID();
		if (!sessionId) {
			set({ sessionId: currentSession });
			apiService.setSessionId(currentSession);
		}

		const answered = await streamTurn(
			set,
			(handlers) =>
				apiService.sendUserQuery(
					{
						sessionId: currentSession,
						messageId: userMessage.id,
						query: safeText,
						history: [],
						language: { source: language, target: language }
					},
					handlers
				),
			{
				failedUserText: safeText,
				language,
				responseLanguage,
				genericErrorMessage: t
					? String(t("chatErrorMessage"))
					: "Sorry, there was an error processing your request. Please try again."
			}
		);

		if (answered) await refreshSuggestions(set, currentSession, language);
	},

	sendImage: async (imageFile, language, t) => {
		if (!imageFile) return;
		const responseLanguage = getResponseLanguage(language);
		if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
			set({
				toast: {
					message: t ? String(t("imageUpload.imageTooLarge")) : "Image too large. Max 10 MB.",
					type: "error"
				}
			});
			return;
		}

		if (!isSupportedImageType(imageFile)) {
			set({
				toast: {
					message: t ? String(t("imageUpload.invalidFormat")) : "Invalid image format. Use JPEG or PNG.",
					type: "error"
				}
			});
			return;
		}

		get().stopTTS();
		await get().fetchLocation(t);

		let uploadFile = imageFile;
		try {
			uploadFile = await normalizeImageForUpload(imageFile);
		} catch (error) {
			console.error("Error normalizing image:", error);
			set({
				toast: {
					message: t ? String(t("imageUpload.processingFailed")) : "Could not process the image. Please try another photo.",
					type: "error"
				}
			});
			return;
		}

		if (uploadFile.size > MAX_IMAGE_SIZE_BYTES) {
			set({
				toast: {
					message: t ? String(t("imageUpload.imageTooLarge")) : "Image too large. Max 10 MB.",
					type: "error"
				}
			});
			return;
		}

		const imageUrl = URL.createObjectURL(uploadFile);
		const imageMessage = makeImageMessage(imageUrl, uploadFile.name);
		set((state) => ({
			messages: [...state.messages, imageMessage],
			suggestions: [],
			isAssistantTyping: true,
			isInputLocked: true
		}));

		const { sessionId } = get();
		const currentSession = sessionId || crypto.randomUUID();
		if (!sessionId) {
			set({ sessionId: currentSession });
			apiService.setSessionId(currentSession);
		}

		const answered = await streamTurn(
			set,
			(handlers) =>
				apiService.sendImageQuery(
					uploadFile,
					{
						sessionId: currentSession,
						messageId: imageMessage.id,
						history: [],
						language: { source: language, target: language }
					},
					handlers
				),
			{
				failedUserText: `[Image] ${uploadFile.name}`,
				language,
				responseLanguage,
				genericErrorMessage: t
					? String(t("imageUpload.analysisFailed"))
					: "Sorry, there was an error analyzing your image. Please try again."
			}
		);

		if (answered) await refreshSuggestions(set, currentSession, language);
	},

	sendAudio: async (blob, sessionId, language) => {
		if (!blob) return;

		set({ isTranscribing: true });

		try {
			// Convert raw MediaRecorder audio (WebM) to optimized WAV for ASR
			const AudioContextClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			const audioContext = new AudioContextClass();
			const arrayBuffer = await blob.arrayBuffer();
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

			// Create optimized WAV (16kHz, mono) - same as oan-ui-service
			const offlineContext = new OfflineAudioContext({
				numberOfChannels: 1,
				length: audioBuffer.duration * 16000,
				sampleRate: 16000
			});
			const source = offlineContext.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(offlineContext.destination);
			source.start();
			const renderedBuffer = await offlineContext.startRendering();

			// Convert to WAV blob
			const numChannels = renderedBuffer.numberOfChannels;
			const sampleRate = renderedBuffer.sampleRate;
			const length = renderedBuffer.length;
			const bytesPerSample = 2;
			const blockAlign = numChannels * bytesPerSample;
			const byteRate = sampleRate * blockAlign;
			const dataSize = length * blockAlign;
			const wavBuffer = new ArrayBuffer(44 + dataSize);
			const view = new DataView(wavBuffer);

			// WAV header
			const writeStr = (offset: number, str: string) => {
				for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
			};
			writeStr(0, "RIFF");
			view.setUint32(4, 36 + dataSize, true);
			writeStr(8, "WAVE");
			writeStr(12, "fmt ");
			view.setUint32(16, 16, true);
			view.setUint16(20, 1, true);
			view.setUint16(22, numChannels, true);
			view.setUint32(24, sampleRate, true);
			view.setUint32(28, byteRate, true);
			view.setUint16(32, blockAlign, true);
			view.setUint16(34, 16, true);
			writeStr(36, "data");
			view.setUint32(40, dataSize, true);

			const channelData = renderedBuffer.getChannelData(0);
			for (let i = 0; i < length; i++) {
				const sample = Math.max(-1, Math.min(1, channelData[i]!));
				view.setInt16(
					44 + i * bytesPerSample,
					sample < 0 ? sample * 0x8000 : sample * 0x7fff,
					true
				);
			}

			const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
			const base64Audio = await apiService.blobToBase64(wavBlob);
			const transcription = await apiService.transcribeAudio(
				base64Audio,
				"bhashini",
				sessionId,
				language
			);

			if (transcription && transcription.text) {
				set((state) => ({
					draft: state.draft ? `${state.draft} ${transcription.text}` : transcription.text,
					isTranscribing: false
				}));
				set({ toast: { message: "Transcribed successfully", type: "success" } });
			} else {
				set({ isTranscribing: false });
			}
		} catch (error) {
			console.error("Transcription error:", error);
			set({ isAssistantTyping: false, isTranscribing: false });
			set({ toast: { message: "Transcription failed. Please try again.", type: "error" } });
			throw error;
		}
	},

	sendQuickAction: (id, language, t) => {
		const action = get().quickActions.find((qa) => qa.id === id);
		if (!action) return;
		get().sendText(action.prompt, language, t);
	},

	sendQuickReply: (payload, language, t) => {
		get().sendText(payload, language, t);
	},

	retryLastMessage: (language, t) => {
		const { messages } = get();
		// Find the last error message with retry info
		const lastErrorIdx = messages.findLastIndex(
			(m) => m.type === "card" && m.isError && (m as any).failedUserText
		);
		if (lastErrorIdx === -1) return;

		const errorMsg = messages[lastErrorIdx] as any;
		const textToRetry = errorMsg.failedUserText;
		const langToUse = errorMsg.failedLanguage || language;

		// Remove the error message from the list
		set((state) => ({
			messages: state.messages.filter((_, i) => i !== lastErrorIdx)
		}));

		// Also remove the corresponding user message (the one right before the error)
		set((state) => {
			const msgs = [...state.messages];
			// Find the last user message before where the error was
			for (let i = msgs.length - 1; i >= 0; i--) {
				if (msgs[i]!.role === "user" && msgs[i]!.type === "text" && (msgs[i] as any).text === textToRetry) {
					msgs.splice(i, 1);
					break;
				}
			}
			return { messages: msgs };
		});

		// Re-send the message
		get().sendText(textToRetry, langToUse, t);
	},

	generateQuickActions: (t) => {
		// Use questions from translations
		if (t("questions") && Array.isArray(t("questions")) && t("questions").length > 0) {
			const questions = t("questions") as Array<{ key: string; text: string; vars?: string[] }>;
			// Shuffle and select 3 random questions
			const selectedQuestions = shuffle([...questions]).slice(0, 3);

			// Substitute variable placeholders with random values from translations
			const resolveVars = (q: { key: string; text: string; vars?: string[] }): string => {
				let resolved = q.text;
				if (q.vars && q.vars.length > 0) {
					for (const varName of q.vars) {
						const values = t(`variables.${varName}`) as string[] | undefined;
						if (Array.isArray(values) && values.length > 0) {
							resolved = resolved.replace(`[${varName}]`, randomPick(values));
						}
					}
				}
				return resolved;
			};

			// Function to determine icon based on question key (dot notation)
			const getIconForKey = (
				key: string
			):
				| "tractor"
				| "wheat"
				| "cow"
				| "cloud"
				| "money"
				| "document"
				| "insurance"
				| "alert"
				| "bank"
				| "search"
				| "soil"
				| "card" => {
				const [category, subcategory, detail] = key.split(".");

				// Schemes category
				if (category === "schemes") {
					if (detail === "pm_kisan") return "money";
					if (detail === "kisan_credit_card") return "card";
					if (detail === "fasal_bima") return "insurance";
					if (detail === "soil_health_card") return "document";
					if (detail === "pmksy") return "document";
					if (detail === "enam_platform") return "wheat";
					if (detail === "seed_authentication") return "document";
					if (detail === "agriculture_fund") return "bank";
					if (detail === "coverage") return "insurance";
					if (subcategory === "general") return "tractor";
					if (subcategory === "insurance") return "insurance";
					return "tractor";
				}

				// Status category
				if (category === "status") {
					if (subcategory === "payment") return "money";
					if (subcategory === "claims") return "insurance";
					if (subcategory === "card") return "document";
					if (subcategory === "grievance") return "alert";
					return "search";
				}

				// Grievance category
				if (category === "grievance") {
					if (subcategory === "payment") return "money";
					if (subcategory === "claims") return "insurance";
					if (subcategory === "card") return "document";
					if (subcategory === "benefits") return "alert";
					return "alert";
				}

				// Soil category
				if (category === "soil") {
					return "soil";
				}

				// Loan category
				if (category === "loan") {
					return "bank";
				}

				// Mandi / market price category
				if (category === "mandi") {
					return "wheat";
				}

				// Weather category
				if (category === "weather") {
					return "cloud";
				}

				// Livestock and market
				if (category === "livestock") return "cow";
				if (category === "market") return "wheat";

				// Default to tractor for scheme-related app
				return "tractor";
			};

			// Create quick actions from selected questions with variable substitution
			const newActions: QuickAction[] = selectedQuestions.map((q, index) => {
				const resolvedText = resolveVars(q);
				return {
					id: `question-${index}`,
					title: resolvedText,
					description: "",
					icon: getIconForKey(q.key),
					prompt: resolvedText
				};
			});
			set({ quickActions: newActions });
		} else {
			// Fallback to seed questions if no questions in translations
			set({ quickActions: quickActionSeeds });
		}
	},

	playTTS: async (text, language, messageId) => {
		const { sessionId } = get();
		if (!sessionId) return;

		set({ currentlyPlayingId: messageId, ttsStatus: "playing" });

		try {
			await playTTSHelper(text, language, sessionId, () => {
				// Only reset if it's the SAME message that just finished
				if (get().currentlyPlayingId === messageId) {
					set({ currentlyPlayingId: null, ttsStatus: "stopped" });
				}
			});
		} catch (error) {
			console.error("TTS Playback failed:", error);
			set({ currentlyPlayingId: null, ttsStatus: "stopped" });
			set({ toast: { message: "Error Playing Audio. Please try again.", type: "error" } });
		}
	},

	pauseTTS: () => {
		pauseAudio();
		set({ ttsStatus: "paused" });
	},

	resumeTTS: async () => {
		try {
			await resumeAudio();
			set({ ttsStatus: "playing" });
		} catch (error) {
			console.error("TTS Resume failed:", error);
		}
	},

	stopTTS: () => {
		stopAudio();
		set({ currentlyPlayingId: null, ttsStatus: "stopped" });
	},

}));
