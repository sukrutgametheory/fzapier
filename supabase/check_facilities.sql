-- Check existing facilities and their data
-- Run this to verify your facilities table has the correct data

-- 1. Check if facilities table exists and view structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'facilities'
ORDER BY ordinal_position;

-- 2. View all facilities
SELECT
    id,
    name,
    google_location,
    google_maps_link,
    created_at
FROM facilities
ORDER BY name;

-- 3. Check for facilities with missing map links
SELECT
    name,
    CASE
        WHEN google_maps_link IS NULL THEN '❌ NULL'
        WHEN google_maps_link = '' THEN '❌ EMPTY STRING'
        ELSE '✅ Has link'
    END as map_link_status,
    google_maps_link
FROM facilities
ORDER BY name;

-- 4. Sample INSERT/UPDATE for Game Theory JP Nagar 8th Phase
-- Uncomment and run if you need to add or update this facility

/*
-- Option A: INSERT if doesn't exist
INSERT INTO facilities (name, google_location, google_maps_link)
VALUES (
    'Game Theory JP Nagar 8th Phase',
    'Game Theory Sports Arena, JP Nagar 8th Phase, Bangalore',
    'https://maps.google.com/?q=Game+Theory+JP+Nagar+8th+Phase'
)
ON CONFLICT (name) DO NOTHING;

-- Option B: UPDATE existing facility
UPDATE facilities
SET
    google_location = 'Game Theory Sports Arena, JP Nagar 8th Phase, Bangalore',
    google_maps_link = 'https://maps.google.com/?q=Game+Theory+JP+Nagar+8th+Phase',
    updated_at = NOW()
WHERE name = 'Game Theory JP Nagar 8th Phase';

-- Option C: UPSERT (insert or update)
INSERT INTO facilities (name, google_location, google_maps_link)
VALUES (
    'Game Theory JP Nagar 8th Phase',
    'Game Theory Sports Arena, JP Nagar 8th Phase, Bangalore',
    'https://maps.google.com/?q=Game+Theory+JP+Nagar+8th+Phase'
)
ON CONFLICT (name)
DO UPDATE SET
    google_location = EXCLUDED.google_location,
    google_maps_link = EXCLUDED.google_maps_link,
    updated_at = NOW();
*/

-- 5. Verify the update
SELECT
    name,
    google_location,
    google_maps_link,
    CASE
        WHEN google_maps_link IS NOT NULL AND google_maps_link != '' THEN '✅ Valid'
        ELSE '❌ Missing'
    END as status
FROM facilities
WHERE name = 'Game Theory JP Nagar 8th Phase';
