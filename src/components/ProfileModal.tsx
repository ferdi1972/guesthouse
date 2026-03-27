import React, { useState, useRef } from 'react';
import { X, Camera, User, Mail, Shield, Save, Loader2, Github } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, AppTheme } from '../types';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
}

export default function ProfileModal({ isOpen, onClose, userProfile }: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(userProfile.displayName);
  const [photoURL, setPhotoURL] = useState(userProfile.photoURL || '');
  const [githubUrl, setGithubUrl] = useState(userProfile.githubUrl || '');
  const [theme, setTheme] = useState<AppTheme>(userProfile.theme || 'black-white');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when modal opens or userProfile changes
  React.useEffect(() => {
    if (isOpen) {
      setDisplayName(userProfile.displayName);
      setPhotoURL(userProfile.photoURL || '');
      setGithubUrl(userProfile.githubUrl || '');
      setTheme(userProfile.theme || 'black-white');
    }
  }, [isOpen, userProfile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for base64
        alert('Image size must be less than 500KB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        displayName,
        photoURL,
        githubUrl,
        theme
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userProfile.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const themes: { id: AppTheme; label: string; color: string }[] = [
    { id: 'black-white', label: 'Classic', color: 'bg-stone-900' },
    { id: 'bright-orange', label: 'Sunset', color: 'bg-orange-500' },
    { id: 'bright-green', label: 'Forest', color: 'bg-emerald-500' },
    { id: 'rosewood', label: 'Rosewood', color: 'bg-rose-800' },
    { id: 'light-blue', label: 'Ocean', color: 'bg-sky-500' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">Edit Profile</h3>
              <button 
                onClick={onClose}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto custom-scrollbar">
              {/* Profile Picture */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-stone-100 border-4 border-white shadow-xl flex items-center justify-center">
                    {photoURL ? (
                      <img 
                        src={photoURL} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-16 h-16 text-stone-300" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2.5 bg-stone-900 text-white rounded-full shadow-lg hover:bg-stone-800 transition-all transform group-hover:scale-110"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  Profile Picture
                </p>
              </div>

              <div className="space-y-6">
                {/* Display Name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-100 rounded-2xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 transition-all outline-none text-stone-900 font-medium"
                      placeholder="Your Name"
                    />
                  </div>
                </div>

                {/* GitHub URL */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">
                    GitHub Profile URL
                  </label>
                  <div className="relative">
                    <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input
                      type="url"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-100 rounded-2xl focus:ring-2 focus:ring-stone-900/5 focus:border-stone-900 transition-all outline-none text-stone-900 font-medium"
                      placeholder="https://github.com/username"
                    />
                  </div>
                </div>

                {/* Email (Read Only) */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">
                    Email Address
                  </label>
                  <div className="relative opacity-60">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input
                      type="email"
                      readOnly
                      value={userProfile.email}
                      className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-100 rounded-2xl outline-none text-stone-900 font-medium cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Role (Read Only) */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">
                    System Role
                  </label>
                  <div className="relative opacity-60">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input
                      type="text"
                      readOnly
                      value={userProfile.role.toUpperCase()}
                      className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-100 rounded-2xl outline-none text-stone-900 font-medium cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Theme Selection */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">
                    Preferred Theme
                  </label>
                  <div className="grid grid-cols-5 gap-3">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-2 rounded-2xl transition-all border-2",
                          theme === t.id ? "border-stone-900 bg-stone-50" : "border-transparent hover:bg-stone-50"
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-full shadow-sm", t.color)} />
                        <span className="text-[8px] font-bold uppercase tracking-tighter text-stone-500">
                          {t.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-stone-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {isSaving ? 'Saving Changes...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
