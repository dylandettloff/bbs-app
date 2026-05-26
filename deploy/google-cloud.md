# Google Cloud Deployment

This deploys the Strapi backend to Cloud Run and uses Cloud SQL for Postgres.
Run these commands from Cloud Shell or a machine with the Google Cloud CLI installed.

## 1. Set Variables

```bash
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
export REGION="us-central1"
export SERVICE="bbs-backend"
export SQL_INSTANCE="bbs-postgres"
export DB_NAME="bbs"
export DB_USER="strapi"
export DB_PASSWORD="REPLACE_WITH_A_LONG_PASSWORD"

gcloud config set project "$PROJECT_ID"
```

## 2. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com
```

## 3. Create Cloud SQL

```bash
gcloud sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_16 \
  --region="$REGION" \
  --tier=db-f1-micro

gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"

gcloud sql users create "$DB_USER" \
  --instance="$SQL_INSTANCE" \
  --password="$DB_PASSWORD"
```

## 4. Create Strapi Secrets

```bash
printf '%s' "$(openssl rand -base64 64),$(openssl rand -base64 64),$(openssl rand -base64 64),$(openssl rand -base64 64)" \
  | gcloud secrets create bbs-app-keys --data-file=-

openssl rand -base64 48 | gcloud secrets create bbs-admin-jwt-secret --data-file=-
openssl rand -base64 48 | gcloud secrets create bbs-api-token-salt --data-file=-
openssl rand -base64 48 | gcloud secrets create bbs-transfer-token-salt --data-file=-
openssl rand -base64 48 | gcloud secrets create bbs-jwt-secret --data-file=-
openssl rand -base64 32 | gcloud secrets create bbs-encryption-key --data-file=-
printf '%s' "$DB_PASSWORD" | gcloud secrets create bbs-db-password --data-file=-
```

## 5. Deploy Backend to Cloud Run

```bash
cd /Users/dylanpatrickdettloff/Desktop/bbs-app

gcloud run deploy "$SERVICE" \
  --source ./bbs-backend \
  --region "$REGION" \
  --allow-unauthenticated \
  --add-cloudsql-instances "$PROJECT_ID:$REGION:$SQL_INSTANCE" \
  --set-env-vars "NODE_ENV=production,HOST=0.0.0.0,DATABASE_CLIENT=postgres,DATABASE_HOST=/cloudsql/$PROJECT_ID:$REGION:$SQL_INSTANCE,DATABASE_PORT=5432,DATABASE_NAME=$DB_NAME,DATABASE_USERNAME=$DB_USER,DATABASE_SSL=false" \
  --set-secrets "APP_KEYS=bbs-app-keys:latest,ADMIN_JWT_SECRET=bbs-admin-jwt-secret:latest,API_TOKEN_SALT=bbs-api-token-salt:latest,TRANSFER_TOKEN_SALT=bbs-transfer-token-salt:latest,JWT_SECRET=bbs-jwt-secret:latest,ENCRYPTION_KEY=bbs-encryption-key:latest,DATABASE_PASSWORD=bbs-db-password:latest"
```

After the first deploy, get the service URL:

```bash
export BACKEND_URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo "$BACKEND_URL"

gcloud run services update "$SERVICE" \
  --region "$REGION" \
  --update-env-vars "PUBLIC_URL=$BACKEND_URL"
```

## 6. Point the Frontend at Cloud Run

For local testing:

```bash
cd /Users/dylanpatrickdettloff/Desktop/bbs-app/bbsFrontend
EXPO_PUBLIC_API_URL="$BACKEND_URL" npm start
```

For a web build:

```bash
EXPO_PUBLIC_API_URL="$BACKEND_URL" npm run web
```

For mobile release builds, use the same `EXPO_PUBLIC_API_URL` value in your build environment.

## Notes

- `gcloud run deploy --source` builds the Dockerfile in `bbs-backend`.
- Cloud Run provides the `PORT` environment variable; Strapi reads it from `config/server.ts`.
- Local SQLite is not used in production. Data should live in Cloud SQL.
- Uploaded files in `public/uploads` are not durable on Cloud Run. For production uploads, add a Cloud Storage upload provider before users start uploading new media in production.
