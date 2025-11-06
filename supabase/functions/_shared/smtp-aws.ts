/**
 * AWS SES SMTP email sender with ICS attachment support
 * Uses AWS SES SMTP credentials directly
 */

export interface AWSEmailWithICS {
  to: string;
  toName: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  icsContent: string;
  icsFilename: string;
}

export interface AWSSMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

/**
 * Send email with ICS calendar attachment via AWS SES SMTP
 * Uses fetch to call a SMTP relay endpoint
 */
export async function sendEmailWithICSViaAWSSMTP(
  email: AWSEmailWithICS,
  config: AWSSMTPConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // For Supabase Edge Functions, we'll use nodemailer-compatible approach
    // Since Deno doesn't have direct SMTP support, we'll construct raw email

    // Create MIME email with ICS attachment
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(7)}@gametheory.in>`;
    const date = new Date().toUTCString();

    // Encode ICS content to base64
    const icsBase64 = btoa(email.icsContent);

    // Build HTML body if not provided
    const htmlBody = email.htmlBody || email.textBody.replace(/\n/g, "<br>");

    // Construct raw email
    const rawEmail = [
      `From: ${config.fromName} <${config.fromEmail}>`,
      `To: ${email.toName} <${email.to}>`,
      `Subject: ${email.subject}`,
      `Message-ID: ${messageId}`,
      `Date: ${date}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: multipart/alternative; boundary="${boundary}-alt"`,
      ``,
      `--${boundary}-alt`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      email.textBody,
      ``,
      `--${boundary}-alt`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      htmlBody,
      ``,
      `--${boundary}-alt--`,
      ``,
      `--${boundary}`,
      `Content-Type: text/calendar; method=REQUEST; name="${email.icsFilename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${email.icsFilename}"`,
      ``,
      icsBase64,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    // Base64 encode the entire email
    const rawEmailBase64 = btoa(rawEmail);

    // Send via AWS SES SMTP using the SendRawEmail API
    // We'll use the AWS SES v2 API endpoint
    const sesEndpoint = `https://email.${getRegionFromHost(config.host)}.amazonaws.com/v2/email/outbound-emails`;

    // For AWS SES API v2, we need to use AWS Signature Version 4
    // This is complex, so we'll use a simpler approach with SMTP relay

    // Alternative: Use a lightweight SMTP library for Deno
    // For now, let's use AWS SES HTTP API instead
    return await sendViaAWSSESAPI(email, config);
  } catch (error) {
    console.error("Error sending email via AWS SMTP:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send email using AWS SES SendRawEmail API
 * Simpler than SMTP for edge functions
 */
async function sendViaAWSSESAPI(
  email: AWSEmailWithICS,
  config: AWSSMTPConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // We'll use a third-party AWS SES library for Deno
    // Or use Supabase's built-in SMTP functionality

    // For Supabase edge functions with AWS SMTP configured,
    // we can use the Supabase email functionality
    // But since it's not directly exposed, we'll use a workaround

    // Best approach: Use the SMTP credentials via a simple HTTP SMTP relay
    // or use the nodemailer-compatible approach

    throw new Error(
      "Direct AWS SES SMTP in edge functions requires SMTP relay. Use sendEmailWithICSViaSupabase instead."
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send email via Supabase's built-in email functionality
 * This uses the SMTP configuration you've set up in Supabase
 */
export async function sendEmailWithICSViaSupabase(
  email: AWSEmailWithICS,
  supabaseUrl: string,
  supabaseServiceKey: string,
  fromEmail: string,
  fromName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Supabase doesn't expose a direct email sending API in edge functions
    // We need to use the Resend integration or call auth.admin.inviteUserByEmail
    // which uses the configured SMTP

    // Since Supabase's SMTP is mainly for auth emails, we'll need to use
    // a custom approach or Resend

    // Best solution: Use Resend with AWS SES as the backend
    // Resend can be configured to use your AWS SES credentials

    throw new Error(
      "Supabase SMTP is for auth emails only. Please use Resend (which can use AWS SES) or direct AWS SES API."
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract AWS region from SMTP host
 */
function getRegionFromHost(host: string): string {
  // email-smtp.us-east-1.amazonaws.com -> us-east-1
  const match = host.match(/email-smtp\.([a-z0-9-]+)\.amazonaws\.com/);
  return match ? match[1] : "us-east-1";
}

/**
 * Validate AWS SMTP configuration
 */
export function validateAWSSMTPConfig(
  host?: string,
  username?: string,
  password?: string
): { valid: boolean; error?: string } {
  if (!host) {
    return {
      valid: false,
      error: "AWS_SMTP_HOST environment variable is not set",
    };
  }

  if (!username) {
    return {
      valid: false,
      error: "AWS_SMTP_USERNAME environment variable is not set",
    };
  }

  if (!password) {
    return {
      valid: false,
      error: "AWS_SMTP_PASSWORD environment variable is not set",
    };
  }

  return { valid: true };
}
