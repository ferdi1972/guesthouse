import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Plus, 
  Search, 
  Trash2, 
  Eye, 
  EyeOff, 
  Copy, 
  ExternalLink,
  X,
  Shield,
  Key
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { PasswordEntry, Settings, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import CryptoJS from 'crypto-js';

// In a real application, this key should be managed securely and not hardcoded.
const ENCRYPTION_KEY = 'guesthouse-admin-secret-key';

interface PasswordSafeProps {
  settings: Settings | null;
  userProfile: UserProfile | null;
}

export default function PasswordSafe({ settings, userProfile }: PasswordSafeProps) {
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copyingId, setCopyingId] = useState<string | null>(null);

  const [newEntry, setNewEntry] = useState({
    title: '',
    username: '',
    password: '',
    url: '',
    notes: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'passwordSafe'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PasswordEntry)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'passwordSafe');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const encrypt = (text: string) => {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  };

  const decrypt = (ciphertext: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '********';
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const entryData = {
        title: newEntry.title,
        username: newEntry.username,
        password: encrypt(newEntry.password),
        url: newEntry.url,
        notes: newEntry.notes,
        authorId: auth.currentUser.uid,
        authorName: userProfile?.displayName || auth.currentUser.email || 'Admin',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'passwordSafe'), entryData);
      setIsAddModalOpen(false);
      setNewEntry({
        title: '',
        username: '',
        password: '',
        url: '',
        notes: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'passwordSafe');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this credential?')) return;
    try {
      await deleteDoc(doc(db, 'passwordSafe', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `passwordSafe/${id}`);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyingId(id);
    setTimeout(() => setCopyingId(null), 2000);
  };

  const filteredEntries = entries.filter(entry => 
    entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-primary">Password Safe</h1>
          <p className="text-muted-foreground text-sm">Securely store and manage administrative credentials.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-2xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/20 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Credential
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Search and Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search credentials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
              />
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
              <Shield className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-900">Security Note</p>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  All passwords are encrypted client-side before storage. Only administrators can access this safe.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Credentials List */}
        <div className="lg:col-span-3 space-y-4">
          {filteredEntries.length === 0 ? (
            <div className="bg-card p-12 rounded-3xl border border-border border-dashed text-center">
              <Lock className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground italic">No credentials found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEntries.map((entry) => (
                <div 
                  key={entry.id}
                  className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-serif italic text-primary">{entry.title}</h3>
                      {entry.url && (
                        <a 
                          href={entry.url.startsWith('http') ? entry.url : `https://${entry.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {entry.url}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Username</label>
                      <div className="flex items-center justify-between bg-stone-50 p-2 rounded-xl border border-stone-100">
                        <span className="text-sm font-mono text-stone-900">{entry.username}</span>
                        <button 
                          onClick={() => handleCopy(entry.username, `${entry.id}-user`)}
                          className="p-1 text-stone-400 hover:text-stone-900 transition-colors"
                        >
                          <Copy className={cn("w-3.5 h-3.5", copyingId === `${entry.id}-user` && "text-emerald-600")} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Password</label>
                      <div className="flex items-center justify-between bg-stone-50 p-2 rounded-xl border border-stone-100">
                        <span className="text-sm font-mono text-stone-900">
                          {visiblePasswords[entry.id] ? decrypt(entry.password) : '••••••••••••'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => togglePasswordVisibility(entry.id)}
                            className="p-1 text-stone-400 hover:text-stone-900 transition-colors"
                          >
                            {visiblePasswords[entry.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button 
                            onClick={() => handleCopy(decrypt(entry.password), `${entry.id}-pass`)}
                            className="p-1 text-stone-400 hover:text-stone-900 transition-colors"
                          >
                            <Copy className={cn("w-3.5 h-3.5", copyingId === `${entry.id}-pass` && "text-emerald-600")} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {entry.notes && (
                      <div className="pt-2">
                        <p className="text-[10px] text-muted-foreground italic line-clamp-2">
                          {entry.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Credential Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-border flex items-center justify-between bg-stone-50/50">
              <h3 className="font-serif italic text-2xl text-primary">New Credential</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddEntry} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                  Title / Service Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Booking.com Admin"
                  value={newEntry.title}
                  onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Username..."
                    value={newEntry.username}
                    onChange={(e) => setNewEntry({ ...newEntry, username: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Password..."
                    value={newEntry.password}
                    onChange={(e) => setNewEntry({ ...newEntry, password: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                  URL (Optional)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={newEntry.url}
                  onChange={(e) => setNewEntry({ ...newEntry, url: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Any extra details..."
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-border rounded-2xl hover:bg-stone-50 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-2xl hover:bg-stone-800 transition-all font-medium shadow-lg shadow-stone-900/20"
                >
                  Save Credential
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
