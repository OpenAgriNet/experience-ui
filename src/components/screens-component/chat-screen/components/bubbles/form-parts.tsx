import { CheckCircle2, CircleSlash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/components/ui/dialog";
import type { FormAction } from "@/lib/api-service";
import type { FormStatus } from "@/lib/forms/form-storage";
import type { FormRow } from "@/lib/forms/rows";

/** The pieces around the form: its frame, the fix hint, Submit and where it ended up, and the confirm pop-up. */

export const FORM_FRAME =
	"mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-[var(--border-dark)] dark:bg-transparent";

export function FixHint() {
	return (
		<p className="text-sm text-muted-foreground">Fix the details below. Everything else stays as you entered it.</p>
	);
}

type FormFooterProps = {
	status: FormStatus;
	/** Buttons beside Submit that this client knows, such as Resend OTP. */
	actions: FormAction[];
	onAction: (action: FormAction) => void;
};

/** Submit and the form's other buttons while open; where the form ended up once it is not. */
export function FormFooter({ status, actions, onAction }: FormFooterProps) {
	if (status === "filed") {
		return (
			<p className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
				<CheckCircle2 className="h-4 w-4" />
				Submitted
			</p>
		);
	}
	if (status === "closed") {
		return (
			<p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
				<CircleSlash className="h-4 w-4" />
				Not submitted
			</p>
		);
	}
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				type="submit"
				disabled={status !== "open"}
				className="rounded-xl bg-[var(--primary)] px-6 text-white"
			>
				{status === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
				{status === "sending" ? "Sending…" : "Submit"}
			</Button>
			{actions.map((action) => (
				<Button
					key={action.name}
					type="button"
					variant="outline"
					disabled={status !== "open"}
					className="rounded-xl px-6"
					onClick={() => onAction(action)}
				>
					{action.label}
				</Button>
			))}
		</div>
	);
}

type ConfirmDialogProps = {
	open: boolean;
	rows: FormRow[];
	disabled: boolean;
	onEdit: () => void;
	onConfirm: () => void;
};

/** Reads back every field before anything is sent. Edit goes back with nothing lost. */
export function ConfirmDialog({ open, rows, disabled, onEdit, onConfirm }: ConfirmDialogProps) {
	return (
		<Dialog open={open} onOpenChange={(next) => !next && onEdit()}>
			<DialogContent showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>Check your details</DialogTitle>
					<DialogDescription>This is what will be sent. Is it right?</DialogDescription>
				</DialogHeader>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
					{rows.map((row) => (
						<div key={row.label} className="contents">
							<dt className="text-muted-foreground">{row.label}</dt>
							<dd className="break-words font-medium">{row.value || "—"}</dd>
						</div>
					))}
				</dl>
				<DialogFooter>
					<Button variant="outline" onClick={onEdit}>
						Edit
					</Button>
					<Button onClick={onConfirm} disabled={disabled} className="bg-[var(--primary)] text-white">
						Confirm
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
