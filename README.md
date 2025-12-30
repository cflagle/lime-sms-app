# Lime SMS Engine: The Enterprise Messaging Powerhouse 🚀

**Welcome to the future of high-volume, compliance-first messaging.**

In a world where attention is the new currency, SMS is the gold standard. But scaling SMS is hard. You battle carrier filters, compliance laws, database locks, andAPI latencies.

**Lime SMS Engine** solves this. We built a system that combines the raw power of serverless infrastructure with the delicate precision of bank-grade compliance. It’s not just an app; it’s a machine designed to handle 150,000+ subscribers without blinking.

Below is the complete blueprint of this engine—how it's built, how it protects you, and how you can deploy it today.

---

# PART 1: THE ENGINE (Cloud Architecture) 🏗️

This application runs on **Google Cloud Platform (GCP)**, utilizing a modern "Serverless" architecture. This means we don't pay for idle servers. Data flows seamlessly between independent, scalable services.

## 1. The Building Blocks (Services)

### **Google Cloud Run (The Computers)**
*   **What it is**: Serverless computing. It runs your code.
*   **Why we need it**: Instead of buying a server that runs 24/7 (and paying for it even when you sleep), Cloud Run spins up "containers" (mini-servers) only when someone visits your website or when work needs to be done.
*   **We have TWO parts here**:
    1.  **Web App**: The dashboard you see (`lime-sms-app`). It handles login, settings, and subscriber lists.
    2.  **Worker**: The invisible employee. It runs in the background to handle the heavy lifting (syncing 150k contacts, sending daily SMS blasts).

### **Google Cloud SQL (The Filing Cabinet)**
*   **What it is**: A managed PostgreSQL database.
*   **Why we need it**: All your data—subscribers (150k+), message logs, clicks, and settings—needs a permanent home. If the "Computers" (Cloud Run) crash or restart, they forget everything. The "Filing Cabinet" (Cloud SQL) remembers everything forever and keeps it safe.

### **Google Secret Manager (The Safe)**
*   **What it is**: A secure vault for sensitive passwords.
*   **Why we need it**: We never want to write passwords (like your Database password or Lime API Key) directly in the code. If someone stole the code, they'd have the keys to the castle. Instead, we put them in the "Safe", and only the "Computers" (Cloud Run) are allowed to peek inside when they start up.

### **Google Cloud Build (The Construction Crew)**
*   **What it is**: An automated deployment tool.
*   **Why we need it**: Every time you save code to GitHub, this crew wakes up, reads your blueprints (`cloudbuild.yaml`), builds the new version of the app, tests it, and replaces the old version on Cloud Run automatically.

## 2. The Nervous System (Internal APIs) ⚡

These are the special commands your app uses to talk to itself and the outside world.

| API Endpoint | Translation | Why we need it |
| :--- | :--- | :--- |
| **`/api/shorten`** | "Make this link short" | To turn `mysite.com/very-long-promo-url` into `tr.limetrak.com/s/xyz` so it fits in a text message and we can count who clicks it. |
| **`/api/webhooks/analytics`** | "Record a sale/click" | When a user buys something or clicks an ad, third-party trackers tell this endpoint so we can calculate ROI. |
| **`/api/subscribers`** | "Add/Update Contact" | Allows other tools (like Zapier or your website forms) to instantly push new user data into our system. |
| **`/api/send-direct`** | "Send SMS Now" | Bypasses the waiting line to send an urgent message to one specific person immediately. |
| **`/api/cron`** | "Start Work" | The "alarm clock" that tells the Worker to wake up and start syncing contacts or sending queued messages. |

## 3. How It All Connects (Architecture Diagram) 🔄

```mermaid
graph TD
    %% Users and External Systems
    User[You / Admin] -->|Visits Dashboard| WebApp[Cloud Run: Web App]
    External[External Agencies/Zapier] -->|Sends Data| WebApp
    Tracker[Ad Traxker] -->|Reports Clicks| WebApp

    %% The Core System
    subgraph Google Cloud Platform
        WebApp -->|Reads/Writes Data| DB[(Cloud SQL: Database)]
        Worker[Cloud Run: Worker] -->|Reads/Writes Data| DB
        
        %% Secrets
        WebApp -.->|Unlocks| Secrets[Secret Manager]
        Worker -.->|Unlocks| Secrets
    end

    %% External APIs
    Worker -->|Syncs Contacts & Sends SMS| Lime[Lime Cellular API]
    WebApp -->|Creates Links| Lime

    %% Automation
    GitHub[GitHub Code] -->|Triggers Build| Build[Cloud Build]
    Build -->|Deploys New Version| WebApp
    Build -->|Deploys New Version| Worker
```

---

# PART 2: THE SHIELD (Safeguards & Compliance) 🛡️

Sending messages is easy. Sending them safely, legally, and respectfully is an art. We assume nothing. Every message passes through a rigorous **safety check** before it ever leaves the system.

## 1. Global Safety Switches 🚦

| Setting | Function | Default |
| :--- | :--- | :--- |
| **Master Switch** | Currently controlled via `AppConfig.sendingEnabled`. If `OFF`, the worker skips the entire queue. No messages are sent. | `OFF` (Safe Mode) |
| **Dry Run Mode** | `AppConfig.dryRunMode`. When `ON`, the system simulates logic, logs to the console, and creates DB logs but **never calls the Lime API**. | `ON` (Testing) |
| **Global Daily Cap** | A hard limit on the total SMS sent by the system in 24 hours (e.g., 50,000). Once reached, the worker stops processing the queue until midnight. | `0` (Unlimited) |

## 2. Compliance Constraints (Legal) ⚖️

### Timezones (TCPA)
*   **Rule**: Messages are ONLY sent between **8:00 AM and 8:00 PM** local time.
*   **Derivation**: The system automatically detects the user's timezone based on their **Phone Number Area Code**.
*   **Fallback**: If the area code is unknown, it defaults to `America/New_York` (EST).

### Opt-In Verification
*   **Pre-Flight Check**: Immediately before sending, the system queries the `Lime Cellular API` to verify the number is still opted-in.
*   **Auto-Clean**: If Lime reports a user is opted-out, we mark them as `OPTOUT` in our database and **prevent** the send.

## 3. Frequency & Pacing (User Experience) 📉

These rules prevent "spamming" users and ensure better engagement.

| Rule | Description | Logic |
| :--- | :--- | :--- |
| **Engagement Window** | Only messages users who have interacted recently. | Defaults to `90 Days`. Users strictly outside this window are skipped. |
| **Daily User Cap** | Max messages a single user can receive per day. | Defaults to `2` per day. |
| **Minimum Interval** | Enforced gap between messages to the same user. | Default `1 hour`. (If you receive a message at 10:00, you cannot receive another until 11:00). |
| **Brand Isolation** | Limits are tracked separately for `WSWD` and `TA` brands. | Ensures one brand doesn't use up the user's daily "quota" if strictly configured. |

## 4. Segment & Targeting Rules 🎯

*   **Active Segment**: If an `activeSegmentId` is set in the configuration, the worker **filters** the queue to only process members of that segment. Everyone else is ignored.
*   **Test Mode**: If enabled, the worker **filters** the queue to ONLY process the specific phone numbers listed in `testNumbers`. Real subscribers are ignored.

---

# PART 3: THE CONNECTIVITY (API Integration) 🔌

Your data belongs to you. We've built a standardized API that allows you to instantly inject data from your marketing funnels, CRMs, or ad trackers.

## Authentication (Global)
All API endpoints now require an **API Key** to be included in the JSON request body. The key must match your `APP_PASSWORD` or `CRON_SECRET`.

```json
{
  "api_key": "YOUR_SECRET_KEY",
  ... other params ...
}
```

## 1. Lead Enrichment
**Endpoint**: `POST /api/webhooks/enrich`
Updates existing Subscriber records with additional data (Name, Email) received from external CRMs or marketing platforms. Useful for syncing data from ClickFunnels or Zapier.

```json
{
  "api_key": "SpaceCamo123$",
  "phone": "15551234567",
  "email": "john@example.com",
  "name": "John Doe",
  "traits": { "plan": "premium" }
}
```

## 2. Analytics Webhook
**Endpoint**: `POST /api/webhooks/analytics`
Receives tracking pixels and postbacks from external affiliate networks or tracking software (e.g., T202, Voluum). It logs `TrackingEvent` records associated with a Subscriber and/or Message for ROI calculation.

```json
{
  "api_key": "SpaceCamo123$",
  "event_type": "PURCHASE",
  "t202kw": "20251226_W_PromoBlast",
  "revenue": 49.99,
  "sub_id": "click_12345"
}
```

## 3. Subscriber Upsert/Sync
**Endpoint**: `POST /api/subscribers`
Programmatically adds or updates a subscriber record. This is useful for real-time syncing from other systems (Zapier, CRMs) without waiting for the periodic Lime sync.

```json
{
  "api_key": "SpaceCamo123$",
  "phone": "15551234567",     
  "firstName": "John",       
  "acq_source": "meta"
}
```

## 4. Send Direct Message (Urgent)
**Endpoint**: `POST /api/send-direct`
Triggers an immediate SMS send to a specific number using a specific Message template. Bypasses the queue but respects global safety switches.

```json
{
  "api_key": "SpaceCamo123$",
  "phone": "15551234567",
  "messageId": 42
}
```

---

# PART 4: THE PROTOCOL (Developer Guide) 💻

For the engineers maintaining the system, here is how you work with the codebase locally.

## 1. Local Development Environment

### Database
You can no longer use the file-based SQLite database (`dev.db`). You need a running PostgreSQL instance.
**Option A: Docker (Recommended)**
```bash
docker run --name lime-postgres -e POSTGRES_PASSWORD=localpass -p 5432:5432 -d postgres:15
```

### Configuration
Update your local `.env` file to point to your local Postgres instance:
```env
DATABASE_URL="postgresql://postgres:localpass@localhost:5432/lime_sms_db?schema=public"
```

### Initial Setup (Fresh Start)
When you first pull this code or restart development:
```bash
# Install dependencies
npm install

# Push the schema to your local database
npx prisma db push
```

## 2. Making Database Changes
If you need to change the data model (e.g., adding a new field to `Subscriber`):
1.  **Edit Schema**: Modify `prisma/schema.prisma`.
2.  **Create Migration**: `npx prisma migrate dev --name add_new_field`
3.  **Use in Code**: Run `npx prisma generate` to update the TypeScript client.

## 3. Cost Optimization Opportunities
Currently, the `lime-sms-worker` service runs 24/7.
**Strategy: Migrate to Cloud Run Jobs**
You can reduce this cost by ~95% (to <$2/mo) by switching from an "Always-On Service" to "Cloud Run Jobs" triggered by Cloud Scheduler.
1.  **Code Change**: Modify `scripts/worker.ts` to execute **once** and exit.
2.  **Infrastructure Change**: Deploy as a Cloud Run Job triggered every 5 minutes.

---

# PART 5: LAUNCH & DEPLOYMENT 🚀

Ready to go live? Our deployment pipeline is automated.

## Deployment Checklist

1.  **GCP Account**: A Google Cloud Platform account with billing enabled.
2.  **GCP Project**: Created and configured with Cloud Run, Cloud SQL, and Secret Manager APIs enabled.
3.  **Database**: Managed Cloud SQL instance created (PostgreSQL).
4.  **Secrets**: `DATABASE_URL`, `LIME_USER`, `LIME_API_ID` stored in Secret Manager.

## How to Deploy

**Important**: We use **Cloud Build** for Continuous Deployment. You do not deploy from your laptop.

1.  **Commit Your Code**:
    ```bash
    git add .
    git commit -m "feat: ready for launch"
    ```

2.  **Push to Master**:
    ```bash
    git push origin master
    ```

3.  **Watch the Magic**:
    Go to the Google Cloud Console > Cloud Build. You will see a new build trigger automatically. It will:
    *   Build the Docker containers.
    *   Test the build.
    *   Deploy the `Web App` to Cloud Run.
    *   Deploy the `Worker` to Cloud Run.

4.  **Database Migration**:
    The build updates the code, but not the database structure. For production DB changes, run:
    ```bash
    # Via Cloud Run Job (Recommended)
    gcloud run jobs execute migrate-db --region us-central1
    ```

---

### Key Commands Cheat Sheet

```bash
# Start Development Server
npm run dev

# Run Background Worker Locally
npm run worker

# Deploy to Production
git push origin master
```
