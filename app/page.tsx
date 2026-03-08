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
        <h1 className={styles.title}>🎥 Видео Звонки</h1>
        <p className={styles.subtitle}>
          Создайте комнату и поделитесь ссылкой для видео-звонка
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
                  Создаем комнату...
                </>
              ) : (
                '+ Создать комнату'
              )}
            </button>
          </div>
        ) : (
          <div className="card" style={{ marginTop: '2rem' }}>
            <div className={styles.roomInfo}>
              <h2>✅ Комната создана!</h2>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                Ссылка действительна до {new Date(roomData.expiresAt).toLocaleString('ru-RU')}
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
                  {copied ? '✓ Скопировано' : '📋 Копировать'}
                </button>
              </div>

              <div className={styles.actions}>
                <a 
                  href={`/room/${roomData.token}`}
                  className="btn btn-primary"
                >
                  🎥 Присоединиться к звонку
                </a>
                <button 
                  className="btn btn-secondary"
                  onClick={() => setRoomData(null)}
                >
                  Создать новую комнату
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🔒</div>
            <h3>Безопасно</h3>
            <p>Peer-to-peer соединение через WebRTC</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>⚡</div>
            <h3>Быстро</h3>
            <p>Комната доступна 15 минут</p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>👥</div>
            <h3>Просто</h3>
            <p>Один клик для создания звонка</p>
          </div>
        </div>
      </div>
    </div>
  );
}
