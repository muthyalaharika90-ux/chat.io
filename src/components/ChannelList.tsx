import { useState } from 'react';
import { Channel } from '../lib/supabase';
import { Hash, Lock, Plus, X } from 'lucide-react';

interface ChannelListProps {
  channels: Channel[];
  selectedChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onCreateChannel: (name: string, description: string, isPrivate: boolean) => void;
}

export default function ChannelList({ channels, selectedChannel, onSelectChannel, onCreateChannel }: ChannelListProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  function handleCreate() {
    if (newChannelName.trim()) {
      onCreateChannel(newChannelName, newChannelDesc, isPrivate);
      setNewChannelName('');
      setNewChannelDesc('');
      setIsPrivate(false);
      setShowCreateModal(false);
    }
  }

  return (
    <div className="h-full bg-gray-800 dark:bg-gray-900 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-white font-bold text-lg mb-3">Channels</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Channel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel)}
            className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700/50 transition-colors ${
              selectedChannel?.id === channel.id ? 'bg-gray-700' : ''
            }`}
          >
            {channel.is_private ? (
              <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <div className="flex-1 text-left min-w-0">
              <div className="text-white font-medium truncate">{channel.name}</div>
              {channel.description && (
                <div className="text-xs text-gray-400 truncate">{channel.description}</div>
              )}
            </div>
          </button>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create Channel</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
                  placeholder="general"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
                  placeholder="General discussion"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="private"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="private" className="text-sm text-gray-700 dark:text-gray-300">
                  Private channel
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newChannelName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
