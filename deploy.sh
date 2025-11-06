#!/bin/bash

# FZapier Deployment Script

set -e

echo "🚀 Deploying FZapier to Supabase..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it with: npm install -g supabase"
    exit 1
fi

# Check if we're linked to a project
if [ ! -f ".supabase/config.toml" ]; then
    echo "❌ Not linked to a Supabase project. Run: supabase link --project-ref your-project-ref"
    exit 1
fi

echo "📦 Pushing database migrations..."
supabase db push

echo "🔧 Deploying edge function..."
supabase functions deploy process-booking

echo "✅ Deployment complete!"
echo ""
echo "Your webhook URL:"
echo "https://YOUR-PROJECT-REF.supabase.co/functions/v1/process-booking"
echo ""
echo "Don't forget to set your environment secrets:"
echo ""
echo "Wati (WhatsApp):"
echo "  supabase secrets set WATI_API_TOKEN=\"your-token\""
echo "  supabase secrets set WATI_BASE_URL=\"your-url\""
echo ""
echo "AWS SES (Calendar invites):"
echo "  supabase secrets set AWS_REGION=\"us-east-1\""
echo "  supabase secrets set AWS_ACCESS_KEY_ID=\"AKIA...\""
echo "  supabase secrets set AWS_SECRET_ACCESS_KEY=\"...\""
echo ""
echo "Email sender:"
echo "  supabase secrets set EMAIL_FROM_ADDRESS=\"bookings@gametheory.in\""
echo "  supabase secrets set EMAIL_FROM_NAME=\"Game Theory Bookings\""
