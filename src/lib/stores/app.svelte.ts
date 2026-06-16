export interface Connector {
	id: string;
	name: string;
	provider: string;
	base_url: string;
	model_name: string;
	api_key: string;
	is_active: number;
}

export interface Project {
	id: string;
	name: string;
	user_id?: string | null;
	template_id?: string | null;
	input?: Record<string, string> | null;
	bahasa?: string;
	status?: 'belum mulai' | 'generated' | 'siap export';
	created_at: string;
	updated_at: string;
}

export interface Folder {
	id: string;
	name: string;
	project_id: string;
	parent_id: string | null;
	created_at: string;
}

export interface TreeNode {
	id: string;
	name: string;
	type: 'folder';
	parent_id: string | null;
	children: TreeNode[];
	documents: DocEntry[];
}

export interface DocEntry {
	id: string;
	title: string;
	updated_at: string;
}

export interface Document {
	id: string;
	title: string;
	content: string;
	connector_id: string | null;
	project_id: string | null;
	folder_id: string | null;
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

export interface ToolResultEntry {
	title: string;
	documentId: string;
	success: boolean;
	error?: string;
}

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
	toolPhase: 'tools' | 'chat';
	toolCallsCompleted: number;
	toolCallCurrent: string;
	toolResults: ToolResultEntry[];
}

export interface CurrentUser {
	id: string;
	email: string;
	name: string;
	role: 'user' | 'admin';
	emailVerified?: boolean;
}

export const app = $state({
	connectors: [] as Connector[],
	currentUser: null as CurrentUser | null,
	aiReady: false,
	aiProvider: '' as string,
	documents: [] as Document[],
	projects: [] as Project[],
	currentProject: null as Project | null,
	projectTree: [] as TreeNode[],
	rootDocuments: [] as DocEntry[],
	globalConversation: null as Document | null,
	currentDoc: null as Document | null,
	messages: [] as Message[],
	sidebarView: 'projects' as 'projects' | 'project-detail',
	expandedFolderIds: new Set<string>(),
	navigatingFolderId: null as string | null,
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
		toolPhase: 'chat' as 'tools' | 'chat',
		toolCallsCompleted: 0,
		toolCallCurrent: '',
		toolResults: [] as ToolResultEntry[],
	} as ChatStatus,
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
		app.status.toolPhase = 'chat';
		app.status.toolCallsCompleted = 0;
		app.status.toolCallCurrent = '';
		app.status.toolResults = [];
	} else if (phase === 'error' || phase === 'aborted') {
		app.status.finishedAt = Date.now();
	} else {
		app.status.finishedAt = null;
		if (app.status.startedAt === null) {
			app.status.startedAt = Date.now();
		}
	}
}
