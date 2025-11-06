# FZapier Setup Guide

Complete guide to set up and deploy your Zapier replacement on Supabase.

## Prerequisites

1. **Supabase CLI** installed
   ```bash
   npm install -g supabase
   ```

2. **Supabase Project** created at https://supabase.com

3. **Wati Account** with API access

4. **Google Cloud Project** with Calendar API enabled and Service Account created

## Step 1: Link Your Supabase Project

```bash
# Login to Supabase
supabase login

# Link to your project (get project ref from Supabase dashboard)
supabase link --project-ref your-project-ref
```

## Step 2: Set Up Database

Run the migration to create all necessary tables:

```bash
supabase db push
```

This will create:
- `community_booking_confirmation_sport_templates` - Sport-specific configurations
- `community_booking_confirmation_workflow_executions` - Execution logs

**Note**: It assumes you already have a `facilities` table. If not, add your facilities manually through the Supabase dashboard.

### Add More Sports

You can add more sports to the templates table through SQL or the Supabase dashboard:

```sql
INSERT INTO community_booking_confirmation_sport_templates (
    sport_name,
    wati_template_name,
    whatsapp_message_template,
    please_bring,
    we_will_provide,
    tips,
    calendar_description_template
) VALUES (
    'Tennis',
    'community_tennis_confirmation',
    'Hi {{userName}} 👋\n\nJust confirming your community tennis game on {{datetime}} at {{facilityName}}.',
    ARRAY['Tennis shoes', 'Water bottle'],
    ARRAY['Rackets', 'Tennis balls', 'Court space'],
    ARRAY['Arrive 10 minutes early', 'Warm up before playing'],
    'Community Tennis Game at {{facilityName}}\n\nDate & Time: {{datetime}}'
);
```

## Step 3: Configure Google Calendar API

### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Calendar API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. Create Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in the details and create
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose "JSON" format
   - Download the JSON file

5. **Important**: The service account needs calendar access. You have two options:
   - **Option A**: Domain-wide delegation (for Google Workspace)
   - **Option B**: Share a calendar with the service account email

   For Option B (simpler):
   - Open Google Calendar
   - Create a new calendar for bookings (or use existing)
   - Share it with the service account email (found in the JSON: `client_email`)
   - Give it "Make changes to events" permission

### Format Service Account JSON

The service account JSON needs to be provided as a single-line string for environment variables. You can use this command:

```bash
cat service-account.json | jq -c
```

Or manually remove all line breaks from the JSON file.

## Step 4: Configure Wati

1. Get your Wati API token from the Wati dashboard
2. Note your Wati base URL (usually `https://live-mt-server.wati.io/YOUR_NUMBER`)
3. Create WhatsApp templates in Wati that match your sport template names:
   - `community_pickleball_confirmation`
   - `community_badminton_confirmation`
   - etc.

### Wati Template Parameters

Your Wati templates should have these parameters:
- `name` - User's name
- `datetime` - Formatted datetime (e.g., "21st Oct 2025 at 7pm")
- `facility_name` - Facility name
- `sport_name` - Sport name
- `facility_map_link` - Google Maps link

## Step 5: Set Environment Variables

Set secrets in Supabase:

```bash
# Set Wati credentials
supabase secrets set WATI_API_TOKEN="your-wati-token"
supabase secrets set WATI_BASE_URL="https://live-mt-server.wati.io/429482"

# Set Google Service Account (as single-line JSON)
supabase secrets set GOOGLE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

## Step 6: Deploy Edge Function

```bash
supabase functions deploy process-booking
```

## Step 7: Get Your Webhook URL

After deployment, your webhook URL will be:

```
https://your-project-ref.supabase.co/functions/v1/process-booking
```

You can find your project ref in the Supabase dashboard URL.

## Testing

### Local Testing

1. Start Supabase locally:
   ```bash
   supabase start
   ```

2. Set up local environment variables in `.env.local`

3. Serve the function:
   ```bash
   supabase functions serve process-booking --env-file .env.local
   ```

4. Test with curl:
   ```bash
   curl -X POST http://localhost:54321/functions/v1/process-booking \
     -H "Content-Type: application/json" \
     -d @test-payload.json
   ```

### Production Testing

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/process-booking \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

## Monitoring

### View Logs

```bash
# View function logs
supabase functions logs process-booking

# View function logs with follow
supabase functions logs process-booking --follow
```

### View Execution History

Query the workflow executions table in Supabase dashboard:

```sql
SELECT * FROM community_booking_confirmation_workflow_executions
ORDER BY created_at DESC
LIMIT 50;
```

### Check Failed Executions

```sql
SELECT
  id,
  user_name,
  sport_name,
  status,
  error_message,
  whatsapp_error,
  calendar_error,
  created_at
FROM community_booking_confirmation_workflow_executions
WHERE status IN ('failed', 'partial')
ORDER BY created_at DESC;
```

## Troubleshooting

### WhatsApp Messages Not Sending

1. Check Wati API token is correct
2. Verify Wati template name matches exactly
3. Check phone number format (should be with country code)
4. View error in `whatsapp_error` column in database

### Calendar Invites Not Sending

1. Verify Google Service Account JSON is valid
2. Check Calendar API is enabled in Google Cloud
3. Ensure calendar is shared with service account email
4. View error in `calendar_error` column in database

### Function Timeouts

Edge functions have a timeout limit. If processing takes too long:
1. Check your database query performance
2. Consider async processing for large batches
3. View function logs for specific errors

## Updating Templates

To update sport templates, use the Supabase dashboard or run SQL:

```sql
UPDATE community_booking_confirmation_sport_templates
SET
  please_bring = ARRAY['New item 1', 'New item 2'],
  we_will_provide = ARRAY['New provision 1']
WHERE sport_name = 'Badminton';
```

## Adding New Facilities

Add to your existing facilities table:

```sql
INSERT INTO facilities (name, address, map_link) VALUES
('New Facility Name', 'Address', 'https://maps.google.com/?q=New+Facility');
```

## Security Considerations

1. **API Keys**: Never commit `.env` or service account JSON files to git
2. **Row Level Security**: Currently set to allow all. Adjust policies based on your needs:
   ```sql
   -- Example: Restrict updates to service role only
   ALTER POLICY "Allow all operations on workflow_executions"
   ON community_booking_confirmation_workflow_executions
   USING (auth.role() = 'service_role');
   ```
3. **Webhook Authentication**: Consider adding API key validation if needed

## Support

For issues or questions:
1. Check function logs: `supabase functions logs process-booking`
2. Check database logs in Supabase dashboard
3. Review workflow_executions table for detailed error messages
