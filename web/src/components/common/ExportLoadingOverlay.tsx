import React from 'react';

export const ExportLoadingOverlay: React.FC = () => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 text-sm text-white">
    Preparing export...
  </div>
);
