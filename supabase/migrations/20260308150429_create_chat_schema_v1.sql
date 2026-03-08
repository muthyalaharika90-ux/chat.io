/*
  # Full-Featured Chat Application - Base Schema
  
  ## Tables Created
  
  1. profiles - User accounts and settings
  2. channels - Group chats and channels  
  3. channel_members - Channel membership
  4. messages - Chat messages
  5. reactions - Message reactions
  6. presence - Online status
  7. typing_indicators - Typing status
  8. video_calls - Video/audio calls
  9. call_signals - WebRTC signaling
  10. attachments - File uploads
  11. voice_messages - Audio recordings
  12. user_blocks - Block system
  13. read_receipts - Read tracking
  14. message_threads - Threaded replies
  15. pinned_messages - Pinned messages
  16. user_settings - User preferences
  17. message_drafts - Draft messages
  18. notifications - Notification system
  
  ## Security
  - RLS enabled on all tables
  - Policies enforce authentication and authorization
  - Banned users restricted from interactions
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  username text UNIQUE NOT NULL,
  avatar_color text NOT NULL DEFAULT '#3B82F6',
  custom_status text DEFAULT '',
  theme_preference text DEFAULT 'light',
  notification_settings jsonb DEFAULT '{"messages": true, "calls": true, "mentions": true}'::jsonb,
  banned boolean DEFAULT false,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_banned ON profiles(banned);

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_private boolean DEFAULT false,
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channels viewable by authenticated"
  ON channels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create channels"
  ON channels FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = true)
  );

CREATE POLICY "Creators can update channels"
  ON channels FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can delete channels"
  ON channels FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX idx_channels_created_by ON channels(created_by);

-- Channel members table
CREATE TABLE IF NOT EXISTS channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members viewable by all"
  ON channel_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join channels"
  ON channel_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave channels"
  ON channel_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX idx_channel_members_user ON channel_members(user_id);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  content text NOT NULL,
  edited_at timestamptz,
  is_pinned boolean DEFAULT false,
  mentioned_users uuid[] DEFAULT ARRAY[]::uuid[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages viewable by non-banned"
  ON messages FOR SELECT
  TO authenticated
  USING (
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = true)
  );

CREATE POLICY "Non-banned can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = true)
  );

CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_messages_user ON messages(user_id);
CREATE INDEX idx_messages_channel ON messages(channel_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reaction_type text NOT NULL DEFAULT 'heart',
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, reaction_type)
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions viewable by all"
  ON reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add reactions"
  ON reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = true)
  );

CREATE POLICY "Users can remove reactions"
  ON reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_reactions_message ON reactions(message_id);
CREATE INDEX idx_reactions_user ON reactions(user_id);

-- Presence table
CREATE TABLE IF NOT EXISTS presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  is_online boolean DEFAULT false,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Presence viewable by all"
  ON presence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update presence"
  ON presence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify presence"
  ON presence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_presence_user ON presence(user_id);
CREATE INDEX idx_presence_online ON presence(is_online);

-- Typing indicators table
CREATE TABLE IF NOT EXISTS typing_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  is_typing boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Typing viewable by all"
  ON typing_indicators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update typing"
  ON typing_indicators FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify typing"
  ON typing_indicators FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete typing"
  ON typing_indicators FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_typing_channel ON typing_indicators(channel_id);

-- Video calls table
CREATE TABLE IF NOT EXISTS video_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'calling',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration integer,
  has_screen_share boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own calls"
  ON video_calls FOR SELECT
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE POLICY "Users create calls"
  ON video_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = caller_id AND
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = true)
  );

CREATE POLICY "Participants update calls"
  ON video_calls FOR UPDATE
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);

CREATE INDEX idx_video_calls_caller ON video_calls(caller_id);
CREATE INDEX idx_video_calls_receiver ON video_calls(receiver_id);

-- Call signals table
CREATE TABLE IF NOT EXISTS call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES video_calls(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  signal_type text NOT NULL,
  signal_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view signals"
  ON call_signals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM video_calls 
      WHERE id = call_signals.call_id 
      AND (caller_id = auth.uid() OR receiver_id = auth.uid())
    )
  );

CREATE POLICY "Participants create signals"
  ON call_signals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE INDEX idx_call_signals_call ON call_signals(call_id);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  file_url text NOT NULL,
  thumbnail_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attachments viewable by all"
  ON attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users upload attachments"
  ON attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = true)
  );

CREATE INDEX idx_attachments_message ON attachments(message_id);

-- Voice messages table
CREATE TABLE IF NOT EXISTS voice_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  audio_url text NOT NULL,
  duration integer NOT NULL,
  waveform_data jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE voice_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voice messages viewable"
  ON voice_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users create voice messages"
  ON voice_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND banned = true)
  );

CREATE INDEX idx_voice_messages_message ON voice_messages(message_id);

-- User blocks table
CREATE TABLE IF NOT EXISTS user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own blocks"
  ON user_blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block"
  ON user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock"
  ON user_blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);

-- Read receipts table
CREATE TABLE IF NOT EXISTS read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Receipts viewable"
  ON read_receipts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users mark as read"
  ON read_receipts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_read_receipts_message ON read_receipts(message_id);

-- Message threads table
CREATE TABLE IF NOT EXISTS message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  reply_message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_message_id, reply_message_id)
);

ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Threads viewable"
  ON message_threads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users create threads"
  ON message_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM messages WHERE id = message_threads.reply_message_id AND user_id = auth.uid())
  );

CREATE INDEX idx_message_threads_parent ON message_threads(parent_message_id);

-- Pinned messages table
CREATE TABLE IF NOT EXISTS pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  pinned_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  pinned_at timestamptz DEFAULT now(),
  UNIQUE(message_id)
);

ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pinned viewable"
  ON pinned_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can pin"
  ON pinned_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = pinned_by);

CREATE POLICY "Users can unpin"
  ON pinned_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = pinned_by);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  language text DEFAULT 'en',
  timezone text DEFAULT 'UTC',
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  sound_enabled boolean DEFAULT true,
  settings_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users modify settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Message drafts table
CREATE TABLE IF NOT EXISTS message_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

ALTER TABLE message_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view drafts"
  ON message_drafts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create drafts"
  ON message_drafts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update drafts"
  ON message_drafts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete drafts"
  ON message_drafts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System creates notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users update notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Auto-create profile function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, avatar_color)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    ('#' || LPAD(TO_HEX((RANDOM() * 16777215)::INT), 6, '0'))
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Analytics functions
CREATE OR REPLACE FUNCTION get_messages_per_hour()
RETURNS TABLE (
  hour timestamptz,
  count bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT 
    date_trunc('hour', created_at) as hour,
    COUNT(*) as count
  FROM messages
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY hour
  ORDER BY hour;
$$;

CREATE OR REPLACE FUNCTION get_user_growth()
RETURNS TABLE (
  date timestamptz,
  count bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT 
    date_trunc('day', created_at) as date,
    COUNT(*) as count
  FROM profiles
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY date
  ORDER BY date;
$$;

CREATE OR REPLACE FUNCTION get_top_users()
RETURNS TABLE (
  user_id uuid,
  username text,
  message_count bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT 
    m.user_id,
    p.username,
    COUNT(*) as message_count
  FROM messages m
  JOIN profiles p ON m.user_id = p.id
  GROUP BY m.user_id, p.username
  ORDER BY message_count DESC
  LIMIT 10;
$$;
