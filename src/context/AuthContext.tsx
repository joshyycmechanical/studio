
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, firebaseInitializationError } from '@/lib/firebase/config';
import type { UserProfile, ActiveTimer } from '@/types/user';
import type { Module } from '@/types/module';
import { Loader2 } from 'lucide-react';
import { fetchUserProfileFromAPI } from '@/services/users';

// --- Types and Context Definition ---
export type AuthStatus = 'loading' | 'loggedOut' | 'loggedIn' | 'error';

interface AuthContextType {
  user: UserProfile | null;
  authStatus: AuthStatus;
  loading: boolean; // Convenience flag for loading state
  firebaseUser: FirebaseUser | null;
  companyId: string | null;
  installedModules: Module[];
  authError: string | null;
  activeTimer: ActiveTimer | null;
  fetchUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [installedModules, setInstalledModules] = useState<Module[]>([]);
  const [authError, setAuthError] = useState<string | null>(firebaseInitializationError);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);

  const clearState = useCallback(() => {
      setUser(null);
      setCompanyId(null);
      setInstalledModules([]);
      setActiveTimer(null);
      setAuthError(null);
      setAuthStatus('loggedOut');
  }, []);

  const fetchAndSetUserData = useCallback(async (fbUser: FirebaseUser) => {
    try {
      console.log(`[AuthContext] Fetching profile for UID: ${fbUser.uid}`);
      const idToken = await fbUser.getIdToken(true);
      const profile = await fetchUserProfileFromAPI(idToken);

      if (profile) {
        setUser(profile);
        setActiveTimer(profile.active_timer || null);
        setCompanyId(profile.company_id || null);
        setInstalledModules(profile.modules || []);
        // Directly set to loggedIn if profile exists. Onboarding is handled by AppLayout redirect.
        setAuthStatus('loggedIn');
      } else {
        // This case means the user is authenticated with Firebase but has no profile in Firestore.
        // This is an error state or an onboarding state.
        console.warn(`[AuthContext] User profile not found for UID: ${fbUser.uid}. Forcing logout.`);
        await auth.signOut(); // Force logout to clear state.
        setAuthError("Your user profile was not found. Please log in again.");
        setAuthStatus('error');
      }
    } catch (error: any) {
      console.error("[AuthContext] Error fetching user data:", error);
      setAuthError(error.message);
      setAuthStatus('error');
      await auth.signOut().catch(e => console.error("Failed to sign out after error:", e)); // Attempt to sign out on error
    }
  }, []);

  useEffect(() => {
    if (firebaseInitializationError) {
      setAuthError(firebaseInitializationError);
      setAuthStatus('error');
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        fetchAndSetUserData(fbUser);
      } else {
        setFirebaseUser(null);
        clearState();
      }
    });

    return () => unsubscribe();
  }, [fetchAndSetUserData, clearState]);

  const fetchUserProfile = useCallback(async () => {
    if (firebaseUser) {
      await fetchAndSetUserData(firebaseUser);
    } else {
      console.warn("[AuthContext] Manual profile fetch skipped: no authenticated user.");
    }
  }, [firebaseUser, fetchAndSetUserData]);

  const value = {
      user,
      authStatus,
      loading: authStatus === 'loading',
      firebaseUser,
      companyId,
      installedModules,
      authError,
      activeTimer,
      fetchUserProfile,
  };
  
  // Render a loading screen for the initial check, but pass children for other states.
  if (authStatus === 'loading') {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-background">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
      );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
