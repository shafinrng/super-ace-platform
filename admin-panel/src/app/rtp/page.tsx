"use client";
import { useEffect, useState, useCallback } from "react";
import { getRtp, setRtp, resetRtp, getPlayerRtps, setPlayerRtp, deletePlayerRtp, getPlayers } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import { Target, RotateCcw, TrendingUp, AlertTriangle, User, Trash2, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";

export default function RtpPage() {
  const [rtp, setRtpData] = useState<any>(null);
  const [target, setTargetState] = useState(96);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [playerOverrides, setPlayerOverrides] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [playerRtpValue, setPlayerRtpValue] = useState(96);

  const fetch = useCallback(async () => {
    const [rtpData, overridesData, playersData] = await Promise.all([
      getRtp(),
      getPlayerRtps(),
      getPlayers(1, ""),
    ]);
    setRtpData(rtpData);
    setTargetState(rtpData.target);
    setPlayerOverrides(overridesData.overrides || []);
    setPlayers(playersData.users || []);
    setHistory((prev) => {
      const next = [...prev, { time: new Date().toLocaleTimeString(), actual: rtpData.actualRtp, target: rtpData.target }];
      return next.slice(-20);
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, [fetch]);

  const handleSave = async () => {
    setSaving(true);
    await setRtp(target);
    await fetch();
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm("Reset all RTP stats?")) return;
    await resetRtp();
    setHistory([]);
    await fetch();
  };

  const handleAddPlayerRtp = async () => {
    if (!selectedPlayer) return;
    await setPlayerRtp(selectedPlayer, playerRtpValue);
    setShowAddModal(false);
    setSelectedPlayer("");
    setPlayerRtpValue(96);
    await fetch();
  };

  const handleDeletePlayerRtp = async (id: string) => {
    if (!confirm("Remove this player's RTP override?")) return;
    await deletePlayerRtp(id);
    await fetch();
  };

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  const actualRtp = rtp?.actualRtp ?? 0;
  const diff = actualRtp - rtp?.target;
  const isOver = diff > 0;

  const comparisonData = [
    { name: "Target", value: rtp?.target, color: "#fbbf24" },
    { name: "Actual", value: actualRtp, color: isOver ? "#f87171" : "#4ade80" },
  ];

  const availablePlayers = players.filter((p: any) =>
    !playerOverrides.find((o: any) => o.userId === p.id)
  );

  return (
    <AuthGuard>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8 bg-gray-900">
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-white">RTP Control</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Target className="text-yellow-400" size={24} />
                  <span className="text-gray-400">Target RTP</span>
                </div>
                <div className="text-4xl font-bold text-yellow-400">{rtp?.target}%</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className={isOver ? "text-red-400" : "text-green-400"} size={24} />
                  <span className="text-gray-400">Actual RTP</span>
                </div>
                <div className={`text-4xl font-bold ${isOver ? "text-red-400" : "text-green-400"}`}>{actualRtp.toFixed(2)}%</div>
                <div className="text-sm mt-2 text-gray-500">Based on {rtp?.totalBets} total bets</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className={Math.abs(diff) > 5 ? "text-red-400" : "text-green-400"} size={24} />
                  <span className="text-gray-400">Difference</span>
                </div>
                <div className={`text-4xl font-bold ${Math.abs(diff) > 5 ? "text-red-400" : "text-green-400"}`}>{diff > 0 ? "+" : ""}{diff.toFixed(2)}%</div>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">Target vs Actual</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis domain={[0, 100]} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", color: "#fff" }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {comparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {history.length > 1 && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Live RTP History (updates every 5s)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" stroke="#9ca3af" tick={{fontSize: 10}} />
                      <YAxis domain={[0, 100]} stroke="#9ca3af" />
                      <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", color: "#fff" }} />
                      <Area type="monotone" dataKey="actual" stroke="#4ade80" fillOpacity={1} fill="url(#colorActual)" strokeWidth={2} />
                      <Area type="monotone" dataKey="target" stroke="#fbbf24" fillOpacity={1} fill="url(#colorTarget)" strokeWidth={2} strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-6 text-white">Adjust Target RTP</h3>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <input
                    type="range"
                    min="50"
                    max="99"
                    step="0.5"
                    value={target}
                    onChange={(e) => setTargetState(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>50%</span><span>75%</span><span>99%</span>
                  </div>
                </div>
                <div className="text-center w-24">
                  <div className="text-3xl font-bold text-yellow-400">{target}%</div>
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button onClick={handleSave} disabled={saving || target === rtp?.target}
                  className="px-6 py-3 bg-yellow-500 text-gray-900 font-bold rounded-lg hover:bg-yellow-400 transition disabled:opacity-50">
                  {saving ? "Saving..." : "Apply Target"}
                </button>
                <button onClick={handleReset}
                  className="px-6 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition flex items-center gap-2">
                  <RotateCcw size={18} /> Reset Stats
                </button>
              </div>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Per-Player RTP Overrides</h3>
                <button onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-yellow-500 text-gray-900 font-bold rounded-lg hover:bg-yellow-400 transition flex items-center gap-2">
                  <Plus size={16} /> Add Override
                </button>
              </div>
              {playerOverrides.length === 0 ? (
                <p className="text-gray-500 text-sm">No player overrides. All players use the global target.</p>
              ) : (
                <div className="space-y-3">
                  {playerOverrides.map((o: any) => {
                    const player = players.find((p: any) => p.id === o.userId);
                    return (
                      <div key={o.userId} className="flex items-center justify-between bg-gray-700/30 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <User size={18} className="text-gray-400" />
                          <div>
                            <div className="font-medium text-white">{player?.username || o.userId.slice(0,8)}</div>
                            <div className="text-sm text-gray-400">{player?.email || "Unknown player"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-yellow-400">{o.rtp}%</div>
                          <button onClick={() => handleDeletePlayerRtp(o.userId)}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition text-red-400">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">How it works</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                The RTP controller dynamically adjusts win probability based on the difference between actual and target RTP. 
                When actual RTP is below target, the engine becomes slightly more generous. When above, it tightens. 
                Per-player overrides let you set different targets for VIPs, problem players, or testing accounts.
              </p>
            </div>
          </div>
        </main>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-96">
            <h3 className="text-lg font-bold text-white mb-4">Add Player RTP Override</h3>
            <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4 focus:outline-none focus:border-yellow-400">
              <option value="">Select player...</option>
              {availablePlayers.map((p: any) => (
                <option key={p.id} value={p.id}>{p.username} ({p.email})</option>
              ))}
            </select>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">RTP Target</label>
              <input type="range" min="50" max="99" step="0.5" value={playerRtpValue}
                onChange={(e) => setPlayerRtpValue(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
              <div className="text-center text-2xl font-bold text-yellow-400 mt-2">{playerRtpValue}%</div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddPlayerRtp} disabled={!selectedPlayer}
                className="flex-1 py-2 bg-yellow-500 text-gray-900 font-bold rounded-lg hover:bg-yellow-400 transition disabled:opacity-50">
                Add Override
              </button>
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
