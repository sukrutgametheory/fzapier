# FZapier Development Progress

## Project Overview
Custom workflow automation system built with Supabase Edge Functions to replace Zapier for booking confirmations via WhatsApp (Wati) and email calendar invites (AWS SES).

---

## Implementation Timeline

### 2025-11-06: Initial Setup
- ✅ Created Supabase Edge Function for booking confirmations
- ✅ Integrated Wati API for WhatsApp notifications
- ✅ Implemented AWS SES for email calendar invites (ICS format)
- ✅ Set up database schema for sport templates and workflow executions
- ✅ Created comprehensive documentation (README, SETUP, AWS-SES-SETUP)

### 2025-11-06: Zapier Integration Debugging
**Issue**: Zapier webhook returning 401 Unauthorized
- ✅ Identified missing Authorization header requirement
- ✅ Solution: Added `Authorization: Bearer <SUPABASE_ANON_KEY>` header to Zapier webhook

**Issue**: 500 Internal Server Error - "Cannot read properties of undefined (reading '0')"
- ✅ Root cause: Payload format mismatch between Zapier and expected format
- ✅ Zapier sends: `{"input_data": "{\"userName\": ...}"}` (camelCase, stringified)
- ✅ Expected: `{"User Name": ...}` (Title Case with spaces)
- ✅ Solution: Updated Edge Function to handle both formats:
  - Parse `input_data` if present (Zapier format)
  - Normalize field names (support both camelCase and Title Case)
  - Add validation for required fields
- ✅ Created `test-payload-zapier.json` for testing Zapier format
- ✅ Committed and pushed changes to GitHub

---

## Current Architecture

```
Zapier Webhook → Supabase Edge Function (process-booking)
                        ↓
                  Parse & Normalize
                  (handles both formats)
                        ↓
                 ┌──────┴──────┐
                 ↓             ↓
          Wati WhatsApp    AWS SES Email
          (Template Msg)   (ICS Calendar)
                 ↓             ↓
              Log to Database
```

---

## Payload Format Support

### Zapier Format (Current)
```json
{
  "input_data": "{\"userName\": \"...\", \"userPhoneNumber\": \"...\", \"slots\": [...]}"
}
```

### Direct API Format
```json
{
  "User Name": "...",
  "User Phone Number": "...",
  "Slots": [...]
}
```

Both formats are now supported with automatic normalization.

---

## Known Issues & Limitations

### Open Items
- [ ] Test full end-to-end flow from Zapier in production
- [ ] Verify WhatsApp template parameters match Wati configuration
- [ ] Verify AWS SES email deliverability
- [ ] Monitor execution logs for any edge cases

### Future Enhancements
- [ ] Add webhook authentication (API key validation)
- [ ] Implement rate limiting
- [ ] Add retry logic for failed notifications
- [ ] Support batch bookings (multiple slots)
- [ ] Add timezone handling for international users
- [ ] Create admin dashboard for monitoring executions

---

## Database Schema

### Tables
1. **community_booking_confirmation_sport_templates**
   - Stores sport-specific configurations
   - Fields: sport_name, wati_template_name, please_bring, we_will_provide, calendar_description_template

2. **community_booking_confirmation_workflow_executions**
   - Logs all workflow executions
   - Fields: status, input_data, user info, whatsapp/calendar status, errors, timestamps

3. **facilities** (existing)
   - Stores facility information
   - Fields: name, address, map_link

---

## Environment Variables

### Required Secrets (Set in Supabase)
```bash
# Wati (WhatsApp)
WATI_API_TOKEN
WATI_BASE_URL

# AWS SES (Email)
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY

# Email Sender
EMAIL_FROM_ADDRESS
EMAIL_FROM_NAME

# Auto-set by Supabase
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

---

## Testing

### Test Payloads
- `test-payload.json` - Direct API format
- `test-payload-zapier.json` - Zapier webhook format

### Local Testing
```bash
# Using Zapier format
curl -X POST http://localhost:54321/functions/v1/process_booking \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -d @test-payload-zapier.json
```

### Production Testing
```bash
curl -X POST https://vikhnybwapzagmjlazyu.supabase.co/functions/v1/process_booking \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -d @test-payload-zapier.json
```

---

## Deployment Process

1. Make changes to Edge Function code
2. Commit and push to GitHub
3. Deploy via Supabase Dashboard:
   - Go to Edge Functions
   - Select `process-booking`
   - Click "Deploy" or use CLI: `supabase functions deploy process-booking`
4. Verify logs in Supabase Dashboard

---

## Monitoring & Debugging

### Check Logs
- **Supabase Dashboard**: Edge Functions → process-booking → Logs
- **CLI**: `supabase functions logs process-booking`

### Query Execution History
```sql
-- Recent executions
SELECT * FROM community_booking_confirmation_workflow_executions
ORDER BY created_at DESC
LIMIT 50;

-- Failed/partial executions
SELECT * FROM community_booking_confirmation_workflow_executions
WHERE status IN ('failed', 'partial')
ORDER BY created_at DESC;
```

---

## Integration Endpoints

### Zapier Webhook Configuration
- **URL**: `https://vikhnybwapzagmjlazyu.supabase.co/functions/v1/process_booking`
- **Method**: POST
- **Headers**:
  - `Authorization: Bearer <SUPABASE_ANON_KEY>`
  - `Content-Type: application/json`
- **Payload**: Send booking data in camelCase format

---

## Next Steps

1. **Immediate**:
   - [ ] Deploy updated Edge Function to Supabase
   - [ ] Test Zapier integration end-to-end
   - [ ] Verify WhatsApp message delivery
   - [ ] Verify email calendar invite delivery

2. **Short-term**:
   - [ ] Monitor execution logs for issues
   - [ ] Add more sports templates as needed
   - [ ] Fine-tune error handling

3. **Long-term**:
   - [ ] Implement webhook authentication
   - [ ] Add admin dashboard
   - [ ] Consider scaling optimizations

---

## Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Wati API Docs](https://docs.wati.io/)
- [AWS SES API Reference](https://docs.aws.amazon.com/ses/)
- [ICS Calendar Format Spec](https://icalendar.org/)

---

## Notes

- The Edge Function now supports both payload formats for maximum flexibility
- All calendar invites use ICS format for universal compatibility (Google, Outlook, Apple Calendar, etc.)
- AWS SES is used instead of specialized calendar APIs to avoid OAuth complexity
- Execution logs are stored in database for debugging and monitoring

---

**Last Updated**: 2025-11-06
**Status**: Ready for deployment and testing
