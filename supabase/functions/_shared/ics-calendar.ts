/**
 * Generate ICS (iCalendar) file content for calendar invites
 * This can be sent via email to any calendar client
 */

export interface ICSEventData {
  summary: string;
  description: string;
  location: string;
  startDateTime: string; // ISO format
  endDateTime: string; // ISO format
  organizerEmail: string;
  organizerName: string;
  attendeeEmail: string;
  attendeeName: string;
}

/**
 * Generate ICS file content
 */
export function generateICS(event: ICSEventData): string {
  // Generate unique ID for the event
  const eventId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const timestamp = formatICSDate(new Date());

  // Format dates for ICS (must be in format: YYYYMMDDTHHmmssZ)
  const startDate = formatICSDate(new Date(event.startDateTime));
  const endDate = formatICSDate(new Date(event.endDateTime));

  // Escape special characters in text fields
  const summary = escapeICSText(event.summary);
  const description = escapeICSText(event.description);
  const location = escapeICSText(event.location);

  // Build ICS content
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
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `ORGANIZER;CN=${escapeICSText(event.organizerName)}:mailto:${event.organizerEmail}`,
    `ATTENDEE;CN=${escapeICSText(event.attendeeName)};RSVP=TRUE:mailto:${event.attendeeEmail}`,
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

  // Join with CRLF (required by ICS spec)
  return icsLines.join("\r\n");
}

/**
 * Format date to ICS format (YYYYMMDDTHHmmssZ)
 */
function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape special characters for ICS text fields
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\") // Backslash
    .replace(/;/g, "\\;") // Semicolon
    .replace(/,/g, "\\,") // Comma
    .replace(/\n/g, "\\n"); // Newline
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
