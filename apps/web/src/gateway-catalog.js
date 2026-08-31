export const gatewayCatalog = [
  { id: 'ROAS', assetKey: 'gateway-roas', name: 'Roas', scope: 'Nacional', supported: true, description: 'Pix com liquidação e reconciliação automática.' },
  { id: 'WESTPAY', assetKey: 'gateway-westpay', name: 'WestPay', scope: 'Nacional', supported: true, description: 'Pix com confirmação automática de pagamento.' },
  { id: 'DOTFY', assetKey: 'gateway-dotfy', name: 'Dotfy', scope: 'Nacional', description: 'Integração de pagamentos para sua loja.' },
  { id: 'HISONUNIQUE', assetKey: 'gateway-hisonunique', name: 'hisonunique', scope: 'Nacional', description: 'Integração de pagamentos para sua loja.' },
  { id: 'PAGOUAI', assetKey: 'gateway-pagouai', name: 'PagouAí', scope: 'Nacional', description: 'Integração de pagamentos para sua loja.' },
  { id: 'PAGARME', assetKey: 'gateway-pagarme', name: 'Pagar.me', scope: 'Nacional', description: 'Integração de pagamentos para sua loja.' },
  { id: 'PAGBANK', assetKey: 'gateway-pagbank', name: 'PagBank', scope: 'Nacional', description: 'Integração de pagamentos para sua loja.' },
  { id: 'MERCADOPAGO', assetKey: 'gateway-mercadopago', name: 'Mercado Pago', scope: 'Nacional', description: 'Integração de pagamentos para sua loja.' },
  { id: 'STRIPE', assetKey: 'gateway-stripe', name: 'Stripe', scope: 'Global', description: 'Pagamentos internacionais e múltiplas moedas.' },
  { id: 'PAYPAL', assetKey: 'gateway-paypal', name: 'PayPal', scope: 'Global', description: 'Carteira e pagamentos para vendas internacionais.' },
  { id: 'DLOCAL', assetKey: 'gateway-dlocal', name: 'dLocal', scope: 'Global', description: 'Pagamentos locais em mercados internacionais.' },
];

export const gatewayAssetOptions = gatewayCatalog.map(item => [item.assetKey, item.name]);

export function gatewayAssetMap(assets = []) {
  return new Map(assets.map(asset => [asset.integrationKey, asset]));
}
