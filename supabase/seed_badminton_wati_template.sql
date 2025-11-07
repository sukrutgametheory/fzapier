-- Sample Wati template for Badminton Community Game
-- Uses new wati_templates table structure with variable_attribute_mapping

INSERT INTO wati_templates (
    sport_name,
    event_name,
    event_type,
    wati_template_name,
    variable_attribute_mapping,
    attribute_1,
    attribute_2,
    attribute_3,
    calendar_description_template
) VALUES (
    'Badminton',
    'community_game',
    'COMMUNITY_GAME',
    'community_badminton_confirmation_v2',
    -- variable_attribute_mapping: Maps Wati template variable names to data sources
    -- Static values: userName, userPhone, userEmail, sportName, facilityName, formattedDateTime, facilityMapLink
    -- Dynamic values: attribute_1 through attribute_6
    '{
      "name": "userName",
      "datetime": "formattedDateTime",
      "facility_name": "facilityName",
      "sport_name": "sportName",
      "facility_map_link": "facilityMapLink"
    }'::jsonb,
    -- attribute_1: Items to bring (for calendar only)
    ARRAY[
        'Non-marking shoes if you have them (we provide them as well)',
        'A fresh pair of socks',
        'Water bottle (stay hydrated)'
    ],
    -- attribute_2: Items we provide (for calendar only)
    ARRAY[
        'Racquets & shuttles',
        'Court space'
    ],
    -- attribute_3: Tips (for calendar only)
    ARRAY[
        'Be ready to mix, mingle & rally with fellow players',
        'Do a quick warm-up: wrist rolls, lunges & side-steps',
        'Keep an open mind - fun, friendly competition guaranteed'
    ],
    -- Calendar description template
    E'Hi {{userName}} 👋\n\nJust confirming your community badminton game on {{datetime}} at {{facilityName}}. We''re pumped to have you join the fun!\n\nPlease arrive at least 5 minutes early to warm up and meet the group.\n\nThis is a community badminton session.'
)
ON CONFLICT ON CONSTRAINT idx_wati_templates_unique_combo
DO UPDATE SET
    wati_template_name = EXCLUDED.wati_template_name,
    variable_attribute_mapping = EXCLUDED.variable_attribute_mapping,
    attribute_1 = EXCLUDED.attribute_1,
    attribute_2 = EXCLUDED.attribute_2,
    attribute_3 = EXCLUDED.attribute_3,
    calendar_description_template = EXCLUDED.calendar_description_template,
    updated_at = NOW();

-- Verify the insert
SELECT
    sport_name,
    event_name,
    event_type,
    wati_template_name,
    variable_attribute_mapping,
    jsonb_pretty(variable_attribute_mapping) as mapping_pretty
FROM wati_templates
WHERE sport_name = 'Badminton' AND event_name = 'community_game';
