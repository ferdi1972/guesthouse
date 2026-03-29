import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  ArrowUpRight,
  ArrowDownRight,
  DollarSign
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area,
  Cell
} from 'recharts';
import { auth, db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { CashbookEntry, Settings, Budget } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { 
  format, 
  subDays, 
  subWeeks, 
  subMonths,
  isSameDay,
  isSameWeek,
  isSameMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval
} from 'date-fns';

interface AnalyticsProps {
  settings: Settings | null;
}

export default function Analytics({ settings }: AnalyticsProps) {
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  useEffect(() => {
    const unsubEntries = onSnapshot(collection(db, 'cashbook'), (snap) => {
      setEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashbookEntry)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'cashbook');
    });

    const unsubBudgets = onSnapshot(collection(db, 'budgets'), (snap) => {
      setBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'budgets');
    });

    return () => {
      unsubEntries();
      unsubBudgets();
    };
  }, []);

  const incomeEntries = entries.filter(e => e.type === 'Income' || e.type === 'Refund');

  // Daily Revenue (Last 7 Days)
  const dailyData = eachDayOfInterval({
    start: subDays(new Date(), 6),
    end: new Date()
  }).map(date => {
    const dayIncome = incomeEntries
      .filter(e => isSameDay(new Date(e.date), date))
      .reduce((sum, e) => {
        if (e.type === 'Income') return sum + e.amount;
        if (e.type === 'Refund') return sum - e.amount;
        return sum;
      }, 0);
    return {
      name: format(date, 'EEE'),
      amount: dayIncome,
      fullDate: format(date, 'MMM dd')
    };
  });

  // Weekly Revenue (Last 4 Weeks)
  const weeklyData = eachWeekOfInterval({
    start: subWeeks(new Date(), 3),
    end: new Date()
  }).map(date => {
    const weekIncome = incomeEntries
      .filter(e => isSameWeek(new Date(e.date), date))
      .reduce((sum, e) => {
        if (e.type === 'Income') return sum + e.amount;
        if (e.type === 'Refund') return sum - e.amount;
        return sum;
      }, 0);
    return {
      name: `Week ${format(date, 'w')}`,
      amount: weekIncome,
      fullDate: `Week of ${format(date, 'MMM dd')}`
    };
  });

  // Monthly Revenue (Last 6 Months)
  const monthlyData = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date()
  }).map(date => {
    const monthIncome = incomeEntries
      .filter(e => isSameMonth(new Date(e.date), date))
      .reduce((sum, e) => {
        if (e.type === 'Income') return sum + e.amount;
        if (e.type === 'Refund') return sum - e.amount;
        return sum;
      }, 0);
    return {
      name: format(date, 'MMM'),
      amount: monthIncome,
      fullDate: format(date, 'MMMM yyyy')
    };
  });

  const totalRevenue = incomeEntries.reduce((sum, e) => {
    if (e.type === 'Income') return sum + e.amount;
    if (e.type === 'Refund') return sum - e.amount;
    return sum;
  }, 0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const totalProjectedBudget = budgets
    .filter(b => b.month === currentMonth && b.year === currentYear && b.category !== 'Income')
    .reduce((sum, b) => sum + b.amount, 0);

  const todayRevenue = dailyData[dailyData.length - 1].amount;
  const yesterdayRevenue = dailyData[dailyData.length - 2].amount;
  const dailyGrowth = yesterdayRevenue === 0 ? 100 : ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif italic text-stone-900">Revenue Analytics</h1>
        <p className="text-stone-500 text-sm">Dynamic overview of your guesthouse performance.</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className={`text-xs font-bold flex items-center gap-1 ${dailyGrowth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {dailyGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(dailyGrowth).toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Today's Revenue</p>
          <h3 className="text-2xl font-serif font-bold text-stone-900">
            {settings?.currency || '$'} {todayRevenue.toLocaleString()}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Calendar className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Current Month</p>
          <h3 className="text-2xl font-serif font-bold text-stone-900">
            {settings?.currency || '$'} {monthlyData[monthlyData.length - 1].amount.toLocaleString()}
          </h3>
        </div>

        <div className="bg-stone-900 p-6 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center text-stone-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Total Revenue</p>
          <h3 className="text-2xl font-serif font-bold text-white">
            {settings?.currency || '$'} {totalRevenue.toLocaleString()}
          </h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center text-white">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Projected Expenses (Month)</p>
          <h3 className="text-2xl font-serif font-bold text-stone-900">
            {settings?.currency || '$'} {totalProjectedBudget.toLocaleString()}
          </h3>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Daily Bar Chart */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-serif italic text-xl text-stone-900">Daily Revenue</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Last 7 Days</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a8a29e', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a8a29e', fontSize: 12 }}
                  tickFormatter={(value) => `${settings?.currency || '$'}${value}`}
                />
                <Tooltip 
                  cursor={{ fill: '#fafaf9' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  formatter={(value: number) => [`${settings?.currency || '$'}${value.toLocaleString()}`, 'Revenue']}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#1c1917' }}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#1c1917" 
                  radius={[6, 6, 0, 0]} 
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Area Chart */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-serif italic text-xl text-stone-900">Weekly Performance</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Last 4 Weeks</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1c1917" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1c1917" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a8a29e', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a8a29e', fontSize: 12 }}
                  tickFormatter={(value) => `${settings?.currency || '$'}${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  formatter={(value: number) => [`${settings?.currency || '$'}${value.toLocaleString()}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#1c1917" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorAmount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Revenue Chart */}
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-serif italic text-xl text-stone-900">Monthly Revenue Overview</h3>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Last 6 Months</span>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a8a29e', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a8a29e', fontSize: 12 }}
                  tickFormatter={(value) => `${settings?.currency || '$'}${value}`}
                />
                <Tooltip 
                  cursor={{ fill: '#fafaf9' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  formatter={(value: number) => [`${settings?.currency || '$'}${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#1c1917" 
                  radius={[10, 10, 0, 0]} 
                  barSize={60}
                >
                  {monthlyData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index === monthlyData.length - 1 ? '#1c1917' : '#e7e5e4'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
