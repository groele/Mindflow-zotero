import { MAX_BACKUP_BYTES } from '../storage/backupService';

/** Deadline covers both response headers and streamed directory/backup bodies. */
export async function requestWebDAV(url: string, init: RequestInit,
  options: { timeoutMs?: number; maxBytes?: number } = {}): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init.signal;
  const abortError = () => { const error = new Error('The operation was aborted.'); error.name = 'AbortError'; return error; };
  if (callerSignal?.aborted) throw abortError();
  let rejectCancellation: ((reason: Error) => void) | undefined;
  const cancellation = callerSignal ? new Promise<never>((_, reject) => { rejectCancellation = reject; }) : null;
  const relayCallerAbort = () => {
    controller.abort();
    rejectCancellation?.(abortError());
  };
  callerSignal?.addEventListener('abort', relayCallerAbort, { once: true });
  const timeoutMs = options.timeoutMs ?? 30000;
  const maxBytes = options.maxBytes ?? MAX_BACKUP_BYTES;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('WebDAV 请求超时，请检查服务器连接后重试'));
      controller.abort();
    }, timeoutMs);
  });
  const operation = (async () => {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok || response.status === 204 || response.status === 205 || !['GET', 'PROPFIND'].includes(init.method || 'GET')) return response;
    if (Number(response.headers.get('content-length') || 0) > maxBytes) {
      controller.abort();
      throw new Error('WebDAV 响应超过安全读取上限');
    }
    const reader = response.body?.getReader();
    let text = '';
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > maxBytes) {
            controller.abort();
            void reader.cancel().catch(() => undefined);
            throw new Error('WebDAV 响应超过安全读取上限');
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
    } else {
      text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('WebDAV 响应超过安全读取上限');
    }
    return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  })();
  try { return await Promise.race(cancellation ? [operation, timeout, cancellation] : [operation, timeout]); }
  finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', relayCallerAbort);
  }
}
