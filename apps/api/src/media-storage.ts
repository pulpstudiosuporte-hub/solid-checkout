import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '@solid/database';

export async function storeImage(db: PrismaClient, storeId: string | null, output: Buffer, quota: number) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`media:${storeId ?? 'platform'}`}, 0))`;
    const contentHash = createHash('sha256').update(output).digest('hex');
    const existing = await tx.mediaAsset.findFirst({ where: { storeId, contentHash }, select: { filename: true } });
    if (existing) return existing;
    const usage = await tx.mediaAsset.aggregate({ where: { storeId }, _sum: { sizeBytes: true } });
    if ((usage._sum.sizeBytes ?? 0) + output.length > quota) return null;
    return tx.mediaAsset.create({ data: { storeId, contentHash, filename: `${randomUUID()}.webp`, content: Uint8Array.from(output), sizeBytes: output.length }, select: { filename: true } });
  });
}

export async function imageInUse(tx: Prisma.TransactionClient, filename: string): Promise<boolean> {
  const pattern = `%/media/${filename}%`;
  const rows = await tx.$queryRaw<{ used: boolean }[]>`SELECT EXISTS(
    SELECT 1 FROM checkouts WHERE draft_config::text LIKE ${pattern} OR published_config::text LIKE ${pattern}
    UNION ALL SELECT 1 FROM products WHERE image_url LIKE ${pattern}
    UNION ALL SELECT 1 FROM product_variants WHERE image_url LIKE ${pattern}
    UNION ALL SELECT 1 FROM product_images WHERE url LIKE ${pattern}
    UNION ALL SELECT 1 FROM shopify_collections WHERE image_url LIKE ${pattern}
    UNION ALL SELECT 1 FROM checkout_session_items WHERE image_url_snapshot LIKE ${pattern}
    UNION ALL SELECT 1 FROM product_releases WHERE image_url LIKE ${pattern}
    UNION ALL SELECT 1 FROM integration_catalog_assets WHERE image_url LIKE ${pattern}
    UNION ALL SELECT 1 FROM stores WHERE profile::text LIKE ${pattern}
    UNION ALL SELECT 1 FROM users WHERE profile::text LIKE ${pattern}
  ) used`;
  return rows[0]?.used ?? true;
}

export async function deleteUnusedImage(db: PrismaClient, storeId: string | null, filename: string) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`media:${storeId ?? 'platform'}`}, 0))`;
    if (!await tx.mediaAsset.findFirst({ where: { storeId, filename }, select: { id: true } })) return 'NOT_FOUND';
    if (await imageInUse(tx, filename)) return 'IN_USE';
    await tx.mediaAsset.deleteMany({ where: { storeId, filename } });
    return 'DELETED';
  });
}
