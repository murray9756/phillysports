import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, getToken, removeToken } from '@/services/api';

interface User {
  _id: string;
  username: string;
  email: string;
  coinBalance: number;
  displayName?: string;
  bio?: string;
  profilePicture?: string;
  badges?: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateCoinBalance: (newBalance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getToken();
      if (token) {
        const response = await authService.getMe();
        if (response.user) {
          setUser(response.user);
        }
      }
    } catch (error) {
      console.log('Not authenticated');
      await removeToken();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      if (response.user) {
        setUser(response.user);
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed. Please try again.'
      };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await authService.register(username, email, password);
      if (response.user) {
        setUser(response.user);
        return { success: true };
      }
      return { success: false, error: 'Registration failed' };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed. Please try again.'
      };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Logout even if API call fails
    }
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await authService.getMe();
      if (response.user) {
        setUser(response.user);
      }
    } catch (error) {
      console.error('Failed to refresh user');
    }
  };

  const updateCoinBalance = (newBalance: number) => {
    if (user) {
      setUser({ ...user, coinBalance: newBalance });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        updateCoinBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
