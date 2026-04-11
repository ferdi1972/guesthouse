import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  ArrowRight, 
  Bed,
  AlertCircle,
  History,
  Download,
  Edit2,
  Trash2,
  X,
  Save,
  Plus,
  Minus
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Room, RoomInventoryItem, Settings, UserProfile } from '../types';
import { format, parseISO } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { cn } from '../lib/utils';

interface InventoryProps {
  settings: Settings | null;
  userProfile: UserProfile | null;
}

export default function Inventory({ settings, userProfile }: InventoryProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [inventory, setInventory] = useState<RoomInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<RoomInventoryItem | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [editFormData, setEditFormData] = useState({
    name: '',
    quantity: 0
  });

  useEffect(() => {
    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rooms');
    });

    const unsubInventory = onSnapshot(
      query(collection(db, 'roomInventory'), orderBy('lastUpdated', 'desc')),
      (snap) => {
        setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomInventoryItem)));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'roomInventory');
        setLoading(false);
      }
    );

    return () => {
      unsubRooms();
      unsubInventory();
    };
  }, []);

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      await updateDoc(doc(db, 'roomInventory', editingItem.id), {
        name: editFormData.name,
        quantity: editFormData.quantity,
        lastUpdated: new Date().toISOString()
      });
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `roomInventory/${editingItem.id}`);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'roomInventory', itemToDelete));
      setIsDeleteConfirmOpen(false);
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `roomInventory/${itemToDelete}`);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRoom = selectedRoomId === 'all' || item.roomId === selectedRoomId;
    return matchesSearch && matchesRoom;
  });

  const getRoomNumber = (roomId: string) => {
    return rooms.find(r => r.id === roomId)?.number || 'Unknown';
  };

  const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueItems = new Set(inventory.map(item => item.name.toLowerCase())).size;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-stone-900">Global Inventory</h1>
          <p className="text-stone-500 text-sm">Overview of all items tracked across all rooms.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-2.5 bg-white border border-stone-100 rounded-2xl focus:ring-2 focus:ring-stone-900 outline-none transition-all text-sm w-64 shadow-sm"
            />
          </div>
          <select
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="px-4 py-2.5 bg-white border border-stone-100 rounded-2xl focus:ring-2 focus:ring-stone-900 outline-none transition-all text-sm shadow-sm appearance-none min-w-[140px]"
          >
            <option value="all">All Rooms</option>
            {rooms.map(room => (
              <option key={room.id} value={room.id}>Room {room.number}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center">
              <Package className="w-6 h-6 text-stone-900" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Total Units</p>
              <p className="text-2xl font-serif italic text-stone-900">{totalItems} items</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center">
              <Filter className="w-6 h-6 text-stone-900" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Unique Products</p>
              <p className="text-2xl font-serif italic text-stone-900">{uniqueItems} types</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center">
              <Bed className="w-6 h-6 text-stone-900" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Rooms Tracked</p>
              <p className="text-2xl font-serif italic text-stone-900">
                {new Set(inventory.map(i => i.roomId)).size} / {rooms.length} rooms
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-xl shadow-stone-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-100">
                <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Item Name</th>
                <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Room</th>
                <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Quantity</th>
                <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Last Updated</th>
                <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Status</th>
                <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-widest text-stone-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-stone-400 italic">
                    No inventory items found.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id} className="group hover:bg-stone-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-500">
                          <Package className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-stone-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-stone-900 text-white rounded-lg flex items-center justify-center font-serif italic text-xs">
                          {getRoomNumber(item.roomId)}
                        </div>
                        <span className="text-sm text-stone-600">Room {getRoomNumber(item.roomId)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center px-3 py-1 bg-stone-100 text-stone-700 rounded-full text-xs font-bold font-mono">
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-stone-500 text-xs">
                        <History className="w-3 h-3" />
                        {format(parseISO(item.lastUpdated), 'MMM dd, HH:mm')}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        item.quantity === 0 ? "bg-rose-50 text-rose-600" : 
                        item.quantity < 3 ? "bg-amber-50 text-amber-600" : 
                        "bg-emerald-50 text-emerald-600"
                      )}>
                        {item.quantity === 0 ? 'Out of Stock' : item.quantity < 3 ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {userProfile?.role === 'admin' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setEditFormData({ name: item.name, quantity: item.quantity });
                              }}
                              className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setItemToDelete(item.id);
                                setIsDeleteConfirmOpen(true);
                              }}
                              className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">Edit Item</h3>
              <button 
                onClick={() => setEditingItem(null)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar">
              <form onSubmit={handleUpdateItem} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Item Name</label>
                  <input
                    required
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Quantity</label>
                  <div className="flex items-center gap-4 bg-stone-50 border border-stone-200 rounded-xl p-2">
                    <button
                      type="button"
                      onClick={() => setEditFormData(prev => ({ ...prev, quantity: Math.max(0, prev.quantity - 1) }))}
                      className="p-2 hover:bg-white rounded-lg transition-colors text-stone-500"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <input
                      required
                      type="number"
                      value={editFormData.quantity || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, quantity: Number(e.target.value) })}
                      className="flex-1 bg-transparent border-none text-center font-mono font-bold text-stone-900 focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => setEditFormData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                      className="p-2 hover:bg-white rounded-lg transition-colors text-stone-500"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10 flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
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
              <h3 className="text-xl font-serif italic text-stone-900 mb-2">Delete Item?</h3>
              <p className="text-stone-500 text-sm mb-8">Are you sure you want to remove this item from the inventory? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setItemToDelete(null);
                  }}
                  className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteItem}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
