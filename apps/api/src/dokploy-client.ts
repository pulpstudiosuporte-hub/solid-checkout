import type { AppEnvironment } from '@solid/config';

export interface DokployDomainClient {
  createCheckoutDomain(hostname: string): Promise<string>;
  deleteCheckoutDomain(domainId: string): Promise<void>;
}

export class HttpDokployDomainClient implements DokployDomainClient {
  private readonly baseUrl: string;
  constructor(private readonly environment: AppEnvironment) { this.baseUrl = environment.DOKPLOY_URL!.replace(/\/$/, ''); }

  private async request(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-key': this.environment.DOKPLOY_API_KEY! }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Dokploy respondeu ${response.status}`);
    return response.json().catch(() => ({}));
  }

  async createCheckoutDomain(hostname: string): Promise<string> {
    const result = await this.request('domain.create', { host: hostname, path: '/', port: 80, https: true, certificateType: 'letsencrypt', applicationId: this.environment.DOKPLOY_CHECKOUT_APPLICATION_ID!, domainType: 'application' });
    if (!result || typeof result !== 'object') throw new Error('Dokploy retornou uma resposta inválida ao criar o domínio');
    const body = result as Record<string, unknown>; const nested = typeof body.domain === 'object' && body.domain ? body.domain as Record<string, unknown> : {};
    const id = body.domainId ?? body.id ?? nested.domainId ?? nested.id;
    if (typeof id !== 'string' || !id) throw new Error('Dokploy não retornou o identificador do domínio criado');
    return id;
  }

  async deleteCheckoutDomain(domainId: string): Promise<void> { await this.request('domain.delete', { domainId }); }
}
