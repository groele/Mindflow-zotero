import { WebDAVConfig } from '../../core/model/settingsTypes';
import { WorkspaceBackupData } from '../storage/backupService';

export interface WebDAVSyncResult {
  success: boolean;
  message: string;
  statusCode?: number;
}

export class WebDAVService {
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
    let cleanServer = (serverUrl || '').trim();
    if (!cleanServer.startsWith('http://') && !cleanServer.startsWith('https://')) {
      cleanServer = 'https://' + cleanServer;
    }
    if (!cleanServer.endsWith('/')) {
      cleanServer += '/';
    }

    let cleanPath = (path || '').trim();
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }

    return cleanServer + cleanPath;
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
    if (!config.serverUrl || !config.username) {
      return { success: false, message: '请先配置 WebDAV 服务器及账户信息' };
    }

    // Try to ensure folder exists
    await this.ensureRemoteFolder(config);

    const fileName = 'mindflow-workspace-backup.json';
    const remotePath = (config.basePath || '/').replace(/\/+$/, '') + '/' + fileName;
    const targetUrl = this.buildUrl(config.serverUrl, remotePath);
    const auth = this.getAuthHeader(config);

    const payload = JSON.stringify(backupData, null, 2);

    try {
      const response = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: payload,
      });

      if (response.status === 200 || response.status === 201 || response.status === 204) {
        return {
          success: true,
          message: `已成功将全部工作区 (${backupData.documents.length} 个导图) 备份至云端 ${remotePath}`,
          statusCode: response.status,
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
    config: WebDAVConfig
  ): Promise<{ success: boolean; data?: WorkspaceBackupData; message: string; statusCode?: number }> {
    if (!config.serverUrl || !config.username) {
      return { success: false, message: '请先配置 WebDAV 服务器及账户信息' };
    }

    const fileName = 'mindflow-workspace-backup.json';
    const remotePath = (config.basePath || '/').replace(/\/+$/, '') + '/' + fileName;
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

      const raw = await response.text();
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
