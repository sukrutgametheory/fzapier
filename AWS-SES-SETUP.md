# AWS SES Setup Guide

Complete guide to configure AWS SES for sending calendar invite emails.

## Prerequisites

- AWS Account with SES access
- Your domain verified in AWS SES

## Step 1: Get AWS SES Credentials

### Option A: If You Already Have SMTP Credentials

If you've configured AWS SMTP on Supabase, you likely have SMTP credentials. These are AWS access keys specifically for SES.

1. Go to AWS SES Console
2. Navigate to **Account Dashboard** > **SMTP Settings**
3. You'll see your SMTP endpoint (e.g., `email-smtp.us-east-1.amazonaws.com`)
4. Extract the region from the endpoint (e.g., `us-east-1`)

**Important**: You need the **IAM Access Key** (not SMTP username/password) for the API approach.

### Option B: Create New IAM User for SES

1. Go to **AWS IAM Console** > **Users**
2. Click **Create User**
3. User name: `fzapier-ses-sender`
4. Click **Next**
5. Select **Attach policies directly**
6. Search for and select: `AmazonSESFullAccess` (or create custom policy below)
7. Click **Next** > **Create User**

### Create Access Key

1. Click on the newly created user
2. Go to **Security credentials** tab
3. Under **Access keys**, click **Create access key**
4. Select **Application running outside AWS**
5. Click **Next** > **Create access key**
6. **IMPORTANT**: Copy both:
   - Access key ID (starts with `AKIA...`)
   - Secret access key (only shown once!)
7. Save these securely

## Step 2: Verify Your Domain in AWS SES

### Why Verify?

In production, you need to verify your sending domain to move out of sandbox mode.

### Verification Steps

1. Go to **AWS SES Console** > **Verified identities**
2. Click **Create identity**
3. Select **Domain**
4. Enter your domain: `gametheory.in`
5. Check **Use a custom MAIL FROM domain** (recommended)
6. Click **Create identity**

### Add DNS Records

AWS will provide DNS records to add:

1. **CNAME records** for DKIM (3 records)
2. **TXT record** for verification
3. **MX record** for MAIL FROM (if using custom MAIL FROM)

Add these to your domain's DNS settings (wherever your domain is hosted).

**Verification time**: Usually 15-30 minutes

## Step 3: Request Production Access (Remove Sandbox)

By default, AWS SES is in sandbox mode with limitations:
- Can only send to verified email addresses
- Limited sending rate

### Remove Sandbox Limitations

1. In SES Console, go to **Account dashboard**
2. Click **Request production access** button
3. Fill out the form:
   - **Mail type**: Transactional
   - **Website URL**: Your website
   - **Use case description**:
     ```
     Sending booking confirmation emails with calendar invites (.ics files)
     to customers who book sports facilities. Emails are transactional,
     triggered by confirmed bookings. Expected volume: X emails per day.
     ```
4. Submit request
5. AWS typically approves within 24 hours

**Tip**: While in sandbox, you can test by verifying your test email address in SES.

## Step 4: Configure Environment Variables

Set these in Supabase:

```bash
# AWS SES Configuration
supabase secrets set AWS_REGION="us-east-1"  # Your SES region
supabase secrets set AWS_ACCESS_KEY_ID="AKIA..."
supabase secrets set AWS_SECRET_ACCESS_KEY="your-secret-key"
supabase secrets set USE_AWS_SES="true"

# Email sender details
supabase secrets set EMAIL_FROM_ADDRESS="bookings@gametheory.in"
supabase secrets set EMAIL_FROM_NAME="Game Theory Bookings"

# Wati (WhatsApp) - if not already set
supabase secrets set WATI_API_TOKEN="your-token"
supabase secrets set WATI_BASE_URL="https://live-mt-server.wati.io/429482"
```

## Step 5: Test Email Sending

### While in Sandbox Mode

Verify your test email in SES first:

1. Go to **SES Console** > **Verified identities**
2. Click **Create identity**
3. Select **Email address**
4. Enter your test email
5. Click **Create identity**
6. Check your email and click verification link

Now you can test:

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/process-booking \
  -H "Content-Type: application/json" \
  -d '{
    "User Name": "Test User",
    "User Phone Number": "1234567890",
    "User Email": "your-verified-test-email@example.com",
    "Slots": [{
      "facilityName": "Game Theory JP Nagar 8th Phase",
      "courtName": "Court 1",
      "startTime": "19:00",
      "eventDate": "2025-12-25T00:00:00.000Z"
    }],
    "Sport Name": "Badminton",
    "Event Type": "COMMUNITY_GAME"
  }'
```

### After Production Access

You can send to any email address.

## Troubleshooting

### Error: "Email address is not verified"

**Cause**: You're in sandbox mode and the recipient email isn't verified.

**Solution**:
1. Verify the test email in SES, OR
2. Request production access (recommended)

### Error: "User is not authorized to perform: ses:SendRawEmail"

**Cause**: IAM user doesn't have SES permissions.

**Solution**:
1. Go to IAM Console > Users > Your user
2. Add policy: `AmazonSESFullAccess`

### Error: "MessageRejected: Email address not verified"

**Cause**: Your sending email (`bookings@gametheory.in`) isn't verified.

**Solution**: Verify your domain in SES (see Step 2)

### Emails going to spam

**Solutions**:
1. **Verify domain** with all DKIM records
2. **Set up SPF record**: Add to DNS:
   ```
   TXT @ "v=spf1 include:amazonses.com ~all"
   ```
3. **Set up DMARC**: Add to DNS:
   ```
   TXT _dmarc "v=DMARC1; p=none; rua=mailto:admin@gametheory.in"
   ```
4. **Use custom MAIL FROM domain** (configured in Step 2)
5. **Warm up your domain**: Start with low volume, gradually increase

### Low sending limits

Default limits after moving out of sandbox:
- 200 emails per day
- 1 email per second

**To increase**:
1. Go to SES Console > **Account dashboard**
2. Click **Request limit increase**
3. Justify your needs

## Cost Estimate

AWS SES Pricing:
- **$0.10 per 1,000 emails** sent
- **$0.12 per GB** for attachments/data transfer
- **First 62,000 emails/month**: FREE (if sending from EC2)

Example: 10,000 emails/month = **$1.00/month**

Much cheaper than Resend for high volume!

## Security Best Practices

1. **Use minimal IAM permissions**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ses:SendEmail",
           "ses:SendRawEmail"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

2. **Rotate access keys** regularly

3. **Never commit credentials** to git

4. **Use Supabase secrets** for all sensitive values

5. **Monitor sending activity** in SES Console

## Monitoring

### View Sending Statistics

1. Go to **SES Console** > **Account dashboard**
2. View metrics:
   - Emails sent
   - Bounces
   - Complaints
   - Delivery rate

### Set Up Bounce/Complaint Handling

1. Go to **Configuration sets**
2. Create a configuration set
3. Add event destination (SNS, CloudWatch, Kinesis)
4. Monitor bounces and complaints
5. Automatically remove bouncing emails

### CloudWatch Logs

AWS SES automatically logs to CloudWatch:
- Sends
- Bounces
- Complaints
- Deliveries

## Comparison: AWS SES vs Resend

| Feature | AWS SES | Resend |
|---------|---------|--------|
| Cost | $0.10/1K emails | $20/month for 50K |
| Setup | Complex | Simple |
| Free tier | 62K/month from EC2 | 3K/month |
| Deliverability | Excellent (when configured) | Excellent |
| Support | AWS Support | Email support |
| Spam risk | Lower (your own IP) | Lower (shared reputation) |
| Configuration | DNS records required | Optional |

**Use AWS SES if**: You already have AWS, need high volume, want lower cost
**Use Resend if**: You want simpler setup, lower volume, faster start

## Support

For AWS SES issues:
1. Check [SES Documentation](https://docs.aws.amazon.com/ses/)
2. Review CloudWatch logs
3. Check SES sending statistics
4. AWS Support (if you have a support plan)

For code issues:
1. Check function logs: `supabase functions logs process-booking`
2. Review workflow_executions table for detailed errors
