import { describe, expect, it } from "vitest";

import { readSseEvents } from "@/lib/sse";

/**
 * The parser sits between the network and everything that reads an answer.
 * Each case here is one rule of the SSE format, plus the ways a network chunk
 * can cut a frame that the rules do not mention.
 */
const streamOf = (...chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> =>
	new ReadableStream<Uint8Array>({
		start(controller) {
			const encoder = new TextEncoder();
			for (const chunk of chunks) {
				controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
			}
			controller.close();
		}
	});

const collect = async (body: ReadableStream<Uint8Array>) => {
	const events = [];
	for await (const event of readSseEvents(body)) events.push(event);
	return events;
};

describe("readSseEvents", () => {
	it("frames event and data lines ended by a blank line", async () => {
		const events = await collect(streamOf('event: delta\ndata: {"text":"hi"}\n\n'));

		expect(events).toEqual([{ event: "delta", data: '{"text":"hi"}' }]);
	});

	it("joins several data lines with a newline", async () => {
		const events = await collect(streamOf("data: one\ndata: two\n\n"));

		expect(events).toEqual([{ event: "message", data: "one\ntwo" }]);
	});

	it("names a frame without an event line 'message'", async () => {
		const events = await collect(streamOf("data: x\n\n"));

		expect(events[0]?.event).toBe("message");
	});

	it("ignores comment lines, unknown fields and empty frames", async () => {
		const events = await collect(
			streamOf(": ping\n\n", "id: 7\nretry: 1000\n\n", ": keep-alive\nevent: delta\ndata: a\n\n")
		);

		expect(events).toEqual([{ event: "delta", data: "a" }]);
	});

	it("accepts CRLF and lone CR line endings", async () => {
		const crlf = await collect(streamOf("event: a\r\ndata: 1\r\n\r\n"));
		const cr = await collect(streamOf("event: b\rdata: 2\r\r"));

		expect(crlf).toEqual([{ event: "a", data: "1" }]);
		expect(cr).toEqual([{ event: "b", data: "2" }]);
	});

	it("reassembles a frame cut across chunks, including inside a CRLF", async () => {
		const events = await collect(
			streamOf("eve", "nt: delta\nda", "ta: hel", "lo\r", "\n\r\nevent: done\ndata: ok\n\n")
		);

		expect(events).toEqual([
			{ event: "delta", data: "hello" },
			{ event: "done", data: "ok" }
		]);
	});

	it("reassembles a multi-byte character cut across chunks", async () => {
		const bytes = new TextEncoder().encode("data: 31°C\n\n");
		const cut = bytes.indexOf(0xc2) + 1; // between the two bytes of °

		const events = await collect(streamOf(bytes.slice(0, cut), bytes.slice(cut)));

		expect(events).toEqual([{ event: "message", data: "31°C" }]);
	});

	it("delivers a final frame the stream closes without a blank line after", async () => {
		const events = await collect(streamOf("event: completed\ndata: last"));

		expect(events).toEqual([{ event: "completed", data: "last" }]);
	});

	it("keeps a value's own colons and strips one leading space only", async () => {
		const events = await collect(streamOf("data:  a: b\n\n", "data:nospace\n\n"));

		expect(events.map((e) => e.data)).toEqual([" a: b", "nospace"]);
	});

	it("cancels the body when the reader stops early", async () => {
		let cancelled = false;
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("data: 1\n\ndata: 2\n\n"));
			},
			cancel() {
				cancelled = true;
			}
		});

		for await (const event of readSseEvents(body)) {
			expect(event.data).toBe("1");
			break;
		}

		expect(cancelled).toBe(true);
	});
});
