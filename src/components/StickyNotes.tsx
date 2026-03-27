import React, { useState, useEffect } from 'react';
import { 
  StickyNote as StickyNoteIcon, 
  Plus, 
  Trash2, 
  X,
  Check,
  Palette
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
import { StickyNote, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const COLORS = [
  { name: 'Yellow', bg: 'bg-yellow-100', border: 'border-yellow-200', text: 'text-yellow-900' },
  { name: 'Blue', bg: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-900' },
  { name: 'Green', bg: 'bg-emerald-100', border: 'border-emerald-200', text: 'text-emerald-900' },
  { name: 'Pink', bg: 'bg-rose-100', border: 'border-rose-200', text: 'text-rose-900' },
  { name: 'Purple', bg: 'bg-purple-100', border: 'border-purple-200', text: 'text-purple-900' },
  { name: 'Orange', bg: 'bg-orange-100', border: 'border-orange-200', text: 'text-orange-900' },
];

export default function StickyNotes({ userProfile }: { userProfile: UserProfile | null }) {
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  useEffect(() => {
    const q = query(collection(db, 'stickyNotes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StickyNote)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stickyNotes');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !auth.currentUser) return;

    try {
      const noteData = {
        content: newNoteContent,
        color: selectedColor.name,
        authorId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'stickyNotes'), noteData);
      setNewNoteContent('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stickyNotes');
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'stickyNotes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `stickyNotes/${id}`);
    }
  };

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
          <h1 className="text-3xl font-serif italic text-primary">Sticky Notes</h1>
          <p className="text-muted-foreground text-sm">Quick reminders and scratchpad for admins.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20 font-medium"
          >
            <Plus className="w-5 h-5" />
            New Note
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={cn(
                "p-6 rounded-3xl border-2 shadow-xl flex flex-col gap-4 min-h-[200px]",
                selectedColor.bg,
                selectedColor.border
              )}
            >
              <textarea
                autoFocus
                placeholder="Type your note here..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className={cn(
                  "flex-1 bg-transparent outline-none resize-none font-medium placeholder:opacity-50",
                  selectedColor.text
                )}
              />
              
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "w-5 h-5 rounded-full border transition-all",
                        color.bg,
                        color.border,
                        selectedColor.name === color.name ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-110"
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsAdding(false)}
                    className="p-2 rounded-xl hover:bg-black/5 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleAddNote}
                    disabled={!newNoteContent.trim()}
                    className="p-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {notes.map((note) => {
            const color = COLORS.find(c => c.name === note.color) || COLORS[0];
            return (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={cn(
                  "p-6 rounded-3xl border shadow-sm flex flex-col gap-4 min-h-[200px] group hover:shadow-md transition-all",
                  color.bg,
                  color.border
                )}
              >
                <p className={cn(
                  "flex-1 whitespace-pre-wrap font-medium leading-relaxed",
                  color.text
                )}>
                  {note.content}
                </p>
                
                <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-2 rounded-xl hover:bg-black/5 text-destructive transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!isAdding && notes.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <StickyNoteIcon className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground italic">No sticky notes yet. Create one to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
