'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, Building2, LogOut, Shield, Activity, Plus,
  Users, Paintbrush, ShieldCheck, Menu, GitBranch,
} from 'lucide-react';

const MAIN_NAV = [
  { label: 'Overview',      href: '/super-admin',              icon: LayoutDashboard },
  { label: 'Tenants',       href: '/super-admin/tenants',      icon: Building2       },
  { label: 'New Tenant',    href: '/super-admin/tenants/new',  icon: Plus            },
  { label: 'Audit Log',     href: '/super-admin/audit',        icon: Activity        },
];

const TENANT_SUB_NAV = [
  { label: 'Details',     suffix: '',              icon: Building2    },
  { label: 'Users',       suffix: '/users/new',    icon: Users        },
  { label: 'Branches',    suffix: '/branches',     icon: GitBranch    },
  { label: 'Branding',    suffix: '/branding',     icon: Paintbrush   },
  { label: 'Permissions', suffix: '/permissions',  icon: ShieldCheck  },
  { label: 'Menus',       suffix: '/menus',        icon: Menu         },
];

function extractTenantId(pathname: string): string | null {
  const match = pathname.match(/^\/super-admin\/tenants\/([^/]+)/);
  if (!match) return null;
  const id = match[1];
  if (id === 'new') return null;
  return id;
}

export default function SuperAdminSidebar() {
  const pathname = usePathname();
  const activeTenantId = extractTenantId(pathname);

  return (
    <aside className="w-56 bg-slate-900 flex flex-col">
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-indigo-400" />
          <span className="text-sm font-bold text-white">PharmNext Admin</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {MAIN_NAV.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/super-admin' && pathname.startsWith(href) && !activeTenantId);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        {/* Tenant sub-navigation when viewing a specific tenant */}
        {activeTenantId && (
          <>
            <div className="pt-3 mt-3 border-t border-slate-800">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Tenant</p>
            </div>
            {TENANT_SUB_NAV.map(({ label, suffix, icon: Icon }) => {
              const href = `/super-admin/tenants/${activeTenantId}${suffix}`;
              const isActive = pathname === href || (suffix === '' && pathname === `/super-admin/tenants/${activeTenantId}`);
              return (
                <Link
                  key={suffix}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
