import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SystemUser } from '../types';
import {
  getAuthenticatedUser,
  getSession,
  loadSystemUser,
  signIn as authSignIn,
  signOut as authSignOut,
  subscribeToAuthChanges
} from '../services/authService';

interface AuthContextValue {
  currentUser: SystemUser | null;
  authUser: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PASSWORD_RECOVERY_MARKER = 'unic-password-recovery';

function hasPasswordRecoveryMarker(): boolean {
  try {
    return sessionStorage.getItem(PASSWORD_RECOVERY_MARKER) === 'true';
  } catch {
    return false;
  }
}

function storePasswordRecoveryMarker(active: boolean): void {
  try {
    if (active) {
      sessionStorage.setItem(PASSWORD_RECOVERY_MARKER, 'true');
    } else {
      sessionStorage.removeItem(PASSWORD_RECOVERY_MARKER);
    }
  } catch {
    // Recovery still works in-memory when session storage is unavailable.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<SystemUser | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const operationId = useRef(0);
  const mounted = useRef(false);
  const signInInProgress = useRef(false);
  const passwordRecoveryActive = useRef(false);

  const setPasswordRecovery = (active: boolean) => {
    passwordRecoveryActive.current = active;
    setIsPasswordRecovery(active);
    storePasswordRecoveryMarker(active);
  };

  const clearAuthState = () => {
    setCurrentUser(null);
    setAuthUser(null);
    setSession(null);
    setPasswordRecovery(false);
  };

  const applySession = async (nextSession: Session) => {
    const id = ++operationId.current;

    try {
      const profile = await loadSystemUser(nextSession.user.id);
      if (!mounted.current || id !== operationId.current) return;
      setSession(nextSession);
      setAuthUser(nextSession.user);
      setCurrentUser(profile);
      setIsPasswordRecovery(passwordRecoveryActive.current || hasPasswordRecoveryMarker());
    } catch (error) {
      console.error('Oturum profili doğrulanamadı.', error);
      if (!mounted.current || id !== operationId.current) return;
      clearAuthState();
      try {
        await authSignOut();
      } catch (signOutError) {
        console.error('Geçersiz oturum kapatılamadı.', signOutError);
      }
    } finally {
      if (mounted.current && id === operationId.current) setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    signInInProgress.current = true;
    const id = ++operationId.current;
    try {
      const result = await authSignIn(email, password);
      if (!mounted.current || id !== operationId.current) return;
      setSession(result.session);
      setAuthUser(result.authUser);
      setCurrentUser(result.currentUser);
      setPasswordRecovery(false);
    } finally {
      signInInProgress.current = false;
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    ++operationId.current;
    try {
      await authSignOut();
    } finally {
      if (mounted.current) {
        clearAuthState();
        setIsLoading(false);
      }
    }
  };

  const refreshCurrentUser = async () => {
    const id = ++operationId.current;
    setIsLoading(true);
    try {
      const user = await getAuthenticatedUser();
      const profile = await loadSystemUser(user.id);
      if (!mounted.current || id !== operationId.current) return;
      setAuthUser(user);
      setCurrentUser(profile);
    } catch (error) {
      if (!mounted.current || id !== operationId.current) throw error;
      clearAuthState();
      try {
        await authSignOut();
      } catch (signOutError) {
        console.error('Geçersiz oturum kapatılamadı.', signOutError);
      }
      throw error;
    } finally {
      if (mounted.current && id === operationId.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;

    const initialize = async () => {
      const id = ++operationId.current;
      try {
        const initialSession = await getSession();
        if (!initialSession) {
          if (mounted.current && id === operationId.current) clearAuthState();
          return;
        }

        const user = await getAuthenticatedUser();
        const profile = await loadSystemUser(user.id);
        if (!mounted.current || id !== operationId.current) return;
        setSession(initialSession);
        setAuthUser(user);
        setCurrentUser(profile);
        setPasswordRecovery(hasPasswordRecoveryMarker());
      } catch (error) {
        console.error('Başlangıç oturumu doğrulanamadı.', error);
        if (!mounted.current || id !== operationId.current) return;
        clearAuthState();
        try {
          await authSignOut();
        } catch (signOutError) {
          console.error('Geçersiz başlangıç oturumu kapatılamadı.', signOutError);
        }
      } finally {
        if (mounted.current && id === operationId.current) setIsLoading(false);
      }
    };

    const subscription = subscribeToAuthChanges((event, nextSession) => {
      queueMicrotask(() => {
        if (!mounted.current) return;

        if (event === 'SIGNED_OUT' || !nextSession) {
          ++operationId.current;
          clearAuthState();
          setIsLoading(false);
          return;
        }

        if (
          event === 'SIGNED_IN'
          || event === 'TOKEN_REFRESHED'
          || event === 'USER_UPDATED'
          || event === 'PASSWORD_RECOVERY'
        ) {
          if (event === 'SIGNED_IN' && signInInProgress.current) return;
          if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
          setIsLoading(true);
          void applySession(nextSession);
        }
      });
    });

    void initialize();

    return () => {
      mounted.current = false;
      ++operationId.current;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        authUser,
        session,
        isAuthenticated: Boolean(session && authUser && currentUser),
        isLoading,
        isPasswordRecovery,
        signIn,
        signOut,
        refreshCurrentUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  return context;
}
