import React from 'react';
import { 
  Book, 
  LayoutDashboard, 
  Users, 
  Bed, 
  CalendarDays, 
  Receipt, 
  Calendar, 
  Zap, 
  Package, 
  BarChart3, 
  Wallet, 
  StickyNote, 
  Key, 
  Database, 
  Building2, 
  Palette, 
  ShieldCheck,
  Info,
  CheckCircle2,
  HelpCircle,
  Bell,
  Contact,
  Calculator
} from 'lucide-react';
import { motion } from 'motion/react';

export default function UserManual() {
  const sections = [
    {
      title: "Getting Started",
      icon: Info,
      content: "Welcome to your Guesthouse Management System. This platform is designed to streamline your daily operations, from guest check-ins to financial reporting. Use the sidebar to navigate between different modules."
    },
    {
      title: "Operations",
      icon: LayoutDashboard,
      items: [
        {
          title: "Dashboard",
          icon: LayoutDashboard,
          description: "Your central hub. View quick stats, today's arrivals, departures, and current room occupancy at a glance. It provides a real-time overview of your business."
        },
        {
          title: "Guest Management",
          icon: Users,
          description: "Maintain a comprehensive database of your guests. Track contact details, ID numbers, and vehicle registrations. You can also blacklist problematic guests to prevent future bookings."
        },
        {
          title: "Room Management",
          icon: Bed,
          description: "Configure your rooms, set different rates (Single, Double, Weekend, Hourly), and monitor their current status (Available, Occupied, Cleaning, Maintenance)."
        },
        {
          title: "Bookings",
          icon: CalendarDays,
          description: "The core of the system. Create new bookings, manage check-ins/outs, and track payments. Supports both internal and external (iCal) booking sources like Booking.com."
        },
        {
          title: "Receipts",
          icon: Receipt,
          description: "Generate professional receipts for your guests. Track payment history, manage balances, and print or save receipts as PDF/Image."
        },
        {
          title: "Schedule & Calendar",
          icon: Calendar,
          description: "A visual representation of your bookings. Color-coded for easy identification: Green for confirmed bookings, Blue for check-ins, etc. Helps in planning room availability."
        },
        {
          title: "Electricity Tracking",
          icon: Zap,
          description: "Monitor electricity usage and revenue. Record daily readings to track consumption and associated costs for your property."
        },
        {
          title: "Inventory",
          icon: Package,
          description: "Keep track of items in each room. Manage quantities and ensure your rooms are always fully equipped for guests."
        },
        {
          title: "Calculator",
          icon: Calculator,
          description: "A built-in calculator for quick financial computations without leaving the application."
        }
      ]
    },
    {
      title: "Management Tools",
      icon: ShieldCheck,
      items: [
        {
          title: "Analytics",
          icon: BarChart3,
          description: "Detailed financial and operational reports. View revenue trends, occupancy rates, and category-wise expenses to make informed decisions."
        },
        {
          title: "Staff & User Management",
          icon: Users,
          description: "Manage your team and system users. Assign roles (Admin, Manager, Staff, Landlord) to control access levels and track staff commissions."
        },
        {
          title: "Cashbook",
          icon: Wallet,
          description: "Track all income and expenses. Categorize transactions for better financial oversight and budgeting. Essential for tax and accounting purposes."
        },
        {
          title: "Diary & Reminders",
          icon: Book,
          description: "Keep a daily log of events and set important reminders for tasks or upcoming events. Never miss a critical deadline again."
        },
        {
          title: "Contacts",
          icon: Contact,
          description: "Store important business contacts, suppliers, and service providers in one organized location."
        },
        {
          title: "Password Safe",
          icon: Key,
          description: "Securely store important credentials and URLs related to your business operations. Encrypted for your security."
        },
        {
          title: "Sticky Notes",
          icon: StickyNote,
          description: "Quick digital notes for temporary information or shared reminders among staff. Perfect for handovers."
        }
      ]
    },
    {
      title: "Settings & Configuration",
      icon: Building2,
      items: [
        {
          title: "Company Info",
          icon: Building2,
          description: "Update your guesthouse details, contact information, tax rates, and currency settings."
        },
        {
          title: "Themes",
          icon: Palette,
          description: "Personalize the look and feel of the application with various professional themes to suit your brand."
        },
        {
          title: "User Management",
          icon: Users,
          description: "Invite new users, update profiles, and manage permissions for everyone accessing the system."
        },
        {
          title: "Backup & Restore",
          icon: Database,
          description: "Ensure your data is safe. Configure automated backups and restore from previous versions if necessary. Peace of mind for your business data."
        }
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-12 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-block p-4 bg-stone-100 rounded-[2rem] shadow-inner mb-6"
        >
          <Book className="w-10 h-10 text-stone-600" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-serif italic text-stone-900 mb-4"
        >
          User Manual
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-stone-500 max-w-2xl mx-auto text-lg"
        >
          Master your Guesthouse Management System. This guide provides a comprehensive overview 
          of every module and feature available to you.
        </motion.p>
      </div>

      <div className="space-y-16">
        {sections.map((section, idx) => (
          <motion.section 
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4 border-b border-stone-100 pb-4">
              <div className="p-2 bg-stone-900 text-white rounded-xl">
                <section.icon className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-serif text-stone-800">{section.title}</h2>
            </div>

            {section.content && (
              <div className="bg-stone-50 p-8 rounded-[2.5rem] border border-stone-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <CheckCircle2 className="w-24 h-24" />
                </div>
                <p className="text-stone-600 leading-relaxed text-lg relative z-10">
                  {section.content}
                </p>
              </div>
            )}

            {section.items && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {section.items.map((item) => (
                  <div 
                    key={item.title}
                    className="p-8 bg-white rounded-[2rem] border border-stone-100 shadow-sm hover:shadow-xl hover:shadow-stone-200/50 transition-all duration-300 space-y-4 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-stone-50 rounded-2xl group-hover:bg-stone-900 group-hover:text-white transition-colors">
                        <item.icon className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-xl text-stone-900">{item.title}</h3>
                    </div>
                    <p className="text-stone-500 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-20 p-12 bg-stone-900 text-white rounded-[3rem] text-center space-y-6 shadow-2xl shadow-stone-900/20"
      >
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto">
          <HelpCircle className="w-8 h-8 text-stone-300" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-serif italic">Still have questions?</h2>
          <p className="text-stone-400 max-w-md mx-auto text-lg">
            Our support team is ready to help you with any technical issues or custom requests.
          </p>
        </div>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'support' }))}
          className="px-10 py-4 bg-white text-stone-900 rounded-2xl font-bold hover:bg-stone-100 transition-all transform hover:scale-105 active:scale-95 shadow-lg"
        >
          Contact Support
        </button>
      </motion.div>

      <div className="mt-20 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-300">
          User Manual • Version 1.0 • 2026
        </p>
      </div>
    </div>
  );
}
