import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Search, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  AlertCircle,
  X,
  Save,
  ArrowRight,
  Filter,
  BarChart3
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, where, getDocs } from 'firebase/firestore';
import { ElectricityReading, CashbookEntry, Settings } from '../types';
import { format, startOfDay, endOfDay, subDays, isWithinInterval, parseISO } from 'date-fns';
import { handleFirestoreError, OperationType, cleanData } from '../lib/firestore-utils';
import { cn } from '../lib/utils';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area
} from 'recharts';

interface ElectricityProps {
  settings: Settings | null;
}

export default function Electricity({ settings }: ElectricityProps) {
  const [readings, setReadings] = useState<ElectricityReading[]>([]);
  const [filteredReadings, setFilteredReadings] = useState<ElectricityReading[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [readingToDelete, setReadingToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startReading: 0,
    endReading: 0,
    notes: ''
  });

  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [cashbookEntries, setCashbookEntries] = useState<CashbookEntry[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof ElectricityReading | 'revenue'; direction: 'asc' | 'desc' }>({
    key: 'date',
    direction: 'desc'
  });

  const handleOpenModal = () => {
    const latestReading = readings.length > 0 
      ? [...readings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
      : null;

    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      startReading: latestReading ? latestReading.endReading : 0,
      endReading: latestReading ? latestReading.endReading : 0,
      notes: ''
    });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const q = query(collection(db, 'electricity'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allReadings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ElectricityReading));
      setReadings(allReadings);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'electricity');
    });

    return () => unsubscribe();
  }, []);

  // Apply filters
  useEffect(() => {
    const filtered = readings.filter(reading => {
      const readingDate = new Date(reading.date);
      return isWithinInterval(readingDate, {
        start: startOfDay(new Date(dateRange.start)),
        end: endOfDay(new Date(dateRange.end))
      });
    }).sort((a, b) => {
      const aValue = a[sortConfig.key as keyof ElectricityReading];
      const bValue = b[sortConfig.key as keyof ElectricityReading];

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
    
    setFilteredReadings(filtered);
  }, [readings, dateRange]);

  // Fetch cashbook entries for the visible range to show dynamic revenue in table
  useEffect(() => {
    const start = `${dateRange.start}T00:00:00.000Z`;
    const end = `${dateRange.end}T23:59:59.999Z`;

    const q = query(
      collection(db, 'cashbook'),
      where('date', '>=', start),
      where('date', '<=', end)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashbookEntry));
      setCashbookEntries(entries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cashbook');
    });

    return () => unsubscribe();
  }, [dateRange.start, dateRange.end]);

  const getRevenueForDate = (dateStr: string) => {
    const targetDateStr = dateStr.includes('T') ? format(new Date(dateStr), 'yyyy-MM-dd') : dateStr;
    return cashbookEntries.reduce((sum, entry) => {
      const entryLocalDate = format(new Date(entry.date), 'yyyy-MM-dd');
      if (entryLocalDate === targetDateStr) {
        if (entry.type === 'Income') return sum + entry.amount;
        if (entry.type === 'Refund') return sum - entry.amount;
      }
      return sum;
    }, 0);
  };

  // Fetch revenue when date changes
  useEffect(() => {
    if (!isModalOpen) return;
    
    const fetchRevenue = async () => {
      // Use UTC range to match how dates are stored in cashbook
      const start = `${formData.date}T00:00:00.000Z`;
      const end = `${formData.date}T23:59:59.999Z`;

      const q = query(
        collection(db, 'cashbook'),
        where('date', '>=', start),
        where('date', '<=', end)
      );

      try {
        const snapshot = await getDocs(q);
        const total = snapshot.docs.reduce((sum, doc) => {
          const entry = doc.data() as CashbookEntry;
          if (entry.type === 'Income') return sum + entry.amount;
          if (entry.type === 'Refund') return sum - entry.amount;
          return sum;
        }, 0);
        setDailyRevenue(total);
      } catch (error) {
        console.error('Error fetching revenue:', error);
      }
    };

    fetchRevenue();
  }, [formData.date, isModalOpen]);

  // Auto-populate start reading based on previous reading when date changes in modal
  useEffect(() => {
    if (isModalOpen && readings.length > 0) {
      const selectedDate = startOfDay(new Date(formData.date));
      const previousReading = [...readings]
        .filter(r => startOfDay(new Date(r.date)) < selectedDate)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (previousReading) {
        setFormData(prev => ({
          ...prev,
          startReading: previousReading.endReading
        }));
      }
    }
  }, [formData.date, isModalOpen, readings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const unitsUsed = formData.endReading - formData.startReading;
    
    if (unitsUsed < 0) {
      return;
    }

    try {
      const cleanedData = cleanData({
        date: new Date(formData.date).toISOString(),
        startReading: formData.startReading,
        endReading: formData.endReading,
        unitsUsed,
        dailyRevenue,
        notes: formData.notes,
        createdAt: new Date().toISOString()
      });
      await addDoc(collection(db, 'electricity'), cleanedData);
      setIsModalOpen(false);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        startReading: 0,
        endReading: 0,
        notes: ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'electricity');
    }
  };

  const handleDelete = async () => {
    if (!readingToDelete) return;
    try {
      await deleteDoc(doc(db, 'electricity', readingToDelete));
      setIsDeleteConfirmOpen(false);
      setReadingToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `electricity/${readingToDelete}`);
    }
  };

  // Prepare chart data (chronological)
  const chartData = [...filteredReadings]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(r => {
      const revenue = getRevenueForDate(r.date) || r.dailyRevenue;
      return {
        date: format(new Date(r.date), 'MMM dd'),
        units: r.unitsUsed,
        revenue: revenue / 10 // Scaled for better visualization on same axis
      };
    });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-stone-900">Electricity Usage</h1>
          <p className="text-stone-500 text-sm">Monitor daily electricity consumption against revenue.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-stone-100 rounded-2xl px-4 py-2 shadow-sm gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-stone-400" />
              <input 
                type="date" 
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="text-xs font-medium text-stone-600 bg-transparent border-none focus:ring-0 p-0"
              />
            </div>
            <ArrowRight className="w-3 h-3 text-stone-300" />
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="text-xs font-medium text-stone-600 bg-transparent border-none focus:ring-0 p-0"
              />
            </div>
          </div>
          <div className="flex items-center bg-white border border-stone-100 rounded-2xl px-4 py-2 shadow-sm gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Sort By</label>
            <select
              value={sortConfig.key}
              onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value as any })}
              className="text-xs font-medium text-stone-600 bg-transparent border-none focus:ring-0 p-0 outline-none"
            >
              <option value="date">Date</option>
              <option value="startReading">Start Reading</option>
              <option value="endReading">End Reading</option>
              <option value="unitsUsed">Units Used</option>
              <option value="dailyRevenue">Revenue</option>
            </select>
            <button
              onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
              className="p-1 hover:bg-stone-50 rounded-lg transition-colors"
            >
              <span className="text-xs font-bold">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
            </button>
          </div>
          <button
            onClick={handleOpenModal}
            className="bg-stone-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10"
          >
            <Plus className="w-5 h-5" />
            Record Reading
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Avg. Daily Usage</p>
              <p className="text-2xl font-serif italic text-stone-900">
                {filteredReadings.length > 0 
                  ? (filteredReadings.reduce((sum, r) => sum + r.unitsUsed, 0) / filteredReadings.length).toFixed(1) 
                  : '0'} units
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Avg. Daily Revenue</p>
              <p className="text-2xl font-serif italic text-stone-900">
                {settings?.currency} {filteredReadings.length > 0 
                  ? (filteredReadings.reduce((sum, r) => sum + (getRevenueForDate(r.date) || r.dailyRevenue), 0) / filteredReadings.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-stone-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Efficiency Ratio</p>
              <p className="text-2xl font-serif italic text-stone-900">
                {filteredReadings.length > 0 && filteredReadings.reduce((sum, r) => sum + r.dailyRevenue, 0) > 0
                  ? (filteredReadings.reduce((sum, r) => sum + r.unitsUsed, 0) / (filteredReadings.reduce((sum, r) => sum + r.dailyRevenue, 0) / 100)).toFixed(2)
                  : '0'} <span className="text-xs text-stone-400 not-italic">units/100 rev</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Graph Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-xl shadow-stone-200/50">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-stone-400" />
            </div>
            <h3 className="font-serif italic text-xl text-stone-900">Usage vs Revenue Overview</h3>
          </div>
          <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-stone-400">Units Used</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-stone-400">Revenue (scaled)</span>
            </div>
          </div>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#a8a29e', fontSize: 10, fontWeight: 600 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#a8a29e', fontSize: 10, fontWeight: 600 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  borderRadius: '1rem', 
                  border: '1px solid #f1f1f1',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="units" 
                stroke="#f59e0b" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorUnits)" 
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Readings Table */}
      <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-xl shadow-stone-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-100">
                <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Date</th>
                <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Readings (Start → End)</th>
                <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Units Used</th>
                <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Daily Revenue</th>
                <th className="px-8 py-5 text-left text-[10px] font-bold uppercase tracking-widest text-stone-400">Efficiency</th>
                <th className="px-8 py-5 text-right text-[10px] font-bold uppercase tracking-widest text-stone-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredReadings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-stone-400 italic">
                    No electricity readings found for this period.
                  </td>
                </tr>
              ) : (
                filteredReadings.map((reading) => {
                  const revenue = getRevenueForDate(reading.date) || reading.dailyRevenue;
                  const efficiency = revenue > 0 ? (reading.unitsUsed / (revenue / 100)) : 0;
                  return (
                    <tr key={reading.id} className="group hover:bg-stone-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-500">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <span className="font-medium text-stone-900">{format(new Date(reading.date), 'MMM dd, yyyy')}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2 text-stone-600 font-mono text-sm">
                          <span>{reading.startReading}</span>
                          <ArrowRight className="w-3 h-3 text-stone-300" />
                          <span>{reading.endReading}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="inline-flex items-center px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold">
                          {reading.unitsUsed} units
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="font-medium text-stone-900">
                          {settings?.currency} {revenue.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 w-16 bg-stone-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                efficiency > 5 ? "bg-rose-500" : efficiency > 3 ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(efficiency * 10, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-stone-400">{efficiency.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button
                          onClick={() => {
                            setReadingToDelete(reading.id);
                            setIsDeleteConfirmOpen(true);
                          }}
                          className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Reading Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-serif italic text-2xl text-stone-900">Record Reading</h3>
                  <p className="text-stone-500 text-xs">Enter daily meter readings</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar">
              <form onSubmit={(e) => handleSubmit(e).catch(() => {})} className="p-8 space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Reading Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Start Reading</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={formData.startReading || ''}
                        onChange={(e) => setFormData({ ...formData, startReading: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:ring-2 focus:ring-stone-900 outline-none transition-all font-mono"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">End Reading</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        value={formData.endReading || ''}
                        onChange={(e) => setFormData({ ...formData, endReading: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:ring-2 focus:ring-stone-900 outline-none transition-all font-mono"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Daily Revenue</p>
                      <p className="text-xl font-serif italic text-emerald-900">
                        {settings?.currency} {dailyRevenue.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Units to be Used</p>
                      <p className={cn(
                        "text-xl font-serif italic",
                        formData.endReading - formData.startReading < 0 ? "text-rose-600" : "text-emerald-900"
                      )}>
                        {Math.max(0, formData.endReading - formData.startReading)} units
                      </p>
                    </div>
                  </div>

                  {formData.endReading - formData.startReading < 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs">
                      <AlertCircle className="w-4 h-4" />
                      End reading cannot be less than start reading
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Notes (Optional)</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl focus:ring-2 focus:ring-stone-900 outline-none transition-all min-h-[100px] resize-none"
                      placeholder="Any observations..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-900/20"
                  >
                    <Save className="w-5 h-5" />
                    Save Reading
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-8 text-center overflow-y-auto custom-scrollbar">
              <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 flex-shrink-0">
                <AlertCircle className="w-10 h-10 text-rose-600" />
              </div>
              <h2 className="text-2xl font-serif italic text-stone-900 mb-2">Delete Reading?</h2>
              <p className="text-stone-500 mb-8">
                Are you sure you want to delete this reading? This action cannot be undone.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleDelete().catch(() => {})}
                  className="w-full bg-rose-600 text-white py-4 rounded-2xl font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-200"
                >
                  <Trash2 className="w-5 h-5" />
                  Yes, Delete Reading
                </button>
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="w-full bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold hover:bg-stone-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
