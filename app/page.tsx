'use client';

import { useState } from 'react';
import { createRoom } from '@/lib/api';
import styles from './page.module.css';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [roomData, setRoomData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateRoom = async () => {
    setLoading(true);
    const response = await createRoom();
    
    if (response.success && response.data) {
      setRoomData(response.data);
    }
    setLoading(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  };

  return (
    <div className="container">
      <div className={styles.hero}>
        <h1 className={styles.title}>🎥 Video Calls</h1>
        <p className={styles.subtitle}>
          Create a room and share the link for a video call
        </p>

        {!roomData ? (
          <div className={styles.createSection}>
            <button 
              className="btn btn-primary btn-large"
              onClick={handleCreateRoom}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
                  Creating room...
                </>
              ) : (
                '+ Create Room'
              )}
            </button>
          </div>
        ) : (
          <div className="card" style={{ marginTop: '2rem' }}>
            <div className={styles.roomInfo}>
              <h2>✅ Room created!</h2>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                Link valid until {new Date(roomData.expiresAt).toLocaleString('en-US')}
              </p>

              <div className={styles.linkContainer}>
                <div className={styles.linkBox}>
                  <span className={styles.linkText}>
                    {getBaseUrl()}/room/{roomData.token}
                  </span>
                </div>
                <button 
                  className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
                  onClick={() => copyToClipboard(`${getBaseUrl()}/room/${roomData.token}`)}
                >
                  {copied ? '✓ Copied' : '📋 Copy'}
                </button>
              </div>

              <div className={styles.actions}>
                <a 
                  href={`/room/${roomData.token}`}
                  className="btn btn-primary"
                >
                  🎥 Join the call
                </a>
                <button 
                  className="btn btn-secondary"
                  onClick={() => setRoomData(null)}
                >
                  Create new room
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🔒</div>
            <h3>Secure</h3>
            <p>Peer-to-peer connection via WebRTC</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>⚡</div>
            <h3>Fast</h3>
            <p>Room available for 15 minutes</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>👥</div>
            <h3>Simple</h3>
            <p>One click to create a call</p>
          </div>
        </div>
      </div>
    </div>
  );
}
