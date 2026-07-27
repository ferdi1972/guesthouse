import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Copy, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Users, 
  Check, 
  Sparkles, 
  Phone, 
  Info, 
  Bookmark, 
  FileText,
  X,
  ExternalLink,
  MessageCircle,
  Building,
  Calendar,
  Bed,
  CreditCard
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from '../firebase';
import { Settings, Guest, Booking, Room, MessageTemplate, UserProfile, Staff } from '../types';
import { format, parseISO } from 'date-fns';
import { handleFirestoreError, OperationType, cleanData } from '../lib/firestore-utils';
import { cn } from '../lib/utils';

interface MessagesProps {
  settings: Settings | null;
  userProfile?: UserProfile | null;
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'default-1',
    title: 'Booking Confirmation',
    category: 'Booking Confirmation',
    content: `Dear {guest_name},\n\nThank you for choosing {company_name}! Your booking for {room_number} is confirmed.\n\n📅 Check-in: {check_in_date}\n📅 Check-out: {check_out_date}\n💰 Total Amount: {currency} {total_amount}\n\nCheck-in time is from 14:00. Please let us know if you have any special requirements.\n\nKind regards,\n{company_name}\n📞 {phone}`,
    isDefault: true
  },
  {
    id: 'default-2',
    title: 'Check-in Instructions & Directions',
    category: 'Check-in & Directions',
    content: `Hello {guest_name},\n\nHere are your check-in details for {company_name}:\n\n📍 Physical Address:\n{address}\n\n⏰ Check-in Time: 14:00 - 20:00\n📞 Reception Contact: {phone}\n\nPlease inform us of your estimated arrival time so we can make sure someone is at reception to welcome you. Safe travels!`,
    isDefault: true
  },
  {
    id: 'default-3',
    title: 'Wi-Fi & House Rules',
    category: 'Wi-Fi & House Rules',
    content: `Hi {guest_name},\n\nWelcome to {company_name}! Here is important information for your stay:\n\n📶 Wi-Fi Network: Guest_WiFi\n🔑 Password: Ask Reception\n\n🚭 Quiet Hours: 22:00 - 07:00. Please respect other guests.\n🚭 Rooms are strictly non-smoking.\n\nIf you need assistance at any time, please contact us on {phone}.\n\nEnjoy your stay!`,
    isDefault: true
  },
  {
    id: 'default-4',
    title: 'Payment Request & Bank Details',
    category: 'Payment & Rates',
    content: `Dear {guest_name},\n\nRegarding your reservation at {company_name}:\n\nTotal Amount Due: {currency} {total_amount}\n\nPlease transfer your payment or deposit to confirm your reservation. Kindly send us proof of payment via WhatsApp once completed.\n\nThank you for your cooperation!`,
    isDefault: true
  },
  {
    id: 'default-5',
    title: 'Check-out & Thank You',
    category: 'Check-out & Review',
    content: `Dear {guest_name},\n\nThank you for staying with us at {company_name}! We hope you had a comfortable and enjoyable stay.\n\n⏰ Check-out time is 10:00 AM. Please drop your room key at reception upon departure.\n\nSafe travels, and we hope to see you again soon!`,
    isDefault: true
  }
];

const CATEGORIES = [
  'All',
  'Booking Confirmation',
  'Check-in & Directions',
  'Wi-Fi & House Rules',
  'Payment & Rates',
  'Check-out & Review',
  'Custom'
];

const PLACEHOLDERS = [
  { tag: '{guest_name}', label: 'Guest Name' },
  { tag: '{room_number}', label: 'Room Number' },
  { tag: '{check_in_date}', label: 'Check-in Date' },
  { tag: '{check_out_date}', label: 'Check-out Date' },
  { tag: '{total_amount}', label: 'Total Amount' },
  { tag: '{company_name}', label: 'Company Name' },
  { tag: '{phone}', label: 'Phone Number' },
  { tag: '{address}', label: 'Address' },
  { tag: '{currency}', label: 'Currency Symbol' },
];

export default function Messages({ settings, userProfile }: MessagesProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);

  // Selected Guest or Custom Variables
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualGuestName, setManualGuestName] = useState<string>('');
  const [manualRoomNumber, setManualRoomNumber] = useState<string>('');
  const [manualCheckIn, setManualCheckIn] = useState<string>('');
  const [manualCheckOut, setManualCheckOut] = useState<string>('');
  const [manualTotalAmount, setManualTotalAmount] = useState<string>('');

  const [copied, setCopied] = useState<boolean>(false);

  // Modal State for Editing / Creating Template
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalCategory, setModalCategory] = useState<string>('Custom');
  const [modalContent, setModalContent] = useState<string>('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Load custom templates, guests, bookings, rooms, staff
  useEffect(() => {
    const unsubTemplates = onSnapshot(collection(db, 'message_templates'), (snapshot) => {
      const customItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageTemplate));
      // Combine custom templates with default templates
      setTemplates([...DEFAULT_TEMPLATES, ...customItems]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'message_templates');
      setTemplates(DEFAULT_TEMPLATES);
    });

    const unsubGuests = onSnapshot(collection(db, 'guests'), (snapshot) => {
      setGuests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guest)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'guests'));

    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'bookings'));

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'rooms'));

    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'staff'));

    return () => {
      unsubTemplates();
      unsubGuests();
      unsubBookings();
      unsubRooms();
      unsubStaff();
    };
  }, []);

  // Set default selected template on load
  useEffect(() => {
    if (!selectedTemplate && templates.length > 0) {
      setSelectedTemplate(templates[0]);
    }
  }, [templates]);

  // Handle guest selection changes
  const handleSelectGuest = (guestId: string) => {
    setSelectedGuestId(guestId);
    if (!guestId) return;

    const guest = guests.find(g => g.id === guestId);
    if (guest) {
      setManualGuestName(guest.name || '');
      setManualPhone(guest.phone || '');

      // Find active or recent booking for this guest
      const guestBooking = bookings.find(b => b.guestId === guestId && b.status !== 'Cancelled');
      if (guestBooking) {
        setSelectedBookingId(guestBooking.id);
        populateBookingDetails(guestBooking);
      }
    }
  };

  const handleSelectBooking = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    if (!bookingId) return;

    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      populateBookingDetails(booking);
      if (booking.guestId) {
        setSelectedGuestId(booking.guestId);
        const guest = guests.find(g => g.id === booking.guestId);
        if (guest) {
          setManualGuestName(guest.name || '');
          if (guest.phone) setManualPhone(guest.phone);
        }
      }
    }
  };

  const populateBookingDetails = (booking: Booking) => {
    const room = rooms.find(r => r.id === booking.roomId);
    setManualRoomNumber(room ? `Room ${room.number}` : 'Room');
    setManualCheckIn(booking.checkIn ? format(parseISO(booking.checkIn), 'dd MMM yyyy') : '');
    setManualCheckOut(booking.checkOut ? format(parseISO(booking.checkOut), 'dd MMM yyyy') : '');
    setManualTotalAmount(booking.totalAmount ? String(booking.totalAmount) : '0');
  };

  // Helper to format text with dynamic replacements
  const getProcessedContent = () => {
    if (!selectedTemplate) return '';

    let text = selectedTemplate.content;

    const currency = settings?.currency || 'R';
    const company = settings?.companyName || 'Guesthouse';
    const phone = settings?.phone || '';
    const address = settings?.address || '';

    const replacements: Record<string, string> = {
      '{guest_name}': manualGuestName || 'Valued Guest',
      '{room_number}': manualRoomNumber || 'Room',
      '{check_in_date}': manualCheckIn || 'TBA',
      '{check_out_date}': manualCheckOut || 'TBA',
      '{total_amount}': manualTotalAmount || '0',
      '{company_name}': company,
      '{phone}': phone,
      '{address}': address,
      '{currency}': currency,
    };

    Object.entries(replacements).forEach(([key, val]) => {
      const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
      text = text.replace(regex, val);
    });

    return text;
  };

  // Format phone number for WhatsApp wa.me link
  const cleanPhoneNumber = (phone: string) => {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    // If starts with 0 (e.g. South African 082...), replace leading 0 with country code default 27 if applicable
    if (digits.startsWith('0') && digits.length === 10) {
      digits = '27' + digits.substring(1);
    }
    return digits;
  };

  const handleSendWhatsApp = () => {
    const message = getProcessedContent();
    const targetPhone = cleanPhoneNumber(manualPhone);

    let url = '';
    if (targetPhone) {
      url = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    }

    window.open(url, '_blank');
  };

  const handleCopyToClipboard = () => {
    const message = getProcessedContent();
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Open modal to create or edit template
  const handleOpenModal = (template?: MessageTemplate) => {
    if (template) {
      setEditingTemplateId(template.id);
      setModalTitle(template.title);
      setModalCategory(template.category || 'Custom');
      setModalContent(template.content);
    } else {
      setEditingTemplateId(null);
      setModalTitle('');
      setModalCategory('Custom');
      setModalContent('');
    }
    setIsModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim() || !modalContent.trim()) return;

    try {
      const data = {
        title: modalTitle.trim(),
        category: modalCategory,
        content: modalContent,
        createdAt: new Date().toISOString()
      };

      if (editingTemplateId && !editingTemplateId.startsWith('default-')) {
        await updateDoc(doc(db, 'message_templates', editingTemplateId), cleanData(data));
      } else {
        await addDoc(collection(db, 'message_templates'), cleanData(data));
      }

      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'message_templates');
    }
  };

  const handleDeleteTemplate = async (id: string, isDefault?: boolean) => {
    if (isDefault) {
      alert('Default templates cannot be deleted, but you can create custom templates!');
      return;
    }
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteDoc(doc(db, 'message_templates', id));
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(templates[0] || null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `message_templates/${id}`);
    }
  };

  const insertPlaceholderToModal = (tag: string) => {
    setModalContent(prev => prev + tag);
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesCat = selectedCategory === 'All' || t.category === selectedCategory;
    const matchesSearch = 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 text-stone-100 p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest">
            <MessageSquare className="w-4 h-4" /> Operations Messaging Hub
          </div>
          <h1 className="text-3xl md:text-4xl font-serif italic text-white">
            Client WhatsApp Templates
          </h1>
          <p className="text-stone-300 text-sm max-w-2xl">
            Select pre-saved responses, auto-populate client details, and send directly via WhatsApp or copy to clipboard instantly.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="relative z-10 inline-flex items-center gap-2 bg-emerald-500 text-stone-950 font-bold px-6 py-3.5 rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 shrink-0 self-start md:self-auto"
        >
          <Plus className="w-5 h-5" /> Create Template
        </button>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Template Selector & Categories (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
            {/* Search and Category Filter */}
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border",
                      selectedCategory === cat
                        ? "bg-stone-900 text-white border-stone-900 dark:bg-white dark:text-stone-900 dark:border-white shadow-sm"
                        : "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Template List */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm italic">
                  No templates match your filter.
                </div>
              ) : (
                filteredTemplates.map((template) => {
                  const isSelected = selectedTemplate?.id === template.id;
                  return (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer relative group",
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/50 shadow-md"
                          : "bg-background border-border hover:border-stone-400 dark:hover:border-stone-600"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <Bookmark className={cn("w-4 h-4 shrink-0", isSelected ? "text-emerald-500" : "text-muted-foreground")} />
                          <h3 className="font-bold text-sm text-foreground">{template.title}</h3>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                          {template.category}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {template.content}
                      </p>

                      {/* Management Controls */}
                      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between opacity-80 group-hover:opacity-100">
                        <span className="text-[10px] text-muted-foreground italic">
                          {template.isDefault ? 'Default Response' : 'Custom Response'}
                        </span>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenModal(template)}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-all"
                            title="Edit Response"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {!template.isDefault && (
                            <button
                              onClick={() => handleDeleteTemplate(template.id, template.isDefault)}
                              className="p-1.5 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-500/10 transition-all"
                              title="Delete Response"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Staff Messaging Access */}
          <div className="bg-stone-50 dark:bg-stone-900/40 border border-border rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif italic text-lg text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" /> Staff Quick Contacts
              </h3>
              <span className="text-xs text-muted-foreground">{staff.length} staff</span>
            </div>

            {staff.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No staff contacts available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {staff.map((member) => (
                  <div key={member.id} className="p-3 bg-card border border-border rounded-xl flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-foreground truncate">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{member.role}</p>
                    </div>
                    {member.phone ? (
                      <a
                        href={`https://wa.me/${cleanPhoneNumber(member.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                        title={`Send WhatsApp to ${member.name}`}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">No phone</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Data Injection & Message Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 lg:p-8 shadow-sm space-y-6">
            
            {/* Step 1: Select Guest or Booking */}
            <div className="space-y-4 pb-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" /> 1. Select Client / Booking (Optional)
                </h3>
                {(selectedGuestId || manualPhone) && (
                  <button
                    onClick={() => {
                      setSelectedGuestId('');
                      setSelectedBookingId('');
                      setManualPhone('');
                      setManualGuestName('');
                      setManualRoomNumber('');
                      setManualCheckIn('');
                      setManualCheckOut('');
                      setManualTotalAmount('');
                    }}
                    className="text-xs text-rose-500 hover:underline"
                  >
                    Clear Fields
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Guest Picker */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Select Guest
                  </label>
                  <select
                    value={selectedGuestId}
                    onChange={(e) => handleSelectGuest(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">-- Choose Guest --</option>
                    {guests.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} {g.phone ? `(${g.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Booking Picker */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Select Booking
                  </label>
                  <select
                    value={selectedBookingId}
                    onChange={(e) => handleSelectBooking(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">-- Choose Booking --</option>
                    {bookings.map((b) => {
                      const guest = guests.find(g => g.id === b.guestId);
                      const room = rooms.find(r => r.id === b.roomId);
                      return (
                        <option key={b.id} value={b.id}>
                          {guest?.name || 'Guest'} - Room {room?.number || '?'} ({b.status})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Dynamic Variables Override Fields */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Client Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +27821234567"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Guest Name
                  </label>
                  <input
                    type="text"
                    placeholder="Guest name"
                    value={manualGuestName}
                    onChange={(e) => setManualGuestName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Room Number
                  </label>
                  <input
                    type="text"
                    placeholder="Room 101"
                    value={manualRoomNumber}
                    onChange={(e) => setManualRoomNumber(e.target.value)}
                    className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Check-in Date
                  </label>
                  <input
                    type="text"
                    placeholder="DD MMM YYYY"
                    value={manualCheckIn}
                    onChange={(e) => setManualCheckIn(e.target.value)}
                    className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Check-out Date
                  </label>
                  <input
                    type="text"
                    placeholder="DD MMM YYYY"
                    value={manualCheckOut}
                    onChange={(e) => setManualCheckOut(e.target.value)}
                    className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Total Amount ({settings?.currency || 'R'})
                  </label>
                  <input
                    type="text"
                    placeholder="0.00"
                    value={manualTotalAmount}
                    onChange={(e) => setManualTotalAmount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-muted/30 border border-border rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Formatted Live Preview & Sending Actions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" /> 2. Processed WhatsApp Message Preview
                </h3>
                {selectedTemplate && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    {selectedTemplate.title}
                  </span>
                )}
              </div>

              {/* Message Box Styled like WhatsApp bubble */}
              <div className="relative bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 shadow-inner space-y-4">
                <textarea
                  readOnly
                  value={getProcessedContent()}
                  className="w-full h-56 bg-transparent text-sm font-sans text-foreground resize-none focus:outline-none custom-scrollbar leading-relaxed"
                />

                <div className="pt-3 border-t border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    Target WhatsApp: <span className="font-bold text-foreground">{manualPhone || 'Not set (will open general WhatsApp)'}</span>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleCopyToClipboard}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all border border-border"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" /> Copy Message
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSendWhatsApp}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" /> Send via WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Modal for Creating / Editing Templates */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card border border-border w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="font-serif italic text-2xl text-foreground">
                {editingTemplateId ? 'Edit Message Template' : 'Create New Message Template'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Template Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WiFi & Parking Details"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Category
                  </label>
                  <select
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Message Body *
                  </label>
                  <span className="text-[10px] text-muted-foreground">Click placeholders below to insert</span>
                </div>

                {/* Clickable Placeholders Toolbar */}
                <div className="flex flex-wrap gap-1.5 mb-3 p-2.5 bg-muted/30 border border-border rounded-xl">
                  {PLACEHOLDERS.map(p => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => insertPlaceholderToModal(p.tag)}
                      className="px-2 py-1 text-[10px] font-mono bg-background border border-border rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                      title={`Insert ${p.label}`}
                    >
                      + {p.tag}
                    </button>
                  ))}
                </div>

                <textarea
                  required
                  rows={8}
                  placeholder="Type your message template here..."
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  className="w-full px-4 py-3 bg-muted/40 border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 leading-relaxed custom-scrollbar"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs rounded-xl border border-border transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
