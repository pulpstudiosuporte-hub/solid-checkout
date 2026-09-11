import sharp from 'sharp';

export const RECEIPT_MAX_BYTES = 3 * 1024 * 1024;
export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function validateReceipt(input: Buffer, mimeType: string): Promise<{ content: Buffer; mimeType: string; extension: string } | null> {
  if (!input.length || input.length > RECEIPT_MAX_BYTES || !RECEIPT_TYPES.includes(mimeType)) return null;
  if (mimeType === 'application/pdf') {
    // PDFs remain untrusted attachments: never render or serve them inline.
    if (!input.subarray(0, 8).toString('ascii').match(/^%PDF-1\.[0-7]|^%PDF-2\.0/) || !input.subarray(-1024).includes(Buffer.from('%%EOF'))) return null;
    return { content: input, mimeType, extension: 'pdf' };
  }
  try {
    const source = sharp(input, { limitInputPixels: 16_000_000, animated: false });
    const metadata = await source.metadata();
    const expected = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
    if (metadata.format !== expected || (metadata.pages ?? 1) > 1) return null;
    const content = await source.rotate().resize(2400, 2400, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
    if (content.length > RECEIPT_MAX_BYTES) return null;
    return { content, mimeType: 'image/webp', extension: 'webp' };
  } catch { return null; }
}
