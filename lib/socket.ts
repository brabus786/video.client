import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (url: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'): Socket => {
  if (!socket) {
    socket = io(url, {
      autoConnect: false,
      transports: ['websocket', 'polling']
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
