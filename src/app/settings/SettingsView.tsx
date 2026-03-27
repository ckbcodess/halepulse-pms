'use client';

import { useState } from 'react';
import { Building2, Phone, Mail, User, FileText, Shield, Check, Loader2, Lock } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
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
      <label className="block text-xs font-semibold text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly || !canEdit}
        onChange={e => set(field, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium border transition-all focus:outline-none text-foreground
          ${readOnly || !canEdit
            ? 'bg-muted border-border text-muted-foreground cursor-not-allowed'
            : 'bg-background border-input focus:ring-2 focus:ring-primary/20 focus:border-primary'
          }`}
      />
    </div>
  );

  const tierColors: Record<string, string> = {
    basic:    'bg-muted dark:bg-sidebar text-muted-foreground',
    standard: 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400',
    premium:  'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  };

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description={`${tenant.subdomain}.halepulse.app`}
      >
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-[13px] py-[9px] rounded-[8px] bg-primary text-primary-foreground text-[12.25px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> :
             saved    ? <Check size={14} />                              :
                        null}
            {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        )}
      </PageHeader>

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
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        <div className="px-6 py-4 flex items-center gap-2">
          <Building2 size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground text-muted-foreground">Business Information</h3>
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
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        <div className="px-6 py-4 flex items-center gap-2">
          <Phone size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground text-muted-foreground">Contact Details</h3>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Primary Contact Name"  value={form.primaryContact} field="primaryContact" placeholder="Contact person" />
          <Field label="Phone Number"          value={form.primaryPhone}   field="primaryPhone"   type="tel" placeholder="+233 XX XXX XXXX" />
          <Field label="Email Address"         value={form.primaryEmail}   field="primaryEmail"   type="email" placeholder="contact@pharmacy.com" />
        </div>
      </div>

      {/* Read-only system info */}
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        <div className="px-6 py-4 flex items-center gap-2">
          <Shield size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground text-muted-foreground">System Information</h3>
          <span className="ml-auto text-[10px] text-muted-foreground font-medium">Read only</span>
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
