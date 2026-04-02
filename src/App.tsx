import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Bed, 
  CalendarDays, 
  Wallet, 
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Hotel,
  BarChart3,
  Receipt,
  MessageCircle,
  Calendar,
  LifeBuoy,
  Calculator,
  Zap,
  Package,
  Book,
  StickyNote,
  Key,
  Database,
  Building2,
  Globe,
  Palette,
  MapPin,
  ChevronDown,
  ChevronRight,
  Contact
} from 'lucide-react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDocFromServer, collection } from 'firebase/firestore';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './lib/firestore-utils';

// Components
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Guests from './components/Guests';
import Rooms from './components/Rooms';
import Bookings from './components/Bookings';
import Cashbook from './components/Cashbook';
import Analytics from './components/Analytics';
import StaffPage from './components/Staff';
import Settings from './components/Settings';
import Support from './components/Support';
import CalculatorModal from './components/CalculatorModal';
import Electricity from './components/Electricity';
import ReceiptsList from './components/ReceiptsList';
import Inventory from './components/Inventory';
import Schedule from './components/Schedule';
import Diary from './components/Diary';
import Contacts from './components/Contacts';
import StickyNotes from './components/StickyNotes';
import PasswordSafe from './components/PasswordSafe';
import BackupChecker from './components/BackupChecker';
import CheckoutAlert from './components/CheckoutAlert';
import ProfileModal from './components/ProfileModal';
import { Settings as SettingsType, UserProfile, Staff as StaffType } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('guests');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [staff, setStaff] = useState<StaffType[]>([]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<string[]>(['Operations', 'Management', 'Preferences', 'Support', 'Settings']);

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => 
      prev.includes(title) 
        ? prev.filter(t => t !== title) 
        : [...prev, title]
    );
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    }, (error) => {
      console.error('Auth state change error:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listen to general settings (Public)
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), async (snapshot) => {
      if (snapshot.exists()) {
        const generalData = snapshot.data();
        setSettings(prev => ({ ...prev, ...generalData } as SettingsType));
      } else {
        // Initialize default settings if not exists
        const defaultSettings: SettingsType = {
          companyName: 'My Guesthouse',
          address: '',
          phone: '',
          email: '',
          country: 'South Africa',
          currency: 'R',
          taxRate: 0,
          theme: 'luxury'
        };
        try {
          await setDoc(doc(db, 'settings', 'general'), defaultSettings);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'settings/general');
        }
      }
      setSettingsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/general');
    });

    // Listen to assets (Public)
    const unsubLandingImage = onSnapshot(doc(db, 'settings', 'landing_image'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(prev => ({ ...prev, landingImage: snapshot.data().landingImage } as SettingsType));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/landing_image');
    });

    const unsubSupportLogo = onSnapshot(doc(db, 'settings', 'support_logo'), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(prev => ({ ...prev, supportLogo: snapshot.data().supportLogo } as SettingsType));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/support_logo');
    });

    return () => {
      unsubSettings();
      unsubLandingImage();
      unsubSupportLogo();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    // Listen to user profile
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), async (snapshot) => {
      try {
        if (snapshot.exists()) {
          const profile = snapshot.data() as UserProfile;
          
          // Bootstrap admin upgrade
          const isAdminEmail = (email: string) => {
            const adminEmails = ['ferditviljoen@gmail.com', 'admin@qwai.co.za', 'admin@qwai-enterprises.co.za'];
            return adminEmails.includes(email) || email.startsWith('admin@qwai');
          };

          if (isAdminEmail(user.email || '') && profile.role !== 'admin') {
            await setDoc(doc(db, 'users', user.uid), { ...profile, role: 'admin' }, { merge: true });
            setUserProfile({ ...profile, role: 'admin' });
          } else {
            setUserProfile(profile);
          }
        } else {
          const isAdminEmail = (email: string) => {
            const adminEmails = ['ferditviljoen@gmail.com', 'admin@qwai.co.za', 'admin@qwai-enterprises.co.za'];
            return adminEmails.includes(email) || email.startsWith('admin@qwai');
          };

          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            role: isAdminEmail(user.email || '') ? 'admin' : 'user',
            theme: 'luxury',
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // Listen to staff
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snap) => {
      setStaff(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffType)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'staff');
    });

    return () => {
      unsubUser();
      unsubStaff();
    };
  }, [user]);

  useEffect(() => {
    if (userProfile?.role === 'landlord' && activeTab === 'dashboard') {
      setActiveTab('analytics');
    }
  }, [userProfile, activeTab]);

  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  const handleLogout = () => signOut(auth).catch(error => {
    console.error('Logout error:', error);
  });

  useEffect(() => {
    const theme = userProfile?.theme || settings?.theme || 'luxury';
    const themeClass = `theme-${theme}`;
    
    // Remove any existing theme classes
    const body = document.body;
    const themeClasses = Array.from(body.classList).filter(c => c.startsWith('theme-'));
    themeClasses.forEach(c => body.classList.remove(c));
    
    // Add new theme class
    body.classList.add(themeClass);
  }, [userProfile?.theme, settings?.theme]);

  if (loading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage 
        settings={settings} 
        onSignIn={() => setShowAuth(true)} 
        showAuth={showAuth}
        onCloseAuth={() => setShowAuth(false)}
      />
    );
  }

  const navSections = userProfile?.role === 'landlord' ? [
    {
      title: 'Management',
      items: [
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { id: 'profile', label: 'My Profile', icon: Users, onClick: () => setIsProfileModalOpen(true) },
      ]
    },
    {
      title: 'Support',
      items: [
        { id: 'support', label: 'Support', icon: LifeBuoy },
      ]
    }
  ] : [
    {
      title: 'Operations',
      items: [
        { id: 'guests', label: 'Guests', icon: Users },
        { id: 'rooms', label: 'Rooms', icon: Bed },
        { id: 'bookings', label: 'Bookings', icon: CalendarDays },
        { id: 'receipts', label: 'Receipts', icon: Receipt },
        { id: 'schedule', label: 'Schedule', icon: Calendar },
        { id: 'electricity', label: 'Electricity', icon: Zap },
        { id: 'inventory', label: 'Inventory', icon: Package },
        { id: 'calculator', label: 'Calculator', icon: Calculator, onClick: () => setIsCalculatorOpen(true) },
        { id: 'message-staff', label: 'Message', icon: MessageCircle, onClick: () => setIsStaffModalOpen(true) },
      ]
    },
    ...(userProfile?.role === 'admin' || userProfile?.role === 'manager' ? [{
      title: 'Management',
      items: [
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'staff', label: 'Staff', icon: Users },
        { id: 'cashbook', label: 'Cashbook', icon: Wallet },
        { id: 'diary', label: 'Diary', icon: Book },
        { id: 'contacts', label: 'Contacts', icon: Contact },
        { id: 'password-safe', label: 'Password Safe', icon: Key },
        { id: 'sticky-notes', label: 'Sticky Notes', icon: StickyNote },
      ]
    }] : []),
    {
      title: 'Preferences',
      items: [
        { id: 'profile', label: 'My Profile', icon: Users, onClick: () => setIsProfileModalOpen(true) },
      ]
    },
    {
      title: 'Support',
      items: [
        { id: 'support', label: 'Support', icon: LifeBuoy },
      ]
    },
    ...(userProfile?.role === 'admin' || userProfile?.role === 'manager' ? [{
      title: 'Settings',
      items: [
        { id: 'settings-backup', label: 'Backup & Restore', icon: Database },
        { id: 'settings-company', label: 'Company Info', icon: Building2 },
        { id: 'settings-landing', label: 'Landing Page', icon: Globe },
        { id: 'settings-themes', label: 'Themes', icon: Palette },
        { id: 'settings-users', label: 'User Management', icon: Users },
        { id: 'settings-regional', label: 'Regional', icon: MapPin },
        { id: 'settings-support', label: 'Support Info', icon: LifeBuoy },
      ]
    }] : [])
  ];

  const allNavItems = navSections.flatMap(section => section.items);

  return (
    <div className={cn(
      "min-h-screen flex bg-background text-primary transition-colors duration-300", 
    )}>
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 lg:relative lg:translate-x-0 shadow-xl no-print",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ backgroundColor: 'var(--sidebar-bg)', color: 'var(--sidebar-foreground)' }}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--sidebar-foreground)', color: 'var(--sidebar-bg)' }}>
              <Hotel className="w-5 h-5" />
            </div>
            <span className="font-serif italic text-xl truncate" style={{ color: 'var(--sidebar-foreground)' }}>
              {settings?.companyName || 'Manager'}
            </span>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
            {navSections.map((section) => {
              const isCollapsible = ['Operations', 'Management', 'Preferences', 'Support', 'Settings'].includes(section.title);
              const isCollapsed = isCollapsible && collapsedSections.includes(section.title);
              
              return (
                <div key={section.title} className="space-y-2">
                  <div 
                    className={cn(
                      "flex items-center justify-between px-4",
                      isCollapsible && "cursor-pointer group"
                    )}
                    onClick={() => isCollapsible && toggleSection(section.title)}
                  >
                    <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-50" style={{ color: 'var(--sidebar-foreground)' }}>
                      {section.title}
                    </h3>
                    {isCollapsible && (
                      <div className="opacity-30 group-hover:opacity-100 transition-all">
                        {isCollapsed ? (
                          <ChevronRight className="w-3 h-3" style={{ color: 'var(--sidebar-foreground)' }} />
                        ) : (
                          <ChevronDown className="w-3 h-3" style={{ color: 'var(--sidebar-foreground)' }} />
                        )}
                      </div>
                    )}
                  </div>
                  
                  {!isCollapsed && (
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            if ('onClick' in item && item.onClick) {
                              item.onClick();
                            } else {
                              setActiveTab(item.id);
                            }
                            setIsSidebarOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                            activeTab === item.id 
                              ? "shadow-inner" 
                              : "hover:opacity-80"
                          )}
                          style={{ 
                            backgroundColor: activeTab === item.id ? 'var(--sidebar-foreground)' : 'transparent',
                            color: activeTab === item.id ? 'var(--sidebar-bg)' : 'var(--sidebar-foreground)'
                          }}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="p-4 border-t" style={{ borderColor: 'rgba(var(--sidebar-foreground-rgb, 255, 255, 255), 0.1)' }}>
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-xl hover:bg-white/5 transition-all text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-500 font-bold overflow-hidden shrink-0">
                {userProfile?.photoURL ? (
                  <img src={userProfile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  userProfile?.displayName?.charAt(0) || user.email?.charAt(0)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--sidebar-foreground)' }}>{userProfile?.displayName || user.displayName}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] truncate opacity-60" style={{ color: 'var(--sidebar-foreground)' }}>{user.email}</p>
                  {userProfile && (
                    <span className="text-[8px] font-bold uppercase tracking-tighter px-1 rounded border border-current opacity-80" style={{ color: 'var(--sidebar-foreground)' }}>
                      {userProfile.role}
                    </span>
                  )}
                </div>
              </div>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:opacity-80"
              style={{ color: 'var(--sidebar-foreground)' }}
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-background border-b border-border flex items-center justify-between px-6 lg:px-8 no-print">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-primary"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <h2 className="text-lg font-serif italic text-primary">
            {allNavItems.find(i => i.id === activeTab)?.label}
          </h2>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          {activeTab === 'guests' && <Guests userProfile={userProfile} />}
          {activeTab === 'rooms' && <Rooms settings={settings} userProfile={userProfile} />}
          {activeTab === 'bookings' && <Bookings settings={settings} userProfile={userProfile} />}
          {activeTab === 'receipts' && <ReceiptsList settings={settings} userProfile={userProfile} />}
          {activeTab === 'schedule' && <Schedule />}
          {activeTab === 'electricity' && <Electricity settings={settings} />}
          {activeTab === 'inventory' && <Inventory settings={settings} userProfile={userProfile} />}
          {activeTab === 'message-staff' && <div className="text-center py-20 text-stone-400 italic">Please use the sidebar button to message.</div>}
          
          {activeTab === 'support' && <Support settings={settings} userProfile={userProfile} />}
          
          {/* Management Tabs - Admin, Manager or Landlord */}
          {(userProfile?.role === 'admin' || userProfile?.role === 'manager' || userProfile?.role === 'landlord') && (
            <>
              {activeTab === 'analytics' && <Analytics settings={settings} />}
              {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                <>
                  {activeTab === 'cashbook' && <Cashbook settings={settings} userProfile={userProfile} />}
                  {activeTab === 'diary' && <Diary settings={settings} userProfile={userProfile} />}
                  {activeTab === 'contacts' && <Contacts />}
                  {activeTab === 'password-safe' && <PasswordSafe settings={settings} userProfile={userProfile} />}
                  {activeTab === 'sticky-notes' && <StickyNotes userProfile={userProfile} />}
                  {activeTab === 'staff' && <StaffPage settings={settings} userProfile={userProfile} />}
                  {activeTab.startsWith('settings-') && (
                    <Settings 
                      settings={settings} 
                      userProfile={userProfile} 
                      activeSection={activeTab.replace('settings-', '')} 
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      <BackupChecker settings={settings} />
      <CheckoutAlert />
      
      <CalculatorModal 
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />

      {userProfile && (
        <ProfileModal 
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          userProfile={userProfile}
        />
      )}

      {/* Staff Messaging Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
              <h3 className="font-serif italic text-2xl text-stone-900">Message</h3>
              <button 
                onClick={() => setIsStaffModalOpen(false)}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {staff.length === 0 ? (
                <div className="text-center py-8 text-stone-400 italic">
                  No staff members found.
                </div>
              ) : (
                <div className="space-y-3">
                  {staff.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                      <div>
                        <p className="font-medium text-stone-900">{member.name}</p>
                        <p className="text-[10px] text-stone-400 uppercase tracking-widest">{member.role}</p>
                      </div>
                      {member.phone ? (
                        <a
                          href={`https://wa.me/${member.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-500 text-white p-2.5 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                        >
                          <MessageCircle className="w-5 h-5" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-stone-300 italic">No phone</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
