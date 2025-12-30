# Internal API Reference

This document describes the internal API endpoints available within the Lime SMS App.

## Base URL
All endpoints are relative to the application root (e.g., `http://localhost:3000` or production domain).

---

## 1. URL Shortener

**Endpoint**: `POST /api/shorten`

**Purpose**: 
Takes a long URL and a Message Name, generates a shortened link (using an external or internal shortening logic), and associates it with the Message for tracking.

**Request Headers**:
- `Content-Type: application/json`

**Request Body**:
```json
{
  "url": "https://example.com/landing-page?utm_source=sms",
  "name": "20251226_W_PromoBlast" 
}
```
| Field | Type | Description |
|-------|------|-------------|
| `url` | string | The destination URL to shorten. |
| `name` | string | The unique message name (used as the `t202kw` tracking keyword). |

**Response (Success)**:
```json
{
  "success": true,
  "shortLink": "https://tr.limetrak.com/s/Xy9Z",
  "originalUrl": "...",
  "name": "..."
}
```

**Response (Error)**:
```json
{
  "error": "Missing url or name"
}
```

---

## 2. Analytics Webhook

**Endpoint**: `GET /api/webhooks/analytics`

**Purpose**: 
Receives tracking pixels and postbacks from external affiliate networks or tracking software (e.g., T202, Voluum). It logs `TrackingEvent` records associated with a Subscriber and/or Message.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `event_type` | string | Yes | The type of event. Common values: `CLICK`, `PURCHASE`, `LEAD`. |
| `t202kw` | string | Yes | The **Message Name** (e.g., `20251226_W_PromoBlast`). Used for attribution. |
| `sub_id` | string | No | Unique Click ID or Lead ID from the tracker. |
| `revenue` | number | No | Revenue amount for `PURCHASE` events. |
| `source` | string | No | Traffic source identifier. |
| `utm_source` | string | No | UTM Source parameter. |
| `utm_medium` | string | No | UTM Medium parameter. |

**Example Request**:
```
GET /api/webhooks/analytics?event_type=PURCHASE&t202kw=20251226_W_PromoBlast&revenue=49.99&sub_id=click_12345
```

**Response**:
```json
{
  "status": "ok",
  "received": {
    "event_type": "PURCHASE",
    "message": "20251226_W_PromoBlast",
    ...
  }
}
```

---

## 3. Lead Enrichment

**Endpoint**: `POST /api/webhooks/enrich`

**Purpose**: 
Updates existing Subscriber records with additional data (Name, Email) received from external CRMs or marketing platforms (e.g., Woopra, Segment). Matches subscriber by **Phone Number**.

**Request Body**:
```json
{
  "phone": "15551234567",     // Required: Key to find subscriber
  "email": "john@example.com", // Optional
  "firstName": "John",         // Optional
  "form_title": "Investor Quiz A", // Optional: Segment by Source/Form
  "traits": {                 // Optional: Stored as JSON string
     "plan": "premium",
     "investment_goal": "growth"
  }
}
```

**Response**:
```json
{
  "success": true,
  "updated": true
}
```
*Returns `success: false` if subscriber is not found.*

---

## 4. Send Direct Message

**Endpoint**: `POST /api/send-direct`

**Purpose**: 
Triggers an immediate SMS send to a specific number using a specific Message template. Bypasses the queue but respects global safety switches.

**Request Body**:
```json
{
  "phone": "15551234567",
  "messageId": 42
}
```

**Response**:
```json
{
  "success": true
}
```

---

## 5. Cron Worker (Internal)

**Endpoint**: `/api/cron` (If exposed via HTTP) or `npm run worker` (CLI).

**Purpose**: 
Triggers the main `SmsService.processQueue()` loop.
- **Syncs** new subscribers from configured Lime List ID.
- **Processes** eligible subscribers for message delivery.
- **Respects** Global Daily Cap and Timezone Schedules.

---

## 6. Subscriber Upsert/Sync

**Endpoint**: `POST /api/subscribers`

**Purpose**: 
Programmatically adds or updates a subscriber record. This is useful for real-time syncing from other systems (Zapier, CRMs) without waiting for the periodic Lime sync. If the subscriber already exists (matched by phone), their details are updated.

**Authentication**: 
Requires a Bearer Token matching either `APP_PASSWORD` or `CRON_SECRET`.
`Authorization: Bearer <YOUR_SECRET>`

**Request Body**:
```json
{
  "phone": "15551234567",     // Required: Key to find subscriber
  "email": "john@example.com", // Optional
  "firstName": "John",         // Optional
  "lastName": "Doe",           // Optional
  "form_title": "Investor Quiz A", // Optional: Segment by Source/Form
  "traits": {                 // Optional: Stored as JSON string
     "plan": "premium",
     "investment_goal": "growth"
  },
  "acq_source": "meta",       // Optional: Acquisition Attribution
  "acq_campaign": "q1_growth",
  "acq_medium": "cpc",
  "acq_content": "video_ad_1",
  "acq_term": "investing"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "id": 12345,
  "action": "updated" // or "created"
}
```

**Response (Error)**:
```json
{
  "error": "Validation Failed" // or "Unauthorized"
}
```

