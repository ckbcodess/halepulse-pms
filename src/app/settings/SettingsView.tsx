'use client';

import { useState } from 'react';
import { Building2, Phone, Mail, User, FileText, Shield, Check, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';

type TenantSettings = {
  id: string;
  name: string;
  subdomain: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  address: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  primaryContact: string | null;
  legalName: string | null;
  licenceNumber: string | null;
  taxVatNumber: string | null;
  businessId: string | null;
  subscriptionTier: string;
};

export default function SettingsView({
  tenant,
  canEdit,
}: {
  tenant: TenantSettings;
  canEdit: boolean;
}) {
  const [form, setForm] = useState({
    name:           tenant.name,
    legalName:      tenant.legalName ?? '',
    address:        tenant.address ?? '',
    primaryPhone:   tenant.primaryPhone ?? '',
    primaryEmail:   tenant.primaryEmail ?? '',
    primaryContact: tenant.primaryContact ?? '',
    licenceNumber:  tenant.licenceNumber ?? '',
    taxVatNumber:   tenant.taxVatNumber ?? '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to save');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success('Settings saved successfully');
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const Field = ({
    label, value, field, placeholder, type = 'text', readOnly = false,
  }: {
    label: string; value: string; field: string;
    placeholder?: string; type?: string; readOnly?: boolean;
  }) => (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly || !canEdit}
        onChange={e => set(field, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium border transition-all focus:outline-none dark:text-slate-200
          ${readOnly || !canEdit
            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 cursor-not-allowed'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
          }`}
      />
    </div>
  );

  const tierColors: Record<string, string> = {
    basic:    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    standard: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
    premium:  'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {tenant.subdomain}.halepulse.app
          <span className={`ml-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${tierColors[tenant.subscriptionTier] ?? tierColors.basic}`}>
            {tenant.subscriptionTier}
          </span>
        </p>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> :
             saved    ? <Check size={14} />                              :
                        null}
            {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-sm text-amber-700 dark:text-amber-400">
          <Lock size={14} />
          View only — only Managers can edit settings.
        </div>
      )}

      {error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      )}

      {/* Business Info */}
      <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl divide-y divide-slate-100 dark:divide-white/5">
        <div className="px-6 py-4 flex items-center gap-2">
          <Building2 size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Business Information</h3>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Display Name"  value={form.name}      field="name"      placeholder="Pharmacy name" />
          <Field label="Legal Name"    value={form.legalName} field="legalName" placeholder="Registered legal name" />
          <div className="sm:col-span-2">
            <Field label="Address" value={form.address} field="address" placeholder="Full business address" />
          </div>
          <Field label="Licence Number" value={form.licenceNumber} field="licenceNumber" placeholder="Pharmacy licence no." />
          <Field label="Tax / VAT Number" value={form.taxVatNumber} field="taxVatNumber" placeholder="Tax registration no." />
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl divide-y divide-slate-100 dark:divide-white/5">
        <div className="px-6 py-4 flex items-center gap-2">
          <Phone size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Contact Details</h3>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Primary Contact Name"  value={form.primaryContact} field="primaryContact" placeholder="Contact person" />
          <Field label="Phone Number"          value={form.primaryPhone}   field="primaryPhone"   type="tel" placeholder="+233 XX XXX XXXX" />
          <Field label="Email Address"         value={form.primaryEmail}   field="primaryEmail"   type="email" placeholder="contact@pharmacy.com" />
        </div>
      </div>

      {/* Read-only system info */}
      <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-white/5 rounded-2xl divide-y divide-slate-100 dark:divide-white/5">
        <div className="px-6 py-4 flex items-center gap-2">
          <Shield size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">System Information</h3>
          <span className="ml-auto text-[10px] text-slate-400 font-medium">Read only</span>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business ID"   value={tenant.businessId ?? '—'} field="" readOnly />
          <Field label="Subdomain"     value={tenant.subdomain}         field="" readOnly />
          <Field label="Plan Tier"     value={tenant.subscriptionTier}  field="" readOnly />
        </div>
      </div>
    </div>
  );
}
