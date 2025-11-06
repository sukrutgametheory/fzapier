// Input payload structure
export interface BookingPayload {
  "User Name": string;
  "User Phone Number": string;
  "User Email": string;
  "Slots": Slot[];
  "Sport Name": string;
  "Event Type": "COMMUNITY_GAME" | "PRIVATE_BOOKING" | "TOURNAMENT" | "TRAINING";
}

export interface Slot {
  facilityName: string;
  courtName: string;
  startTime: string; // Format: "HH:MM"
  eventDate: string; // ISO format: "2025-10-21T00:00:00.000Z"
}

// Database types
export interface SportTemplate {
  id: string;
  sport_name: string;
  wati_template_name: string;
  whatsapp_message_template: string;
  please_bring: string[];
  we_will_provide: string[];
  tips: string[];
  calendar_description_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface Facility {
  id: string;
  name: string;
  address: string | null;
  map_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecution {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "partial";
  input_data: Record<string, unknown>;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  sport_name: string | null;
  event_type: string | null;
  facility_name: string | null;
  event_date: string | null;
  whatsapp_sent: boolean;
  whatsapp_response: Record<string, unknown> | null;
  whatsapp_error: string | null;
  calendar_sent: boolean;
  calendar_response: Record<string, unknown> | null;
  calendar_error: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// Wati API types
export interface WatiParameter {
  name: string;
  value: string;
}

export interface WatiTemplatePayload {
  template_name: string;
  broadcast_name: string;
  parameters: WatiParameter[];
}

export interface WatiResponse {
  result: boolean;
  info?: string;
  error?: string;
}

// Google Calendar API types
export interface CalendarEvent {
  summary: string;
  description: string;
  location: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees: Array<{
    email: string;
  }>;
  reminders: {
    useDefault: boolean;
  };
}

export interface CalendarResponse {
  id: string;
  htmlLink: string;
  status: string;
}

// Workflow response
export interface WorkflowResponse {
  success: boolean;
  execution_id: string;
  whatsapp_sent: boolean;
  calendar_sent: boolean;
  errors?: string[];
}

// Formatted booking data for processing
export interface FormattedBookingData {
  userName: string;
  userPhone: string;
  userEmail: string;
  sportName: string;
  eventType: string;
  facilityName: string;
  courtName: string;
  eventDate: Date;
  startTime: string;
  formattedDateTime: string; // e.g., "21st Oct 2025 at 7pm"
  mapLink: string;
}
