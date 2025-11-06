-- Migration: Update sport templates table structure
-- Rename attribute columns to be more generic and add use_case filter

-- Add use_case column
ALTER TABLE community_booking_confirmation_sport_templates
ADD COLUMN IF NOT EXISTS use_case TEXT DEFAULT 'community_booking';

-- Rename existing columns to generic attribute names
ALTER TABLE community_booking_confirmation_sport_templates
RENAME COLUMN please_bring TO attribute_1;

ALTER TABLE community_booking_confirmation_sport_templates
RENAME COLUMN we_will_provide TO attribute_2;

ALTER TABLE community_booking_confirmation_sport_templates
RENAME COLUMN tips TO attribute_3;

-- Add additional attribute columns for future use
ALTER TABLE community_booking_confirmation_sport_templates
ADD COLUMN IF NOT EXISTS attribute_4 TEXT[],
ADD COLUMN IF NOT EXISTS attribute_5 TEXT[],
ADD COLUMN IF NOT EXISTS attribute_6 TEXT[];

-- Add comments to document column usage
COMMENT ON COLUMN community_booking_confirmation_sport_templates.use_case IS 'Filter templates by use case (e.g., community_booking, private_booking, tournament)';
COMMENT ON COLUMN community_booking_confirmation_sport_templates.attribute_1 IS 'Generic attribute 1 - For community_booking: please_bring items';
COMMENT ON COLUMN community_booking_confirmation_sport_templates.attribute_2 IS 'Generic attribute 2 - For community_booking: we_will_provide items';
COMMENT ON COLUMN community_booking_confirmation_sport_templates.attribute_3 IS 'Generic attribute 3 - For community_booking: tips';
COMMENT ON COLUMN community_booking_confirmation_sport_templates.attribute_4 IS 'Generic attribute 4 - Reserved for future use';
COMMENT ON COLUMN community_booking_confirmation_sport_templates.attribute_5 IS 'Generic attribute 5 - Reserved for future use';
COMMENT ON COLUMN community_booking_confirmation_sport_templates.attribute_6 IS 'Generic attribute 6 - Reserved for future use';

-- Create index on use_case for faster filtering
CREATE INDEX IF NOT EXISTS idx_sport_templates_use_case
ON community_booking_confirmation_sport_templates(use_case);

-- Create compound index for common query pattern
CREATE INDEX IF NOT EXISTS idx_sport_templates_sport_use_case
ON community_booking_confirmation_sport_templates(sport_name, use_case);
