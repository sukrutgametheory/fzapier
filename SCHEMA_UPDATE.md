# Sport Templates Schema Update

## Overview
Updated the `community_booking_confirmation_sport_templates` table to be more flexible and support multiple use cases beyond just community bookings.

## Changes Made

### 1. Column Renaming (Generic Attributes)
Made column names more generic to support different use cases:

| Old Column Name   | New Column Name | Purpose for Community Bookings |
|-------------------|-----------------|--------------------------------|
| `please_bring`    | `attribute_1`   | Items users should bring       |
| `we_will_provide` | `attribute_2`   | Items we provide               |
| `tips`            | `attribute_3`   | Tips for users                 |

### 2. New Columns

**use_case** (TEXT)
- Purpose: Filter templates by booking type
- Default: `'community_booking'`
- Examples: `'community_booking'`, `'private_booking'`, `'tournament'`
- Indexed for fast filtering

**attribute_4, attribute_5, attribute_6** (TEXT[])
- Purpose: Reserved for future use
- Allows adding new attributes without schema changes
- Examples: dress code, parking info, cancellation policy, etc.

### 3. Performance Improvements
- Added index on `use_case` column
- Added compound index on `(sport_name, use_case)` for common queries

## Migration

### Apply Schema Changes
Run the migration in your Supabase SQL Editor:

```bash
# File location
supabase/migrations/20251106_update_sport_templates_schema.sql
```

Or manually execute the SQL commands in Supabase Dashboard → SQL Editor.

## Sample Insert Query

### Badminton Community Booking Example

```sql
INSERT INTO community_booking_confirmation_sport_templates (
    sport_name,
    wati_template_name,
    use_case,
    calendar_description_template,
    attribute_1,  -- please_bring
    attribute_2,  -- we_will_provide
    attribute_3   -- tips
) VALUES (
    'Badminton',
    'community_badminton_confirmation_v2',
    'community_booking',
    E'Hi {{userName}} 👋\n\nJust confirming your community badminton game on {{datetime}} at {{facilityName}}. We''re pumped to have you join the fun!\n\nPlease arrive at least 5 minutes early to warm up and meet the group.\n\nThis is a community badminton session.',
    ARRAY[
        'Non-marking shoes if you have them (we provide them as well)',
        'A fresh pair of socks',
        'Water bottle (stay hydrated)'
    ],
    ARRAY[
        'Racquets & shuttles',
        'Court space'
    ],
    ARRAY[
        'Be ready to mix, mingle & rally with fellow players',
        'Do a quick warm-up: wrist rolls, lunges & side-steps',
        'Keep an open mind - fun, friendly competition guaranteed'
    ]
);
```

**Pre-made seed file available at:**
```
supabase/seed_badminton_template.sql
```

## Template Placeholders

The `calendar_description_template` supports these placeholders:

| Placeholder        | Replaced With           | Example                         |
|--------------------|-------------------------|---------------------------------|
| `{{userName}}`     | User's name             | "Ashwin"                        |
| `{{facilityName}}` | Facility name           | "Game Theory JP Nagar 8th Phase"|
| `{{datetime}}`     | Formatted date/time     | "25th Oct 2025 at 7pm"         |

## Calendar Invite Format

The final calendar description will be built like this:

```
[calendar_description_template with placeholders replaced]

We'll provide:
🎯 [attribute_2 item 1]
🎯 [attribute_2 item 2]

Please bring:
👉 [attribute_1 item 1]
👉 [attribute_1 item 2]

Tips:
💡 [attribute_3 item 1]
💡 [attribute_3 item 2]
```

## Edge Function Updates

Updated `supabase/functions/process-booking/index.ts`:

1. **Added use_case filter**:
   ```typescript
   .eq("sport_name", sportName)
   .eq("use_case", "community_booking")  // NEW
   ```

2. **Updated to use new attribute names**:
   ```typescript
   // Old: sportTemplate.please_bring
   // New: sportTemplate.attribute_1

   // Old: sportTemplate.we_will_provide
   // New: sportTemplate.attribute_2

   // Old: sportTemplate.tips
   // New: sportTemplate.attribute_3
   ```

3. **Added userName placeholder**:
   ```typescript
   .replace(/\{\{userName\}\}/g, userName)
   ```

## Future Use Cases

### Example: Private Bookings
You can now add different templates for other use cases:

```sql
INSERT INTO community_booking_confirmation_sport_templates (
    sport_name,
    wati_template_name,
    use_case,
    calendar_description_template,
    attribute_1,  -- dress_code
    attribute_2,  -- included_services
    attribute_3,  -- rules
    attribute_4   -- cancellation_policy
) VALUES (
    'Badminton',
    'private_badminton_booking',
    'private_booking',
    'Your private court booking for {{datetime}}',
    ARRAY['Athletic wear', 'Court shoes'],
    ARRAY['Private court', 'Equipment rental', 'Refreshments'],
    ARRAY['Maximum 4 players', 'No outside equipment'],
    ARRAY['Cancel 24h before for full refund']
);
```

## Querying Templates

### Get community booking template
```sql
SELECT * FROM community_booking_confirmation_sport_templates
WHERE sport_name = 'Badminton'
  AND use_case = 'community_booking';
```

### Get all templates for a sport
```sql
SELECT * FROM community_booking_confirmation_sport_templates
WHERE sport_name = 'Badminton';
```

### Get all community booking templates
```sql
SELECT * FROM community_booking_confirmation_sport_templates
WHERE use_case = 'community_booking';
```

## Testing

After applying the migration and inserting the Badminton template:

1. **Test with Zapier webhook** using `test-payload-zapier.json`
2. **Check logs** in Supabase Dashboard
3. **Verify calendar description** includes all sections with emojis
4. **Confirm WhatsApp** uses correct template name: `community_badminton_confirmation_v2`

## Rollback (if needed)

If you need to rollback these changes:

```sql
-- Rename columns back
ALTER TABLE community_booking_confirmation_sport_templates
RENAME COLUMN attribute_1 TO please_bring;

ALTER TABLE community_booking_confirmation_sport_templates
RENAME COLUMN attribute_2 TO we_will_provide;

ALTER TABLE community_booking_confirmation_sport_templates
RENAME COLUMN attribute_3 TO tips;

-- Remove new columns
ALTER TABLE community_booking_confirmation_sport_templates
DROP COLUMN use_case,
DROP COLUMN attribute_4,
DROP COLUMN attribute_5,
DROP COLUMN attribute_6;

-- Drop indexes
DROP INDEX IF EXISTS idx_sport_templates_use_case;
DROP INDEX IF EXISTS idx_sport_templates_sport_use_case;
```

## Benefits

1. **Flexibility**: Support multiple use cases with same table
2. **Future-proof**: Extra attribute columns for new requirements
3. **Performance**: Indexed queries for faster lookups
4. **Clarity**: use_case filter prevents mixing different booking types
5. **Scalability**: Easy to add new sports or use cases without code changes

---

**Migration Date**: 2025-11-06
**Status**: Ready to apply
