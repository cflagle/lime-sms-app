# Launching Lime SMS App on Google Cloud Platform

This guide covers the end-to-end process of taking the application live on GCP.

## Prerequisites

1.  **GCP Account**: A Google Cloud Platform account with billing enabled.
2.  **gcloud CLI**: Installed and authorized (`gcloud auth login`).
3.  **GitHub Repository**: The code must be pushed to a GitHub repository.

## Step 1: GCP Project Setup

1.  **Create a Project**:
    ```bash
    gcloud projects create lime-sms-launch --name="Lime SMS App"
    gcloud config set project lime-sms-launch
    ```

2.  **Enable APIs**:
    You need to enable several APIs for the services we use.
    ```bash
    gcloud services enable \
      compute.googleapis.com \
      run.googleapis.com \
      cloudbuild.googleapis.com \
      sqladmin.googleapis.com \
      secretmanager.googleapis.com \
      containerregistry.googleapis.com
    ```

## Step 2: Database Setup (Cloud SQL)

1.  **Create a PostgreSQL Instance**:
    ```bash
    gcloud sql instances create lime-db-prod \
      --database-version=POSTGRES_15 \
      --tier=db-f1-micro \
      --region=us-central1
    ```
    *(Note: `db-f1-micro` is for testing/low volume. Use a larger tier for high production loads.)*

2.  **Set a User Password**:
    ```bash
    gcloud sql users set-password postgres \
      --instance=lime-db-prod \
      --password="YOUR_SECURE_PASSWORD"
    ```

3.  **Create the Database**:
    ```bash
    gcloud sql databases create lime_sms_db --instance=lime-db-prod
    ```

4.  **Get Connection Name**:
    ```bash
    gcloud sql instances describe lime-db-prod --format="value(connectionName)"
    ```
    *Save this (e.g., `lime-sms-app:us-central1:lime-db-prod`).*

## Step 3: Secrets Management

We should not put secrets in `cloudbuild.yaml` or `.env` files committed to git. Use Secret Manager.

1.  **Create Secrets**:
    ```bash
    # Database URL
    # Format: postgresql://USER:PASSWORD@/DB_NAME?host=/cloudsql/CONNECTION_NAME
    echo -n "postgresql://postgres:YOUR_SECURE_PASSWORD@/lime_sms_db?host=/cloudsql/project-id:us-central1:lime-db-prod" | \
    gcloud secrets create DATABASE_URL --data-file=-

    # App Secrets
    echo -n "your-lime-user" | gcloud secrets create LIME_USER --data-file=-
    echo -n "your-lime-api-id" | gcloud secrets create LIME_API_ID --data-file=-
    ```

2.  **Grant Access**:
    Give the Cloud Run service account access to these secrets.
    ```bash
    PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

    gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
      --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
      --role="roles/secretmanager.secretAccessor"
    ```

## Step 4: Configure Cloud Build

1.  **Connect GitHub**:
    Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers) and connect your GitHub repository.

2.  **Create a Trigger**:
    - Name: `deploy-to-prod`
    - Event: Push to main branch
    - Configuration: Cloud Build configuration file (yaml or json)
    - Location: `cloudbuild.yaml`

3.  **Add Substitution Variables** (Optional):
    If your `cloudbuild.yaml` expects `_SOME_VAR`, set it here.

## Step 5: Update Deployment Config

**Important**: You need to update your Cloud Run service configuration to mount the Cloud SQL connection and expose secrets as environment variables.

You can do this via the GCP Console or CLI *after* the first deployment fails (or create a service.yaml).

**Updating via CLI (Recommended):**

```bash
# Web App
gcloud run deploy lime-sms-web \
  --image gcr.io/PROJECT_ID/lime-sms-app \
  --add-cloudsql-instances project-id:us-central1:lime-db-prod \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,LIME_USER=LIME_USER:latest,LIME_API_ID=LIME_API_ID:latest" \
  --region us-central1

# Worker
gcloud run deploy lime-sms-worker \
  --image gcr.io/PROJECT_ID/lime-sms-app \
  --add-cloudsql-instances project-id:us-central1:lime-db-prod \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,LIME_USER=LIME_USER:latest,LIME_API_ID=LIME_API_ID:latest" \
  --region us-central1
```

## Step 6: Database Migration

The `Dockerfile` runs `npx prisma generate`, but it does **not** run `npx prisma migrate deploy`. You should run migration manually or add it as a Cloud Build step.

**Manual Migration (One-off):**
Run from your local machine (requires connection to Cloud SQL via proxy) or use a temporary Cloud Run job.
```bash
# Easiest: Run a one-off job
gcloud run jobs create migrate-db \
  --image gcr.io/PROJECT_ID/lime-sms-app \
  --command "npx" \
  --args "prisma,migrate,deploy" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest" \
  --add-cloudsql-instances project-id:us-central1:lime-db-prod \
  --region us-central1

gcloud run jobs execute migrate-db --region us-central1
```

## Launch Checklist

- [ ] **Database**: Postgres instance running and accessible.
- [ ] **Secrets**: All API keys and DB URLs stored in Secret Manager.
- [ ] **Worker**: `lime-sms-worker` is running with `min-instances: 1` and `max-instances: 1`.
- [ ] **Web**: `lime-sms-web` is publicly accessible.
- [ ] **Domain**: Map your custom domain in Cloud Run "Manage Custom Domains".
