# Firebase Storage Migration Summary

**Status**: Ready for credential update
**Target State**: Both frontend + backend using `julley-pms-production`

---

## What's Already Done ✅

- [x] Analyzed current configuration
- [x] Identified mismatch (frontend: `julley-platform-dev`, backend: `julley-test1`)
- [x] Created comprehensive update plan
- [x] Created `.env` templates
- [x] Created verification script

---

## What You Need to Do  🔧

### Step 1: Get Firebase Service Account Credentials

**Location**: GCP Console for `julley-pms-production`

1. Go to: https://console.cloud.google.com/
2. Select or switch to project: **`julley-pms-production`**
3. Navigate to: **IAM & Admin** → **Service Accounts**
4. Find or create service account: `firebase-admin-sa` with these roles:
   - `roles/datastore.user` (Firestore)
   - `roles/storage.objectAdmin` (Cloud Storage)
5. Click on the service account → **Keys** tab
6. **Create new key** → JSON format
7. Download the JSON file

### Step 2: Extract Frontend Firebase Config

1. Go to: https://console.firebase.google.com/
2. Select project: **`julley-pms-production`**
3. Project Settings (⚙️) → **General** tab
4. Scroll to "Your apps" → Select **Web** app
5. Copy the `firebaseConfig` object:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",  // → NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: "julley-pms-production.firebaseapp.com",  // → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: "julley-pms-production",  // → NEXT_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: "julley-pms-production.appspot.com",  // → NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "...",  // → NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "...",  // → NEXT_PUBLIC_FIREBASE_APP_ID
  measurementId: "..."  // → NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};
```

### Step 3: Update Frontend `.env.local`

**File**: `.env.local`

1. Uncomment and fill all `NEXT_PUBLIC_FIREBASE_*` variables from Step 2
2. Example:
```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=julley-pms-production.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=julley-pms-production
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=julley-pms-production.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456:web:abc...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-ABCDEF1234
```

### Step 4: Update Backend Agent `.env`

**File**: `agents/ceo-visibility/.env`

Replace the Firebase section with credentials from the JSON file downloaded in Step 1:

```dotenv
# From service account JSON:
FIREBASE_PROJECT_ID=julley-pms-production
FIREBASE_PRIVATE_KEY_ID=(from "private_key_id")
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-admin-sa@julley-pms-production.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=(from "client_id")
```

**⚠️  Important**: When pasting `FIREBASE_PRIVATE_KEY`, replace literal newlines with `\n`:
- Original: `-----BEGIN...\nABC...\nDEF...\n-----END`
- In `.env`: `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABC...\nDEF...\n-----END PRIVATE KEY-----\n"`

### Step 5: Verify Configuration

Run the verification script:

```bash
# Linux/Mac
bash verify-firebase-config.sh

# Windows PowerShell
# (Script will be converted to PowerShell, or manually check:)
# - .env.local has NEXT_PUBLIC_FIREBASE_PROJECT_ID=julley-platform-dev
# - agents/ceo-visibility/.env has FIREBASE_PROJECT_ID=julley-platform-dev
# - Both have all required fields populated (not "your-*")
```

### Step 6: Setup Storage CORS (One-time)

```bash
# In project root
npm run setup:storage-cors

# This configures the bucket to allow:
# - localhost:3000 (dev)
# - https://julley-platform-dev.web.app (deployed)
```

---

## Files Modified/Created

| File | Status | Purpose |
|------|--------|---------|
| `.env.local` | 📝 User action | Frontend Firebase config |
| `agents/ceo-visibility/.env` | 📝 User action | Backend service account creds |
| `.env.local.template` | ✅ Created | Reference template |
| `agents/ceo-visibility/.env.template` | ✅ Created | Backend reference template |
| `FIREBASE_STORAGE_UPDATE_PLAN.md` | ✅ Created | Detailed plan |
| `verify-firebase-config.sh` | ✅ Created | Verification script |

---

## Testing After Update

### Test 1: Frontend Auth
```bash
npm run dev
# Navigate to login page
# Verify you can log in with Firebase Auth
```

### Test 2: Frontend Storage Upload
```bash
# In PMS app, upload a file (test in task comments)
# Verify it appears in Firebase Storage console:
# https://console.firebase.google.com/project/julley-pms-production/storage
```

### Test 3: Backend Firestore Access
```bash
cd agents/ceo-visibility
python -c "from src.auth import init_firebase; init_firebase(); print('✅ Firebase initialized')"
```

### Test 4: Agent Full Test
```bash
docker-compose up  # If using Docker
# or
python -m uvicorn src.main:app --reload

# In another terminal:
curl -X POST http://localhost:8080/agui \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "X-Company-Id: your-company-id" \
  -d "message=How is my organization performing?"
```

---

## Rollback Plan

If you need to revert to the old setup:

1. Restore old `.env` files (backup them first!)
2. Update `agents/ceo-visibility/.env` to use `julley-test1` credentials
3. Rebuild docker images: `docker-compose build --no-cache`

---

## Credentials Checklist Before Deploying

- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID` = `julley-pms-production`
- [ ] `FIREBASE_PROJECT_ID` = `julley-pms-production`
- [ ] Storage bucket = `julley-pms-production.appspot.com`
- [ ] Service account email ends with `@julley-pms-production.iam.gserviceaccount.com`
- [ ] Private key properly escaped with `\n`
- [ ] No placeholder values like "your-api-key"
- [ ] CORS configured on bucket

---

## Questions? 

1. **"Which file do I update first?"** → Frontend `.env.local` first
2. **"Should I keep the old credentials?"** → Backup, but use new `julley-platform-dev` credentials
3. **"Do I need to update Cognee config?"** → No, unless you're changing its database project
4. **"Will this affect existing data?"** → No, it's the same project, just unified access

---

## Next Steps

After completing all steps:

1. ✅ Update `.env.local` with Frontend Firebase config
2. ✅ Update `agents/ceo-visibility/.env` with Backend service account
3. ✅ Run `npm run setup:storage-cors`
4. ✅ Run verification script
5. ✅ Test frontend login + storage access
6. ✅ Test backend Firestore access
7. ✅ Deploy to Cloud Run with updated Secret Manager values

