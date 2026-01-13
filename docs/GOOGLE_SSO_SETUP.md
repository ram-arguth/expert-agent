# Google SSO Setup for Expert Agent Platform

This guide covers setting up Google OAuth for authentication in the Expert Agent Platform.

## Prerequisites

- GCP project (e.g., `expert-ai-dev`)
- Access to Secret Manager
- Domain verified (e.g., `ai-dev.oz.ly`)

## 🔧 Manual Bootstrap Steps (ONE-TIME)

### Step 1: Create OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent?project=expert-ai-dev
2. Choose **"External"** user type (or "Internal" for Google Workspace)
3. Fill in the app information:
   - **App name**: Expert Agent (Dev)
   - **User support email**: Your email
   - **App logo**: (optional)
   - **App domain**: ai-dev.oz.ly
   - **Developer contact email**: Your email
4. Click **Save and Continue**
5. **Scopes**: Click "Add or Remove Scopes" and add:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Click **Save and Continue**
7. **Test users**: Add your email address(es) for testing
8. Click **Save and Continue**

### Step 2: Create OAuth 2.0 Client ID

1. Go to: https://console.cloud.google.com/apis/credentials?project=expert-ai-dev
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Application type: **"Web application"**
4. Name: `Expert Agent Dev`
5. **Authorized JavaScript origins**:
   ```
   https://ai-dev.oz.ly
   http://localhost:3000
   ```
6. **Authorized redirect URIs**:
   ```
   https://ai-dev.oz.ly/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
7. Click **Create**
8. **⚠️ COPY** the **Client ID** and **Client Secret** immediately!

### Step 3: Store Credentials in Secret Manager

```bash
# Set your project
export PROJECT_ID="expert-ai-dev"

# Create NEXTAUTH_SECRET (session encryption key)
openssl rand -base64 32 | gcloud secrets versions add nextauth-secret \
  --project=$PROJECT_ID \
  --data-file=-

# Store Google Client ID
echo -n "YOUR_GOOGLE_CLIENT_ID" | gcloud secrets versions add google-client-id \
  --project=$PROJECT_ID \
  --data-file=-

# Store Google Client Secret
echo -n "YOUR_GOOGLE_CLIENT_SECRET" | gcloud secrets versions add google-client-secret \
  --project=$PROJECT_ID \
  --data-file=-
```

### Step 4: Deploy

Push to the `dev` branch to trigger a Cloud Build deployment:

```bash
git add -A
git commit -m "feat: Add Google OAuth SSO"
git push origin dev
```

Or manually trigger a build:

```bash
gcloud builds submit \
  --project=expert-ai-dev \
  --config=cloudbuild.yaml \
  --substitutions=_ENV=dev,_PROJECT_ID=expert-ai-dev,_REGION=us-west1,_SERVICE_NAME=expert-agent,_ARTIFACT_REGISTRY=us-west1-docker.pkg.dev/expert-ai-dev/expert-agent,SHORT_SHA=$(git rev-parse --short HEAD)
```

## 🧪 Testing

### Local Development

1. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in your OAuth credentials in `.env.local`

3. Start the dev server:

   ```bash
   pnpm dev
   ```

4. Visit http://localhost:3000/login and click "Sign in with Google"

### Production (ai-dev.oz.ly)

1. Visit https://ai-dev.oz.ly/login
2. Click "Sign in with Google"
3. You should be redirected to Google OAuth
4. After approval, redirected to /dashboard

## 🔒 Security Notes

- **Never commit secrets** to Git
- Secrets are stored in **Secret Manager** and injected at runtime
- OAuth credentials are scoped to specific redirect URIs
- Production should use "Internal" OAuth for Google Workspace orgs

## Troubleshooting

### "redirect_uri_mismatch" error

- Ensure the redirect URI in GCP Console matches exactly
- For dev: `https://ai-dev.oz.ly/api/auth/callback/google`
- Case-sensitive, no trailing slash

### "access_denied" error

- Add your email to Test Users in OAuth consent screen
- Or publish the app (for external users)

### Secrets not available in Cloud Run

- Check that the service account has `roles/secretmanager.secretAccessor`
- Verify secret versions exist: `gcloud secrets versions list google-client-id --project=$PROJECT_ID`
