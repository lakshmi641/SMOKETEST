# Firebase Credential Collection Worksheet

**Project**: `julley-pms-production`
**Date**: 2026-03-05
**Status**: In Progress

Use this worksheet to collect all credentials you need. Fill in the values as you gather them.

---

## PART 1: Frontend Firebase Config

**Source**: Firebase Console → Project Settings → Your Apps (Web)

### Where to Find
1. Go to: https://console.firebase.google.com/
2. Select project: `julley-pms-production`
3. Click ⚙️ (Project Settings)
4. Click "General" tab
5. Scroll to "Your apps" section
6. Find the **web app** (should show something like `julley-pms-production`)
7. Click the card to reveal the config

### Copy These Values

```javascript
// You'll see a firebaseConfig object like this:
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "julley-pms-production.firebaseapp.com",
  projectId: "julley-pms-production",
  storageBucket: "julley-pms-production.appspot.com",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "G-..."
};
```

### Fill In Below

```
NEXT_PUBLIC_FIREBASE_API_KEY = [ ___________________________________________]

NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = [ ___________________________________________]

NEXT_PUBLIC_FIREBASE_PROJECT_ID = [ julley-pms-production ]

NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = [ ___________________________________________]

NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = [ ___________________________________________]

NEXT_PUBLIC_FIREBASE_APP_ID = [ ___________________________________________]

NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = [ ___________________________________________]
```

---

## PART 2: Backend Service Account Credentials

**Source**: GCP Console → IAM & Admin → Service Accounts

### Option A: Create New Service Account (Recommended)

```bash
# Run these commands in PowerShell:

# 1. Set the project
gcloud config set project julley-pms-production

# 2. Create service account
gcloud iam service-accounts create firebase-admin-sa `
  --display-name="Firebase Admin for CEO Agent"

# 3. Create and download the key
gcloud iam service-accounts keys create `
  "$env:USERPROFILE\Downloads\firebase-key.json" `
  --iam-account=firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com

# 4. Grant roles
gcloud projects add-iam-policy-binding julley-pms-production `
  --member="serviceAccount:firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com" `
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding julley-pms-production `
  --member="serviceAccount:firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com" `
  --role="roles/storage.objectAdmin"

# 5. Verify - display the key you just downloaded
cat "$env:USERPROFILE\Downloads\firebase-key.json" | ConvertFrom-Json
```

### Option B: Use Existing Service Account

If you already have a service account key:
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=julley-pms-production
2. Find the service account (e.g., `firebase-admin-sa`)
3. Click on it → **Keys** tab
4. Click **Create new key** → JSON format
5. Download the JSON file

### The JSON File You'll Get

It will look like this:

```json
{
  "type": "service_account",
  "project_id": "julley-pms-production",
  "private_key_id": "a1b2c3d4e5f6...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-admin-sa%40julley-pms-production.iam.gserviceaccount.com"
}
```

### Fill In Below

Extract these values from the JSON file:

```
FIREBASE_PROJECT_ID = [ julley-pms-production ]

FIREBASE_PRIVATE_KEY_ID = [ ___________________________________________]

FIREBASE_PRIVATE_KEY = [ ___________________________________________
                         (multiline - copy EVERYTHING between the BEGIN/END markers)
                         ___________________________________________]

FIREBASE_CLIENT_EMAIL = [ ___________________________________________]

FIREBASE_CLIENT_ID = [ ___________________________________________]

FIREBASE_AUTH_URI = [ https://accounts.google.com/o/oauth2/auth ]

FIREBASE_TOKEN_URI = [ https://oauth2.googleapis.com/token ]

FIREBASE_AUTH_PROVIDER_CERT_URL = [ https://www.googleapis.com/oauth2/v1/certs ]

FIREBASE_CLIENT_CERT_URL = [ ___________________________________________]
```

---

## PART 3: Update .env.local (Frontend)

Once you have the values from PART 1, update this file:

**File**: `.env.local`

```dotenv
# CEO Agent API URL
NEXT_PUBLIC_CEO_AGENT_URL=http://localhost:8080

# Firebase Configuration — julley-pms-production
NEXT_PUBLIC_FIREBASE_API_KEY=<paste from PART 1>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<paste from PART 1>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=julley-pms-production
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<paste from PART 1>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<paste from PART 1>
NEXT_PUBLIC_FIREBASE_APP_ID=<paste from PART 1>
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=<paste from PART 1>
```

**How to update**:
1. Open `.env.local` in your editor
2. Find each commented-out line for `NEXT_PUBLIC_FIREBASE_*`
3. Uncomment it (remove `#`)
4. Replace the value with what you collected in PART 1
5. Save the file

---

## PART 4: Update agents/ceo-visibility/.env (Backend)

Once you have the values from PART 2, update this file:

**File**: `agents/ceo-visibility/.env`

Replace the **Firebase Configuration** section with your values from PART 2:

```dotenv
# ============================================================================
# Firebase Configuration — julley-pms-production
# ============================================================================
FIREBASE_PROJECT_ID=julley-pms-production
FIREBASE_PRIVATE_KEY_ID=<paste from PART 2>
FIREBASE_PRIVATE_KEY="<paste from PART 2 - keep the quotes!>"
FIREBASE_CLIENT_EMAIL=<paste from PART 2>
FIREBASE_CLIENT_ID=<paste from PART 2>
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_CERT_URL=<paste from PART 2>
```

### ⚠️ IMPORTANT: Handling the Private Key

The `FIREBASE_PRIVATE_KEY` needs special formatting:

**From the JSON file**, the private key looks like:
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFA...
[multiple lines of base64 characters]
...5k3XQ==
-----END PRIVATE KEY-----
```

**In the .env file**, it must be on ONE line with `\n` for newlines:
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFA...\n...5k3XQ==\n-----END PRIVATE KEY-----\n"
```

**Easy way to do this**:
1. Copy the entire multi-line private key from JSON (with BEGIN and END)
2. Paste it into the .env file
3. Select all the pasted text
4. In your editor, use Find & Replace:
   - Find: `\n` (literal newline)
   - Replace with: `\n` (escaped newline - type backslash + n)
5. Or use this PowerShell command:

```powershell
$json = Get-Content "$env:USERPROFILE\Downloads\firebase-key.json" | ConvertFrom-Json
$privateKey = $json.private_key
Write-Host "FIREBASE_PRIVATE_KEY=`"$privateKey`""
# Copy the output and paste into .env
```

---

## PART 5: Verification

After updating both files, verify the values:

```powershell
# Check frontend config
Get-Content .env.local | Select-String "NEXT_PUBLIC_FIREBASE"

# Check backend config
Get-Content agents/ceo-visibility/.env | Select-String "FIREBASE"
```

---

## PART 6: Run CORS Setup (One-time)

After updating `.env.local`, run this to configure the storage bucket:

```bash
npm run setup:storage-cors
```

This configures Firebase Storage to accept requests from:
- `localhost:3000` (dev)
- `https://julley-pms-production.web.app` (deployed)

---

## Checklist

After completing all parts:

- [ ] **PART 1**: Collected all 7 Firebase config values from Firebase Console
- [ ] **PART 2**: Created/downloaded service account JSON from GCP
- [ ] **PART 3**: Updated `.env.local` with frontend Firebase config
- [ ] **PART 4**: Updated `agents/ceo-visibility/.env` with backend service account
- [ ] **PART 5**: Verified both files have correct values (no placeholders)
- [ ] **PART 6**: Ran `npm run setup:storage-cors` successfully
- [ ] **TEST**: Restarted dev server and tested login
- [ ] **TEST**: Tried uploading a file to storage
- [ ] **TEST**: Checked agent can read Firestore

---

## Quick Reference

| Item | Frontend (.env.local) | Backend (agents/ceo-visibility/.env) |
|------|----------------------|--------------------------------------|
| Project | `julley-pms-production` | `julley-pms-production` |
| Source | Firebase Console | GCP Service Account |
| # Values | 7 | 9 |
| Need JWT | No | Yes (from Firebase Admin SDK) |
| Storage Access | Client SDK | Admin SDK |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't find web app in Firebase Console | Check you're in `julley-pms-production` project, not another one |
| Service account creation fails | Ensure you have `Compute Admin` or `Service Account Admin` role in the GCP project |
| Private key has `\n` as literal characters | Replace with actual newlines OR use the PowerShell command in PART 4 |
| CORS setup fails | Run with full path: `npm run setup:storage-cors` or check GCP credentials |
| Login fails after update | Clear browser cache and cookies, restart dev server |
| Agent can't access Firestore | Verify service account has `roles/datastore.user` permission |

---

## Next Steps After Setup

1. Run frontend dev server: `npm run dev`
2. Run backend agent: `python -m uvicorn src.main:app --reload` (from agents/ceo-visibility)
3. Test login → Test storage upload → Test agent queries

