-- Preserve the former frontend-only roadmap as editable records, once.
-- Fresh installations without a platform administrator start with an empty roadmap.
INSERT INTO "product_feedback" ("id", "public_id", "user_id", "store_id", "type", "status", "approved", "title", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), item.public_id, owner.id, NULL, 'SUGGESTION'::"ProductFeedbackType", item.status::"ProductFeedbackStatus", true, item.title, item.description, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT "id" FROM "users" WHERE "platform_admin" = true ORDER BY "created_at", "id" LIMIT 1) owner
CROSS JOIN (VALUES
  ('platform-freight', 'PLANNED', 'Novas integrações de frete', 'Melhor Envio, Superfrete e Frenet no catálogo de integrações.'),
  ('platform-gateways', 'IN_PROGRESS', 'Mais gateways de pagamento', 'Expansão dos meios de pagamento e adquirentes disponíveis.'),
  ('platform-feedback', 'DONE', 'Novidades e roadmap', 'Área pública para acompanhar entregas, sugerir ideias e votar.')
) AS item(public_id, status, title, description)
ON CONFLICT ("public_id") DO NOTHING;
