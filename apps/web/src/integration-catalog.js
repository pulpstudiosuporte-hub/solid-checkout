import { Activity, BarChart3, Globe2, Layers3, MessageCircle, ShoppingBag, Truck, Webhook } from 'lucide-react';

export const integrations = [
  { id: 'shopify', name: 'Shopify', category: 'E-commerce', description: 'Sincronize produtos, variantes, imagens e coleções da sua loja Shopify.', icon: ShoppingBag, tone: 'shopify', available: true, keywords: 'loja ecommerce catálogo produtos' },
  { id: 'woocommerce', name: 'WooCommerce', category: 'E-commerce', description: 'Conecte sua operação WooCommerce de forma simples.', icon: Globe2, tone: 'woo', keywords: 'wordpress ecommerce loja' },
  { id: 'melhor-envio', name: 'Melhor Envio', category: 'Logística e Frete', description: 'Calcule fretes e automatize envios com Correios e transportadoras.', icon: Truck, tone: 'shipping', keywords: 'frete correios entrega transportadora' },
  { id: 'superfrete', name: 'Superfrete', category: 'Logística e Frete', description: 'Calcule fretes automaticamente em seus checkouts.', icon: Truck, tone: 'superfrete', keywords: 'frete entrega logística' },
  { id: 'frenet', name: 'Frenet', category: 'Logística e Frete', description: 'Cotação de frete, etiquetas e rastreio via Frenet.', icon: Truck, tone: 'frenet', keywords: 'frete etiqueta rastreio logística' },
  { id: 'whatsapp', name: 'WhatsApp', category: 'Atendimento', description: 'Recupere carrinhos e acompanhe clientes pelo WhatsApp.', icon: MessageCircle, tone: 'whatsapp', keywords: 'atendimento recuperação carrinho mensagens' },
  { id: 'meta', name: 'Meta Pixel', category: 'Marketing', description: 'Pixel e API de Conversões com eventos deduplicados.', icon: BarChart3, tone: 'meta', available: true, keywords: 'facebook instagram pixel conversões tráfego' },
  { id: 'utmify', name: 'UTMify', category: 'Marketing', description: 'Envie pedidos e conversões para sua operação de tráfego.', icon: Activity, tone: 'utmify', available: true, keywords: 'utm rastreamento tráfego pedidos' },
  { id: 'ga4', name: 'Google Analytics 4', category: 'Marketing', description: 'Veja visitas e vendas do checkout no GA4 da sua loja.', icon: BarChart3, tone: 'meta', available: true, keywords: 'google analytics ga4 métricas relatórios' },
  { id: 'ads', name: 'Google Ads', category: 'Marketing', description: 'Registre compras confirmadas nas campanhas da sua loja.', icon: Activity, tone: 'utmify', available: true, keywords: 'google ads anúncios conversões campanhas' },
  { id: 'gtm', name: 'Google Tag Manager', category: 'Marketing', description: 'Gerencie as tags do checkout no seu contêiner Google.', icon: Layers3, tone: 'webhook', available: true, keywords: 'google tag manager gtm tags datalayer' },
  { id: 'webhooks', name: 'Webhooks', category: 'Automação', description: 'Dispare eventos da loja para sistemas e fluxos externos.', icon: Webhook, tone: 'webhook', available: true, keywords: 'api eventos automação endpoint integração' },
];

export const integrationAssetOptions = integrations.map(({ id, name }) => [id, name]);
