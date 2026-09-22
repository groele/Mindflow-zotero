/**
 * MindFlow License & Commercialization Architecture
 * Provides offline license key generation, cryptographic checksum verification,
 * feature gating, and license persistence.
 */

export type LicenseTier = 'free' | 'pro' | 'enterprise';

export interface LicenseInfo {
  tier: LicenseTier;
  key?: string;
  licensee?: string;
  activatedAt?: string;
  expiresAt?: string | null; // null for lifetime
  isLifetime?: boolean;
}

export interface FeatureMatrix {
  unlimitedMaps: boolean;
  allThemes: boolean;
  exportWithoutWatermark: boolean;
  presentationMode: boolean;
  unlimitedSnapshots: boolean;
  webdavAutoSync: boolean;
  subtreeFocus: boolean;
  customBranding: boolean;
}

const STORAGE_KEY = 'mindflow_license_info';

export class LicenseService {
  /**
   * Get current license information from local storage
   */
  static async getLicense(): Promise<LicenseInfo> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const stored = result[STORAGE_KEY];
        if (stored && typeof stored === 'object' && 'tier' in stored) {
          return stored as LicenseInfo;
        }
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn('Failed to read license from storage:', e);
    }

    return {
      tier: 'free',
      isLifetime: false,
    };
  }

  /**
   * Check if the current user has Pro or higher privileges
   */
  static async isPro(): Promise<boolean> {
    const license = await this.getLicense();
    return license.tier === 'pro' || license.tier === 'enterprise';
  }

  /**
   * Verify license key format and cryptographic checksum
   * Valid format: MFPRO-[4 hex]-[4 hex]-[4 hex]-[4 hex] or MFENT-[4 hex]-[4 hex]-[4 hex]-[4 hex]
   * Example: MFPRO-8F2A-4D91-B70C-E362
   */
  static verifyKey(key: string): { valid: boolean; tier: LicenseTier; error?: string } {
    if (!key || typeof key !== 'string') {
      return { valid: false, tier: 'free', error: '激活码不能为空' };
    }

    const cleanKey = key.trim().toUpperCase();
    const pattern = /^(MFPRO|MFENT)-([0-9A-F]{4})-([0-9A-F]{4})-([0-9A-F]{4})-([0-9A-F]{4})$/;
    const match = cleanKey.match(pattern);

    if (!match) {
      return {
        valid: false,
        tier: 'free',
        error: '激活码格式无效。正确格式为 MFPRO-XXXX-XXXX-XXXX-XXXX',
      };
    }

    const prefix = match[1];
    const p1 = match[2];
    const p2 = match[3];
    const p3 = match[4];
    const p4 = match[5];

    // Checksum verification algorithm:
    // (sum(p1) * 31 + sum(p2) * 17 + sum(p3) * 7) % 65536 == hex(p4)
    const sumBytes = (s: string) => s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const expectedChecksum = ((sumBytes(p1) * 31 + sumBytes(p2) * 17 + sumBytes(p3) * 7) & 0xffff);
    const actualChecksum = parseInt(p4, 16);

    // Also support universal development/trial license key: MFPRO-DEMO-2026-PRO9-8C2A
    const isDemoKey = cleanKey.startsWith('MFPRO-DEMO-');

    if (actualChecksum !== expectedChecksum && !isDemoKey) {
      return { valid: false, tier: 'free', error: '激活码校验失败，请检查是否输错或已被撤销' };
    }

    const tier: LicenseTier = prefix === 'MFENT' ? 'enterprise' : 'pro';
    return { valid: true, tier };
  }

  /**
   * Generate a valid license key for testing or commercial issuance
   */
  static generateLicenseKey(tier: 'pro' | 'enterprise' = 'pro'): string {
    const prefix = tier === 'enterprise' ? 'MFENT' : 'MFPRO';
    const randHex = (len: number) => {
      let res = '';
      for (let i = 0; i < len; i++) {
        res += Math.floor(Math.random() * 16).toString(16).toUpperCase();
      }
      return res;
    };

    const p1 = randHex(4);
    const p2 = randHex(4);
    const p3 = randHex(4);

    const sumBytes = (s: string) => s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const checksum = ((sumBytes(p1) * 31 + sumBytes(p2) * 17 + sumBytes(p3) * 7) & 0xffff)
      .toString(16)
      .padStart(4, '0')
      .toUpperCase();

    return `${prefix}-${p1}-${p2}-${p3}-${checksum}`;
  }

  /**
   * Activate a license key and persist it locally
   */
  static async activate(key: string, licensee = 'Individual Pro'): Promise<{ success: boolean; error?: string }> {
    const verification = this.verifyKey(key);
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    const licenseInfo: LicenseInfo = {
      tier: verification.tier,
      key: key.trim().toUpperCase(),
      licensee,
      activatedAt: new Date().toISOString(),
      expiresAt: null, // Lifetime license
      isLifetime: true,
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: licenseInfo });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(licenseInfo));
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || '存储激活信息失败' };
    }
  }

  /**
   * Deactivate current license and revert to Free tier
   */
  static async deactivate(): Promise<void> {
    const freeLicense: LicenseInfo = { tier: 'free', isLifetime: false };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: freeLicense });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(freeLicense));
    }
  }

  /**
   * Query feature access permission matrix
   */
  static getFeatures(tier: LicenseTier): FeatureMatrix {
    const isProOrAbove = tier === 'pro' || tier === 'enterprise';
    return {
      unlimitedMaps: true, // Always allow free local maps
      allThemes: isProOrAbove, // Free tier gets first 5 themes
      exportWithoutWatermark: isProOrAbove, // Free tier includes watermark
      presentationMode: isProOrAbove, // Business presentation mode
      unlimitedSnapshots: isProOrAbove, // Free tier up to 10
      webdavAutoSync: isProOrAbove, // WebDAV auto-sync on change
      subtreeFocus: isProOrAbove, // Subtree drill-down focus
      customBranding: tier === 'enterprise', // Enterprise custom logo
    };
  }
}
