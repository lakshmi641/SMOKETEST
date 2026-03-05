# Firebase Storage Account Update — Complete Overview

**Status**: ✅ Documentation Ready | 🎯 Credential Collection Phase

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      UNIFIED: julley-pms-production                  │
│                                                                       │
│  ┌─────────────────────────────┐  ┌──────────────────────────────┐  │
│  │   Frontend (Next.js)        │  │  Backend (CEO Agent)         │  │
│  │   :3000                     │  │   :8080 (or Cloud Run)       │  │
│  │                             │  │                              │  │
│  │  .env.local:                │  │  agents/ceo-visibility/.env: │  │
│  │  • NEXT_PUBLIC_FIREBASE_*   │  │  • FIREBASE_PROJECT_ID       │  │
│  │  • 7 config values          │  │  • FIREBASE_PRIVATE_KEY_ID   │  │
│  │                             │  │  • FIREBASE_PRIVATE_KEY      │  │
│  │  ✅ Client-side access      │  │  • FIREBASE_CLIENT_EMAIL     │  │
│  │  ✅ Upload to Storage       │  │  • 9 service account fields  │  │
│  │  ✅ Read Firestore via UI   │  │                              │  │
│  │                             │  │  ✅ Admin SDK access         │  │
│  │                             │  │  ✅ Read/write Firestore     │  │
│  │                             │  │  ✅ Access Storage via admin │  │
│  └──────────┬──────────────────┘  └───────────┬──────────────────┘  │
│             │                                 │                      │
│             └─────────────────┬───────────────┘                      │
│                               │                                      │
│                    Shared Resources                                  │
│             (via julley-pms-production)                              │
│                               │                                      │
│        ┌──────────────┬───────┴─────────┬──────────────┐             │
│        ▼              ▼                 ▼              ▼             │
│    ┌────────┐   ┌──────────┐   ┌────────────┐   ┌─────────────┐    │
│    │ Auth   │   │Firestore │   │  Storage   │   │ Cloud SQL   │    │
│    │        │   │ (prod)   │   │  (prod)    │   │ (agno_db)   │    │
│    └────────┘   └──────────┘   └────────────┘   └─────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Current vs Target State

### ❌ CURRENT (Mixed Projects)

```
Frontend (.env.local)
├─ NEXT_PUBLIC_FIREBASE_PROJECT_ID = julley-pms-production ✅
└─ Uses: Auth, Firestore, Storage from julley-pms-production

Backend (agents/ceo-visibility/.env)
├─ FIREBASE_PROJECT_ID = julley-test1 ❌ (STALE - not in your projects)
├─ FIREBASE_CLIENT_EMAIL = *@julley-test1.iam.gserviceaccount.com ❌
└─ Can only access julley-test1 Firestore/Storage ❌

Result: ❌ Mismatch - Frontend and Backend use different projects
```

### ✅ TARGET (Unified)

```
Frontend (.env.local)
├─ NEXT_PUBLIC_FIREBASE_PROJECT_ID = julley-pms-production ✅
└─ Uses: Auth, Firestore, Storage from julley-pms-production ✅

Backend (agents/ceo-visibility/.env)
├─ FIREBASE_PROJECT_ID = julley-pms-production ✅
├─ FIREBASE_CLIENT_EMAIL = firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com ✅
└─ Can access production Firestore/Storage ✅

Result: ✅ Both aligned - Frontend and Backend share production resources
```

---

## Data Sources

### Firebase Config (Frontend)
**Where**: Firebase Console → Project Settings → Your Apps (Web)

```javascript
{
  apiKey: "AIzaSy...",                              // API KEY
  authDomain: "julley-pms-production.firebaseapp.com",  // AUTH_DOMAIN
  projectId: "julley-pms-production",               // PROJECT_ID
  storageBucket: "julley-pms-production.appspot.com",   // STORAGE_BUCKET
  messagingSenderId: "123456789",                   // MESSAGING_SENDER_ID
  appId: "1:123456789:web:abc123",                  // APP_ID
  measurementId: "G-ABCDEF1234"                     // MEASUREMENT_ID
}
```

### Service Account JSON (Backend)
**Where**: GCP Console → IAM & Admin → Service Accounts → Create/Download

```json
{
  "type": "service_account",
  "project_id": "julley-pms-production",
  "private_key_id": "a1b2c3d4...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

---

## Setup Timeline

```
NOW
├─ [STEP 1] Collect Firebase config (5 min)
│  └─ Source: Firebase Console
│
├─ [STEP 2] Create service account (5 min)
│  └─ Source: GCP IAM Console (or gcloud CLI)
│
├─ [STEP 3] Update .env files (2 min)
│  ├─ .env.local ← Firebase config
│  └─ agents/ceo-visibility/.env ← Service account JSON
│
├─ [STEP 4] Setup CORS (1 min)
│  └─ Command: npm run setup:storage-cors
│
└─ [STEP 5] Test everything (5 min)
   ├─ Frontend: npm run dev → login → upload file
   └─ Backend: python -m uvicorn... → verify Firestore access

DONE ✅ [18 minutes total]
```

---

## File Changes

| File | Type | Action | Project |
|------|------|--------|---------|
| `.env.local` | Frontend config | Create/Update | `julley-pms-production` |
| `agents/ceo-visibility/.env` | Backend config | Update credentials | `julley-pms-production` |
| Storage bucket | Resource | Already exists | `julley-pms-production.appspot.com` |
| Firestore | Resource | Already exists | `julley-pms-production` |
| Auth | Resource | Already exists | `julley-pms-production` |

---

## Permissions Needed

**Frontend** (via `NEXT_PUBLIC_FIREBASE_API_KEY`):
- ✅ Firebase Authentication (built-in)
- ✅ Firestore read/write (rules-based)
- ✅ Storage read/write (rules-based)

**Backend** (via service account):
- ✅ `roles/datastore.user` — Firestore read/write
- ✅ `roles/storage.objectAdmin` — Storage full access
- ✅ `roles/firebase.admin` — (optional) Full Firebase admin access

---

## Security Notes

1. **Frontend config** (`NEXT_PUBLIC_*`):
   - Public, OK to commit
   - No secrets here
   - Firebase Security Rules enforce access control

2. **Backend credentials** (service account):
   - ⚠️ KEEP SECRET 🔐
   - Don't commit to repo
   - Store in `agents/ceo-visibility/.env` (in .gitignore)
   - On Cloud Run: use Secret Manager

3. **Private Key**: 
   - Only service account has the private key
   - Never put in Frontend
   - Properly escaped in .env: `FIREBASE_PRIVATE_KEY="-----BEGIN...\n...\n-----END...\n"`

---

## After Setup Complete

### Test Checklist

- [ ] Frontend login works
- [ ] Can upload file to Storage
- [ ] File appears in Firebase Console Storage browser
- [ ] Backend can read Firestore collections
- [ ] Agent can query company data
- [ ] Cross-tenant isolation works (can't access other company's data)

### Deployment

**Frontend** (Vercel):
- Just commit `.env.local` changes
- Vercel automatically picks up during build

**Backend** (Cloud Run):
- Build new Docker image with updated `agents/ceo-visibility/.env`
- Or use Cloud Secret Manager to inject at runtime

---

## Quick Links

| Resource | Link |
|----------|------|
| Firebase Console | https://console.firebase.google.com/ |
| GCP Console | https://console.cloud.google.com/ |
| Project (julley-pms-production) | https://console.cloud.google.com/welcome?project=julley-pms-production |
| Service Accounts IAM | https://console.cloud.google.com/iam-admin/serviceaccounts |
| Storage Bucket | https://console.firebase.google.com/project/julley-pms-production/storage |
| Firestore Console | https://console.firebase.google.com/project/julley-pms-production/firestore |

---

## Documents

| Document | Purpose |
|----------|---------|
| [`FIREBASE_QUICK_START.md`](FIREBASE_QUICK_START.md) | 🚀 Start here — 5 step setup |
| [`FIREBASE_CREDENTIAL_COLLECTION.md`](FIREBASE_CREDENTIAL_COLLECTION.md) | 📝 Worksheet for collecting values |
| [`FIREBASE_STORAGE_SETUP_SUMMARY.md`](FIREBASE_STORAGE_SETUP_SUMMARY.md) | 📋 Detailed walkthrough |
| [`FIREBASE_STORAGE_UPDATE_PLAN.md`](FIREBASE_STORAGE_UPDATE_PLAN.md) | 📖 Complete architecture + plan |
| [`update-firebase-env.ps1`](update-firebase-env.ps1) | 🔧 Helper script to update .env |

---

## Start Here 👇

**[FIREBASE_QUICK_START.md](FIREBASE_QUICK_START.md)** — Follow the 5 steps (18 minutes)

