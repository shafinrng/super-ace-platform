"use client";
import { useEffect, useState } from "react";
import { getDashboard, getRtp, checkRtpAlert, clearAlerts, createWebSocket } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { Users, TrendingUp, Activity, AlertCircle, Target, Percent, Bell, Trash2, ShieldAlert, AlertTriangle, Zap } from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [rtp, setRtp] = useState<any>(null);
  const [alertData, setAlertData] = useState<any>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboard(), getRtp(), checkRtpAlert()]).then(([dash, rtpData, alertRes]) => {
      setData(dash);
      setRtp(rtpData);
      setAlertData(alertRes);
      setLoading(false);
    });

    const interval = setInterval(() => {
      checkRtpAlert().then(setAlertData);
    }, 10000);

    const ws = createWebSocket((msg) => {
      if (msg.type === "ONLINE_COUNT") {
        setOnlineCount(msg.count);
      } else if (msg.type === "SPIN") {
        setActivityFeed((prev) => [msg, ...prev].slice(0, 20));
      }
    });

    return () => {
      clearInterval(interval);
      ws?.close();
    };
  }, []);

  const handleClearAlerts = async () => {
    await clearAlerts();
    const fresh = await checkRtpAlert();
    setAlertData(fresh);
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  const stats = data?.stats || {};

  const hasCritical = alertData?.alert?.severity === "critical";
  const hasWarning = alertData?.alert?.severity === "warning";

  const cards = [
    { label: "Total Players", value: stats.totalUsers, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Active Players", value: stats.activeUsers, icon: Activity, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Total Bets", value: stats.totalBets?.toFixed(2) || "0", icon: TrendingUp, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "House Edge", value: `${stats.houseEdge}%`, icon: Percent, color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Pending Payments", value: stats.pendingPayments, icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "RTP Target", value: `${rtp?.target ?? 96}%`, icon: Target, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  ];

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8 bg-gray-900">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Dashboard</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
                  <Zap size={16} className="animate-pulse" />
                  <span className="text-sm font-medium">{onlineCount} Online</span>
                </div>
                {(hasCritical || hasWarning) && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${hasCritical ? "bg-red-500/20 border border-red-500/30 text-red-400" : "bg-yellow-500/20 border border-yellow-500/30 text-yellow-400"}`}>
                    {hasCritical ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
                    <span className="text-sm font-medium">{alertData?.alert?.message}</span>
                  </div>
                )}
                <button onClick={handleClearAlerts} className="p-2 hover:bg-gray-700 rounded-lg transition text-gray-400" title="Clear alerts">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {(hasCritical || hasWarning) && alertData?.alerts && alertData.alerts.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell size={18} className={hasCritical ? "text-red-400" : "text-yellow-400"} />
                  <h3 className="text-sm font-semibold text-gray-300">Recent Alerts</h3>
                </div>
                <div className="space-y-2">
                  {alertData.alerts.slice(0, 5).map((a: any) => (
                    <div key={a.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                      a.severity === "critical" ? "bg-red-500/10 border border-red-500/20" : "bg-yellow-500/10 border border-yellow-500/20"
                    }`}>
                      {a.severity === "critical" ? <ShieldAlert size={16} className="text-red-400" /> : <AlertTriangle size={16} className="text-yellow-400" />}
                      <span className="text-sm text-gray-300 flex-1">{a.message}</span>
                      <span className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card) => (
                <div key={card.label} className={`${card.bg} border border-gray-700 rounded-xl p-6 ${
                  card.label === "RTP Target" && hasCritical ? "ring-2 ring-red-500/50" : ""
                } ${card.label === "RTP Target" && hasWarning ? "ring-2 ring-yellow-500/50" : ""}`}>
                  <div className="flex items-center justify-between mb-4">
                    <card.icon className={card.color} size={24} />
                    <span className="text-xs text-gray-500 uppercase tracking-wider">{card.label}</span>
                  </div>
                  <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Recent Players</h3>
                <div className="space-y-3">
                  {data?.recentUsers?.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <div><div className="font-medium text-white">{u.username}</div><div className="text-sm text-gray-400">{u.email}</div></div>
                      <span className={`px-2 py-1 rounded text-xs ${u.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{u.isActive ? "Active" : "Banned"}</span>
                    </div>
                  ))}
                  {(!data?.recentUsers || data.recentUsers.length === 0) && <p className="text-gray-500 text-sm">No players yet</p>}
                </div>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                  <Zap size={18} className="text-yellow-400" /> Live Activity
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activityFeed.length === 0 && <p className="text-gray-500 text-sm">Waiting for activity...</p>}
                  {activityFeed.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${a.winAmount > a.betAmount ? "bg-green-400" : "bg-red-400"}`} />
                        <span className="text-sm text-gray-300">{a.username || a.userId.slice(0,8)}</span>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${a.winAmount > 0 ? "text-green-400" : "text-red-400"}`}>
                          {a.winAmount > 0 ? "+" : ""}{a.winAmount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">Bet: {a.betAmount}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Recent Transactions</h3>
                <div className="space-y-3">
                  {data?.recentTransactions?.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <div>
                        <span className={`font-medium ${t.type === "WIN" || t.type === "DEPOSIT" ? "text-green-400" : "text-red-400"}`}>{t.type}</span>
                        <div className="text-sm text-gray-400">{t.description || "-"}</div>
                      </div>
                      <div className={`font-bold ${t.type === "WIN" || t.type === "DEPOSIT" ? "text-green-400" : "text-red-400"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</div>
                    </div>
                  ))}
                  {(!data?.recentTransactions || data.recentTransactions.length === 0) && <p className="text-gray-500 text-sm">No transactions yet</p>}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
