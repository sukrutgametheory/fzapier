-- Change event_type from ENUM to TEXT for flexibility
-- This allows any event type value without schema changes

-- Step 1: Add a new TEXT column
ALTER TABLE community_booking_confirmation_workflow_executions
ADD COLUMN event_type_text TEXT;

-- Step 2: Copy data from enum column to text column
UPDATE community_booking_confirmation_workflow_executions
SET event_type_text = event_type::TEXT;

-- Step 3: Drop the old enum column
ALTER TABLE community_booking_confirmation_workflow_executions
DROP COLUMN event_type;

-- Step 4: Rename the new text column to event_type
ALTER TABLE community_booking_confirmation_workflow_executions
RENAME COLUMN event_type_text TO event_type;

-- Step 5: Drop the enum type (optional, but clean)
-- Only do this if no other tables use this enum
DROP TYPE IF EXISTS community_booking_confirmation_event_type;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_cbc_workflow_executions_event_type
ON community_booking_confirmation_workflow_executions(event_type);
