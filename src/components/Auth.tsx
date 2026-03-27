import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, limit, getDoc } from 'firebase/firestore';
import { Hotel, Mail, Lock, User, ArrowRight, Loader2, KeyRound, Chrome, ArrowLeft, Github } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthProps {
  onBack?: () => void;
}

export default function Auth({ onBack }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getErrorMessage = (err: any) => {
    const code = err.code || '';
    const message = err.message || '';

    if (code === 'auth/email-already-in-use' || message.includes('auth/email-already-in-use')) {
      setIsLogin(true);
      return 'This email is already registered. We\'ve switched you to the Sign In tab.';
    }
    
    if (code === 'auth/invalid-credential' || 
        code === 'auth/invalid-login-credentials' || 
        code === 'auth/user-not-found' || 
        code === 'auth/wrong-password' ||
        message.includes('auth/invalid-credential') ||
        message.includes('auth/invalid-login-credentials')) {
      return 'Invalid email or password. If you haven\'t registered yet, please switch to the Register tab. Alternatively, try Google Sign-In.';
    }

    if (code === 'auth/weak-password' || message.includes('auth/weak-password')) {
      return 'Password should be at least 6 characters.';
    }

    if (code === 'auth/too-many-requests' || message.includes('auth/too-many-requests')) {
      return 'Too many failed login attempts. Please try again later or reset your password.';
    }

    if (code === 'auth/operation-not-allowed' || message.includes('auth/operation-not-allowed')) {
      return 'Email/Password sign-in is not enabled. Please use Google Sign-In.';
    }

    if (code === 'auth/popup-closed-by-user' || message.includes('auth/popup-closed-by-user')) {
      return 'Sign-in popup was closed before completion. Please try again.';
    }

    return message || 'An error occurred during authentication';
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await handleSocialSignIn(result.user);
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GithubAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await handleSocialSignIn(result.user);
    } catch (err: any) {
      console.error('Github Auth error:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (user: any) => {
    // Check if profile exists
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Check if this is the first user
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
      const isFirstUser = usersSnap.empty;
      const isBootstrapAdmin = user.email && ["ferditviljoen@gmail.com", "admin@qwai-enterprises.co.za", "admin@qwai.co.za"].includes(user.email);

      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Guest',
        role: (isFirstUser || isBootstrapAdmin) ? 'admin' : 'user',
        theme: 'black-white',
        createdAt: new Date().toISOString()
      };

      await setDoc(docRef, newProfile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isResetting) {
        await sendPasswordResetEmail(auth, email);
        setSuccess('Password reset email sent! Please check your inbox.');
        setIsResetting(false);
      } else if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (password.length < 6) {
          throw new Error('Password should be at least 6 characters.');
        }
        // Registration
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName });

        // Check if this is the first user OR the bootstrap admin
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
        const isFirstUser = usersSnap.empty;
        const isBootstrapAdmin = user.email && ["ferditviljoen@gmail.com", "admin@qwai-enterprises.co.za", "admin@qwai.co.za"].includes(user.email);

        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: displayName || 'Guest',
          role: (isFirstUser || isBootstrapAdmin) ? 'admin' : 'user', 
          theme: 'black-white',
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', user.uid), newProfile);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-500">
        <div className="p-8 text-center bg-stone-900 text-white relative">
          {onBack && (
            <button 
              onClick={onBack}
              className="absolute left-6 top-8 p-2 text-stone-400 hover:text-white rounded-full hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Hotel className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif italic mb-2">GuestHouse Manager</h1>
          <p className="text-stone-400 text-sm">
            {isResetting 
              ? 'Enter your email to reset your password.' 
              : isLogin 
                ? 'Welcome back! Please sign in.' 
                : 'Create your account to get started.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl animate-in slide-in-from-top-2 duration-300">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-xl animate-in slide-in-from-top-2 duration-300">
              {success}
            </div>
          )}

          {!isLogin && !isResetting && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  required
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                placeholder="john@example.com"
              />
            </div>
          </div>

          {!isResetting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetting(true);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10 flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isResetting ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          {!isResetting && (
            <>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                  <span className="bg-white px-4 text-stone-400">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="bg-white text-stone-900 py-3 rounded-xl font-bold border border-stone-200 hover:bg-stone-50 transition-all flex items-center justify-center gap-2 group"
                >
                  <Chrome className="w-4 h-4 text-stone-600 group-hover:scale-110 transition-transform" />
                  Google
                </button>
                <button
                  type="button"
                  onClick={handleGithubSignIn}
                  disabled={loading}
                  className="bg-white text-stone-900 py-3 rounded-xl font-bold border border-stone-200 hover:bg-stone-50 transition-all flex items-center justify-center gap-2 group"
                >
                  <Github className="w-4 h-4 text-stone-900 group-hover:scale-110 transition-transform" />
                  GitHub
                </button>
              </div>
            </>
          )}

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => {
                if (isResetting) {
                  setIsResetting(false);
                } else {
                  setIsLogin(!isLogin);
                }
                setError(null);
                setSuccess(null);
              }}
              className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              {isResetting ? (
                <>Back to <span className="font-bold underline">Sign In</span></>
              ) : isLogin ? (
                <>Don't have an account? <span className="font-bold underline">Register</span></>
              ) : (
                <>Already have an account? <span className="font-bold underline">Sign In</span></>
              )}
            </button>
          </div>
        </form>
      </div>
      
      {!isLogin && !isResetting && (
        <p className="mt-8 text-stone-400 text-xs text-center max-w-xs">
          Note: The first user to register will be granted full administrative rights.
        </p>
      )}
    </div>
  );
}
