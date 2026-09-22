import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CHAT_ASSISTANT } from "../config";
import { QuickAction } from "@/hooks/store/chat";

type WelcomePanelProps = {
	onAction: (id: string) => void;
	actions: QuickAction[];
};

import { useLanguage } from "@/components/LanguageProvider";

export function WelcomePanel({ onAction, actions }: WelcomePanelProps) {
	const { t } = useLanguage();
	return (
		<div className="flex w-full flex-col items-center px-4 py-8">
			{/* Logo & Greeting */}
			<div className="mb-8 flex flex-col items-center gap-4 text-center">
				<Avatar className="h-30 w-30">
					<AvatarImage
						src={CHAT_ASSISTANT.avatar}
						alt={CHAT_ASSISTANT.name}
						className="object-contain"
					/>
					<AvatarFallback className="bg-transparent text-2xl font-bold text-[var(--primary)]">
						{CHAT_ASSISTANT.name.slice(0, 1)}
					</AvatarFallback>
				</Avatar>

				<div className="space-y-1">
					<div className="text-2xl font-semibold text-[var(--primary)]">{t("appTitle")}</div>
					<div className="text-xl font-medium text-black dark:text-[#F6F6F6]">{t("welcome")}</div>
				</div>
			</div>

			{/* Cards List (Full width as per image 1) */}
			<div className="flex w-full max-w-2xl flex-col gap-3">
				{actions.map((action) => {
					// Map icons from store to emojis for the UI match
					const iconMap: Record<string, string> = {
						tractor: "🚜",
						cow: "🐮",
						wheat: "🌾",
						cloud: "☁️",
						money: "💰",
						document: "📄",
						insurance: "📝",
						alert: "💬",
						bank: "🏦",
						search: "🔍",
						soil: "🪴",
						card: "💳"
					};
					const icon = iconMap[action.icon] || "📄";

					return (
						<Button
							key={action.id}
							variant="ghost"
							className="h-auto w-full cursor-pointer justify-start gap-4 rounded-2xl border border-gray-100 bg-white px-4 py-4 text-left whitespace-normal shadow-sm transition-all duration-200 hover:bg-gray-50 hover:shadow-md sm:px-6 sm:py-6 dark:border-transparent dark:bg-[#FFFFFF0D] dark:hover:bg-[#FFFFFF1A]"
							onClick={() => onAction(action.id)}
						>
							<div className="shrink-0 text-2xl sm:text-3xl">{icon}</div>
							<span className="text-base leading-snug font-medium text-gray-900 dark:text-white">
								{action.title}
							</span>
						</Button>
					);
				})}
			</div>
		</div>
	);
}
