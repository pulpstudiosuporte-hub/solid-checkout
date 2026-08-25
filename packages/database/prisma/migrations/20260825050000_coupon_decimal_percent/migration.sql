-- Percentual armazenado em centésimos de ponto percentual.
-- Exemplo: 10% (10) vira 10,00% (1000); 10,01% será 1001.
UPDATE "coupons"
SET "value" = "value" * 100
WHERE "type" = 'PERCENT';
