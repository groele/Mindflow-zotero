/** Only navigable web/mail/zotero links are rendered as external links. */
export function safeExternalUrl(input: string | undefined): string | null {
  if (!input) return null;
  try {
    const trimmed = input.trim();
    if (trimmed.startsWith('zotero://')) return trimmed;
    const url = new URL(trimmed);
    return ['https:', 'http:', 'mailto:', 'zotero:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

