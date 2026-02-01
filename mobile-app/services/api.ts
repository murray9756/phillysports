import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'https://phillysports.com/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const TOKEN_KEY = 'auth_token';

export const getToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const removeToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await removeToken();
      // Navigation to login will be handled by auth context
    }
    return Promise.reject(error);
  }
);

export default api;

// ============ AUTH ENDPOINTS ============
export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      await setToken(response.data.token);
    }
    return response.data;
  },

  register: async (username: string, email: string, password: string) => {
    const response = await api.post('/auth/register', { username, email, password });
    if (response.data.token) {
      await setToken(response.data.token);
    }
    return response.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
    await removeToken();
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, password: string) => {
    const response = await api.post('/auth/reset-password', { token, password });
    return response.data;
  },
};

// ============ SPORTS ENDPOINTS ============
export const sportsService = {
  getNews: async (team?: string) => {
    const params = team ? { team } : {};
    const response = await api.get('/news', { params });
    return response.data;
  },

  getScores: async (team?: string) => {
    const params = team ? { team } : {};
    const response = await api.get('/scores', { params });
    return response.data;
  },

  getSchedule: async (team?: string, days?: number) => {
    const params: any = {};
    if (team) params.team = team;
    if (days) params.days = days;
    const response = await api.get('/schedule', { params });
    return response.data;
  },

  getStandings: async (sport: string) => {
    const response = await api.get(`/standings/${sport}`);
    return response.data;
  },

  getRoster: async (team: string) => {
    const response = await api.get('/roster', { params: { team } });
    return response.data;
  },

  getStats: async (team: string) => {
    const response = await api.get(`/stats/${team}`);
    return response.data;
  },
};

// ============ TRIVIA ENDPOINTS ============
export const triviaService = {
  getQuestion: async (team?: string) => {
    const params = team ? { team } : {};
    const response = await api.get('/trivia', { params });
    return response.data;
  },

  submitAnswer: async (questionId: string, answer: string) => {
    const response = await api.post('/trivia', { questionId, selectedAnswer: answer });
    return response.data;
  },
};

// ============ PREDICTIONS ENDPOINTS ============
export const predictionsService = {
  getGames: async (type?: string) => {
    const params = type ? { type } : {};
    const response = await api.get('/predictions', { params });
    return response.data;
  },

  submitPrediction: async (gameId: string, prediction: any) => {
    const response = await api.post('/predictions', { gameId, ...prediction });
    return response.data;
  },

  getLeaderboard: async () => {
    const response = await api.get('/predictions/leaderboard');
    return response.data;
  },
};

// ============ COMMUNITY ENDPOINTS ============
export const communityService = {
  getForumCategories: async () => {
    const response = await api.get('/forums/categories');
    return response.data;
  },

  getForumPosts: async (categoryId?: string, page?: number) => {
    const params: any = {};
    if (categoryId) params.categoryId = categoryId;
    if (page) params.page = page;
    const response = await api.get('/forums/posts', { params });
    return response.data;
  },

  createPost: async (title: string, content: string, categoryId: string) => {
    const response = await api.post('/forums/posts', { title, content, categoryId });
    return response.data;
  },

  getGameThreads: async (status?: string) => {
    const params = status ? { status } : {};
    const response = await api.get('/game-threads', { params });
    return response.data;
  },

  getWatchParties: async (team?: string) => {
    const params = team ? { team } : {};
    const response = await api.get('/watch-parties', { params });
    return response.data;
  },

  getTailgates: async (team?: string) => {
    const params = team ? { team } : {};
    const response = await api.get('/tailgates', { params });
    return response.data;
  },

  getClubs: async () => {
    const response = await api.get('/clubs');
    return response.data;
  },
};

// ============ POKER ENDPOINTS ============
export const pokerService = {
  getTournaments: async () => {
    const response = await api.get('/poker/tournaments');
    return response.data;
  },

  registerTournament: async (tournamentId: string) => {
    const response = await api.post('/poker/tournaments/register', { tournamentId });
    return response.data;
  },

  getCashGames: async () => {
    const response = await api.get('/poker/cash-games');
    return response.data;
  },

  joinCashGame: async (tableId: string) => {
    const response = await api.post(`/poker/cash-games/${tableId}/join`);
    return response.data;
  },

  getTableState: async (tableId: string) => {
    const response = await api.get(`/poker/tables/${tableId}`);
    return response.data;
  },

  sendAction: async (tableId: string, action: string, amount?: number) => {
    const response = await api.post(`/poker/tables/${tableId}/action`, { action, amount });
    return response.data;
  },
};

// ============ SHOP ENDPOINTS ============
export const shopService = {
  getProducts: async (category?: string, page?: number) => {
    const params: any = {};
    if (category) params.category = category;
    if (page) params.page = page;
    const response = await api.get('/shop/products', { params });
    return response.data;
  },

  getRaffles: async () => {
    const response = await api.get('/raffles');
    return response.data;
  },

  purchaseRaffleTickets: async (raffleId: string, quantity: number) => {
    const response = await api.post(`/raffles/${raffleId}/purchase`, { quantity });
    return response.data;
  },

  getOrders: async () => {
    const response = await api.get('/orders');
    return response.data;
  },
};

// ============ USER ENDPOINTS ============
export const userService = {
  getProfile: async (userId: string) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  updateProfile: async (data: any) => {
    const response = await api.post('/profile/update', data);
    return response.data;
  },

  getBadges: async (userId?: string) => {
    const url = userId ? `/badges/user/${userId}` : '/badges';
    const response = await api.get(url);
    return response.data;
  },

  getCoinBalance: async () => {
    const response = await api.get('/coins/balance');
    return response.data;
  },

  claimDailyLogin: async () => {
    const response = await api.post('/coins/daily-login');
    return response.data;
  },
};

// ============ MESSAGING ENDPOINTS ============
export const messagingService = {
  getConversations: async () => {
    const response = await api.get('/messages/conversations');
    return response.data;
  },

  getMessages: async (conversationId: string) => {
    const response = await api.get(`/messages/conversations/${conversationId}`);
    return response.data;
  },

  sendMessage: async (conversationId: string, content: string) => {
    const response = await api.post(`/messages/conversations/${conversationId}/messages`, { content });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/messages/unread-count');
    return response.data;
  },
};
