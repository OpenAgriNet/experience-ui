import { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CHAT_ASSISTANT, CHAT_USER } from "../config";
import { MessageRole } from "./bubbles/chat-types";
import { useAuth } from "@/lib/auth";

type MessageChromeProps = {
	role: MessageRole;
	children: ReactNode;
	showLabel?: boolean;
};

const ROLE_META = {
	user: CHAT_USER,
	assistant: CHAT_ASSISTANT,
	system: CHAT_ASSISTANT
};

export function MessageChrome({ role, children, showLabel = true }: MessageChromeProps) {
	const isUser = role === "user";
	const { user } = useAuth();
	const meta = ROLE_META[role] ?? CHAT_ASSISTANT;
	
	const getInitials = (username: string) => {
		return username?.substring(0, 2).toUpperCase() || "U";
	};

	const initials = isUser 
		? getInitials(user?.username ?? "User") 
		: meta.name.slice(0, 1).toUpperCase();

	if (isUser) {
		return (
			<div className="flex w-full flex-col pr-1 items-end gap-1 mb-4 min-w-0">
				{/* User Header: Name and Avatar */}
				{showLabel && (
					<div className="flex items-center gap-2">
						<span className="text-sm font-semibold text-[var(--primary)] text-foreground">{user?.username ?? meta.name}</span>
						<Avatar className="h-8 w-8 rounded-full border border-[var(--primary)] bg-indigo-50/50">
							<AvatarFallback className="text-[var(--primary)] text-xs font-bold">{initials}</AvatarFallback>
						</Avatar>
					</div>
				)}
				{children}
			</div>
		);
	}

	// Assistant / System
	return (
		<div className="flex w-full pl-1 flex-col items-start gap-1 min-w-0">
			{/* AI Header: Avatar and Name */}
			{showLabel && (
				<div className="flex items-center gap-2">
					<Avatar className="h-10 w-10 bg-background p-[2px]">
						<AvatarImage src={meta.avatar} className="object-contain" />
						<AvatarFallback className="bg-transparent text-[#00a651] font-bold text-xs">{initials}</AvatarFallback>
					</Avatar>
					<span className="text-sm font-semibold text-foreground dark:text-white">{meta.name}</span>
				</div>
			)}
			<div className="w-full">
				{children}
				{/* Loading dots for AI (if passed as children) should align here */}
			</div>
		</div>
	);
}
