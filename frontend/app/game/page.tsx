"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { login, getBalance, createGameSession, spinSaga, getJackpots } from "@/lib/api";
import { WinCelebration } from "@/components/WinCelebration";

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
const BTN_SIZE = 40;

function SymbolCard({ symbol, isWinning = false, isNew = false, delay = 0, idleDelay = 0 }: { symbol: string; isWinning?: boolean; isNew?: boolean; delay?: number; idleDelay?: number }) {
  const [vis, setVis] = useState(!isNew);
  useEffect(() => {
    if (isNew) {
      setVis(false);
      const t = setTimeout(() => setVis(true), delay + 30);
      return () => clearTimeout(t);
    }
  }, [isNew, delay]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "3px",
        overflow: "hidden",
        position: "relative",
        border: isWinning ? "2px solid #fff1a8" : "1px solid rgba(212,175,55,0.35)",
        transform: vis
          ? isWinning ? "translateY(0) scale(1.04)" : "translateY(0) scale(1)"
          : "translateY(-90px) scale(0.85)",
        opacity: vis ? 1 : 0,
        transition: `transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, opacity 0.2s ease ${delay}ms`,
        boxShadow: isWinning ? "0 0 14px rgba(255,241,168,0.9)" : "0 1px 3px rgba(0,0,0,0.5)",
        animation: isWinning
          ? "cardShake 0.35s ease-in-out 3, cardGlow 0.6s ease infinite alternate"
          : `idlePulse 3.5s ease-in-out ${idleDelay}ms infinite`,
        background: "#0d0805",
      }}
    >
      <img
        src={SYMBOL_IMAGES[symbol] || SYMBOL_IMAGES.A}
        alt={symbol}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "128%",
          height: "128%",
          transform: "translate(-50%, -50%)",
          objectFit: "cover",
          display: "block",
        }}
      />
    </div>
  );
}

function MultiplierBar({ current }: { current: number }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "5px",
        justifyContent: "center",
        alignItems: "center",
        padding: "3px 10px",
        background: "radial-gradient(ellipse at center, #7f1d1d, #450a0a)",
        border: "1.5px solid #d4af37",
        borderRadius: "18px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.6)",
      }}
    >
      {MULTIPLIERS.map((m) => {
        const on = current >= m;
        return (
          <div
            key={m}
            style={{
              padding: "2px 7px",
              borderRadius: "10px",
              fontWeight: 900,
              fontSize: "11px",
              fontFamily: "Arial, sans-serif",
              background: on ? "linear-gradient(180deg, #fef08a, #ca8a04)" : "rgba(0,0,0,0.4)",
              border: on ? "1px solid #ffffff" : "1px solid rgba(212,175,55,0.2)",
              color: on ? "#450a0a" : "rgba(255,255,255,0.4)",
              boxShadow: on ? "0 0 8px #fef08a" : "none",
              transition: "all 0.3s",
            }}
          >
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
    <div
      onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "flex-start" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "210px",
          height: "100%",
          background: "linear-gradient(180deg, #2a0808, #0f0404)",
          borderRight: "2px solid #d4af37",
          padding: "calc(16px + env(safe-area-inset-top)) 12px 16px",
          boxShadow: "5px 0 25px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #d4af37", paddingBottom: "8px" }}>
          <span style={{ color: "#fff1a8", fontWeight: 900, fontSize: "13px", letterSpacing: "0.05em" }}>JACKPOTS</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#d4af37", fontSize: "16px", cursor: "pointer" }}>X</button>
        </div>
        {tiers.map(([n, v, c]: any) => (
          <div key={n} style={{ padding: "8px 10px", background: "rgba(0,0,0,0.5)", border: `1px solid ${c}`, borderRadius: "8px", textAlign: "left" }}>
            <div style={{ fontSize: "9px", fontWeight: 800, color: c, letterSpacing: "0.08em" }}>{n}</div>
            <div style={{ fontSize: "15px", fontWeight: 900, color: "#ffffff", fontFamily: "monospace", marginTop: "2px" }}>
              ${Number(v).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
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
        setJackpots({
          grand: res.data.grand?.value ?? 0,
          major: res.data.major?.value ?? 0,
          minor: res.data.minor?.value ?? 0,
          mini: res.data.mini?.value ?? 0,
        });
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
      if (jackpotWin > 0) setMessage(`JACKPOT! ${result.jackpot.tier?.toUpperCase()} WON`);
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
          maxWidth: "400px",
          height: "100%",
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            background: "radial-gradient(circle at 50% 40%, rgba(212,175,55,0.10), transparent 55%)",
            animation: "bgPulse 6s ease-in-out infinite",
          }}
        />

        {showWin && <WinCelebration amount={winAmount} onClose={() => { setShowWin(false); winShownRef.current = false; }} />}

        <JackpotDrawer jackpots={jackpots} isOpen={showJackpotDrawer} onClose={() => setShowJackpotDrawer(false)} />

        {showBetPanel && (
          <div onClick={() => setShowBetPanel(false)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "linear-gradient(180deg, #2a0808, #120303)", borderTop: "2px solid #d4af37", borderRadius: "16px 16px 0 0", padding: "16px 16px calc(16px + env(safe-area-inset-bottom))" }}>
              <div style={{ color: "#fff1a8", fontSize: "12px", fontWeight: 800, marginBottom: "12px", textAlign: "center" }}>SELECT BET AMOUNT</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", maxHeight: "240px", overflowY: "auto", paddingBottom: "8px" }}>
                {BET_OPTIONS.map((b) => (
                  <button
                    key={b}
                    onClick={() => { setBetAmount(b); setShowBetPanel(false); }}
                    style={{
                      padding: "10px 0",
                      borderRadius: "6px",
                      border: `1px solid ${betAmount === b ? "#fff1a8" : "rgba(212,175,55,0.3)"}`,
                      fontWeight: 800,
                      fontSize: "13px",
                      background: betAmount === b ? "linear-gradient(180deg, #ca8a04, #854d0e)" : "rgba(0,0,0,0.6)",
                      color: betAmount === b ? "#ffffff" : "#d4af37",
                      cursor: "pointer",
                    }}
                  >
                    ${b}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showAutoPanel && (
          <div onClick={() => setShowAutoPanel(false)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "linear-gradient(180deg, #2a0808, #120303)", borderTop: "2px solid #a855f7", borderRadius: "16px 16px 0 0", padding: "16px 16px calc(16px + env(safe-area-inset-bottom))" }}>
              <div style={{ color: "#d8b4fe", fontSize: "12px", fontWeight: 800, marginBottom: "12px", textAlign: "center" }}>AUTO SPINS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
                {AUTO_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => { setAutoSpins(n); setIsAuto(true); setShowAutoPanel(false); }}
                    style={{ padding: "12px 0", borderRadius: "6px", border: "1px solid #a855f7", background: "rgba(168,85,247,0.2)", color: "#d8b4fe", fontWeight: 800, fontSize: "14px", cursor: "pointer" }}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: "calc(10px + env(safe-area-inset-top)) 10px 6px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10, position: "relative" }}>
          <button
            onClick={() => setShowJackpotDrawer(true)}
            style={{
              width: `${BTN_SIZE}px`,
              height: `${BTN_SIZE}px`,
              borderRadius: "50%",
              background: "linear-gradient(180deg, #854d0e, #451a03)",
              border: "1.5px solid #fef08a",
              color: "#fef08a",
              fontSize: "9px",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
            }}
          >
            JP
          </button>
          <MultiplierBar current={multiplier} />
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "10px", minWidth: `${BTN_SIZE}px`, textAlign: "right" }}>{onlinePlayers} on</div>
        </div>

        <div style={{ flex: 1, padding: "4px 6px", minHeight: 0, display: "flex", alignItems: "center", position: "relative", zIndex: 5 }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              maxHeight: "460px",
              background: "rgba(0,0,0,0.35)",
              border: "1.5px solid rgba(212,175,55,0.4)",
              borderRadius: "8px",
              padding: "2px",
              boxShadow: "inset 0 0 15px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gridTemplateRows: "repeat(4, 1fr)", gap: "2px", height: "100%" }}>
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

        <div style={{ height: "22px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 5 }}>
          {lastWin > 0 ? (
            <div style={{ color: "#fef08a", fontWeight: 900, fontSize: "13px", textShadow: "0 0 8px #ca8a04" }}>
              WIN: ${lastWin.toFixed(2)}
            </div>
          ) : isFreeSpinMode ? (
            <span style={{ color: "#d8b4fe", fontWeight: 800, fontSize: "11px" }}>FREE SPINS: {freeSpinsLeft}</span>
          ) : message ? (
            <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: "10px" }}>{message}</span>
          ) : null}
        </div>

        <div style={{ flexShrink: 0, background: "linear-gradient(180deg, #180505, #000000)", borderTop: "1.5px solid #d4af37", padding: "6px 8px calc(10px + env(safe-area-inset-bottom))", position: "relative", zIndex: 10 }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <button
              onClick={() => setIsTurbo((t) => !t)}
              style={{
                width: `${BTN_SIZE}px`,
                height: `${BTN_SIZE}px`,
                borderRadius: "50%",
                border: `1.5px solid ${isTurbo ? "#fef08a" : "rgba(212,175,55,0.3)"}`,
                background: isTurbo ? "#ca8a04" : "rgba(0,0,0,0.6)",
                color: isTurbo ? "#ffffff" : "#d4af37",
                fontSize: "9px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              FAST
            </button>

            <button onClick={() => changeBet(-1)} style={{ width: `${BTN_SIZE}px`, height: `${BTN_SIZE}px`, borderRadius: "50%", border: "1.5px solid rgba(212,175,55,0.4)", background: "rgba(0,0,0,0.6)", color: "#d4af37", fontSize: "18px", fontWeight: 900, cursor: "pointer" }}>
              -
            </button>

            <button
              onClick={isAuto ? () => { setIsAuto(false); setAutoSpins(0); } : handleSpin}
              disabled={isSpinning && !isAuto}
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                border: "2px solid #fef08a",
                cursor: "pointer",
                background: "radial-gradient(circle, #fef08a, #ca8a04, #713f12)",
                boxShadow: isSpinning ? "0 0 15px #fef08a" : "0 2px 8px rgba(0,0,0,0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="/assets/symbols/spin-button.webp"
                alt="SPIN"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  transform: `rotate(${spinDeg}deg)`,
                  transition: isSpinning ? "transform 0.8s ease" : "transform 0.2s ease",
                }}
              />
            </button>

            <button onClick={() => changeBet(1)} style={{ width: `${BTN_SIZE}px`, height: `${BTN_SIZE}px`, borderRadius: "50%", border: "1.5px solid rgba(212,175,55,0.4)", background: "rgba(0,0,0,0.6)", color: "#d4af37", fontSize: "18px", fontWeight: 900, cursor: "pointer" }}>
              +
            </button>

            <button
              onClick={() => setShowAutoPanel(true)}
              style={{
                width: `${BTN_SIZE}px`,
                height: `${BTN_SIZE}px`,
                borderRadius: "50%",
                border: `1.5px solid ${isAuto ? "#a855f7" : "rgba(212,175,55,0.3)"}`,
                background: isAuto ? "#7e22ce" : "rgba(0,0,0,0.6)",
                color: isAuto ? "#ffffff" : "#d4af37",
                fontSize: isAuto ? "11px" : "9px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {isAuto ? autoSpins : "AUTO"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
            <div style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: "6px", padding: "4px 2px", textAlign: "center" }}>
              <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.5)" }}>WALLET</div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#4ade80", fontFamily: "monospace" }}>${Number(balance).toFixed(2)}</div>
            </div>

            <div
              onClick={() => setShowBetPanel(true)}
              style={{ background: "rgba(0,0,0,0.7)", border: "1px solid #d4af37", borderRadius: "6px", padding: "4px 2px", textAlign: "center", cursor: "pointer" }}
            >
              <div style={{ fontSize: "8px", color: "#d4af37" }}>BET</div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#ffffff", fontFamily: "monospace" }}>${betAmount.toFixed(2)}</div>
            </div>

            <div style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: "6px", padding: "4px 2px", textAlign: "center" }}>
              <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.5)" }}>WIN</div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#fef08a", fontFamily: "monospace" }}>${lastWin.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes cardShake {
            0%, 100% { transform: rotate(0deg) scale(1.04); }
            25% { transform: rotate(-2deg) scale(1.04); }
            75% { transform: rotate(2deg) scale(1.04); }
          }
          @keyframes cardGlow {
            from { box-shadow: 0 0 8px rgba(255,241,168,0.6); }
            to { box-shadow: 0 0 20px rgba(255,241,168,1); }
          }
          @keyframes idlePulse {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.05); }
          }
          @keyframes bgPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        `}</style>
      </div>
    </div>
  );
}