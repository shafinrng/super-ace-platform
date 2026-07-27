"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { login, getBalance, createGameSession, spinSaga, getJackpots } from "@/lib/api";
import { WinCelebration } from "@/components/WinCelebration";

/* ==========================================
   CONFIG & ASSETS
   ========================================== */
const SYMBOL_IMAGES: Record<string, string> = {
  A: "/assets/symbols/symbol-a.webp",
  K: "/assets/symbols/symbol-k.webp",
  Q: "/assets/symbols/symbol-q.webp",
  J: "/assets/symbols/symbol-j.webp",
  SPADE: "/assets/symbols/symbol-spade.webp",
  HEART: "/assets/symbols/symbol-heart.webp",
  CLUB: "/assets/symbols/symbol-club.webp",
  DIAMOND: "/assets/symbols/symbol-diamond.webp",
  GOLDEN: "/assets/symbols/symbol-golden.webp",
  WILD: "/assets/symbols/symbol-wild.webp",
  SCATTER: "/assets/symbols/symbol-scatter.webp",
};

const MULTIPLIERS = [1, 2, 3, 5];
const BET_OPTIONS = [0.02, 0.05, 0.10, 0.20, 0.50, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const AUTO_OPTIONS = [10, 25, 50, 100];

const SMALL_BTN = 42;
const SPIN_BTN = 70;

/* ==========================================
   SVG ICONS (No Text)
   ========================================== */
const IconLightning = ({ s = 22, c = "#d4af37" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
);
const IconMinus = ({ s = 22, c = "#d4af37" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconPlus = ({ s = 22, c = "#d4af37" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconAuto = ({ s = 22, c = "#d4af37" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
);

/* ==========================================
   COMPONENTS
   ========================================== */

function SymbolCard({ symbol, isWinning = false, isNew = false, delay = 0, idleDelay = 0 }: { symbol: string; isWinning?: boolean; isNew?: boolean; delay?: number; idleDelay?: number }) {
  const [vis, setVis] = useState(!isNew);
  useEffect(() => {
    if (isNew) {
      setVis(false);
      const t = setTimeout(() => setVis(true), delay + 20);
      return () => clearTimeout(t);
    }
  }, [isNew, delay]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "4px",
        overflow: "hidden",
        position: "relative",
        background: "#ffffff",
        border: isWinning ? "2px solid #ffd700" : "1px solid rgba(180,140,50,0.4)",
        transform: vis ? (isWinning ? "translateY(0) scale(1.05)" : "translateY(0) scale(1)") : "translateY(-100px) scale(0.85)",
        opacity: vis ? 1 : 0,
        transition: `transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, opacity 0.2s ease ${delay}ms`,
        boxShadow: isWinning ? "0 0 16px rgba(255,215,0,0.9), inset 0 0 10px rgba(255,215,0,0.4)" : "none",
        animation: isWinning ? "cardShake 0.4s ease-in-out 3, cardGlow 0.7s ease infinite alternate" : `idlePulse 4s ease-in-out ${idleDelay}ms infinite`,
      }}
    >
      <img
        src={SYMBOL_IMAGES[symbol] || SYMBOL_IMAGES.A}
        alt={symbol}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "135%", 
          height: "135%",
          transform: "translate(-50%, -50%)",
          objectFit: "cover",
          display: "block",
          pointerEvents: "none"
        }}
      />
    </div>
  );
}

function MultiplierBar({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", gap: "4px", justifyContent: "center", alignItems: "center", padding: "3px 12px", background: "radial-gradient(ellipse at center, #7f1d1d, #450a0a)", border: "1.5px solid #d4af37", borderRadius: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
      {MULTIPLIERS.map((m) => {
        const on = current >= m;
        return (
          <div key={m} style={{ padding: "3px 10px", borderRadius: "12px", fontWeight: 900, fontSize: "12px", fontFamily: "Arial, sans-serif", background: on ? "linear-gradient(180deg, #fef08a, #ca8a04)" : "rgba(0,0,0,0.5)", border: on ? "1px solid #ffffff" : "1px solid rgba(212,175,55,0.2)", color: on ? "#450a0a" : "rgba(255,255,255,0.4)", boxShadow: on ? "0 0 8px #fef08a" : "none", transition: "all 0.3s" }}>
            x{m}
          </div>
        );
      })}
    </div>
  );
}

function JackpotDrawer({ jackpots, isOpen, onClose }: { jackpots: any; isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  const tiers = [
    ["GRAND", jackpots?.grand ?? 0, "#ef4444"],
    ["MAJOR", jackpots?.major ?? 0, "#f59e0b"],
    ["MINOR", jackpots?.minor ?? 0, "#3b82f6"],
    ["MINI", jackpots?.mini ?? 0, "#10b981"],
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "180px", zIndex: 65, background: "linear-gradient(180deg, #2a0808, #0f0404)", borderRight: "2px solid #d4af37", padding: "16px 12px", display: "flex", flexDirection: "column", boxShadow: "5px 0 25px rgba(0,0,0,0.9)", animation: "slideRight 0.3s ease-out" }}>
        <div style={{ color: "#fff1a8", fontSize: "14px", fontWeight: 900, marginBottom: "16px", textAlign: "center", borderBottom: "1px solid #d4af37", paddingBottom: "8px" }}>JACKPOTS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          {tiers.map(([n, v, c]: any) => (
            <div key={n} style={{ padding: "10px", background: "rgba(0,0,0,0.5)", border: `1px solid ${c}`, borderRadius: "8px" }}>
              <div style={{ fontSize: "10px", fontWeight: 800, color: c, letterSpacing: "0.1em" }}>{n}</div>
              <div style={{ fontSize: "16px", fontWeight: 900, color: "#ffffff", fontFamily: "monospace", marginTop: "4px" }}>${Number(v).toFixed(2)}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "12px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(212,175,55,0.4)", color: "#d4af37", fontWeight: 800, cursor: "pointer" }}>CLOSE</button>
      </div>
    </>
  );
}

export default function GamePage() {
  const {
    balance, betAmount, isSpinning, lastWin, grid, token, multiplier,
    jackpots, onlinePlayers, freeSpinsLeft, isFreeSpinMode,
    setBalance, setBetAmount, setSpinning, setLastWin, setGrid,
    setToken, setUsername, setOnlinePlayers, setJackpots, setMultiplier, setFreeSpinMode,
  } = useGameStore();

  const [email, setEmail] = useState("shafin@test.com");
  const [password, setPassword] = useState("password123");
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [cascadeStep, setCascadeStep] = useState(0);
  const [isNewGrid, setIsNewGrid] = useState(false);
  const [winPositions, setWinPositions] = useState<string[]>([]);
  const [showWin, setShowWin] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [isTurbo, setIsTurbo] = useState(false);
  const [autoSpins, setAutoSpins] = useState(0);
  const [isAuto, setIsAuto] = useState(false);
  const [showBetPanel, setShowBetPanel] = useState(false);
  const [showAutoPanel, setShowAutoPanel] = useState(false);
  const [showJackpotDrawer, setShowJackpotDrawer] = useState(false);
  const [spinDeg, setSpinDeg] = useState(0);

  const winShownRef = useRef(false);
  const tokenRef = useRef(token);
  const userIdRef = useRef(userId);

  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await getJackpots();
        if (cancelled) return;
        setJackpots({ grand: res.data.grand?.value ?? 0, major: res.data.major?.value ?? 0, minor: res.data.minor?.value ?? 0, mini: res.data.mini?.value ?? 0 });
      } catch (e) {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const ws = new WebSocket(`ws://localhost:3005?userId=${userId}`);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "ONLINE_COUNT") setOnlinePlayers(data.count);
      } catch (err) {}
    };
    return () => ws.close();
  }, [userId]);

  const handleLogin = async () => {
    try {
      const r = await login(email, password);
      setToken(r.data.token);
      setUsername(r.data.user.username);
      setUserId(r.data.user.id);
      const b = await getBalance(r.data.token);
      setBalance(Number(b.data.balance));
    } catch {
      setMessage("Login failed");
    }
  };

  const changeBet = (dir: 1 | -1) => {
    const idx = BET_OPTIONS.indexOf(betAmount);
    const next = idx + dir;
    if (next >= 0 && next < BET_OPTIONS.length) setBetAmount(BET_OPTIONS[next]);
  };

  const doSpin = useCallback(async (tkn: string, bet: number, turbo: boolean, freeMode: boolean) => {
    setSpinning(true);
    setLastWin(0);
    setWinPositions([]);
    setIsNewGrid(false);
    setShowWin(false);
    winShownRef.current = false;
    setSpinDeg((d) => d + 720);
    try {
      const clientSeed = `seed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const sessionRes = await createGameSession(userIdRef.current, bet, clientSeed);
      const sessionId = sessionRes.data.sessionId;
      setBalance((b: number) => Number((b - bet).toFixed(8)));
      const sagaRes = await spinSaga(userIdRef.current, sessionId, bet, clientSeed);
      if (!sagaRes.data.success) throw new Error(sagaRes.data.saga?.error || "Saga failed");
      const result = sagaRes.data.saga.result;
      setGrid(result.grid);
      setIsNewGrid(true);
      setMultiplier(result.multiplier);
      setCascadeStep(result.cascades.length);

      const landDelay = turbo ? 250 : 600;
      await new Promise((r) => setTimeout(r, landDelay));

      const winPos: string[] = [];
      result.wins.forEach((w: any) => w.positions.forEach(([reel, row]: number[]) => winPos.push(`${reel}-${row}`)));
      result.cascades.forEach((c: any) => c.wins.forEach((w: any) => w.positions.forEach(([reel, row]: number[]) => winPos.push(`${reel}-${row}`))));
      setWinPositions(winPos);

      const jackpotWin = result.jackpot?.triggered ? result.jackpot.winAmount : 0;
      const displayWin = result.totalWin + jackpotWin;
      if (displayWin > 0) {
        setBalance((b: number) => Number((b + displayWin).toFixed(8)));
        setLastWin(displayWin);
        await new Promise((r) => setTimeout(r, turbo ? 100 : 350));
        if (!winShownRef.current) {
          winShownRef.current = true;
          setWinAmount(displayWin);
          setShowWin(true);
        }
      }
      if (result.freeSpinsAwarded > 0) setFreeSpinMode(true, result.freeSpinsAwarded);
      if (jackpotWin > 0) setMessage(`JACKPOT! ${result.jackpot.tier?.toUpperCase()}`);
    } catch (err: any) {
      setMessage(err.message || "Spin error");
    } finally {
      setSpinning(false);
    }
  }, []);

  const handleSpin = useCallback(async () => {
    if (!tokenRef.current || isSpinning) return;
    await doSpin(tokenRef.current, betAmount, isTurbo, isFreeSpinMode);
  }, [isSpinning, betAmount, isTurbo, isFreeSpinMode, doSpin]);

  useEffect(() => {
    if (!isAuto || isSpinning || !token || autoSpins <= 0) {
      if (isAuto && autoSpins <= 0) setIsAuto(false);
      return;
    }
    const t = setTimeout(() => {
      setAutoSpins((n) => n - 1);
      doSpin(token, betAmount, isTurbo, isFreeSpinMode);
    }, isTurbo ? 400 : 1000);
    return () => clearTimeout(t);
  }, [isAuto, isSpinning, autoSpins, token, betAmount, isTurbo, isFreeSpinMode, doSpin]);

  const displayGrid = grid.length > 0 ? grid : Array.from({ length: 5 }, (_, i) => Array.from({ length: 4 }, (_, j) => ["A", "K", "Q", "J"][(i + j) % 4]));

  if (!token)
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0d0503", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div style={{ background: "linear-gradient(180deg,#2a1510,#1a0a06)", border: "2px solid #d4af37", borderRadius: "16px", padding: "32px 24px", width: "100%", maxWidth: "340px" }}>
          <h1 style={{ fontFamily: "serif", fontSize: "32px", fontWeight: 900, textAlign: "center", margin: "0 0 12px", color: "#fff1a8" }}>Super Ace</h1>
          <input style={{ width: "100%", padding: "10px", marginBottom: "10px", background: "#1a0a06", border: "1px solid #d4af37", borderRadius: "6px", color: "#fff" }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={{ width: "100%", padding: "10px", marginBottom: "16px", background: "#1a0a06", border: "1px solid #d4af37", borderRadius: "6px", color: "#fff" }} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={handleLogin} style={{ width: "100%", padding: "12px", borderRadius: "20px", border: "none", background: "linear-gradient(180deg,#fff1a8,#d4af37)", fontWeight: 900, cursor: "pointer" }}>LOGIN TO PLAY</button>
          {message && <p style={{ marginTop: "10px", textAlign: "center", color: "#ffb4ab", fontSize: "12px" }}>{message}</p>}
        </div>
      </div>
    );

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", justifyContent: "center", background: "#000000" }}>
      <div
        style={{
          width: "100%",
          maxWidth: "414px",
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Arial, sans-serif",
          overflow: "hidden",
          position: "relative",
          backgroundImage: "url(/assets/symbols/screen.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(circle at 50% 40%, rgba(212,175,55,0.15), transparent 60%)", animation: "bgPulse 6s ease-in-out infinite" }} />

        {showWin && <WinCelebration amount={winAmount} onClose={() => { setShowWin(false); winShownRef.current = false; }} />}
        
        <JackpotDrawer jackpots={jackpots} isOpen={showJackpotDrawer} onClose={() => setShowJackpotDrawer(false)} />
        
        {/* Jackpot Trigger Tab */}
        <button
          onClick={() => setShowJackpotDrawer(true)}
          style={{ position: "absolute", left: 0, top: "25%", zIndex: 20, width: "32px", height: "70px", background: "linear-gradient(90deg, #854d0e, #451a03)", border: "2px solid #fef08a", borderLeft: "none", borderRadius: "0 8px 8px 0", color: "#fef08a", fontSize: "12px", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", writingMode: "vertical-rl", textOrientation: "mixed", boxShadow: "2px 0 10px rgba(0,0,0,0.8)" }}
        >
          JP
        </button>

        {showBetPanel && (
          <div onClick={() => setShowBetPanel(false)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "linear-gradient(180deg, #2a0808, #120303)", borderTop: "2px solid #d4af37", borderRadius: "16px 16px 0 0", padding: "16px 16px calc(16px + env(safe-area-inset-bottom))" }}>
              <div style={{ color: "#fff1a8", fontSize: "12px", fontWeight: 800, marginBottom: "12px", textAlign: "center" }}>SELECT BET</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", maxHeight: "240px", overflowY: "auto", paddingBottom: "8px" }}>
                {BET_OPTIONS.map((b) => (
                  <button key={b} onClick={() => { setBetAmount(b); setShowBetPanel(false); }} style={{ padding: "10px 0", borderRadius: "6px", border: `1px solid ${betAmount === b ? "#fff1a8" : "rgba(212,175,55,0.3)"}`, fontWeight: 800, fontSize: "13px", background: betAmount === b ? "linear-gradient(180deg, #ca8a04, #854d0e)" : "rgba(0,0,0,0.6)", color: betAmount === b ? "#ffffff" : "#d4af37", cursor: "pointer" }}>${b}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showAutoPanel && (
          <div onClick={() => setShowAutoPanel(false)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "linear-gradient(180deg, #2a0808, #120303)", borderTop: "2px solid #a855f7", borderRadius: "16px 16px 0 0", padding: "16px 16px calc(16px + env(safe-area-inset-bottom))" }}>
              <div style={{ color: "#d8b4fe", fontSize: "12px", fontWeight: 800, marginBottom: "12px", textAlign: "center" }}>AUTO SPINS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
                {AUTO_OPTIONS.map((n) => (
                  <button key={n} onClick={() => { setAutoSpins(n); setIsAuto(true); setShowAutoPanel(false); }} style={{ padding: "12px 0", borderRadius: "6px", border: "1px solid #a855f7", background: "rgba(168,85,247,0.2)", color: "#d8b4fe", fontWeight: 800, fontSize: "14px", cursor: "pointer" }}>{n}x</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Top Header: Multiplier Bar */}
        <div style={{ padding: "calc(16px + env(safe-area-inset-top)) 10px 10px", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10, position: "relative" }}>
          <MultiplierBar current={multiplier} />
        </div>

        {/* Game Grid Container */}
        <div style={{ flex: 1, padding: "4px 6px", minHeight: 0, display: "flex", alignItems: "center", position: "relative", zIndex: 5 }}>
          <div style={{ width: "100%", aspectRatio: "5/4", background: "rgba(0,0,0,0.5)", border: "2px solid rgba(212,175,55,0.7)", borderRadius: "6px", padding: "1px", boxShadow: "inset 0 0 20px rgba(0,0,0,0.9), 0 0 15px rgba(212,175,55,0.2)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gridTemplateRows: "repeat(4, 1fr)", gap: "1px", height: "100%" }}>
              {Array.from({ length: 4 }, (_, row) =>
                displayGrid.map((col, reel) => (
                  <SymbolCard
                    key={`${reel}-${row}-${isNewGrid}`}
                    symbol={col[row] || "A"}
                    isWinning={winPositions.includes(`${reel}-${row}`)}
                    isNew={isNewGrid}
                    delay={isTurbo ? reel * 10 : reel * 40 + row * 15}
                    idleDelay={(reel * 4 + row) * 180}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Win / Status Banner */}
        <div style={{ height: "30px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 5 }}>
          {lastWin > 0 ? (
            <div style={{ color: "#fef08a", fontWeight: 900, fontSize: "16px", textShadow: "0 0 10px #ca8a04", animation: "slideUp 0.3s ease" }}>WIN ${lastWin.toFixed(2)}</div>
          ) : isFreeSpinMode ? (
            <span style={{ color: "#d8b4fe", fontWeight: 800, fontSize: "14px" }}>FREE SPINS: {freeSpinsLeft}</span>
          ) : message ? (
            <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: "12px" }}>{message}</span>
          ) : null}
        </div>

        {/* Bottom Control Bar */}
        <div style={{ flexShrink: 0, background: "linear-gradient(180deg, #3e1c12, #210d07)", borderTop: "2px solid #d4af37", padding: "10px 12px calc(16px + env(safe-area-inset-bottom))", position: "relative", zIndex: 10, boxShadow: "0 -4px 15px rgba(0,0,0,0.8)" }}>
          
          {/* Info Row: Wallet | Bet | Win */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
            <div style={{ flex: 1, background: "rgba(0,0,0,0.8)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "6px", padding: "6px 2px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", marginBottom: "3px" }}>WALLET</div>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#4ade80", fontFamily: "monospace" }}>${Number(balance).toFixed(2)}</div>
            </div>
            <div onClick={() => setShowBetPanel(true)} style={{ flex: 1, background: "rgba(0,0,0,0.8)", border: "1px solid #d4af37", borderRadius: "6px", padding: "6px 2px", textAlign: "center", cursor: "pointer", boxShadow: "inset 0 0 8px rgba(212,175,55,0.2)" }}>
              <div style={{ fontSize: "10px", color: "#d4af37", marginBottom: "3px" }}>BET</div>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", fontFamily: "monospace" }}>${betAmount.toFixed(2)}</div>
            </div>
            <div style={{ flex: 1, background: "rgba(0,0,0,0.8)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "6px", padding: "6px 2px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", marginBottom: "3px" }}>WIN</div>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#fef08a", fontFamily: "monospace" }}>${lastWin.toFixed(2)}</div>
            </div>
          </div>

          {/* Action Row: EXACTLY 5 Buttons (Turbo, Minus, Spin, Plus, Auto) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px" }}>
            
            <button onClick={() => setIsTurbo((t) => !t)} style={{ width: `${SMALL_BTN}px`, height: `${SMALL_BTN}px`, borderRadius: "50%", border: `1.5px solid ${isTurbo ? "#fef08a" : "rgba(212,175,55,0.4)"}`, background: isTurbo ? "#ca8a04" : "rgba(0,0,0,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isTurbo ? "0 0 12px #ca8a04" : "none" }}>
              <IconLightning c={isTurbo ? "#ffffff" : "#d4af37"} />
            </button>

            <button onClick={() => changeBet(-1)} style={{ width: `${SMALL_BTN}px`, height: `${SMALL_BTN}px`, borderRadius: "50%", border: "1.5px solid rgba(212,175,55,0.4)", background: "rgba(0,0,0,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconMinus />
            </button>

            <button onClick={isAuto ? () => { setIsAuto(false); setAutoSpins(0); } : handleSpin} disabled={isSpinning && !isAuto} style={{ width: `${SPIN_BTN}px`, height: `${SPIN_BTN}px`, borderRadius: "50%", border: "2.5px solid #fef08a", cursor: "pointer", background: "radial-gradient(circle, #fef08a, #ca8a04, #713f12)", boxShadow: isSpinning ? "0 0 20px #fef08a" : "0 4px 12px rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <img src="/assets/symbols/spin-button.webp" alt="SPIN" style={{ width: "90%", height: "90%", objectFit: "contain", transform: `rotate(${spinDeg}deg)`, transition: isSpinning ? "transform 0.8s ease" : "transform 0.2s ease" }} />
              {isAuto && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.6)", borderRadius:"50%", color:"#fff", fontWeight:900, fontSize:"14px" }}>{autoSpins}</div>}
            </button>

            <button onClick={() => changeBet(1)} style={{ width: `${SMALL_BTN}px`, height: `${SMALL_BTN}px`, borderRadius: "50%", border: "1.5px solid rgba(212,175,55,0.4)", background: "rgba(0,0,0,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconPlus />
            </button>

            <button onClick={() => setShowAutoPanel(true)} style={{ width: `${SMALL_BTN}px`, height: `${SMALL_BTN}px`, borderRadius: "50%", border: `1.5px solid ${isAuto ? "#a855f7" : "rgba(212,175,55,0.4)"}`, background: isAuto ? "#7e22ce" : "rgba(0,0,0,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isAuto ? "0 0 12px #7e22ce" : "none" }}>
              <IconAuto c={isAuto ? "#ffffff" : "#d4af37"} />
            </button>

          </div>
        </div>

        <style>{`
          @keyframes cardShake {
            0%, 100% { transform: rotate(0deg) scale(1.05); }
            25% { transform: rotate(-3deg) scale(1.05); }
            75% { transform: rotate(3deg) scale(1.05); }
          }
          @keyframes cardGlow {
            from { box-shadow: 0 0 10px rgba(255,241,168,0.7), inset 0 0 8px rgba(255,241,168,0.3); }
            to { box-shadow: 0 0 24px rgba(255,241,168,1), inset 0 0 16px rgba(255,241,168,0.6); }
          }
          @keyframes idlePulse {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.08); }
          }
          @keyframes bgPulse {
            0%, 100% { opacity: 0.7; }
            50% { opacity: 1; }
          }
          @keyframes slideRight {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
          @keyframes slideUp {
            from { transform: translateY(10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        `}</style>
      </div>
    </div>
  );
}