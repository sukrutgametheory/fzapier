-- Sample insert query for Badminton community booking template
-- Use this as reference or run directly in Supabase SQL Editor

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
)
ON CONFLICT (sport_name)
DO UPDATE SET
    wati_template_name = EXCLUDED.wati_template_name,
    use_case = EXCLUDED.use_case,
    calendar_description_template = EXCLUDED.calendar_description_template,
    attribute_1 = EXCLUDED.attribute_1,
    attribute_2 = EXCLUDED.attribute_2,
    attribute_3 = EXCLUDED.attribute_3,
    updated_at = NOW();

-- Verify the insert
SELECT
    sport_name,
    wati_template_name,
    use_case,
    attribute_1 as please_bring,
    attribute_2 as we_will_provide,
    attribute_3 as tips
FROM community_booking_confirmation_sport_templates
WHERE sport_name = 'Badminton' AND use_case = 'community_booking';
