import { WebDAVConfig } from '../../core/model/settingsTypes';
import { MAX_BACKUP_BYTES, WorkspaceBackupData } from '../storage/backupService';

export interface WebDAVSyncResult {
  success: boolean;
  message: string;
  statusCode?: number;
}

export interface RemoteBackupVersion {
  fileName: string;
  createdAt: number;
}

const LATEST_BACKUP = 'mindflow-workspace-backup.json';
const VERSIONED_BACKUP = /^mindflow-workspace-\d{8}T\d{6}Z-[a-f0-9]{8}\.json$/;

export class WebDAVService {
  private static uploadQueue: Promise<unknown> = Promise.resolve();

  private static backupPath(config: WebDAVConfig, fileName: string): string {
    return (config.basePath || '/').replace(/\/+$/, '') + '/' + fileName;
  }

  public static async listBackupVersions(config: WebDAVConfig): Promise<RemoteBackupVersion[]> {
    const folderUrl = this.buildUrl(config.serverUrl, (config.basePath || '/').replace(/\/?$/, '/'));
    const response = await fetch(folderUrl, {
      method: 'PROPFIND',
      headers: { Authorization: this.getAuthHeader(config), Depth: '1' },
    });
    if (response.status !== 207 && response.status !== 200) {
      throw new Error(`无法列出云端历史版本 (HTTP ${response.status})`);
    }
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error('云端目录响应不是有效 XML');
    const hrefs = Array.from(xml.getElementsByTagName('*')).filter((element) => element.localName === 'href');
    const versions: RemoteBackupVersion[] = [];
    for (const href of hrefs) {
      try {
        const url = new URL(href.textContent || '', folderUrl);
        if (url.origin !== new URL(folderUrl).origin) continue;
        const name = decodeURIComponent(url.pathname.split('/').pop() || '');
        if (!VERSIONED_BACKUP.test(name) || url.toString() !== this.buildUrl(config.serverUrl, this.backupPath(config, name))) continue;
        const stamp = name.slice('mindflow-workspace-'.length, 'mindflow-workspace-'.length + 16);
        const iso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`;
        versions.push({ fileName: name, createdAt: Date.parse(iso) });
      } catch { /* Ignore unrelated DAV resources. */ }
    }
    return versions.sort((a, b) => b.createdAt - a.createdAt);
  }
  /** Ask only for the configured HTTPS origin, and only from a user action. */
  public static async requestServerPermission(serverUrl: string): Promise<boolean> {
    const url = this.parseSecureServerUrl(serverUrl);
    if (typeof chrome === 'undefined' || !chrome.permissions) return true;

    try {
      return await chrome.permissions.request({ origins: [`${url.origin}/*`] });
    } catch {
      return false;
    }
  }

  public static async hasServerPermission(serverUrl: string): Promise<boolean> {
    const url = this.parseSecureServerUrl(serverUrl);
    if (typeof chrome === 'undefined' || !chrome.permissions) return true;
    return chrome.permissions.contains({ origins: [`${url.origin}/*`] });
  }

  private static parseSecureServerUrl(serverUrl: string): URL {
    const input = (serverUrl || '').trim();
    const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(normalized);
    if (url.protocol !== 'https:') {
      throw new Error('WebDAV 仅允许 HTTPS 连接，避免账户密码通过明文 HTTP 传输。');
    }
    if (url.username || url.password) {
      throw new Error('请将 WebDAV 用户名和密码填写在账户字段中，不要放进服务器地址。');
    }
    if (url.search || url.hash) throw new Error('服务器地址请填写到路径为止，不要包含查询参数或片段。');
    return url;
  }

  /**
   * Helper to encode Basic Auth credentials safely for UTF-8 characters
   */
  public static getAuthHeader(config: WebDAVConfig): string {
    const raw = `${config.username}:${config.password}`;
    try {
      return 'Basic ' + btoa(unescape(encodeURIComponent(raw)));
    } catch {
      return 'Basic ' + btoa(raw);
    }
  }

  /**
   * Normalize base server URL and remote relative path into an absolute URI
   */
  public static buildUrl(serverUrl: string, path: string): string {
    const base = this.parseSecureServerUrl(serverUrl);
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    const cleanPath = (path || '').trim().replace(/^\/+/, '');
    if (cleanPath.startsWith('\\') || /^[a-z][a-z0-9+.-]*:/i.test(cleanPath)) {
      throw new Error('WebDAV 目标路径必须位于配置的服务器内。');
    }
    const target = new URL(cleanPath, base);
    if (target.origin !== base.origin) throw new Error('WebDAV 目标路径不能切换到其他服务器。');
    return target.toString();
  }

  /**
   * Test WebDAV connection and credentials
   */
  public static async testConnection(config: WebDAVConfig): Promise<WebDAVSyncResult> {
    if (!config.serverUrl) {
      return { success: false, message: '请填写 WebDAV 服务器地址' };
    }
    if (!config.username) {
      return { success: false, message: '请填写 WebDAV 用户名' };
    }

    try {
      this.parseSecureServerUrl(config.serverUrl);
    } catch (err: any) {
      return { success: false, message: err.message || 'WebDAV 地址无效' };
    }

    const testUrl = this.buildUrl(config.serverUrl, config.basePath || '');
    const auth = this.getAuthHeader(config);

    try {
      // 1. First attempt PROPFIND with Depth: 0
      let response = await fetch(testUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: auth,
          Depth: '0',
          'Content-Type': 'application/xml; charset=utf-8',
        },
      });

      // If method not allowed, try OPTIONS
      if (response.status === 405) {
        response = await fetch(testUrl, {
          method: 'OPTIONS',
          headers: { Authorization: auth },
        });
      }

      if (response.status === 200 || response.status === 207 || response.status === 204) {
        return {
          success: true,
          message: '连接成功！服务器状态正常，身份凭证有效。',
          statusCode: response.status,
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          message: '鉴权失败 (401)：用户名或密码/授权令牌不正确。如使用坚果云，请使用应用专属授权密码。',
          statusCode: 401,
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          message: '权限受限 (403)：当前账户无权访问该 WebDAV 路径。',
          statusCode: 403,
        };
      }

      if (response.status === 404) {
        return {
          success: false,
          message: '路径不存在 (404)：指定的同步目录在云端不存在，同步时将自动尝试创建。',
          statusCode: 404,
        };
      }

      return {
        success: false,
        message: `服务器响应异常 (HTTP ${response.status})：${response.statusText || '未知状态'}`,
        statusCode: response.status,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `网络连接失败：${err.message || '无法访问该地址，请检查网络或是否需要跨域权限'}`,
      };
    }
  }

  /**
   * Attempt to create the remote folder via MKCOL
   */
  public static async ensureRemoteFolder(config: WebDAVConfig): Promise<boolean> {
    if (!config.basePath || config.basePath === '/' || config.basePath === '') {
      return true;
    }

    const folderUrl = this.buildUrl(config.serverUrl, config.basePath);
    const auth = this.getAuthHeader(config);

    try {
      const res = await fetch(folderUrl, {
        method: 'MKCOL',
        headers: { Authorization: auth },
      });
      return res.status === 201 || res.status === 200 || res.status === 405; // 405 usually means already exists
    } catch {
      return false;
    }
  }

  /**
   * Upload whole workspace backup JSON to WebDAV
   */
  public static async uploadBackup(
    config: WebDAVConfig,
    backupData: WorkspaceBackupData
  ): Promise<WebDAVSyncResult> {
    const operation = this.uploadQueue.then(() => this.uploadBackupNow(config, backupData));
    this.uploadQueue = operation.catch(() => undefined);
    return operation;
  }

  private static async uploadBackupNow(config: WebDAVConfig, backupData: WorkspaceBackupData): Promise<WebDAVSyncResult> {
    if (!config.serverUrl || !config.username) {
      return { success: false, message: '请先配置 WebDAV 服务器及账户信息' };
    }

    try {
      this.parseSecureServerUrl(config.serverUrl);
    } catch (err: any) {
      return { success: false, message: err.message || 'WebDAV 地址无效' };
    }

    // Try to ensure folder exists
    await this.ensureRemoteFolder(config);

    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(4)), value => value.toString(16).padStart(2, '0')).join('');
    const fileName = `mindflow-workspace-${stamp}-${nonce}.json`;
    const remotePath = this.backupPath(config, fileName);
    const auth = this.getAuthHeader(config);

    const payload = JSON.stringify(backupData, null, 2);
    if (new TextEncoder().encode(payload).byteLength > MAX_BACKUP_BYTES) {
      return { success: false, message: '工作区超过 20 MB，云端备份无法按当前安全导入上限恢复。请先导出本地备份并整理数据。' };
    }

    try {
      const headers = { Authorization: auth, 'Content-Type': 'application/json; charset=utf-8' };
      const response = await fetch(this.buildUrl(config.serverUrl, remotePath), {
        method: 'PUT',
        headers,
        body: payload,
      });

      if (response.status === 200 || response.status === 201 || response.status === 204) {
        const latest = await fetch(this.buildUrl(config.serverUrl, this.backupPath(config, LATEST_BACKUP)), {
          method: 'PUT', headers, body: payload,
        });
        if (!latest.ok) {
          return { success: false, message: `历史版本 ${fileName} 已保存，但最新备份入口更新失败 (HTTP ${latest.status})。可从历史版本恢复。`, statusCode: latest.status };
        }
        return {
          success: true,
          message: `已备份 ${backupData.documents.length} 个导图；历史版本 ${fileName} 已保留。`,
          statusCode: latest.status,
        };
      }

      if (response.status === 401) {
        return { success: false, message: '备份失败：用户名或应用密码鉴权错误 (401)', statusCode: 401 };
      }

      return {
        success: false,
        message: `备份上传失败 (HTTP ${response.status})：${response.statusText}`,
        statusCode: response.status,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `网络错误导致备份失败：${err.message || '请检查服务器连接'}`,
      };
    }
  }

  /**
   * Download workspace backup from WebDAV
   */
  public static async downloadBackup(
    config: WebDAVConfig,
    fileName: string = LATEST_BACKUP
  ): Promise<{ success: boolean; data?: WorkspaceBackupData; message: string; statusCode?: number }> {
    if (!config.serverUrl || !config.username) {
      return { success: false, message: '请先配置 WebDAV 服务器及账户信息' };
    }

    try {
      this.parseSecureServerUrl(config.serverUrl);
    } catch (err: any) {
      return { success: false, message: err.message || 'WebDAV 地址无效' };
    }

    if (fileName !== LATEST_BACKUP && !VERSIONED_BACKUP.test(fileName)) {
      return { success: false, message: '云端历史版本文件名无效' };
    }
    const remotePath = this.backupPath(config, fileName);
    const targetUrl = this.buildUrl(config.serverUrl, remotePath);
    const auth = this.getAuthHeader(config);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Authorization: auth,
        },
      });

      if (response.status === 404) {
        return {
          success: false,
          message: `云端未找到备份文件 (${remotePath})，请确认是否已在云端进行过备份上传。`,
          statusCode: 404,
        };
      }

      if (response.status === 401) {
        return {
          success: false,
          message: '下载失败：用户名或应用密码鉴权错误 (401)',
          statusCode: 401,
        };
      }

      if (!response.ok) {
        return {
          success: false,
          message: `下载失败 (HTTP ${response.status})：${response.statusText}`,
          statusCode: response.status,
        };
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > MAX_BACKUP_BYTES) {
        return { success: false, message: '云端备份超过 20 MB 安全导入上限。', statusCode: response.status };
      }

      const raw = await response.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) {
        return { success: false, message: '云端备份超过 20 MB 安全导入上限。', statusCode: response.status };
      }
      const parsed = JSON.parse(raw);

      if (!parsed || !parsed.documents || !Array.isArray(parsed.documents)) {
        return {
          success: false,
          message: '云端文件不是有效的 MindFlow 工作区备份格式',
        };
      }

      return {
        success: true,
        data: parsed as WorkspaceBackupData,
        message: `成功拉取云端备份：包含 ${parsed.documents.length} 篇导图与 ${(parsed.snapshots || []).length} 个快照。`,
        statusCode: response.status,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `读取云端备份失败：${err.message || '网络异常或 JSON 解析失败'}`,
      };
    }
  }
}
