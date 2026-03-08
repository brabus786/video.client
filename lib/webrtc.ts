export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  private config: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
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
        this.remoteStream = event.streams[0];
        this.onRemoteStream(this.remoteStream);
      };

      // Обрабатываем ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.onIceCandidate(event.candidate);
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
      // Проверяем, не находимся ли мы в процессе создания собственного offer
      const isStable = 
        this.peerConnection.signalingState === 'stable' || 
        this.peerConnection.signalingState === 'have-local-offer';
      
      if (!isStable) {
        // Rollback - откатываем наше локальное описание
        await this.peerConnection.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;

    try {
      // Проверяем состояние перед установкой answer
      if (this.peerConnection.signalingState !== 'have-local-offer') {
        console.warn('Ignoring answer - not in correct state:', this.peerConnection.signalingState);
        return;
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;

    try {
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
