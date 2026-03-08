import { useState, useEffect } from 'react';
import { Profile, supabase } from '../lib/supabase';
import { Phone, UserX, Search } from 'lucide-react';

interface UserListProps {
  users: Profile[];
  currentUserId: string;
  onCallUser: (userId: string) => void;
}

export default function UserList({ users, currentUserId, onCallUser }: UserListProps) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOnlineUsers();
    loadBlockedUsers();
    subscribeToPresence();
  }, []);

  async function loadOnlineUsers() {
    const { data } = await supabase
      .from('presence')
      .select('user_id')
      .eq('is_online', true);
    if (data) {
      setOnlineUsers(new Set(data.map(p => p.user_id)));
    }
  }

  async function loadBlockedUsers() {
    const { data } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', currentUserId);
    if (data) {
      setBlockedUsers(new Set(data.map(b => b.blocked_id)));
    }
  }

  function subscribeToPresence() {
    supabase
      .channel('presence-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presence' }, () => {
        loadOnlineUsers();
      })
      .subscribe();
  }

  async function handleBlock(userId: string) {
    if (blockedUsers.has(userId)) {
      await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', userId);
      setBlockedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    } else {
      if (confirm('Block this user?')) {
        await supabase.from('user_blocks').insert({
          blocker_id: currentUserId,
          blocked_id: userId,
        });
        setBlockedUsers(prev => new Set(prev).add(userId));
      }
    }
  }

  const filteredUsers = users.filter(user =>
    user.id !== currentUserId &&
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full bg-white dark:bg-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-bold text-lg text-gray-900 dark:text-white mb-3">
          Users ({filteredUsers.length})
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredUsers.map((user) => {
          const isOnline = onlineUsers.has(user.id);
          const isBlocked = blockedUsers.has(user.id);

          return (
            <div
              key={user.id}
              className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: user.avatar_color }}
                  >
                    {user.username[0].toUpperCase()}
                  </div>
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {user.username}
                    {isBlocked && <span className="text-xs text-red-500 ml-2">(Blocked)</span>}
                  </div>
                  {user.custom_status && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.custom_status}
                    </div>
                  )}
                  {!user.custom_status && (
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                  )}
                </div>

                <div className="flex gap-1">
                  {isOnline && !isBlocked && (
                    <button
                      onClick={() => onCallUser(user.id)}
                      className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                      title="Call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleBlock(user.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      isBlocked
                        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title={isBlocked ? 'Unblock' : 'Block'}
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
