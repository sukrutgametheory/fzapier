import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { SportTemplate, Facility, WorkflowExecution } from "./types.ts";

/**
 * Create Supabase client for database operations
 */
export function createSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Get sport template from database
 */
export async function getSportTemplate(
  client: SupabaseClient,
  sportName: string
): Promise<SportTemplate | null> {
  const { data, error } = await client
    .from("community_booking_confirmation_sport_templates")
    .select("*")
    .eq("sport_name", sportName)
    .single();

  if (error) {
    console.error("Error fetching sport template:", error);
    return null;
  }

  return data as SportTemplate;
}

/**
 * Get facility information from existing facilities table
 */
export async function getFacility(
  client: SupabaseClient,
  facilityName: string
): Promise<Facility | null> {
  const { data, error } = await client
    .from("facilities")
    .select("*")
    .eq("name", facilityName)
    .single();

  if (error) {
    console.error("Error fetching facility:", error);
    return null;
  }

  return data as Facility;
}

/**
 * Create a new workflow execution log
 */
export async function createWorkflowExecution(
  client: SupabaseClient,
  inputData: Record<string, unknown>,
  userName: string,
  userEmail: string,
  userPhone: string,
  sportName: string,
  eventType: string,
  facilityName: string,
  eventDate: Date
): Promise<string> {
  const { data, error } = await client
    .from("community_booking_confirmation_workflow_executions")
    .insert({
      status: "processing",
      input_data: inputData,
      user_name: userName,
      user_email: userEmail,
      user_phone: userPhone,
      sport_name: sportName,
      event_type: eventType,
      facility_name: facilityName,
      event_date: eventDate.toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating workflow execution:", error);
    throw new Error(`Failed to create workflow execution: ${error.message}`);
  }

  return data.id;
}

/**
 * Update workflow execution with WhatsApp result
 */
export async function updateWorkflowWhatsAppResult(
  client: SupabaseClient,
  executionId: string,
  sent: boolean,
  response?: Record<string, unknown>,
  error?: string
): Promise<void> {
  const updateData: any = {
    whatsapp_sent: sent,
  };

  if (response) {
    updateData.whatsapp_response = response;
  }

  if (error) {
    updateData.whatsapp_error = error;
  }

  const { error: dbError } = await client
    .from("community_booking_confirmation_workflow_executions")
    .update(updateData)
    .eq("id", executionId);

  if (dbError) {
    console.error("Error updating WhatsApp result:", dbError);
  }
}

/**
 * Update workflow execution with Calendar result
 */
export async function updateWorkflowCalendarResult(
  client: SupabaseClient,
  executionId: string,
  sent: boolean,
  response?: Record<string, unknown>,
  error?: string
): Promise<void> {
  const updateData: any = {
    calendar_sent: sent,
  };

  if (response) {
    updateData.calendar_response = response;
  }

  if (error) {
    updateData.calendar_error = error;
  }

  const { error: dbError } = await client
    .from("community_booking_confirmation_workflow_executions")
    .update(updateData)
    .eq("id", executionId);

  if (dbError) {
    console.error("Error updating calendar result:", dbError);
  }
}

/**
 * Complete workflow execution (success or failure)
 */
export async function completeWorkflowExecution(
  client: SupabaseClient,
  executionId: string,
  status: "completed" | "failed" | "partial",
  errorMessage?: string
): Promise<void> {
  const updateData: any = {
    status,
    completed_at: new Date().toISOString(),
  };

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await client
    .from("community_booking_confirmation_workflow_executions")
    .update(updateData)
    .eq("id", executionId);

  if (error) {
    console.error("Error completing workflow execution:", error);
  }
}
