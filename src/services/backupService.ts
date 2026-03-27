import { db } from '../firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { Settings as SettingsType } from '../types';

export const createBackup = async (settings: SettingsType | null) => {
  try {
    const collections = ['rooms', 'guests', 'bookings', 'cashbook', 'staff', 'receipts', 'settings'];
    const backupData: any = {};

    for (const colName of collections) {
      const querySnapshot = await getDocs(collection(db, colName));
      backupData[colName] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    }

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    link.download = `guesthouse-backup-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Update last backup date in Firestore
    if (settings) {
      const updatedSettings = { 
        ...settings, 
        lastBackupDate: now.toISOString() 
      };
      await setDoc(doc(db, 'settings', 'general'), updatedSettings);
    }
    
    return true;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
};

export const isBackupDue = (settings: SettingsType | null): boolean => {
  if (!settings || !settings.backupFrequency || settings.backupFrequency === 'none') {
    return false;
  }

  const now = new Date();
  const backupTime = settings.backupTime || '00:00';
  const [hours, minutes] = backupTime.split(':').map(Number);
  
  const targetTimeToday = new Date(now);
  targetTimeToday.setHours(hours, minutes, 0, 0);

  if (!settings.lastBackupDate) {
    return now >= targetTimeToday;
  }

  const lastBackup = new Date(settings.lastBackupDate);
  
  // Check if we already backed up today
  const isSameDay = lastBackup.getFullYear() === now.getFullYear() &&
                    lastBackup.getMonth() === now.getMonth() &&
                    lastBackup.getDate() === now.getDate();
                    
  if (isSameDay) return false;

  const diffInMs = now.getTime() - lastBackup.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
  const isPastTimeToday = now >= targetTimeToday;

  switch (settings.backupFrequency) {
    case 'daily':
      return diffInDays >= 0.8 && isPastTimeToday; // 0.8 to handle slight variations, but mainly isPastTimeToday
    case 'weekly':
      return diffInDays >= 6.8 && isPastTimeToday;
    case 'monthly':
      return diffInDays >= 29.8 && isPastTimeToday;
    default:
      return false;
  }
};
