"use client";
import { useEffect, useState } from "react";
import { getPlayerRtps, setPlayerRtp, deletePlayerRtp, getPlayers } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { Users, Target, Trash2, Plus, Save, AlertCircle } from "lucide-react";

export default function PlayerRtpPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [rtpValue, setRtpValue] = useState(96);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([getPlayers(), getPlayerRtps()]).then(([p, r]) => {
      setPlayers(p.players || []);
      const map: Record<string, number> = {};
      (r.overrides || []).forEach((o: any) => { map[o.userId] = o.rtp; });
      setOverrides(map);
      setLoading(false);
    });
  }, []);

  const handleSetRtp = async () => {
    if (!selectedPlayer) return;
    try {
      await setPlayerRtp(selectedPlayer, rtpValue);
      setOverrides((prev) => ({ ...prev, [selectedPlayer]: rtpValue }));
      setMessage(`RTP override set for player`);
      setTimeout(() => setMessage(""), 3000);
    } catch { setMessage("Failed to set RTP"); }
  };

  const handleDeleteRtp = async (id: string) => {
    try {
      await deletePlayerRtp(id);
      setOverrides((prev) => { const n = { ...prev }; delete n[id]; return n; });
      setMessage("RTP override removed");
      setTimeout(() => setMessage(""), 3000);
    } catch { setMessage("Failed to remove RTP"); }
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8 bg-gray-900">
          <div className="space-y-6 max-w-4xl">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Target className="text-yellow-400" /> Per-Player RTP Override
            </h2>

            {message && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg">
                {message}
              </div>
            )}

            {/* Set Override */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Plus size={18} /> Set New Override
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Player</label>
                  <select
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  >
                    <option value="">Select player...</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.username} ({p.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Target RTP (%)</label>
                  <input
                    type="number" min="50" max="99" step="0.1"
                    value={rtpValue}
                    onChange={(e) => setRtpValue(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSetRtp}
                    disabled={!selectedPlayer}
                    className="w-full px-4 py-2 bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Save size={16} /> Save Override
                  </button>
                </div>
              </div>
            </div>

            {/* Active Overrides */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Users size={18} /> Active Overrides
              </h3>
              {Object.keys(overrides).length === 0 ? (
                <p className="text-gray-500 text-sm">No player RTP overrides set</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(overrides).map(([userId, rtp]) => {
                    const player = players.find((p) => p.id === userId);
                    return (
                      <div key={userId} className="flex items-center justify-between px-4 py-3 bg-gray-700/50 rounded-lg border border-gray-600">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold text-xs">
                            {(player?.username || "P").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-white font-medium">{player?.username || userId.slice(0, 8)}</div>
                            <div className="text-xs text-gray-400">{player?.email || "Unknown"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-gray-400">Target RTP</div>
                            <div className="text-yellow-400 font-bold">{rtp}%</div>
                          </div>
                          <button
                            onClick={() => handleDeleteRtp(userId)}
                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition"
                            title="Remove override"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-blue-300">
                When a player has an RTP override, the game engine uses their personal target instead of the global RTP. Remove the override to revert to global settings.
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
