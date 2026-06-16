export type ExtractResult = { text: string | null; done?: boolean };

/**
 * Parse a provider SSE stream into a plain text byte stream. `extract` maps one
 * `data:` event payload to `{ text, done }`; closes on `[DONE]`, finish sentinel,
 * or `idleMs` of silence.
 */
export function parseSSE(
	body: ReadableStream<Uint8Array>,
	extract: (data: string) => ExtractResult,
	idleMs = 10000
): ReadableStream<Uint8Array> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let buffer = '';
	let sawDone = false;

	const readWithIdleTimeout = (): Promise<{ done: boolean; value?: Uint8Array; timedOut?: boolean }> => {
		return new Promise((resolve, reject) => {
			let settled = false;
			const t = setTimeout(() => {
				if (settled) return;
				settled = true;
				console.warn(`[parseSSE] idle timeout after ${idleMs}ms — forcing close`);
				resolve({ done: true, timedOut: true });
			}, idleMs);
			reader.read().then(
				(r) => { if (settled) return; settled = true; clearTimeout(t); resolve(r); },
				(e) => { if (settled) return; settled = true; clearTimeout(t); reject(e); }
			);
		});
	};

	return new ReadableStream({
		async pull(controller) {
			try {
				const { done, value, timedOut } = await readWithIdleTimeout();
				if (done) {
					if (buffer.trim() && !timedOut) {
						const line = buffer.trim();
						if (line.startsWith('data: ')) {
							const data = line.slice(6);
							if (data !== '[DONE]') {
								const r = extract(data);
								if (r.text) controller.enqueue(encoder.encode(r.text));
							}
						}
					}
					if (timedOut) {
						reader.cancel('idle timeout').catch(() => {});
					}
					controller.close();
					return;
				}

				buffer += decoder.decode(value, { stream: true });
				let nlIdx: number;
				while ((nlIdx = buffer.indexOf('\n')) !== -1) {
					const line = buffer.slice(0, nlIdx).trim();
					buffer = buffer.slice(nlIdx + 1);
					if (!line || !line.startsWith('data: ')) continue;
					const data = line.slice(6);
					if (data === '[DONE]') { sawDone = true; continue; }
					const r = extract(data);
					if (r.text) controller.enqueue(encoder.encode(r.text));
					if (r.done) sawDone = true;
				}
				if (sawDone) {
					console.log('[parseSSE] done sentinel/finish_reason — closing');
					reader.cancel('done sentinel').catch(() => {});
					controller.close();
				}
			} catch (err) {
				controller.error(err);
			}
		},
		cancel(reason) {
			reader.cancel(reason).catch(() => {});
		}
	});
}
