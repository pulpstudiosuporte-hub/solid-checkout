export function marketingAccountUrl(mode) {
  return `https://app.solidcheckout.xyz/#/${mode === 'cadastro' ? 'cadastro' : 'login'}`;
}
