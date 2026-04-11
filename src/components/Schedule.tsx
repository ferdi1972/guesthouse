import React, { useState, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isWithinInterval,
  startOfDay,
  parseISO,
  isToday
} from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Bed,
  Users,
  Clock,
  Info
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Booking, Room, Guest } from '../types';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function Schedule() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })));
    }, (error) => {
      console.error('Schedule rooms onSnapshot error:', error);
    });

    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snap) => {
      setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    }, (error) => {
      console.error('Schedule bookings onSnapshot error:', error);
    });

    const unsubGuests = onSnapshot(collection(db, 'guests'), (snap) => {
      setGuests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guest)));
      setLoading(false);
    }, (error) => {
      console.error('Schedule guests onSnapshot error:', error);
      setLoading(false);
    });

    return () => {
      unsubRooms();
      unsubBookings();
      unsubGuests();
    };
  }, []);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getGuestName = (id: string) => guests.find(g => g.id === id)?.name || 'Unknown Guest';
  const getRoomNumber = (id: string) => rooms.find(r => r.id === id)?.number || '??';

  const getDayBookings = (day: Date) => {
    return bookings.filter(b => {
      if (b.status === 'Cancelled') return false;
      const start = startOfDay(parseISO(b.checkIn));
      const end = startOfDay(parseISO(b.checkOut));
      return isWithinInterval(startOfDay(day), { start, end });
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif italic text-3xl text-stone-900">Schedule</h2>
          <p className="text-stone-500 text-sm">Monthly overview of all room bookings and availability.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-stone-200 shadow-sm">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-stone-50 rounded-xl transition-colors text-stone-400 hover:text-stone-900"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 px-4 min-w-[160px] justify-center">
            <CalendarIcon className="w-4 h-4 text-stone-400" />
            <span className="font-serif italic text-lg text-stone-900">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
          </div>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-stone-50 rounded-xl transition-colors text-stone-400 hover:text-stone-900"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-xl shadow-stone-900/5 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-stone-100">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="px-4 py-4 bg-stone-50/50 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 text-center border-r border-stone-100 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, monthStart);
            const dayBookings = getDayBookings(day);
            const isTodayDate = isToday(day);

            return (
              <div 
                key={i} 
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "min-h-[120px] p-2 border-r border-b border-stone-100 transition-all cursor-pointer group relative",
                  !isCurrentMonth && "bg-stone-50/30",
                  isTodayDate && "bg-blue-50/30 border border-blue-100",
                  "hover:bg-stone-50/50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-xs font-mono font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                    !isCurrentMonth ? "text-stone-300" : "text-stone-500",
                    isTodayDate && "text-blue-600 font-bold"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dayBookings.length > 0 && (
                    <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-md">
                      {dayBookings.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 overflow-hidden">
                  {dayBookings.slice(0, 3).map((b) => (
                      <div 
                        key={b.id}
                        className={cn(
                          "text-[10px] px-1.5 py-1 rounded-md border truncate transition-all font-medium",
                          b.status === 'CheckedIn' ? "bg-emerald-600 text-white border-emerald-700 shadow-sm" :
                          b.status === 'External' ? "bg-purple-100 text-purple-700 border-purple-200" :
                          b.status === 'CheckedOut' ? "bg-stone-50 text-stone-500 border-stone-100" :
                          "bg-green-100 text-green-800 border-green-200"
                        )}
                      >
                      <span className="font-bold mr-1">R{getRoomNumber(b.roomId)}</span>
                      {getGuestName(b.guestId)}
                    </div>
                  ))}
                  {dayBookings.length > 3 && (
                    <div className="text-[9px] text-stone-400 font-medium pl-1 italic">
                      + {dayBookings.length - 3} more
                    </div>
                  )}
                </div>

                {isTodayDate && (
                  <div className="absolute bottom-1 right-1">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="p-6 bg-stone-50 border-t border-stone-100 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-600 border border-emerald-700" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Checked In</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">External</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-50/30 border border-blue-100" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Today</span>
          </div>
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <h3 className="font-serif italic text-2xl text-stone-900">
                  {format(selectedDay, 'EEEE, MMMM do')}
                </h3>
                <p className="text-stone-500 text-xs uppercase tracking-widest mt-1">Daily Schedule</p>
              </div>
              <button 
                onClick={() => setSelectedDay(null)}
                className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400 hover:text-stone-600"
              >
                <ChevronRight className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {getDayBookings(selectedDay).length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="w-8 h-8 text-stone-200" />
                  </div>
                  <p className="text-stone-400 italic">No bookings for this day.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getDayBookings(selectedDay).map((b) => (
                    <div key={b.id} className={cn(
                      "flex gap-4 p-4 rounded-2xl border transition-all group",
                      b.status === 'CheckedIn' ? "bg-emerald-50 border-emerald-100 hover:border-emerald-200" :
                      b.status === 'External' ? "bg-purple-50 border-purple-100 hover:border-purple-200" :
                      b.status === 'CheckedOut' ? "bg-stone-50 border-stone-100 hover:border-stone-200" :
                      "bg-green-50 border-green-100 hover:border-green-200"
                    )}>
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-stone-900 font-serif italic text-xl border border-stone-100 shadow-sm shrink-0">
                        {getRoomNumber(b.roomId)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-stone-900 truncate">{getGuestName(b.guestId)}</h4>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            b.status === 'CheckedIn' ? "bg-emerald-600 text-white" :
                            b.status === 'External' ? "bg-purple-100 text-purple-700" :
                            b.status === 'CheckedOut' ? "bg-stone-100 text-stone-600" :
                            "bg-green-100 text-green-800"
                          )}>
                            {b.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-stone-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {b.checkInTime || '14:00'} - {b.checkOutTime || '10:00'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            {b.rateType} Rate
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 bg-stone-50 border-t border-stone-100">
              <button 
                onClick={() => setSelectedDay(null)}
                className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
