// ============================================================================
// COMMUNITY BOOKING CONFIRMATION - Single Edge Function
// Sends WhatsApp confirmation via Wati + Calendar invite via AWS SES
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Support both formats: Zapier webhook (camelCase) and direct API (Title Case)
interface BookingPayload {
  // Zapier format (wrapped in input_data)
  input_data?: string;

  // Direct format (Title Case with spaces)
  "User Name"?: string;
  "User Phone Number"?: string;
  "User Email"?: string;
  "Slots"?: Array<{
    facilityName: string;
    courtName: string;
    startTime: string;
    eventDate: string;
  }>;
  "Sport Name"?: string;
  "Event Type"?: string;

  // Zapier format (camelCase)
  userName?: string;
  userPhoneNumber?: string;
  userEmail?: string;
  slots?: Array<{
    facilityName: string;
    courtName: string;
    startTime: string;
    eventDate: string;
  }>;
  sportName?: string;
  eventType?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format datetime: "2025-10-21T00:00:00.000Z" + "19:00" → "21st Oct 2025 at 7pm"
 */
function formatDateTime(eventDateISO: string, startTime: string): string {
  const date = new Date(eventDateISO);
  const day = date.getDate();
  const ordinal = getOrdinalSuffix(day);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const [hour, minute] = startTime.split(":");
  const h = parseInt(hour);
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 || 12;
  const timeStr = parseInt(minute) === 0 ? `${hour12}${period}` : `${hour12}:${minute}${period}`;

  return `${day}${ordinal} ${month} ${year} at ${timeStr}`;
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/**
 * Combine date and time into ISO datetime
 */
function combineDateTime(eventDateISO: string, startTime: string): string {
  const date = new Date(eventDateISO);
  const [hour, minute] = startTime.split(":");
  date.setHours(parseInt(hour), parseInt(minute), 0, 0);
  return date.toISOString();
}

/**
 * Add hours to datetime
 */
function addHours(datetimeISO: string, hours: number): string {
  const date = new Date(datetimeISO);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

/**
 * Generate ICS calendar file
 */
function generateICS(
  summary: string,
  description: string,
  location: string,
  startDateTime: string,
  endDateTime: string,
  organizerEmail: string,
  organizerName: string,
  attendeeEmail: string,
  attendeeName: string
): string {
  const eventId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const timestamp = formatICSDate(new Date());
  const startDate = formatICSDate(new Date(startDateTime));
  const endDate = formatICSDate(new Date(endDateTime));

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Game Theory//FZapier//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${eventId}@gametheory.in`,
    `DTSTAMP:${timestamp}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    `ORGANIZER;CN=${escapeICS(organizerName)}:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${escapeICS(attendeeName)};RSVP=TRUE:mailto:${attendeeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return icsLines.join("\r\n");
}

function formatICSDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// ============================================================================
// WATI (WhatsApp) FUNCTIONS
// ============================================================================

async function sendWhatsAppMessage(
  phoneNumber: string,
  templateName: string,
  userName: string,
  formattedDateTime: string,
  facilityName: string,
  sportName: string,
  facilityMapLink: string,
  watiApiToken: string,
  watiBaseUrl: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
    const formattedPhone = phoneNumber.startsWith("91") ? phoneNumber : `91${phoneNumber}`;
    const url = `${watiBaseUrl}/api/v2/sendTemplateMessage?whatsappNumber=${formattedPhone}`;

    const payload = {
      template_name: templateName,
      broadcast_name: templateName,
      parameters: [
        { name: "name", value: userName },
        { name: "datetime", value: formattedDateTime },
        { name: "facility_name", value: facilityName },
        { name: "sport_name", value: sportName },
        { name: "facility_map_link", value: facilityMapLink },
      ],
    };

    console.log(`📤 Sending to Wati: ${url}`);
    console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${watiApiToken}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`📡 Wati response status: ${response.status}`);

    // Get response text first to handle empty or non-JSON responses
    const responseText = await response.text();
    console.log(`📄 Wati response body: ${responseText}`);

    // Try to parse as JSON if there's content
    let data: any = null;
    if (responseText && responseText.trim().length > 0) {
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("⚠️ Failed to parse Wati response as JSON:", parseError);
        throw new Error(`Wati returned non-JSON response (${response.status}): ${responseText.substring(0, 200)}`);
      }
    }

    if (!response.ok) {
      throw new Error(`Wati API error (${response.status}): ${responseText.substring(0, 500)}`);
    }

    console.log("✅ WhatsApp sent successfully");
    return { success: true, response: data };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ WhatsApp failed:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// AWS SES (Email) FUNCTIONS
// ============================================================================

async function sendEmailWithCalendarInvite(
  toEmail: string,
  toName: string,
  subject: string,
  textBody: string,
  icsContent: string,
  icsFilename: string,
  awsRegion: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  fromEmail: string,
  fromName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Build MIME email with ICS attachment
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(7)}@gametheory.in>`;
    const date = new Date().toUTCString();
    const icsBase64 = btoa(icsContent);
    const htmlBody = textBody.replace(/\n/g, "<br>");

    const rawEmail = [
      `From: ${fromName} <${fromEmail}>`,
      `To: ${toName} <${toEmail}>`,
      `Subject: ${subject}`,
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
      textBody,
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
      `Content-Type: text/calendar; method=REQUEST; name="${icsFilename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${icsFilename}"`,
      ``,
      icsBase64,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    const rawEmailBase64 = btoa(rawEmail);
    const sesEndpoint = `https://email.${awsRegion}.amazonaws.com/`;
    const requestBody = new URLSearchParams({
      Action: "SendRawEmail",
      "RawMessage.Data": rawEmailBase64,
    }).toString();

    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = timestamp.substring(0, 8);
    const signature = await createAWSSignature(
      awsAccessKeyId,
      awsSecretAccessKey,
      awsRegion,
      dateStamp,
      timestamp,
      requestBody
    );

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
      throw new Error(`AWS SES error (${response.status}): ${responseText}`);
    }

    const messageIdMatch = responseText.match(/<MessageId>(.*?)<\/MessageId>/);
    const awsMessageId = messageIdMatch ? messageIdMatch[1] : undefined;

    console.log("✅ Email sent successfully");
    return { success: true, messageId: awsMessageId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Email failed:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

async function createAWSSignature(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  dateStamp: string,
  timestamp: string,
  requestBody: string
): Promise<string> {
  const service = "ses";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

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

  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = await hmacSha256(kSigning, stringToSign);

  return `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=content-type;host;x-amz-date, Signature=${bytesToHex(signature)}`;
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

async function hmacSha256(key: string | Uint8Array, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = typeof key === "string" ? encoder.encode(key) : key;
  const messageData = encoder.encode(message);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return new Uint8Array(signature);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// MAIN EDGE FUNCTION
// ============================================================================

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("🚀 Processing booking confirmation...");

  try {
    // ========================================================================
    // 1. LOAD CONFIGURATION
    // ========================================================================

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const watiApiToken = Deno.env.get("WATI_API_TOKEN");
    const watiBaseUrl = Deno.env.get("WATI_BASE_URL");
    const awsRegion = Deno.env.get("AWS_REGION");
    const awsAccessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const awsSecretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const emailFromAddress = Deno.env.get("EMAIL_FROM_ADDRESS") || "bookings@gametheory.in";
    const emailFromName = Deno.env.get("EMAIL_FROM_NAME") || "Game Theory Bookings";

    // Validate required env vars
    if (!watiApiToken || !watiBaseUrl) {
      throw new Error("Missing Wati configuration (WATI_API_TOKEN, WATI_BASE_URL)");
    }
    if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
      throw new Error("Missing AWS SES configuration (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)");
    }

    // ========================================================================
    // 2. PARSE INPUT
    // ========================================================================

    let rawPayload: BookingPayload = await req.json();
    console.log("📥 Received booking:", JSON.stringify(rawPayload, null, 2));

    // Handle Zapier format (input_data wrapper)
    let payload: BookingPayload;
    if (rawPayload.input_data) {
      try {
        payload = JSON.parse(rawPayload.input_data);
        console.log("📦 Parsed input_data:", JSON.stringify(payload, null, 2));
      } catch (e) {
        throw new Error("Failed to parse input_data field");
      }
    } else {
      payload = rawPayload;
    }

    // Normalize field names (support both formats)
    const userName = payload["User Name"] || payload.userName;
    const userPhone = payload["User Phone Number"] || payload.userPhoneNumber;
    const userEmail = payload["User Email"] || payload.userEmail;
    const sportName = payload["Sport Name"] || payload.sportName;
    const eventType = payload["Event Type"] || payload.eventType;
    const slots = payload.Slots || payload.slots;

    if (!userName || !userPhone || !userEmail || !sportName || !eventType || !slots || slots.length === 0) {
      throw new Error("Missing required fields in payload");
    }

    const slot = slots[0];
    const facilityName = slot.facilityName;
    const courtName = slot.courtName;
    const eventDate = slot.eventDate;
    const startTime = slot.startTime;

    // ========================================================================
    // 3. FORMAT DATE/TIME
    // ========================================================================

    const formattedDateTime = formatDateTime(eventDate, startTime);
    const startDateTime = combineDateTime(eventDate, startTime);
    const endDateTime = addHours(startDateTime, 1);

    console.log(`📅 ${formattedDateTime}`);

    // ========================================================================
    // 4. GET DATA FROM DATABASE
    // ========================================================================

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sport template (filter by use_case for community bookings)
    const { data: sportTemplate, error: sportError } = await supabase
      .from("community_booking_confirmation_sport_templates")
      .select("*")
      .eq("sport_name", sportName)
      .eq("use_case", "community_booking")
      .single();

    if (sportError || !sportTemplate) {
      throw new Error(`Sport template not found for: ${sportName} (use_case: community_booking). Please add it to the database first.`);
    }

    // Get facility info
    const { data: facility } = await supabase
      .from("facilities")
      .select("*")
      .eq("name", facilityName)
      .single();

    const facilityMapLink = facility?.map_link || "";
    const facilityAddress = facility?.address || facilityName;

    // Create execution log
    const { data: execution, error: execError } = await supabase
      .from("community_booking_confirmation_workflow_executions")
      .insert({
        status: "processing",
        input_data: payload,
        user_name: userName,
        user_email: userEmail,
        user_phone: userPhone,
        sport_name: sportName,
        event_type: eventType,
        facility_name: facilityName,
        event_date: new Date(eventDate).toISOString(),
      })
      .select("id")
      .single();

    if (execError) {
      throw new Error(`Failed to create execution log: ${execError.message}`);
    }

    const executionId = execution.id;
    console.log(`📝 Execution ID: ${executionId}`);

    // ========================================================================
    // 5. SEND WHATSAPP MESSAGE
    // ========================================================================

    console.log("📱 Sending WhatsApp message...");
    const whatsappResult = await sendWhatsAppMessage(
      userPhone,
      sportTemplate.wati_template_name,
      userName,
      formattedDateTime,
      facilityName,
      sportName,
      facilityMapLink,
      watiApiToken,
      watiBaseUrl
    );

    await supabase
      .from("community_booking_confirmation_workflow_executions")
      .update({
        whatsapp_sent: whatsappResult.success,
        whatsapp_response: whatsappResult.response || null,
        whatsapp_error: whatsappResult.error || null,
      })
      .eq("id", executionId);

    // ========================================================================
    // 6. SEND EMAIL WITH CALENDAR INVITE
    // ========================================================================

    console.log("📧 Sending email with calendar invite...");

    // Build calendar description
    let calendarDescription = sportTemplate.calendar_description_template || "";
    calendarDescription = calendarDescription
      .replace(/\{\{userName\}\}/g, userName)
      .replace(/\{\{facilityName\}\}/g, facilityName)
      .replace(/\{\{datetime\}\}/g, formattedDateTime);

    // attribute_2: we_will_provide
    if (sportTemplate.attribute_2?.length > 0) {
      calendarDescription += "\n\nWe'll provide:";
      sportTemplate.attribute_2.forEach((item: string) => {
        calendarDescription += `\n🎯 ${item}`;
      });
    }

    // attribute_1: please_bring
    if (sportTemplate.attribute_1?.length > 0) {
      calendarDescription += "\n\nPlease bring:";
      sportTemplate.attribute_1.forEach((item: string) => {
        calendarDescription += `\n👉 ${item}`;
      });
    }

    // attribute_3: tips
    if (sportTemplate.attribute_3?.length > 0) {
      calendarDescription += "\n\nTips:";
      sportTemplate.attribute_3.forEach((item: string) => {
        calendarDescription += `\n💡 ${item}`;
      });
    }

    // Generate ICS file
    const icsContent = generateICS(
      `${sportName} - Community Game`,
      calendarDescription,
      facilityAddress,
      startDateTime,
      endDateTime,
      emailFromAddress,
      emailFromName,
      userEmail,
      userName
    );

    // Send email
    const emailSubject = `Calendar Invite: ${sportName} on ${formattedDateTime}`;
    const emailBody = `Hi ${userName},\n\nYour ${sportName} booking is confirmed!\n\n${calendarDescription}\n\nPlease find the calendar invite attached. Click on it to add to your calendar.\n\nSee you there!\nTeam Game Theory`;

    const emailResult = await sendEmailWithCalendarInvite(
      userEmail,
      userName,
      emailSubject,
      emailBody,
      icsContent,
      `booking-${sportName.toLowerCase()}.ics`,
      awsRegion,
      awsAccessKeyId,
      awsSecretAccessKey,
      emailFromAddress,
      emailFromName
    );

    await supabase
      .from("community_booking_confirmation_workflow_executions")
      .update({
        calendar_sent: emailResult.success,
        calendar_response: emailResult.messageId ? { messageId: emailResult.messageId } : null,
        calendar_error: emailResult.error || null,
      })
      .eq("id", executionId);

    // ========================================================================
    // 7. FINALIZE AND RESPOND
    // ========================================================================

    let finalStatus: "completed" | "failed" | "partial";
    const errors: string[] = [];

    if (!whatsappResult.success) errors.push(`WhatsApp: ${whatsappResult.error}`);
    if (!emailResult.success) errors.push(`Email: ${emailResult.error}`);

    if (whatsappResult.success && emailResult.success) {
      finalStatus = "completed";
      console.log("✅ All tasks completed successfully");
    } else if (!whatsappResult.success && !emailResult.success) {
      finalStatus = "failed";
      console.log("❌ All tasks failed");
    } else {
      finalStatus = "partial";
      console.log("⚠️ Some tasks failed");
    }

    await supabase
      .from("community_booking_confirmation_workflow_executions")
      .update({
        status: finalStatus,
        error_message: errors.length > 0 ? errors.join("; ") : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    const duration = Date.now() - startTime;
    console.log(`⏱️ Completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: finalStatus !== "failed",
        execution_id: executionId,
        whatsapp_sent: whatsappResult.success,
        calendar_sent: emailResult.success,
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: duration,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: finalStatus === "failed" ? 500 : 200,
      }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("💥 Fatal error:", errorMsg);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
