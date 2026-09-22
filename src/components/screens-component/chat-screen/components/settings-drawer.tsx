import { Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageProvider";
import { useThemeStore } from "@/hooks/store/theme";
import { THEMES } from "@/components/screens-component/chat-screen/config";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface SettingsDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SettingsDrawer({ open, onOpenChange }: SettingsDrawerProps) {
	const { t } = useLanguage();
	const { theme, setTheme } = useThemeStore();

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex h-full w-full flex-col border-l border-gray-200 bg-[#f1f3ff] p-0 sm:max-w-[50%] dark:border-[var(--border-dark)] dark:bg-[var(--background-dark)]"
			>
				{/* Custom Header to match the design */}
				<div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-[var(--border-dark)] dark:bg-[var(--headerBg-dark)]">
					<h2 className="text-xl font-bold text-gray-900 dark:text-[var(--headerText-dark)]">
						{t("settingsPage.title")}
					</h2>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => onOpenChange(false)}
						className="h-10 w-10 text-gray-500 hover:bg-indigo-50 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
					>
						<X className="h-6 w-6" />
					</Button>
				</div>

				<div className="flex-1 space-y-8 overflow-y-auto p-6">
					{/* Theme Toggle */}
					<div className="space-y-4">
						<h3 className="text-sm font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
							{t("settingsPage.appearance")}
						</h3>
						<div className="flex gap-4">
							<button
								onClick={() => setTheme(THEMES.light)}
								className={`flex h-14 flex-1 items-center justify-center gap-3 rounded-xl border-2 transition-all ${
									theme === THEMES.light
										? "border-[var(--primary)] bg-indigo-50/50 text-[var(--primary)] dark:bg-indigo-900/10"
										: "border-[#4F4F4F] bg-[#FFFFFF0D] text-gray-600 dark:border-[#4F4F4F] dark:bg-[#FFFFFF0D] dark:text-gray-400"
								}`}
							>
								<Sun
									className={`h-5 w-5 ${theme === THEMES.light ? "text-[var(--primary)]" : "text-[#B0B0B0]"}`}
								/>
								<span className="text-sm font-bold dark:text-[#B0B0B0]">
									{t("settingsPage.lightMode")}
								</span>
							</button>

							<button
								onClick={() => setTheme(THEMES.dark)}
								className={`flex h-14 flex-1 items-center justify-center gap-3 rounded-xl border-2 transition-all ${
									theme === THEMES.dark
										? "border-[var(--primary)] bg-indigo-50/50 text-[var(--primary)] dark:bg-indigo-900/10"
										: "border-gray-100 bg-gray-50 text-gray-600 dark:border-gray-900 dark:bg-gray-900/50 dark:text-gray-400"
								}`}
							>
								<Moon
									className={`h-5 w-5 ${theme === THEMES.dark ? "text-[var(--primary)]" : "text-gray-400"}`}
								/>
								<span className="text-sm font-bold">{t("settingsPage.darkMode")}</span>
							</button>
						</div>
					</div>

				</div>

				<div className="border-t border-gray-100 bg-gray-50/50 p-6 dark:border-gray-900 dark:bg-gray-900/30">
					<p className="text-center text-xs text-gray-400 dark:text-gray-500">
						Version 1.0.0 • {t("settingsPage.poweredBy")}
					</p>
				</div>
			</SheetContent>
		</Sheet>
	);
}
