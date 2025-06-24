export interface TV {
  id: number;
  name: string;
  image: string | null;
  youtubeLink: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface SocketEvents {
  tvAdded: { tvData: TV };
  imageUpdated: { tvId: number; tvData: TV };
  youtubeLinkUpdated: { tvId: number; tvData: TV };
  tvDeleted: { tvId: number };
  tvListUpdate: TV[];
  zoomCommandSent: { tvId: number; command: string; clientCount?: number };
  zoomCommand: { command: string };
  joinedTvRoom: { tvId: number; roomName: string };
}

export type ZoomCommand = 'zoomIn' | 'zoomOut' | 'resetZoom' | 'fitToScreen' | 'stretchToScreen';