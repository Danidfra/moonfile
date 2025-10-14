import { ROM_MIME_BY_EXT } from './gamePublishConstants';

/**
 * Guess MIME type from filename extension
 */
export function guessMimeFromFilename(filename: string): string | undefined {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return ROM_MIME_BY_EXT[ext];
}

/**
 * Infer platform slug from a ROM MIME.
 * e.g. "application/x-snes-rom" -> "snes-rom"
 *      "application/x-nes-rom"  -> "nes-rom"
 * Se não casar, retorna "html5" (fallback neutro).
 */
export function platformFromMime(mime: string): string {
  const m = /^application\/x-([a-z0-9-]+)$/i.exec(mime);
  return m?.[1] ?? 'html5';
}




/**
 * Convert File to base64 string (without data: URL prefix)
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data: URL prefix if present
      const base64 = result.replace(/^data:.*?;base64,/, '');
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Calculate SHA-256 hash of ArrayBuffer and return as hex string
 */
export async function sha256Hex(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Convert filename to kebab-case for use in d-tag
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .trim();
}

/**
 * Generate deterministic d-tag for game events
 * Format: game:<kebab-title>:<region-lowercase>:v<version>
 */
export function generateDTag(title: string, version: string): string {
  const slug = toKebabCase(title);
  const v = version.trim();
  const vTag = v.toLowerCase().startsWith('v') ? v : `v${v}`;
  return `game:${slug}:${vTag}`;
}

/**
 * Escape value for single-quoted shell arg in nak preview.
 */
function escapeForSingleQuotes(v: string): string {
  return String(v).replace(/'/g, `'\\''`);
}


/**
 * Generate nak command preview for debugging
 */
export function generateNakPreview(event: { kind: number; content: string; tags: string[][] }): string {
  // Se o conteúdo for grande (ex: base64), prefira uma referência @arquivo
  const dTag = event.tags.find(t => t[0] === 'd')?.[1] ?? 'content';
  const shouldUseFileRef = event.content && event.content.length > 120;
  const contentArg = shouldUseFileRef
    ? `@${escapeForSingleQuotes(`${dTag}.base64.txt`)}`
    : `'${escapeForSingleQuotes(event.content ?? '')}'`;

  let command = `nak event \\\n  -k ${event.kind} \\\n  -c ${contentArg}`;

  for (const tag of event.tags) {
    if (!tag || tag.length < 2) continue;
    // suporte a tags com 2+ valores: key=val1=val2=...
    const [k, ...vals] = tag;
    const joined = [k, ...vals.map(escapeForSingleQuotes)].join('=');
    command += ` \\\n  -t '${joined}'`;
  }
  return command;
}

/**
 * Validate URL is http(s)
 */
export function isValidHttpUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}