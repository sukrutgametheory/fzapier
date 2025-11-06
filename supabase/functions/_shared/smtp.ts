/**
 * SMTP email sender with ICS attachment support
 */

export interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface EmailWithICS {
  to: string;
  toName: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  icsContent: string;
  icsFilename: string;
}

/**
 * Send email with ICS calendar attachment via SMTP
 */
export async function sendEmailWithICS(
  email: EmailWithICS,
  config: SMTPConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Create MIME multipart email with ICS attachment
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(7)}@gametheory.in>`;

    // Build email headers
    const headers = [
      `From: ${config.fromName} <${config.fromEmail}>`,
      `To: ${email.toName} <${email.to}>`,
      `Subject: ${email.subject}`,
      `Message-ID: ${messageId}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ].join("\r\n");

    // Build email body
    const textPart = [
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      email.textBody,
    ].join("\r\n");

    // Optional HTML part
    const htmlPart = email.htmlBody
      ? [
          `--${boundary}`,
          `Content-Type: text/html; charset="UTF-8"`,
          `Content-Transfer-Encoding: 7bit`,
          ``,
          email.htmlBody,
        ].join("\r\n")
      : "";

    // ICS attachment
    const icsBase64 = btoa(email.icsContent);
    const icsPart = [
      `--${boundary}`,
      `Content-Type: text/calendar; method=REQUEST; name="${email.icsFilename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${email.icsFilename}"`,
      ``,
      icsBase64,
      `--${boundary}--`,
    ].join("\r\n");

    // Combine all parts
    const emailContent = [
      headers,
      ``,
      textPart,
      htmlPart,
      icsPart,
    ].join("\r\n");

    // Send via SMTP
    const response = await sendViaSMTP(
      config,
      email.to,
      emailContent
    );

    return response;
  } catch (error) {
    console.error("Error sending email with ICS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send email via SMTP using native TCP connection
 * For Deno/Supabase Edge Functions, we'll use a simple SMTP library
 */
async function sendViaSMTP(
  config: SMTPConfig,
  to: string,
  content: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // For Supabase Edge Functions, we can use the SMTP REST API approach
    // or use a third-party service like SendGrid, Mailgun, etc.

    // Option 1: Using nodemailer-compatible approach with Deno
    // We'll use fetch to call an SMTP relay service

    // For now, let's use a simple approach with fetch to an SMTP service
    // You'll need to configure this based on your SMTP provider

    // Most SMTP providers offer HTTP APIs that are easier to use in edge functions
    // Examples: SendGrid, Mailgun, AWS SES, Resend

    throw new Error(
      "Direct SMTP not implemented. Please use sendEmailWithICSViaAPI instead with your email service provider."
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send email via email service API (SendGrid, Mailgun, Resend, etc.)
 * This is the recommended approach for Edge Functions
 */
export async function sendEmailWithICSViaResend(
  email: EmailWithICS,
  resendApiKey: string,
  fromEmail: string,
  fromName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [email.to],
        subject: email.subject,
        text: email.textBody,
        html: email.htmlBody || email.textBody.replace(/\n/g, "<br>"),
        attachments: [
          {
            filename: email.icsFilename,
            content: btoa(email.icsContent),
            content_type: "text/calendar; method=REQUEST",
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(data)}`);
    }

    return {
      success: true,
      messageId: data.id,
    };
  } catch (error) {
    console.error("Error sending via Resend:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send email via Gmail SMTP (using Google's SMTP servers)
 */
export async function sendEmailWithICSViaGmail(
  email: EmailWithICS,
  gmailUser: string,
  gmailAppPassword: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // This would require implementing SMTP protocol over TCP
  // For Edge Functions, it's better to use an email service API
  throw new Error(
    "Gmail SMTP requires TCP connection. Use an email service API instead (Resend, SendGrid, etc.)"
  );
}

/**
 * Validate email configuration
 */
export function validateEmailConfig(
  provider: "resend" | "sendgrid" | "mailgun",
  apiKey?: string
): { valid: boolean; error?: string } {
  if (!apiKey) {
    return {
      valid: false,
      error: `${provider.toUpperCase()}_API_KEY environment variable is not set`,
    };
  }

  return { valid: true };
}
