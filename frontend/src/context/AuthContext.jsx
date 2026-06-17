import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from '../utils/firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [fbUser, setFbUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set up global unauthorized logout event listener
  useEffect(() => {
    const handleUnauthorized = () => {
      console.log('Session invalidated (unauthorized). Logging out...');
      setUser(null);
      setFbUser(null);
      signOut(auth).catch(() => {});
    };
    
    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, []);

  // Log out the user on the backend on page unload (refresh, tab close, navigation, back button)
  useEffect(() => {
    const handleUnload = () => {
      const token = api.getToken();
      if (token) {
        const baseUrl = api.getBaseUrl();
        fetch(`${baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Tunnel-Skip-AntiSpam': 'true'
          },
          keepalive: true
        }).catch(() => {});
        
        // Immediately invalidate local states to ensure that if the browser restores this page from
        // back/forward cache (bfcache), the user is seen as logged out instead of showing a stale UI.
        api.setToken(null);
        setUser(null);
        setFbUser(null);
        signOut(auth).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  const fetchUser = async () => {
    const token = api.getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await api.auth.getMe();
      setUser(userData);
    } catch (err) {
      console.error('Failed to load user profile from backend', err);
      api.setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user profile on mount if token exists
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setLoading(true);
        setFbUser(firebaseUser);
        if (firebaseUser.emailVerified) {
          try {
            // Check if we already have a session token
            const existingToken = api.getToken();
            if (existingToken) {
              try {
                // Try fetching user. If it succeeds, the session is already valid.
                const userData = await api.auth.getMe();
                setUser(userData);
                setLoading(false);
                return;
              } catch (err) {
                console.log('Existing token invalid, logging in via Firebase...', err);
              }
            }

            const token = await firebaseUser.getIdToken();
            const data = await api.auth.firebaseLogin(token);
            api.setToken(data.token);
            await fetchUser();
          } catch (err) {
            console.error('Error syncing with backend', err);
            api.setToken(null);
            setUser(null);
            setLoading(false);
          }
        } else {
          // Logged in to Firebase but email not verified
          api.setToken(null);
          setUser(null);
          setLoading(false);
        }
      } else {
        // Only clear token if they were actually logged in to Firebase before (sign out)
        setFbUser((prevFbUser) => {
          if (prevFbUser) {
            api.setToken(null);
            setUser(null);
          }
          return null;
        });
        if (!api.getToken()) {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      if (!firebaseUser.emailVerified) {
        // Send a verification mail if somehow not verified and no verification is pending
        setLoading(false);
        throw new Error('unverified');
      }
      
      const token = await firebaseUser.getIdToken();
      const data = await api.auth.firebaseLogin(token);
      api.setToken(data.token);
      await fetchUser();
      return data;
    } catch (err) {
      try {
        console.log('Firebase login failed or user not in Firebase. Attempting local backend login...');
        const data = await api.auth.login(email, password);
        api.setToken(data.token);
        await fetchUser();
        return data;
      } catch (localErr) {
        setLoading(false);
        throw new Error(localErr.message || err.message || 'Invalid credentials');
      }
    }
  };

  const register = async (email, password) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Send verification link
      await sendEmailVerification(firebaseUser);
      setLoading(false);
      return firebaseUser;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const firebaseUser = userCredential.user;
      
      const token = await firebaseUser.getIdToken();
      const data = await api.auth.firebaseLogin(token);
      api.setToken(data.token);
      await fetchUser();
      return data;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Backend logout error:', err);
    }
    try {
      await signOut(auth);
      api.setToken(null);
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkVerificationStatus = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        const firebaseUser = auth.currentUser;
        setFbUser(firebaseUser);
        
        if (firebaseUser.emailVerified) {
          const token = await firebaseUser.getIdToken();
          const data = await api.auth.firebaseLogin(token);
          api.setToken(data.token);
          await fetchUser();
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Verification status check error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Resend verification error:', err);
      throw err;
    }
  };

  const forgotPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      console.error('Password reset error:', err);
      throw err;
    }
  };

  const needVerification = fbUser && !fbUser.emailVerified;

  return (
    <AuthContext.Provider value={{ 
      user, 
      fbUser, 
      loading, 
      needVerification, 
      login, 
      loginWithGoogle, 
      register, 
      logout, 
      reloadUser: fetchUser,
      checkVerificationStatus,
      resendVerification,
      forgotPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
