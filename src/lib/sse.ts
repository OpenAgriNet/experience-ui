/**
 * Reads a `text/event-stream` body as events.
 *
 * The Experience API streams its answer as server-sent events, but the
 * browser's own `EventSource` cannot POST, so the body is read from `fetch`
 * and framed here. This follows the SSE format as browsers implement it:
 *
 * - a frame is a run of `field: value` lines ended by a blank line;
 * - `event:` names the frame, `data:` lines join with `\n`;
 * - lines starting with `:` are comments, kept alive on, and ignored;
 * - other fields (`id:`, `retry:`) are accepted and ignored;
 * - line ends may be `\n`, `\r\n` or `\r`.
 *
 * Network chunks do not respect any of those boundaries, so lines and
 * multi-byte characters are reassembled across them. A last frame that the
 * stream closes without a blank line after is still delivered.
 */

export interface SseEvent {
	/** The `event:` field, or `message` when the frame had none. */
	event: string;
	/** The `data:` lines, joined with `\n`. */
	data: string;
}

const LINE_END = /\r\n|\n|\r/;

/**
 * Takes one complete line off the front of `buffer`, or returns null if none
 * is there yet. A `\r` at the very end is not a complete line: the `\n` that
 * may follow it could be in the next chunk.
 */
const takeLine = (buffer: string, streamEnded: boolean): { line: string; rest: string } | null => {
	const match = LINE_END.exec(buffer);
	if (!match) return null;
	if (match[0] === "\r" && match.index === buffer.length - 1 && !streamEnded) return null;
	return { line: buffer.slice(0, match.index), rest: buffer.slice(match.index + match[0].length) };
};

export async function* readSseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
	const reader = body.getReader();
	const decoder = new TextDecoder();

	let buffer = "";
	let eventName = "";
	let dataLines: string[] = [];

	// Returns the frame to emit for a blank line, or null if there is none.
	// Per the SSE format, a frame with no data is dropped, not dispatched.
	const endFrame = (): SseEvent | null => {
		const frame = dataLines.length ? { event: eventName || "message", data: dataLines.join("\n") } : null;
		eventName = "";
		dataLines = [];
		return frame;
	};

	const readField = (line: string): void => {
		if (line.startsWith(":")) return;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		let value = colon === -1 ? "" : line.slice(colon + 1);
		if (value.startsWith(" ")) value = value.slice(1);

		if (field === "event") eventName = value;
		else if (field === "data") dataLines.push(value);
	};

	function* drain(streamEnded: boolean): Generator<SseEvent> {
		let next: ReturnType<typeof takeLine>;
		while ((next = takeLine(buffer, streamEnded)) !== null) {
			buffer = next.rest;
			if (next.line === "") {
				const frame = endFrame();
				if (frame) yield frame;
			} else {
				readField(next.line);
			}
		}
	}

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			yield* drain(false);
		}

		buffer += decoder.decode();
		yield* drain(true);
		if (buffer) readField(buffer);
		const last = endFrame();
		if (last) yield last;
	} finally {
		// Reached on normal completion and when the consumer stops early. On a
		// finished stream this is a no-op; on a live one it closes the connection.
		await reader.cancel().catch(() => undefined);
	}
}
