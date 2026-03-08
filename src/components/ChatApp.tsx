import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, Channel, Message, Profile } from '../lib/supabase';
import ChannelList from './ChannelList';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import UserList from './UserList';
import VideoCallModal from './VideoCallModal';
import NotificationCenter from './NotificationCenter';
import SettingsModal from './SettingsModal';
import { Menu, X, Moon, Sun, Settings, Bell, Users, Hash, LogOut } from 'lucide-react';

export default function ChatApp() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showUsers, setShowUsers] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [activeCall, setActiveCall] = useState<any>(null);

  useEffect(() => {
    loadChannels();
    loadUsers();
    subscribeToChannels();
    subscribeToUsers();
    subscribeToPresence();
    subscribeToVideoCalls();

    return () => {
      supabase.removeAllChannels();
    };
  }, []);

  useEffect(() => {
    if (selectedChannel) {
      loadMessages(selectedChannel.id);
      subscribeToMessages(selectedChannel.id);
    }
  }, [selectedChannel]);

  async function loadChannels() {
    const { data } = await supabase
      .from('channels')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setChannels(data);
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('banned', false)
      .order('username');
    if (data) setUsers(data);
  }

  async function loadMessages(channelId: string) {
    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        profiles (*),
        attachments (*),
        voice_messages (*),
        reactions (*, profiles (*))
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  function subscribeToChannels() {
    supabase
      .channel('channels-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, () => {
        loadChannels();
      })
      .subscribe();
  }

  function subscribeToUsers() {
    supabase
      .channel('users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadUsers();
      })
      .subscribe();
  }

  function subscribeToMessages(channelId: string) {
    supabase
      .channel(`messages-${channelId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              profiles (*),
              attachments (*),
              voice_messages (*),
              reactions (*, profiles (*))
            `)
            .eq('id', payload.new.id)
            .maybeSingle();
          if (data) setMessages(prev => [...prev, data]);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              profiles (*),
              attachments (*),
              voice_messages (*),
              reactions (*, profiles (*))
            `)
            .eq('id', payload.new.id)
            .maybeSingle();
          if (data) {
            setMessages(prev => prev.map(msg => msg.id === data.id ? data : msg));
          }
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
        }
      )
      .subscribe();
  }

  function subscribeToPresence() {
    const channel = supabase.channel('online-users');
    channel
      .on('presence', { event: 'sync' }, () => {
        loadUsers();
      })
      .subscribe();

    if (profile) {
      channel.track({ user_id: profile.id, online: true });
    }
  }

  function subscribeToVideoCalls() {
    supabase
      .channel('video-calls')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'video_calls', filter: `receiver_id=eq.${profile?.id}` },
        async (payload) => {
          const { data: caller } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.caller_id)
            .maybeSingle();
          if (caller) {
            setIncomingCall({ ...payload.new, caller });
          }
        }
      )
      .subscribe();
  }

  async function createChannel(name: string, description: string, isPrivate: boolean) {
    const { data, error } = await supabase
      .from('channels')
      .insert({
        name,
        description,
        created_by: profile?.id,
        is_private: isPrivate,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating channel:', error);
      return;
    }

    if (data && profile) {
      await supabase.from('channel_members').insert({
        channel_id: data.id,
        user_id: profile.id,
        role: 'owner',
      });
      setSelectedChannel(data);
    }
  }

  if (profile?.banned) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-red-600 dark:text-red-400 text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Suspended</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your account has been suspended by an administrator.
          </p>
          <button
            onClick={signOut}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <div className={`${showSidebar ? 'block' : 'hidden'} lg:block w-64 flex-shrink-0`}>
        <ChannelList
          channels={channels}
          selectedChannel={selectedChannel}
          onSelectChannel={(channel) => {
            setSelectedChannel(channel);
            setShowSidebar(false);
          }}
          onCreateChannel={createChannel}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="lg:hidden text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              {showSidebar ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <Hash className="w-5 h-5 text-gray-400" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {selectedChannel?.name || 'Select a channel'}
            </h1>
            {selectedChannel?.description && (
              <span className="text-sm text-gray-500 dark:text-gray-400 hidden md:inline">
                {selectedChannel.description}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg relative"
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg lg:hidden"
            >
              <Users className="w-5 h-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={signOut}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            <MessageList
              messages={messages}
              currentUserId={profile?.id || ''}
              channelId={selectedChannel?.id}
            />
            {selectedChannel && (
              <MessageInput
                channelId={selectedChannel.id}
                onMessageSent={() => {}}
              />
            )}
          </div>

          <div className={`${showUsers ? 'block' : 'hidden'} lg:block w-64 flex-shrink-0 border-l border-gray-200 dark:border-gray-700`}>
            <UserList
              users={users}
              currentUserId={profile?.id || ''}
              onCallUser={(userId) => {
                setActiveCall({ receiver_id: userId, caller_id: profile?.id });
              }}
            />
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {showNotifications && (
        <NotificationCenter onClose={() => setShowNotifications(false)} />
      )}

      {incomingCall && (
        <VideoCallModal
          call={incomingCall}
          isIncoming={true}
          onClose={() => setIncomingCall(null)}
        />
      )}

      {activeCall && (
        <VideoCallModal
          call={activeCall}
          isIncoming={false}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}
