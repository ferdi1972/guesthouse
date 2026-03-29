import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Clock, User, Bed } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Booking, Guest, Room } from '../types';
import { format, parseISO, addMinutes, isSameMinute } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function CheckoutAlert() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [alerts, setAlerts] = useState<{ booking: Booking; guest: Guest; room: Room }[]>([]);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  const playAlertSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (time: number, freq: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        osc.start(time);
        osc.stop(time + duration);
      };

      const now = audioCtx.currentTime;
      playBeep(now, 880, 0.1);
      playBeep(now + 0.2, 880, 0.1);
      playBeep(now + 0.4, 880, 0.3);
    } catch (error) {
      console.error('Failed to play alert sound:', error);
    }
  }, []);

  useEffect(() => {
    const unsubBookings = onSnapshot(
      query(collection(db, 'bookings'), where('status', '==', 'CheckedIn')),
      (snap) => {
        setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'bookings');
      }
    );
    const unsubGuests = onSnapshot(collection(db, 'guests'), (snap) => {
      setGuests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'guests');
    });
    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snap) => {
      setRooms(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rooms');
    });

    return () => {
      unsubBookings();
      unsubGuests();
      unsubRooms();
    };
  }, []);

  useEffect(() => {
    const checkCheckouts = () => {
      const now = new Date();
      const tenMinutesFromNow = addMinutes(now, 10);

      const upcomingCheckouts = bookings.filter(booking => {
        if (!booking.checkOut || !booking.checkOutTime) return false;
        
        // Combine date and time
        const checkoutDateTime = new Date(`${booking.checkOut}T${booking.checkOutTime}`);
        
        // Check if it's exactly 10 minutes from now
        const isTenMinutesBefore = isSameMinute(checkoutDateTime, tenMinutesFromNow);
        
        return isTenMinutesBefore && !notifiedIds.has(booking.id);
      });

      if (upcomingCheckouts.length > 0) {
        const newAlerts = upcomingCheckouts.map(booking => ({
          booking,
          guest: guests.find(g => g.id === booking.guestId) || { name: 'Unknown Guest' } as Guest,
          room: rooms.find(r => r.id === booking.roomId) || { number: '?' } as Room
        }));

        setAlerts(prev => [...prev, ...newAlerts]);
        setNotifiedIds(prev => {
          const next = new Set(prev);
          upcomingCheckouts.forEach(b => next.add(b.id));
          return next;
        });
        playAlertSound();
      }
    };

    const interval = setInterval(checkCheckouts, 30000); // Check every 30 seconds
    checkCheckouts(); // Initial check

    return () => clearInterval(interval);
  }, [bookings, guests, rooms, notifiedIds, playAlertSound]);

  const removeAlert = (bookingId: string) => {
    setAlerts(prev => prev.filter(a => a.booking.id !== bookingId));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] space-y-4 max-w-sm w-full">
      {alerts.map(({ booking, guest, room }) => (
        <div 
          key={booking.id}
          className="bg-stone-900 text-white p-5 rounded-2xl shadow-2xl border border-white/10 animate-in slide-in-from-right-8 duration-500"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center animate-pulse">
                <Bell className="w-5 h-5 text-stone-900" />
              </div>
              <div>
                <h3 className="font-serif italic text-lg leading-tight">Checkout Alert</h3>
                <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">In 10 Minutes</p>
              </div>
            </div>
            <button 
              onClick={() => removeAlert(booking.id)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <Bed className="w-4 h-4 text-amber-500" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Room</p>
                <p className="text-sm font-medium">{room.number}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <User className="w-4 h-4 text-amber-500" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Guest</p>
                <p className="text-sm font-medium">{guest.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
              <Clock className="w-4 h-4 text-amber-500" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Checkout Time</p>
                <p className="text-sm font-mono font-bold">{booking.checkOutTime}</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => removeAlert(booking.id)}
            className="w-full mt-4 py-2.5 bg-white text-stone-900 rounded-xl font-bold text-sm hover:bg-stone-100 transition-colors"
          >
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}
