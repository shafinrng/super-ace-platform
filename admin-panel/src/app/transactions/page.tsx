"use client";
import { useEffect, useState } from "react";
import { getTransactions } from "@/lib/api";
import { downloadCSV } from "@/lib/csv";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { Download } from "lucide-react";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTransactions(page).then(data => { setTransactions(data.transactions); setTotal(data.total); setLoading(false); });
  }, [page]);

  const handleExport = () => {
    const headers = ["Type", "User ID", "Amount", "Balance Before", "Balance After", "Description", "Date"];
    const rows = transactions.map((t) => [
      t.type, t.userId, t.amount, t.balanceBefore || "", t.balanceAfter || "", t.description || "", new Date(t.createdAt).toLocaleString()
    ]);
    downloadCSV(`transactions_page_${page}.csv`, headers, rows);
  };

  const typeColors: Record<string, string> = {
    BET: "text-red-400", WIN: "text-green-400", DEPOSIT: "text-green-400", WITHDRAWAL: "text-red-400", REFUND: "text-yellow-400",
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Transactions</h2>
              <button
                onClick={handleExport}
                disabled={transactions.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50"
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50"><tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">User ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Balance Before</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Balance After</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Description</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Date</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-700">
                  {loading ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr> :
                    transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-700/30">
                        <td className={`px-4 py-3 font-medium ${typeColors[t.type] || "text-gray-400"}`}>{t.type}</td>
                        <td className="px-4 py-3 text-sm text-gray-400 font-mono">{t.userId.slice(0,8)}...</td>
                        <td className={`px-4 py-3 font-bold ${typeColors[t.type] || "text-gray-400"}`}>{t.amount}</td>
                        <td className="px-4 py-3 text-gray-400">{t.balanceBefore}</td>
                        <td className="px-4 py-3 text-gray-400">{t.balanceAfter}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{t.description || "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(t.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
            {total > 50 && (
              <div className="flex items-center justify-center gap-2">
                {Array.from({length: Math.ceil(total/50)}, (_, i) => (
                  <button key={i+1} onClick={() => setPage(i+1)} className={`px-3 py-1 rounded ${page === i+1 ? "bg-yellow-500 text-gray-900" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>{i+1}</button>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
