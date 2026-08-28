export type NotificationPayload = Readonly<{
  type: string;
  sound?: 'pending' | 'sale';
  title: string;
  message: string;
  destination: string;
}>;

const metadata = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

export function notificationContent(action: string, raw: unknown): NotificationPayload {
  const data = metadata(raw);
  const provider = typeof data.provider === 'string' ? data.provider : 'integra\u00e7\u00e3o';
  const payment = typeof data.providerStatus === 'string' ? data.providerStatus.toUpperCase() : typeof data.paymentStatus === 'string' ? data.paymentStatus : '';
  if (action === 'payment.pix_created') return { type: 'info', sound: 'pending', title: 'Novo Pix pendente', message: `Um cliente gerou um Pix via ${provider}.`, destination: 'Pedidos' };
  if (action === 'payment.webhook_verified' && payment === 'PAID') return { type: 'success', sound: 'sale', title: 'Pagamento confirmado', message: `Uma venda foi confirmada via ${provider}.`, destination: 'Pedidos' };
  if (action === 'payment.webhook_verified' && payment === 'REFUNDED') return { type: 'warning', title: 'Pagamento reembolsado', message: `Um pagamento via ${provider} foi reembolsado.`, destination: 'Pedidos' };
  if (action === 'payment.webhook_verified') return { type: 'info', title: 'Pagamento atualizado', message: `O gateway ${provider} atualizou um pagamento para ${payment || 'novo status'}.`, destination: 'Pedidos' };
  if (action === 'integration.event_failed') return { type: 'error', title: `Falha na ${provider}`, message: 'Um evento n\u00e3o foi entregue. Abra as integra\u00e7\u00f5es para revisar.', destination: 'Integra\u00e7\u00f5es' };
  if (action === 'integration.shopify_reconnect_required') return { type: 'warning', title: 'Reconecte a Shopify', message: 'A autoriza\u00e7\u00e3o da loja expirou ou foi revogada.', destination: 'Integra\u00e7\u00f5es' };
  if (action === 'store_domain.not_verified') return { type: 'warning', title: 'DNS ainda n\u00e3o validado', message: 'O dom\u00ednio personalizado ainda n\u00e3o est\u00e1 apontando corretamente.', destination: 'Dom\u00ednios' };
  if (action === 'store_domain.activated') return { type: 'success', title: 'Dom\u00ednio ativado', message: 'O dom\u00ednio personalizado est\u00e1 ativo e protegido.', destination: 'Dom\u00ednios' };
  return { type: 'success', title: 'Shopify conectada', message: 'A integra\u00e7\u00e3o com a Shopify foi conectada com sucesso.', destination: 'Integra\u00e7\u00f5es' };
}
