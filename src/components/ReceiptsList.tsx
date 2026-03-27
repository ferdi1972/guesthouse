import React, { useState, useEffect } from 'react';
import { 
  Receipt as ReceiptIcon, 
  Search, 
  Calendar, 
  User, 
  Download, 
  Share2, 
  Mail, 
  MessageSquare,
  ExternalLink,
  X,
  Printer,
  Filter
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Receipt, Settings, UserProfile } from '../types';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { Trash2 } from 'lucide-react';
import { deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { auth } from '../firebase';

interface ReceiptsListProps {
  settings: Settings | null;
  userProfile: UserProfile | null;
}

export default function ReceiptsList({ settings, userProfile }: ReceiptsListProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({
    start: '',
    end: ''
  });
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Receipt; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const [receiptToDelete, setReceiptToDelete] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'receipts', id));
      setReceiptToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `receipts/${id}`);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'receipts'), orderBy('createdAt', 'desc')), (snap) => {
      setReceipts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt)));
    });
    return () => unsub();
  }, []);

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = r.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const receiptDate = new Date(r.date);
    const matchesStartDate = !dateFilter.start || receiptDate >= new Date(dateFilter.start);
    const matchesEndDate = !dateFilter.end || receiptDate <= new Date(dateFilter.end + 'T23:59:59');
    
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;

    return matchesSearch && matchesStartDate && matchesEndDate && matchesStatus;
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
      const aNum = aValue as number;
      const bNum = bValue as number;
      return sortConfig.direction === 'asc'
        ? aNum - bNum
        : bNum - aNum;
    }

    return 0;
  });

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
          <title>Receipt - ${selectedReceipt?.receiptNumber || 'Print'}</title>
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
      (receipt.checkIn ? `Stay: ${format(parseISO(receipt.checkIn), 'MMM dd')} (${receipt.checkInTime || '14:00'}) to ${format(parseISO(receipt.checkOut!), 'MMM dd')} (${receipt.checkOutTime || '10:00'})\n` : '') +
      `Total: ${settings?.currency || '$'} ${(receipt.totalAmount || receipt.amount).toLocaleString()}\n` +
      `Paid: ${settings?.currency || '$'} ${(receipt.paidAmount || 0).toLocaleString()}\n` +
      `Balance: ${settings?.currency || '$'} ${(receipt.balance || 0).toLocaleString()}\n` +
      `Date: ${format(parseISO(receipt.date), 'MMM dd, yyyy')}`;
    
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
      (receipt.checkIn ? `Stay: ${format(parseISO(receipt.checkIn), 'MMM dd, yyyy')} (${receipt.checkInTime || '14:00'}) to ${format(parseISO(receipt.checkOut!), 'MMM dd, yyyy')} (${receipt.checkOutTime || '10:00'})\n` : '') +
      `Total: ${settings?.currency || '$'} ${(receipt.totalAmount || receipt.amount).toLocaleString()}\n` +
      `Paid: ${settings?.currency || '$'} ${(receipt.paidAmount || 0).toLocaleString()}\n` +
      `Balance: ${settings?.currency || '$'} ${(receipt.balance || 0).toLocaleString()}\n` +
      `Date: ${format(parseISO(receipt.date), 'MMM dd, yyyy')}\n\n` +
      `Thank you for staying with us!`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search by guest or receipt #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all text-sm"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors",
              showFilters || dateFilter.start || dateFilter.end || statusFilter !== 'All' ? "text-stone-900" : "text-stone-400 hover:text-stone-900"
            )}
          >
            <Filter className="w-4 h-4" /> {showFilters ? 'Hide Filters' : 'Filter'}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-100 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-stone-900 outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Confirmed">Confirmed</option>
                <option value="CheckedIn">Checked In</option>
                <option value="CheckedOut">Checked Out</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Date Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                  className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-stone-900 outline-none"
                />
                <span className="text-stone-300">-</span>
                <input
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                  className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-stone-900 outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Sort By</label>
              <div className="flex gap-2">
                <select
                  value={sortConfig.key}
                  onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value as keyof Receipt })}
                  className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-stone-900 outline-none"
                >
                  <option value="date">Date</option>
                  <option value="receiptNumber">Receipt #</option>
                  <option value="guestName">Guest Name</option>
                  <option value="amount">Amount</option>
                </select>
                <button
                  onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                  className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs hover:bg-stone-100 transition-colors"
                >
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
            {(dateFilter.start || dateFilter.end || statusFilter !== 'All') && (
              <div className="sm:col-span-3 flex justify-end">
                <button 
                  onClick={() => {
                    setDateFilter({ start: '', end: '' });
                    setStatusFilter('All');
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:text-rose-700 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Receipt #</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Guest</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-400 italic">No receipts found.</td>
                </tr>
              ) : (
                filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-stone-50/50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-sm font-bold text-stone-900">
                      {receipt.receiptNumber}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-stone-400" />
                        <span className="text-sm font-medium text-stone-700">{receipt.guestName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-stone-500">
                        <Calendar className="w-4 h-4 text-stone-400" />
                        <span>{format(parseISO(receipt.date), 'MMM dd, yyyy')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-stone-900">
                      {settings?.currency || '$'} {receipt.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedReceipt(receipt)}
                          className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                          title="View Receipt"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleShareWhatsApp(receipt)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Share via WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleShareEmail(receipt)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Share via Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        {userProfile?.role === 'admin' && (
                          <button
                            onClick={() => setReceiptToDelete(receipt.id)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete Receipt"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-stone-100">
          {filteredReceipts.length === 0 ? (
            <div className="px-6 py-12 text-center text-stone-400 italic">No receipts found.</div>
          ) : (
            filteredReceipts.map((receipt) => (
              <div key={receipt.id} className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Receipt #</p>
                    <p className="font-mono text-sm font-bold text-stone-900">{receipt.receiptNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Date</p>
                    <p className="text-xs text-stone-700">{format(parseISO(receipt.date), 'MMM dd, yyyy')}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-y border-stone-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-stone-600 font-bold text-xs">
                      {receipt.guestName.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-stone-900">{receipt.guestName}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Amount</p>
                    <p className="font-mono font-bold text-stone-900">
                      {settings?.currency || '$'} {receipt.amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedReceipt(receipt)}
                      className="p-2.5 bg-stone-100 text-stone-600 rounded-xl transition-all"
                      title="View"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleShareWhatsApp(receipt)}
                      className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl transition-all"
                      title="WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleShareEmail(receipt)}
                      className="p-2.5 bg-blue-50 text-blue-600 rounded-xl transition-all"
                      title="Email"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  </div>
                  {userProfile?.role === 'admin' && (
                    <button
                      onClick={() => setReceiptToDelete(receipt.id)}
                      className="p-2.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {receiptToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif italic text-stone-900 mb-2">Delete Receipt?</h3>
            <p className="text-stone-500 text-sm mb-8">
              Are you sure you want to delete this receipt? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setReceiptToDelete(null)}
                className="flex-1 px-4 py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(receiptToDelete)}
                className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">Receipt Preview</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
                  title="Print Receipt"
                >
                  <Printer className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => setSelectedReceipt(null)}
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
                    {selectedReceipt.companyName || settings?.companyName || 'Guesthouse'}
                  </h2>
                  <div className="text-xs text-stone-500 space-y-1">
                    <p>{selectedReceipt.companyAddress || settings?.address}</p>
                    <p>{selectedReceipt.companyPhone || settings?.phone}</p>
                    <p>{selectedReceipt.companyEmail || settings?.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h1 className={cn(
                    "text-3xl font-serif italic mb-2",
                    selectedReceipt.status === 'Cancelled' ? "text-rose-600" : "text-stone-200"
                  )}>
                    {selectedReceipt.status === 'Cancelled' ? 'CANCELLED' : 'RECEIPT'}
                  </h1>
                  <p className="text-sm font-mono font-bold text-stone-900">{selectedReceipt.receiptNumber}</p>
                  <p className="text-[10px] text-stone-400">{format(parseISO(selectedReceipt.date), 'MMMM dd, yyyy')}</p>
                </div>
              </div>

              <div className="mb-8">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Bill To</h4>
                <p className="text-base font-medium text-stone-900">{selectedReceipt.guestName}</p>
              </div>

              {(selectedReceipt.checkIn || selectedReceipt.checkOut) && (
                <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Check In</h4>
                    <p className="text-xs font-medium text-stone-900">
                      {selectedReceipt.checkIn ? format(parseISO(selectedReceipt.checkIn), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                    <p className="text-[10px] text-stone-500 font-mono">{selectedReceipt.checkInTime || '14:00'}</p>
                  </div>
                  <div className="text-right">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Check Out</h4>
                    <p className="text-xs font-medium text-stone-900">
                      {selectedReceipt.checkOut ? format(parseISO(selectedReceipt.checkOut), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                    <p className="text-[10px] text-stone-500 font-mono">{selectedReceipt.checkOutTime || '10:00'}</p>
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
                  {selectedReceipt.items.map((item, idx) => (
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
                      {settings?.currency || '$'} {(selectedReceipt.totalAmount || selectedReceipt.amount).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-right text-[10px] font-bold uppercase tracking-widest text-stone-400">Paid to Date</td>
                    <td className="py-2 text-right font-mono font-bold text-emerald-600">
                      {settings?.currency || '$'} {(selectedReceipt.paidAmount || 0).toLocaleString()}
                    </td>
                  </tr>
                  <tr className="border-t border-stone-100">
                    <td className="py-4 text-right text-[10px] font-bold uppercase tracking-widest text-stone-900">Balance Due</td>
                    <td className="py-4 text-right text-xl font-mono font-bold text-stone-900">
                      {settings?.currency || '$'} {(selectedReceipt.balance || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="text-center text-stone-400 text-[10px] italic">
                Thank you for choosing {selectedReceipt.companyName || settings?.companyName || 'us'}!
              </div>
            </div>

            <div className="p-6 bg-stone-50 border-t border-stone-100 flex gap-3 shrink-0">
              <button
                onClick={() => handleShareWhatsApp(selectedReceipt)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all text-sm"
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </button>
              <button
                onClick={() => handleShareEmail(selectedReceipt)}
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
