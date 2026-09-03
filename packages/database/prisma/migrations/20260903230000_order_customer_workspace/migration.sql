INSERT INTO "product_releases" (
  "id",
  "public_id",
  "category",
  "title",
  "description",
  "published",
  "published_at",
  "created_at",
  "updated_at"
)
VALUES (
  '663dc10a-332d-46e4-b4c7-ab391606cd38',
  'order-customer-workspace',
  'IMPROVEMENT',
  'Central operacional de pedidos',
  'Cada pedido agora reúne resumo, transações, rastreamento, status, histórico do cliente, atribuição e integrações em uma única tela operacional.',
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("public_id") DO NOTHING;
