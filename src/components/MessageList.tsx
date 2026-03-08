import { useEffect, useRef, useState } from 'react';
import { Message, supabase } from '../lib/supabase';
import { Heart, Trash2, CreditCard as Edit2, Reply, Pin, Download, Play, Pause, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from '../utils/dateFormat';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  channelId?: string;
}

export default function MessageList({ messages, currentUserId, channelId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [showMenuFor, setShowMenuFor] = useState<string | null>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleReaction(messageId: string) {
    const existing = messages
      .find(m => m.id === messageId)
      ?.reactions?.find(r => r.user_id === currentUserId && r.reaction_type === 'heart');

    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('reactions').insert({
        message_id: messageId,
        user_id: currentUserId,
        reaction_type: 'heart',
      });
    }
  }

  async function handleDelete(messageId: string) {
    if (confirm('Delete this message?')) {
      await supabase.from('messages').delete().eq('id', messageId);
    }
  }

  async function handleEdit(messageId: string) {
    if (editContent.trim()) {
      await supabase
        .from('messages')
        .update({ content: editContent, edited_at: new Date().toISOString() })
        .eq('id', messageId);
      setEditingId(null);
      setEditContent('');
    }
  }

  async function handlePin(messageId: string) {
    const message = messages.find(m => m.id === messageId);
    if (!message?.is_pinned) {
      await supabase.from('pinned_messages').insert({
        message_id: messageId,
        channel_id: channelId,
        pinned_by: currentUserId,
      });
      await supabase.from('messages').update({ is_pinned: true }).eq('id', messageId);
    } else {
      await supabase.from('pinned_messages').delete().eq('message_id', messageId);
      await supabase.from('messages').update({ is_pinned: false }).eq('id', messageId);
    }
  }

  function startEdit(message: Message) {
    setEditingId(message.id);
    setEditContent(message.content);
    setShowMenuFor(null);
  }

  if (!channelId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Select a channel to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((message) => {
          const isOwn = message.user_id === currentUserId;
          const reactionCount = message.reactions?.filter(r => r.reaction_type === 'heart').length || 0;
          const hasReacted = message.reactions?.some(r => r.user_id === currentUserId && r.reaction_type === 'heart');

          return (
            <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl w-full ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  {!isOwn && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                      style={{ backgroundColor: message.profiles?.avatar_color }}
                    >
                      {message.profiles?.username[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {message.profiles?.username}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDistanceToNow(message.created_at)}
                    {message.edited_at && ' (edited)'}
                  </span>
                  {message.is_pinned && (
                    <Pin className="w-3 h-3 text-yellow-500" />
                  )}
                </div>

                <div className="relative group">
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      isOwn
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                    } ${message.is_pinned ? 'ring-2 ring-yellow-500' : ''}`}
                  >
                    {editingId === message.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleEdit(message.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(message.id)}
                            className="text-xs px-2 py-1 bg-green-600 text-white rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs px-2 py-1 bg-gray-600 text-white rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>

                        {message.attachments?.map((att) => (
                          <div key={att.id} className="mt-2">
                            {att.file_type.startsWith('image/') ? (
                              <img
                                src={att.file_url}
                                alt={att.file_name}
                                className="max-w-xs rounded-lg"
                              />
                            ) : (
                              <a
                                href={att.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm underline"
                              >
                                <Download className="w-4 h-4" />
                                {att.file_name}
                              </a>
                            )}
                          </div>
                        ))}

                        {message.voice_messages?.map((vm) => (
                          <div key={vm.id} className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => {
                                const audio = new Audio(vm.audio_url);
                                if (playingAudio === vm.id) {
                                  audio.pause();
                                  setPlayingAudio(null);
                                } else {
                                  audio.play();
                                  setPlayingAudio(vm.id);
                                  audio.onended = () => setPlayingAudio(null);
                                }
                              }}
                              className="p-2 rounded-full bg-white/20 hover:bg-white/30"
                            >
                              {playingAudio === vm.id ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                            <span className="text-sm">{vm.duration}s</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {editingId !== message.id && (
                    <div className="absolute top-0 -right-10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setShowMenuFor(showMenuFor === message.id ? null : message.id)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </button>

                      {showMenuFor === message.id && (
                        <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10 min-w-[150px]">
                          <button
                            onClick={() => handleReaction(message.id)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Heart className="w-4 h-4" />
                            React
                          </button>
                          <button
                            onClick={() => handlePin(message.id)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Pin className="w-4 h-4" />
                            {message.is_pinned ? 'Unpin' : 'Pin'}
                          </button>
                          {isOwn && (
                            <>
                              <button
                                onClick={() => startEdit(message)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(message.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {reactionCount > 0 && (
                  <button
                    onClick={() => handleReaction(message.id)}
                    className={`mt-1 px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                      hasReacted
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Heart className={`w-3 h-3 ${hasReacted ? 'fill-current' : ''}`} />
                    {reactionCount}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
