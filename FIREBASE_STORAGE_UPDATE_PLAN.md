# Firebase Storage Account Update Plan

**Date**: 2026-03-05
**Objective**: Unify Firebase account access across frontend + backend to use `julley-platform-dev`
**Current State**: Frontend ↔ `julley-platform-dev` | Backend ↔ `julley-test1` ❌
**Target State**: Both ↔ `julley-pms-production` ✅

---

## 1. Current Configuration Status

### Frontend (PMS App)
- **Project**: `julley-pms-production` (environment variables in `.env.local`)
- **Storage Bucket**: `julley-pms-production` (Firebase Storage bucket for prod)
- **Services Used**: Auth, Firestore, Storage, Cloud Messaging, Functions
- **Status**: ✅ Correct

### Backend (CEO Visibility Agent)
- **Project**: `julley-test1` (in `agents/ceo-visibility/.env`) — ❌ STALE, not in your project list
- **Service Account**: `firebase-adminsdk-fbsvc@julley-test1.iam.gserviceaccount.com` — ❌ NEEDS UPDATE
- **Firestore DB**: (test1 project — doesn't exist in your GCP list)
- **Status**: ❌ Mismatch — should use `julley-pms-production` (same as frontend)

---

## 2. Required Updates

### Step 1: Obtain Service Account Credentials for `julley-pms-production`

You need to create/export a service account key from the `julley-pms-production` project:

```bash
# In GCP Console or via gcloud CLI:
gcloud config set project julley-pms-production

gcloud iam service-accounts create firebase-admin-sa \
  --project=julley-pms-production \
  --display-name="Firebase Admin for CEO Agent"

gcloud iam service-accounts keys create /path/to/key.json \
  --iam-account=firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com

# Grant necessary roles:
gcloud projects add-iam-policy-binding julley-pms-production \
  --member="serviceAccount:firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com" \
  --role="roles/datastore.user"  # Firestore read/write

gcloud projects add-iam-policy-binding julley-pms-production \
  --member="serviceAccount:firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"  # Firebase Storage full access
```

### Step 2: Obtain the Full Service Account JSON

Convert the key.json to the format needed in `.env` files:

```bash
cat /path/to/key.json | base64 | tr -d '\n'
# Output: single-line base64 string for Secret Manager
```

Or extract individual fields for `.env`:
```json
{
  "type": "service_account",
  "project_id": "julley-platform-dev",
  "private_key_id": "YOUR_KEY_ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-admin-sa@julley-platform-dev.iam.gserviceaccount.com",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

---

## 3. Files to Update

### 3a. Frontend Environment (`.env.local`)

**Path**: `apps/pms/.env.local`

**Add these Firebase config vars** (uncomment and fill):

```dotenv
# Firebase Configuration — julley-pms-production
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=julley-pms-production.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=julley-pms-production
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=julley-pms-production.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

**How to get these values**:
1. Go to [Firebase Console](https://console.firebase.google.com/) → select `julley-pms-production`
2. Project Settings → General tab → scroll to "Your apps"
3. Select Web app → copy the firebaseConfig object

### 3b. Backend Agent Environment (`.env`)

**Path**: `agents/ceo-visibility/.env`

**Replace Section**: Firebase Configuration (all FIREBASE_* variables)

**New Content** (replace old julley-test1 credentials):

```dotenv
# ============================================================================
# Firebase Configuration — julley-pms-production
# ============================================================================
FIREBASE_PROJECT_ID=julley-pms-production
FIREBASE_PRIVATE_KEY_ID=YOUR_KEY_ID
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=YOUR_CLIENT_ID
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-admin-sa%40julley-pms-production.iam.gserviceaccount.com
```

### 3c. Python Agent Config (Optional Enhancement)

**Path**: `agents/ceo-visibility/src/config.py`

**Current**: Uses `FIREBASE_PROJECT_ID` env var ✅ (already correct)
**No change needed** — will automatically use the new project from `.env`

### 3d. Cognee API Environment

**Path**: `infra/docker/cognee/.env`

**Add** (if needed for cross-service auth):

```dotenv
# Optional: Service account for secure Cognee initialization
FIREBASE_PROJECT_ID=julley-platform-dev
# (other Cognee-specific vars stay the same)
```

---

## 4. Verification Checklist

After updating all files, verify:

- [ ] **Frontend Firebase Config**
  - [ ] `.env.local` has all `NEXT_PUBLIC_FIREBASE_*` vars
  - [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID=julley-pms-production`
  - [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=julley-pms-production.appspot.com`

- [ ] **Backend Agent Credentials**
  - [ ] `agents/ceo-visibility/.env` has `FIREBASE_PROJECT_ID=julley-pms-production`
  - [ ] Service account email: `firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com`
  - [ ] Private key is correctly escaped with `\n` for line breaks

- [ ] **Storage Access**
  - [ ] Service account has `roles/storage.objectAdmin` on `julley-pms-production`
  - [ ] Storage bucket `julley-pms-production` CORS is configured (run: `npm run setup:storage-cors`)

- [ ] **Firestore Access**
  - [ ] Service account has `roles/datastore.user` on `julley-pms-production`
  - [ ] Agent can read tenant-scoped collections: `companies/{companyId}/*`

- [ ] **Runtime Tests**
  - [ ] Frontend can authenticate to `julley-platform-dev` Firebase Auth
  - [ ] Frontend can read/write files to `julley-pms-dev` bucket
  - [ ] Agent backend can initialize Firebase with service account credentials
  - [ ] Agent can query Firestore in `julley-platform-dev`
  - [ ] Agent can access storage through admin SDK

---

## 5. Deployment

### For Local Development
1. Update `.env.local` and `agents/ceo-visibility/.env`
2. Restart Next.js dev server: `npm run dev`
3. Restart agent: `uvicorn src.main:app --reload` (or docker-compose)

### For Cloud Run Deployment
1. Update Secret Manager secrets in GCP (for `julley-pms-production` project)
2. Redeploy agent service:
   ```bash
   gcloud config set project julley-pms-production
   gcloud run deploy ceo-visibility-agent \
     --update-secrets="FIREBASE_PRIVATE_KEY=firebase-admin-key:latest,..."
   ```

---

## 6. Troubleshooting

| Issue | Solution |
|-------|----------|
| `PERMISSION_DENIED` on Firestore read | Service account missing `roles/datastore.user` |
| Storage bucket 404 | Bucket name mismatch (should be `julley-pms-dev.appspot.com`) |
| JWT validation fails | Frontend using wrong Firebase project auth provider |
| Agent can't initialize Firebase | Missing/invalid `FIREBASE_PRIVATE_KEY` format (check `\n` escaping) |
| CORS errors on upload | Run `npm run setup:storage-cors` to configure bucket |

---

## 7. Next Steps

1. **Generate Service Account Credentials** for `julley-platform-dev`
2. **Update all `.env` files** with new credentials
3. **Test Frontend**: Login, upload file to storage
4. **Test Backend**: Run agent, verify it can read Firestore
5. **Run E2E Tests**: CEO agent queries → returns data
6. **Deploy to Cloud Run** with updated credentials in Secret Manager

