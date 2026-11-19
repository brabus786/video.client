export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  private config: RTCConfiguration = {
    iceServers: [
      { urls: process.env.NEXT_PUBLIC_STUN_URL_1 || 'stun:stun.l.google.com:19302' },
      { urls: process.env.NEXT_PUBLIC_STUN_URL_2 || 'stun:stun1.l.google.com:19302' },
      {
        urls: process.env.NEXT_PUBLIC_TURN_URL || 'turn:openrelay.metered.ca:80',
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject',
        credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  constructor(
    private onLocalStream: (stream: MediaStream) => void,
    private onRemoteStream: (stream: MediaStream) => void,
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    iceServers?: RTCIceServer[],
    relayOnly = false
  ) {
    if (iceServers && iceServers.length > 0) {
      this.config = {
        ...this.config,
        iceServers
      };
    }
    if (relayOnly) {
      this.config = {
        ...this.config,
        iceTransportPolicy: 'relay'
      };
    }
  }

  async initialize() {
    try {
      // Get access to media devices
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      this.onLocalStream(this.localStream);

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(this.config);

      // Add local tracks
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      this.remoteStream = new MediaStream();

      this.peerConnection.ontrack = (event) => {
        if (!this.remoteStream) return;

        const trackExists = this.remoteStream.getTracks().some(track => track.id === event.track.id);
        if (!trackExists) {
          this.remoteStream.addTrack(event.track);
        }

        if (this.remoteStream.getTracks().length > 0) {
          this.onRemoteStream(this.remoteStream);
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('Connection state:', state);
        if (state === 'failed') {
          console.error('Connection failed - TURN servers may be unavailable');
        } else if (state === 'connected') {
          console.log('✅ Connection established successfully!');
        }
      };

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Log ICE candidate type for diagnostics
          console.log('ICE candidate type:', event.candidate.type, 'candidate:', event.candidate.candidate.substring(0, 50) + '...');
          this.onIceCandidate(event.candidate);
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        const iceState = this.peerConnection?.iceConnectionState;
        console.log('ICE connection state:', iceState);
        if (iceState === 'failed') {
          console.error('❌ ICE connection failed - direct P2P does not work, a working TURN is required');
        } else if (iceState === 'connected' || iceState === 'completed') {
          console.log('✅ ICE connected!');
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

  async restartIce(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;

    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Error restarting ICE:', error);
      return null;
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      await this.flushPendingIceCandidates();
    } catch (error) {
      console.error('Error handling offer:', error);
      throw error;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;

    try {
      if (this.peerConnection.signalingState === 'have-local-offer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        await this.flushPendingIceCandidates();
      } else {
        console.warn('Unexpected signaling state for answer:', this.peerConnection.signalingState);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
      throw error;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;

    try {
      if (!this.peerConnection.remoteDescription) {
        this.pendingIceCandidates.push(candidate);
        return;
      }

      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  private async flushPendingIceCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription || this.pendingIceCandidates.length === 0) {
      return;
    }

    const candidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];

    for (const candidate of candidates) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding queued ICE candidate:', error);
      }
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
    this.pendingIceCandidates = [];
  }
}
