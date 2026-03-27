import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Bed, 
  CalendarCheck, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Hotel,
  Wallet,
  CheckCircle2
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, limit, orderBy } from 'firebase/firestore';
import { Guest, Room, Booking, CashbookEntry, Settings } from '../types';
import { format, isToday, isAfter, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '../lib/utils';

interface DashboardProps {
  settings: Settings | null;
}

export default function Dashboard({ settings }: DashboardProps) {
  const [stats, setStats] = useState({
    totalGuests: 0,
    availableRooms: 0,
    activeBookings: 0,
    dailyRevenue: 0,
    pendingCollections: 0,
  });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Record<string, Guest>>({});

  useEffect(() => {
    // Stats listeners
    const unsubGuests = onSnapshot(collection(db, 'guests'), (snap) => {
      setStats(prev => ({ ...prev, totalGuests: snap.size }));
      const guestMap: Record<string, Guest> = {};
      snap.docs.forEach(doc => {
        guestMap[doc.id] = { id: doc.id, ...doc.data() } as Guest;
      });
      setGuests(guestMap);
    });

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snap) => {
      const available = snap.docs.filter(doc => doc.data().status === 'Available').length;
      setStats(prev => ({ ...prev, availableRooms: available }));
    });

    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snap) => {
      const active = snap.docs.filter(doc => doc.data().status === 'Confirmed' || doc.data().status === 'CheckedIn').length;
      const pending = snap.docs
        .map(doc => doc.data() as Booking)
        .filter(b => b.status !== 'Cancelled' && !b.isPaid)
        .reduce((sum, b) => sum + (b.totalAmount - (b.paidAmount || 0)), 0);
      
      setStats(prev => ({ ...prev, activeBookings: active, pendingCollections: pending }));
      
      const sorted = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Booking))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      setRecentBookings(sorted);
    });

    const unsubCash = onSnapshot(collection(db, 'cashbook'), (snap) => {
      const revenue = snap.docs
        .map(doc => doc.data() as CashbookEntry)
        .filter(entry => (entry.type === 'Income' || entry.type === 'Refund') && isToday(new Date(entry.date)))
        .reduce((sum, entry) => {
          if (entry.type === 'Income') return sum + entry.amount;
          if (entry.type === 'Refund') return sum - entry.amount;
          return sum;
        }, 0);
      setStats(prev => ({ ...prev, dailyRevenue: revenue }));
    });

    return () => {
      unsubGuests();
      unsubRooms();
      unsubBookings();
      unsubCash();
    };
  }, []);

  const cards = [
    { label: 'Total Guests', value: stats.totalGuests, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Available Rooms', value: stats.availableRooms, icon: Bed, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Active Bookings', value: stats.activeBookings, icon: CalendarCheck, color: 'bg-amber-50 text-amber-600' },
    { label: 'Daily Revenue', value: `${settings?.currency || '$'} ${stats.dailyRevenue.toLocaleString()}`, icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
    { label: 'Pending Collections', value: `${settings?.currency || '$'} ${stats.pendingCollections.toLocaleString()}`, icon: Wallet, color: 'bg-rose-50 text-rose-600' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif italic text-stone-900 mb-2">Welcome back,</h1>
          <p className="text-stone-500 font-medium uppercase tracking-widest text-xs">
            Overview of {settings?.companyName || 'your guesthouse'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-stone-400 bg-white px-4 py-2 rounded-full border border-stone-200 shadow-sm">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-mono">{format(new Date(), 'HH:mm')}</span>
        </div>
      </section>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-110", card.color)}>
                <card.icon className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-colors" />
            </div>
            <p className="text-stone-500 text-sm font-medium mb-1">{card.label}</p>
            <h3 className="text-2xl font-serif font-bold text-stone-900">{card.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Bookings */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-serif italic text-xl text-stone-900">Recent Bookings</h3>
            <button className="text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Guest</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Check In</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentBookings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-stone-400 italic">No recent bookings found.</td>
                  </tr>
                ) : (
                  recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-stone-50/50 transition-colors cursor-pointer group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-xs">
                            {guests[booking.guestId]?.name?.charAt(0) || '?'}
                          </div>
                          <span className="font-medium text-stone-900 group-hover:text-stone-600 transition-colors">
                            {guests[booking.guestId]?.name || 'Unknown Guest'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-500 font-mono">
                        {format(new Date(booking.checkIn), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          booking.status === 'Confirmed' && "bg-blue-50 text-blue-600",
                          booking.status === 'CheckedIn' && "bg-emerald-50 text-emerald-600",
                          booking.status === 'CheckedOut' && "bg-stone-100 text-stone-600",
                          booking.status === 'Cancelled' && "bg-rose-50 text-rose-600",
                        )}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-mono font-bold text-stone-900">
                            {settings?.currency || '$'}{booking.totalAmount.toLocaleString()}
                          </span>
                          <div className="flex items-center gap-1 mt-1">
                            {booking.isPaid ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                                <CheckCircle2 className="w-3 h-3" /> Paid
                              </span>
                            ) : (
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                  Paid: {settings?.currency || '$'}{(booking.paidAmount || 0).toLocaleString()}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500">
                                  Bal: {settings?.currency || '$'}{(booking.totalAmount - (booking.paidAmount || 0)).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions / Status */}
        <div className="space-y-6">
          <div className="bg-stone-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="font-serif italic text-2xl mb-2">Need help?</h3>
              <p className="text-stone-400 text-sm mb-6 leading-relaxed">Check our documentation or contact support for advanced guesthouse management tips.</p>
              <button 
                onClick={() => window.open('https://wa.me/27815472274', '_blank')}
                className="bg-white text-stone-900 px-6 py-2 rounded-full text-sm font-bold hover:bg-stone-100 transition-colors"
              >
                Get Support
              </button>
            </div>
            <Hotel className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <h3 className="font-serif italic text-lg text-stone-900 mb-4">Occupancy Rate</h3>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-4xl font-bold text-stone-900">
                {stats.availableRooms > 0 ? Math.round((stats.activeBookings / (stats.availableRooms + stats.activeBookings)) * 100) : 0}%
              </span>
              <span className="text-stone-400 text-sm mb-1 uppercase tracking-widest font-bold">Current</span>
            </div>
            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-stone-900 h-full transition-all duration-1000" 
                style={{ width: `${stats.availableRooms > 0 ? (stats.activeBookings / (stats.availableRooms + stats.activeBookings)) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
