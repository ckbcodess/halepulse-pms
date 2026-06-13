'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Save, Eye, EyeOff } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

const ROLES = ['MANAGER', 'PHARMACIST', 'MCA', 'AUDIT'] as const;
type Role = typeof ROLES[number];

interface MenuItem { key: string; label: string; path: string; visible: boolean; }
type MenuByRole = Record<Role, MenuItem[]>;

export default function MenuEditor() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [menus,    setMenus]    = useState<MenuByRole | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    fetch(`/api/super-admin/tenants/${tenantId}/menus`)
      .then(r => r.json())
      .then((configs: { role: Role; menuItems: MenuItem[] }[]) => {
        const map = {} as MenuByRole;
        configs.forEach(c => { map[c.role] = c.menuItems; });
        setMenus(map);
        setLoading(false);
      });
  }, [tenantId]);

  const toggleItem = (role: Role, key: string) => {
    setMenus(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [role]: prev[role].map(item => item.key === key ? { ...item, visible: !item.visible } : item),
      };
    });
  };

  const handleSave = async () => {
    if (!menus) return;
    setSaving(true);
    await fetch(`/api/super-admin/tenants/${tenantId}/menus`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(ROLES.map(r => ({ role: r, menuItems: menus[r] ?? [] }))),
    });
    setSaving(false);
    setSavedMsg('Saved!');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  if (loading) return <div className="text-muted-foreground text-sm p-6">Loading…</div>;
  if (!menus)  return <div className="text-muted-foreground text-sm p-6">No menu config found.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Visibility"
        description="Control which menu items each role can see."
      >
        <Button onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving…' : savedMsg || 'Save Changes'}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROLES.map(role => (
          <div key={role} className="bg-card border border-border dark:border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border dark:border-border">
              <h3 className="text-sm font-bold text-foreground">{role}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(menus[role] ?? []).filter(i => i.visible).length} visible items
              </p>
            </div>
            <div className="p-3 space-y-1">
              {(menus[role] ?? []).map(item => (
                <Button
                  key={item.key}
                  variant={item.visible ? 'secondary' : 'ghost'}
                  onClick={() => toggleItem(role, item.key)}
                  className="w-full justify-between"
                >
                  <span className="font-medium">{item.label}</span>
                  {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
