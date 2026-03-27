import React, { useState, useEffect } from 'react';
import { AlertTriangle, Download, X } from 'lucide-react';
import { Settings as SettingsType } from '../types';
import { isBackupDue, createBackup } from '../services/backupService';

interface BackupCheckerProps {
  settings: SettingsType | null;
}

export default function BackupChecker({ settings }: BackupCheckerProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    const checkBackup = () => {
      if (isBackupDue(settings)) {
        setShowPrompt(true);
      }
    };

    checkBackup();
    const interval = setInterval(checkBackup, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [settings]);

  const handleRunBackup = async () => {
    setIsBackingUp(true);
    try {
      await createBackup(settings);
      setShowPrompt(false);
    } catch (error) {
      console.error('Scheduled backup failed:', error);
      alert('Scheduled backup failed. Please try again from settings.');
    } finally {
      setIsBackingUp(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-8 duration-500">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 max-w-sm w-full">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-stone-900">Backup Due</h3>
              <button 
                onClick={() => setShowPrompt(false)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-stone-500 mb-4">
              Your scheduled backup is due. Download a copy of your data now to keep it safe.
            </p>
            <button
              onClick={handleRunBackup}
              disabled={isBackingUp}
              className="w-full bg-stone-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isBackingUp ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isBackingUp ? 'Creating Backup...' : 'Download Backup Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
