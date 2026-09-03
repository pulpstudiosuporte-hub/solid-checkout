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
  '6fb61a0f-897a-463d-bb61-64a47b2a2cd4',
  'order-workspace-ui-polish',
  'IMPROVEMENT',
  'Detalhes de pedidos mais claros e responsivos',
  'As sete abas do pedido receberam melhorias de hierarquia, legibilidade, espaçamento e adaptação para telas menores.',
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("public_id") DO NOTHING;
