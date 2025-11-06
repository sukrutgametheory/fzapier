-- Create enum types with prefix
CREATE TYPE community_booking_confirmation_event_type AS ENUM ('COMMUNITY_GAME', 'PRIVATE_BOOKING', 'TOURNAMENT', 'TRAINING');
CREATE TYPE community_booking_confirmation_execution_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'partial');

-- Sport templates table (prefixed)
CREATE TABLE community_booking_confirmation_sport_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sport_name TEXT NOT NULL UNIQUE,
    wati_template_name TEXT NOT NULL,
    whatsapp_message_template TEXT NOT NULL,
    please_bring TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    we_will_provide TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    tips TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    calendar_description_template TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workflow executions table (logging) - prefixed
CREATE TABLE community_booking_confirmation_workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status community_booking_confirmation_execution_status NOT NULL DEFAULT 'pending',
    input_data JSONB NOT NULL,
    user_name TEXT,
    user_email TEXT,
    user_phone TEXT,
    sport_name TEXT,
    event_type community_booking_confirmation_event_type,
    facility_name TEXT,
    event_date TIMESTAMP WITH TIME ZONE,
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    whatsapp_response JSONB,
    whatsapp_error TEXT,
    calendar_sent BOOLEAN DEFAULT FALSE,
    calendar_response JSONB,
    calendar_error TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX idx_cbc_workflow_executions_status ON community_booking_confirmation_workflow_executions(status);
CREATE INDEX idx_cbc_workflow_executions_created_at ON community_booking_confirmation_workflow_executions(created_at DESC);
CREATE INDEX idx_cbc_workflow_executions_user_email ON community_booking_confirmation_workflow_executions(user_email);
CREATE INDEX idx_cbc_workflow_executions_sport_name ON community_booking_confirmation_workflow_executions(sport_name);

-- Insert default sport templates
INSERT INTO community_booking_confirmation_sport_templates (
    sport_name,
    wati_template_name,
    whatsapp_message_template,
    please_bring,
    we_will_provide,
    tips,
    calendar_description_template
) VALUES
(
    'Pickleball',
    'community_pickleball_confirmation',
    'Hi {{userName}} 👋\n\nJust confirming your community pickleball game on {{datetime}} at {{facilityName}}. We''re pumped to have you join the fun!\n\nPlease arrive at least 5 minutes early to warm up and meet the group.',
    ARRAY['Non-marking shoes if you have them (we provide them as well)', 'A fresh pair of socks', 'Water bottle (stay hydrated)'],
    ARRAY['Paddles & balls', 'Court space'],
    ARRAY['Be ready to mix, mingle & rally with fellow players', 'Do a quick warm-up: wrist rolls, lunges & side-steps', 'Keep an open mind - fun, friendly competition guaranteed'],
    'Community Pickleball Game at {{facilityName}}\n\nDate & Time: {{datetime}}\n\nWhat to bring:\n- Non-marking shoes\n- Fresh socks\n- Water bottle\n\nWe provide paddles, balls, and court space.\n\nSee you there!\nTeam Game Theory'
),
(
    'Badminton',
    'community_badminton_confirmation',
    'Hi {{userName}} 👋\n\nJust confirming your community badminton game on {{datetime}} at {{facilityName}}. We''re excited to have you join us!\n\nPlease arrive at least 5 minutes early to warm up and meet the group.',
    ARRAY['Non-marking shoes', 'A fresh pair of socks', 'Water bottle (stay hydrated)'],
    ARRAY['Rackets & shuttlecocks', 'Court space'],
    ARRAY['Be ready to mix and play with fellow enthusiasts', 'Warm up properly before starting', 'Have fun and enjoy the game!'],
    'Community Badminton Game at {{facilityName}}\n\nDate & Time: {{datetime}}\n\nWhat to bring:\n- Non-marking shoes\n- Fresh socks\n- Water bottle\n\nWe provide rackets, shuttlecocks, and court space.\n\nSee you there!\nTeam Game Theory'
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION community_booking_confirmation_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_sport_templates_updated_at BEFORE UPDATE ON community_booking_confirmation_sport_templates
    FOR EACH ROW EXECUTE FUNCTION community_booking_confirmation_update_updated_at();

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE community_booking_confirmation_sport_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_booking_confirmation_workflow_executions ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, adjust based on your needs)
CREATE POLICY "Allow all operations on sport_templates" ON community_booking_confirmation_sport_templates FOR ALL USING (true);
CREATE POLICY "Allow all operations on workflow_executions" ON community_booking_confirmation_workflow_executions FOR ALL USING (true);
