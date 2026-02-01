
export interface LandmarkAnalysis {
  name: string;
  history: string;
  sources: Array<{ title: string; uri: string }>;
  audioData?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  LOADING_IMAGE = 'LOADING_IMAGE',
  SEARCHING_HISTORY = 'SEARCHING_HISTORY',
  GENERATING_AUDIO = 'GENERATING_AUDIO',
  PLAYING = 'PLAYING',
  ERROR = 'ERROR'
}
