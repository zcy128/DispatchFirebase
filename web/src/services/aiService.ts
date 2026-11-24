import { apiRequest } from './api';
import { AIChatRequest, AIChatResponse, AICopilotStatus, AITestResult, MCPTokenResponse } from '../types/ai';

export const aiService = {
  /**
   * Send a chat message or confirmation payload to the AI Copilot backend
   */
  async chat(payload: AIChatRequest): Promise<AIChatResponse> {
    try {
      return await apiRequest<AIChatResponse>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw err;
    }
  },

  /**
   * Check status and current engine (Builtin NLP vs Gemini)
   */
  async getStatus(): Promise<AICopilotStatus> {
    try {
      return await apiRequest<AICopilotStatus>('/api/ai/status');
    } catch (err) {
      return {
        status: 'offline',
        engine: 'builtin',
        hasApiKey: false,
        name: 'Dispatch AI Copilot',
        supported: [],
        version: '1.0',
      };
    }
  },

  /**
   * Run a live connectivity test against the active AI engine (Gemini, Ollama, or Built-in)
   */
  async testConnection(): Promise<AITestResult> {
    return await apiRequest<AITestResult>('/api/ai/test', {
      method: 'POST',
    });
  },

  /**
   * Issue a signed Personal Access Token (dsp_mcp_...) for external MCP clients (Cursor, Gemini, Codex)
   */
  async generateMCPToken(ttlDays = 30): Promise<MCPTokenResponse> {
    return await apiRequest<MCPTokenResponse>('/api/auth/mcp-token', {
      method: 'POST',
      body: JSON.stringify({ ttlDays }),
    });
  },
};
