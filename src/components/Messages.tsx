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
  Bookmark, 
  X,
  MessageCircle,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { db, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from '../firebase';
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

  // Mobile active tab view ('templates' or 'preview')
  const [mobileTab, setMobileTab] = useState<'templates' | 'preview'>('templates');

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

  // Select template and auto-switch to preview on mobile
  const handleSelectTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    // On small screens, automatically switch to preview tab for seamless UX
    if (window.innerWidth < 1024) {
      setMobileTab('preview');
    }
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
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 text-stone-100 p-5 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest">
            <MessageSquare className="w-4 h-4" /> Operations Messaging Hub
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif italic text-white">
            Client WhatsApp Responses
          </h1>
          <p className="text-stone-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Select pre-saved templates, auto-fill guest details, and send directly to WhatsApp or copy to clipboard.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="relative z-10 inline-flex items-center justify-center gap-2 bg-emerald-500 text-stone-950 font-bold px-5 py-3 rounded-xl sm:rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 shrink-0 text-xs sm:text-sm w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Create Custom Template
        </button>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Mobile & Tablet Tab Navigation Control (Visible on < lg) */}
      <div className="flex lg:hidden bg-muted p-1.5 rounded-2xl border border-border">
        <button
          type="button"
          onClick={() => setMobileTab('templates')}
          className={cn(
            "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all",
            mobileTab === 'templates'
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Bookmark className="w-4 h-4 text-emerald-500" /> 1. Templates ({templates.length})
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={cn(
            "flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all relative",
            mobileTab === 'preview'
              ? "bg-card text-foreground shadow-sm border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageCircle className="w-4 h-4 text-emerald-500" /> 2. Preview & Send
          {selectedTemplate && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          )}
        </button>
      </div>

      {/* Main Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left Column: Template Selector & Categories (5 cols on Desktop, Tab 1 on Mobile) */}
        <div className={cn(
          "lg:col-span-5 space-y-6",
          mobileTab !== 'templates' && "hidden lg:block"
        )}>
          <div className="bg-card border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
            
            {/* Search & Category Filter */}
            <div className="space-y-3 sm:space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search pre-saved responses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              {/* Category Pills (Touch friendly scrollbar) */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all border shrink-0",
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

            {/* Template Cards List */}
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs sm:text-sm italic">
                  No templates match your search or category filter.
                </div>
              ) : (
                filteredTemplates.map((template) => {
                  const isSelected = selectedTemplate?.id === template.id;
                  return (
                    <div
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        "p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative group",
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/20"
                          : "bg-background border-border hover:border-stone-400 dark:hover:border-stone-600"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Bookmark className={cn("w-4 h-4 shrink-0", isSelected ? "text-emerald-500" : "text-muted-foreground")} />
                          <h3 className="font-bold text-xs sm:text-sm text-foreground truncate">{template.title}</h3>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border shrink-0">
                          {template.category}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-sans">
                        {template.content}
                      </p>

                      {/* Card Footer Controls */}
                      <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground italic">
                          {template.isDefault ? 'Default Response' : 'Custom Response'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Mobile Action Prompt */}
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 lg:hidden">
                            Select <ChevronRight className="w-3 h-3" />
                          </span>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenModal(template)}
                              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-all"
                              title="Edit Response"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {!template.isDefault && (
                              <button
                                type="button"
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
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Staff Quick Contacts */}
          <div className="bg-stone-50 dark:bg-stone-900/40 border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif italic text-base sm:text-lg text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" /> Staff Quick Contacts
              </h3>
              <span className="text-xs text-muted-foreground">{staff.length} staff</span>
            </div>

            {staff.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No staff contacts registered.</p>
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
                        <MessageCircle className="w-4 h-4" />
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

        {/* Right Column: Guest Picker & WhatsApp Preview (7 cols on Desktop, Tab 2 on Mobile) */}
        <div className={cn(
          "lg:col-span-7 space-y-6",
          mobileTab !== 'preview' && "hidden lg:block"
        )}>
          <div className="bg-card border border-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-sm space-y-5 sm:space-y-6">
            
            {/* Step 1: Select Guest or Booking */}
            <div className="space-y-4 pb-5 sm:pb-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" /> 1. Select Client / Booking
                </h3>
                {(selectedGuestId || manualPhone || manualGuestName) && (
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
                    className="text-xs text-rose-500 hover:underline font-medium"
                  >
                    Clear Fields
                  </button>
                )}
              </div>

              {/* Guest & Booking Selection Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Guest Picker */}
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Select Guest
                  </label>
                  <select
                    value={selectedGuestId}
                    onChange={(e) => handleSelectGuest(e.target.value)}
                    className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">-- Choose Registered Guest --</option>
                    {guests.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} {g.phone ? `(${g.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Booking Picker */}
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Select Booking
                  </label>
                  <select
                    value={selectedBookingId}
                    onChange={(e) => handleSelectBooking(e.target.value)}
                    className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">-- Choose Active Booking --</option>
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

              {/* Dynamic Variables Inputs Grid */}
              <div className="space-y-2 pt-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Custom Data Inputs (Auto-filled or edit manually):
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                      Client WhatsApp Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +27821234567"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                      Guest Name
                    </label>
                    <input
                      type="text"
                      placeholder="Guest name"
                      value={manualGuestName}
                      onChange={(e) => setManualGuestName(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                      Room Number
                    </label>
                    <input
                      type="text"
                      placeholder="Room 101"
                      value={manualRoomNumber}
                      onChange={(e) => setManualRoomNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                      Check-in Date
                    </label>
                    <input
                      type="text"
                      placeholder="DD MMM YYYY"
                      value={manualCheckIn}
                      onChange={(e) => setManualCheckIn(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                      Check-out Date
                    </label>
                    <input
                      type="text"
                      placeholder="DD MMM YYYY"
                      value={manualCheckOut}
                      onChange={(e) => setManualCheckOut(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-0.5">
                      Total Amount ({settings?.currency || 'R'})
                    </label>
                    <input
                      type="text"
                      placeholder="0.00"
                      value={manualTotalAmount}
                      onChange={(e) => setManualTotalAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/30 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Formatted WhatsApp Live Preview & Actions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" /> 2. WhatsApp Message Preview
                </h3>
                {selectedTemplate && (
                  <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full truncate max-w-[180px]">
                    {selectedTemplate.title}
                  </span>
                )}
              </div>

              {/* WhatsApp Bubble Container */}
              <div className="relative bg-emerald-950/5 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-inner space-y-4">
                
                {/* Header status strip */}
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-foreground">
                      {manualGuestName ? `To: ${manualGuestName}` : 'To: Valued Client'}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {manualPhone || 'No phone entered'}
                  </span>
                </div>

                {/* Live Message Area */}
                <textarea
                  readOnly
                  value={getProcessedContent()}
                  className="w-full h-52 sm:h-60 bg-transparent text-xs sm:text-sm font-sans text-foreground resize-none focus:outline-none custom-scrollbar leading-relaxed"
                />

                {/* Bottom WhatsApp Actions Bar */}
                <div className="pt-3 border-t border-emerald-500/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">
                      {manualPhone ? `Recipient: ${manualPhone}` : 'Opens WhatsApp with message text'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={handleCopyToClipboard}
                      className="py-3 px-4 bg-card hover:bg-muted text-foreground font-semibold text-xs sm:text-sm rounded-xl transition-all border border-border flex items-center justify-center gap-2"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" /> Copy Text
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSendWhatsApp}
                      className="py-3 px-5 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" /> Send via WhatsApp
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-300">
            <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between bg-muted/30">
              <h3 className="font-serif italic text-lg sm:text-2xl text-foreground">
                {editingTemplateId ? 'Edit Message Template' : 'Create New Message Template'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                    className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Category
                  </label>
                  <select
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
                  <span className="text-[10px] text-muted-foreground">Tap tag to insert</span>
                </div>

                {/* Clickable Placeholders Toolbar */}
                <div className="flex flex-wrap gap-1.5 mb-3 p-2 sm:p-2.5 bg-muted/30 border border-border rounded-xl max-h-28 overflow-y-auto custom-scrollbar">
                  {PLACEHOLDERS.map(p => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => insertPlaceholderToModal(p.tag)}
                      className="px-2 py-1 text-[10px] sm:text-xs font-mono bg-background border border-border rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-all shrink-0"
                      title={`Insert ${p.label}`}
                    >
                      + {p.tag}
                    </button>
                  ))}
                </div>

                <textarea
                  required
                  rows={7}
                  placeholder="Type your message template here..."
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  className="w-full px-3.5 py-3 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 leading-relaxed custom-scrollbar"
                />
              </div>

              <div className="pt-3 border-t border-border flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs sm:text-sm rounded-xl border border-border transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
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
