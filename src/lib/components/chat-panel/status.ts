// Pure formatting + status-label helpers for the chat panel.

export function fmtElapsed(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${m}m ${r}s`;
}

export function fmtBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export const phaseLabel: Record<string, string> = {
	'connecting': 'Connecting to AI…',
	'reconnecting': 'Reconnecting…',
	'chat-streaming': 'Composing reply',
	'chat-saving': 'Reply saved',
	'document-connecting': 'Connecting for document…',
	'document-streaming': 'Generating document',
	'document-saving': 'Saving document',
	'error': 'Error',
	'aborted': 'Stopped'
};

export function phaseIcon(phase: string): string {
	if (phase === 'error') return 'error';
	if (phase === 'aborted') return 'stop';
	if (phase === 'document-streaming' || phase === 'document-saving' || phase === 'document-connecting') return 'doc';
	if (phase === 'connecting' || phase === 'reconnecting') return 'plug';
	return 'spin';
}
