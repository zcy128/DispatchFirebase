import { db } from './firebase';
import {
  OperatingProvince,
  ProvinceComplianceConfig,
  ONTARIO_COMPLIANCE_DEFAULTS,
  QUEBEC_COMPLIANCE_DEFAULTS
} from '../types/compliance';

const STORAGE_KEY = 'dispatch_compliance_settings';
const FIRESTORE_DOC_PATH = 'compliance';

type Listener = (config: ProvinceComplianceConfig) => void;
const listeners = new Set<Listener>();

export const ComplianceSettingsService = {
  getDefaultsForProvince: (province: OperatingProvince): ProvinceComplianceConfig => {
    return province === 'QC' ? { ...QUEBEC_COMPLIANCE_DEFAULTS } : { ...ONTARIO_COMPLIANCE_DEFAULTS };
  },

  getConfig: async (): Promise<ProvinceComplianceConfig> => {
    // 1. Try Firestore if online
    if (db) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'system_settings', FIRESTORE_DOC_PATH);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const remoteData = snap.data() as Partial<ProvinceComplianceConfig>;
          const prov = (remoteData.province === 'QC' ? 'QC' : 'ON') as OperatingProvince;
          const defaults = prov === 'QC' ? QUEBEC_COMPLIANCE_DEFAULTS : ONTARIO_COMPLIANCE_DEFAULTS;
          const merged: ProvinceComplianceConfig = {
            ...defaults,
            ...remoteData,
            province: prov
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // ignore
          }
          return merged;
        }
      } catch (err) {
        console.warn('[ComplianceSettingsService] Firestore fetch error, fallback to local:', err);
      }
    }

    // 2. Try localStorage fallback
    try {
      const localStr = localStorage.getItem(STORAGE_KEY);
      if (localStr) {
        const parsed = JSON.parse(localStr) as Partial<ProvinceComplianceConfig>;
        const prov = (parsed.province === 'QC' ? 'QC' : 'ON') as OperatingProvince;
        const defaults = prov === 'QC' ? QUEBEC_COMPLIANCE_DEFAULTS : ONTARIO_COMPLIANCE_DEFAULTS;
        return {
          ...defaults,
          ...parsed,
          province: prov
        };
      }
    } catch {
      // ignore
    }

    // 3. Fallback to default Ontario
    return { ...ONTARIO_COMPLIANCE_DEFAULTS };
  },

  saveConfig: async (config: Partial<ProvinceComplianceConfig>): Promise<ProvinceComplianceConfig> => {
    const province = (config.province === 'QC' ? 'QC' : 'ON') as OperatingProvince;
    const defaults = province === 'QC' ? QUEBEC_COMPLIANCE_DEFAULTS : ONTARIO_COMPLIANCE_DEFAULTS;
    
    const merged: ProvinceComplianceConfig = {
      ...defaults,
      ...config,
      province,
      advancePreInspectionDays: Math.max(7, Math.min(60, Number(config.advancePreInspectionDays) || 21)),
      retentionYears: Math.max(1, Math.min(7, Number(config.retentionYears) || 2)),
      updatedAt: new Date().toISOString()
    };

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }

    // Notify local listeners
    listeners.forEach((listener) => {
      try {
        listener(merged);
      } catch (err) {
        console.error('Error notifying compliance config listener:', err);
      }
    });

    // Save to Firestore
    if (db) {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'system_settings', FIRESTORE_DOC_PATH);
        await setDoc(docRef, merged, { merge: true });
      } catch (err) {
        console.warn('[ComplianceSettingsService] Firestore save error:', err);
      }
    }

    return merged;
  },

  switchProvince: async (newProvince: OperatingProvince): Promise<ProvinceComplianceConfig> => {
    const defaults = ComplianceSettingsService.getDefaultsForProvince(newProvince);
    return ComplianceSettingsService.saveConfig(defaults);
  },

  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
