import React, { useState, useEffect } from 'react';
import { motion, useDragControls } from 'motion/react';
import { 
  Plus, 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2, 
  X, 
  DollarSign, 
  History,
  CheckCircle2,
  AlertCircle,
  Camera
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { Staff, CashbookEntry, Settings, UserProfile } from '../types';
import { format, parseISO, isAfter } from 'date-fns';
import { cn } from '../lib/utils';
import { auth } from '../firebase';
import { Shield, UserCheck, UserCog } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

interface StaffProps {
  settings: Settings | null;
  userProfile: UserProfile | null;
}

export default function StaffPage({ settings, userProfile }: StaffProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cashbook, setCashbook] = useState<CashbookEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isUserDeleteConfirmOpen, setIsUserDeleteConfirmOpen] = useState(false);
  const [isClearAllUsersConfirmOpen, setIsClearAllUsersConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [activeView, setActiveView] = useState<'staff' | 'users'>('staff');
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '+27',
    photoURL: '',
    commissionPercentage: 0
  });

  const dragControls = useDragControls();

  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'staff');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs
        .map(doc => ({ ...doc.data() } as UserProfile))
        .filter(u => u.email !== 'admin@qwai.co.za')
      );
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const unsubCash = onSnapshot(collection(db, 'cashbook'), (snap) => {
      setCashbook(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashbookEntry)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'cashbook');
    });

    return () => {
      unsubStaff();
      unsubUsers();
      unsubCash();
    };
  }, []);

  const handleUpdateUserRole = async (uid: string, newRole: UserProfile['role']) => {
    if (userProfile?.role !== 'admin' && userProfile?.role !== 'manager') {
      alert('Only administrators or managers can change user roles.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleClearAllUsers = async () => {
    if (userProfile?.role !== 'admin') {
      alert('Only administrators can clear all users.');
      return;
    }

    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let count = 0;

      querySnapshot.docs.forEach((docSnap) => {
        // Never delete the current user
        if (docSnap.id === userProfile.uid) return;
        batch.delete(docSnap.ref);
        count++;
      });

      if (count > 0) {
        await batch.commit();
        alert(`Successfully removed ${count} users.`);
      } else {
        alert('No other users to remove.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
      alert('Failed to clear users. Check console for details.');
    } finally {
      setIsClearAllUsersConfirmOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = editingStaff ? `staff/${editingStaff.id}` : 'staff';
    try {
      if (editingStaff) {
        await updateDoc(doc(db, 'staff', editingStaff.id), formData);
      } else {
        await addDoc(collection(db, 'staff'), {
          ...formData,
          lastPayoutDate: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingStaff(null);
      setFormData({ name: '', role: '', phone: '+27', photoURL: '', commissionPercentage: 0 });
    } catch (error) {
      handleFirestoreError(error, editingStaff ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handlePayout = async (staffMember: Staff, amount: number) => {
    if (amount <= 0) return;
    
    try {
      // Update last payout date
      await updateDoc(doc(db, 'staff', staffMember.id), {
        lastPayoutDate: new Date().toISOString()
      });

      // Record as expense in cashbook
      await addDoc(collection(db, 'cashbook'), {
        date: new Date().toISOString(),
        description: `Staff Payout: ${staffMember.name}`,
        amount: amount,
        type: 'Expense',
        category: 'Wages'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${staffMember.id}`);
    }
  };

  const calculateEarnings = (staffMember: Staff) => {
    const lastPayout = parseISO(staffMember.lastPayoutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const relevantIncome = cashbook.filter(entry => 
      entry.type === 'Income' && 
      isAfter(parseISO(entry.date), lastPayout)
    );

    const totalRevenue = relevantIncome.reduce((sum, entry) => sum + entry.amount, 0);
    const totalEarnings = (totalRevenue * staffMember.commissionPercentage) / 100;

    const todayIncome = relevantIncome.filter(entry => {
      const entryDate = parseISO(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    });

    const todayRevenue = todayIncome.reduce((sum, entry) => sum + entry.amount, 0);
    const todayEarnings = (todayRevenue * staffMember.commissionPercentage) / 100;

    return {
      total: totalEarnings,
      today: todayEarnings,
      todayRevenue: todayRevenue,
      totalRevenue: totalRevenue
    };
  };

  const isUserOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    // If seen within the last 2 minutes, consider online
    return now.getTime() - lastSeenDate.getTime() < 120000;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif italic text-stone-900">Staff & User Management</h1>
          <p className="text-stone-500 text-sm">Manage your team, track performance-based wages, and control system access.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-stone-100 p-1 rounded-xl flex">
            <button
              onClick={() => setActiveView('staff')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                activeView === 'staff' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
              )}
            >
              Staff Records
            </button>
            {userProfile?.role === 'admin' && (
              <button
                onClick={() => setActiveView('users')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                  activeView === 'users' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
                )}
              >
                System Users
              </button>
            )}
          </div>
          {activeView === 'staff' && userProfile?.role === 'admin' && (
            <button
              onClick={() => {
                setEditingStaff(null);
                setFormData({ name: '', role: '', phone: '+27', photoURL: '', commissionPercentage: 0 });
                setIsModalOpen(true);
              }}
              className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center gap-2 shadow-lg shadow-stone-900/10"
            >
              <UserPlus className="w-5 h-5" />
              Add Staff Member
            </button>
          )}
          {activeView === 'users' && userProfile?.role === 'admin' && (
            <button
              onClick={() => setIsClearAllUsersConfirmOpen(true)}
              className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-rose-700 transition-all flex items-center gap-2 shadow-lg shadow-rose-600/10"
            >
              <Trash2 className="w-5 h-5" />
              Clear All Users
            </button>
          )}
        </div>
      </div>

      {activeView === 'staff' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-stone-200">
              <Users className="w-12 h-12 text-stone-200 mx-auto mb-4" />
              <p className="text-stone-400 italic">No staff members added yet.</p>
            </div>
          ) : (
            staff.map((member) => {
              const earnings = calculateEarnings(member);
              return (
                <div key={member.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        {member.photoURL ? (
                          <img src={member.photoURL} className="w-12 h-12 rounded-xl object-cover border border-stone-100 shadow-sm" alt={member.name} />
                        ) : (
                          <div className="w-12 h-12 bg-stone-900 text-white rounded-xl flex items-center justify-center font-serif italic text-xl border border-stone-100">
                            {member.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-lg font-serif italic text-stone-900">{member.name}</h3>
                          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">{member.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Commission</div>
                        <div className="text-sm font-mono font-bold text-stone-900">{member.commissionPercentage}%</div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Today's Performance */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                          <div className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-1">Today's Revenue</div>
                          <div className="text-sm font-mono font-bold text-stone-900">
                            {settings?.currency || '$'} {earnings.todayRevenue.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/50">
                          <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-600/70 mb-1">Today's Wage</div>
                          <div className="text-sm font-mono font-bold text-emerald-700">
                            {settings?.currency || '$'} {earnings.today.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Total Unpaid */}
                      <div className="bg-stone-900 rounded-xl p-4 text-white shadow-lg shadow-stone-900/10">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 opacity-70">
                            <DollarSign className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Total Unpaid Balance</span>
                          </div>
                          <span className="text-xl font-mono font-bold">
                            {settings?.currency || '$'} {earnings.total.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[9px] opacity-50 font-medium">
                          Based on {settings?.currency || '$'} {earnings.totalRevenue.toFixed(2)} total revenue
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] text-stone-400 px-1">
                        <div className="flex items-center gap-1">
                          <History className="w-3 h-3" />
                          <span>Last Payout: {format(parseISO(member.lastPayoutDate), 'MMM d, HH:mm')}</span>
                        </div>
                      </div>

                      {userProfile?.role === 'admin' && (
                        <button
                          disabled={earnings.total <= 0}
                          onClick={() => handlePayout(member, earnings.total)}
                          className={cn(
                            "w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all",
                            earnings.total > 0 
                              ? "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-900/10" 
                              : "bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200"
                          )}
                        >
                          Payout & Reset Balance
                        </button>
                      )}
                    </div>
                  </div>

                  {userProfile?.role === 'admin' && (
                    <div className="px-6 py-4 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between transition-opacity">
                      <button
                        onClick={() => {
                          setEditingStaff(member);
                          setFormData({
                            name: member.name,
                            role: member.role,
                            phone: member.phone || '',
                            photoURL: member.photoURL || '',
                            commissionPercentage: member.commissionPercentage
                          });
                          setIsModalOpen(true);
                        }}
                        className="text-xs font-bold uppercase tracking-widest text-stone-500 hover:text-stone-900 flex items-center gap-1.5 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => {
                          setStaffToDelete(member.id);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className="text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-rose-600 flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50/50 border-b border-stone-100">
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-stone-400">User</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-stone-400">Email</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-stone-400">Role</th>
                  <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-stone-400">Joined</th>
                  {userProfile?.role === 'admin' && (
                    <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {users.map((user) => (
                  <tr key={user.uid} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img src={user.photoURL} className="w-10 h-10 rounded-xl shadow-sm" alt="" />
                          <div className={cn(
                            "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
                            isUserOnline(user.lastSeen) ? "bg-emerald-500" : "bg-rose-500"
                          )} title={isUserOnline(user.lastSeen) ? "Online" : "Offline"} />
                        </div>
                        <div>
                          <div className="font-serif italic text-stone-900">{user.displayName}</div>
                          {user.uid === userProfile?.uid && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">You</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-stone-500 font-mono">{user.email}</td>
                    <td className="px-8 py-5">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                        user.role === 'admin' ? "bg-stone-900 text-white" :
                        user.role === 'manager' ? "bg-stone-800 text-white" :
                        user.role === 'staff' ? "bg-amber-100 text-amber-900" :
                        "bg-stone-100 text-stone-500"
                      )}>
                        {user.role === 'admin' ? <Shield className="w-3 h-3" /> :
                         user.role === 'manager' ? <Shield className="w-3 h-3 opacity-80" /> :
                         user.role === 'staff' ? <UserCheck className="w-3 h-3" /> :
                         <Users className="w-3 h-3" />}
                        {user.role}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-stone-400">
                      {format(parseISO(user.createdAt), 'MMM d, yyyy')}
                    </td>
                    {userProfile?.role === 'admin' && (
                      <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 transition-opacity">
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateUserRole(user.uid, e.target.value as any)}
                          className="text-xs font-bold uppercase tracking-widest bg-stone-100 border-none rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                          disabled={user.uid === userProfile.uid}
                        >
                          <option value="user">User</option>
                          <option value="staff">Staff</option>
                          <option value="manager">Manager</option>
                          <option value="landlord">Landlord</option>
                          <option value="admin">Admin</option>
                        </select>
                        {user.uid !== userProfile.uid && (
                          <button
                            onClick={() => {
                              setUserToDelete(user);
                              setIsUserDeleteConfirmOpen(true);
                            }}
                            className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                            title="Remove User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <motion.div 
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
          >
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 cursor-grab active:cursor-grabbing flex-shrink-0"
            >
              <h3 className="font-serif italic text-2xl text-stone-900 pointer-events-none">
                {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar">
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="relative group">
                      <div className="w-24 h-24 bg-stone-100 rounded-2xl overflow-hidden border-2 border-dashed border-stone-200 flex items-center justify-center transition-all group-hover:border-stone-400">
                        {formData.photoURL ? (
                          <img src={formData.photoURL} className="w-full h-full object-cover" alt="Preview" />
                        ) : (
                          <Camera className="w-8 h-8 text-stone-300" />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 1024 * 1024) {
                              alert('Image is too large. Please select an image under 1MB.');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFormData({ ...formData, photoURL: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      {formData.photoURL && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, photoURL: '' })}
                          className="absolute -top-2 -right-2 bg-rose-600 text-white p-1.5 rounded-full shadow-lg hover:bg-rose-700 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Profile Picture</p>
                      <p className="text-[9px] text-stone-300 mt-1 italic">Click to upload (Max 1MB)</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Full Name</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Role</label>
                    <input
                      required
                      type="text"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="e.g. Receptionist"
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
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Commission Percentage (%)</label>
                    <div className="relative">
                      <input
                        required
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={formData.commissionPercentage}
                        onChange={(e) => setFormData({ ...formData, commissionPercentage: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                        placeholder="e.g. 5.0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-stone-400 italic ml-1 mt-1">Percentage of total income earned as wages.</p>
                  </div>
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
                    {editingStaff ? 'Update Member' : 'Save Member'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-8 text-center overflow-y-auto custom-scrollbar">
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 flex-shrink-0">
                <Trash2 className="text-rose-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif italic text-stone-900 mb-2">Remove Staff Member?</h3>
              <p className="text-stone-500 text-sm mb-8">This will remove the staff member from the system. Historical payout records in the cashbook will remain.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setStaffToDelete(null);
                  }}
                  className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!staffToDelete) return;
                    const id = staffToDelete;
                    setIsDeleteConfirmOpen(false);
                    setStaffToDelete(null);
                    try {
                      await deleteDoc(doc(db, 'staff', id));
                    } catch (error) {
                      handleFirestoreError(error, OperationType.DELETE, `staff/${id}`);
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Delete Confirmation Modal */}
      {isUserDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-8 text-center overflow-y-auto custom-scrollbar">
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 flex-shrink-0">
                <Trash2 className="text-rose-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif italic text-stone-900 mb-2">Remove System User?</h3>
              <p className="text-stone-500 text-sm mb-8">
                Are you sure you want to remove <span className="font-bold text-stone-900">{userToDelete?.displayName}</span>? 
                They will no longer be able to log in to the system.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsUserDeleteConfirmOpen(false);
                    setUserToDelete(null);
                  }}
                  className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!userToDelete) return;
                    const uid = userToDelete.uid;
                    setIsUserDeleteConfirmOpen(false);
                    setUserToDelete(null);
                    try {
                      await deleteDoc(doc(db, 'users', uid));
                    } catch (error) {
                      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Users Confirmation Modal */}
      {isClearAllUsersConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-8 text-center overflow-y-auto custom-scrollbar">
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 flex-shrink-0">
                <Trash2 className="text-rose-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif italic text-stone-900 mb-2">Clear All Users?</h3>
              <p className="text-stone-500 text-sm mb-8">
                This will remove <span className="font-bold text-rose-600">ALL</span> registered users except yourself. 
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsClearAllUsersConfirmOpen(false)}
                  className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAllUsers}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
