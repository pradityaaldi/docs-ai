// Public API barrel for the AI subsystem. Import sites use `$lib/server/ai`.
export type {
	AIProvider,
	AIConnector,
	ChatMessage,
	AIStreamChunk,
	ToolDefinition,
	ToolCall,
	ToolCallResponse,
	Usage,
	CompletionResult
} from './types';

export { generateCompletion } from './completion';
export { streamAIResponse } from './stream';
export { streamAIWithTools } from './tools';
export { testConnectorConnection } from './test';
