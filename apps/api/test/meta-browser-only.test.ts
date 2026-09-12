import { describe, expect, it, vi } from 'vitest';
import type { AppEnvironment } from '@solid/config';
import type { FastifyBaseLogger } from 'fastify';
import type { PrismaGatewayRepository } from '../src/gateway-repository.js';
import { syncMetaEvent } from '../src/meta-sync.js';

describe('Meta com somente o Pixel no navegador', () => {
  it('encerra uma entrega antiga sem chamar a Meta quando o token foi removido', async () => {
    const repository = {
      utmifyOrderContext: vi.fn().mockResolvedValue({ customerDataEncrypted: 'unused', checkout: { storeId: 'store-a' } }),
      credentials: vi.fn().mockResolvedValue({ apiKeyEncrypted: '', publicKeyEncrypted: 'unused' }),
      discardIntegrationDeliveryBySession: vi.fn().mockResolvedValue(undefined),
    };
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    try {
      await syncMetaEvent({ APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') } as AppEnvironment, repository as unknown as PrismaGatewayRepository, 'session-a', 'Purchase', {} as FastifyBaseLogger, true);
      expect(fetcher).not.toHaveBeenCalled();
      expect(repository.discardIntegrationDeliveryBySession).toHaveBeenCalledWith('session-a', 'META', 'Purchase');
    } finally { vi.unstubAllGlobals(); }
  });
});
