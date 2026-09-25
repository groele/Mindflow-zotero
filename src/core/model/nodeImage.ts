import { NodeImage } from './types';

export const MAX_NODE_IMAGE_DATA_URL_LENGTH = 300_000;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const validatedImages = new WeakMap<object, boolean>();

export function imageDisplayHeight(image: NodeImage): number {
  return Math.max(40, Math.min(360, Math.round(image.width / image.aspectRatio)));
}

export function isSafeNodeImage(value: unknown): value is NodeImage {
  if (!value || typeof value !== 'object') return false;
  const cached = validatedImages.get(value);
  if (cached !== undefined) return cached;
  const image = value as Partial<NodeImage>;
  const valid = typeof image.dataUrl === 'string' && image.dataUrl.length <= MAX_NODE_IMAGE_DATA_URL_LENGTH &&
    /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.dataUrl) &&
    typeof image.width === 'number' && Number.isFinite(image.width) && image.width >= 80 && image.width <= 480 &&
    typeof image.aspectRatio === 'number' && Number.isFinite(image.aspectRatio) && image.aspectRatio > 0 && image.aspectRatio <= 100;
  validatedImages.set(value, valid);
  return valid;
}

export async function prepareNodeImage(file: File): Promise<NodeImage> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('仅支持 PNG、JPEG 和 WebP 图片');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('原始图片不能超过 15 MB');
  const objectUrl = URL.createObjectURL(file);
  let image: HTMLImageElement;
  try {
    image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 24_000_000) {
      throw new Error('图片尺寸过大或无法解析');
    }
    const aspectRatio = image.naturalWidth / image.naturalHeight;
    let scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法处理图片');
    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/webp', Math.max(0.42, 0.82 - attempt * 0.06));
      if (dataUrl.startsWith('data:image/webp;base64,') && dataUrl.length <= MAX_NODE_IMAGE_DATA_URL_LENGTH) {
        return { dataUrl, width: Math.min(220, Math.max(80, image.naturalWidth)), aspectRatio };
      }
      scale *= 0.78;
    }
    throw new Error('图片压缩后仍过大，请选用尺寸更小的文件');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
