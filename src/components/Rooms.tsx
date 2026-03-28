import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Bed, 
  Tag, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Wrench,
  Edit2,
  Trash2,
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus as PlusIcon,
  Minus,
  Trash
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocFromServer, query, where } from 'firebase/firestore';
import { Room, RoomStatus, Settings, Booking, Guest, UserProfile, RoomInventoryItem } from '../types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isWithinInterval, 
  addMonths, 
  subMonths,
  isToday,
  parseISO
} from 'date-fns';
import { cn } from '../lib/utils';
import { auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

interface RoomsProps {
  settings: Settings | null;
  userProfile: UserProfile | null;
}

export default function Rooms({ settings, userProfile }: RoomsProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Room | 'statusLabel'; direction: 'asc' | 'desc' }>({
    key: 'number',
    direction: 'asc'
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Record<string, Guest>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [calendarRoom, setCalendarRoom] = useState<Room | null>(null);
  const [inventoryRoom, setInventoryRoom] = useState<Room | null>(null);
  const [roomInventory, setRoomInventory] = useState<RoomInventoryItem[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [inventoryFormData, setInventoryFormData] = useState({
    name: '',
    quantity: 1
  });
  const [formData, setFormData] = useState({
    number: '',
    singleRate: '' as string | number,
    doubleRate: '' as string | number,
    weekendSingleRate: '' as string | number,
    weekendDoubleRate: '' as string | number,
    hourlyRate: '' as string | number,
    status: 'Available' as RoomStatus,
    description: '',
    maintenanceNotes: ''
  });

  useEffect(() => {
    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rooms');
    });

    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snap) => {
      setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
    });

    const unsubGuests = onSnapshot(collection(db, 'guests'), (snap) => {
      const guestMap: Record<string, Guest> = {};
      snap.docs.forEach(doc => {
        guestMap[doc.id] = { id: doc.id, ...doc.data() } as Guest;
      });
      setGuests(guestMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'guests');
    });

    return () => {
      unsubRooms();
      unsubBookings();
      unsubGuests();
    };
  }, []);

  useEffect(() => {
    if (!inventoryRoom) {
      setRoomInventory([]);
      return;
    }

    const unsubInventory = onSnapshot(
      query(collection(db, 'roomInventory'), where('roomId', '==', inventoryRoom.id)),
      (snap) => {
        setRoomInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomInventoryItem)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'roomInventory');
      }
    );

    return () => unsubInventory();
  }, [inventoryRoom]);

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryRoom) return;

    try {
      await addDoc(collection(db, 'roomInventory'), {
        roomId: inventoryRoom.id,
        name: inventoryFormData.name,
        quantity: inventoryFormData.quantity,
        lastUpdated: new Date().toISOString()
      });
      setInventoryFormData({ name: '', quantity: 1 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'roomInventory');
    }
  };

  const handleUpdateInventory = async (id: string, quantity: number) => {
    try {
      await updateDoc(doc(db, 'roomInventory', id), {
        quantity,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `roomInventory/${id}`);
    }
  };

  const handleDeleteInventory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'roomInventory', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `roomInventory/${id}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = editingRoom ? `rooms/${editingRoom.id}` : 'rooms';
    const dataToSave = {
      ...formData,
      singleRate: Number(formData.singleRate) || 0,
      doubleRate: Number(formData.doubleRate) || 0,
      weekendSingleRate: Number(formData.weekendSingleRate) || 0,
      weekendDoubleRate: Number(formData.weekendDoubleRate) || 0,
      hourlyRate: Number(formData.hourlyRate) || 0,
    };
    try {
      if (editingRoom) {
        await updateDoc(doc(db, 'rooms', editingRoom.id), dataToSave);
      } else {
        await addDoc(collection(db, 'rooms'), dataToSave);
      }
      setIsModalOpen(false);
      setEditingRoom(null);
      setFormData({ 
        number: '', 
        singleRate: '', 
        doubleRate: '', 
        weekendSingleRate: '',
        weekendDoubleRate: '',
        hourlyRate: '', 
        status: 'Available', 
        description: '', 
        maintenanceNotes: '' 
      });
    } catch (error) {
      handleFirestoreError(error, editingRoom ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDelete = async () => {
    if (!roomToDelete) return;
    const id = roomToDelete;
    const path = `rooms/${id}`;
    setIsDeleteConfirmOpen(false);
    setRoomToDelete(null);
    try {
      await deleteDoc(doc(db, 'rooms', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const statusIcons = {
    Available: { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50', label: 'Available' },
    Occupied: { icon: XCircle, color: 'text-rose-600 bg-rose-50', label: 'Occupied' },
    Cleaning: { icon: Clock, color: 'text-amber-600 bg-amber-50', label: 'Cleaning' },
    Maintenance: { icon: Wrench, color: 'text-stone-600 bg-stone-100', label: 'Maintenance' },
  };

  // Calendar Logic
  const renderCalendar = () => {
    if (!calendarRoom) return null;

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate,
    });

    const roomBookings = bookings.filter(b => b.roomId === calendarRoom.id && b.status !== 'Cancelled');

    return (
      <div className="grid grid-cols-7 border-t border-l border-stone-100">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="px-2 py-3 bg-stone-50 border-r border-b border-stone-100 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-center">
            {day}
          </div>
        ))}
        {calendarDays.map((day, i) => {
          const isCurrentMonth = isSameDay(startOfMonth(day), monthStart);
          const dayBookings = roomBookings.filter(b => {
            const start = startOfDay(parseISO(b.checkIn));
            const end = startOfDay(parseISO(b.checkOut));
            return isWithinInterval(startOfDay(day), { start, end });
          });

          return (
            <div 
              key={i} 
              className={cn(
                "min-h-[80px] p-2 border-r border-b border-stone-100 transition-colors relative",
                !isCurrentMonth && "bg-stone-50/50",
                isToday(day) && "bg-blue-50/30"
              )}
            >
              <span className={cn(
                "text-xs font-mono font-medium",
                !isCurrentMonth ? "text-stone-300" : "text-stone-500",
                isToday(day) && "text-blue-600 font-bold"
              )}>
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-1">
                {dayBookings.map((b, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded truncate font-medium",
                      b.status === 'CheckedIn' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                    )}
                    title={`${guests[b.guestId]?.name || 'Guest'} (${b.status})`}
                  >
                    {guests[b.guestId]?.name || 'Guest'}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const startOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const sortedRooms = [...rooms].sort((a, b) => {
    let aValue: any = a[sortConfig.key as keyof Room];
    let bValue: any = b[sortConfig.key as keyof Room];

    if (sortConfig.key === 'statusLabel') {
      aValue = a.status;
      bValue = b.status;
    }

    if (aValue === undefined || bValue === undefined) return 0;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-stone-900">Rooms Management</h1>
          <p className="text-stone-500 text-sm">Manage your guesthouse rooms and their current status.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center bg-white border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mr-2">Sort:</span>
            <select
              value={sortConfig.key}
              onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value as any })}
              className="text-xs font-bold text-stone-600 bg-transparent outline-none cursor-pointer"
            >
              <option value="number">Room #</option>
              <option value="statusLabel">Status</option>
              <option value="singleRate">Single Rate</option>
              <option value="doubleRate">Double Rate</option>
            </select>
            <button
              onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
              className="ml-2 text-stone-400 hover:text-stone-900 transition-colors"
            >
              {sortConfig.direction === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          {userProfile?.role === 'admin' && (
            <button
              onClick={() => {
                setEditingRoom(null);
                setFormData({ 
                  number: '', 
                  singleRate: '', 
                  doubleRate: '', 
                  weekendSingleRate: '',
                  weekendDoubleRate: '',
                  hourlyRate: '', 
                  status: 'Available', 
                  description: '', 
                  maintenanceNotes: '' 
                });
                setIsModalOpen(true);
              }}
              className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center gap-2 shadow-lg shadow-stone-900/10 flex-1 sm:flex-none"
            >
              <Plus className="w-5 h-5" />
              Add Room
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedRooms.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-stone-200">
            <Bed className="w-12 h-12 text-stone-200 mx-auto mb-4" />
            <p className="text-stone-400 italic">No rooms added yet. Start by adding your first room.</p>
          </div>
        ) : (
          sortedRooms.map((room) => {
            const StatusIcon = statusIcons[room.status].icon;
            return (
              <div key={room.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-stone-900 font-serif italic text-xl border border-stone-100">
                      {room.number}
                    </div>
                    <div className={cn("px-3 py-1 rounded-full flex items-center gap-1.5", statusIcons[room.status].color)}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{statusIcons[room.status].label}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Week Single</span>
                      <span className="text-sm font-mono font-bold text-stone-900">{settings?.currency || '$'} {room.singleRate}</span>
                    </div>
                    {room.weekendSingleRate && room.weekendSingleRate !== room.singleRate && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Weekend Single</span>
                        <span className="text-xs font-mono font-bold text-rose-900">{settings?.currency || '$'} {room.weekendSingleRate}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Week Double</span>
                      <span className="text-sm font-mono font-bold text-stone-900">{settings?.currency || '$'} {room.doubleRate}</span>
                    </div>
                    {room.weekendDoubleRate && room.weekendDoubleRate !== room.doubleRate && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Weekend Double</span>
                        <span className="text-xs font-mono font-bold text-rose-900">{settings?.currency || '$'} {room.weekendDoubleRate}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Hourly Rate</span>
                      <span className="text-sm font-mono font-bold text-stone-900">{settings?.currency || '$'} {room.hourlyRate}</span>
                    </div>
                  </div>

                  {room.description && (
                    <p className="mt-4 text-xs text-stone-500 line-clamp-2 italic leading-relaxed">
                      "{room.description}"
                    </p>
                  )}

                  {room.maintenanceNotes && (
                    <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-3 h-3 text-rose-600" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Maintenance Notes</span>
                        </div>
                        {userProfile?.role === 'admin' && (
                          <button
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'rooms', room.id), { maintenanceNotes: '' });
                              } catch (error) {
                                handleFirestoreError(error, OperationType.UPDATE, `rooms/${room.id}`);
                              }
                            }}
                            className="text-[9px] font-bold uppercase tracking-wider text-rose-600 hover:text-rose-800 transition-colors flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Clear
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-rose-700 leading-relaxed">
                        {room.maintenanceNotes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-4 py-3 bg-stone-50/50 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {userProfile?.role === 'admin' && (
                      <button
                        onClick={() => {
                          setEditingRoom(room);
                          setFormData({
                            number: room.number,
                            singleRate: room.singleRate,
                            doubleRate: room.doubleRate,
                            weekendSingleRate: room.weekendSingleRate || '',
                            weekendDoubleRate: room.weekendDoubleRate || '',
                            hourlyRate: room.hourlyRate,
                            status: room.status,
                            description: room.description || '',
                            maintenanceNotes: room.maintenanceNotes || ''
                          });
                          setIsModalOpen(true);
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider text-stone-500 hover:text-stone-900 flex items-center gap-1 transition-colors p-1.5 hover:bg-stone-100 rounded-lg"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setCalendarRoom(room);
                        setCurrentMonth(new Date());
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider text-stone-500 hover:text-stone-900 flex items-center gap-1 transition-colors p-1.5 hover:bg-stone-100 rounded-lg"
                    >
                      <CalendarIcon className="w-3 h-3" /> Calendar
                    </button>
                    <button
                      onClick={() => {
                        setInventoryRoom(room);
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider text-stone-500 hover:text-stone-900 flex items-center gap-1 transition-colors p-1.5 hover:bg-stone-100 rounded-lg"
                    >
                      <Package className="w-3 h-3" /> Inventory
                    </button>
                    {room.status === 'Cleaning' && (
                      <button
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'rooms', room.id), { status: 'Available' });
                          } catch (error) {
                            handleFirestoreError(error, OperationType.UPDATE, `rooms/${room.id}`);
                          }
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors p-1.5 hover:bg-emerald-50 rounded-lg"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </button>
                    )}
                  </div>
                  {userProfile?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setRoomToDelete(room.id);
                        setIsDeleteConfirmOpen(true);
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider text-stone-400 hover:text-rose-600 flex items-center gap-1 transition-colors p-1.5 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Inventory Modal */}
      {inventoryRoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center font-serif italic text-lg">
                  {inventoryRoom.number}
                </div>
                <div>
                  <h3 className="font-serif italic text-2xl text-stone-900">Room Inventory</h3>
                </div>
              </div>
              <button 
                onClick={() => setInventoryRoom(null)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar">
              {userProfile?.role === 'admin' && (
                <form onSubmit={handleAddInventory} className="flex gap-4 mb-8">
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Item Name</label>
                    <input
                      required
                      type="text"
                      value={inventoryFormData.name}
                      onChange={(e) => setInventoryFormData({ ...inventoryFormData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="e.g. Towels, Pillows..."
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Quantity</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={inventoryFormData.quantity}
                      onChange={(e) => setInventoryFormData({ ...inventoryFormData, quantity: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="bg-stone-900 text-white p-3.5 rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
                    >
                      <PlusIcon className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {roomInventory.length === 0 ? (
                  <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                    <Package className="w-8 h-8 text-stone-200 mx-auto mb-2" />
                    <p className="text-stone-400 text-sm italic">No items tracked for this room.</p>
                  </div>
                ) : (
                  roomInventory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-stone-100 rounded-2xl shadow-sm">
                      <div>
                        <p className="font-medium text-stone-900">{item.name}</p>
                        <p className="text-[10px] text-stone-400 uppercase tracking-wider">Last updated: {format(parseISO(item.lastUpdated), 'MMM d, HH:mm')}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-stone-50 rounded-lg border border-stone-100 p-1">
                          {userProfile?.role === 'admin' ? (
                            <>
                              <button 
                                onClick={() => handleUpdateInventory(item.id, Math.max(0, item.quantity - 1))}
                                className="p-1 hover:bg-white rounded transition-colors text-stone-500"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="px-3 font-mono font-bold text-stone-900 min-w-[40px] text-center">
                                {item.quantity}
                              </span>
                              <button 
                                onClick={() => handleUpdateInventory(item.id, item.quantity + 1)}
                                className="p-1 hover:bg-white rounded transition-colors text-stone-500"
                              >
                                <PlusIcon className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span className="px-3 font-mono font-bold text-stone-900 min-w-[40px] text-center">
                              {item.quantity}
                            </span>
                          )}
                        </div>
                        {userProfile?.role === 'admin' && (
                          <button 
                            onClick={() => handleDeleteInventory(item.id)}
                            className="p-2 text-stone-400 hover:text-rose-600 transition-colors"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {calendarRoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-stone-900 text-white rounded-xl flex items-center justify-center font-serif italic text-lg">
                  {calendarRoom.number}
                </div>
                <div>
                  <h3 className="font-serif italic text-2xl text-stone-900">Room Calendar</h3>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white rounded-xl border border-stone-200 p-1">
                  <button 
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-2 hover:bg-stone-50 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 font-serif italic text-lg min-w-[140px] text-center">
                    {format(currentMonth, 'MMMM yyyy')}
                  </span>
                  <button 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 hover:bg-stone-50 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button 
                  onClick={() => setCalendarRoom(null)}
                  className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-0 overflow-y-auto custom-scrollbar">
              {renderCalendar()}
            </div>
            <div className="p-6 bg-stone-50 border-t border-stone-100 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Confirmed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Checked In</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-50/30 border border-blue-100" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Today</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">
                {editingRoom ? 'Edit Room' : 'Add New Room'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Room Number</label>
                  <input
                    required
                    type="text"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="e.g. 101"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Week Single Rate</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">{settings?.currency || 'R'}</span>
                    <input
                      required
                      type="number"
                      value={formData.singleRate || ''}
                      onChange={(e) => setFormData({ ...formData, singleRate: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Week Double Rate</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">{settings?.currency || 'R'}</span>
                    <input
                      required
                      type="number"
                      value={formData.doubleRate || ''}
                      onChange={(e) => setFormData({ ...formData, doubleRate: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Weekend Single Rate</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">{settings?.currency || 'R'}</span>
                    <input
                      type="number"
                      value={formData.weekendSingleRate || ''}
                      onChange={(e) => setFormData({ ...formData, weekendSingleRate: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Weekend Double Rate</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">{settings?.currency || 'R'}</span>
                    <input
                      type="number"
                      value={formData.weekendDoubleRate || ''}
                      onChange={(e) => setFormData({ ...formData, weekendDoubleRate: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Hourly Rate</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">{settings?.currency || 'R'}</span>
                    <input
                      required
                      type="number"
                      value={formData.hourlyRate || ''}
                      onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full pl-8 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as RoomStatus })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
                  >
                    <option value="Available">Available</option>
                    <option value="Occupied">Occupied</option>
                    <option value="Cleaning">Cleaning</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all min-h-[100px] resize-none"
                  placeholder="Describe the room features, view, etc."
                />
              </div>
              {userProfile?.role === 'admin' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Maintenance Notes (Admin Only)</label>
                  <textarea
                    value={formData.maintenanceNotes}
                    onChange={(e) => setFormData({ ...formData, maintenanceNotes: e.target.value })}
                    className="w-full px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl focus:ring-2 focus:ring-rose-600 outline-none transition-all min-h-[100px] resize-none text-rose-900 placeholder:text-rose-300"
                    placeholder="Add maintenance instructions or issues for staff..."
                  />
                </div>
              )}
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
                  {editingRoom ? 'Update Room' : 'Save Room'}
                </button>
              </div>
            </form>
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
              <h3 className="text-xl font-serif italic text-stone-900 mb-2">Delete Room?</h3>
              <p className="text-stone-500 text-sm mb-8">This action cannot be undone. Are you sure you want to remove this room from your inventory?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setRoomToDelete(null);
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
        </div>
      )}
    </div>
  );
}
