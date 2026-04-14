export type RoomStatus = 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance';
export type BookingStatus = 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled' | 'External';
export type TransactionType = 'Income' | 'Expense' | 'Refund';

export interface Guest {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  vehicleRegistration?: string;
  address?: string;
  photoURL?: string;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  createdAt: string;
}

export interface Room {
  id: string;
  number: string;
  singleRate: number;
  doubleRate: number;
  weekendSingleRate?: number;
  weekendDoubleRate?: number;
  hourlyRate: number;
  status: RoomStatus;
  description?: string;
  maintenanceNotes?: string;
  bookingComIcalUrl?: string;
  lekkeSlaapIcalUrl?: string;
  externalIcalUrl?: string;
  lastSyncAt?: string;
}

export interface RoomInventoryItem {
  id: string;
  roomId: string;
  name: string;
  quantity: number;
  lastUpdated: string;
}

export type RateType = 'Single' | 'Double' | 'Weekend Single' | 'Weekend Double' | 'Hourly' | 'Manual';

export interface Booking {
  id: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  rateType: RateType;
  hours?: number;
  totalAmount: number;
  manualAmount?: number;
  manualRate?: number;
  company?: string;
  referenceNumber?: string;
  paidAmount?: number;
  isPaid?: boolean;
  status: BookingStatus;
  lastPaymentMethod?: string;
  externalSource?: string;
  externalUid?: string;
  createdAt: string;
}

export interface CashbookEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  bookingId?: string;
  paymentMethod?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'manager' | 'staff' | 'user' | 'landlord';
  theme?: AppTheme;
  createdAt: string;
  lastSeen?: string;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  phone?: string;
  photoURL?: string;
  commissionPercentage: number;
  lastPayoutDate: string;
  createdAt: string;
}

export type AppTheme = 'luxury' | 'black-white' | 'bright-orange' | 'bright-green' | 'rosewood' | 'light-blue';
export type BackupFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Settings {
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  country?: string;
  currency: string;
  taxRate: number;
  theme?: AppTheme;
  backupFrequency?: BackupFrequency;
  backupTime?: string;
  lastBackupDate?: string;
  supportName?: string;
  supportCompany?: string;
  supportPhone?: string;
  supportEmail?: string;
  supportLogo?: string;
  landingTitle?: string;
  landingDescription?: string;
  landingImage?: string;
  landingButtonText?: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  bookingId: string;
  guestId: string;
  guestName: string;
  referenceNumber?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  amount: number;
  totalAmount?: number;
  paidAmount?: number;
  balance?: number;
  date: string;
  checkIn?: string;
  checkOut?: string;
  checkInTime?: string;
  checkOutTime?: string;
  items: { description: string; amount: number }[];
  paymentMethod?: string;
  notes?: string;
  status?: BookingStatus;
  createdAt: string;
}

export interface ElectricityReading {
  id: string;
  date: string;
  startReading: number;
  endReading: number;
  unitsUsed: number;
  dailyRevenue: number;
  notes?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  month: number;
  year: number;
  category: string;
  amount: number;
  createdAt: string;
}

export interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  authorId: string;
  authorName?: string;
  createdAt: string;
}

export interface StickyNote {
  id: string;
  content: string;
  color: string;
  position?: { x: number; y: number };
  authorId: string;
  createdAt: string;
}

export interface PasswordEntry {
  id: string;
  title: string;
  username: string;
  password: string; // Encrypted
  url?: string;
  notes?: string;
  authorId: string;
  authorName?: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  address?: string;
  category: string;
  notes?: string;
  authorId: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  authorId: string;
  authorName?: string;
  createdAt: string;
}
