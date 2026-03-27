import React from 'react';
import { 
  MessageCircle, 
  Mail, 
  Phone, 
  Building2, 
  User,
  ExternalLink
} from 'lucide-react';
import { Settings, UserProfile } from '../types';

interface SupportProps {
  settings: Settings | null;
  userProfile: UserProfile | null;
}

export default function Support({ settings, userProfile }: SupportProps) {
  const supportName = settings?.supportName || 'Developer Support';
  const supportCompany = settings?.supportCompany || 'Software Solutions';
  const supportPhone = settings?.supportPhone || '';
  const supportEmail = settings?.supportEmail || '';
  const supportLogo = settings?.supportLogo || '';

  const handleWhatsApp = () => {
    if (!supportPhone) return;
    const cleanPhone = supportPhone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const handleEmail = () => {
    if (!supportEmail) return;
    window.location.href = `mailto:${supportEmail}?subject=Support Request - ${settings?.companyName || 'Guesthouse App'}`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-4">
        <div className="inline-block p-4 bg-stone-100 rounded-[2rem] shadow-inner mb-4">
          {supportLogo ? (
            <img src={supportLogo} alt="Support Logo" className="w-24 h-24 object-contain" />
          ) : (
            <Building2 className="w-24 h-24 text-stone-300" />
          )}
        </div>
        <h1 className="text-3xl font-serif italic text-stone-900">Technical Support</h1>
        <p className="text-stone-500 max-w-md mx-auto">
          Need help with the application? Contact our technical support team for assistance with features, bugs, or custom requests.
        </p>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-stone-100 shadow-xl shadow-stone-200/50 overflow-hidden">
        <div className="p-8 space-y-8">
          {/* Developer Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Developer</label>
                <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <User className="w-5 h-5 text-stone-400" />
                  <span className="font-medium text-stone-900">{supportName}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Company</label>
                <div className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                  <Building2 className="w-5 h-5 text-stone-400" />
                  <span className="font-medium text-stone-900">{supportCompany}</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Contact Phone</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <Phone className="w-5 h-5 text-stone-400" />
                    <span className="font-medium text-stone-900">{supportPhone || 'Not provided'}</span>
                  </div>
                  {supportPhone && (
                    <button
                      onClick={handleWhatsApp}
                      className="p-4 bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 group"
                      title="Contact via WhatsApp"
                    >
                      <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 ml-1">Contact Email</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <Mail className="w-5 h-5 text-stone-400" />
                    <span className="font-medium text-stone-900 truncate">{supportEmail || 'Not provided'}</span>
                  </div>
                  {supportEmail && (
                    <button
                      onClick={handleEmail}
                      className="p-4 bg-stone-900 text-white rounded-2xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/20 group"
                      title="Contact via Email"
                    >
                      <Mail className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {(userProfile?.role === 'admin' || userProfile?.role === 'manager') && (
            <div className="pt-8 border-t border-stone-100">
              <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="font-bold text-stone-900">Administrator Access</p>
                  <p className="text-xs text-stone-500">You can update these support details in the application settings.</p>
                </div>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'settings' }))}
                  className="px-6 py-3 bg-white border border-stone-200 text-stone-900 rounded-xl font-bold hover:bg-stone-50 transition-all flex items-center gap-2 shadow-sm"
                >
                  Go to Settings
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-300">
          Powered by {supportCompany}
        </p>
      </div>
    </div>
  );
}
