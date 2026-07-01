"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CreditCard, Wallet, BarChart3, Target, LogOut } from "lucide-react";
import { logout } from "@/lib/api";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/players", icon: Users, label: "Players" },
  { path: "/transactions", icon: CreditCard, label: "Transactions" },
  { path: "/payments", icon: Wallet, label: "Payments" },
  { path: "/rtp", icon: BarChart3, label: "RTP Control" },
  { path: "/player-rtp", icon: Target, label: "Player RTP" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col h-screen">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold text-yellow-400">🎰 Super Ace</h1>
        <p className="text-xs text-gray-400">Admin Panel</p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              pathname === item.path
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-400 hover:bg-red-500/10 rounded-lg transition"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
