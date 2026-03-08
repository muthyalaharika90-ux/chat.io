import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, X } from 'lucide-react';

interface VideoCallModalProps {
  call: any;
  isIncoming: boolean;
  onClose: () => void;
}

export default function VideoCallModal({ call, isIncoming, onClose }: VideoCallModalProps) {
  const { profile } = useAuth();
  const [callAccepted, setCallAccepted] = useState(!isIncoming);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'calling');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (callAccepted) {
      initializeCall();
    }

    return () => {
      cleanup();
    };
  }, [callAccepted]);

  useEffect(() => {
    if (callStatus === 'active') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callStatus]);

  async function initializeCall() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      };

      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setCallStatus('active');
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal('ice-candidate', { candidate: event.candidate });
        }
      };

      if (!isIncoming) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        sendSignal('offer', { offer });
      }

      subscribeToSignals();
    } catch (error) {
      console.error('Error initializing call:', error);
      alert('Failed to access camera/microphone');
      handleEndCall();
    }
  }

  async function sendSignal(type: string, data: any) {
    await supabase.from('call_signals').insert({
      call_id: call.id,
      sender_id: profile?.id,
      signal_type: type,
      signal_data: data,
    });
  }

  function subscribeToSignals() {
    supabase
      .channel(`call-signals-${call.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `call_id=eq.${call.id}` },
        async (payload) => {
          if (payload.new.sender_id === profile?.id) return;

          const { signal_type, signal_data } = payload.new;
          const pc = peerConnectionRef.current;
          if (!pc) return;

          try {
            if (signal_type === 'offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(signal_data.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendSignal('answer', { answer });
            } else if (signal_type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(signal_data.answer));
            } else if (signal_type === 'ice-candidate') {
              await pc.addIceCandidate(new RTCIceCandidate(signal_data.candidate));
            }
          } catch (error) {
            console.error('Error handling signal:', error);
          }
        }
      )
      .subscribe();
  }

  function handleAccept() {
    setCallAccepted(true);
    supabase.from('video_calls').update({ status: 'active' }).eq('id', call.id);
  }

  function handleReject() {
    supabase.from('video_calls').update({ status: 'rejected' }).eq('id', call.id);
    onClose();
  }

  async function handleEndCall() {
    const duration = callDuration;
    await supabase.from('video_calls').update({
      status: 'ended',
      ended_at: new Date().toISOString(),
      duration,
    }).eq('id', call.id);

    cleanup();
    onClose();
  }

  function cleanup() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }

  function toggleMute() {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }

  function toggleVideo() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }

  async function toggleScreenShare() {
    if (!isSharingScreen) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        const sender = peerConnectionRef.current
          ?.getSenders()
          .find(s => s.track?.kind === 'video');

        if (sender) {
          sender.replaceTrack(screenTrack);
          setIsSharingScreen(true);

          screenTrack.onended = () => {
            toggleScreenShare();
          };
        }
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    } else {
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find(s => s.track?.kind === 'video');

        if (sender) {
          sender.replaceTrack(videoTrack);
          setIsSharingScreen(false);
        }
      }
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (isIncoming && !callAccepted) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center text-white text-3xl font-bold"
            style={{ backgroundColor: call.caller?.avatar_color || '#3B82F6' }}
          >
            {call.caller?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {call.caller?.username || 'Unknown'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Incoming video call...</p>
          <div className="flex gap-4">
            <button
              onClick={handleReject}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <PhoneOff className="w-5 h-5" />
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Video className="w-5 h-5" />
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      <div className="h-full flex flex-col">
        <div className="flex-1 relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg border-2 border-white shadow-lg"
          />

          <div className="absolute top-4 left-4 bg-black/50 text-white px-4 py-2 rounded-lg">
            <div className="text-sm">{callStatus === 'calling' ? 'Calling...' : formatDuration(callDuration)}</div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-lg hover:bg-black/70"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-gray-900 p-6">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full ${isMuted ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'} text-white`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full ${isVideoOff ? 'bg-red-600' : 'bg-gray-700 hover:bg-gray-600'} text-white`}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>

            <button
              onClick={toggleScreenShare}
              className={`p-4 rounded-full ${isSharingScreen ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'} text-white`}
            >
              <Monitor className="w-6 h-6" />
            </button>

            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
