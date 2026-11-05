import { memo, useMemo, useState } from 'react';
import { aiService } from '../../services/aiService';
import { MCPTokenResponse } from '../../types/ai';
import { useI18n } from '../../contexts/I18nContext';
import { useScheduledReset } from './useScheduledReset';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Zap
} from 'lucide-react';

const MCP_HTTP_URL = 'https://dispatch-api-337919645491.northamerica-northeast1.run.app/api/mcp';
const MCP_SERVER_URL = 'https://dispatch-api-337919645491.northamerica-northeast1.run.app';

export const McpSettingsSection = memo(function McpSettingsSection() {
  const { isFrench } = useI18n();
  const scheduleReset = useScheduledReset();
  const [mcpTokenInfo, setMcpTokenInfo] = useState<MCPTokenResponse | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [mcpCopiedKey, setMcpCopiedKey] = useState<string | null>(null);

  const httpCopy = useMemo(() => JSON.stringify({
    mcpServers: {
      dispatch: {
        url: mcpTokenInfo?.mcpHttpUrl || MCP_HTTP_URL,
        headers: {
          Authorization: `Bearer ${mcpTokenInfo?.token || '<YOUR_MCP_TOKEN>'}`,
        },
      },
    },
  }, null, 2), [mcpTokenInfo]);

  const httpSnippet = useMemo(() => JSON.stringify({
    mcpServers: {
      dispatch: {
        url: mcpTokenInfo?.mcpHttpUrl || MCP_HTTP_URL,
        headers: {
          Authorization: `Bearer ${mcpTokenInfo?.token ? mcpTokenInfo.token.slice(0, 24) + '...' : 'dsp_mcp_<GENERATE_ABOVE>'}`,
        },
      },
    },
  }, null, 2), [mcpTokenInfo]);

  const stdioCopy = useMemo(() => JSON.stringify({
    mcpServers: {
      dispatch: {
        command: 'dispatch-mcp',
        env: {
          DISPATCH_SERVER_URL: mcpTokenInfo?.serverUrl || MCP_SERVER_URL,
          DISPATCH_MCP_TOKEN: mcpTokenInfo?.token || '<YOUR_MCP_TOKEN>',
        },
      },
    },
  }, null, 2), [mcpTokenInfo]);

  const stdioSnippet = useMemo(() => JSON.stringify({
    mcpServers: {
      dispatch: {
        command: 'dispatch-mcp',
        env: {
          DISPATCH_SERVER_URL: mcpTokenInfo?.serverUrl || MCP_SERVER_URL,
          DISPATCH_MCP_TOKEN: mcpTokenInfo?.token ? mcpTokenInfo.token.slice(0, 24) + '...' : 'dsp_mcp_<GENERATE_ABOVE>',
        },
      },
    },
  }, null, 2), [mcpTokenInfo]);

  const handleGenerateMCPToken = async () => {
    setMcpLoading(true);
    setMcpError(null);
    try {
      const res = await aiService.generateMCPToken(30);
      setMcpTokenInfo(res);
    } catch (err: any) {
      setMcpError(err.message || (isFrench ? 'Échec de la génération du jeton MCP' : 'Failed to generate MCP access token'));
    } finally {
      setMcpLoading(false);
    }
  };

  const handleCopyMCPText = (key: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setMcpCopiedKey(key);
    scheduleReset(() => setMcpCopiedKey(null), 2500);
  };

  return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-lg shadow-md">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>{isFrench ? 'Serveur MCP Dispatch (Cursor · Gemini · Codex)' : 'Dispatch MCP Server (Cursor · Gemini · Codex)'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  JSON-RPC 2.0 · RBAC Enforced
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isFrench
                  ? 'Interrogez et gérez les opérations de régulation depuis Cursor, Gemini CLI ou Codex avec contrôle des droits côté API.'
                  : 'Query and manage dispatch operations directly from Cursor, Gemini CLI, or Codex with strict API-side role permissions.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateMCPToken}
            disabled={mcpLoading}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white shadow-sm transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>
              {mcpLoading
                ? (isFrench ? 'Génération...' : 'Generating...')
                : mcpTokenInfo
                ? (isFrench ? 'Régénérer le jeton MCP (30j)' : 'Rotate MCP Token (30d)')
                : (isFrench ? 'Générer mon jeton MCP (30j)' : 'Generate My MCP Token (30d)')}
            </span>
          </button>
        </div>

        {mcpError && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{mcpError}</span>
          </div>
        )}

        {mcpTokenInfo && (
          <div className="p-4 bg-slate-950 rounded-xl border border-cyan-500/30 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-cyan-300 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  {isFrench ? 'Jeton personnel actif pour' : 'Personal Access Token issued for'}{' '}
                  <strong className="text-white">{mcpTokenInfo.user.email}</strong> (Role:{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300">{mcpTokenInfo.user.role}</code>)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {isFrench ? 'Expire le' : 'Expires'}: {new Date(mcpTokenInfo.expiresAt).toLocaleDateString()}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={mcpTokenInfo.token}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopyMCPText('token', mcpTokenInfo.token)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700"
              >
                {mcpCopiedKey === 'token' ? (isFrench ? 'Copié ✓' : 'Copied ✓') : (isFrench ? 'Copier le jeton' : 'Copy Token')}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-cyan-300">
                1. Cursor / Gemini / Antigravity (Streamable HTTP)
              </span>
              <button
                type="button"
                onClick={() => handleCopyMCPText('http', httpCopy)}
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] border border-slate-800"
              >
                {mcpCopiedKey === 'http' ? 'Copied ✓' : 'Copy JSON'}
              </button>
            </div>
            <pre className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 text-[10px] font-mono text-slate-300 overflow-x-auto">
{httpSnippet}
            </pre>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-300">
                2. Codex / Claude Code (Stdio CLI Bridge)
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopyMCPText(
                    'stdio',
                    stdioCopy
                  )
                }
                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] border border-slate-800"
              >
                {mcpCopiedKey === 'stdio' ? 'Copied ✓' : 'Copy JSON'}
              </button>
            </div>
            <pre className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 text-[10px] font-mono text-slate-300 overflow-x-auto">
{stdioSnippet}
            </pre>
          </div>
        </div>
      </div>
  );
});
