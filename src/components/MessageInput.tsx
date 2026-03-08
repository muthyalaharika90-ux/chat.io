import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, Paperclip, Mic, X, Smile } from 'lucide-react';
import EmojiPicker from './EmojiPicker';

interface MessageInputProps {
  channelId: string;
  onMessageSent: () => void;
}

export default function MessageInput({ channelId, onMessageSent }: MessageInputProps) {
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  async function handleSend() {
    if (!message.trim() || !profile) return;

    try {
      await supabase.from('messages').insert({
        user_id: profile.id,
        channel_id: channelId,
        content: message.trim(),
      });

      setMessage('');
      onMessageSent();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          user_id: profile.id,
          channel_id: channelId,
          content: file.type.startsWith('image/') ? 'Sent an image' : `Sent ${file.name}`,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      await supabase.from('attachments').insert({
        message_id: messageData.id,
        user_id: profile.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: publicUrl,
      });

      onMessageSent();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await uploadVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to access microphone');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  }

  async function uploadVoiceMessage(audioBlob: Blob) {
    if (!profile) return;

    setUploading(true);
    try {
      const fileName = `${Math.random()}.webm`;
      const filePath = `${profile.id}/voice/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          user_id: profile.id,
          channel_id: channelId,
          content: 'Sent a voice message',
        })
        .select()
        .single();

      if (messageError) throw messageError;

      await supabase.from('voice_messages').insert({
        message_id: messageData.id,
        user_id: profile.id,
        audio_url: publicUrl,
        duration: recordingTime,
      });

      onMessageSent();
    } catch (error) {
      console.error('Error uploading voice message:', error);
      alert('Failed to upload voice message');
    } finally {
      setUploading(false);
    }
  }

  function handleEmojiSelect(emoji: string) {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  }

  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
      <div className="max-w-4xl mx-auto">
        {isRecording && (
          <div className="mb-2 flex items-center justify-between bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-600 dark:text-red-400">
                Recording... {recordingTime}s
              </span>
            </div>
            <button
              onClick={stopRecording}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
            >
              Stop
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,application/pdf,.doc,.docx,.txt"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
            title="Upload file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2 rounded-lg ${
              isRecording
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={isRecording ? 'Stop recording' : 'Record voice message'}
          >
            <Mic className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
              rows={1}
              style={{ maxHeight: '120px' }}
              disabled={uploading}
            />
            <div className="absolute right-2 top-2">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>

            {showEmojiPicker && (
              <div className="absolute bottom-full right-0 mb-2">
                <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
              </div>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!message.trim() || uploading}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            title="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {message.length}/500 characters
        </div>
      </div>
    </div>
  );
}
