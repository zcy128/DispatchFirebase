export interface AIActionCard {
  type: 'unassigned_shifts' | 'confirm_action' | 'action_success' | 'action_cancelled' | string;
  title: string;
  actionId?: string;
  requiresAck?: boolean;
  data?: any;
}

export interface AIChatRequest {
  message: string;
  date: string;
  yardFilter?: string;
  operatorId?: string;
  operatorName?: string;
  userRole?: string;
  pagePermissions?: Record<string, string>;
  actionId?: string;
  confirmed?: boolean;
  confirmActionId?: string;
  confirmAccepted?: boolean;
  lang?: string;
}

export interface AIChatResponse {
  reply: string;
  actionCards?: AIActionCard[];
  suggestedQuestions?: string[];
  engine?: string;
  quotaUsed?: number;
  quotaLimit?: number;
  quotaRemaining?: number;
  quotaExhausted?: boolean;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  cards?: AIActionCard[];
  suggestedQuestions?: string[];
  engine?: string;
  isPending?: boolean;
}

export interface AICopilotStatus {
  status: string;
  engine: string;
  hasApiKey: boolean;
  name: string;
  supported: string[];
  version: string;
  quotaUsed?: number;
  quotaLimit?: number;
  quotaRemaining?: number;
  quotaExhausted?: boolean;
}

export interface MCPTokenResponse {
  token: string;
  expiresAt: string;
  ttlDays: number;
  serverUrl: string;
  mcpHttpUrl: string;
  user: {
    uid: string;
    email: string;
    username?: string;
    fullName?: string;
    role: string;
    employeeId: string;
    pagePermissions?: Record<string, string>;
  };
}
