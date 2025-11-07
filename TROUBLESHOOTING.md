# Troubleshooting Guide

## Common Issues and Solutions

### 1. WhatsApp (Wati) 401 Unauthorized Error

**Error**: `❌ WhatsApp failed: Wati API error (401)`

**Possible Causes**:

#### A. Token Format Issue
Wati API expects the token **directly** in the Authorization header, not with "Bearer" prefix.

✅ **Correct**: `Authorization: your_token_here`
❌ **Wrong**: `Authorization: Bearer your_token_here`

**Solution**: The code now handles this correctly (as of latest commit).

#### B. Whitespace in Environment Variables
Extra spaces or newlines in your secrets can cause authentication failures.

**Check in Supabase Dashboard**:
1. Go to Project Settings → Edge Functions → Secrets
2. Look for `WATI_API_TOKEN` and `WATI_BASE_URL`
3. Make sure there are no spaces before/after the values
4. Re-set if needed:
   ```bash
   supabase secrets set WATI_API_TOKEN="your_token_here"
   supabase secrets set WATI_BASE_URL="https://live-mt-server.wati.io/429482"
   ```

#### C. Token Regenerated in Wati
If you regenerated your API token in Wati dashboard, the old one becomes invalid.

**Solution**:
1. Get new token from Wati dashboard: Settings → API Docs → Copy token
2. Update in Supabase:
   ```bash
   supabase secrets set WATI_API_TOKEN="new_token_here"
   ```
3. Redeploy Edge Function

#### D. Wrong Base URL
The base URL should match your Wati account number.

**Format**: `https://live-mt-server.wati.io/YOUR_ACCOUNT_NUMBER`

**Check**:
1. Log into Wati dashboard
2. Look at the URL or check API documentation
3. Common mistake: Using production URL instead of your account-specific URL

#### E. IP Whitelist in Wati
Some Wati accounts require IP whitelisting for API access.

**Solution**:
1. Check Wati dashboard → Settings → API Settings
2. If IP whitelist is enabled, you need to whitelist Supabase Edge Function IPs
3. Contact Wati support for help with this

#### F. Template Name Mismatch
The template name must exactly match what's configured in Wati.

**Check in Logs**:
```
📦 Payload: {
  "template_name": "community_badminton_confirmation_v2",  ← Must match Wati
  ...
}
```

**Solution**:
1. Go to Wati dashboard → Templates
2. Find your template and copy the exact name
3. Update in database:
   ```sql
   UPDATE community_booking_confirmation_sport_templates
   SET wati_template_name = 'exact_template_name_from_wati'
   WHERE sport_name = 'Badminton' AND use_case = 'community_booking';
   ```

### 2. Debugging Steps for 401 Errors

**Step 1: Check the logs**
Look for these log entries:
```
🔧 Configuration loaded:
  - Wati Base URL: [your_url]
  - Wati Token length: [number] chars

📤 Sending to Wati: [full_url]
🔑 Token format: [first_10_chars]...[last_4_chars] (length: X)
📡 Wati response status: 401
📄 Wati response body: [error message from Wati]
```

**Step 2: Verify token manually**
Test your token with curl:
```bash
curl -X GET "https://live-mt-server.wati.io/YOUR_ACCOUNT_NUMBER/api/v1/getMessages?pageSize=10" \
  -H "Authorization: YOUR_TOKEN"
```

If this returns 401, the token itself is invalid.

**Step 3: Check template exists**
Test if the template exists:
```bash
curl -X GET "https://live-mt-server.wati.io/YOUR_ACCOUNT_NUMBER/api/v1/getMessageTemplates" \
  -H "Authorization: YOUR_TOKEN"
```

Look for your template name in the response.

**Step 4: Test with Postman/Insomnia**
Try the exact same request in Postman:
- URL: `https://live-mt-server.wati.io/YOUR_ACCOUNT_NUMBER/api/v2/sendTemplateMessage?whatsappNumber=917975609838`
- Method: POST
- Header: `Authorization: YOUR_TOKEN`
- Body:
  ```json
  {
    "template_name": "community_badminton_confirmation_v2",
    "broadcast_name": "community_badminton_confirmation_v2",
    "parameters": [
      { "name": "name", "value": "Test User" },
      { "name": "datetime", "value": "25th Oct 2025 at 7pm" },
      { "name": "facility_name", "value": "Game Theory" },
      { "name": "sport_name", "value": "Badminton" },
      { "name": "facility_map_link", "value": "https://maps.google.com" }
    ]
  }
  ```

### 3. Email (AWS SES) Issues

**Error**: `❌ Email failed: AWS SES error (403)`

**Common Causes**:
- AWS credentials are wrong or expired
- Email address not verified in SES (if in sandbox mode)
- Wrong AWS region
- Missing SES permissions in IAM policy

**Solution**:
1. Verify email addresses in AWS SES console (if in sandbox)
2. Check IAM permissions include `ses:SendRawEmail`
3. Verify region matches where emails are verified

### 4. 500 Internal Server Error

**Check logs for**:
- `💥 Fatal error: [error message]`
- Missing database tables
- Sport template not found
- Invalid payload structure

### 5. Template Not Found

**Error**: `Sport template not found for: Badminton (use_case: community_booking)`

**Solution**:
Run the seed file:
```sql
-- File: supabase/seed_badminton_template.sql
INSERT INTO community_booking_confirmation_sport_templates ...
```

### 6. Checking Logs in Supabase

**Dashboard Method**:
1. Go to Supabase Dashboard
2. Edge Functions → process-booking
3. Click on "Logs" tab
4. Filter by recent invocations

**Look for**:
- `🚀 Processing booking confirmation...`
- `🔧 Configuration loaded:` - Shows env vars are loaded
- `📥 Received booking:` - Shows incoming payload
- `📤 Sending to Wati:` - Shows request URL
- `📡 Wati response status:` - Shows HTTP status code
- `📄 Wati response body:` - Shows actual error from Wati

## Quick Checklist

When you get a 401 error, check:

- [ ] Token doesn't have "Bearer" prefix (code handles this now)
- [ ] No whitespace in WATI_API_TOKEN secret
- [ ] Base URL is correct format: `https://live-mt-server.wati.io/ACCOUNT_NUMBER`
- [ ] No trailing slash in base URL (code handles this now)
- [ ] Token hasn't been regenerated in Wati dashboard
- [ ] Template name exactly matches Wati dashboard
- [ ] Account has API access enabled in Wati
- [ ] IP whitelist is disabled OR Supabase IPs are whitelisted
- [ ] Phone number is formatted correctly (91XXXXXXXXXX)

## Getting Help

If you're still stuck:

1. **Copy full log output** from Supabase showing:
   - Configuration loaded
   - Request payload
   - Response status and body

2. **Check Wati Dashboard** for:
   - API status/health
   - Recent API calls and errors
   - Template configuration

3. **Verify in Postman** that:
   - Your token works with a simple GET request
   - The template send works with exact same parameters

4. **Contact Wati Support** if:
   - Token works in Postman but not from Supabase
   - Need to whitelist IPs
   - Unclear about API requirements

---

**Last Updated**: 2025-11-06
