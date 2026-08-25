export class ShopifyAuthorizationError extends Error {
  constructor(message = 'A autorização da Shopify expirou ou foi revogada.') {
    super(message);
    this.name = 'ShopifyAuthorizationError';
  }
}

export function isShopifyAuthorizationFailure(status: number, messages: readonly string[]): boolean {
  return status === 401 || status === 403 || messages.some(message => /invalid api key|access token|unauthorized|unrecognized login|wrong password/i.test(message));
}
