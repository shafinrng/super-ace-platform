"use client";
import { useEffect, useState } from "react";
import { getPayments, approveWithdrawal } from "@/lib/api";
import { downloadCSV } from "@/lib/csv";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { Download } from "lucide-react";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    getPayments(page, status).then(data => { setPayments(data.payments); setTotal(data.total); setLoading(false); });
  };

  useEffect(() => { fetch(); }, [page, status]);

  const handleApprove = async (id: string) => {
    await approveWithdrawal(id);
    fetch();
  };

  const handleExport = () => {
    const headers = ["Type", "Amount", "Currency", "Method", "Status", "Created"];
    const rows = payments.map((p) => [
      p.type, p.amount, p.currency, p.method, p.status, new Date(p.createdAt).toLocaleString()
    ]);
    downloadCSV(`payments_page_${page}.csv`, headers, rows);
  };

  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-500/20 text-yellow-400",
    PROCESSING: "bg-blue-500/20 text-blue-400",
    COMPLETED: "bg-green-500/20 text-green-400",
    FAILED: "bg-red-500/20 text-red-400",
    CANCELLED: "bg-gray-500/20 text-gray-400",
  };

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Payments</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExport}
                  disabled={payments.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/30 transition disabled:opacity-50"
                >
                  <Download size={16} /> Export CSV
                </button>
                <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50"><tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Method</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Created</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-700">
                  {loading ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr> :
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-700/30">
                        <td className="px-4 py-3 font-medium">{p.type}</td>
                        <td className="px-4 py-3">{p.amount} {p.currency}</td>
                        <td className="px-4 py-3 text-gray-400">{p.method}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${statusColors[p.status] || "bg-gray-500/20 text-gray-400"}`}>{p.status}</span></td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(p.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          {p.status === "PROCESSING" && p.type === "WITHDRAWAL" && (
                            <button onClick={() => handleApprove(p.id)} className="px-3 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 text-sm">Approve</button>
                          )}
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
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
