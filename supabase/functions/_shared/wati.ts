import type { WatiTemplatePayload, WatiResponse } from "./types.ts";

/**
 * Send WhatsApp template message via Wati API
 */
export async function sendWatiTemplate(
  phoneNumber: string,
  templateName: string,
  parameters: Record<string, string>,
  watiApiToken: string,
  watiBaseUrl: string
): Promise<WatiResponse> {
  // Format phone number (add 91 prefix if not present)
  const formattedPhone = phoneNumber.startsWith("91")
    ? phoneNumber
    : `91${phoneNumber}`;

  const url = `${watiBaseUrl}/api/v2/sendTemplateMessage?whatsappNumber=${formattedPhone}`;

  // Convert parameters object to Wati format
  const watiParameters = Object.entries(parameters).map(([name, value]) => ({
    name,
    value,
  }));

  const payload: WatiTemplatePayload = {
    template_name: templateName,
    broadcast_name: templateName,
    parameters: watiParameters,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${watiApiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Wati API error: ${response.status} - ${JSON.stringify(data)}`
      );
    }

    return data as WatiResponse;
  } catch (error) {
    console.error("Error sending Wati message:", error);
    throw error;
  }
}

/**
 * Build Wati parameters from booking data and template
 */
export function buildWatiParameters(
  userName: string,
  formattedDateTime: string,
  facilityName: string,
  sportName: string,
  facilityMapLink: string
): Record<string, string> {
  return {
    name: userName,
    datetime: formattedDateTime,
    facility_name: facilityName,
    sport_name: sportName,
    facility_map_link: facilityMapLink,
  };
}

/**
 * Validate Wati configuration
 */
export function validateWatiConfig(
  apiToken?: string,
  baseUrl?: string
): { valid: boolean; error?: string } {
  if (!apiToken) {
    return {
      valid: false,
      error: "WATI_API_TOKEN environment variable is not set",
    };
  }

  if (!baseUrl) {
    return {
      valid: false,
      error: "WATI_BASE_URL environment variable is not set",
    };
  }

  return { valid: true };
}
