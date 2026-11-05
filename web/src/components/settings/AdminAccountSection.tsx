import React, { memo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import {
  AlertCircle,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

export const AdminAccountSection = memo(function AdminAccountSection() {
  const { currentUser, isMockMode } = useAuth();
  const { isFrench } = useI18n();
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [provisionStatus, setProvisionStatus] = useState<string | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSetupAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = adminEmail.trim();
    const password = adminPassword.trim();
    setProvisionStatus(null);
    setProvisionError(null);
    if (!email || !email.includes('@') || !password) {
      setProvisionError(isFrench
        ? 'Le courriel et le mot de passe administrateur sont requis.'
        : 'Admin email and password are required.');
      return;
    }
    setLoading(true);
    try {
      const { EmployeeService } = await import('../../services/employeeService');
      const res = (await EmployeeService.setupAdmin({
        email,
        password,
        firstName: 'System',
        lastName: 'Admin',
      })) as { message?: string; email?: string; employeeId?: string };
      if (res?.message && /already exists/i.test(res.message)) {
        setProvisionStatus(isFrench
          ? 'Un compte administrateur existe déjà. Aucun nouveau compte n\'a été créé.'
          : 'An administrator account already exists. No new account was created.');
        return;
      }
      const savedEmail = res?.email || email;
      const savedEmployee = res?.employeeId ? ` (${res.employeeId})` : '';
      setProvisionStatus(`Administrator account saved for ${savedEmail}${savedEmployee}.`);
    } catch (err: any) {
      setProvisionError(err.message || (isFrench ? 'Échec de l\'enregistrement du compte administrateur.' : 'Could not save the administrator account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Firebase Auth & Master Admin Account</h2>
            <p className="text-xs text-slate-400">
              Identity passport tied to business employee master record EMP-ADMIN-001
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700 space-y-1">
            <span className="text-slate-400">Current Logged-in Operator:</span>
            <p className="font-bold text-white text-sm">{currentUser?.displayName || currentUser?.email}</p>
            <p className="text-[11px] text-amber-400 font-mono">
              Role: {currentUser?.role} | Master ID: {currentUser?.employeeId}
            </p>
          </div>

          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700 space-y-1">
            <span className="text-slate-400">Environment Mode:</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${isMockMode ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <span className="font-semibold text-white">
                {isMockMode ? 'Local Dev / Demo Simulation' : 'Live Google Cloud Service'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isMockMode
                ? 'Using built-in memory repository with full interactive CRUD support'
                : 'Authenticated via Firebase Admin JWT'}
            </p>
          </div>
        </div>

        {/* Provisioning form */}
        <form onSubmit={handleSetupAdmin} className="pt-2 space-y-3">
          <h3 className="text-xs font-bold text-slate-300">Provision / Reset Admin User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Admin Work Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Admin Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Enter a password"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Registering Admin...' : 'Provision Admin Account'}
            </button>

            {provisionStatus && (
              <span className="text-xs text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>{provisionStatus}</span>
              </span>
            )}
            {provisionError && (
              <span className="text-xs text-rose-400 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{provisionError}</span>
              </span>
            )}
          </div>
        </form>
      </div>
  );
});
