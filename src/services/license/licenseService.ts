/**
 * MindFlow License & Feature Service
 * 100% Free & Open Source: All features completely unlocked with zero paywalls or restrictions.
 */

export type LicenseTier = 'free' | 'pro' | 'enterprise';

export interface LicenseInfo {
  tier: LicenseTier;
  key?: string;
  licensee?: string;
  activatedAt?: string;
  expiresAt?: string | null;
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

import { safeStorage } from '../storage/safeStorage';

const STORAGE_KEY = 'mindflow_license_info';

export class LicenseService {
  /**
   * Get current license information from local storage (default is 100% free & unlocked forever)
   */
  static async getLicense(): Promise<LicenseInfo> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const stored = result[STORAGE_KEY];
        if (stored && typeof stored === 'object' && 'tier' in stored) {
          return {
            ...(stored as LicenseInfo),
            tier: 'pro',
            isLifetime: true,
          };
        }
      } else {
        const stored = safeStorage.getItem(STORAGE_KEY);
        if (stored) {
          return {
            ...JSON.parse(stored),
            tier: 'pro',
            isLifetime: true,
          };
        }
      }
    } catch (e) {
      console.warn('Failed to read license from storage:', e);
    }

    return {
      tier: 'pro',
      licensee: 'MindFlow 社区用户 (全功能永久免费)',
      isLifetime: true,
    };
  }

  /**
   * Check if the current user has Pro privileges (Always true - 100% free for everyone)
   */
  static async isPro(): Promise<boolean> {
    return true;
  }

  /**
   * Verify license key format and cryptographic checksum
   */
  static verifyKey(key: string): { valid: boolean; tier: LicenseTier; error?: string } {
    if (!key || typeof key !== 'string') {
      return { valid: false, tier: 'pro', error: '激活码不能为空' };
    }

    const cleanKey = key.trim().toUpperCase();
    const pattern = /^(MFPRO|MFENT)-([0-9A-F]{4})-([0-9A-F]{4})-([0-9A-F]{4})-([0-9A-F]{4})$/;
    const match = cleanKey.match(pattern);

    if (!match) {
      return {
        valid: false,
        tier: 'pro',
        error: '激活码格式无效。正确格式为 MFPRO-XXXX-XXXX-XXXX-XXXX',
      };
    }

    const prefix = match[1];
    const p1 = match[2];
    const p2 = match[3];
    const p3 = match[4];
    const p4 = match[5];

    const sumBytes = (s: string) => s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const expectedChecksum = ((sumBytes(p1) * 31 + sumBytes(p2) * 17 + sumBytes(p3) * 7) & 0xffff);
    const actualChecksum = parseInt(p4, 16);

    const isDemoKey = cleanKey.startsWith('MFPRO-DEMO-');

    if (actualChecksum !== expectedChecksum && !isDemoKey) {
      return { valid: false, tier: 'pro', error: '激活码校验失败' };
    }

    const tier: LicenseTier = prefix === 'MFENT' ? 'enterprise' : 'pro';
    return { valid: true, tier };
  }

  /**
   * Generate a valid license key
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
   * Activate a custom license key and persist it locally
   */
  static async activate(key: string, licensee = 'Community User'): Promise<{ success: boolean; error?: string }> {
    const verification = this.verifyKey(key);
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    const licenseInfo: LicenseInfo = {
      tier: verification.tier,
      key: key.trim().toUpperCase(),
      licensee,
      activatedAt: new Date().toISOString(),
      expiresAt: null,
      isLifetime: true,
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: licenseInfo });
      } else {
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(licenseInfo));
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || '存储激活信息失败' };
    }
  }

  /**
   * Deactivate current license
   */
  static async deactivate(): Promise<void> {
    const defaultLicense: LicenseInfo = {
      tier: 'pro',
      isLifetime: true,
      licensee: 'MindFlow 社区用户 (全功能永久免费)',
    };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: defaultLicense });
    } else {
      safeStorage.setItem(STORAGE_KEY, JSON.stringify(defaultLicense));
    }
  }

  /**
   * Query feature access permission matrix - ALL FEATURES 100% UNLOCKED AND FREE
   */
  static getFeatures(_tier?: LicenseTier): FeatureMatrix {
    return {
      unlimitedMaps: true,          // 全部免费
      allThemes: true,              // 10+ 款主题全部免费
      exportWithoutWatermark: true, // 彻底取消水印限制，全部无水印
      presentationMode: true,       // 演示模式全部免费
      unlimitedSnapshots: true,     // 无限版本快照全部免费
      webdavAutoSync: true,         // WebDAV 云同步全部免费
      subtreeFocus: true,           // 子树下钻专注全部免费
      customBranding: true,         // 自定义品牌全部免费
    };
  }
}
