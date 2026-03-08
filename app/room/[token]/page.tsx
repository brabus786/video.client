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
      // Проверяем токен
      const response = await getRoomInfo(token);
      
      if (!response.success || !response.data) {
        setError(response.error || 'Комната не найдена');
        setLoading(false);
        return;
      }

      if (!response.data.isAvailable) {
        setError('Комната заполнена');
        setLoading(false);
        return;
      }

      setRoomInfo(response.data);

      const iceServersResponse = await getIceServers();
      if (iceServersResponse.success && iceServersResponse.data?.iceServers?.length) {
        iceServersRef.current = iceServersResponse.data.iceServers;
      }

      // Инициализируем сокет
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
        
        // Присоединяемся к комнате
        socket.emit('join-room', { token }, async (response: any) => {
          if (response.success) {
            roomIdRef.current = response.roomId;
            await initializeWebRTC();
            
            // Если мы второй участник - создаем offer и инициируем соединение
            if (response.participantsCount >= 2) {
              console.log('Второй участник - создаем offer');
              const offer = await webrtcRef.current?.createOffer();
              if (offer && roomIdRef.current) {
                socket.emit('offer', { offer, roomId: roomIdRef.current });
              }
            } else {
              console.log('Первый участник - ждем второго');
            }
          } else {
            setError(response.error);
          }
        });
      });

      // WebRTC события
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
      setError('Ошибка инициализации');
      setLoading(false);
    }
  };

  const initializeWebRTC = async () => {
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
      iceServersRef.current || undefined
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
        <p style={{ color: 'white', marginTop: '1rem' }}>Подключение...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</h1>
          <h2 style={{ marginBottom: '1rem' }}>Ошибка</h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => router.push('/')}>
            На главную
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.roomContainer}>
      <div className={styles.videoGrid}>
        {/* Удаленное видео (главное) */}
        <div className={`video-container ${styles.remoteVideo}`}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
          />
          {!remoteStreamReceived && (
            <div className={styles.waitingOverlay}>
              <div className="spinner"></div>
              <p style={{ marginTop: '1rem' }}>Ожидание собеседника...</p>
            </div>
          )}
        </div>

        {/* Локальное видео (маленькое) */}
        <div className={`video-container ${styles.localVideo}`}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
          />
        </div>
      </div>

      {/* Элементы управления */}
      <div className="video-controls">
        <button
          className={`btn ${audioEnabled ? 'btn-secondary' : 'btn-danger'}`}
          onClick={toggleAudio}
          title={audioEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
        >
          {audioEnabled ? '🎤' : '🔇'}
        </button>

        <button
          className={`btn ${videoEnabled ? 'btn-secondary' : 'btn-danger'}`}
          onClick={toggleVideo}
          title={videoEnabled ? 'Выключить камеру' : 'Включить камеру'}
        >
          {videoEnabled ? '📹' : '📷'}
        </button>

        <button
          className="btn btn-danger"
          onClick={leaveRoom}
          title="Завершить звонок"
        >
          📞
        </button>
      </div>

      {/* Статус */}
      <div className={styles.statusBar}>
        <span className={`status ${connected ? 'status-success' : 'status-error'}`}>
          {connected ? '● Подключено' : '● Отключено'}
        </span>
        {peerConnected && (
          <span className="status status-success">
            👥 Собеседник онлайн
          </span>
        )}
      </div>
    </div>
  );
}
