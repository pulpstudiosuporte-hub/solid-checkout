import { resolveCname } from 'node:dns/promises';

type CnameResolver = (hostname: string) => Promise<string[]>;
type FetchLike = typeof fetch;

const normalize = (value: string): string => value.replace(/\.$/, '').toLowerCase();
const matchesTarget = (values: string[], target: string): boolean => values.some(value => normalize(value) === normalize(target));

async function resolveCnameOverHttps(endpoint: string, hostname: string, fetchImpl: FetchLike): Promise<string[]> {
  const url = new URL(endpoint);
  url.searchParams.set('name', hostname);
  url.searchParams.set('type', 'CNAME');
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/dns-json' },
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) return [];
  const payload = await response.json() as { Answer?: Array<{ type?: number; data?: string }> };
  return (payload.Answer ?? [])
    .filter(answer => answer.type === 5 && typeof answer.data === 'string')
    .map(answer => answer.data as string);
}

export async function verifyCname(
  hostname: string,
  target: string,
  dependencies: { resolver?: CnameResolver; fetchImpl?: FetchLike } = {},
): Promise<boolean> {
  const resolver = dependencies.resolver ?? resolveCname;
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  try {
    if (matchesTarget(await resolver(hostname), target)) return true;
  } catch {
    // Docker's local resolver may temporarily cache NXDOMAIN after a new record is created.
  }

  for (const endpoint of ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve']) {
    try {
      if (matchesTarget(await resolveCnameOverHttps(endpoint, hostname, fetchImpl), target)) return true;
    } catch {
      // A provider being unavailable must not prevent trying the next resolver.
    }
  }
  return false;
}
