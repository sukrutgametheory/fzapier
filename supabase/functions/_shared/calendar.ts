import type { CalendarEvent, CalendarResponse } from "./types.ts";

/**
 * JWT helper for Google Service Account authentication
 */
async function createJWT(
  serviceAccount: any,
  scope: string
): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const claimSet = {
    iss: serviceAccount.client_email,
    scope: scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: expiry,
    iat: now,
  };

  // Base64url encode header and claim set
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));

  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  // Import private key and sign
  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signature = await signJWT(signatureInput, privateKey);

  return `${signatureInput}.${signature}`;
}

/**
 * Import RSA private key for signing
 */
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  // Remove PEM headers and whitespace
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  // Convert base64 to binary
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}

/**
 * Sign JWT with private key
 */
async function signJWT(data: string, privateKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    dataBuffer
  );

  return base64UrlEncode(signature);
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;

  if (typeof data === "string") {
    base64 = btoa(data);
  } else {
    const bytes = new Uint8Array(data);
    base64 = btoa(String.fromCharCode(...bytes));
  }

  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Get access token from Google OAuth
 */
async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await createJWT(
    serviceAccount,
    "https://www.googleapis.com/auth/calendar"
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Failed to get access token: ${JSON.stringify(data)}`
    );
  }

  return data.access_token;
}

/**
 * Create Google Calendar event
 */
export async function createCalendarEvent(
  event: CalendarEvent,
  serviceAccountJson: string
): Promise<CalendarResponse> {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);

    // Default to primary calendar, or use service account's calendar
    const calendarId = "primary";

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...event,
          sendUpdates: "all", // Send email notifications to attendees
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Google Calendar API error: ${response.status} - ${JSON.stringify(data)}`
      );
    }

    return data as CalendarResponse;
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }
}

/**
 * Build calendar event from booking data
 */
export function buildCalendarEvent(
  userName: string,
  userEmail: string,
  sportName: string,
  facilityName: string,
  startDateTime: string,
  endDateTime: string,
  description: string,
  facilityAddress?: string
): CalendarEvent {
  return {
    summary: `${sportName} - ${userName}`,
    description: description,
    location: facilityAddress || facilityName,
    start: {
      dateTime: startDateTime,
      timeZone: "Asia/Kolkata", // India timezone
    },
    end: {
      dateTime: endDateTime,
      timeZone: "Asia/Kolkata",
    },
    attendees: [
      {
        email: userEmail,
      },
    ],
    reminders: {
      useDefault: true,
    },
  };
}

/**
 * Build calendar description from template
 */
export function buildCalendarDescription(
  template: string,
  facilityName: string,
  formattedDateTime: string,
  pleaseBring: string[],
  weWillProvide: string[]
): string {
  let description = template
    .replace(/\{\{facilityName\}\}/g, facilityName)
    .replace(/\{\{datetime\}\}/g, formattedDateTime);

  // Add please bring section
  if (pleaseBring.length > 0) {
    description += "\n\nWhat to bring:";
    pleaseBring.forEach((item) => {
      description += `\n- ${item}`;
    });
  }

  // Add we provide section
  if (weWillProvide.length > 0) {
    description += "\n\nWe provide:";
    weWillProvide.forEach((item) => {
      description += `\n- ${item}`;
    });
  }

  return description;
}

/**
 * Validate Google Calendar configuration
 */
export function validateCalendarConfig(
  serviceAccountJson?: string
): { valid: boolean; error?: string } {
  if (!serviceAccountJson) {
    return {
      valid: false,
      error: "GOOGLE_SERVICE_ACCOUNT environment variable is not set",
    };
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (
      !serviceAccount.client_email ||
      !serviceAccount.private_key ||
      !serviceAccount.project_id
    ) {
      return {
        valid: false,
        error:
          "Invalid service account JSON: missing required fields (client_email, private_key, project_id)",
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: `Invalid service account JSON: ${error}`,
    };
  }

  return { valid: true };
}
