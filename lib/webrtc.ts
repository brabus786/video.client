export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  private config: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Публичный TURN сервер (для production нужен свой!)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10
  };

  constructor(
    private onLocalStream: (stream: MediaStream) => void,
    private onRemoteStream: (stream: MediaStream) => void,
    private onIceCandidate: (candidate: RTCIceCandidate) => void
  ) {}

  async initialize() {
    try {
      // Получаем доступ к медиа устройствам
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      this.onLocalStream(this.localStream);

      // Создаем peer connection
      this.peerConnection = new RTCPeerConnection(this.config);

      // Добавляем локальные треки
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Обрабатываем удаленные треки
      this.peerConnection.ontrack = (event) => {
        console.log('🎥 ontrack event:', event.streams.length, 'streams');
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          console.log('🎥 Remote stream получен:', this.remoteStream.getTracks().length, 'tracks');
          this.onRemoteStream(this.remoteStream);
        }
      };

      // Обработка изменений состояния соединения
      this.peerConnection.onconnectionstatechange = () => {
        console.log('📡 Connection state:', this.peerConnection?.connectionState);
        if (this.peerConnection?.connectionState === 'failed') {
          console.error('❌ Connection failed - возможно проблема с NAT/firewall');
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', this.peerConnection?.iceConnectionState);
        if (this.peerConnection?.iceConnectionState === 'failed') {
          console.error('❌ ICE failed - нужен TURN сервер');
        }
        if (this.peerConnection?.iceConnectionState === 'connected' || 
            this.peerConnection?.iceConnectionState === 'completed') {
          console.log('✅ ICE соединение установлено!');
        }
      };

      this.peerConnection.onicegatheringstatechange = () => {
        console.log('🔍 ICE gathering state:', this.peerConnection?.iceGatheringState);
      };

      // Обрабатываем ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('📡 Отправляем ICE candidate:', event.candidate.type, event.candidate.protocol);
          this.onIceCandidate(event.candidate);
        } else {
          console.log('✅ Все ICE candidates собраны');
        }
      };

      return this.peerConnection;
    } catch (error) {
      console.error('Error initializing WebRTC:', error);
      throw error;
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      return null;
    }
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;

    try {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Error creating answer:', error);
      return null;
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;

    try {
      // Проверяем что мы ждем answer
      if (this.peerConnection.signalingState === 'have-local-offer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      } else {
        console.warn('Получен answer в неожиданном состоянии:', this.peerConnection.signalingState);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;

    try {
      console.log('📥 Получен ICE candidate:', candidate.candidate?.substring(0, 50) + '...');
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
  }
}
