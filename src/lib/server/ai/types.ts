export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface AIConnector {
	id: string;
	name: string;
	provider: AIProvider;
	base_url: string;
	model_name: string;
	api_key: string;
	is_active: number;
}

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface AIStreamChunk {
	type: 'text' | 'error' | 'done';
	content?: string;
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

export interface ToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

export interface ToolCallResponse {
	text: string | null;
	toolCalls: ToolCall[] | null;
	finishReason: string;
}

export interface Usage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface CompletionResult {
	text: string;
	usage: Usage;
}
