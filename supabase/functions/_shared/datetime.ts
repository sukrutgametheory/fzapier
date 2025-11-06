/**
 * Format date and time for display
 * Converts "2025-10-21T00:00:00.000Z" + "19:00" to "21st Oct 2025 at 7pm"
 */
export function formatDateTime(eventDateISO: string, startTime: string): string {
  const date = new Date(eventDateISO);

  // Get day with ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const day = date.getDate();
  const ordinalSuffix = getOrdinalSuffix(day);

  // Get month abbreviation
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const month = monthNames[date.getMonth()];

  // Get year
  const year = date.getFullYear();

  // Format time (convert 24h to 12h format)
  const formattedTime = formatTime(startTime);

  return `${day}${ordinalSuffix} ${month} ${year} at ${formattedTime}`;
}

/**
 * Get ordinal suffix for a day (st, nd, rd, th)
 */
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
 * Convert 24-hour time to 12-hour format with am/pm
 * "19:00" -> "7pm"
 * "09:30" -> "9:30am"
 */
export function formatTime(time24: string): string {
  const [hourStr, minuteStr] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;

  // Only show minutes if not :00
  if (minute === 0) {
    return `${hour12}${period}`;
  }

  return `${hour12}:${minuteStr}${period}`;
}

/**
 * Combine event date and start time into a full ISO datetime string
 * Used for Google Calendar
 */
export function combineDateTime(eventDateISO: string, startTime: string): string {
  const date = new Date(eventDateISO);
  const [hour, minute] = startTime.split(":");

  date.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);

  return date.toISOString();
}

/**
 * Add hours to a datetime
 * Used for calculating end time (typically 1-2 hours after start)
 */
export function addHours(datetimeISO: string, hours: number): string {
  const date = new Date(datetimeISO);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

/**
 * Format date for calendar event title
 * "2025-10-21T00:00:00.000Z" -> "Oct 21, 2025"
 */
export function formatDateForCalendar(dateISO: string): string {
  const date = new Date(dateISO);
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
