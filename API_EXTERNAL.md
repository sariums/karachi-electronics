# External APIs — lock/unlock & notify by IMEI

Two HTTPS endpoints an outside system can call to control a managed phone by its
**IMEI**. Both are Supabase Edge Functions, authenticated with a shared key sent in the
`x-api-key` header (no Supabase login needed by the caller).

Base URL: `https://jslhwzsozfrgwptasjsz.functions.supabase.co`

Auth header on every request:

```
x-api-key: <EXTERNAL_API_KEY>
```

The key lives in `EXTERNAL_API_CREDENTIALS.txt` (gitignored) and as a Supabase secret.

---

## 1. Lock / Unlock — `POST /device-lock-control`

```http
POST https://jslhwzsozfrgwptasjsz.functions.supabase.co/device-lock-control
x-api-key: <EXTERNAL_API_KEY>
Content-Type: application/json

{ "imei": "357521141912430", "action": "lock" }      // or "unlock"
```

Success `200`:

```json
{ "ok": true, "imei": "357521141912430", "action": "lock",
  "device_id": "…", "is_locked": true, "pushed": true }
```

`action` must be `"lock"` or `"unlock"`. The phone reacts within a few seconds (FCM
push); if the push can't be delivered it still applies on the phone's next poll.

---

## 2. Notification / Popup — `POST /device-notify`

```http
POST https://jslhwzsozfrgwptasjsz.functions.supabase.co/device-notify
x-api-key: <EXTERNAL_API_KEY>
Content-Type: application/json

{ "imei": "357521141912430",
  "type": "popup",                               // "popup" (full screen) or "notify"
  "title": "Payment overdue",
  "message": "Please clear your installment to keep using the phone." }
```

Success `200`:

```json
{ "ok": true, "imei": "357521141912430", "type": "popup",
  "device_id": "…", "pushed": true }
```

`type` defaults to `"notify"`. `message` is required; `title` is optional (defaults to
"Notice").

---

## Error responses (both)

| Status | Meaning |
|--------|---------|
| 400 | Bad body — missing/invalid `imei`, `action`, `type`, or `message` |
| 401 | Missing or wrong `x-api-key` |
| 404 | No device found for that IMEI |
| 405 | Method not POST |
| 500 | Server/database error (details in body) |

## Example (curl)

```bash
curl -X POST https://jslhwzsozfrgwptasjsz.functions.supabase.co/device-lock-control \
  -H "x-api-key: <EXTERNAL_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"imei":"357521141912430","action":"lock"}'
```
