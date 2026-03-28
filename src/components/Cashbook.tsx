import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Search, 
  Filter,
  Download,
  Trash2,
  Edit2,
  X,
  Wallet,
  RotateCcw,
  Target,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, where } from 'firebase/firestore';
import { CashbookEntry, TransactionType, Settings, Booking, Guest, UserProfile, Budget } from '../types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { exportDataToExcel, exportMultipleSheetsToExcel } from '../services/excelService';

interface CashbookProps {
  settings: Settings | null;
  userProfile: UserProfile | null;
}

const PREDEFINED_CATEGORIES = [
  "General", "Booking", "Maintenance", "Utilities", "Salaries", 
  "Food & Beverage", "Insurance", "Internet", "Transport", 
  "Fuel", "Banking Cost", "Rent", "Income", "Marketing", "Supplies"
];

export default function Cashbook({ settings, userProfile }: CashbookProps) {
  const [activeTab, setActiveTab] = useState<'transactions' | 'budget'>('transactions');
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Record<string, Guest>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBudgetDeleteConfirmOpen, setIsBudgetDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<CashbookEntry | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  
  // Budget Period State
  const [budgetPeriod, setBudgetPeriod] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState({
    start: '',
    end: ''
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof CashbookEntry; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc'
  });
  const [showFilters, setShowFilters] = useState(false);

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    amount: 0,
    type: 'Income' as TransactionType,
    category: 'General',
    paymentMethod: 'Cash'
  });

  const [budgetFormData, setBudgetFormData] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    category: 'General',
    amount: 0
  });

  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [isBudgetCustomCategory, setIsBudgetCustomCategory] = useState(false);
  const [budgetCustomCategory, setBudgetCustomCategory] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'cashbook'), orderBy('date', 'desc')), (snap) => {
      setEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashbookEntry)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'cashbook');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'budgets'), orderBy('category', 'asc')), (snap) => {
      setBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'budgets');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snap) => {
      setBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    });
    const unsubGuests = onSnapshot(collection(db, 'guests'), (snap) => {
      const guestMap: Record<string, Guest> = {};
      snap.docs.forEach(doc => {
        guestMap[doc.id] = { id: doc.id, ...doc.data() } as Guest;
      });
      setGuests(guestMap);
    });
    return () => {
      unsubBookings();
      unsubGuests();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = editingEntry ? `cashbook/${editingEntry.id}` : 'cashbook';
    try {
      const dataToSave = {
        ...formData,
        category: isCustomCategory ? customCategory : formData.category,
        date: parseISO(formData.date).toISOString()
      };

      if (editingEntry) {
        await updateDoc(doc(db, 'cashbook', editingEntry.id), dataToSave);
      } else {
        await addDoc(collection(db, 'cashbook'), dataToSave);
      }
      
      setIsModalOpen(false);
      setEditingEntry(null);
      setIsCustomCategory(false);
      setCustomCategory('');
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        amount: 0,
        type: 'Income',
        category: 'General',
        paymentMethod: 'Cash'
      });
    } catch (error) {
      handleFirestoreError(error, editingEntry ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = editingBudget ? `budgets/${editingBudget.id}` : 'budgets';
    try {
      const dataToSave = {
        ...budgetFormData,
        category: isBudgetCustomCategory ? budgetCustomCategory : budgetFormData.category,
        createdAt: editingBudget ? editingBudget.createdAt : new Date().toISOString()
      };

      if (editingBudget) {
        await updateDoc(doc(db, 'budgets', editingBudget.id), dataToSave);
      } else {
        await addDoc(collection(db, 'budgets'), dataToSave);
      }
      
      setIsBudgetModalOpen(false);
      setEditingBudget(null);
      setIsBudgetCustomCategory(false);
      setBudgetCustomCategory('');
      setBudgetFormData({
        month: budgetPeriod.month,
        year: budgetPeriod.year,
        category: 'General',
        amount: 0
      });
    } catch (error) {
      handleFirestoreError(error, editingBudget ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const handleDelete = async () => {
    if (!entryToDelete) return;
    const id = entryToDelete;
    const path = `cashbook/${id}`;
    setIsDeleteConfirmOpen(false);
    setEntryToDelete(null);
    try {
      await deleteDoc(doc(db, 'cashbook', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleBudgetDelete = async () => {
    if (!budgetToDelete) return;
    const id = budgetToDelete;
    const path = `budgets/${id}`;
    setIsBudgetDeleteConfirmOpen(false);
    setBudgetToDelete(null);
    try {
      await deleteDoc(doc(db, 'budgets', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.amount.toString().includes(searchTerm);
    const matchesType = typeFilter === 'All' || entry.type === typeFilter;
    const matchesCategory = categoryFilter === 'All' || entry.category === categoryFilter;
    
    const entryDate = new Date(entry.date);
    const matchesStartDate = !dateFilter.start || entryDate >= new Date(dateFilter.start);
    const matchesEndDate = !dateFilter.end || entryDate <= new Date(dateFilter.end + 'T23:59:59');

    return matchesSearch && matchesType && matchesCategory && matchesStartDate && matchesEndDate;
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

    return 0;
  });

  const totalIncomeRaw = filteredEntries.filter(e => e.type === 'Income').reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = filteredEntries.filter(e => e.type === 'Expense').reduce((sum, e) => sum + e.amount, 0);
  const totalRefunds = filteredEntries.filter(e => e.type === 'Refund').reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = totalIncomeRaw - totalRefunds;
  const totalPending = bookings
    .filter(b => b.status !== 'Cancelled' && !b.isPaid)
    .reduce((sum, b) => sum + (b.totalAmount - (b.paidAmount || 0)), 0);
  const balance = totalIncome - totalExpense;

  const categories = Array.from(new Set([...entries.map(e => e.category), ...budgets.map(b => b.category)]));

  const pendingBookings = bookings.filter(b => b.status !== 'Cancelled' && !b.isPaid && (b.totalAmount - (b.paidAmount || 0)) > 0);

  const filteredBudgets = budgets.filter(b => b.month === budgetPeriod.month && b.year === budgetPeriod.year);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getActualForCategory = (category: string) => {
    const start = startOfMonth(new Date(budgetPeriod.year, budgetPeriod.month));
    const end = endOfMonth(new Date(budgetPeriod.year, budgetPeriod.month));
    
    const categoryEntries = entries.filter(e => 
      e.category === category && 
      new Date(e.date) >= start && 
      new Date(e.date) <= end
    );

    if (category === 'Income' || category === 'Booking') {
      return categoryEntries.reduce((sum, e) => {
        if (e.type === 'Income') return sum + e.amount;
        if (e.type === 'Refund') return sum - e.amount;
        return sum;
      }, 0);
    }

    return categoryEntries.reduce((sum, e) => {
      if (e.type === 'Expense') return sum + e.amount;
      return sum;
    }, 0);
  };

  const handleDownload = () => {
    if (activeTab === 'budget') {
      const incomeBudgets = filteredBudgets.filter(b => b.category === 'Income' || b.category === 'Booking');
      const expenseBudgets = filteredBudgets.filter(b => b.category !== 'Income' && b.category !== 'Booking');

      const formatBudgetData = (budgets: Budget[]) => budgets.map(b => ({
        Month: monthNames[b.month],
        Year: b.year,
        Category: b.category,
        'Allocated Amount': b.amount,
        'Actual Spent': getActualForCategory(b.category),
        'Remaining': b.amount - getActualForCategory(b.category)
      }));

      exportMultipleSheetsToExcel({
        'Projected Income': formatBudgetData(incomeBudgets),
        'Projected Expenses': formatBudgetData(expenseBudgets)
      }, `budget-${monthNames[budgetPeriod.month]}-${budgetPeriod.year}`);
    } else {
      const transactionData = filteredEntries.map(e => ({
        Date: format(new Date(e.date), 'yyyy-MM-dd'),
        Description: e.description,
        Category: e.category,
        Type: e.type,
        Method: e.paymentMethod || 'Cash',
        Amount: e.amount
      }));
      exportDataToExcel(transactionData, `transactions-${new Date().toISOString().split('T')[0]}`, 'Transactions');
    }
  };

  const totalProjectedExpenses = filteredBudgets
    .filter(b => b.category !== 'Income' && b.category !== 'Booking')
    .reduce((sum, b) => sum + b.amount, 0);
  
  const totalActualExpenses = entries
    .filter(e => {
      const start = startOfMonth(new Date(budgetPeriod.year, budgetPeriod.month));
      const end = endOfMonth(new Date(budgetPeriod.year, budgetPeriod.month));
      const entryDate = new Date(e.date);
      return e.type === 'Expense' && entryDate >= start && entryDate <= end;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const projectedIncome = filteredBudgets
    .filter(b => b.category === 'Income' || b.category === 'Booking')
    .reduce((sum, b) => sum + b.amount, 0);
  
  const actualTotalIncome = entries
    .filter(e => {
      const start = startOfMonth(new Date(budgetPeriod.year, budgetPeriod.month));
      const end = endOfMonth(new Date(budgetPeriod.year, budgetPeriod.month));
      const entryDate = new Date(e.date);
      return (e.type === 'Income' || e.type === 'Refund') && entryDate >= start && entryDate <= end;
    })
    .reduce((sum, e) => {
      if (e.type === 'Income') return sum + e.amount;
      if (e.type === 'Refund') return sum - e.amount;
      return sum;
    }, 0);

  const budgetTransactions = entries.filter(e => {
    const start = startOfMonth(new Date(budgetPeriod.year, budgetPeriod.month));
    const end = endOfMonth(new Date(budgetPeriod.year, budgetPeriod.month));
    const entryDate = new Date(e.date);
    return entryDate >= start && entryDate <= end;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const projectedNettProfit = projectedIncome - totalProjectedExpenses;
  const actualNettProfit = actualTotalIncome - totalActualExpenses;

  return (
    <>
      <div className="no-print space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-serif italic text-stone-900">Cashbook</h1>
          <p className="text-stone-500 text-sm">Track your guesthouse income and expenses.</p>
        </div>
        <div className="flex items-center gap-3">
          {userProfile?.role === 'admin' && (
            <div className="flex p-1 bg-stone-100 rounded-xl mr-2">
              <button
                onClick={() => setActiveTab('transactions')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  activeTab === 'transactions' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                )}
              >
                Transactions
              </button>
              <button
                onClick={() => setActiveTab('budget')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  activeTab === 'budget' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                )}
              >
                Budget
              </button>
            </div>
          )}
          <button 
            onClick={handleDownload}
            className="p-3 text-stone-500 hover:text-stone-900 bg-white border border-stone-200 rounded-xl transition-all"
            title="Download Excel"
          >
            <Download className="w-5 h-5" />
          </button>
          {userProfile?.role === 'admin' && (
            <button
              onClick={() => activeTab === 'transactions' ? setIsModalOpen(true) : setIsBudgetModalOpen(true)}
              className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center gap-2 shadow-lg shadow-stone-900/10"
            >
              <Plus className="w-5 h-5" />
              {activeTab === 'transactions' ? 'Add Transaction' : 'Add Budget'}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'transactions' ? (
        <>
          {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Net Income</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-serif font-bold text-emerald-600">
              {settings?.currency || '$'} {totalIncome.toLocaleString()}
            </h3>
            <ArrowUpCircle className="w-8 h-8 text-emerald-100" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Total Expenses</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-serif font-bold text-rose-600">
              {settings?.currency || '$'} {totalExpense.toLocaleString()}
            </h3>
            <ArrowDownCircle className="w-8 h-8 text-rose-100" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Total Refunds</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-serif font-bold text-amber-600">
              {settings?.currency || '$'} {totalRefunds.toLocaleString()}
            </h3>
            <RotateCcw className="w-8 h-8 text-amber-100" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Pending Collections</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-serif font-bold text-stone-400">
              {settings?.currency || '$'} {totalPending.toLocaleString()}
            </h3>
            <Wallet className="w-8 h-8 text-stone-100" />
          </div>
        </div>
        <div className="bg-stone-900 p-6 rounded-2xl shadow-xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Net Balance {searchTerm || typeFilter !== 'All' || categoryFilter !== 'All' || dateFilter.start || dateFilter.end ? '(Filtered)' : ''}</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-serif font-bold text-white">
              {settings?.currency || '$'} {balance.toLocaleString()}
            </h3>
            <Wallet className="w-8 h-8 text-stone-700" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-100 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors",
                  showFilters || typeFilter !== 'All' || categoryFilter !== 'All' || dateFilter.start || dateFilter.end ? "text-stone-900" : "text-stone-400 hover:text-stone-900"
                )}
              >
                <Filter className="w-4 h-4" /> {showFilters ? 'Hide Filters' : 'Filter'}
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-100 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'All')}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-stone-900 outline-none"
                  >
                    <option value="All">All Types</option>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                    <option value="Refund">Refund</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-stone-900 outline-none"
                  >
                    <option value="All">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Date Range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateFilter.start}
                      onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                      className="flex-1 px-2 py-2 bg-stone-50 border border-stone-200 rounded-lg text-[10px] focus:ring-2 focus:ring-stone-900 outline-none"
                    />
                    <span className="text-stone-300">-</span>
                    <input
                      type="date"
                      value={dateFilter.end}
                      onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                      className="flex-1 px-2 py-2 bg-stone-50 border border-stone-200 rounded-lg text-[10px] focus:ring-2 focus:ring-stone-900 outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Sort By</label>
                  <div className="flex gap-2">
                    <select
                      value={sortConfig.key}
                      onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value as keyof CashbookEntry })}
                      className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:ring-2 focus:ring-stone-900 outline-none"
                    >
                      <option value="date">Date</option>
                      <option value="description">Description</option>
                      <option value="amount">Amount</option>
                      <option value="category">Category</option>
                      <option value="type">Type</option>
                    </select>
                    <button
                      onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                      className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs hover:bg-stone-100 transition-colors"
                    >
                      {sortConfig.direction === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
                {(typeFilter !== 'All' || categoryFilter !== 'All' || dateFilter.start || dateFilter.end) && (
                  <div className="sm:col-span-3 flex justify-end">
                    <button 
                      onClick={() => {
                        setTypeFilter('All');
                        setCategoryFilter('All');
                        setDateFilter({ start: '', end: '' });
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
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Date</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Description</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Category</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Method</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Amount</th>
                  {userProfile?.role === 'admin' && (
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={userProfile?.role === 'admin' ? 6 : 5} className="px-6 py-12 text-center text-stone-400 italic">No transactions found matching your criteria.</td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors group">
                      <td className="px-6 py-4 text-sm text-stone-500 font-mono">
                        {format(new Date(entry.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {entry.type === 'Income' ? (
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                              <ArrowUpCircle className="w-4 h-4" />
                            </div>
                          ) : entry.type === 'Expense' ? (
                            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                              <ArrowDownCircle className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                              <RotateCcw className="w-4 h-4" />
                            </div>
                          )}
                          <span className="font-medium text-stone-900">{entry.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-stone-100 text-stone-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                          {entry.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-stone-500">
                          {entry.paymentMethod || '-'}
                        </span>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-right font-mono font-bold",
                        entry.type === 'Income' ? "text-emerald-600" : 
                        entry.type === 'Expense' ? "text-rose-600" : "text-amber-600"
                      )}>
                        {entry.type === 'Income' ? '+' : '-'}{settings?.currency || '$'} {entry.amount.toLocaleString()}
                      </td>
                      {userProfile?.role === 'admin' && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingEntry(entry);
                                const isCustom = !PREDEFINED_CATEGORIES.includes(entry.category);
                                setIsCustomCategory(isCustom);
                                setCustomCategory(isCustom ? entry.category : '');
                                setFormData({
                                  date: format(new Date(entry.date), 'yyyy-MM-dd'),
                                  description: entry.description,
                                  amount: entry.amount,
                                  type: entry.type,
                                  category: isCustom ? 'Other' : entry.category,
                                  paymentMethod: entry.paymentMethod || 'Cash'
                                });
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                              title="Edit Transaction"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEntryToDelete(entry.id);
                                setIsDeleteConfirmOpen(true);
                              }}
                              className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Transaction"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Outstanding Balances */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden h-fit">
          <div className="p-6 border-b border-stone-100">
            <h3 className="font-serif italic text-xl text-stone-900">Outstanding Balances</h3>
            <p className="text-stone-400 text-xs mt-1">Money to be collected from guests.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {pendingBookings.length === 0 ? (
              <div className="p-8 text-center text-stone-400 italic text-sm">No outstanding balances.</div>
            ) : (
              pendingBookings.map((booking) => (
                <div key={booking.id} className="p-4 hover:bg-stone-50 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-stone-900 text-sm">{guests[booking.guestId]?.name || 'Unknown Guest'}</span>
                    <span className="font-mono font-bold text-rose-600 text-sm">
                      {settings?.currency || '$'} {(booking.totalAmount - (booking.paidAmount || 0)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-stone-500 uppercase tracking-widest font-bold">
                    <span>Room {booking.roomId}</span>
                    <span>Paid: {settings?.currency || '$'} {(booking.paidAmount || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  ) : (
    <div className="space-y-6">
          {/* Budget Period Selector */}
          <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center text-white">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-serif italic text-stone-900">Monthly Budget</h3>
                <p className="text-stone-500 text-xs">Plan and track your expenses for {monthNames[budgetPeriod.month]} {budgetPeriod.year}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="hidden md:flex gap-8 border-r border-stone-100 pr-8 mr-2">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Projected Income</p>
                  <p className="text-xl font-serif font-bold text-emerald-600">{settings?.currency || '$'} {projectedIncome.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Actual Income</p>
                  <p className="text-xl font-serif font-bold text-emerald-600">{settings?.currency || '$'} {actualTotalIncome.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Projected Expenses</p>
                  <p className="text-xl font-serif font-bold text-rose-600">{settings?.currency || '$'} {totalProjectedExpenses.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Actual Expenses</p>
                  <p className="text-xl font-serif font-bold text-rose-600">{settings?.currency || '$'} {totalActualExpenses.toLocaleString()}</p>
                </div>
                <div className="text-right border-l border-stone-100 pl-8">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Projected Profit</p>
                  <p className={`text-xl font-serif font-bold ${projectedNettProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {settings?.currency || '$'} {projectedNettProfit.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Actual Profit</p>
                  <p className={`text-xl font-serif font-bold ${actualNettProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {settings?.currency || '$'} {actualNettProfit.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const newMonth = budgetPeriod.month === 0 ? 11 : budgetPeriod.month - 1;
                    const newYear = budgetPeriod.month === 0 ? budgetPeriod.year - 1 : budgetPeriod.year;
                    setBudgetPeriod({ month: newMonth, year: newYear });
                  }}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-bold text-stone-900 min-w-[140px] text-center">
                  {monthNames[budgetPeriod.month]} {budgetPeriod.year}
                </span>
                <button 
                  onClick={() => {
                    const newMonth = budgetPeriod.month === 11 ? 0 : budgetPeriod.month + 1;
                    const newYear = budgetPeriod.month === 11 ? budgetPeriod.year + 1 : budgetPeriod.year;
                    setBudgetPeriod({ month: newMonth, year: newYear });
                  }}
                  className="p-2 hover:bg-stone-100 rounded-lg transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBudgets.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-stone-300">
                <Target className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                <p className="text-stone-400 italic">No budget entries for this period.</p>
                <button 
                  onClick={() => setIsBudgetModalOpen(true)}
                  className="mt-4 text-stone-900 font-bold text-sm hover:underline"
                >
                  Create your first budget entry
                </button>
              </div>
            ) : (
              filteredBudgets.map((budget) => {
                const actual = getActualForCategory(budget.category);
                const percentage = Math.min((actual / budget.amount) * 100, 100);
                const isOver = actual > budget.amount;
                const isIncome = budget.category === 'Income' || budget.category === 'Booking';

                return (
                  <div key={budget.id} className={cn(
                    "bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all group",
                    isIncome ? "border-emerald-100" : "border-rose-100"
                  )}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-2 inline-block",
                          isIncome ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {budget.category}
                        </span>
                        <h4 className="text-lg font-bold text-stone-900">{budget.category}</h4>
                      </div>
                      <div className="flex gap-1 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingBudget(budget);
                            const isCustom = !PREDEFINED_CATEGORIES.includes(budget.category);
                            setIsBudgetCustomCategory(isCustom);
                            setBudgetCustomCategory(isCustom ? budget.category : '');
                            setBudgetFormData({
                              month: budget.month,
                              year: budget.year,
                              category: isCustom ? 'Other' : budget.category,
                              amount: budget.amount
                            });
                            setIsBudgetModalOpen(true);
                          }}
                          className="p-2 text-stone-400 hover:text-stone-900 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setBudgetToDelete(budget.id);
                            setIsBudgetDeleteConfirmOpen(true);
                          }}
                          className="p-2 text-stone-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Actual</p>
                          <p className={cn(
                            "text-xl font-bold", 
                            isIncome ? "text-emerald-600" : (isOver ? "text-rose-600" : "text-stone-900")
                          )}>
                            {settings?.currency || '$'} {actual.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Budget</p>
                          <p className={cn(
                            "text-lg font-medium",
                            isIncome ? "text-emerald-500" : "text-rose-500"
                          )}>
                            {settings?.currency || '$'} {budget.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="relative h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "absolute left-0 top-0 h-full transition-all duration-500",
                            isIncome ? "bg-emerald-500" : (isOver ? "bg-rose-500" : percentage > 80 ? "bg-amber-500" : "bg-emerald-500")
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className={cn(
                          isIncome ? "text-emerald-600" : (isOver ? "text-rose-600" : "text-stone-400")
                        )}>
                          {percentage.toFixed(1)}% {isIncome ? 'Achieved' : 'Used'}
                        </span>
                        <span className={cn(
                          isIncome ? "text-emerald-600" : (isOver ? "text-rose-600" : "text-stone-400")
                        )}>
                          {isIncome 
                            ? (actual >= budget.amount ? 'Target Met' : `${(budget.amount - actual).toLocaleString()} Remaining`)
                            : (isOver ? 'Over Budget' : `${(budget.amount - actual).toLocaleString()} Remaining`)
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Budget Transactions List */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mt-8">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="font-serif italic text-xl text-stone-900">Budget Transactions</h3>
                <p className="text-stone-400 text-xs mt-1">Detailed income and expenses for {monthNames[budgetPeriod.month]} {budgetPeriod.year}</p>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Total Income</p>
                  <p className="text-sm font-bold text-emerald-600">{settings?.currency || '$'} {actualTotalIncome.toLocaleString()}</p>
                </div>
                <div className="text-right border-l border-stone-100 pl-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Total Expenses</p>
                  <p className="text-sm font-bold text-rose-600">{settings?.currency || '$'} {totalActualExpenses.toLocaleString()}</p>
                </div>
                <div className="text-right border-l border-stone-100 pl-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Nett Profit</p>
                  <p className={cn("text-sm font-bold", actualNettProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {settings?.currency || '$'} {actualNettProfit.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50/50">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Description</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Category</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {budgetTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-stone-400 italic">No transactions found for this budget period.</td>
                    </tr>
                  ) : (
                    <>
                      {budgetTransactions.map((entry) => (
                        <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-stone-500 font-mono">
                            {format(new Date(entry.date), 'MMM dd')}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-stone-900">{entry.description}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-stone-100 text-stone-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                              {entry.category}
                            </span>
                          </td>
                          <td className={cn(
                            "px-6 py-4 text-right font-mono font-bold",
                            entry.type === 'Income' ? "text-emerald-600" : 
                            entry.type === 'Expense' ? "text-rose-600" : "text-amber-600"
                          )}>
                            {entry.type === 'Income' ? '+' : '-'}{settings?.currency || '$'} {entry.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-stone-50/80 font-bold border-t-2 border-stone-200">
                        <td colSpan={3} className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-stone-500">
                          Monthly Totals
                        </td>
                        <td className={cn(
                          "px-6 py-4 text-right font-mono",
                          actualNettProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {settings?.currency || '$'} {actualNettProfit.toLocaleString()}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Budget Projection Summary */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mt-8">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="font-serif italic text-xl text-stone-900">Budget Projection Summary</h3>
                <p className="text-stone-400 text-xs mt-1">Comparison of planned vs actual figures for {monthNames[budgetPeriod.month]} {budgetPeriod.year}</p>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Proj. Profit</p>
                  <p className={cn("text-sm font-bold", projectedNettProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {settings?.currency || '$'} {projectedNettProfit.toLocaleString()}
                  </p>
                </div>
                <div className="text-right border-l border-stone-100 pl-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Actual Profit</p>
                  <p className={cn("text-sm font-bold", actualNettProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {settings?.currency || '$'} {actualNettProfit.toLocaleString()}
                  </p>
                </div>
                <div className="text-right border-l border-stone-100 pl-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Variance</p>
                  <p className={cn("text-sm font-bold", (actualNettProfit - projectedNettProfit) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {settings?.currency || '$'} {(actualNettProfit - projectedNettProfit).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50/50">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Category</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Projected</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Actual</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredBudgets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-stone-400 italic">No budget projections found for this period.</td>
                    </tr>
                  ) : (
                    <>
                      {filteredBudgets.map((budget) => {
                        const actual = getActualForCategory(budget.category);
                        const isIncome = budget.category === 'Income' || budget.category === 'Booking';
                        const variance = isIncome ? actual - budget.amount : budget.amount - actual;
                        
                        return (
                          <tr key={budget.id} className="hover:bg-stone-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-medium text-stone-900">{budget.category}</span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono">
                              {settings?.currency || '$'} {budget.amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-mono">
                              {settings?.currency || '$'} {actual.toLocaleString()}
                            </td>
                            <td className={cn(
                              "px-6 py-4 text-right font-mono font-bold",
                              variance >= 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {variance >= 0 ? '+' : ''}{settings?.currency || '$'} {variance.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-stone-50/80 font-bold border-t-2 border-stone-200">
                        <td className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-stone-500">
                          Total Projection
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-stone-900">
                          {settings?.currency || '$'} {projectedNettProfit.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-stone-900">
                          {settings?.currency || '$'} {actualNettProfit.toLocaleString()}
                        </td>
                        <td className={cn(
                          "px-6 py-4 text-right font-mono",
                          (actualNettProfit - projectedNettProfit) >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {(actualNettProfit - projectedNettProfit) >= 0 ? '+' : ''}{settings?.currency || '$'} {(actualNettProfit - projectedNettProfit).toLocaleString()}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">
                {editingEntry ? 'Edit Transaction' : 'Add Transaction'}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingEntry(null);
                  setIsCustomCategory(false);
                  setCustomCategory('');
                }}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="flex p-1 bg-stone-100 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'Income' })}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    formData.type === 'Income' ? "bg-white text-emerald-600 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  )}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'Expense' })}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    formData.type === 'Expense' ? "bg-white text-rose-600 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  )}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'Refund' })}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    formData.type === 'Refund' ? "bg-white text-amber-600 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  )}
                >
                  Refund
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Date</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Description</label>
                  <input
                    required
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="e.g. Room Service Payment"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Amount</label>
                    <input
                      required
                      type="number"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => {
                        setFormData({ ...formData, category: e.target.value });
                        setIsCustomCategory(e.target.value === 'Other');
                      }}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
                    >
                      {PREDEFINED_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="Other">Other (Custom)</option>
                    </select>
                  </div>
                </div>

                {isCustomCategory && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Custom Category Name</label>
                    <input
                      required
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="Enter custom category name..."
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="EFT">EFT</option>
                    <option value="Booking.com">Booking.com</option>
                    <option value="Lekkeslaap">Lekkeslaap</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingEntry(null);
                    setIsCustomCategory(false);
                    setCustomCategory('');
                  }}
                  className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
                >
                  {editingEntry ? 'Update Transaction' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">
                {editingBudget ? 'Edit Budget' : 'Add Budget'}
              </h3>
              <button 
                onClick={() => {
                  setIsBudgetModalOpen(false);
                  setEditingBudget(null);
                  setIsBudgetCustomCategory(false);
                  setBudgetCustomCategory('');
                }}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleBudgetSubmit} className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Month</label>
                  <select
                    value={budgetFormData.month}
                    onChange={(e) => setBudgetFormData({ ...budgetFormData, month: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
                  >
                    {monthNames.map((name, i) => (
                      <option key={name} value={i}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Year</label>
                  <input
                    required
                    type="number"
                    value={budgetFormData.year}
                    onChange={(e) => setBudgetFormData({ ...budgetFormData, year: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Category</label>
                  <select
                    value={budgetFormData.category}
                    onChange={(e) => {
                      setBudgetFormData({ ...budgetFormData, category: e.target.value });
                      setIsBudgetCustomCategory(e.target.value === 'Other');
                    }}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all appearance-none"
                  >
                    {PREDEFINED_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="Other">Other (Custom)</option>
                  </select>
                </div>

                {isBudgetCustomCategory && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Custom Category Name</label>
                    <input
                      required
                      type="text"
                      value={budgetCustomCategory}
                      onChange={(e) => setBudgetCustomCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      placeholder="Enter custom category name..."
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Allocated Amount</label>
                  <input
                    required
                    type="number"
                    value={budgetFormData.amount || ''}
                    onChange={(e) => setBudgetFormData({ ...budgetFormData, amount: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsBudgetModalOpen(false);
                    setEditingBudget(null);
                    setIsBudgetCustomCategory(false);
                    setBudgetCustomCategory('');
                  }}
                  className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
                >
                  {editingBudget ? 'Update Budget' : 'Save Budget'}
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
              <h3 className="text-xl font-serif italic text-stone-900 mb-2">Delete Transaction?</h3>
              <p className="text-stone-500 text-sm mb-8">This action cannot be undone. Are you sure you want to remove this transaction from your records?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setEntryToDelete(null);
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
      {/* Budget Delete Confirmation Modal */}
      {isBudgetDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-rose-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif italic text-stone-900 mb-2">Delete Budget?</h3>
            <p className="text-stone-500 text-sm mb-8">Are you sure you want to remove this budget entry? This will not affect your actual transactions.</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsBudgetDeleteConfirmOpen(false);
                  setBudgetToDelete(null);
                }}
                className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBudgetDelete}
                className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
