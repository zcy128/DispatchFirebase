import { memo } from 'react';
import {
  Cloud,
  Database
} from 'lucide-react';

export const PlatformInfoSections = memo(function PlatformInfoSections() {
  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Firestore Master Database Architecture</h2>
            <p className="text-xs text-slate-400">
              Employee records are stored in the Firestore <code>employees</code> collection.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-amber-400 block font-bold">Collection: employees</span>
              <span className="text-slate-400 mt-1 block">
                Stores FullName, EmployeeNumber, JobPosition, Phones, Emails, YardId, Address, DriverLicense, Contacts, Photo
              </span>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <span className="text-emerald-400 block font-bold">Driver License Sub-Entity</span>
              <span className="text-slate-400 mt-1 block">
                LicenseID, ExpirationDate, LicenseClass (Class B / Z Air Brake), Conditions, MVID
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Cloud Run Go API Deployment Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-800 pb-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Google Cloud Run Deployment</h2>
            <p className="text-xs text-slate-400">Containerized Go microservice configuration</p>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Cloud Run access is managed outside this screen. This page does not change who can call the API.
        </p>
      </div>
    </>
  );
});
