# FZapier - Zapier Replacement with Supabase

A custom workflow automation system built with Supabase Edge Functions to handle booking confirmations via WhatsApp (Wati) and Google Calendar invites.

## Features

- **Webhook Endpoint**: Receives booking data and triggers automated workflows
- **WhatsApp Notifications**: Sends sport-specific confirmation messages via Wati
- **Calendar Invites**: Creates and sends Google Calendar invites
- **Full Logging**: Tracks all workflow executions in database
- **Sport-Specific Templates**: Configurable templates per sport stored in database

## Architecture

```
Input JSON → Supabase Edge Function → Process & Format
                                    ↓
                          ┌─────────┴─────────┐
                          ↓                   ↓
                    Wati WhatsApp      Google Calendar
                    Template Msg          Invite
                          ↓                   ↓
                    Log to Database
```

## Setup

### Prerequisites
- Supabase CLI installed
- Supabase project created
- Wati API credentials
- Google Cloud Service Account for Calendar API

### Installation

1. Clone the repository
2. Link to your Supabase project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
3. Set up environment variables (Supabase secrets):
   ```bash
   supabase secrets set WATI_API_TOKEN="your-token"
   supabase secrets set WATI_BASE_URL="https://live-mt-server.wati.io/429482"
   supabase secrets set GOOGLE_SERVICE_ACCOUNT="your-service-account-json"
   ```
4. Run database migrations:
   ```bash
   supabase db push
   ```
5. Deploy edge functions:
   ```bash
   supabase functions deploy
   ```

## API

### POST /process-booking

Webhook endpoint to process booking confirmations.

**Request Body:**
```json
{
  "User Name": "Amritesh",
  "User Phone Number": "7044333571",
  "User Email": "amriteshgame@gmail.com",
  "Slots": [
    {
      "facilityName": "Game Theory JP Nagar 8th Phase",
      "courtName": "Court 2",
      "startTime": "19:00",
      "eventDate": "2025-10-21T00:00:00.000Z"
    }
  ],
  "Sport Name": "Badminton",
  "Event Type": "COMMUNITY_GAME"
}
```

**Response:**
```json
{
  "success": true,
  "execution_id": "uuid",
  "whatsapp_sent": true,
  "calendar_sent": true
}
```

## Database Schema

### sport_templates
Stores sport-specific message templates and configurations

### workflow_executions
Logs all workflow executions with status and details

### facilities
Stores facility information and map links

## Development

```bash
# Start local Supabase
supabase start

# Deploy function locally
supabase functions serve

# Test webhook
curl -X POST http://localhost:54321/functions/v1/process-booking \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```
