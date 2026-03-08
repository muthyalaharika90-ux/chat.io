import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type Profile = {
  id: string;
  email: string;
  username: string;
  avatar_color: string;
  custom_status: string;
  theme_preference: string;
  notification_settings: {
    messages: boolean;
    calls: boolean;
    mentions: boolean;
  };
  banned: boolean;
  is_admin: boolean;
  created_at: string;
};

export type Channel = {
  id: string;
  name: string;
  description: string;
  created_by: string | null;
  is_private: boolean;
  avatar_url: string;
  created_at: string;
};

export type Message = {
  id: string;
  user_id: string;
  channel_id: string | null;
  content: string;
  edited_at: string | null;
  is_pinned: boolean;
  mentioned_users: string[];
  created_at: string;
  profiles?: Profile;
  attachments?: Attachment[];
  voice_messages?: VoiceMessage[];
  reactions?: Reaction[];
  threads?: MessageThread[];
};

export type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
  profiles?: Profile;
};

export type Attachment = {
  id: string;
  message_id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url: string;
  created_at: string;
};

export type VoiceMessage = {
  id: string;
  message_id: string;
  user_id: string;
  audio_url: string;
  duration: number;
  waveform_data: number[];
  created_at: string;
};

export type VideoCall = {
  id: string;
  caller_id: string;
  receiver_id: string;
  status: 'calling' | 'active' | 'ended' | 'rejected';
  started_at: string;
  ended_at: string | null;
  duration: number | null;
  has_screen_share: boolean;
  created_at: string;
};

export type MessageThread = {
  id: string;
  parent_message_id: string;
  reply_message_id: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};
