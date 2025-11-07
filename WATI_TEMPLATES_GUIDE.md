## Wati Templates System - Complete Guide

## Overview

The Wati templates system provides flexible, dynamic mapping of booking data to WhatsApp template variables. Each template can define its own variable mapping, making it easy to support different sports, event types, and use cases.

---

## Table Structure

### Table Name: `wati_templates`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `sport_name` | TEXT | Sport identifier (e.g., "Badminton", "Pickleball") |
| `event_name` | TEXT | Event name identifier (e.g., "community_game", "tournament") |
| `event_type` | TEXT | Event type from booking system (e.g., "COMMUNITY_GAME", "TOURNAMENT") |
| `wati_template_name` | TEXT | Wati template identifier |
| `variable_attribute_mapping` | JSONB | Maps Wati variables to data sources |
| `attribute_1` to `attribute_6` | TEXT[] | Dynamic attribute arrays |
| `calendar_description_template` | TEXT | Calendar invite description (future use) |

**Unique Constraint**: `(sport_name, event_name, event_type)` must be unique.

---

## How It Works

### 1. Template Matching

When a booking comes in, the Edge Function looks up the template using:

```typescript
WHERE sport_name = 'Badminton'
  AND event_name = 'community_game'
  AND event_type = 'COMMUNITY_GAME'
```

### 2. Variable Mapping

The `variable_attribute_mapping` JSONB column defines how to map data to Wati template variables:

```json
{
  "name": "userName",
  "datetime": "formattedDateTime",
  "facility_name": "facilityName",
  "sport_name": "sportName",
  "facility_map_link": "facilityMapLink"
}
```

**Available data sources**:

#### Static Fields (from payload/processing):
- `userName` - User's name
- `userPhone` - User's phone number
- `userEmail` - User's email
- `sportName` - Sport name
- `facilityName` - Facility name
- `formattedDateTime` - Formatted date/time (e.g., "25th Oct 2025 at 7pm")
- `facilityMapLink` - Google Maps link
- `facilityAddress` - Facility address
- `courtName` - Court name
- `eventType` - Event type (e.g., "COMMUNITY_GAME")
- `eventName` - Event name (e.g., "community_game")

#### Dynamic Fields (from database):
- `attribute_1` - Array of strings (use defined by template)
- `attribute_2` - Array of strings (use defined by template)
- `attribute_3` - Array of strings (use defined by template)
- `attribute_4` - Array of strings (use defined by template)
- `attribute_5` - Array of strings (use defined by template)
- `attribute_6` - Array of strings (use defined by template)

### 3. Parameter Building

The system automatically:
1. Reads the `variable_attribute_mapping`
2. For each Wati variable, looks up the value from the data source
3. Builds the parameters array for Wati API

**Example**:
```typescript
// Mapping
{
  "name": "userName",
  "datetime": "formattedDateTime"
}

// Results in
[
  { name: "name", value: "Ashwin" },
  { name: "datetime", value: "25th Oct 2025 at 7pm" }
]
```

---

## Creating a Template

### Step 1: Create Wati Template in Wati Dashboard

1. Go to Wati Dashboard → Templates
2. Create a new template
3. Note the exact template name (e.g., `community_badminton_confirmation_v2`)
4. Note the variable names used (e.g., `{{1}}` = name, `{{2}}` = datetime)

### Step 2: Insert into Database

```sql
INSERT INTO wati_templates (
    sport_name,
    event_name,
    event_type,
    wati_template_name,
    variable_attribute_mapping,
    attribute_1,
    attribute_2,
    attribute_3
) VALUES (
    'Badminton',
    'community_game',
    'COMMUNITY_GAME',
    'community_badminton_confirmation_v2',
    '{
      "name": "userName",
      "datetime": "formattedDateTime",
      "facility_name": "facilityName",
      "sport_name": "sportName",
      "facility_map_link": "facilityMapLink"
    }'::jsonb,
    ARRAY['Item 1', 'Item 2'],  -- attribute_1 (optional)
    ARRAY['Item A', 'Item B'],  -- attribute_2 (optional)
    ARRAY['Tip 1', 'Tip 2']     -- attribute_3 (optional)
);
```

---

## Example Use Cases

### Use Case 1: Community Game (Simple)

**Wati Template Variables**:
- `{{1}}` = User name
- `{{2}}` = Date/time
- `{{3}}` = Facility name

**Database Entry**:
```sql
INSERT INTO wati_templates (
    sport_name,
    event_name,
    event_type,
    wati_template_name,
    variable_attribute_mapping
) VALUES (
    'Badminton',
    'community_game',
    'COMMUNITY_GAME',
    'community_badminton_v1',
    '{
      "name": "userName",
      "datetime": "formattedDateTime",
      "facility": "facilityName"
    }'::jsonb
);
```

### Use Case 2: Tournament (with custom attributes)

**Wati Template Variables**:
- `{{1}}` = User name
- `{{2}}` = Tournament name (from attribute_1)
- `{{3}}` = Registration deadline (from attribute_2)

**Database Entry**:
```sql
INSERT INTO wati_templates (
    sport_name,
    event_name,
    event_type,
    wati_template_name,
    variable_attribute_mapping,
    attribute_1,
    attribute_2
) VALUES (
    'Badminton',
    'tournament',
    'TOURNAMENT',
    'badminton_tournament_confirmation',
    '{
      "name": "userName",
      "tournament_name": "attribute_1",
      "deadline": "attribute_2"
    }'::jsonb,
    ARRAY['Summer Championship 2025'],
    ARRAY['Register by 15th Nov 2025']
);
```

### Use Case 3: Private Booking (complex)

**Wati Template Variables**:
- `{{1}}` = User name
- `{{2}}` = Court name
- `{{3}}` = Date/time
- `{{4}}` = Duration (from attribute_1)
- `{{5}}` = Booking ID (from attribute_2)

**Database Entry**:
```sql
INSERT INTO wati_templates (
    sport_name,
    event_name,
    event_type,
    wati_template_name,
    variable_attribute_mapping,
    attribute_1,
    attribute_2
) VALUES (
    'Badminton',
    'private_booking',
    'PRIVATE_BOOKING',
    'badminton_private_booking',
    '{
      "name": "userName",
      "court": "courtName",
      "datetime": "formattedDateTime",
      "duration": "attribute_1",
      "booking_id": "attribute_2"
    }'::jsonb,
    ARRAY['1 hour'],
    ARRAY['BK-2025-001']
);
```

---

## Payload Format

The Edge Function accepts both formats:

### Format 1: Direct API (Title Case)
```json
{
  "User Name": "Ashwin",
  "User Phone Number": "7975609838",
  "User Email": "a3sajs@gmail.com",
  "Slots": [{
    "facilityName": "Game Theory JP Nagar 8th Phase",
    "courtName": "Court 2",
    "startTime": "19:00",
    "eventDate": "2025-10-25T00:00:00.000Z"
  }],
  "Sport Name": "Badminton",
  "Event Type": "COMMUNITY_GAME",
  "Event Name": "community_game"
}
```

### Format 2: Zapier Webhook (camelCase)
```json
{
  "input_data": "{\"userName\": \"Ashwin\", \"userPhoneNumber\": \"7975609838\", \"slots\": [...], \"sportName\": \"Badminton\", \"eventType\": \"COMMUNITY_GAME\", \"eventName\": \"community_game\"}"
}
```

**Note**: `Event Name` is optional and defaults to `"community_game"` if not provided.

---

## Template Lookup Logic

```typescript
1. Extract: sportName, eventType, eventName (default: "community_game")
2. Query: WHERE sport_name = ? AND event_name = ? AND event_type = ?
3. If found: Use template
4. If not found: Throw error with details
```

**Error message example**:
```
Wati template not found for: Badminton / community_game / COMMUNITY_GAME.
Please add it to the wati_templates table first.
```

---

## Managing Templates

### View All Templates
```sql
SELECT
    sport_name,
    event_name,
    event_type,
    wati_template_name,
    jsonb_pretty(variable_attribute_mapping) as mapping
FROM wati_templates
ORDER BY sport_name, event_name;
```

### Update Template Mapping
```sql
UPDATE wati_templates
SET variable_attribute_mapping = '{
    "name": "userName",
    "datetime": "formattedDateTime",
    "new_field": "attribute_1"
}'::jsonb
WHERE sport_name = 'Badminton'
  AND event_name = 'community_game'
  AND event_type = 'COMMUNITY_GAME';
```

### Delete Template
```sql
DELETE FROM wati_templates
WHERE sport_name = 'Badminton'
  AND event_name = 'tournament'
  AND event_type = 'TOURNAMENT';
```

---

## Debugging

### Check Template Exists
```sql
SELECT * FROM wati_templates
WHERE sport_name = 'Badminton'
  AND event_name = 'community_game'
  AND event_type = 'COMMUNITY_GAME';
```

### View Edge Function Logs
Look for these log entries:
```
🔍 Looking for template: sport=Badminton, event_name=community_game, event_type=COMMUNITY_GAME
✅ Found template: community_badminton_confirmation_v2
🗺️ Variable mapping: { "name": "userName", ... }
📋 WhatsApp Parameters: [{ name: "name", value: "Ashwin" }, ...]
```

### Common Issues

**Issue**: Template not found
- **Check**: sport_name, event_name, event_type all match exactly (case-sensitive)
- **Fix**: Insert template with correct combination

**Issue**: WhatsApp sends but wrong values
- **Check**: variable_attribute_mapping keys match Wati template variable names
- **Fix**: Update mapping to match Wati template

**Issue**: Empty/missing values in WhatsApp
- **Check**: Data source exists in dataContext or attribute fields
- **Fix**: Update mapping to use correct data source

---

## Migration from Old System

Old system used `use_case` column. New system uses `event_name`.

**Mapping**:
- Old: `use_case = 'community_booking'`
- New: `event_name = 'community_game'`

**Migration SQL**:
```sql
-- Already handled by migration file
-- No action needed if you ran: 20251107_refactor_wati_templates.sql
```

---

## Best Practices

1. **Naming Conventions**:
   - `sport_name`: Use proper case (e.g., "Badminton", not "badminton")
   - `event_name`: Use snake_case (e.g., "community_game", "private_booking")
   - `event_type`: Use UPPER_SNAKE_CASE (e.g., "COMMUNITY_GAME", "TOURNAMENT")

2. **Variable Mapping**:
   - Use descriptive Wati variable names
   - Document which attribute stores what data
   - Keep mappings simple and clear

3. **Testing**:
   - Test with test payload before production
   - Verify Wati template exists and works
   - Check logs for parameter values

4. **Attributes Usage**:
   - Use attributes for data that changes per template
   - Keep static data in payload/dataContext
   - Document attribute usage in comments

---

**Last Updated**: 2025-11-07
