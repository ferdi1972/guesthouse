import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Globe,
  DollarSign,
  Percent,
  Palette,
  Download,
  Database,
  Upload,
  AlertTriangle,
  Trash2,
  Calendar,
  Clock,
  FileSpreadsheet,
  Users,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, setDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { Settings as SettingsType, AppTheme, BackupFrequency, UserProfile } from '../types';
import { createBackup } from '../services/backupService';
import { exportToExcel } from '../services/excelService';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

const COUNTRIES = [
  { name: 'South Africa', currency: 'R' },
  { name: 'United States', currency: '$' },
  { name: 'United Kingdom', currency: '£' },
  { name: 'European Union', currency: '€' },
  { name: 'Australia', currency: '$' },
  { name: 'Canada', currency: '$' },
  { name: 'India', currency: '₹' },
  { name: 'Japan', currency: '¥' },
  { name: 'Other', currency: '' }
];

const THEMES: { id: AppTheme; label: string }[] = [
  { id: 'luxury', label: 'Luxury' },
  { id: 'black-white', label: 'Classic Luxury' },
  { id: 'bright-orange', label: 'Bright Orange' },
  { id: 'bright-green', label: 'Bright Green' },
  { id: 'rosewood', label: 'Rosewood' },
  { id: 'light-blue', label: 'Light Blue' }
];

interface SettingsProps {
  settings: SettingsType | null;
  userProfile: UserProfile | null;
  activeSection?: string;
}

export default function Settings({ settings, userProfile, activeSection }: SettingsProps) {
  const [formData, setFormData] = useState<SettingsType>({
    companyName: settings?.companyName || '',
    address: settings?.address || '',
    phone: settings?.phone || '+27',
    email: settings?.email || '',
    country: settings?.country || 'South Africa',
    currency: settings?.currency || 'R',
    taxRate: settings?.taxRate || 0,
    theme: settings?.theme || 'luxury',
    backupFrequency: settings?.backupFrequency || 'none',
    backupTime: settings?.backupTime || '00:00',
    lastBackupDate: settings?.lastBackupDate || '',
    supportName: settings?.supportName || '',
    supportCompany: settings?.supportCompany || '',
    supportPhone: settings?.supportPhone || '',
    supportEmail: settings?.supportEmail || '',
    supportLogo: settings?.supportLogo || '',
    landingTitle: settings?.landingTitle || '',
    landingDescription: settings?.landingDescription || '',
    landingImage: settings?.landingImage || '',
    landingButtonText: settings?.landingButtonText || ''
  });
  const [personalTheme, setPersonalTheme] = useState<AppTheme>(userProfile?.theme || settings?.theme || 'luxury');

  useEffect(() => {
    if (userProfile?.theme) {
      setPersonalTheme(userProfile.theme);
    }
  }, [userProfile?.theme]);

  useEffect(() => {
    if (settings) {
      setFormData(prev => ({
        ...prev,
        ...settings
      }));
    }
  }, [settings]);

  const [isSaving, setIsSaving] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  const [isFactoryResetting, setIsFactoryResetting] = useState(false);
  const [showFactoryResetConfirm, setShowFactoryResetConfirm] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchUsers();
    }
  }, [userProfile]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      setUsers(querySnapshot.docs.map(doc => doc.data() as UserProfile));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: UserProfile['role']) => {
    try {
      await setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true });
      setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
      alert('User role updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      setUsers(users.filter(u => u.uid !== uid));
      alert('User deleted successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('Logo must be smaller than 1MB');
      return;
    }

    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData({ ...formData, supportLogo: event.target?.result as string });
      setIsUploadingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  const handleLandingImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Landing image must be smaller than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData({ ...formData, landingImage: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleFactoryReset = async () => {
    setIsFactoryResetting(true);
    setRestoreProgress('Starting factory reset...');
    try {
      const collections = [
        'rooms', 
        'guests', 
        'bookings', 
        'cashbook', 
        'staff', 
        'receipts', 
        'settings', 
        'users',
        'stickyNotes',
        'diary',
        'passwordSafe',
        'inventory',
        'electricity',
        'budgets',
        'backups'
      ];
      
      for (const colName of collections) {
        setRestoreProgress(`Clearing ${colName}...`);
        let querySnapshot;
        try {
          querySnapshot = await getDocs(collection(db, colName));
        } catch (error) {
          // Some collections might not exist yet, skip them
          continue;
        }
        
        const docs = querySnapshot.docs;
        if (docs.length === 0) continue;

        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          
          chunk.forEach((docSnap) => {
            // We delete everything including the current user for a true factory reset
            batch.delete(docSnap.ref);
          });
          
          try {
            await batch.commit();
          } catch (error) {
            console.error(`Error deleting batch in ${colName}:`, error);
          }
        }
      }

      setRestoreProgress('Factory reset complete!');
      alert('The application has been hard reset. All data and users have been cleared. You will be logged out.');
      await auth.signOut();
      window.location.reload();
    } catch (error) {
      console.error('Error during factory reset:', error);
      alert('Failed to perform factory reset. Please try again.');
    } finally {
      setIsFactoryResetting(false);
      setShowFactoryResetConfirm(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      await createBackup(formData);
    } catch (error) {
      console.error('Error creating backup:', error);
      alert('Failed to create backup. Please try again.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await exportToExcel();
    } catch (error) {
      console.error('Excel export failed:', error);
      alert('Excel export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);

  const handleRestore = async (file: File) => {
    setIsRestoring(true);
    setRestoreProgress('Reading backup file...');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const backupData = JSON.parse(event.target?.result as string);
          const collections = Object.keys(backupData);
          
          let totalDocs = 0;
          collections.forEach(col => totalDocs += backupData[col].length);
          
          let processedDocs = 0;

          for (const colName of collections) {
            setRestoreProgress(`Restoring ${colName}...`);
            const docs = backupData[colName];
            
            // Firestore batches are limited to 500 operations
            for (let i = 0; i < docs.length; i += 500) {
              const batch = writeBatch(db);
              const chunk = docs.slice(i, i + 500);
              
              chunk.forEach((docData: any) => {
                const { id, ...data } = docData;
                const docRef = doc(db, colName, id);
                batch.set(docRef, data);
                processedDocs++;
              });
              
              await batch.commit();
              setRestoreProgress(`Restored ${processedDocs} of ${totalDocs} records...`);
            }
          }

          setRestoreProgress('Restore complete!');
          alert('Data restored successfully! The page will now reload to apply changes.');
          window.location.reload();
        } catch (error) {
          console.error('Error parsing or saving backup data:', error);
          alert('Failed to restore data. The file might be corrupted or in an invalid format.');
          setIsRestoring(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading the backup file.');
      setIsRestoring(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingRestoreFile(file);
    setShowRestoreConfirm(true);
    e.target.value = '';
  };

  const handleCountryChange = (countryName: string) => {
    const country = COUNTRIES.find(c => c.name === countryName);
    if (country && country.name !== 'Other') {
      setFormData({ 
        ...formData, 
        country: countryName, 
        currency: country.currency 
      });
    } else {
      setFormData({ ...formData, country: countryName });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // 1. Save global settings if admin/manager
      if (userProfile?.role === 'admin' || userProfile?.role === 'manager') {
        const { landingImage, supportLogo, ...generalData } = formData;
        
        // Save general settings
        await setDoc(doc(db, 'settings', 'general'), generalData);
        
        // Save assets separately to avoid document size limits
        await setDoc(doc(db, 'settings', 'landing_image'), { landingImage: landingImage || '' });
        await setDoc(doc(db, 'settings', 'support_logo'), { supportLogo: supportLogo || '' });
      }
      
      // 2. Save individual user theme preference
      if (userProfile?.uid) {
        await setDoc(doc(db, 'users', userProfile.uid), {
          ...userProfile,
          theme: personalTheme
        });
      }
      
      alert('Settings saved successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/general');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif italic text-primary">
            {activeSection ? activeSection.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Settings'}
          </h1>
          <p className="text-muted-foreground text-sm">Configure your guesthouse information and preferences.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Data Management */}
        {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (activeSection === 'backup' || !activeSection) && (
          <div className="bg-background rounded-3xl border border-border shadow-sm overflow-hidden">
            <div 
              className="p-6 border-b border-border bg-accent/50 flex items-center justify-between cursor-pointer hover:bg-accent/70 transition-colors"
              onClick={() => toggleSection('backup-restore')}
            >
              <h3 className="font-serif italic text-xl text-primary flex items-center gap-2">
                <Database className="w-5 h-5 text-muted-foreground" /> Data Backup & Restore
              </h3>
              {collapsedSections['backup-restore'] ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
            </div>
            {!collapsedSections['backup-restore'] && (
              <div className="p-8 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Backup */}
                <div className="flex flex-col items-start justify-between gap-4 p-6 bg-accent/20 rounded-2xl border border-border/50">
                  <div className="space-y-1">
                    <h4 className="font-bold text-primary flex items-center gap-2">
                      <Download className="w-4 h-4" /> Backup Data
                    </h4>
                    <p className="text-xs text-muted-foreground">Download a complete copy of your guesthouse data in JSON format.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackup}
                    disabled={isBackingUp || isRestoring}
                    className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {isBackingUp ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {isBackingUp ? 'Creating Backup...' : 'Download Backup'}
                  </button>
                </div>

                {/* Restore */}
                <div className="flex flex-col items-start justify-between gap-4 p-6 bg-rose-50/30 rounded-2xl border border-rose-100/50">
                  <div className="space-y-1">
                    <h4 className="font-bold text-rose-900 flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Restore Data
                    </h4>
                    <p className="text-xs text-rose-600/70">Upload a previously downloaded backup file to restore your data.</p>
                  </div>
                  <div className="w-full relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={onFileChange}
                      disabled={isBackingUp || isRestoring}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={isBackingUp || isRestoring}
                      className="w-full bg-rose-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                      {isRestoring ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {isRestoring ? 'Restoring...' : 'Restore from File'}
                    </button>
                  </div>
                </div>

                {/* Excel Export */}
                <div className="flex flex-col items-start justify-between gap-4 p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100/50">
                  <div className="space-y-1">
                    <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" /> Excel Export
                    </h4>
                    <p className="text-xs text-emerald-600/70">Export all guesthouse data to a multi-sheet Excel spreadsheet.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={isExporting || isBackingUp || isRestoring}
                    className="w-full bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {isExporting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4" />
                    )}
                    {isExporting ? 'Exporting...' : 'Export to Excel'}
                  </button>
                </div>
              </div>

              {/* Factory Reset */}
              <div className="mt-6 p-6 bg-rose-50 rounded-2xl border border-rose-200">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-rose-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Factory Reset
                    </h4>
                    <p className="text-xs text-rose-600">Hard reset the application. This will permanently delete ALL data, settings, and user profiles. You will be logged out.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFactoryResetConfirm(true)}
                    disabled={isBackingUp || isRestoring || isFactoryResetting}
                    className="bg-rose-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Factory Reset
                  </button>
                </div>
              </div>

              {(isRestoring || isFactoryResetting) && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <p className="text-sm font-medium text-amber-900">{restoreProgress}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

        {/* Backup Scheduling */}
        {(activeSection === 'backup' || !activeSection) && (
          <div className="bg-background rounded-3xl border border-border shadow-sm overflow-hidden">
            <div 
              className="p-6 border-b border-border bg-accent/50 flex items-center justify-between cursor-pointer hover:bg-accent/70 transition-colors"
              onClick={() => toggleSection('backup-scheduling')}
            >
              <h3 className="font-serif italic text-xl text-primary flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" /> Backup Scheduling
              </h3>
              {collapsedSections['backup-scheduling'] ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
            </div>
            {!collapsedSections['backup-scheduling'] && (
              <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Backup Frequency</label>
              <select
                value={formData.backupFrequency || 'none'}
                onChange={(e) => setFormData({ ...formData, backupFrequency: e.target.value as BackupFrequency })}
                className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
              >
                <option value="none">Manual Only</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <p className="text-[10px] text-muted-foreground italic ml-1">
                The app will prompt you to download a backup when it is due.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Preferred Time</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="time"
                  value={formData.backupTime || '00:00'}
                  onChange={(e) => setFormData({ ...formData, backupTime: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                />
              </div>
              <p className="text-[10px] text-muted-foreground italic ml-1">
                Time of day to perform the scheduled backup.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Last Backup Date</label>
              <div className="px-4 py-3 bg-accent/10 border border-border rounded-xl text-sm font-mono text-primary">
                  {formData.lastBackupDate 
                    ? new Date(formData.lastBackupDate).toLocaleString() 
                    : 'Never'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

        {/* Factory Reset Confirmation Modal */}
        {showFactoryResetConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-10 h-10 text-rose-600" />
                </div>
                <h2 className="text-2xl font-serif italic text-primary mb-2">Factory Reset?</h2>
                <p className="text-muted-foreground mb-8">
                  This is a <strong>hard reset</strong>. It will permanently delete ALL bookings, guests, rooms, financial records, settings, and <strong>all user profiles</strong>.
                  <span className="block mt-2 font-bold text-destructive uppercase text-xs tracking-widest">This action is irreversible and you will be logged out.</span>
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleFactoryReset}
                    disabled={isFactoryResetting}
                    className="w-full bg-rose-600 text-white py-4 rounded-2xl font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-200 disabled:opacity-50"
                  >
                    {isFactoryResetting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                    {isFactoryResetting ? 'Resetting App...' : 'Yes, Factory Reset'}
                  </button>
                  <button
                    onClick={() => setShowFactoryResetConfirm(false)}
                    disabled={isFactoryResetting}
                    className="w-full bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold hover:bg-stone-200 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Restore Data Confirmation Modal */}
        {showRestoreConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-10 h-10 text-amber-600" />
                </div>
                <h2 className="text-2xl font-serif italic text-primary mb-2">Restore Data?</h2>
                <p className="text-muted-foreground mb-8">
                  WARNING: Restoring data will overwrite existing records with the same IDs. This action cannot be undone.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      if (pendingRestoreFile) handleRestore(pendingRestoreFile);
                      setShowRestoreConfirm(false);
                    }}
                    className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Upload className="w-5 h-5" />
                    Yes, Restore Data
                  </button>
                  <button
                    onClick={() => {
                      setShowRestoreConfirm(false);
                      setPendingRestoreFile(null);
                    }}
                    className="w-full bg-accent text-accent-foreground py-4 rounded-2xl font-bold hover:bg-accent/80 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Company Info */}
        {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (activeSection === 'company' || !activeSection) && (
          <div className="bg-background rounded-3xl border border-border shadow-sm overflow-hidden">
            <div 
              className="p-6 border-b border-border bg-accent/50 flex items-center justify-between cursor-pointer hover:bg-accent/70 transition-colors"
              onClick={() => toggleSection('company-info')}
            >
              <h3 className="font-serif italic text-xl text-primary flex items-center gap-2">
                <Building2 className="w-5 h-5 text-muted-foreground" /> Company Information
              </h3>
              {collapsedSections['company-info'] ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
            </div>
            {!collapsedSections['company-info'] && (
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Guesthouse Name</label>
                <input
                  required
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                  placeholder="e.g. Seaside Retreat"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Country</label>
                <select
                  value={formData.country || ''}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                >
                  <option value="" disabled>Select a country</option>
                  {COUNTRIES.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="contact@guesthouse.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Physical Address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 w-4 h-4 text-muted-foreground" />
                  <textarea
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all min-h-[100px] resize-none"
                    placeholder="123 Ocean View Drive..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

        {/* Landing Page Settings */}
        {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (activeSection === 'landing' || !activeSection) && (
          <div className="bg-background rounded-3xl border border-border shadow-sm overflow-hidden">
            <div 
              className="p-6 border-b border-border bg-accent/50 flex items-center justify-between cursor-pointer hover:bg-accent/70 transition-colors"
              onClick={() => toggleSection('landing-page')}
            >
              <h3 className="font-serif italic text-xl text-primary flex items-center gap-2">
                <Globe className="w-5 h-5 text-muted-foreground" /> Landing Page Customization
              </h3>
              {collapsedSections['landing-page'] ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
            </div>
            {!collapsedSections['landing-page'] && (
              <div className="p-8 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Landing Page Title</label>
                  <input
                    type="text"
                    value={formData.landingTitle || ''}
                    onChange={(e) => setFormData({ ...formData, landingTitle: e.target.value })}
                    className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="e.g. Welcome to Stay@Edison"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Button Text</label>
                  <input
                    type="text"
                    value={formData.landingButtonText || ''}
                    onChange={(e) => setFormData({ ...formData, landingButtonText: e.target.value })}
                    className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="e.g. Sign In to Manager"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Landing Page Description</label>
                  <textarea
                    value={formData.landingDescription || ''}
                    onChange={(e) => setFormData({ ...formData, landingDescription: e.target.value })}
                    className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all min-h-[100px] resize-none"
                    placeholder="Describe your guesthouse..."
                  />
                </div>
                <div className="md:col-span-2 space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Hero Background Image</label>
                  <div className="flex items-start gap-6">
                    <div className="w-48 h-32 rounded-2xl bg-accent/30 border border-border overflow-hidden shrink-0 relative group">
                      {formData.landingImage ? (
                        <img 
                          src={formData.landingImage} 
                          alt="Landing Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Globe className="w-8 h-8 opacity-20" />
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <Upload className="w-6 h-6 text-white" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLandingImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-muted-foreground">Upload a high-quality image for your landing page background.</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Recommended: 1920x1080px, Max 2MB</p>
                      {formData.landingImage && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, landingImage: '' })}
                          className="text-xs font-bold text-destructive hover:text-destructive/80 uppercase tracking-widest"
                        >
                          Remove Image
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

        {/* Preferences */}
        {(activeSection === 'themes' || !activeSection) && (
          <div className="bg-background rounded-3xl border border-border shadow-sm overflow-hidden">
            <div 
              className="p-6 border-b border-border bg-accent/50 flex items-center justify-between cursor-pointer hover:bg-accent/70 transition-colors"
              onClick={() => toggleSection('themes')}
            >
              <h3 className="font-serif italic text-xl text-primary flex items-center gap-2">
                <Palette className="w-5 h-5 text-muted-foreground" /> Theme & Appearance
              </h3>
              {collapsedSections['themes'] ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
            </div>
            {!collapsedSections['themes'] && (
              <div className="p-8 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">My Personal Theme</label>
                <select
                  value={personalTheme}
                  onChange={(e) => setPersonalTheme(e.target.value as AppTheme)}
                  className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                >
                  {THEMES.map(theme => (
                    <option key={theme.id} value={theme.id}>{theme.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground italic ml-1">This theme only applies to your account.</p>
              </div>

              {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Default System Theme</label>
                  <select
                    value={formData.theme || 'black-white'}
                    onChange={(e) => setFormData({ ...formData, theme: e.target.value as AppTheme })}
                    className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                  >
                    {THEMES.map(theme => (
                      <option key={theme.id} value={theme.id}>{theme.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground italic ml-1">The default theme for users who haven't set a preference.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )}

        {/* User Management */}
        {userProfile?.role === 'admin' && (activeSection === 'users' || !activeSection) && (
          <div className="bg-background rounded-3xl border border-border shadow-sm overflow-hidden">
            <div 
              className="p-6 border-b border-border bg-accent/50 flex items-center justify-between cursor-pointer hover:bg-accent/70 transition-colors"
              onClick={() => toggleSection('users')}
            >
              <h3 className="font-serif italic text-xl text-primary flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" /> User Management
              </h3>
              <div className="flex items-center gap-4">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchUsers();
                  }}
                  className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-70"
                >
                  Refresh
                </button>
                {collapsedSections['users'] ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
              </div>
            </div>
            {!collapsedSections['users'] && (
              <div className="p-8 animate-in fade-in slide-in-from-top-2 duration-300">
                {isLoadingUsers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">User</th>
                        <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</th>
                        <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Role</th>
                        <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Change Role</th>
                        <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map((u) => (
                        <tr key={u.uid} className="group hover:bg-accent/5">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center overflow-hidden">
                                {u.photoURL ? (
                                  <img src={u.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <Users className="w-4 h-4 text-stone-400" />
                                )}
                              </div>
                              <span className="font-medium text-primary">{u.displayName}</span>
                            </div>
                          </td>
                          <td className="py-4 text-sm text-muted-foreground">{u.email}</td>
                          <td className="py-4">
                            <span className="text-[10px] font-bold uppercase tracking-tighter px-2 py-1 rounded border border-border bg-accent/30">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.uid, e.target.value as UserProfile['role'])}
                              disabled={u.uid === userProfile.uid}
                              className="text-xs px-3 py-2 bg-accent/30 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none transition-all disabled:opacity-50"
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Manager</option>
                              <option value="staff">Staff</option>
                              <option value="user">User</option>
                              <option value="landlord">Landlord</option>
                            </select>
                          </td>
                          <td className="py-4 text-right">
                            {u.uid !== userProfile.uid && (
                              <button
                                onClick={() => handleDeleteUser(u.uid)}
                                className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

        {/* Regional & Financial */}
        {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (activeSection === 'regional' || !activeSection) && (
          <div className="bg-background rounded-3xl border border-border shadow-sm overflow-hidden">
            <div 
              className="p-6 border-b border-border bg-accent/50 flex items-center justify-between cursor-pointer hover:bg-accent/70 transition-colors"
              onClick={() => toggleSection('regional')}
            >
              <h3 className="font-serif italic text-xl text-primary flex items-center gap-2">
                <Globe className="w-5 h-5 text-muted-foreground" /> Regional & Financial
              </h3>
              {collapsedSections['regional'] ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
            </div>
            {!collapsedSections['regional'] && (
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Currency Symbol</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full pl-11 pr-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="USD, €, R, etc."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tax Rate (%)</label>
                <div className="relative">
                  <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="number"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                    className="w-full pl-11 pr-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

        {/* Support Information */}
        {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (activeSection === 'support' || !activeSection) && (
          <div className="bg-background rounded-3xl border border-border shadow-sm overflow-hidden">
            <div 
              className="p-6 border-b border-border bg-accent/50 flex items-center justify-between cursor-pointer hover:bg-accent/70 transition-colors"
              onClick={() => toggleSection('support')}
            >
              <h3 className="font-serif italic text-xl text-primary flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" /> Support Information
              </h3>
              {collapsedSections['support'] ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronUp className="w-5 h-5 text-muted-foreground" />}
            </div>
            {!collapsedSections['support'] && (
              <div className="p-8 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-1/3 space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Support Logo</label>
                  <div className="relative group">
                    <div className="w-full aspect-square rounded-2xl bg-accent/30 border-2 border-dashed border-border flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-primary/50">
                      {formData.supportLogo ? (
                        <img src={formData.supportLogo} alt="Support Logo" className="w-full h-full object-contain p-4" />
                      ) : (
                        <div className="text-center p-4">
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-[10px] text-muted-foreground font-medium">Upload Logo</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    {formData.supportLogo && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, supportLogo: '' })}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-700 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground italic text-center">Recommended: Square PNG or SVG, max 1MB.</p>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Developer Name</label>
                    <input
                      type="text"
                      value={formData.supportName || ''}
                      onChange={(e) => setFormData({ ...formData, supportName: e.target.value })}
                      className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Support Company</label>
                    <input
                      type="text"
                      value={formData.supportCompany || ''}
                      onChange={(e) => setFormData({ ...formData, supportCompany: e.target.value })}
                      className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                      placeholder="e.g. Tech Solutions Ltd"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Support Phone</label>
                    <input
                      type="tel"
                      value={formData.supportPhone || ''}
                      onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                      className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                      placeholder="+27 12 345 6789"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Support Email</label>
                    <input
                      type="email"
                      value={formData.supportEmail || ''}
                      onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                      className="w-full px-4 py-3 bg-accent/30 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                      placeholder="support@techsolutions.com"
                    />
                  </div>
                </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-primary text-primary-foreground px-10 py-4 rounded-2xl font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {userProfile?.role === 'admin' || userProfile?.role === 'manager' ? 'Save All Settings' : 'Save Theme Preference'}
          </button>
        </div>
      </form>
    </div>
  );
}
