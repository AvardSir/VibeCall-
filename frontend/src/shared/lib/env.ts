// Single source for the backend base URL. Reads the Vite env with a localhost dev fallback so
// apiClient (REST) and socketClient (Socket.IO) don't each re-read the env / hardcode the fallback.
export const apiBaseUrl: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
