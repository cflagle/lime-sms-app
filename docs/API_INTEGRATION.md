# Internal API Reference

This document describes the internal API endpoints available within the Lime SMS App.

## Authentication (Global)
All API endpoints now require an **API Key** to be included in the JSON request body.
The key must match your `APP_PASSWORD` or `CRON_SECRET`.

**Request Body Format**:
```json
{
  "api_key": "YOUR_SECRET_KEY",
  ... other params ...
}
```

---

## 1. URL Shortener

**Endpoint**: `POST /api/shorten`

**Request Body**:
```json
{
  "api_key": "SpaceCamo123$", 
  "url": "https://example.com/landing-page",
  "name": "20251226_W_PromoBlast" 
}
```

**Response (Success)**:
```json
{ "success": true, "shortLink": "https://tr.limetrak.com/s/Xy9Z" }
```

---

## 2. Analytics Webhook

**Endpoint**: `POST /api/webhooks/analytics`
*(Previously GET)*

**Request Body**:
```json
{
  "api_key": "SpaceCamo123$",
  "event_type": "PURCHASE",
  "t202kw": "20251226_W_PromoBlast",
  "revenue": 49.99,
  "sub_id": "click_12345"
}
```

---

## 3. Lead Enrichment

**Endpoint**: `POST /api/webhooks/enrich`

**Request Body**:
```json
{
  "api_key": "SpaceCamo123$",
  "phone": "15551234567",
  "email": "john@example.com",
  "name": "John Doe",
  "traits": { "plan": "premium" }
}
```

---

## 4. Send Direct Message

**Endpoint**: `POST /api/send-direct`

**Request Body**:
```json
{
  "api_key": "SpaceCamo123$",
  "phone": "15551234567",
  "messageId": 42
}
```

---

## 5. Cron Worker (Manual Trigger)

**Endpoint**: `POST /api/cron`

**Request Body**:
```json
{
  "api_key": "SpaceCamo123$"
}
```

---

## 6. Subscriber Upsert/Sync

**Endpoint**: `POST /api/subscribers`

**Request Body**:
```json
{
  "api_key": "SpaceCamo123$",
  "phone": "15551234567",     // Required
  "email": "john@example.com",
  "firstName": "John",       
  "traits": { "plan": "premium" },
  "acq_source": "meta"
}
```


