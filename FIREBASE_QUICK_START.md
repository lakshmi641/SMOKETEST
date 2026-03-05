# 🚀 Firebase Setup Quick Start

**Project**: `julley-pms-production`
**Status**: Ready to collect credentials

---

## Step 1️⃣: Collect Firebase Config (5 minutes)

### Open Firebase Console

1. Go to: https://console.firebase.google.com/
2. Select project: **`julley-pms-production`**
3. Click ⚙️ **Project Settings**
4. Click **General** tab
5. Scroll to **"Your apps"** section
6. Click on the **Web** app card

You'll see a `firebaseConfig` object that looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "julley-pms-production.firebaseapp.com",
  projectId: "julley-pms-production",
  storageBucket: "julley-pms-production.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456",
  measurementId: "G-ABCDEF1234"
};
```

### Save These 7 Values

Copy each value (without quotes):

```
✏️  API_KEY = 
✏️  AUTH_DOMAIN = 
✏️  STORAGE_BUCKET = 
✏️  MESSAGING_SENDER_ID = 
✏️  APP_ID = 
✏️  MEASUREMENT_ID = 
```

---

## Step 2️⃣: Create Service Account (5 minutes)

### Option A: Using Command Line (Fastest)

Open **PowerShell** and run:

```powershell
# Set project
gcloud config set project julley-pms-production

# Create service account
gcloud iam service-accounts create firebase-admin-sa `
  --display-name="Firebase Admin for CEO Agent"

# Create key
gcloud iam service-accounts keys create `
  "$env:USERPROFILE\Downloads\firebase-key.json" `
  --iam-account=firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com

# Grant permissions
gcloud projects add-iam-policy-binding julley-pms-production `
  --member="serviceAccount:firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com" `
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding julley-pms-production `
  --member="serviceAccount:firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com" `
  --role="roles/storage.objectAdmin"

# Verify (should print the JSON)
Get-Content "$env:USERPROFILE\Downloads\firebase-key.json" | ConvertFrom-Json
```

The JSON file was downloaded to: `%USERPROFILE%\Downloads\firebase-key.json`

### Option B: Using GCP Console

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=julley-pms-production
2. Find `firebase-admin-sa` or create new service account
3. Click it → **Keys** tab
4. **Create new key** → JSON
5. Save the JSON file

---

## Step 3️⃣: Update .env Files (2 minutes)

### Use the Helper Script

**From PowerShell in the project root**:

```powershell
# Make the script executable
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# Run the helper
.\update-firebase-env.ps1
```

When prompted:

1. **Frontend (.env.local)**: Enter the 7 Firebase config values you collected in Step 1
2. **Backend (agents/ceo-visibility/.env)**: Point to the JSON file from Step 2
   - Path: `$env:USERPROFILE\Downloads\firebase-key.json`

### Or Manual Update

**Frontend (.env.local)**:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=<value from Step 1>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<value from Step 1>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=julley-pms-production
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<value from Step 1>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<value from Step 1>
NEXT_PUBLIC_FIREBASE_APP_ID=<value from Step 1>
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=<value from Step 1>
```

**Backend (agents/ceo-visibility/.env)**:

1. Open the JSON file from Step 2 in a text editor
2. In `.env`, update the Firebase section with values from the JSON:

```dotenv
FIREBASE_PROJECT_ID=julley-pms-production
FIREBASE_PRIVATE_KEY_ID=<from JSON: private_key_id>
FIREBASE_PRIVATE_KEY="<from JSON: private_key>"
FIREBASE_CLIENT_EMAIL=<from JSON: client_email>
FIREBASE_CLIENT_ID=<from JSON: client_id>
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_AUTH_PROVIDER_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
FIREBASE_CLIENT_CERT_URL=<from JSON: client_x509_cert_url>
```

---

## Step 4️⃣: Configure Storage CORS (1 minute)

```bash
npm run setup:storage-cors
```

This allows the frontend to upload files to Firebase Storage.

---

## Step 5️⃣: Test Everything (5 minutes)

### Terminal 1: Frontend

```bash
npm run dev
```

Then:
1. Open: http://localhost:3000
2. Log in with your Firebase credentials
3. Try uploading a file
4. Check Firebase Storage: https://console.firebase.google.com/project/julley-pms-production/storage

### Terminal 2: Backend Agent (optional for now)

```bash
cd agents/ceo-visibility
python -m uvicorn src.main:app --reload
```

---

## Summary

| Step | Action | Time |
|------|--------|------|
| 1 | Collect Firebase config from console | 5 min |
| 2 | Create service account + download JSON | 5 min |
| 3 | Update .env files (with helper script) | 2 min |
| 4 | Setup CORS | 1 min |
| 5 | Test frontend + backend | 5 min |
| | **Total** | **18 min** |

---

## Troubleshooting

### "Can't find Firebase project"
- Make sure you're in `julley-pms-production` (not production or stage)
- Sign out and back into console.firebase.google.com

### "gcloud command not found"
- Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
- Then run: `gcloud auth login`

### "Private key has literal \n instead of newlines"
- The helper script handles this automatically
- If manual, paste the JSON's private_key as-is, with quotes around the entire value

### "CORS setup fails"
- Make sure `.env.local` has been updated first
- Run: `npm run setup:storage-cors` from project root
- Check GCP service account has storage permissions

### "Login fails after update"
- Clear browser cache (Ctrl+Shift+Del)
- Restart dev server
- Check `.env.local` values match Firebase Console exactly

---

## Reference Docs

- [FIREBASE_CREDENTIAL_COLLECTION.md](FIREBASE_CREDENTIAL_COLLECTION.md) — Detailed worksheet
- [FIREBASE_STORAGE_UPDATE_PLAN.md](FIREBASE_STORAGE_UPDATE_PLAN.md) — Complete plan
- [FIREBASE_STORAGE_SETUP_SUMMARY.md](FIREBASE_STORAGE_SETUP_SUMMARY.md) — Full walkthrough

---

## Next Commands

After setup completes:

```bash
# Restart frontend
npm run dev

# Verify storage config
npm run setup:storage-cors

# Start backend (separate terminal)
cd agents/ceo-visibility && python -m uvicorn src.main:app --reload
```

---

**You're ready! 🎉 Start with Step 1️⃣ above.**

