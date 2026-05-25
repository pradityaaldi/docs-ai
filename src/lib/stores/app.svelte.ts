export interface Connector {
	id: string;
	name: string;
	provider: string;
	base_url: string;
	model_name: string;
	api_key: string;
	is_active: number;
}

export interface Document {
	id: string;
	title: string;
	content: string;
	connector_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface Message {
	id: string;
	document_id: string;
	role: 'user' | 'assistant';
	content: string;
	created_at: string;
}

export type ChatPhase =
	| 'idle'
	| 'connecting'
	| 'chat-streaming'
	| 'chat-saving'
	| 'document-connecting'
	| 'document-streaming'
	| 'document-saving'
	| 'reconnecting'
	| 'error'
	| 'aborted';

export interface ChatStatus {
	phase: ChatPhase;
	message: string;
	startedAt: number | null;
	phaseStartedAt: number | null;
	finishedAt: number | null;
	errorMsg: string;
	sections: string[];
	activeSection: string;
	attachedMsgId: string | null;
	bytesReceived: number;
	lastChunkAt: number | null;
	thinking: boolean;
}

export const app = $state({
	connectors: [] as Connector[],
	documents: [] as Document[],
	activeConnector: null as Connector | null,
	currentDoc: null as Document | null,
	messages: [] as Message[],
	chatInput: '',
	isLoading: false,
	abortController: null as AbortController | null,
	isGenerating: false,
	generateAbortController: null as AbortController | null,
	status: {
		phase: 'idle',
		message: '',
		startedAt: null,
		phaseStartedAt: null,
		finishedAt: null,
		errorMsg: '',
		sections: [],
		activeSection: '',
		attachedMsgId: null,
		bytesReceived: 0,
		lastChunkAt: null,
		thinking: false,
	} as ChatStatus,
	showSettings: false,
	previewTab: 'preview' as 'preview' | 'code',
	zoom: -1,
	previewContainer: null as HTMLElement | null,
});

export function setPhase(phase: ChatPhase, message: string, errorMsg = '') {
	app.status.phase = phase;
	app.status.message = message;
	app.status.errorMsg = errorMsg;
	app.status.phaseStartedAt = phase === 'idle' ? null : Date.now();
	if (phase === 'idle') {
		app.status.startedAt = null;
		app.status.finishedAt = null;
		app.status.attachedMsgId = null;
		app.status.sections = [];
		app.status.activeSection = '';
		app.status.bytesReceived = 0;
		app.status.lastChunkAt = null;
		app.status.thinking = false;
	} else if (phase === 'error' || phase === 'aborted') {
		app.status.finishedAt = Date.now();
	} else {
		app.status.finishedAt = null;
		if (app.status.startedAt === null) {
			app.status.startedAt = Date.now();
		}
	}
}
