/**
 * AWS SES email sender using HTTP API (not SMTP)
 * This works better in Supabase Edge Functions than SMTP
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

export interface AWSSESConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fromEmail: string;
  fromName: string;
}

/**
 * Send email with ICS calendar attachment via AWS SES API
 */
export async function sendEmailWithICSViaAWSSES(
  email: AWSEmailWithICS,
  config: AWSSESConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Build MIME email with ICS attachment
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(7)}@gametheory.in>`;
    const date = new Date().toUTCString();

    // Encode ICS content to base64
    const icsBase64 = btoa(email.icsContent);

    // Build HTML body if not provided
    const htmlBody = email.htmlBody || email.textBody.replace(/\n/g, "<br>");

    // Construct raw email in MIME format
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

    // Base64 encode the raw email
    const rawEmailBase64 = btoa(rawEmail);

    // Prepare AWS SES SendRawEmail request
    const sesEndpoint = `https://email.${config.region}.amazonaws.com/`;
    const action = "SendRawEmail";
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = timestamp.substring(0, 8);

    // Build request body
    const requestBody = new URLSearchParams({
      Action: action,
      "RawMessage.Data": rawEmailBase64,
    }).toString();

    // Create AWS Signature V4
    const signature = await createAWSSignature(
      config.accessKeyId,
      config.secretAccessKey,
      config.region,
      date,
      timestamp,
      requestBody
    );

    // Send request to AWS SES
    const response = await fetch(sesEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Amz-Date": timestamp,
        "Authorization": signature,
      },
      body: requestBody,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`AWS SES error: ${response.status} - ${responseText}`);
    }

    // Parse message ID from XML response
    const messageIdMatch = responseText.match(/<MessageId>(.*?)<\/MessageId>/);
    const awsMessageId = messageIdMatch ? messageIdMatch[1] : undefined;

    return {
      success: true,
      messageId: awsMessageId,
    };
  } catch (error) {
    console.error("Error sending email via AWS SES:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create AWS Signature Version 4
 */
async function createAWSSignature(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  date: string,
  timestamp: string,
  requestBody: string
): Promise<string> {
  const service = "ses";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${date}/${region}/${service}/aws4_request`;

  // Create canonical request
  const canonicalRequest = [
    "POST",
    "/",
    "",
    "content-type:application/x-www-form-urlencoded",
    `host:email.${region}.amazonaws.com`,
    `x-amz-date:${timestamp}`,
    "",
    "content-type;host;x-amz-date",
    await sha256(requestBody),
  ].join("\n");

  // Create string to sign
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  // Calculate signature
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256(kSigning, stringToSign);

  // Return authorization header
  return `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=content-type;host;x-amz-date, Signature=${bytesToHex(signature)}`;
}

/**
 * SHA256 hash
 */
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * HMAC SHA256
 */
async function hmacSha256(
  key: string | Uint8Array,
  message: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = typeof key === "string" ? encoder.encode(key) : key;
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return new Uint8Array(signature);
}

/**
 * Convert bytes to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validate AWS SES configuration
 */
export function validateAWSSESConfig(
  region?: string,
  accessKeyId?: string,
  secretAccessKey?: string
): { valid: boolean; error?: string } {
  if (!region) {
    return {
      valid: false,
      error: "AWS_REGION environment variable is not set",
    };
  }

  if (!accessKeyId) {
    return {
      valid: false,
      error: "AWS_ACCESS_KEY_ID environment variable is not set",
    };
  }

  if (!secretAccessKey) {
    return {
      valid: false,
      error: "AWS_SECRET_ACCESS_KEY environment variable is not set",
    };
  }

  return { valid: true };
}
