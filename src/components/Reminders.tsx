import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Plus, 
  Search, 
  Trash2, 
  Calendar, 
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  Filter,
  MoreVertical,
  Check
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
  updateDoc,
  where
} from 'firebase/firestore';
import { Reminder, Settings, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { format, isAfter, isBefore, startOfDay, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

interface RemindersProps {
  settings: Settings | null;
  userProfile: UserProfile | null;
}

export default function Reminders({ settings, userProfile }: RemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('pending');

  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    dueTime: '09:00',
    priority: 'medium' as 'low' | 'medium' | 'high'
  });

  useEffect(() => {
    const q = query(collection(db, 'reminders'), orderBy('dueDate', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reminder));
      // Sort by time in memory to avoid composite index requirement
      setReminders(list.sort((a, b) => (a.dueTime || '').localeCompare(b.dueTime || '')));
      setLoading(false);
    }, (error) => {
      console.error('Reminders onSnapshot error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const reminderData = {
        title: newReminder.title,
        description: newReminder.description,
        dueDate: newReminder.dueDate,
        dueTime: newReminder.dueTime,
        priority: newReminder.priority,
        status: 'pending',
        authorId: auth.currentUser.uid,
        authorName: userProfile?.displayName || auth.currentUser.email || 'Admin',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'reminders'), reminderData);
      setIsAddModalOpen(false);
      setNewReminder({
        title: '',
        description: '',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        dueTime: '09:00',
        priority: 'medium'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reminders');
    }
  };

  const toggleStatus = async (reminder: Reminder) => {
    try {
      await updateDoc(doc(db, 'reminders', reminder.id), {
        status: reminder.status === 'pending' ? 'completed' : 'pending'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reminders/${reminder.id}`);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this reminder?')) return;
    try {
      await deleteDoc(doc(db, 'reminders', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reminders/${id}`);
    }
  };

  const filteredReminders = reminders.filter(reminder => {
    const matchesSearch = reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reminder.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || reminder.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'medium': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'low': return 'bg-blue-50 text-blue-600 border-blue-100';
      default: return 'bg-stone-50 text-stone-600 border-stone-100';
    }
  };

  const isOverdue = (reminder: Reminder) => {
    if (reminder.status === 'completed') return false;
    const now = new Date();
    const due = parseISO(`${reminder.dueDate}T${reminder.dueTime || '00:00'}`);
    return isBefore(due, now);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-stone-900">Reminders</h1>
          <p className="text-stone-500 text-sm">Set and manage important events or tasks.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-2xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/20 font-medium"
        >
          <Plus className="w-5 h-5" />
          New Reminder
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search reminders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/20 outline-none transition-all text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">
                Status Filter
              </label>
              <div className="flex flex-col gap-1">
                {(['all', 'pending', 'completed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={cn(
                      "flex items-center justify-between px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize",
                      filterStatus === status 
                        ? "bg-stone-900 text-white" 
                        : "text-stone-600 hover:bg-stone-50"
                    )}
                  >
                    {status}
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full",
                      filterStatus === status ? "bg-white/20" : "bg-stone-100"
                    )}>
                      {status === 'all' ? reminders.length : reminders.filter(r => r.status === status).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100">
              <div className="flex items-center gap-2 text-stone-500 text-xs italic">
                <AlertCircle className="w-4 h-4" />
                <span>Overdue reminders are highlighted in red.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reminders List */}
        <div className="lg:col-span-3 space-y-4">
          {filteredReminders.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-stone-200 border-dashed text-center">
              <Bell className="w-12 h-12 text-stone-200 mx-auto mb-4" />
              <p className="text-stone-400 italic">No reminders found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReminders.map((reminder) => (
                <div 
                  key={reminder.id}
                  className={cn(
                    "bg-white p-5 rounded-3xl border transition-all group relative",
                    reminder.status === 'completed' ? "opacity-60 grayscale" : "hover:shadow-md",
                    isOverdue(reminder) ? "border-rose-200 bg-rose-50/30" : "border-stone-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleStatus(reminder)}
                        className={cn(
                          "mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                          reminder.status === 'completed' 
                            ? "bg-emerald-500 border-emerald-500 text-white" 
                            : "border-stone-200 hover:border-stone-900"
                        )}
                      >
                        {reminder.status === 'completed' && <Check className="w-4 h-4" />}
                      </button>
                      <div className="space-y-1">
                        <h3 className={cn(
                          "font-serif italic text-lg text-stone-900",
                          reminder.status === 'completed' && "line-through text-stone-400"
                        )}>
                          {reminder.title}
                        </h3>
                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                          <span className={cn("px-2 py-0.5 rounded-full border", getPriorityColor(reminder.priority))}>
                            {reminder.priority}
                          </span>
                          {isOverdue(reminder) && (
                            <span className="text-rose-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteReminder(reminder.id)}
                      className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {reminder.description && (
                    <p className="text-sm text-stone-500 mb-4 line-clamp-2">
                      {reminder.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-xs text-stone-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(parseISO(reminder.dueDate), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500">
                        <Clock className="w-3.5 h-3.5" />
                        {reminder.dueTime || 'No time'}
                      </div>
                    </div>
                    <div className="text-[10px] text-stone-300 italic">
                      By {reminder.authorName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Reminder Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h3 className="font-serif italic text-2xl text-stone-900">New Reminder</h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddReminder} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="What needs to be done?"
                  value={newReminder.title}
                  onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-stone-900/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Add more details..."
                  value={newReminder.description}
                  onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-stone-900/20 outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newReminder.dueDate}
                    onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-stone-900/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">
                    Due Time
                  </label>
                  <input
                    type="time"
                    required
                    value={newReminder.dueTime}
                    onChange={(e) => setNewReminder({ ...newReminder, dueTime: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-stone-900/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewReminder({ ...newReminder, priority: p })}
                      className={cn(
                        "py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all",
                        newReminder.priority === p 
                          ? "bg-stone-900 text-white border-stone-900" 
                          : "bg-stone-50 text-stone-400 border-stone-200 hover:border-stone-400"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-stone-200 rounded-2xl hover:bg-stone-50 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-2xl hover:bg-stone-800 transition-all font-medium shadow-lg shadow-stone-900/20"
                >
                  Create Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
