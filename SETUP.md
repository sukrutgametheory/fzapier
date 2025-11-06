# FZapier Setup Guide

Complete guide to set up and deploy your Zapier replacement on Supabase.

## Prerequisites

1. **Supabase CLI** installed
   ```bash
   npm install -g supabase
   ```

2. **Supabase Project** created at https://supabase.com

3. **Wati Account** with API access

4. **Resend Account** (or other email service) for sending calendar invites

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

## Step 3: Set Up Email Service (Resend)

Calendar invites are sent via email with ICS attachments. This works with any calendar app (Google, Outlook, Apple, etc.) and doesn't require special API permissions.

### Why Resend?

- Simple API
- Great deliverability
- Free tier: 3,000 emails/month
- No complicated setup

### Create Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email
4. Go to **API Keys** section
5. Create a new API key
6. Copy the key (starts with `re_...`)

### Set Up Your Domain (Recommended)

For production, you should send from your own domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `gametheory.in`)
4. Add the DNS records shown to your domain provider
5. Wait for verification (usually 10-30 minutes)
6. Once verified, you can send from `bookings@gametheory.in`

**For testing**, you can use Resend's test domain:
- Email will be sent from `onboarding@resend.dev`
- Works immediately, no DNS setup needed

### Alternative Email Services

If you prefer a different email service, you can modify `smtp.ts` to support:
- **SendGrid** - Similar API, popular choice
- **Mailgun** - Good for high volume
- **AWS SES** - Cheapest for large scale
- **Postmark** - Great deliverability

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
# Wati credentials
supabase secrets set WATI_API_TOKEN="your-wati-token"
supabase secrets set WATI_BASE_URL="https://live-mt-server.wati.io/429482"

# Resend email service
supabase secrets set RESEND_API_KEY="re_your_api_key"
supabase secrets set EMAIL_FROM_ADDRESS="bookings@gametheory.in"
supabase secrets set EMAIL_FROM_NAME="Game Theory Bookings"
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

2. Create `.env.local` with your credentials

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

### Expected Response

```json
{
  "success": true,
  "execution_id": "uuid-here",
  "whatsapp_sent": true,
  "calendar_sent": true
}
```

## How Calendar Invites Work

### ICS File Format

The system generates standard ICS (iCalendar) files that work with:
- ✅ Google Calendar
- ✅ Outlook / Office 365
- ✅ Apple Calendar
- ✅ Any calendar app

### User Experience

1. User receives email with calendar invite attachment
2. User clicks the `.ics` file
3. Their calendar app opens
4. User clicks "Add to Calendar"
5. Event is added with all details

### Benefits

- **Universal compatibility** - Works with any calendar
- **No special permissions** - Just needs email sending
- **Simple setup** - No OAuth or service accounts
- **Better control** - You own the email delivery

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

1. Verify Resend API key is correct
2. Check email address format is valid
3. Ensure domain is verified in Resend (for production)
4. View error in `calendar_error` column in database
5. Check Resend dashboard for delivery status

### Email Deliverability Issues

1. **Use your own domain** - Don't rely on test domain for production
2. **Verify DNS records** - SPF, DKIM, DMARC all set up correctly
3. **Warm up your domain** - Start with low volume, gradually increase
4. **Check spam folder** - Ask users to check spam on first send
5. **Monitor bounce rate** - Keep it under 5%

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

1. **API Keys**: Never commit `.env` files to git
2. **Row Level Security**: Currently set to allow all. Adjust policies based on your needs:
   ```sql
   -- Example: Restrict updates to service role only
   ALTER POLICY "Allow all operations on workflow_executions"
   ON community_booking_confirmation_workflow_executions
   USING (auth.role() = 'service_role');
   ```
3. **Webhook Authentication**: Consider adding API key validation if needed
4. **Rate Limiting**: Consider implementing rate limiting for the webhook endpoint

## Cost Estimates

### Resend Pricing
- **Free**: 3,000 emails/month
- **Pro**: $20/month for 50,000 emails
- **Business**: $85/month for 100,000 emails

### Supabase Pricing
- **Free**: 500,000 edge function invocations/month
- **Pro**: $25/month for 2M invocations

### Wati Pricing
- Check your Wati plan for WhatsApp message costs

## Support

For issues or questions:
1. Check function logs: `supabase functions logs process-booking`
2. Check database logs in Supabase dashboard
3. Review workflow_executions table for detailed error messages
4. Check Resend dashboard for email delivery status
