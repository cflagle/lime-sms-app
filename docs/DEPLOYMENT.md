# Deployment Checklist

## Prerequisites
-   GCP CLI (`gcloud`) installed and authenticated.
-   Docker installed.

## Steps

1.  **Build & Push Docker Image**
    ```bash
    gcloud builds submit --config cloudbuild.yaml .
    ```

2.  **Run Database Migrations (Production)**
    If schema changed:
    ```bash
    npx prisma migrate deploy
    ```

3.  **Verify Environment Variables**
    Ensure these are set in Cloud Run:
    -   `DATABASE_URL`
    -   `LIME_API_KEY`
    -   `CRON_SECRET`

4.  **Restart Services**
    -   Restart the `sms-worker` service to pick up new code.
    -   Restart the `next-app` service.

## Post-Deployment Verification
1.  Check Cloud Run logs for startup errors.
2.  trigger a test sync (optional).
3.  Send a test message to a whitelist number using the UI.
