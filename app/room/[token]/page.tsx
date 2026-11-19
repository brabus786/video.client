'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getIceServers, getRoomInfo } from '@/lib/api';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { WebRTCManager } from '@/lib/webrtc';
import styles from './room.module.css';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [remoteStreamReceived, setRemoteStreamReceived] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const socketRef = useRef<any>(null);
  const roomIdRef = useRef<string | null>(null);
  const iceRestartAttemptedRef = useRef(false);
  const iceServersRef = useRef<RTCIceServer[] | null>(null);

  useEffect(() => {
    initializeRoom();

    return () => {
      cleanup();
    };
  }, [token]);

  const initializeRoom = async () => {
    try {
      // Check token
      const response = await getRoomInfo(token);
      let skipRoomInfo = false;
      if (!response.success && response.error === 'Room not found') {
        // Do not show error, continue initialization via socket
        skipRoomInfo = true;
      } else if (!response.success || !response.data) {
        setError(response.error || 'Room not found');
        setLoading(false);
        return;
      }

      // Do not block connection via REST even if isAvailable === false
      if (!skipRoomInfo && response.data) {
        setRoomInfo(response.data);
      }

      const iceServersResponse = await getIceServers();
      if (iceServersResponse.success && iceServersResponse.data?.iceServers?.length) {
        iceServersRef.current = iceServersResponse.data.iceServers;
      }

      // Initialize socket
      const socket = getSocket();
      socketRef.current = socket;

      socket.off('connect');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-left');

      socket.connect();

      socket.on('connect', () => {
        console.log('Socket connected');
        setConnected(true);
        // Join the room
        socket.emit('join-room', { token }, async (response: any) => {
          if (response.success) {
            roomIdRef.current = response.roomId;
            await initializeWebRTC();
            // If we are the second participant - create offer and initiate connection
            if (response.participantsCount >= 2) {
              console.log('Second participant - creating offer');
              const offer = await webrtcRef.current?.createOffer();
              if (offer && roomIdRef.current) {
                socket.emit('offer', { offer, roomId: roomIdRef.current });
              }
            } else {
              console.log('First participant - waiting for peer');
            }
          } else {
            setError(response.error);
          }
        });
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setError(`Connection error: ${error.message || 'Unknown error'}`);
        setConnected(false);
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setConnected(false);
      });

      // WebRTC events
      socket.on('user-joined', () => {
        console.log('User joined');
      });

      socket.on('offer', async ({ offer }: any) => {
        console.log('Received offer');
        try {
          await webrtcRef.current?.handleOffer(offer);
          const answer = await webrtcRef.current?.createAnswer();
          if (answer && roomIdRef.current) {
            socket.emit('answer', { answer, roomId: roomIdRef.current });
          }
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      });

      socket.on('answer', async ({ answer }: any) => {
        console.log('Received answer');
        try {
          await webrtcRef.current?.handleAnswer(answer);
        } catch (error) {
          console.error('Error handling answer:', error);
        }
      });

      socket.on('ice-candidate', async ({ candidate }: any) => {
        console.log('Received ICE candidate');
        await webrtcRef.current?.addIceCandidate(candidate);

        if (
          webrtcRef.current?.getConnectionState() === 'failed' &&
          !iceRestartAttemptedRef.current &&
          roomIdRef.current
        ) {
          iceRestartAttemptedRef.current = true;
          const restartOffer = await webrtcRef.current.restartIce();
          if (restartOffer) {
            socket.emit('offer', { offer: restartOffer, roomId: roomIdRef.current });
          }
        }
      });

      socket.on('user-left', () => {
        console.log('User left');
        setPeerConnected(false);
        setRemoteStreamReceived(false);
        iceRestartAttemptedRef.current = false;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });

      setLoading(false);
    } catch (err) {
      console.error('Error initializing room:', err);
      setError('Initialization error');
      setLoading(false);
    }
  };

  const initializeWebRTC = async () => {
    const relayOnly = new URLSearchParams(window.location.search).get('turnTest') === '1';
    const webrtc = new WebRTCManager(
      (stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      },
      (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.onloadedmetadata = () => {
            remoteVideoRef.current?.play().catch(() => {});
          };
          setRemoteStreamReceived(true);
          setPeerConnected(true);
        }
      },
      (candidate) => {
        // ICE candidate
        if (socketRef.current && roomIdRef.current) {
          socketRef.current.emit('ice-candidate', {
            candidate,
            roomId: roomIdRef.current
          });
        }
      },
      iceServersRef.current || undefined,
      relayOnly
    );

    await webrtc.initialize();
    webrtcRef.current = webrtc;
  };

  const toggleAudio = () => {
    const newState = !audioEnabled;
    webrtcRef.current?.toggleAudio(newState);
    setAudioEnabled(newState);
  };

  const toggleVideo = () => {
    const newState = !videoEnabled;
    webrtcRef.current?.toggleVideo(newState);
    setVideoEnabled(newState);
  };

  const leaveRoom = () => {
    cleanup();
    router.push('/');
  };

  const cleanup = () => {
    if (webrtcRef.current) {
      webrtcRef.current.cleanup();
    }
    if (socketRef.current && roomIdRef.current) {
      socketRef.current.emit('leave-room', { roomId: roomIdRef.current });
    }
    disconnectSocket();
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner"></div>
        <p style={{ color: 'white', marginTop: '1rem' }}>Connecting...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</h1>
          <h2 style={{ marginBottom: '1rem' }}>Error</h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => router.push('/')}>
            Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.roomContainer}>
      <div className={styles.videoGrid}>
        {/* Remote video (main) */}
        <div className={`video-container ${styles.remoteVideo}`}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
          />
          {!remoteStreamReceived && (
            <div className={styles.waitingOverlay}>
              <div className="spinner"></div>
              <p style={{ marginTop: '1rem' }}>Waiting for peer...</p>
            </div>
          )}
        </div>

        {/* Local video (small) */}
        <div className={`video-container ${styles.localVideo}`}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
          />
        </div>
      </div>

      {/* Controls */}
      <div className="video-controls">
        <button
          className={`btn ${audioEnabled ? 'btn-secondary' : 'btn-danger'}`}
          onClick={toggleAudio}
          title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {audioEnabled ? '🎤' : '🔇'}
        </button>

        <button
          className={`btn ${videoEnabled ? 'btn-secondary' : 'btn-danger'}`}
          onClick={toggleVideo}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {videoEnabled ? '📹' : '📷'}
        </button>

        <button
          className="btn btn-danger"
          onClick={leaveRoom}
          title="End call"
        >
          📞
        </button>
      </div>

      {/* Status */}
      <div className={styles.statusBar}>
        <span className={`status ${connected ? 'status-success' : 'status-error'}`}>
          {connected ? '● Connected' : '● Disconnected'}
        </span>
        {peerConnected && (
          <span className="status status-success">
            👥 Peer online
          </span>
        )}
      </div>
    </div>
  );
}
