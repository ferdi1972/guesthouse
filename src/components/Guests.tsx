import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  MoreVertical,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Guest, UserProfile } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

interface GuestsProps {
  userProfile: UserProfile | null;
}

export default function Guests({ userProfile }: GuestsProps) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [guestToDelete, setGuestToDelete] = useState<string | null>(null);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '+27',
    idNumber: '',
    vehicleRegistration: '',
    address: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'guests'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guest));
      setGuests(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'guests');
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = editingGuest ? `guests/${editingGuest.id}` : 'guests';
    try {
      if (editingGuest) {
        await updateDoc(doc(db, 'guests', editingGuest.id), {
          ...formData
        });
      } else {
        await addDoc(collection(db, 'guests'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingGuest(null);
      setFormData({ name: '', email: '', phone: '+27', idNumber: '', vehicleRegistration: '', address: '' });
    } catch (error) {
      handleFirestoreError(error, editingGuest ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDelete = async () => {
    if (!guestToDelete) return;
    const id = guestToDelete;
    const path = `guests/${id}`;
    setIsDeleteConfirmOpen(false);
    setGuestToDelete(null);
    try {
      await deleteDoc(doc(db, 'guests', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const filteredGuests = guests.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) || 
    g.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search guests by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all outline-none"
          />
        </div>
        <button
          onClick={() => {
            setEditingGuest(null);
            setFormData({ name: '', email: '', phone: '+27', idNumber: '', vehicleRegistration: '', address: '' });
            setIsModalOpen(true);
          }}
          className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10"
        >
          <Plus className="w-5 h-5" />
          Add Guest
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Guest Details</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Contact</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">ID / Vehicle</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Joined</th>
                {userProfile?.role === 'admin' && (
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredGuests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic">No guests found.</td>
                </tr>
              ) : (
                filteredGuests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold">
                          {guest.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-stone-900">{guest.name}</p>
                          <p className="text-xs text-stone-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {guest.address || 'No address'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm text-stone-600 flex items-center gap-2">
                          <Mail className="w-3 h-3 text-stone-400" /> {guest.email}
                        </p>
                        <p className="text-sm text-stone-600 flex items-center gap-2">
                          <Phone className="w-3 h-3 text-stone-400" /> {guest.phone || 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-stone-500">
                      <div className="space-y-1">
                        <p>{guest.idNumber || '---'}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{guest.vehicleRegistration || 'No Vehicle'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-500">
                      {guest.createdAt ? format(new Date(guest.createdAt), 'MMM dd, yyyy') : 'N/A'}
                    </td>
                    {userProfile?.role === 'admin' && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingGuest(guest);
                              setFormData({
                                name: guest.name,
                                email: guest.email,
                                phone: guest.phone || '',
                                idNumber: guest.idNumber || '',
                                vehicleRegistration: guest.vehicleRegistration || '',
                                address: guest.address || ''
                              });
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setGuestToDelete(guest.id);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">
                {editingGuest ? 'Edit Guest' : 'Add New Guest'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Full Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Email Address</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="+1 234 567 890"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">ID / Passport</label>
                  <input
                    type="text"
                    value={formData.idNumber}
                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="ID12345678"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Vehicle Registration</label>
                  <input
                    type="text"
                    value={formData.vehicleRegistration}
                    onChange={(e) => setFormData({ ...formData, vehicleRegistration: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="ABC 123 GP"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Residential Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all min-h-[100px] resize-none"
                  placeholder="123 Street Name, City, Country"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
                >
                  {editingGuest ? 'Update Guest' : 'Save Guest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-rose-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif italic text-stone-900 mb-2">Delete Guest?</h3>
            <p className="text-stone-500 text-sm mb-8">This action cannot be undone. Are you sure you want to remove this guest from your records?</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setGuestToDelete(null);
                }}
                className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
