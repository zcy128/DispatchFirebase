import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  OperatingProvince,
  ProvinceComplianceConfig,
  ONTARIO_COMPLIANCE_DEFAULTS
} from '../types/compliance';
import { ComplianceSettingsService } from '../services/complianceSettingsService';

interface ComplianceContextType {
  province: OperatingProvince;
  config: ProvinceComplianceConfig;
  isOntario: boolean;
  isQuebec: boolean;
  loading: boolean;
  setProvince: (newProvince: OperatingProvince) => Promise<void>;
  updateConfig: (patch: Partial<ProvinceComplianceConfig>) => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const ComplianceContext = createContext<ComplianceContextType | undefined>(undefined);

export const ComplianceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ProvinceComplianceConfig>(ONTARIO_COMPLIANCE_DEFAULTS);
  const [loading, setLoading] = useState<boolean>(true);
  const configRef = useRef(config);
  configRef.current = config;

  const refreshConfig = useCallback(async () => {
    try {
      const cfg = await ComplianceSettingsService.getConfig();
      setConfig(cfg);
    } catch (err) {
      console.error('Failed to load compliance configuration:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshConfig();
    const unsub = ComplianceSettingsService.subscribe((updated) => {
      setConfig(updated);
    });
    return () => unsub();
  }, [refreshConfig]);

  const setProvince = useCallback(async (newProvince: OperatingProvince) => {
    setLoading(true);
    try {
      const updated = await ComplianceSettingsService.switchProvince(newProvince);
      setConfig(updated);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (patch: Partial<ProvinceComplianceConfig>) => {
    setLoading(true);
    try {
      const updated = await ComplianceSettingsService.saveConfig({
        ...configRef.current,
        ...patch,
      });
      setConfig(updated);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<ComplianceContextType>(() => ({
    province: config.province,
    config,
    isOntario: config.province === 'ON',
    isQuebec: config.province === 'QC',
    loading,
    setProvince,
    updateConfig,
    refreshConfig,
  }), [config, loading, refreshConfig, setProvince, updateConfig]);

  return (
    <ComplianceContext.Provider value={value}>
      {children}
    </ComplianceContext.Provider>
  );
};

export const useCompliance = (): ComplianceContextType => {
  const context = useContext(ComplianceContext);
  if (!context) {
    throw new Error('useCompliance must be used within a ComplianceProvider');
  }
  return context;
};
