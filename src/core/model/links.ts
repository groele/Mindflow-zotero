/** Only navigable web/mail links are rendered as external links. */
export function safeExternalUrl(input: string | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input.trim());
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
