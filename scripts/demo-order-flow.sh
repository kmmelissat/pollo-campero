#!/usr/bin/env bash
# Ejemplo de flujo: health → menú → crear pedido → listar → actualizar estado.
# Uso: ./scripts/demo-order-flow.sh [BASE_ORDER_URL] [BASE_MENU_URL]
# Por defecto: http://localhost:3002 y http://localhost:3001

set -euo pipefail
ORDER_BASE="${1:-http://localhost:3002}"
MENU_BASE="${2:-http://localhost:3001}"

echo "== Health menu =="
curl -sf "$MENU_BASE/health" | jq .

echo "== Health orders =="
curl -sf "$ORDER_BASE/health" | jq .

echo "== Menú (extracto) =="
curl -sf "$MENU_BASE/menu" | jq '.data[0:2]'

echo "== Crear pedido =="
CREATE_RES=$(curl -sf -X POST "$ORDER_BASE/orders" \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Demo CLI","items":[{"productId":"combo-campero","quantity":1},{"productId":"refresco-personal","quantity":1}]}')
echo "$CREATE_RES" | jq .
ORDER_ID=$(echo "$CREATE_RES" | jq -r '.data.id')

echo "== Listar pedidos =="
curl -sf "$ORDER_BASE/orders" | jq .

echo "== Actualizar estado a confirmed =="
curl -sf -X PATCH "$ORDER_BASE/orders/$ORDER_ID/status" \
  -H "Content-Type: application/json" \
  -d '{"status":"confirmed"}' | jq .

echo "Listo. Revisa logs de notification-service para ver order.created y order.updated."
