import { apiRequest } from './api';
import { AIChatRequest, AIChatResponse, AICopilotStatus } from '../types/ai';

export const aiService = {
  /**
   * Send a chat message or confirmation payload to the AI Copilot backend
   */
  async chat(payload: AIChatRequest): Promise<AIChatResponse> {
    try {
      return await apiRequest<AIChatResponse>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Fallback to public endpoint if protected fails during development
      return await apiRequest<AIChatResponse>('/public/ai/chat', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
  },

  /**
   * Check status and current engine (Builtin NLP vs Gemini)
   */
  async getStatus(): Promise<AICopilotStatus> {
    try {
      return await apiRequest<AICopilotStatus>('/public/ai/status');
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
};
