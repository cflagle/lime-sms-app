'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Users, FileText, Settings, Activity, BarChart3, Code } from 'lucide-react';

const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Messages', href: '/messages', icon: MessageSquare },
    { name: 'Reporting', href: '/reporting', icon: BarChart3 },
    { name: 'Subscribers', href: '/subscribers', icon: Users },
    { name: 'Logs', href: '/logs', icon: FileText },
    { name: 'Tracking', href: '/tracking', icon: Activity },
    { name: 'API Docs', href: '/api-docs', icon: Code },
    { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
    const pathname = usePathname();

    return (
        <div className="w-64 bg-slate-900 border-r border-slate-800 text-white flex flex-col h-screen fixed">
            <div className="p-6">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-lime-400 to-emerald-500">
                    Lime SMS
                </h1>
            </div>
            <nav className="flex-1 px-4 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive
                                    ? 'bg-gradient-to-r from-lime-500/20 to-emerald-500/20 text-lime-400 border border-lime-500/20'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }
              `}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-lime-400' : 'text-slate-500 group-hover:text-white'}`} />
                            <span className="font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center space-x-3 px-4 py-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">US</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">Admin</p>
                        <p className="text-xs text-slate-500">Lime Cellular</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
