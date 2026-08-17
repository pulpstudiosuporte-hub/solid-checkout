import type { AppEnvironment } from '@solid/config';

export interface DokployDomainClient {
  createCheckoutDomain(hostname: string): Promise<string>;
  deleteCheckoutDomain(domainId: string): Promise<void>;
}

export class HttpDokployDomainClient implements DokployDomainClient {
  private readonly baseUrl: string;
  constructor(private readonly environment: AppEnvironment) {
    // Accept either the Dokploy origin or an origin that was copied with /api.
    // The client adds /api itself, so normalising prevents an accidental /api/api URL.
    this.baseUrl = environment.DOKPLOY_URL!.replace(/\/$/, '').replace(/\/api$/, '');
  }

  private async request(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-key': this.environment.DOKPLOY_API_KEY! }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
    const payload = await response.text();
    if (!response.ok) {
      let detail = '';
      try {
        const parsed = JSON.parse(payload) as { message?: unknown; code?: unknown };
        const message = typeof parsed.message === 'string' ? parsed.message : typeof parsed.code === 'string' ? parsed.code : '';
        detail = message ? `: ${message.slice(0, 240)}` : '';
      } catch {
        detail = payload ? `: ${payload.slice(0, 240)}` : '';
      }
      throw new Error(`Dokploy respondeu HTTP ${response.status}${detail}`);
    }
    if (!payload) return {};
    try { return JSON.parse(payload); } catch { return {}; }
  }

  async createCheckoutDomain(hostname: string): Promise<string> {
    const result = await this.request('domain.create', {
      host: hostname,
      path: '/',
      port: 80,
      https: true,
      certificateType: 'letsencrypt',
      applicationId: this.environment.DOKPLOY_CHECKOUT_APPLICATION_ID!,
      domainType: 'application',
      stripPath: false,
    });
    if (!result || typeof result !== 'object') throw new Error('Dokploy retornou uma resposta inválida ao criar o domínio');
    const body = result as Record<string, unknown>; const nested = typeof body.domain === 'object' && body.domain ? body.domain as Record<string, unknown> : {};
    const id = body.domainId ?? body.id ?? nested.domainId ?? nested.id;
    if (typeof id !== 'string' || !id) throw new Error('Dokploy não retornou o identificador do domínio criado');
    return id;
  }

  async deleteCheckoutDomain(domainId: string): Promise<void> { await this.request('domain.delete', { domainId }); }
}
