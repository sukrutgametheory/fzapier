-- Migration: Refactor sport templates to wati_templates with dynamic variable mapping
-- Rename table and add variable_attribute_mapping column

-- 1. Rename table
ALTER TABLE community_booking_confirmation_sport_templates
RENAME TO wati_templates;

-- 2. Drop old indexes
DROP INDEX IF EXISTS idx_sport_templates_use_case;
DROP INDEX IF EXISTS idx_sport_templates_sport_use_case;

-- 3. Add new columns
ALTER TABLE wati_templates
ADD COLUMN IF NOT EXISTS event_name TEXT,
ADD COLUMN IF NOT EXISTS variable_attribute_mapping JSONB;

-- 4. Update existing rows to have default event_name
UPDATE wati_templates
SET event_name = 'community_game'
WHERE event_name IS NULL;

-- 5. Add comments
COMMENT ON TABLE wati_templates IS 'Wati WhatsApp templates with dynamic variable mapping';
COMMENT ON COLUMN wati_templates.sport_name IS 'Sport identifier (e.g., Badminton, Pickleball)';
COMMENT ON COLUMN wati_templates.event_name IS 'Event name identifier (e.g., community_game, tournament, private_booking)';
COMMENT ON COLUMN wati_templates.event_type IS 'Event type from booking system (e.g., COMMUNITY_GAME, TOURNAMENT)';
COMMENT ON COLUMN wati_templates.use_case IS 'DEPRECATED - Use event_name instead';
COMMENT ON COLUMN wati_templates.variable_attribute_mapping IS 'JSON mapping of Wati template variables to attribute columns, e.g., {"name": "userName", "datetime": "attribute_1", "facility_name": "attribute_2"}';
COMMENT ON COLUMN wati_templates.attribute_1 IS 'Dynamic attribute - usage defined by variable_attribute_mapping';
COMMENT ON COLUMN wati_templates.attribute_2 IS 'Dynamic attribute - usage defined by variable_attribute_mapping';
COMMENT ON COLUMN wati_templates.attribute_3 IS 'Dynamic attribute - usage defined by variable_attribute_mapping';
COMMENT ON COLUMN wati_templates.attribute_4 IS 'Dynamic attribute - usage defined by variable_attribute_mapping';
COMMENT ON COLUMN wati_templates.attribute_5 IS 'Dynamic attribute - usage defined by variable_attribute_mapping';
COMMENT ON COLUMN wati_templates.attribute_6 IS 'Dynamic attribute - usage defined by variable_attribute_mapping';

-- 6. Create new indexes
CREATE INDEX IF NOT EXISTS idx_wati_templates_sport_event
ON wati_templates(sport_name, event_name, event_type);

CREATE INDEX IF NOT EXISTS idx_wati_templates_event_type
ON wati_templates(event_type);

-- 7. Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_wati_templates_unique_combo
ON wati_templates(sport_name, event_name, event_type)
WHERE event_name IS NOT NULL AND event_type IS NOT NULL;
