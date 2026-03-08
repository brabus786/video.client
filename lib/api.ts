const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface CreateRoomResponse {
  success: boolean;
  data?: {
    roomId: string;
    token: string;
    link: string;
    expiresAt: string;
    expiresIn: string;
  };
  error?: string;
}

export interface RoomInfoResponse {
  success: boolean;
  data?: {
    roomId: string;
    participantsCount: number;
    maxParticipants: number;
    isAvailable: boolean;
    expiresAt: string;
  };
  error?: string;
}

export const createRoom = async (): Promise<CreateRoomResponse> => {
  try {
    const response = await fetch(`${API_URL}/api/room/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return await response.json();
  } catch (error) {
    console.error('Error creating room:', error);
    return { success: false, error: 'Failed to create room' };
  }
};

export const getRoomInfo = async (token: string): Promise<RoomInfoResponse> => {
  try {
    const response = await fetch(`${API_URL}/api/room/${token}`);
    return await response.json();
  } catch (error) {
    console.error('Error getting room info:', error);
    return { success: false, error: 'Failed to get room info' };
  }
};
