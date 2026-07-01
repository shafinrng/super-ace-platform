"use client";
import { useEffect, useState } from "react";
import { getPlayers, togglePlayer, adjustBalance, makeAdmin } from "@/lib/api";
import { downloadCSV } from "@/lib/csv";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { Search, Ban, CheckCircle, DollarSign, Shield, Download } from "lucide-react";

export default function PlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{id: string, type: "balance" | "admin"} | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const fetch = async () => {
    setLoading(true);
    const data = await getPlayers(page, search);
    setPlayers(data.users);
    setTotal(data.total);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [page, search]);

  const handleToggle = async (id: string) => { await togglePlayer(id); fetch(); };
  const handleBalance = async () => {
    if (!modal || !amount || !reason) return;
    await adjustBalance(modal.id, Number(amount), reason);
    setModal(null); setAmount(""); setReason(""); fetch();
  };
  const handleMakeAdmin = async () => {
    if (!modal) return;
    await makeAdmin(modal.id); setModal(null); fetch();
  };

  const handleExport = () => {
    const headers = ["Username", "Email", "Role", "Balance", "Currency", "Status", "Created"];
    const rows = players.map((p) => [
      p.username, p.email, p.role, p.wallet?.balance ?? 0, p.wallet?.currency ?? "USDT", p.isActive ? "Active" : "Banned", new Date(p.createdAt).toLocaleString()
    ]);
    downloadCSV(`players_page_${page}.csv`, headers, rows);
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Players</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExport}
                  disabled={players.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50"
                >
                  <Download size={16} /> Export CSV
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" placeholder="Search players..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-yellow-400 w-64" />
                </div>
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50"><tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Username</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Balance</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-700">
                  {loading ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr> :
                    players.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-700/30">
                        <td className="px-4 py-3 font-medium">{p.username}</td>
                        <td className="px-4 py-3 text-gray-400 text-sm">{p.email}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${p.role === "ADMIN" ? "bg-purple-500/20 text-purple-400" : "bg-gray-500/20 text-gray-400"}`}>{p.role}</span></td>
                        <td className="px-4 py-3">{p.wallet?.balance ?? 0} {p.wallet?.currency ?? "USDT"}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${p.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{p.isActive ? "Active" : "Banned"}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleToggle(p.id)} className="p-2 hover:bg-gray-700 rounded-lg transition" title="Ban/Unban">
                              {p.isActive ? <Ban size={16} className="text-red-400" /> : <CheckCircle size={16} className="text-green-400" />}
                            </button>
                            <button onClick={() => setModal({id: p.id, type: "balance"})} className="p-2 hover:bg-gray-700 rounded-lg transition" title="Adjust Balance">
                              <DollarSign size={16} className="text-yellow-400" />
                            </button>
                            <button onClick={() => setModal({id: p.id, type: "admin"})} className="p-2 hover:bg-gray-700 rounded-lg transition" title="Make Admin">
                              <Shield size={16} className="text-purple-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            {total > 20 && (
              <div className="flex items-center justify-center gap-2">
                {Array.from({length: Math.ceil(total/20)}, (_, i) => (
                  <button key={i+1} onClick={() => setPage(i+1)} className={`px-3 py-1 rounded ${page === i+1 ? "bg-yellow-500 text-gray-900" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>{i+1}</button>
                ))}
              </div>
            )}
            {modal?.type === "balance" && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96">
                  <h3 className="text-lg font-bold mb-4">Adjust Balance</h3>
                  <input type="number" step="0.01" placeholder="Amount (+/-)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg mb-3 text-white" />
                  <input type="text" placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg mb-4 text-white" />
                  <div className="flex gap-2">
                    <button onClick={handleBalance} className="flex-1 py-2 bg-yellow-500 text-gray-900 font-bold rounded-lg hover:bg-yellow-400">Apply</button>
                    <button onClick={() => setModal(null)} className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">Cancel</button>
                  </div>
                </div>
              </div>
            )}
            {modal?.type === "admin" && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96">
                  <h3 className="text-lg font-bold mb-4">Make Admin?</h3>
                  <p className="text-gray-400 mb-4">This will grant admin privileges to this player.</p>
                  <div className="flex gap-2">
                    <button onClick={handleMakeAdmin} className="flex-1 py-2 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-400">Confirm</button>
                    <button onClick={() => setModal(null)} className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
