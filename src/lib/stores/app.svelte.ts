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

export const app = $state({
	connectors: [] as Connector[],
	documents: [] as Document[],
	activeConnector: null as Connector | null,
	currentDoc: null as Document | null,
	messages: [] as Message[],
	chatInput: '',
	isLoading: false,
	abortController: null as AbortController | null,
	progressSections: [] as string[],
	activeSection: '',
	showSettings: false,
	previewTab: 'preview' as 'preview' | 'code',
	zoom: -1,
	previewContainer: null as HTMLElement | null,
});
