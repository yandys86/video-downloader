#!/usr/bin/env bash
# Registra (o vuelve a registrar) el webhook del bot de Telegram.
#
#   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... scripts/set-webhook.sh
#
# LA LÍNEA QUE IMPORTA es allowed_updates. Telegram, por defecto, NO manda
# callback_query — o sea, los taps en los botones inline. Sin incluirlo, los
# menús se dibujan perfectos y no responden a NADA: ni error, ni log, ni
# pista de por qué. Ya pasó en otro bot del mismo dueño y costó un rato
# largo encontrarlo.
set -euo pipefail

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
SECRET="${TELEGRAM_WEBHOOK_SECRET:-}"
URL="${WEBHOOK_URL:-https://tuvideodown.com/api/telegram/webhook}"

[ -n "$TOKEN" ] || { echo "falta TELEGRAM_BOT_TOKEN" >&2; exit 2; }

echo "Registrando $URL …"
resp=$(curl -sS "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSON
{
  "url": "${URL}",
  "allowed_updates": ["message", "callback_query"],
  "drop_pending_updates": true
  ${SECRET:+, "secret_token": "${SECRET}"}
}
JSON
)")
echo "$resp"
echo "$resp" | grep -q '"ok":true' || { echo "✗ falló" >&2; exit 1; }

echo
echo "Comprobando cómo quedó de verdad:"
curl -sS "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" |
  python3 -c '
import json, sys
d = json.load(sys.stdin)["result"]
print("  url               :", d.get("url"))
print("  pendientes        :", d.get("pending_update_count"))
print("  allowed_updates   :", d.get("allowed_updates") or "(TODOS por defecto)")
if d.get("last_error_message"):
    print("  último error      :", d["last_error_date"], d["last_error_message"])
au = d.get("allowed_updates")
if au is not None and "callback_query" not in au:
    print("\n  ⚠️  callback_query NO está: los botones no van a responder.")
    raise SystemExit(1)
print("\n  ✓ los botones inline llegarán")
'

# Comandos del menú azul de Telegram
curl -sS "https://api.telegram.org/bot${TOKEN}/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{"commands":[
        {"command":"menu","description":"Abrir el menú"},
        {"command":"status","description":"Ver mis créditos"},
        {"command":"unlink","description":"Desvincular cuenta"}
      ]}' >/dev/null
curl -sS "https://api.telegram.org/bot${TOKEN}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{"menu_button":{"type":"commands"}}' >/dev/null
echo "  ✓ comandos y botón de menú registrados"
