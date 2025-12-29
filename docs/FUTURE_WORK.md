# Future Development Guide

Now that the app uses PostgreSQL and is set up for Cloud Run, your local development workflow will change slightly.

## 1. Local Development Environment

### Database
You can no longer use the file-based SQLite database (`dev.db`). You need a running PostgreSQL instance.
**Option A: Docker (Recommended)**
If you have Docker Desktop installed:
```bash
docker run --name lime-postgres -e POSTGRES_PASSWORD=localpass -p 5432:5432 -d postgres:15
```

**Option B: Local Install**
Install PostgreSQL for Windows and create a database named `lime_sms_db`.

### Configuration
Update your local `.env` file to point to your local Postgres instance:
```env
# Example for Docker/Local
DATABASE_URL="postgresql://postgres:localpass@localhost:5432/lime_sms_db?schema=public"
```

### Initial Setup (Fresh Start)
When you first pull this code or restart development:
```bash
# Install dependencies
npm install

# Push the schema to your local database
npx prisma db push
# OR if you are strictly using migrations
npx prisma migrate dev
```

## 2. Making Database Changes

If you need to change the data model (e.g., adding a new field to `Subscriber`):

1.  **Edit Schema**: Modify `prisma/schema.prisma`.
2.  **Create Migration**:
    ```bash
    npx prisma migrate dev --name add_new_field
    ```
    This creates a SQL file in `prisma/migrations` and applies it locally.
3.  **Use in Code**: Run `npx prisma generate` (often automatic) to update the TypeScript client.

## 3. Deploying Updates

### Automatic Deployment
If you set up the Cloud Build trigger as described in `LAUNCH.md`:
1.  **Commit & Push**:
    ```bash
    git add .
    git commit -m "feat: added new dashboard"
    git push origin main
    ```
2.  **Wait**: Cloud Build will automatically build the new image and deploy it to Cloud Run.

### Database Updates in Production
Since Cloud Build builds the code but doesn't auto-migrate the production DB by default (unless you added that step), you must run migrations for production:

**Method A: Cloud Run Job (Recommended)**
```bash
gcloud run jobs execute migrate-db --region us-central1
```

**Method B: Local Proxy**
Connect to the production DB from your local terminal using `cloud-sql-proxy` and run:
```bash
npx prisma migrate deploy
```

## 4. Debugging

### Logs
View logs for the web app or worker in the GCP Console -> Cloud Run -> Logs.

### Worker Issues
If the worker stops sending:
1.  Check the logs for "Error" or "Exception".
2.  Ensure only **one** instance is running validly (`min-instances: 1`, `max-instances: 1`).
3.  Restart the revision:
    ```bash
    gcloud run services update lime-sms-worker --force-new-revision
    ```

## 5. Production Health Checks (Google Cloud Console)

To ensure everything is running smoothly, check these pages regularly:

### 1. Cloud Run (Web & Worker)
*   **Metrics**: Go to Cloud Run > `lime-sms-web` > **Metrics**.
    *   **Container Instance Count**: Should scale up/down based on traffic.
    *   **Container CPU/Memory**: Ensure you aren't hitting 100% (if so, increase limits).
*   **Worker Specifics**: Go to Cloud Run > `lime-sms-worker` > **Metrics**.
    *   **Instance Count**: MUST be exactly **1** (flat line). If it's > 1, you have duplicate workers.
    *   **Billable Instance Time**: Should be near 100% if it's always running, or intermittent if it idles.

### 2. Cloud SQL (Database)
*   Go to **SQL** > `lime-db-prod`.
*   **CPU Utilization**: specific spikes are fine, but constant high CPU means you need a larger instance.
*   **Connections**: Ensure you aren't hitting the max connection limit.

### 3. Logs Explorer
*   Go to **Logging** > **Logs Explorer**.
*   **Query**: `resource.type="cloud_run_revision" severity="ERROR"`
*   Check for recurring errors.
*   **Worker Verification**: Filter by `lime-sms-worker` and search for "Cron". You should see "[Cron] Processing Queue..." entries every minute.

