import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert,
  Plus, 
  Calendar, 
  Clock, 
  User, 
  Bed, 
  CheckCircle2, 
  XCircle, 
  MoreVertical,
  Trash2,
  Edit2,
  X,
  ArrowRight,
  DollarSign,
  LogIn,
  LogOut,
  Receipt as ReceiptIcon,
  Share2,
  Mail,
  MessageSquare,
  Printer,
  RotateCcw,
  Search,
  Filter
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, getDocs, where } from 'firebase/firestore';
import { Booking, Guest, Room, BookingStatus, Settings, RateType, Receipt, UserProfile } from '../types';
import { format, differenceInDays, isBefore, startOfDay, parseISO, addDays } from 'date-fns';
import { cn } from '../lib/utils';
import { auth } from '../firebase';
import ReceiptsList from './ReceiptsList';
import { handleFirestoreError, OperationType, cleanData } from '../lib/firestore-utils';

interface BookingsProps {
  settings: Settings | null;
  userProfile: UserProfile | null;
}

export default function Bookings({ settings, userProfile }: BookingsProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'receipts'>('list');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'All'>('All');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Booking; direction: 'asc' | 'desc' }>({
    key: 'checkIn',
    direction: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestFormData, setGuestFormData] = useState({
    name: '',
    email: '',
    phone: '',
    idNumber: '',
    vehicleRegistration: '',
    address: ''
  });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [refundBooking, setRefundBooking] = useState<Booking | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null);
  const [generatedReceipt, setGeneratedReceipt] = useState<Receipt | null>(null);
  const [cleaningPromptRoom, setCleaningPromptRoom] = useState<{ id: string; number: string } | null>(null);
  const [formData, setFormData] = useState({
    guestId: '',
    roomId: '',
    checkIn: format(new Date(), 'yyyy-MM-dd'),
    checkOut: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
    checkInTime: '14:00',
    checkOutTime: '10:00',
    rateType: 'Single' as RateType,
    hours: 1,
    status: 'Confirmed' as BookingStatus,
    totalAmount: 0,
    manualAmount: undefined as number | undefined,
    manualRate: undefined as number | undefined,
    company: '',
  });

  useEffect(() => {
    const room = rooms.find(r => r.id === formData.roomId);
    if (!room) return;

    let total = 0;
    if (formData.rateType === 'Hourly') {
      // 1 hour is 250, 2 hours is 350, 3 hours is 450
      if (formData.hours === 1) total = 250;
      else if (formData.hours === 2) total = 350;
      else if (formData.hours === 3) total = 450;
      else if (formData.hours > 3) total = 450 + (formData.hours - 3) * 100;
      else total = (formData.hours || 0) * room.hourlyRate;
    } else {
      const start = new Date(formData.checkIn);
      const end = new Date(formData.checkOut);
      const diff = differenceInDays(end, start);
      const nights = isNaN(diff) ? 1 : Math.max(1, diff);
      
      let rate = 0;
      if (formData.rateType === 'Single') rate = room.singleRate;
      else if (formData.rateType === 'Double') rate = room.doubleRate;
      else if (formData.rateType === 'Weekend Single') rate = room.weekendSingleRate || room.singleRate;
      else if (formData.rateType === 'Weekend Double') rate = room.weekendDoubleRate || room.doubleRate;
      else if (formData.rateType === 'Manual') rate = formData.manualRate || 0;
      
      total = nights * rate;
      if (isNaN(total)) total = 0;
    }
    setFormData(prev => ({ ...prev, totalAmount: total }));
  }, [formData.roomId, formData.rateType, formData.hours, formData.checkIn, formData.checkOut, formData.manualRate, rooms]);

  useEffect(() => {
    const unsubBookings = onSnapshot(query(collection(db, 'bookings'), orderBy('createdAt', 'desc')), (snap) => {
      setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
    });
    const unsubGuests = onSnapshot(collection(db, 'guests'), (snap) => {
      setGuests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'guests');
    });
    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      setRooms(list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'rooms');
    });
    return () => {
      unsubBookings();
      unsubGuests();
      unsubRooms();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let totalAmount = formData.manualAmount !== undefined ? formData.manualAmount : formData.totalAmount;
    if (isNaN(totalAmount)) totalAmount = 0;
    
    // Clean up undefined values for Firestore
    const dataToSave = cleanData({ ...formData, totalAmount });

    const path = editingBooking ? `bookings/${editingBooking.id}` : 'bookings';
    try {
      if (editingBooking) {
        await updateDoc(doc(db, 'bookings', editingBooking.id), dataToSave);

        // Update corresponding cashbook entries if the date/time changed to keep them in sync
        if (formData.checkIn !== editingBooking.checkIn || formData.checkInTime !== editingBooking.checkInTime) {
          const bookingDate = new Date(`${formData.checkIn}T${formData.checkInTime || '14:00'}`);
          const cashbookQuery = query(
            collection(db, 'cashbook'),
            where('bookingId', '==', editingBooking.id)
          );
          let querySnapshot;
          try {
            querySnapshot = await getDocs(cashbookQuery);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, 'cashbook');
            throw err;
          }
          const updatePromises = querySnapshot.docs.map(docSnapshot => 
            updateDoc(doc(db, 'cashbook', docSnapshot.id), {
              date: bookingDate.toISOString()
            }).catch(err => {
              handleFirestoreError(err, OperationType.UPDATE, `cashbook/${docSnapshot.id}`);
              throw err;
            })
          );
          await Promise.all(updatePromises);
        }
      } else {
        await addDoc(collection(db, 'bookings'), {
          ...dataToSave,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingBooking(null);
    } catch (error) {
      handleFirestoreError(error, editingBooking ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDelete = async () => {
    if (!bookingToDelete) return;
    const id = bookingToDelete;
    const path = `bookings/${id}`;
    setIsDeleteConfirmOpen(false);
    setBookingToDelete(null);
    try {
      await deleteDoc(doc(db, 'bookings', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleSubmitGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'guests'), {
        ...guestFormData,
        createdAt: new Date().toISOString()
      });
      setFormData({ ...formData, guestId: docRef.id });
      setIsGuestModalOpen(false);
      setGuestFormData({ name: '', email: '', phone: '', idNumber: '', vehicleRegistration: '', address: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'guests');
    }
  };
  const handleCheckIn = async (booking: Booking) => {
    try {
      await updateDoc(doc(db, 'bookings', booking.id), { status: 'CheckedIn' });
      await updateDoc(doc(db, 'rooms', booking.roomId), { status: 'Occupied' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const handleCheckOut = async (booking: Booking) => {
    try {
      await updateDoc(doc(db, 'bookings', booking.id), { status: 'CheckedOut' });
      await updateDoc(doc(db, 'rooms', booking.roomId), { status: 'Cleaning' });
      
      const room = rooms.find(r => r.id === booking.roomId);
      if (room) {
        setCleaningPromptRoom({ id: room.id, number: room.number });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${booking.id}`);
    }
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentBooking) return;
    
    const currentPaid = paymentBooking.paidAmount || 0;
    const newPaidTotal = currentPaid + paymentAmount;
    const isFullyPaid = newPaidTotal >= paymentBooking.totalAmount;

    try {
      await updateDoc(doc(db, 'bookings', paymentBooking.id), { 
        paidAmount: newPaidTotal,
        isPaid: isFullyPaid,
        lastPaymentMethod: paymentMethod
      });
      
      // Use the booking's check-in date and time for the cashbook entry to support back-dating
      const bookingDate = new Date(`${paymentBooking.checkIn}T${paymentBooking.checkInTime || '14:00'}`);
      
      // Create cashbook entry
      await addDoc(collection(db, 'cashbook'), {
        date: bookingDate.toISOString(),
        description: `Payment for Booking - ${getGuestName(paymentBooking.guestId)} (Room ${getRoomNumber(paymentBooking.roomId)})`,
        amount: Number(paymentAmount) || 0,
        type: 'Income',
        category: 'Accommodation',
        bookingId: paymentBooking.id,
        paymentMethod: paymentMethod
      });
      
      setIsPaymentModalOpen(false);
      
      // Generate receipt for the payment
      const updatedBooking = {
        ...paymentBooking,
        paidAmount: newPaidTotal,
        isPaid: isFullyPaid,
        lastPaymentMethod: paymentMethod
      };
      await handleGenerateReceipt(updatedBooking, paymentAmount);
      
      setPaymentBooking(null);
      setPaymentMethod('Cash');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${paymentBooking.id}`);
    }
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundBooking) return;
    
    try {
      // Update the booking: zero out balance and mark as Cancelled
      await updateDoc(doc(db, 'bookings', refundBooking.id), { 
        paidAmount: 0,
        totalAmount: 0,
        isPaid: true,
        status: 'Cancelled'
      });
      
      // Use the booking's check-in date and time for the refund entry to support back-dating
      const bookingDate = new Date(`${refundBooking.checkIn}T${refundBooking.checkInTime || '14:00'}`);

      // Add the refund entry to the cashbook
      await addDoc(collection(db, 'cashbook'), {
        date: bookingDate.toISOString(),
        description: `Refund for Booking - ${getGuestName(refundBooking.guestId)} (Room ${getRoomNumber(refundBooking.roomId)}) - [CANCELLED]`,
        amount: refundAmount,
        type: 'Refund',
        category: 'Accommodation',
        bookingId: refundBooking.id
      });

      // Find and update original income transactions for this booking to mark them as cancelled
      const cashbookQuery = query(
        collection(db, 'cashbook'),
        where('bookingId', '==', refundBooking.id),
        where('type', '==', 'Income')
      );
      
      let querySnapshot;
      try {
        querySnapshot = await getDocs(cashbookQuery);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'cashbook');
        throw err;
      }
      const updatePromises = querySnapshot.docs.map(docSnapshot => 
        updateDoc(doc(db, 'cashbook', docSnapshot.id), {
          description: `${docSnapshot.data().description} - [CANCELLED]`
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `cashbook/${docSnapshot.id}`);
          throw err;
        })
      );
      await Promise.all(updatePromises);
      
      setIsRefundModalOpen(false);
      setRefundBooking(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${refundBooking.id}`);
    }
  };

  const handleGenerateReceipt = async (booking: Booking, specificAmount?: number) => {
    const guest = guests.find(g => g.id === booking.guestId);
    const room = rooms.find(r => r.id === booking.roomId);
    if (!guest || !room) return;

    const receiptNumber = `RCP-${format(new Date(), 'MMdd')}-${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    
    // If specificAmount is provided, it's a receipt for a specific payment
    // Otherwise, it's a receipt for the total paid amount (or total booking if unpaid)
    const isPartialReceipt = specificAmount !== undefined && specificAmount < booking.totalAmount;
    const receiptAmount = specificAmount !== undefined ? specificAmount : (booking.paidAmount || booking.totalAmount);
    
    const receiptData: Omit<Receipt, 'id'> = {
      receiptNumber,
      bookingId: booking.id,
      guestId: guest.id,
      guestName: guest.name,
      companyName: settings?.companyName || 'My Guesthouse',
      companyAddress: settings?.address || '',
      companyPhone: settings?.phone || '',
      companyEmail: settings?.email || '',
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      checkInTime: booking.checkInTime || '14:00',
      checkOutTime: booking.checkOutTime || '10:00',
      amount: receiptAmount,
      totalAmount: booking.totalAmount,
      paidAmount: booking.paidAmount || 0,
      balance: booking.totalAmount - (booking.paidAmount || 0),
      date: new Date().toISOString(),
      status: booking.status,
      paymentMethod: booking.lastPaymentMethod || 'Cash',
      items: [
        { 
          description: isPartialReceipt 
            ? `Partial Payment Received - Room ${room.number}` 
            : `Accommodation - Room ${room.number} (${booking.rateType} Rate)`, 
          amount: receiptAmount 
        }
      ],
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, 'receipts'), receiptData);
      setGeneratedReceipt({ id: docRef.id, ...receiptData } as Receipt);
      setIsReceiptModalOpen(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'receipts');
    }
  };

  const handlePrint = () => {
    const content = document.getElementById('receipt-content');
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow popups to print the receipt.');
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(style => style.outerHTML)
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${generatedReceipt?.receiptNumber || 'Print'}</title>
          ${styles}
          <style>
            body { background: white !important; padding: 40px !important; }
            #receipt-content { display: block !important; width: 100% !important; }
            .no-print { display: none !important; }
          </style>
        </head>
        <body>
          <div id="receipt-content">
            ${content.innerHTML}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.focus();
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShareWhatsApp = (receipt: Receipt) => {
    const message = `Receipt from ${settings?.companyName || 'Guesthouse'}\n` +
      (settings?.address ? `Address: ${settings.address}\n` : '') +
      (settings?.phone ? `Phone: ${settings.phone}\n` : '') +
      `Receipt #: ${receipt.receiptNumber}\n` +
      `Guest: ${receipt.guestName}\n` +
      (receipt.checkIn ? `Stay: ${safeFormat(receipt.checkIn, 'MMM dd')} (${receipt.checkInTime || '14:00'}) to ${safeFormat(receipt.checkOut!, 'MMM dd')} (${receipt.checkOutTime || '10:00'})\n` : '') +
      `Total: ${settings?.currency || '$'} ${(receipt.totalAmount || receipt.amount).toLocaleString()}\n` +
      `Paid: ${settings?.currency || '$'} ${(receipt.paidAmount || 0).toLocaleString()}\n` +
      `Balance: ${settings?.currency || '$'} ${(receipt.balance || 0).toLocaleString()}\n` +
      `Date: ${safeFormat(receipt.date, 'MMM dd, yyyy')}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleShareEmail = (receipt: Receipt) => {
    const subject = `Receipt ${receipt.receiptNumber} from ${settings?.companyName || 'Guesthouse'}`;
    const body = `Hello ${receipt.guestName},\n\n` +
      `Please find your receipt details below:\n\n` +
      `${settings?.companyName || 'Guesthouse'}\n` +
      (settings?.address ? `${settings.address}\n` : '') +
      (settings?.phone ? `${settings.phone}\n` : '') +
      `\n` +
      `Receipt #: ${receipt.receiptNumber}\n` +
      (receipt.checkIn ? `Stay: ${safeFormat(receipt.checkIn, 'MMM dd, yyyy')} (${receipt.checkInTime || '14:00'}) to ${safeFormat(receipt.checkOut!, 'MMM dd, yyyy')} (${receipt.checkOutTime || '10:00'})\n` : '') +
      `Total: ${settings?.currency || '$'} ${(receipt.totalAmount || receipt.amount).toLocaleString()}\n` +
      `Paid: ${settings?.currency || '$'} ${(receipt.paidAmount || 0).toLocaleString()}\n` +
      `Balance: ${settings?.currency || '$'} ${(receipt.balance || 0).toLocaleString()}\n` +
      `Date: ${safeFormat(receipt.date, 'MMM dd, yyyy')}\n\n` +
      `Thank you for staying with us!`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getGuestName = (id: string) => guests.find(g => g.id === id)?.name || 'Unknown Guest';
  const getRoomNumber = (id: string) => rooms.find(r => r.id === id)?.number || 'N/A';

  const safeFormat = (dateStr: any, formatStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = dateStr.toDate ? dateStr.toDate() : (typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr));
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, formatStr);
    } catch (e) {
      return 'N/A';
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const guestName = getGuestName(booking.guestId).toLowerCase();
    const roomNumber = getRoomNumber(booking.roomId).toLowerCase();
    const matchesSearch = guestName.includes(searchTerm.toLowerCase()) || 
                          roomNumber.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === undefined || bValue === undefined) return 0;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc'
        ? aValue - bValue
        : bValue - aValue;
    }

    if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      return sortConfig.direction === 'asc'
        ? (aValue === bValue ? 0 : aValue ? 1 : -1)
        : (aValue === bValue ? 0 : bValue ? 1 : -1);
    }

    return 0;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif italic text-stone-900">Bookings</h1>
          <p className="text-stone-500 text-sm">Manage reservations and guest stays.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-stone-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('list')}
              className={cn(
                "flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all",
                activeTab === 'list' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
              )}
            >
              Bookings
            </button>
            <button
              onClick={() => setActiveTab('receipts')}
              className={cn(
                "flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all",
                activeTab === 'receipts' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
              )}
            >
              Receipts
            </button>
          </div>
          <button
            onClick={() => {
              setEditingBooking(null);
              setFormData({
                guestId: '',
                roomId: '',
                checkIn: format(new Date(), 'yyyy-MM-dd'),
                checkOut: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
                checkInTime: '14:00',
                checkOutTime: '10:00',
                rateType: 'Single',
                hours: 1,
                status: 'Confirmed',
                totalAmount: 0,
                manualAmount: undefined,
                manualRate: undefined,
                company: ''
              });
              setIsModalOpen(true);
            }}
            className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10"
          >
            <Plus className="w-5 h-5" />
            New Booking
          </button>
        </div>
      </div>

      {activeTab === 'receipts' ? (
        <ReceiptsList settings={settings} userProfile={userProfile} />
      ) : (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search by guest or room..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all text-sm"
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors",
                  showFilters || statusFilter !== 'All' ? "text-stone-900" : "text-stone-400 hover:text-stone-900"
                )}
              >
                <Filter className="w-4 h-4" /> {showFilters ? 'Hide Filters' : 'Filter & Sort'}
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-stone-100 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-stone-900 outline-none"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="CheckedIn">Checked In</option>
                    <option value="CheckedOut">Checked Out</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="External">External</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Sort By</label>
                  <div className="flex gap-2">
                    <select
                      value={sortConfig.key}
                      onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value as keyof Booking })}
                      className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-stone-900 outline-none"
                    >
                      <option value="checkIn">Check-in Date</option>
                      <option value="createdAt">Created At</option>
                      <option value="totalAmount">Total Amount</option>
                      <option value="status">Status</option>
                    </select>
                    <button
                      onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                      className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs hover:bg-stone-100 transition-colors"
                    >
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50/50">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Guest</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Room</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Stay Period</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Rate Type</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Payment</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-stone-400 italic">No bookings found.</td>
                    </tr>
                  ) : (
                    filteredBookings.map((booking) => (
                      <tr 
                        key={booking.id} 
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsDetailsModalOpen(true);
                        }}
                        className="hover:bg-stone-50/50 transition-colors group cursor-pointer"
                      >
                         <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-xs">
                              {booking.status === 'External' ? 'E' : getGuestName(booking.guestId).charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-stone-900">
                                {booking.status === 'External' ? `External: ${booking.externalSource}` : getGuestName(booking.guestId)}
                              </span>
                              {booking.company && (
                                <span className="text-[10px] text-stone-400 uppercase tracking-wider">{booking.company}</span>
                              )}
                              {booking.status === 'External' && !booking.company && (
                                <span className="text-[10px] text-stone-400 uppercase tracking-wider">Sync Booking</span>
                              )}
                            </div>
                            {booking.status !== 'External' && guests.find(g => g.id === booking.guestId)?.isBlacklisted && (
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Bed className="w-4 h-4 text-stone-400" />
                            <span className="text-sm font-medium text-stone-700">Room {getRoomNumber(booking.roomId)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-stone-500 font-mono">
                            <div className="flex flex-col">
                              <span>{safeFormat(booking.checkIn, 'MMM dd')}</span>
                              <span className="text-[10px] text-stone-400">{booking.checkInTime || '14:00'}</span>
                            </div>
                            <ArrowRight className="w-3 h-3 text-stone-300" />
                            <div className="flex flex-col">
                              <span>{safeFormat(booking.checkOut, 'MMM dd')}</span>
                              <span className="text-[10px] text-stone-400">{booking.checkOutTime || '10:00'}</span>
                            </div>
                            <span className="ml-2 text-[10px] text-stone-400 font-sans font-bold uppercase tracking-tighter">
                              {booking.rateType === 'Hourly' 
                                ? `(${booking.hours}h)`
                                : `(${Math.max(1, differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn)))} nights)`
                              }
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            booking.status === 'Confirmed' && "bg-blue-50 text-blue-600",
                            booking.status === 'CheckedIn' && "bg-emerald-50 text-emerald-600",
                            booking.status === 'CheckedOut' && "bg-stone-100 text-stone-600",
                            booking.status === 'Cancelled' && "bg-rose-50 text-rose-600",
                            booking.status === 'External' && "bg-purple-50 text-purple-600",
                          )}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-stone-600 bg-stone-100 px-2 py-1 rounded-md">
                            {booking.rateType} {booking.rateType === 'Hourly' && `(${booking.hours}h)`}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-bold text-stone-900">
                              {settings?.currency || '$'} {booking.totalAmount.toLocaleString()}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              {booking.isPaid ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                                  <CheckCircle2 className="w-3 h-3" /> Fully Paid
                                </span>
                              ) : (
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                    Paid: {settings?.currency || '$'} {(booking.paidAmount || 0).toLocaleString()}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500">
                                    Bal: {settings?.currency || '$'} {(booking.totalAmount - (booking.paidAmount || 0)).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {booking.status === 'Confirmed' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCheckIn(booking);
                                }}
                                title="Check In"
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              >
                                <LogIn className="w-4 h-4" />
                              </button>
                            )}
                            {booking.status === 'CheckedIn' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCheckOut(booking);
                                }}
                                title="Check Out"
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <LogOut className="w-4 h-4" />
                              </button>
                            )}
                            {userProfile?.role === 'admin' && (booking.paidAmount || 0) > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRefundBooking(booking);
                                  setRefundAmount(booking.paidAmount || 0);
                                  setIsRefundModalOpen(true);
                                }}
                                title="Refund"
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {!booking.isPaid && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPaymentBooking(booking);
                                  setPaymentAmount(booking.totalAmount - (booking.paidAmount || 0));
                                  setIsPaymentModalOpen(true);
                                }}
                                title="Collect Payment"
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                            )}
                            {(booking.paidAmount || 0) > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateReceipt(booking);
                                }}
                                title="Generate Receipt"
                                className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-all"
                              >
                                <ReceiptIcon className="w-4 h-4" />
                              </button>
                            )}
                            {userProfile?.role === 'admin' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingBooking(booking);
                                    setFormData({
                                      guestId: booking.guestId,
                                      roomId: booking.roomId,
                                      checkIn: booking.checkIn,
                                      checkOut: booking.checkOut,
                                      checkInTime: booking.checkInTime || '14:00',
                                      checkOutTime: booking.checkOutTime || '10:00',
                                      rateType: booking.rateType,
                                      hours: booking.hours || 1,
                                      status: booking.status,
                                      totalAmount: booking.totalAmount,
                                      manualAmount: booking.manualAmount,
                                      manualRate: booking.manualRate,
                                      company: booking.company || ''
                                    });
                                    setIsModalOpen(true);
                                  }}
                                  className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBookingToDelete(booking.id);
                                    setIsDeleteConfirmOpen(true);
                                  }}
                                  className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
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

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredBookings.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center text-stone-400 italic">
                No bookings found.
              </div>
            ) : (
              filteredBookings.map((booking) => (
                <div 
                  key={booking.id} 
                  onClick={() => {
                    setSelectedBooking(booking);
                    setIsDetailsModalOpen(true);
                  }}
                  className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4 cursor-pointer hover:border-stone-300 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-sm">
                        {getGuestName(booking.guestId).charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900">{getGuestName(booking.guestId)}</h4>
                        {booking.company && (
                          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">{booking.company}</p>
                        )}
                        {guests.find(g => g.id === booking.guestId)?.isBlacklisted && (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[8px] font-bold uppercase tracking-widest rounded flex items-center gap-1 w-fit mt-1">
                            <ShieldAlert className="w-2 h-2" /> Blacklisted
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-xs text-stone-500">
                          <Bed className="w-3 h-3" />
                          <span>Room {getRoomNumber(booking.roomId)}</span>
                        </div>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      booking.status === 'Confirmed' && "bg-blue-50 text-blue-600",
                      booking.status === 'CheckedIn' && "bg-emerald-50 text-emerald-600",
                      booking.status === 'CheckedOut' && "bg-stone-100 text-stone-600",
                      booking.status === 'Cancelled' && "bg-rose-50 text-rose-600",
                      booking.status === 'External' && "bg-purple-50 text-purple-600",
                    )}>
                      {booking.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-3 border-y border-stone-50">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Stay Period</p>
                      <div className="flex items-center gap-2 text-xs text-stone-700 font-mono">
                        <span>{format(new Date(booking.checkIn), 'MMM dd')}</span>
                        <ArrowRight className="w-3 h-3 text-stone-300" />
                        <span>{format(new Date(booking.checkOut), 'MMM dd')}</span>
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1">
                        {booking.rateType === 'Hourly' 
                          ? `${booking.hours}h`
                          : `${Math.max(1, differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn)))} nights`
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Total Amount</p>
                      <p className="font-mono font-bold text-stone-900">
                        {settings?.currency || '$'} {booking.totalAmount.toLocaleString()}
                      </p>
                      <div className="mt-1">
                        {booking.isPaid ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Fully Paid</span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500">
                            Bal: {settings?.currency || '$'} {(booking.totalAmount - (booking.paidAmount || 0)).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1">
                      {booking.status === 'Confirmed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckIn(booking).catch(() => {});
                          }}
                          className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl transition-all"
                        >
                          <LogIn className="w-4 h-4" />
                        </button>
                      )}
                      {booking.status === 'CheckedIn' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckOut(booking).catch(() => {});
                          }}
                          className="p-2.5 bg-rose-50 text-rose-600 rounded-xl transition-all"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      )}
                      {userProfile?.role === 'admin' && (booking.paidAmount || 0) > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRefundBooking(booking);
                            setRefundAmount(booking.paidAmount || 0);
                            setIsRefundModalOpen(true);
                          }}
                          className="p-2.5 bg-rose-50 text-rose-600 rounded-xl transition-all"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {!booking.isPaid && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentBooking(booking);
                            setPaymentAmount(booking.totalAmount - (booking.paidAmount || 0));
                            setIsPaymentModalOpen(true);
                          }}
                          className="p-2.5 bg-amber-50 text-amber-600 rounded-xl transition-all"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>
                      )}
                      {(booking.paidAmount || 0) > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateReceipt(booking);
                          }}
                          className="p-2.5 bg-stone-100 text-stone-600 rounded-xl transition-all"
                        >
                          <ReceiptIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {userProfile?.role === 'admin' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingBooking(booking);
                            setFormData({
                              guestId: booking.guestId,
                              roomId: booking.roomId,
                              checkIn: booking.checkIn,
                              checkOut: booking.checkOut,
                              checkInTime: booking.checkInTime || '14:00',
                              checkOutTime: booking.checkOutTime || '10:00',
                              rateType: booking.rateType,
                              hours: booking.hours || 1,
                              status: booking.status,
                              totalAmount: booking.totalAmount,
                              manualAmount: booking.manualAmount,
                              manualRate: booking.manualRate,
                              company: booking.company || ''
                            });
                            setIsModalOpen(true);
                          }}
                          className="p-2.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBookingToDelete(booking.id);
                            setIsDeleteConfirmOpen(true);
                          }}
                          className="p-2.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">
                {editingBooking ? 'Edit Booking' : 'New Reservation'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={(e) => handleSubmit(e).catch(() => {})} className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Select Guest</label>
                    <button
                      type="button"
                      onClick={() => setIsGuestModalOpen(true)}
                      className="text-[10px] font-bold uppercase tracking-widest text-stone-900 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> New Guest
                    </button>
                  </div>
                  <select
                    required
                    value={formData.guestId}
                    onChange={(e) => setFormData({ ...formData, guestId: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
                  >
                    <option value="">Choose a guest...</option>
                    {guests.map(g => (
                      <option key={g.id} value={g.id} className={cn(g.isBlacklisted && "text-rose-600 font-bold")}>
                        {g.name} {g.isBlacklisted ? '(BANNED)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {formData.guestId && guests.find(g => g.id === formData.guestId)?.isBlacklisted && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-rose-600 uppercase tracking-wider">Security Alert: Guest is BANNED</p>
                      <p className="text-xs text-rose-500 mt-1 leading-relaxed">
                        Reason: {guests.find(g => g.id === formData.guestId)?.blacklistReason || 'No reason specified'}
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Select Room</label>
                  <select
                    required
                    value={formData.roomId}
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
                  >
                    <option value="">Choose a room...</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id} disabled={r.status === 'Occupied' && editingBooking?.roomId !== r.id}>
                        Room {r.number} - Single: {settings?.currency || '$'}{r.singleRate} | Double: {settings?.currency || '$'}{r.doubleRate} | Weekend: {settings?.currency || '$'}{r.weekendSingleRate || r.singleRate}/{r.weekendDoubleRate || r.doubleRate} | H: {settings?.currency || '$'}{r.hourlyRate}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Check In Date</label>
                    <input
                      required
                      type="date"
                      value={formData.checkIn}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        if (formData.rateType === 'Hourly') {
                          const start = new Date(`${newDate}T${formData.checkInTime}`);
                          const end = new Date(start.getTime() + (formData.hours || 1) * 3600000);
                          setFormData({ 
                            ...formData, 
                            checkIn: newDate,
                            checkOut: format(end, 'yyyy-MM-dd'),
                            checkOutTime: format(end, 'HH:mm')
                          });
                        } else {
                          setFormData({ ...formData, checkIn: newDate });
                        }
                      }}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Check In Time</label>
                    <input
                      type="time"
                      value={formData.checkInTime}
                      onChange={(e) => {
                        const newTime = e.target.value;
                        if (formData.rateType === 'Hourly') {
                          const start = new Date(`${formData.checkIn}T${newTime}`);
                          const end = new Date(start.getTime() + (formData.hours || 1) * 3600000);
                          setFormData({ 
                            ...formData, 
                            checkInTime: newTime,
                            checkOut: format(end, 'yyyy-MM-dd'),
                            checkOutTime: format(end, 'HH:mm')
                          });
                        } else {
                          setFormData({ ...formData, checkInTime: newTime });
                        }
                      }}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Company / Source</label>
                    <input
                      type="text"
                      value={formData.company || ''}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="e.g. Booking.com, Corporate..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">
                      {formData.rateType === 'Manual' ? 'Manual Rate per Night' : 'Manual Amount Override'}
                    </label>
                    <input
                      type="number"
                      value={formData.rateType === 'Manual' ? (formData.manualRate ?? '') : (formData.manualAmount ?? '')}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value);
                        if (formData.rateType === 'Manual') {
                          setFormData({ ...formData, manualRate: val });
                        } else {
                          setFormData({ ...formData, manualAmount: val });
                        }
                      }}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder={formData.rateType === 'Manual' ? "Enter rate per night..." : "Enter amount to override..."}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Rate Type</label>
                    <select
                      required
                      value={formData.rateType}
                      onChange={(e) => {
                        const newRateType = e.target.value as RateType;
                        if (newRateType === 'Hourly') {
                          const start = new Date(`${formData.checkIn}T${formData.checkInTime}`);
                          const end = new Date(start.getTime() + 3600000); // Default 1 hour
                          setFormData({ 
                            ...formData, 
                            rateType: newRateType,
                            checkOut: format(end, 'yyyy-MM-dd'),
                            checkOutTime: format(end, 'HH:mm'),
                            hours: 1
                          });
                        } else {
                          setFormData({ ...formData, rateType: newRateType });
                        }
                      }}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
                    >
                      <option value="Single">Single Rate</option>
                      <option value="Double">Double Rate</option>
                      <option value="Weekend Single">Weekend Rate Single</option>
                      <option value="Weekend Double">Weekend Rate Double</option>
                      <option value="Hourly">Hourly Rate</option>
                      <option value="Manual">Manual Rate</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Booking Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as BookingStatus })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
                    >
                      <option value="Confirmed">Confirmed</option>
                      <option value="CheckedIn">Checked In</option>
                      <option value="CheckedOut">Checked Out</option>
                      <option value="Cancelled">Cancelled</option>
                      <option value="External">External</option>
                    </select>
                  </div>
                </div>

                {formData.rateType === 'Hourly' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Check Out Time</label>
                      <input
                        type="time"
                        value={formData.checkOutTime}
                        onChange={(e) => {
                          const newTime = e.target.value;
                          const start = new Date(`${formData.checkIn}T${formData.checkInTime}`);
                          let end = new Date(`${formData.checkIn}T${newTime}`);
                          if (end < start) {
                            end = new Date(end.getTime() + 86400000); // Next day
                          }
                          const diff = (end.getTime() - start.getTime()) / 3600000;
                          setFormData({ 
                            ...formData, 
                            checkOutTime: newTime,
                            checkOut: format(end, 'yyyy-MM-dd'),
                            hours: Math.max(1, Math.round(diff))
                          });
                        }}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Hours</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.hours || ''}
                        onChange={(e) => {
                          const h = Number(e.target.value);
                          const start = new Date(`${formData.checkIn}T${formData.checkInTime}`);
                          const end = new Date(start.getTime() + h * 3600000);
                          setFormData({ 
                            ...formData, 
                            hours: h,
                            checkOut: format(end, 'yyyy-MM-dd'),
                            checkOutTime: format(end, 'HH:mm')
                          });
                        }}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Check Out Date</label>
                        <input
                          required
                          type="date"
                          value={formData.checkOut}
                          onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Check Out Time</label>
                        <input
                          type="time"
                          value={formData.checkOutTime}
                          onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-between">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 block mb-1">
                    {formData.rateType === 'Hourly' || formData.rateType === 'Manual' ? 'Total Amount (Manual Entry)' : 'Estimated Total'}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-serif font-bold text-stone-900">{settings?.currency || '$'}</span>
                    <input
                      type="number"
                      value={formData.manualAmount !== undefined ? formData.manualAmount : (formData.totalAmount || '')}
                      onChange={(e) => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value);
                        if (formData.rateType === 'Hourly' || formData.rateType === 'Manual') {
                          setFormData({ ...formData, totalAmount: val || 0 });
                        } else {
                          setFormData({ ...formData, manualAmount: val });
                        }
                      }}
                      className={cn(
                        "text-2xl font-serif font-bold text-stone-900 bg-transparent border-none p-0 focus:ring-0 w-32",
                        (formData.rateType !== 'Hourly' && formData.rateType !== 'Manual' && formData.manualAmount === undefined) && "pointer-events-none"
                      )}
                      readOnly={formData.rateType !== 'Hourly' && formData.rateType !== 'Manual' && formData.manualAmount === undefined}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Duration</p>
                  <p className="text-sm font-medium text-stone-600">
                    {formData.rateType === 'Hourly' 
                      ? `${formData.hours} Hours`
                      : `${Math.max(1, differenceInDays(new Date(formData.checkOut), new Date(formData.checkIn)))} Nights`
                    }
                  </p>
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
                  disabled={formData.guestId ? guests.find(g => g.id === formData.guestId)?.isBlacklisted : false}
                  className={cn(
                    "flex-1 px-6 py-3 rounded-xl font-bold transition-all shadow-lg",
                    formData.guestId && guests.find(g => g.id === formData.guestId)?.isBlacklisted
                      ? "bg-stone-200 text-stone-400 cursor-not-allowed shadow-none"
                      : "bg-stone-900 text-white hover:bg-stone-800 shadow-stone-900/10"
                  )}
                >
                  {editingBooking ? 'Update Booking' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Cleaning Prompt Modal */}
      {cleaningPromptRoom && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 flex-shrink-0">
              <Bed className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif italic text-stone-900 mb-2">Room Cleaning Prompt</h3>
            <p className="text-stone-500 text-sm mb-8">
              Guest has been checked out. Room <span className="font-bold text-stone-900">{cleaningPromptRoom.number}</span> has been marked for cleaning.
            </p>
            <button
              onClick={() => setCleaningPromptRoom(null)}
              className="w-full px-4 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all text-sm"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 flex-shrink-0">
              <Trash2 className="text-rose-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif italic text-stone-900 mb-2">Delete Booking?</h3>
            <p className="text-stone-500 text-sm mb-8">This action cannot be undone. Are you sure you want to remove this reservation?</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setBookingToDelete(null);
                }}
                className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete().catch(() => {})}
                className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* New Guest Modal */}
      {isGuestModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">Quick Add Guest</h3>
              <button 
                onClick={() => setIsGuestModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={(e) => handleSubmitGuest(e).catch(() => {})} className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Full Name</label>
                  <input
                    required
                    type="text"
                    value={guestFormData.name}
                    onChange={(e) => setGuestFormData({ ...guestFormData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Email Address</label>
                  <input
                    type="email"
                    value={guestFormData.email}
                    onChange={(e) => setGuestFormData({ ...guestFormData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Phone Number</label>
                  <input
                    type="tel"
                    value={guestFormData.phone}
                    onChange={(e) => setGuestFormData({ ...guestFormData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="+1 234 567 890"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">ID / Passport</label>
                  <input
                    type="text"
                    value={guestFormData.idNumber}
                    onChange={(e) => setGuestFormData({ ...guestFormData, idNumber: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="ID12345678"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Vehicle Registration</label>
                  <input
                    type="text"
                    value={guestFormData.vehicleRegistration}
                    onChange={(e) => setGuestFormData({ ...guestFormData, vehicleRegistration: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="ABC 123 GP"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Residential Address</label>
                <textarea
                  value={guestFormData.address}
                  onChange={(e) => setGuestFormData({ ...guestFormData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all min-h-[100px] resize-none"
                  placeholder="123 Street Name, City, Country"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsGuestModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
                >
                  Save Guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">Collect Payment</h3>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={(e) => handleCollectPayment(e).catch(() => {})} className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Total Amount</p>
                    <p className="font-mono font-bold text-stone-900">{settings?.currency || '$'} {paymentBooking?.totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Already Paid</p>
                    <p className="font-mono font-bold text-emerald-600">{settings?.currency || '$'} {(paymentBooking?.paidAmount || 0).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="p-5 bg-stone-900 rounded-2xl text-white shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Current Balance</p>
                      <p className="text-2xl font-mono font-bold">
                        {settings?.currency || '$'} {((paymentBooking?.totalAmount || 0) - (paymentBooking?.paidAmount || 0)).toLocaleString()}
                      </p>
                    </div>
                    {paymentAmount > 0 && (
                      <div className="text-right animate-in fade-in slide-in-from-right-4 duration-500">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">New Balance</p>
                        <p className="text-2xl font-mono font-bold text-emerald-400">
                          {settings?.currency || '$'} {Math.max(0, (paymentBooking?.totalAmount || 0) - ((paymentBooking?.paidAmount || 0) + paymentAmount)).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (paymentAmount / ((paymentBooking?.totalAmount || 0) - (paymentBooking?.paidAmount || 0))) * 100)}%` 
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Amount to Collect ({settings?.currency || '$'})</label>
                  <input
                    required
                    type="number"
                    min="0"
                    max={(paymentBooking?.totalAmount || 0) - (paymentBooking?.paidAmount || 0)}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all text-2xl font-mono font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="EFT">EFT</option>
                    <option value="Booking.com">Booking.com</option>
                    <option value="Lekkeslaap">Lekkeslaap</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {isRefundModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">Process Refund</h3>
              <button 
                onClick={() => setIsRefundModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={(e) => handleRefund(e).catch(() => {})} className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Total Amount</p>
                    <p className="font-mono font-bold text-stone-900">{settings?.currency || '$'} {refundBooking?.totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Total Paid</p>
                    <p className="font-mono font-bold text-emerald-600">{settings?.currency || '$'} {(refundBooking?.paidAmount || 0).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Amount to Refund ({settings?.currency || '$'})</label>
                  <input
                    required
                    type="number"
                    max={refundBooking?.paidAmount || 0}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all text-2xl font-mono font-bold text-rose-600"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsRefundModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10"
                >
                  Confirm Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {isDetailsModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-lg">
                  {getGuestName(selectedBooking.guestId).charAt(0)}
                </div>
                <div>
                  <h3 className="font-serif italic text-2xl text-stone-900">{getGuestName(selectedBooking.guestId)}</h3>
                  <p className="text-xs text-stone-500">Room {getRoomNumber(selectedBooking.roomId)}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 md:p-8 space-y-8 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Stay Period</p>
                  <div className="flex items-center gap-3 text-sm text-stone-900 font-mono">
                    <div className="flex flex-col">
                      <span className="font-bold">{format(new Date(selectedBooking.checkIn), 'MMM dd, yyyy')}</span>
                      <span className="text-[10px] text-stone-500">{selectedBooking.checkInTime || '14:00'}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-300" />
                    <div className="flex flex-col">
                      <span className="font-bold">{format(new Date(selectedBooking.checkOut), 'MMM dd, yyyy')}</span>
                      <span className="text-[10px] text-stone-500">{selectedBooking.checkOutTime || '10:00'}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-2">
                    {selectedBooking.rateType === 'Hourly' 
                      ? `${selectedBooking.hours}h`
                      : `${Math.max(1, differenceInDays(new Date(selectedBooking.checkOut), new Date(selectedBooking.checkIn)))} nights`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Status</p>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-block",
                    selectedBooking.status === 'Confirmed' && "bg-blue-50 text-blue-600",
                    selectedBooking.status === 'CheckedIn' && "bg-emerald-50 text-emerald-600",
                    selectedBooking.status === 'CheckedOut' && "bg-stone-100 text-stone-600",
                    selectedBooking.status === 'Cancelled' && "bg-rose-50 text-rose-600",
                    selectedBooking.status === 'External' && "bg-purple-50 text-purple-600",
                  )}>
                    {selectedBooking.status}
                  </span>
                </div>
              </div>

              <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Total Amount</p>
                  <p className="text-xl font-mono font-bold text-stone-900">
                    {settings?.currency || '$'} {selectedBooking.totalAmount.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Paid Amount</p>
                  <p className="text-lg font-mono font-bold text-emerald-600">
                    {settings?.currency || '$'} {(selectedBooking.paidAmount || 0).toLocaleString()}
                  </p>
                </div>
                <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-900">Balance Due</p>
                  <p className="text-2xl font-mono font-bold text-rose-600">
                    {settings?.currency || '$'} {(selectedBooking.totalAmount - (selectedBooking.paidAmount || 0)).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {selectedBooking.status === 'Confirmed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckIn(selectedBooking);
                      setIsDetailsModalOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-all text-sm"
                  >
                    <LogIn className="w-4 h-4" /> Check In
                  </button>
                )}
                {selectedBooking.status === 'CheckedIn' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCheckOut(selectedBooking);
                      setIsDetailsModalOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-all text-sm"
                  >
                    <LogOut className="w-4 h-4" /> Check Out
                  </button>
                )}
                {!selectedBooking.isPaid && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPaymentBooking(selectedBooking);
                      setPaymentAmount(selectedBooking.totalAmount - (selectedBooking.paidAmount || 0));
                      setIsPaymentModalOpen(true);
                      setIsDetailsModalOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 text-amber-600 rounded-xl font-bold hover:bg-amber-100 transition-all text-sm"
                  >
                    <DollarSign className="w-4 h-4" /> Collect Payment
                  </button>
                )}
                {userProfile?.role === 'admin' && (selectedBooking.paidAmount || 0) > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRefundBooking(selectedBooking);
                      setRefundAmount(selectedBooking.paidAmount || 0);
                      setIsRefundModalOpen(true);
                      setIsDetailsModalOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-all text-sm"
                  >
                    <RotateCcw className="w-4 h-4" /> Refund
                  </button>
                )}
                {(selectedBooking.paidAmount || 0) > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateReceipt(selectedBooking);
                      setIsDetailsModalOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all text-sm"
                  >
                    <ReceiptIcon className="w-4 h-4" /> Receipt
                  </button>
                )}
                {userProfile?.role === 'admin' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingBooking(selectedBooking);
                        setFormData({
                          guestId: selectedBooking.guestId,
                          roomId: selectedBooking.roomId,
                          checkIn: selectedBooking.checkIn,
                          checkOut: selectedBooking.checkOut,
                          checkInTime: selectedBooking.checkInTime || '14:00',
                          checkOutTime: selectedBooking.checkOutTime || '10:00',
                          rateType: selectedBooking.rateType,
                          hours: selectedBooking.hours || 1,
                          status: selectedBooking.status,
                          totalAmount: selectedBooking.totalAmount,
                          manualAmount: selectedBooking.manualAmount,
                          manualRate: selectedBooking.manualRate,
                          company: selectedBooking.company || ''
                        });
                        setIsModalOpen(true);
                        setIsDetailsModalOpen(false);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all text-sm"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBookingToDelete(selectedBooking.id);
                        setIsDeleteConfirmOpen(true);
                        setIsDetailsModalOpen(false);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 text-rose-600 rounded-xl font-bold hover:bg-rose-100 transition-all text-sm col-span-2"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Booking
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Generation Modal */}
      {isReceiptModalOpen && generatedReceipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">Receipt Generated</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
                  title="Print Receipt"
                >
                  <Printer className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => {
                    setIsReceiptModalOpen(false);
                    setGeneratedReceipt(null);
                  }}
                  className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-white print:p-0" id="receipt-content">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-serif italic text-stone-900 mb-2">
                    {generatedReceipt.companyName || settings?.companyName || 'Guesthouse'}
                  </h2>
                  <div className="text-xs text-stone-500 space-y-1">
                    <p>{generatedReceipt.companyAddress || settings?.address}</p>
                    <p>{generatedReceipt.companyPhone || settings?.phone}</p>
                    <p>{generatedReceipt.companyEmail || settings?.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h1 className={cn(
                    "text-3xl font-serif italic mb-2",
                    generatedReceipt.status === 'Cancelled' ? "text-rose-600" : "text-stone-200"
                  )}>
                    {generatedReceipt.status === 'Cancelled' ? 'CANCELLED' : 'RECEIPT'}
                  </h1>
                  <p className="text-sm font-mono font-bold text-stone-900">{generatedReceipt.receiptNumber}</p>
                  <p className="text-[10px] text-stone-400">{format(parseISO(generatedReceipt.date), 'MMMM dd, yyyy')}</p>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Bill To</h4>
                <p className="text-base font-medium text-stone-900">{generatedReceipt.guestName}</p>
              </div>

              {(generatedReceipt.checkIn || generatedReceipt.checkOut) && (
                <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Check In</h4>
                    <p className="text-xs font-medium text-stone-900">
                      {generatedReceipt.checkIn ? format(parseISO(generatedReceipt.checkIn), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                    <p className="text-[10px] text-stone-500 font-mono">{generatedReceipt.checkInTime || '14:00'}</p>
                  </div>
                  <div className="text-right">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Check Out</h4>
                    <p className="text-xs font-medium text-stone-900">
                      {generatedReceipt.checkOut ? format(parseISO(generatedReceipt.checkOut), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                    <p className="text-[10px] text-stone-500 font-mono">{generatedReceipt.checkOutTime || '10:00'}</p>
                  </div>
                </div>
              )}

              <table className="w-full mb-8">
                <thead>
                  <tr className="border-b border-stone-900">
                    <th className="py-2 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Description</th>
                    <th className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-stone-400">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {generatedReceipt.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 text-sm text-stone-700">{item.description}</td>
                      <td className="py-3 text-right font-mono text-sm text-stone-900">{settings?.currency || '$'} {item.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-stone-900">
                    <td className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-stone-400">Total Amount</td>
                    <td className="py-2 text-right font-mono font-bold text-stone-900">
                      {settings?.currency || '$'} {(generatedReceipt.totalAmount || generatedReceipt.amount).toLocaleString()}
                    </td>
                  </tr>
                  {generatedReceipt.paymentMethod && (
                    <tr>
                      <td className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-stone-400">Payment Method</td>
                      <td className="py-2 text-right text-sm font-medium text-stone-900">
                        {generatedReceipt.paymentMethod}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-stone-400">Paid to Date</td>
                    <td className="py-2 text-right font-mono font-bold text-emerald-600">
                      {settings?.currency || '$'} {(generatedReceipt.paidAmount || 0).toLocaleString()}
                    </td>
                  </tr>
                  <tr className="border-t border-stone-100">
                    <td className="py-4 text-right text-[10px] font-bold uppercase tracking-widest text-stone-900">Balance Due</td>
                    <td className="py-4 text-right text-xl font-mono font-bold text-stone-900">
                      {settings?.currency || '$'} {(generatedReceipt.balance || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="text-center text-stone-400 text-[10px] italic">
                Thank you for choosing {generatedReceipt.companyName || settings?.companyName || 'us'}!
              </div>
            </div>

            <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3 shrink-0">
              <button
                onClick={() => handleShareWhatsApp(generatedReceipt)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all text-sm"
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
              <button
                onClick={() => handleShareEmail(generatedReceipt)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all text-sm"
              >
                <Mail className="w-4 h-4" /> Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
