const origin = process.argv[2];
if (!origin || !/^https?:\/\//.test(origin)) throw new Error('Usage: node scripts/check-web-headers.mjs https://app.solidcheckout.xyz');
let failures = 0;
// The CI container may still be starting. Retry connection failures only;
// an HTTP response with invalid headers must fail immediately.
async function fetchWhenReady(url) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try { return await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' }); }
    catch (error) {
      if (attempt === 9) throw error;
      await new Promise(resolve => setTimeout(resolve, 1_000));
    }
  }
}
for (const path of ['/', '/index.html']) {
  const response = await fetchWhenReady(new URL(path, origin));
  const checks = {
    status: response.status === 200,
    hsts: /max-age=[1-9]\d+/.test(response.headers.get('strict-transport-security') || ''),
    nosniff: response.headers.get('x-content-type-options') === 'nosniff',
    framing: /frame-ancestors\s+'none'/.test(response.headers.get('content-security-policy') || ''),
    csp: /object-src\s+'none'/.test(response.headers.get('content-security-policy') || ''),
    cache: /no-store/.test(response.headers.get('cache-control') || ''),
    referrer: response.headers.get('referrer-policy') === 'strict-origin-when-cross-origin',
  };
  for (const [name, passed] of Object.entries(checks)) if (!passed) { console.error(`${path}: missing/invalid ${name}`); failures++; }
  await response.body?.cancel();
}
if (failures) process.exitCode = 1;
else console.log('HTML security headers verified through the requested origin.');
