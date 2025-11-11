// ============================================================================
// COMMUNITY BOOKING CONFIRMATION - Single Edge Function
// Sends WhatsApp confirmation via Wati + Calendar invite via AWS SES
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// 👇 NEW: use AWS SDK (ESM build)
import { SESClient, SendRawEmailCommand } from "https://esm.sh/@aws-sdk/client-ses@3.926.0?target=deno&bundle";
// 👇 Import base64 encoding from Deno standard library
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Format datetime: "2025-10-21T00:00:00.000Z" + "19:00" → "21st Oct 2025 at 7pm"
 */ function formatDateTime(eventDateISO, startTime) {
  const date = new Date(eventDateISO);
  const day = date.getDate();
  const ordinal = getOrdinalSuffix(day);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const [hour, minute] = startTime.split(":");
  const h = parseInt(hour);
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 || 12;
  const timeStr = parseInt(minute) === 0 ? `${hour12}${period}` : `${hour12}:${minute}${period}`;
  return `${day}${ordinal} ${month} ${year} at ${timeStr}`;
}
function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return "th";
  switch(day % 10){
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
/**
 * Combine date and time into ISO datetime
 */ function combineDateTime(eventDateISO, startTime) {
  const date = new Date(eventDateISO);
  const [hour, minute] = startTime.split(":");
  date.setHours(parseInt(hour), parseInt(minute), 0, 0);
  return date.toISOString();
}
/**
 * Add hours to datetime
 */ function addHours(datetimeISO, hours) {
  const date = new Date(datetimeISO);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}
/**
 * Generate ICS calendar file
 */ function generateICS(summary, description, location, startDateTime, endDateTime, organizerEmail, organizerName, attendeeEmail, attendeeName) {
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
    "END:VCALENDAR"
  ];
  return icsLines.join("\r\n");
}
function formatICSDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}
function escapeICS(text) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
// ============================================================================
// WATI (WhatsApp) FUNCTIONS
// ============================================================================
async function sendWhatsAppMessage(phoneNumber, templateName, parameters, watiApiToken, watiBaseUrl) {
  try {
    // Clean up inputs (trim whitespace)
    const cleanToken = watiApiToken.trim();
    const cleanBaseUrl = watiBaseUrl.trim().replace(/\/$/, ""); // Remove trailing slash
    const formattedPhone = phoneNumber.startsWith("91") ? phoneNumber : `91${phoneNumber}`;
    const url = `${cleanBaseUrl}/api/v2/sendTemplateMessage?whatsappNumber=${formattedPhone}`;

    const payload = {
      template_name: templateName,
      broadcast_name: templateName,
      parameters: parameters
    };
    console.log(`📤 Sending to Wati: ${url}`);
    console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));
    console.log(`🔑 Token format: ${cleanToken.substring(0, 10)}...${cleanToken.substring(cleanToken.length - 4)} (length: ${cleanToken.length})`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": cleanToken
      },
      body: JSON.stringify(payload)
    });
    console.log(`📡 Wati response status: ${response.status}`);
    // Get response text first to handle empty or non-JSON responses
    const responseText = await response.text();
    console.log(`📄 Wati response body: ${responseText}`);
    // Try to parse as JSON if there's content
    let data = null;
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
    return {
      success: true,
      response: data
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ WhatsApp failed:", errorMsg);
    return {
      success: false,
      error: errorMsg
    };
  }
}
// ============================================================================
// AWS SES (Email) FUNCTIONS - UPDATED TO USE AWS SDK
// ============================================================================
async function sendEmailWithCalendarInvite(toEmail, toName, subject, textBody, icsContent, icsFilename, awsRegion, awsAccessKeyId, awsSecretAccessKey, fromEmail, fromName) {
  try {
    // Helper function to base64 encode UTF-8 strings properly for Deno
    const utf8ToBase64 = (str) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      // Use Deno standard library base64 encoding (handles UTF-8 properly)
      return base64Encode(data);
    };

    // Build MIME email with ICS attachment
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(7)}@gametheory.in>`;
    const date = new Date().toUTCString();

    // Base64 encode all bodies to handle UTF-8 (emojis, special chars)
    const textBodyBase64 = utf8ToBase64(textBody);
    const htmlBody = textBody.replace(/\n/g, "<br>");
    const htmlBodyBase64 = utf8ToBase64(htmlBody);
    const icsBase64 = utf8ToBase64(icsContent);

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
      `Content-Transfer-Encoding: base64`,
      ``,
      textBodyBase64,
      ``,
      `--${boundary}-alt`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      htmlBodyBase64,
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
      `--${boundary}--`
    ].join("\r\n");
    // SDK wants Uint8Array, not base64 string
    const rawEmailBytes = new TextEncoder().encode(rawEmail);
    const client = new SESClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
        defaultsMode: "standard"
      }
    });
    const command = new SendRawEmailCommand({
      RawMessage: {
        Data: rawEmailBytes
      }
    });
    const resp = await client.send(command);
    console.log("✅ Email sent successfully via SES SDK", resp);
    return {
      success: true,
      messageId: resp.MessageId
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("❌ Email failed:", errorMsg);
    return {
      success: false,
      error: errorMsg
    };
  }
}
// ============================================================================
// MAIN EDGE FUNCTION
// ============================================================================
serve(async (req)=>{
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  const startTime = Date.now();
  console.log("🚀 Processing booking confirmation...");
  try {
    // ========================================================================
    // 1. LOAD CONFIGURATION
    // ========================================================================
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const watiApiToken = Deno.env.get("WATI_API_TOKEN");
    const watiBaseUrl = Deno.env.get("WATI_BASE_URL");
    const awsRegion = Deno.env.get("AWS_REGION");
    const awsAccessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const awsSecretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    const emailFromAddress = Deno.env.get("EMAIL_FROM_ADDRESS") || "noreply@gametheory.in";
    const emailFromName = Deno.env.get("EMAIL_FROM_NAME") || "Game Theory";
    // Log configuration (without exposing sensitive data)
    console.log("🔧 Configuration loaded:");
    console.log(`  - Wati Base URL: ${watiBaseUrl}`);
    console.log(`  - Wati Token length: ${watiApiToken?.length || 0} chars`);
    console.log(`  - AWS Region: ${awsRegion}`);
    console.log(`  - Email From: ${emailFromAddress}`);
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
    let rawPayload = await req.json();
    console.log("📥 Received booking:", JSON.stringify(rawPayload, null, 2));
    // Handle Zapier format (input_data wrapper)
    let payload;
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
    // const userPhone = "919840738620";
    const userEmail = payload["User Email"] || payload.userEmail;
    // const userEmail = "nithya.n@gametheory.in";
    const sportName = payload["Sport Name"] || payload.sportName;
    const eventType = payload["Event Type"] || payload.eventType;
    const eventName = payload["Event Name"] || payload.eventName || 'community_game'; // Default to community_game
    const slots = payload.Slots || payload.slots;
    if (!userName || !userPhone || !userEmail || !sportName || !eventType || !slots || slots.length === 0) {
      throw new Error("Missing required fields in payload");
    }
    const slot = slots[0];
    const facilityName = slot.facilityName;
    const courtName = slot.courtName;
    const eventDate = slot.eventDate;
    const startTime = slot.startTime;

    console.log(`📅 Raw eventDate: ${eventDate}, Raw startTime: ${startTime}`);

    // ========================================================================
    // 3. FORMAT DATE/TIME
    // ========================================================================
    // For WhatsApp: use raw data from payload as-is
    // For Calendar: try to create valid ISO dates, fallback to defaults if parsing fails
    let startDateTime, endDateTime;
    let eventDateISO;

    try {
      // Try to parse eventDate for calendar and database
      const dateObj = new Date(eventDate);
      if (!isNaN(dateObj.getTime())) {
        // Valid date, use it
        eventDateISO = dateObj.toISOString();

        // Try to parse if startTime is in "HH:MM" format (e.g., "19:00")
        if (startTime && startTime.includes(":") && !startTime.includes("AM") && !startTime.includes("PM") && !startTime.includes("-")) {
          startDateTime = combineDateTime(eventDate, startTime);
          endDateTime = addHours(startDateTime, 1);
        } else {
          // If startTime is in "9AM - 10AM" format or any other format, use date with 9AM as default
          const date = new Date(eventDate);
          date.setHours(9, 0, 0, 0); // Default to 9:00 AM
          startDateTime = date.toISOString();
          endDateTime = addHours(startDateTime, 1);
        }
      } else {
        // Invalid date, use current date as fallback
        console.warn(`⚠️ Could not parse eventDate: ${eventDate}, using current date`);
        const now = new Date();
        eventDateISO = now.toISOString();
        now.setHours(9, 0, 0, 0);
        startDateTime = now.toISOString();
        endDateTime = addHours(startDateTime, 1);
      }

      console.log(`📅 Using eventDateISO: ${eventDateISO}, startDateTime: ${startDateTime}`);
    } catch (e) {
      // Ultimate fallback - use current date/time
      console.error(`❌ Date parsing error:`, e);
      const now = new Date();
      eventDateISO = now.toISOString();
      now.setHours(9, 0, 0, 0);
      startDateTime = now.toISOString();
      endDateTime = addHours(startDateTime, 1);
      console.log(`⚠️ Using fallback datetime: ${startDateTime}`);
    }
    // ========================================================================
    // 4. GET DATA FROM DATABASE
    // ========================================================================
    const supabase = createClient(supabaseUrl, supabaseKey);
    // Get sport template (filter by use_case for community bookings)
    // Get Wati template (filter by sport_name, event_name, and event_type)
    console.log(`🔍 Looking for template: sport=${sportName}, event_name=${eventName}, event_type=${eventType}`);
    const { data: sportTemplate, error: sportError } = await supabase.from("wati_templates").select("*").eq("sport_name", sportName).eq("event_name", eventName).eq("event_type", eventType).single();
    if (sportError || !sportTemplate) {
      console.error(`❌ Template query error:`, sportError);
      throw new Error(`Wati template not found for: ${sportName} / ${eventName} / ${eventType}. Please add it to the wati_templates table first.`);
    }
    console.log(`✅ Found template: ${sportTemplate.wati_template_name}`);
    console.log(`📋 Variable mapping:`, sportTemplate.variable_attribute_mapping);
    // Get facility info
    const { data: facility, error: facilityError } = await supabase.from("facilities").select("*").eq("facility_name", facilityName).single();
    console.log(`🏢 Facility lookup for "${facilityName}":`, facility ? "Found" : "Not found");
    if (facilityError) {
      console.log(`⚠️ Facility query error:`, facilityError);
    }
    if (facility) {
      console.log(`  - Address: ${facility.google_location || "N/A"}`);
      console.log(`  - Map Link: ${facility.google_maps_link || "EMPTY"}`);
    }
    // Use facility data or defaults (column names: google_maps_link, google_location)
    const facilityMapLink = facility?.google_maps_link;
    const facilityAddress = facility?.google_location || facilityName;
    console.log(`📍 Using Map Link: ${facilityMapLink}`);
    // Create execution log
    const { data: execution, error: execError } = await supabase.from("community_booking_confirmation_workflow_executions").insert({
      status: "processing",
      input_data: payload,
      user_name: userName,
      user_email: userEmail,
      user_phone: userPhone,
      sport_name: sportName,
      event_type: eventType,
      facility_name: facilityName,
      event_date: eventDateISO
    }).select("id").single();
    if (execError) {
      throw new Error(`Failed to create execution log: ${execError.message}`);
    }
    const executionId = execution.id;
    console.log(`📝 Execution ID: ${executionId}`);
    // ========================================================================
    // 5. BUILD WHATSAPP PARAMETERS DYNAMICALLY
    // ========================================================================

    // Build data context for parameter mapping
    const dataContext = {
      userName,
      userPhone,
      userEmail,
      sportName,
      facilityName,
      startTime,  // Use raw startTime from payload (e.g., "9AM - 10AM")
      eventDate,  // Raw event date
      facilityMapLink,
      facilityAddress,
      courtName,
      eventType,
      eventName,
    };

    // Build parameters dynamically using template's variable mapping
    const watiParameters = [];
    const mapping = sportTemplate.variable_attribute_mapping || {};

    console.log(`🗺️ Variable mapping:`, JSON.stringify(mapping, null, 2));

    for (const [watiVarName, sourceField] of Object.entries(mapping)) {
      let value;

      // Check if it's a direct field from dataContext
      if (dataContext[sourceField] !== undefined) {
        value = String(dataContext[sourceField]);
      }
      // Check if it's an attribute field
      else if (sourceField.startsWith('attribute_')) {
        const attrData = sportTemplate[sourceField];
        // If it's an array, join with commas
        if (Array.isArray(attrData)) {
          value = attrData.join(', ');
        } else {
          value = String(attrData || '');
        }
      }
      // Fallback
      else {
        value = '';
        console.warn(`⚠️ Source field "${sourceField}" not found in dataContext`);
      }

      watiParameters.push({
        name: watiVarName,
        value: value || 'N/A',
      });
    }

    console.log(`📋 Built WhatsApp parameters:`, JSON.stringify(watiParameters, null, 2));

    // ========================================================================
    // 6. SEND WHATSAPP MESSAGE
    // ========================================================================
    console.log("📱 Sending WhatsApp message...");
    const whatsappResult = await sendWhatsAppMessage(userPhone, sportTemplate.wati_template_name, watiParameters, watiApiToken, watiBaseUrl);
    await supabase.from("community_booking_confirmation_workflow_executions").update({
      whatsapp_sent: whatsappResult.success,
      whatsapp_response: whatsappResult.response || null,
      whatsapp_error: whatsappResult.error || null
    }).eq("id", executionId);
    // ========================================================================
    // 6. SEND EMAIL WITH CALENDAR INVITE
    // ========================================================================
    console.log("📧 Sending email with calendar invite...");
    // Build calendar description
    let calendarDescription = sportTemplate.calendar_description_template || "";
    calendarDescription = calendarDescription.replace(/\{\{userName\}\}/g, userName).replace(/\{\{facilityName\}\}/g, facilityName).replace(/\{\{startTime\}\}/g, startTime);

    // Attributes are now TEXT, not arrays
    // attribute_1: please_bring
    if (sportTemplate.attribute_1 && sportTemplate.attribute_1.trim().length > 0) {
      calendarDescription += "\n\nPlease bring:\n👉 " + sportTemplate.attribute_1;
    }
    // attribute_2: we_will_provide
    if (sportTemplate.attribute_2 && sportTemplate.attribute_2.trim().length > 0) {
      calendarDescription += "\n\nWe'll provide:\n🎯 " + sportTemplate.attribute_2;
    }
    // attribute_3: tips
    if (sportTemplate.attribute_3 && sportTemplate.attribute_3.trim().length > 0) {
      calendarDescription += "\n\nTips:\n💡 " + sportTemplate.attribute_3;
    }
    // Generate ICS file
    const icsContent = generateICS(`${sportName} - Community Game`, calendarDescription, facilityAddress, startDateTime, endDateTime, emailFromAddress, emailFromName, userEmail, userName);
    // Send email
    const emailSubject = `Calendar Invite: ${sportName} at ${startTime}`;
    const emailBody = `Hi ${userName},\n\nYour ${sportName} booking is confirmed!\n\n${calendarDescription}\n\nPlease find the calendar invite attached. Click on it to add to your calendar.\n\nSee you there!\nTeam Game Theory`;
    const emailResult = await sendEmailWithCalendarInvite(userEmail, userName, emailSubject, emailBody, icsContent, `booking-${sportName.toLowerCase()}.ics`, awsRegion, awsAccessKeyId, awsSecretAccessKey, emailFromAddress, emailFromName);
    await supabase.from("community_booking_confirmation_workflow_executions").update({
      calendar_sent: emailResult.success,
      calendar_response: emailResult.messageId ? {
        messageId: emailResult.messageId
      } : null,
      calendar_error: emailResult.error || null
    }).eq("id", executionId);
    // ========================================================================
    // 7. FINALIZE AND RESPOND
    // ========================================================================
    let finalStatus;
    const errors = [];
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
    await supabase.from("community_booking_confirmation_workflow_executions").update({
      status: finalStatus,
      error_message: errors.length > 0 ? errors.join("; ") : null,
      completed_at: new Date().toISOString()
    }).eq("id", executionId);
    const duration = Date.now() - startTime;
    console.log(`⏱️ Completed in ${duration}ms`);
    return new Response(JSON.stringify({
      success: finalStatus !== "failed",
      execution_id: executionId,
      whatsapp_sent: whatsappResult.success,
      calendar_sent: emailResult.success,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: finalStatus === "failed" ? 500 : 200
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("💥 Fatal error:", errorMsg);
    return new Response(JSON.stringify({
      success: false,
      error: errorMsg
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});
