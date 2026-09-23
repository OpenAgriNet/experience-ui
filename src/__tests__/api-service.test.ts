import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/runtime-config", () => ({
	getConfig: () => ({ api: { baseUrl: "/api" }, stubs: { enabled: false } })
}));

import apiService, { ApiError, type ChatTurn } from "@/lib/api-service";

/**
 * The chat call is the client's whole coupling to the Experience API. These
 * tests hold it to the contract (§4–§6) with a fake fetch: what it sends, how
 * it reads the event stream, and that every way a turn can fail comes out as
 * one ApiError with a code the rest of the client can branch on.
 */
const turn: ChatTurn = {
	sessionId: "68a3872f-3f0d-4cf6-99a3-a350132a0080",
	messageId: "1ab38d6c-6fdb-4849-8ea1-da5e80a8687c",
	query: "And what about tomorrow?",
	history: [{ role: "user", text: "Weather today?" }, { role: "assistant", text: "Clear, 31°C." }],
	language: { source: "en", target: "en" }
};

const STARTED = `event: started\ndata: {"sequence":1,"sessionId":"${turn.sessionId}","messageId":"${turn.messageId}","assistantMessageId":"8d2f4b61-93c7-4e0a-b1f5-2a7c9e3d6f10","traceId":"3c67dc05-6ba2-4ab4-bb7c-377e16a5ab5b"}\n\n`;
const DELTAS = `event: delta\ndata: {"sequence":2,"text":"Tomorrow in Nashik "}\n\nevent: delta\ndata: {"sequence":3,"text":"expect light rain after 3 pm."}\n\n`;
const COMPLETED = `event: completed\ndata: {"sequence":4,"sessionId":"${turn.sessionId}","messageId":"${turn.messageId}","assistantMessageId":"8d2f4b61-93c7-4e0a-b1f5-2a7c9e3d6f10","traceId":"3c67dc05-6ba2-4ab4-bb7c-377e16a5ab5b","outcome":{"status":"answered","cause":null},"content":[{"type":"text","text":"Tomorrow in Nashik expect light rain after 3 pm.","citations":[]}],"sources":[]}\n\n`;

const streamResponse = (text: string, contentType = "text/event-stream; charset=utf-8"): Response =>
	new Response(
		new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(text));
				controller.close();
			}
		}),
		{ status: 200, headers: { "content-type": contentType } }
	);

const jsonResponse = (status: number, body?: unknown): Response =>
	new Response(body === undefined ? null : JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" }
	});

const fetchOnce = (response: Response) => {
	const fetchMock = vi.fn().mockResolvedValue(response);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
};

const failure = async (promise: Promise<unknown>): Promise<ApiError> => {
	try {
		await promise;
	} catch (error) {
		if (error instanceof ApiError) return error;
		throw error;
	}
	throw new Error("expected the call to fail");
};

describe("sendUserQuery", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("posts the turn as the contract's body, with location only when known", async () => {
		const fetchMock = fetchOnce(streamResponse(STARTED + COMPLETED));
		await apiService.sendUserQuery(turn);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/api/v1/chat");
		expect(init.method).toBe("POST");
		expect(init.headers).toMatchObject({ "Content-Type": "application/json", Accept: "text/event-stream" });
		expect(JSON.parse(init.body as string)).toEqual(turn);

		apiService.setLocationData({ latitude: 20.0059, longitude: 73.7898 });
		const again = fetchOnce(streamResponse(STARTED + COMPLETED));
		await apiService.sendUserQuery(turn);
		const [, second] = again.mock.calls[0] as [string, RequestInit];
		expect(JSON.parse(second.body as string).location).toEqual({ latitude: 20.0059, longitude: 73.7898 });
	});

	it("reports started and each delta, then resolves with the completed answer", async () => {
		fetchOnce(streamResponse(STARTED + DELTAS + COMPLETED));
		const onStarted = vi.fn();
		const onDelta = vi.fn();

		const answer = await apiService.sendUserQuery(turn, { onStarted, onDelta });

		expect(onStarted).toHaveBeenCalledWith({
			assistantMessageId: "8d2f4b61-93c7-4e0a-b1f5-2a7c9e3d6f10",
			traceId: "3c67dc05-6ba2-4ab4-bb7c-377e16a5ab5b"
		});
		expect(onDelta.mock.calls.map((c) => c[0])).toEqual(["Tomorrow in Nashik ", "expect light rain after 3 pm."]);
		expect(answer.content).toEqual([
			{ type: "text", text: "Tomorrow in Nashik expect light rain after 3 pm.", citations: [] }
		]);
	});

	it("returns a completed answer that carries error, rather than failing", async () => {
		const completed = COMPLETED.replace(
			'"sources":[]',
			'"sources":[],"error":{"code":"provider_unavailable","message":"down","retryable":true,"traceId":"t-1"}'
		);
		fetchOnce(streamResponse(STARTED + completed));

		const answer = await apiService.sendUserQuery(turn);

		expect(answer.error).toMatchObject({ code: "provider_unavailable", retryable: true });
	});

	it("skips events it does not know", async () => {
		fetchOnce(streamResponse(STARTED + 'event: heartbeat\ndata: {"sequence":2}\n\n' + COMPLETED));

		await expect(apiService.sendUserQuery(turn)).resolves.toMatchObject({ outcome: { status: "answered" } });
	});

	it("fails with the code from an error event", async () => {
		fetchOnce(
			streamResponse(
				STARTED +
					'event: error\ndata: {"sequence":2,"error":{"code":"timeout","message":"DSS too slow","retryable":true,"traceId":"3c67dc05-6ba2-4ab4-bb7c-377e16a5ab5b"}}\n\n'
			)
		);

		const error = await failure(apiService.sendUserQuery(turn));

		expect(error).toMatchObject({ code: "timeout", retryable: true, traceId: "3c67dc05-6ba2-4ab4-bb7c-377e16a5ab5b" });
	});

	it("fails with the code from an error response body", async () => {
		fetchOnce(
			jsonResponse(503, {
				error: { code: "upstream_unavailable", message: "DSS not ready", retryable: true, traceId: "t-503" }
			})
		);

		const error = await failure(apiService.sendUserQuery(turn));

		expect(error).toMatchObject({ code: "upstream_unavailable", retryable: true, status: 503, traceId: "t-503" });
	});

	it("treats a 413 without a contract body as history_too_large", async () => {
		fetchOnce(new Response("<html>413 Request Entity Too Large</html>", { status: 413 }));

		const error = await failure(apiService.sendUserQuery(turn));

		expect(error).toMatchObject({ code: "history_too_large", retryable: false, status: 413 });
	});

	it("reports any other response without a contract body as unknown, retryable only for 429 and 5xx", async () => {
		fetchOnce(jsonResponse(422, { detail: [{ loc: ["body", "sessionId"], msg: "Field required" }] }));
		expect(await failure(apiService.sendUserQuery(turn))).toMatchObject({ code: "unknown", retryable: false, status: 422 });

		fetchOnce(jsonResponse(502));
		expect(await failure(apiService.sendUserQuery(turn))).toMatchObject({ code: "unknown", retryable: true, status: 502 });
	});

	it("fails as upstream_error when the stream ends with neither completed nor error", async () => {
		fetchOnce(streamResponse(STARTED + DELTAS));

		const error = await failure(apiService.sendUserQuery(turn));

		expect(error).toMatchObject({ code: "upstream_error", retryable: true, traceId: "3c67dc05-6ba2-4ab4-bb7c-377e16a5ab5b" });
	});

	it("fails as upstream_error when the response is not an event stream", async () => {
		fetchOnce(streamResponse("<!doctype html><html></html>", "text/html"));

		const error = await failure(apiService.sendUserQuery(turn));

		expect(error).toMatchObject({ code: "upstream_error", retryable: true });
	});
});
