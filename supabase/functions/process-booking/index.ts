import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import type {
  BookingPayload,
  WorkflowResponse,
} from "../_shared/types.ts";
import { formatDateTime, combineDateTime, addHours } from "../_shared/datetime.ts";
import {
  sendWatiTemplate,
  buildWatiParameters,
  validateWatiConfig,
} from "../_shared/wati.ts";
import {
  createCalendarEvent,
  buildCalendarEvent,
  buildCalendarDescription,
  validateCalendarConfig,
} from "../_shared/calendar.ts";
import {
  createSupabaseClient,
  getSportTemplate,
  getFacility,
  createWorkflowExecution,
  updateWorkflowWhatsAppResult,
  updateWorkflowCalendarResult,
  completeWorkflowExecution,
} from "../_shared/database.ts";

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const watiApiToken = Deno.env.get("WATI_API_TOKEN");
    const watiBaseUrl = Deno.env.get("WATI_BASE_URL");
    const googleServiceAccount = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");

    // Validate configurations
    const watiValidation = validateWatiConfig(watiApiToken, watiBaseUrl);
    if (!watiValidation.valid) {
      throw new Error(watiValidation.error);
    }

    const calendarValidation = validateCalendarConfig(googleServiceAccount);
    if (!calendarValidation.valid) {
      throw new Error(calendarValidation.error);
    }

    // Parse request body
    const payload: BookingPayload = await req.json();

    console.log("Received booking payload:", JSON.stringify(payload, null, 2));

    // Extract data from payload
    const userName = payload["User Name"];
    const userPhone = payload["User Phone Number"];
    const userEmail = payload["User Email"];
    const sportName = payload["Sport Name"];
    const eventType = payload["Event Type"];

    // Get first slot (assuming single slot for now)
    const slot = payload.Slots[0];
    const facilityName = slot.facilityName;
    const courtName = slot.courtName;
    const eventDate = slot.eventDate;
    const startTime = slot.startTime;

    // Create Supabase client
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

    // Create workflow execution log
    const executionId = await createWorkflowExecution(
      supabase,
      payload as unknown as Record<string, unknown>,
      userName,
      userEmail,
      userPhone,
      sportName,
      eventType,
      facilityName,
      new Date(eventDate)
    );

    console.log(`Created workflow execution: ${executionId}`);

    // Get sport template from database
    const sportTemplate = await getSportTemplate(supabase, sportName);
    if (!sportTemplate) {
      throw new Error(
        `Sport template not found for sport: ${sportName}. Please add it to the database first.`
      );
    }

    // Get facility information from existing facilities table
    const facility = await getFacility(supabase, facilityName);
    const facilityMapLink = facility?.map_link || "";
    const facilityAddress = facility?.address || facilityName;

    // Format datetime
    const formattedDateTime = formatDateTime(eventDate, startTime);
    const startDateTime = combineDateTime(eventDate, startTime);
    const endDateTime = addHours(startDateTime, 1); // Default 1 hour duration

    console.log(`Formatted datetime: ${formattedDateTime}`);
    console.log(`Start: ${startDateTime}, End: ${endDateTime}`);

    // Track results
    let whatsappSent = false;
    let calendarSent = false;
    const errors: string[] = [];

    // Send WhatsApp message via Wati
    try {
      console.log("Sending WhatsApp message...");

      const watiParams = buildWatiParameters(
        userName,
        formattedDateTime,
        facilityName,
        sportName,
        facilityMapLink
      );

      const watiResponse = await sendWatiTemplate(
        userPhone,
        sportTemplate.wati_template_name,
        watiParams,
        watiApiToken!,
        watiBaseUrl!
      );

      whatsappSent = true;
      await updateWorkflowWhatsAppResult(
        supabase,
        executionId,
        true,
        watiResponse as unknown as Record<string, unknown>
      );

      console.log("WhatsApp message sent successfully");
    } catch (error) {
      const errorMsg = `WhatsApp error: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      errors.push(errorMsg);

      await updateWorkflowWhatsAppResult(
        supabase,
        executionId,
        false,
        undefined,
        errorMsg
      );
    }

    // Send Google Calendar invite
    try {
      console.log("Creating calendar event...");

      const calendarDescription = buildCalendarDescription(
        sportTemplate.calendar_description_template || "",
        facilityName,
        formattedDateTime,
        sportTemplate.please_bring,
        sportTemplate.we_will_provide
      );

      const calendarEvent = buildCalendarEvent(
        userName,
        userEmail,
        sportName,
        facilityName,
        startDateTime,
        endDateTime,
        calendarDescription,
        facilityAddress
      );

      const calendarResponse = await createCalendarEvent(
        calendarEvent,
        googleServiceAccount!
      );

      calendarSent = true;
      await updateWorkflowCalendarResult(
        supabase,
        executionId,
        true,
        calendarResponse as unknown as Record<string, unknown>
      );

      console.log("Calendar event created successfully");
    } catch (error) {
      const errorMsg = `Calendar error: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      errors.push(errorMsg);

      await updateWorkflowCalendarResult(
        supabase,
        executionId,
        false,
        undefined,
        errorMsg
      );
    }

    // Determine final status
    let finalStatus: "completed" | "failed" | "partial";
    if (whatsappSent && calendarSent) {
      finalStatus = "completed";
    } else if (!whatsappSent && !calendarSent) {
      finalStatus = "failed";
    } else {
      finalStatus = "partial";
    }

    // Complete workflow execution
    await completeWorkflowExecution(
      supabase,
      executionId,
      finalStatus,
      errors.length > 0 ? errors.join("; ") : undefined
    );

    // Build response
    const response: WorkflowResponse = {
      success: finalStatus !== "failed",
      execution_id: executionId,
      whatsapp_sent: whatsappSent,
      calendar_sent: calendarSent,
    };

    if (errors.length > 0) {
      response.errors = errors;
    }

    console.log("Workflow completed:", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: finalStatus === "failed" ? 500 : 200,
    });
  } catch (error) {
    console.error("Fatal error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
