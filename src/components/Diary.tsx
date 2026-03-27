import React, { useState, useEffect } from 'react';
import { 
  Book, 
  Plus, 
  Search, 
  Trash2, 
  Calendar, 
  User,
  X,
  ChevronLeft,
  ChevronRight,
  Filter
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
  Timestamp 
} from 'firebase/firestore';
import { DiaryEntry, Settings, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

interface DiaryProps {
  settings: Settings | null;
  userProfile: UserProfile | null;
}

export default function Diary({ settings, userProfile }: DiaryProps) {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    const q = query(collection(db, 'diary'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiaryEntry)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'diary');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const entryData = {
        title: newEntry.title,
        content: newEntry.content,
        date: newEntry.date,
        authorId: auth.currentUser.uid,
        authorName: userProfile?.displayName || auth.currentUser.email || 'Admin',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'diary'), entryData);
      setIsAddModalOpen(false);
      setNewEntry({
        title: '',
        content: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'diary');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      await deleteDoc(doc(db, 'diary', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `diary/${id}`);
    }
  };

  const filteredEntries = entries.filter(entry => 
    entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.authorName?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-serif italic text-primary">Admin Diary</h1>
          <p className="text-muted-foreground text-sm">Private log for administrative notes and events.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Entry
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Search and Filters */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                Quick Stats
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100">
                  <p className="text-[10px] text-stone-400 uppercase font-bold">Total</p>
                  <p className="text-xl font-serif italic text-stone-900">{entries.length}</p>
                </div>
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100">
                  <p className="text-[10px] text-stone-400 uppercase font-bold">This Month</p>
                  <p className="text-xl font-serif italic text-stone-900">
                    {entries.filter(e => e.date.startsWith(format(new Date(), 'yyyy-MM'))).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Entries List */}
        <div className="lg:col-span-3 space-y-4">
          {filteredEntries.length === 0 ? (
            <div className="bg-card p-12 rounded-3xl border border-border border-dashed text-center">
              <Book className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground italic">No diary entries found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry) => (
                <div 
                  key={entry.id}
                  className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(entry.date), 'MMMM d, yyyy')}
                        <span className="opacity-30">•</span>
                        <User className="w-3 h-3" />
                        {entry.authorName}
                      </div>
                      <h3 className="text-xl font-serif italic text-primary">{entry.title}</h3>
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="prose prose-stone max-w-none">
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {entry.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Entry Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-border flex items-center justify-between bg-stone-50/50">
              <h3 className="font-serif italic text-2xl text-primary">New Diary Entry</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddEntry} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newEntry.date}
                    onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Entry title..."
                    value={newEntry.title}
                    onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
                  Content
                </label>
                <textarea
                  required
                  rows={8}
                  placeholder="Write your notes here..."
                  value={newEntry.content}
                  onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
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
                  className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 transition-all font-medium shadow-lg shadow-primary/20"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
