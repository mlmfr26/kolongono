import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, registerRefreshCallback } from './api';

export type UserRole = 'adherent' | 'auxiliaire' | 'medecin' | 'admin' | 'livreur';

export type User = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  role: UserRole;
  plan?: string | null;
  centre_id?: string | null;
};

type AuthContextType = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,    setToken]    = useState<string | null>(null);
  const [user,     setUser]     = useState<User | null>(null);
  const [isLoading,setIsLoading]= useState(true);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('kolongono_token');
      const storedUser = await AsyncStorage.getItem('kolongono_user');
      if (stored && storedUser) {
        setToken(stored);
        setUser(JSON.parse(storedUser));
      }
      setIsLoading(false);
    })();

    registerRefreshCallback(
      (newToken, newUser) => { setToken(newToken); setUser(newUser); },
      () => { setToken(null); setUser(null); },
    );
  }, []);

  async function login(email: string, password: string) {
    const data = await api.post<{ access_token: string; user: User }>('/api/auth/login', { email, password });
    await AsyncStorage.setItem('kolongono_token', data.access_token);
    await AsyncStorage.setItem('kolongono_user', JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
  }

  function logout() {
    AsyncStorage.removeItem('kolongono_token');
    AsyncStorage.removeItem('kolongono_user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
