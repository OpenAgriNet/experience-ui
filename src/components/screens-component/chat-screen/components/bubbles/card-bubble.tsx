import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Volume2, Check, Pause, Play, RefreshCw } from "lucide-react";
import { type CardMessage } from "./chat-types";
import { useChatStore } from "@/hooks/store/chat";
import { FEATURES } from "@/lib/config/features";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";
import { SafeMarkdown } from "./safe-markdown";

export function CardBubble({ message }: { readonly message: CardMessage }) {
	const { language } = useLanguage();
	const playTTS = useChatStore((s) => s.playTTS);
	const pauseTTS = useChatStore((s) => s.pauseTTS);
	const resumeTTS = useChatStore((s) => s.resumeTTS);
	const currentlyPlayingId = useChatStore((s) => s.currentlyPlayingId);
	const ttsStatus = useChatStore((s) => s.ttsStatus);
	const retryLastMessage = useChatStore((s) => s.retryLastMessage);
	const setToast = useChatStore((s) => s.setToast);

	const [showCopySuccess, setShowCopySuccess] = useState(false);
	const [isRetrying, setIsRetrying] = useState(false);

	const isThisPlaying = currentlyPlayingId === message.id && ttsStatus === "playing";
	const isThisPaused = currentlyPlayingId === message.id && ttsStatus === "paused";
	const isRetryableError = message.isError && message.failedUserText;

	const handleListen = async () => {
		try {
			if (isThisPlaying) {
				pauseTTS();
			} else if (isThisPaused) {
				await resumeTTS();
			} else {
				await playTTS(message.body, language, message.id);
			}
		} catch (error) {
			console.error("TTS action failed:", error);
		}
	};

	const handleRetry = () => {
		if (isRetrying) return;
		setIsRetrying(true);
		retryLastMessage(language);
	};

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(message.body);
			setShowCopySuccess(true);
			setTimeout(() => setShowCopySuccess(false), 1000);
		} catch (error) {
			console.error(error);
			setToast({ message: "Failed to copy to clipboard. Please try again", type: "error" });
		}
	};

	// AI Messages are always cards in this design
	return (
		<>
			<div className="w-full max-w-[95%] sm:max-w-[90%] mb-8">
				<Card className={cn(
					"relative rounded-2xl border-none p-4 shadow-sm overflow-hidden",
					isRetryableError
						? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30"
						: "bg-white dark:bg-[var(--aiBubble-dark)] dark:border-[var(--border-dark)]"
				)}>
					{/* Content */}
					<div>
						{message.title ? (
							<div className="mb-2 text-base font-bold">{message.title}</div>
						) : null}

						<div className={cn("prose prose-sm dark:prose-invert max-w-none text-base leading-relaxed text-foreground dark:text-[var(--aiBubbleText-dark)] break-words overflow-wrap-anywhere", message.isError && "text-red-600 dark:text-red-400 font-medium")}>
							<SafeMarkdown>{message.body}</SafeMarkdown>
						</div>

						{/* Retry Button for error messages */}
						{isRetryableError && (
							<div className="mt-3 flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									className="gap-2 rounded-xl border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 cursor-pointer"
									onClick={handleRetry}
									disabled={isRetrying}
								>
									<RefreshCw className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")} />
									{isRetrying ? "Retrying..." : "Retry"}
								</Button>
							</div>
						)}

						{/* Action Chips */}
						{message.actions?.length ? (
							<div className="mt-3 flex flex-wrap gap-2 pt-1">
								{message.actions.map((a) => (
									<Button
										key={a.id}
										variant="outline"
										className="h-8 rounded-full border-indigo-200 bg-white px-4 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
									>
										{a.label}
									</Button>
								))}
							</div>
						) : null}
					</div>

					{/* Footer Row — hidden for retryable errors */}
					{message.showListenRow && !isRetryableError && (
						<div className="flex flex-col gap-3">
							<div className="mx-[-1rem] h-px bg-gray-200 dark:bg-indigo-800/20" />
							<div className="flex items-center justify-start -ml-3">
							<div className="flex items-center gap-0">
								{FEATURES.textToSpeech && (
								<>
								<Button
									variant="ghost"
									className="group h-10 gap-2 rounded-none pl-6 pr-4 text-sm font-bold text-[var(--primary)] transition-all hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 cursor-pointer"
									onClick={handleListen}
								>
									{isThisPlaying ? (
										<Pause className="h-4 w-4 text-[var(--primary)] group-hover:scale-110 transition-transform" />
									) : isThisPaused ? (
										<Play className="h-4 w-4 text-[var(--primary)] group-hover:scale-110 transition-transform" />
									) : (
										<Volume2 className="h-4 w-4 text-[var(--primary)] group-hover:scale-110 transition-transform" />
									)}
									<span>{isThisPlaying ? "Pause" : isThisPaused ? "Resume" : "Listen"}</span>
								</Button>

								<div className="h-5 w-px self-center bg-gray-200 dark:bg-indigo-800/30" />
								</>
								)}

								<Button
									variant="ghost"
									size="icon"
									className="flex-1 h-10 w-12 rounded-none text-foreground/60 transition-all hover:bg-indigo-50 hover:text-[var(--primary)] dark:text-gray-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300 cursor-pointer"
									title="Copy"
									onClick={handleCopy}
								>
									{showCopySuccess ? (
										<Check className="h-4 w-4 text-[var(--primary)]" />
									) : (
										<Copy className="h-4 w-4 text-[var(--primary)]" />
									)}
								</Button>

							</div>
							</div>
						</div>
					)}
				</Card>
			</div>

		</>
	);
}
