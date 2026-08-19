"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { login, getBalance, createGameSession, spinSaga, getJackpots } from "@/lib/api";

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

const BASE_MULTIPLIERS = [1, 2, 3, 5];
const FREE_SPIN_MULTIPLIERS = [2, 4, 6, 10];
const BET_OPTIONS = [0.02, 0.05, 0.10, 0.20, 0.50, 1, 2, 5, 10, 20, 50, 100, 200, 500];
const AUTO_OPTIONS = [10, 25, 50, 100];
const MAX_FREE_SPINS_TOTAL = 30; // hard safety ceiling — no bonus round can exceed this, regardless of retriggers

const SMALL_BTN = 42;
const SPIN_BTN = 72;

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ==========================================
   SVG ICONS (No Text)
   ========================================== */
const IconLightning = ({ s = 20, c = "#d4af37" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
);
const IconMinus = ({ s = 20, c = "#d4af37" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconPlus = ({ s = 20, c = "#d4af37" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
);
const IconAuto = ({ s = 20, c = "#d4af37" }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
);

/* ==========================================
   COMPONENTS
   ========================================== */

function SymbolCard({
  symbol, isWinning = false, isNew = false, isRevealing = false,
  isRemoving = false, isDropping = false,
  delay: enterDelay = 0, idleDelay = 0, dim = false,
}: {
  symbol: string; isWinning?: boolean; isNew?: boolean; isRevealing?: boolean;
  isRemoving?: boolean; isDropping?: boolean;
  delay?: number; idleDelay?: number; dim?: boolean;
}) {
  const [vis, setVis] = useState(!isNew);
  const [flipped, setFlipped] = useState(false);
  const [dropVis, setDropVis] = useState(true);
  const isScatter = symbol === "SCATTER";
  const isGolden = symbol === "GOLDEN";

  useEffect(() => {
    if (isNew) {
      setVis(false);
      const t = setTimeout(() => setVis(true), enterDelay + 20);
      return () => clearTimeout(t);
    }
  }, [isNew, enterDelay]);

  useEffect(() => {
    if (isRevealing) {
      const t = setTimeout(() => setFlipped(true), 50);
      return () => clearTimeout(t);
    } else {
      setFlipped(false);
    }
  }, [isRevealing]);

  useEffect(() => {
    if (isDropping) {
      setDropVis(false);
      const t = setTimeout(() => setDropVis(true), 30);
      return () => clearTimeout(t);
    }
  }, [isDropping]);

  const hidden = !vis || !dropVis;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        background: isScatter ? "transparent" : "#ffffff",
        boxSizing: "border-box",
        border: isWinning ? "3px solid #f0b429" : isScatter ? "none" : "1px solid rgba(0,0,0,0.6)",
        borderRadius: "4px",
        zIndex: isWinning ? 10 : 1,
        transform: isRemoving
          ? "scale(0.4) rotate(15deg)"
          : hidden
            ? "translateY(-140px) scale(0.85)"
            : (isWinning ? "scale(1.08)" : "scale(1)"),
        opacity: isRemoving ? 0 : hidden ? 0 : 1,
        filter: dim ? "brightness(0.3)" : "brightness(1)",
        transition: isRemoving
          ? "transform 0.28s ease-in, opacity 0.28s ease-in"
          : isDropping
            ? `transform 0.55s cubic-bezier(0.22, 1.1, 0.4, 1) ${enterDelay}ms, opacity 0.35s ease ${enterDelay}ms, filter 0.3s ease`
            : `transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) ${enterDelay}ms, opacity 0.2s ease ${enterDelay}ms, filter 0.3s ease`,
        boxShadow: isWinning
          ? "0 0 16px rgba(240,180,41,0.75), inset 0 0 8px rgba(240,180,41,0.45)"
          : isDropping && !dropVis
            ? "0 0 22px 4px rgba(255,215,120,0.55)"
            : "none",
        animation: isWinning ? "cardShake 0.35s ease-in-out infinite" : `idlePulse 4s ease-in-out ${idleDelay}ms infinite`,
      }}
    >
      {isGolden || isRevealing ? (
        <div style={{ position: "absolute", inset: 0, perspective: "900px" }}>
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              transformStyle: "preserve-3d",
              transition: "transform 0.55s cubic-bezier(0.45,0.05,0.15,1)",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              animation: !flipped ? "goldenGlowPulse 1.6s ease-in-out infinite" : "none",
            }}
          >
            <img
              src={SYMBOL_IMAGES.GOLDEN}
              alt="golden"
              style={{
                position: "absolute", inset: 0, top: "50%", left: "50%",
                width: "125%", height: "125%",
                transform: "translate(-50%, -50%)",
                objectFit: "cover",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                pointerEvents: "none",
              }}
            />
            {!flipped && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.9) 48%, rgba(255,235,170,0.95) 50%, rgba(255,255,255,0.9) 52%, transparent 65%)",
                  backgroundSize: "300% 300%",
                  mixBlendMode: "overlay",
                  animation: "shimmerSweep 2.4s ease-in-out infinite",
                  pointerEvents: "none",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
              />
            )}
            {!flipped && (
              <>
                <div style={{
                  position: "absolute", top: "18%", left: "22%", width: "10px", height: "10px",
                  background: "radial-gradient(circle, #fffdf0 0%, rgba(255,253,240,0) 70%)",
                  borderRadius: "50%", pointerEvents: "none",
                  animation: "sparklePulse 2.8s ease-in-out infinite",
                }} />
                <div style={{
                  position: "absolute", bottom: "22%", right: "18%", width: "8px", height: "8px",
                  background: "radial-gradient(circle, #fffdf0 0%, rgba(255,253,240,0) 70%)",
                  borderRadius: "50%", pointerEvents: "none",
                  animation: "sparklePulse 2.8s ease-in-out infinite 1.2s",
                }} />
              </>
            )}
            <img
              src={SYMBOL_IMAGES.WILD}
              alt="wild"
              style={{
                position: "absolute", inset: 0, top: "50%", left: "50%",
                width: "125%", height: "125%",
                transform: "translate(-50%, -50%) rotateY(180deg)",
                objectFit: "cover",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      ) : isScatter ? (
        <div style={{ position: "absolute", inset: 0 }}>
          <div style={{
            position: "absolute", inset: "8%",
            background: "radial-gradient(circle, rgba(255,215,90,0.55) 0%, rgba(255,215,90,0) 70%)",
            animation: "scatterGlowPulse 1.8s ease-in-out infinite",
            pointerEvents: "none",
          }} />
          <img
            src={SYMBOL_IMAGES.SCATTER}
            alt="SCATTER"
            style={{
              position: "absolute", top: "50%", left: "50%",
              width: "100%", height: "100%",
              transform: "translate(-50%, -50%)",
              objectFit: "cover", display: "block", pointerEvents: "none",
              animation: "scatterSpinShine 3.5s linear infinite",
            }}
          />
        </div>
      ) : (
        <img
          src={SYMBOL_IMAGES[symbol] || SYMBOL_IMAGES.A}
          alt={symbol}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "125%",
            height: "125%",
            transform: "translate(-50%, -50%)",
            objectFit: "cover",
            display: "block",
            pointerEvents: "none"
          }}
        />
      )}
    </div>
  );
}

function MultiplierBar({ current, steps }: { current: number; steps: number[] }) {
  return (
    <div style={{ display: "flex", gap: "4px", justifyContent: "center", alignItems: "center", padding: "4px 14px", background: "radial-gradient(ellipse at center, #7f1d1d, #450a0a)", border: "2px solid #d4af37", borderRadius: "24px", boxShadow: "0 4px 15px rgba(0,0,0,0.8)" }}>
      {steps.map((m) => {
        const on = current >= m;
        return (
          <div key={m} style={{ padding: "4px 12px", borderRadius: "12px", fontWeight: 900, fontSize: "14px", fontFamily: "Arial, sans-serif", background: on ? "linear-gradient(180deg, #fef08a, #ca8a04)" : "rgba(0,0,0,0.5)", border: on ? "1.5px solid #ffffff" : "1px solid rgba(212,175,55,0.2)", color: on ? "#450a0a" : "rgba(255,255,255,0.4)", boxShadow: on ? "0 0 12px #fef08a" : "none", transition: "all 0.3s", transform: on ? "scale(1.1)" : "scale(1)" }}>
            x{m}
          </div>
        );
      })}
    </div>
  );
}

function TotalWinPopup({ amount, cascadeStep, visible, onClose }: { amount: number; cascadeStep: number; visible: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [visible, onClose]);

  if (!visible) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", animation: "fadeIn 0.2s ease" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div style={{ position: "absolute", top: "15%", display: "flex", flexDirection: "column", alignItems: "center", animation: "popupDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
        <div style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.9), transparent)", padding: "4px 60px", marginBottom: "4px" }}>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "#fff", letterSpacing: "0.1em", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
            TOTAL WIN
          </div>
        </div>
        {cascadeStep > 0 && (
          <div style={{ fontSize: "28px", fontWeight: 900, color: "#ffea00", textShadow: "0 0 10px #ca8a04, 0 2px 4px rgba(0,0,0,0.8)", letterSpacing: "0.1em", animation: "pulseScale 1s infinite alternate" }}>
            COMBO {cascadeStep}
          </div>
        )}
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 65,
          fontSize: "85px",
          fontWeight: 900,
          fontFamily: "Arial, sans-serif",
          letterSpacing: "0.02em",
          backgroundImage: "linear-gradient(180deg, #fffbe0 0%, #ffe89a 25%, #fbc02d 55%, #c98a10 80%, #8a5a05 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          WebkitTextStroke: "1.5px #6b3f05",
          textShadow: `
            0 1px 0 #a8720a,
            0 2px 0 #96650a,
            0 3px 0 #855909,
            0 4px 0 #744d08,
            0 5px 6px rgba(0,0,0,0.5),
            0 8px 18px rgba(0,0,0,0.55),
            0 0 30px rgba(255,215,110,0.6)
          `,
          animation: "numberPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {amount.toFixed(2)}
      </div>
    </div>
  );
}

function FreeSpinsWonPopup({ count, visible, onClose }: { count: number; visible: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, [visible, onClose]);

  if (!visible) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", animation: "fadeIn 0.2s ease" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }} />
      <div style={{ position: "relative", zIndex: 75, display: "flex", flexDirection: "column", alignItems: "center", animation: "popupDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
        <div style={{ fontSize: "16px", fontWeight: 900, color: "#fff1a8", letterSpacing: "0.15em", marginBottom: "6px", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
          SCATTER BONUS
        </div>
        <div style={{
          fontSize: "36px", fontWeight: 900, letterSpacing: "0.05em",
          backgroundImage: "linear-gradient(180deg, #fffbe0 0%, #ffe89a 25%, #fbc02d 55%, #c98a10 80%, #8a5a05 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          WebkitTextStroke: "1.2px #6b3f05",
          textShadow: "0 3px 6px rgba(0,0,0,0.5), 0 0 30px rgba(255,215,110,0.6)",
          animation: "numberPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          FREE SPINS WON
        </div>
        <div style={{
          fontSize: "64px", fontWeight: 900, color: "#fff", marginTop: "8px",
          textShadow: "0 4px 10px rgba(0,0,0,0.6), 0 0 20px rgba(255,215,110,0.5)",
          animation: "pulseScale 1s infinite alternate",
        }}>
          {count}
        </div>
      </div>
    </div>
  );
}

// Retrigger — shown when 3+ scatters land DURING an active bonus round.
// Smaller/quicker than the initial trigger banner since it's an addition
// to an already-running bonus, not a brand new one.
function RetriggerPopup({ amount, visible, onClose }: { amount: number; visible: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onClose, 1800);
    return () => clearTimeout(t);
  }, [visible, onClose]);

  if (!visible) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 68, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        animation: "popupDrop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        background: "rgba(0,0,0,0.55)", borderRadius: "16px", padding: "16px 32px",
        border: "2px solid #fef08a",
      }}>
        <div style={{ fontSize: "13px", fontWeight: 900, color: "#fff1a8", letterSpacing: "0.15em" }}>RETRIGGER</div>
        <div style={{
          fontSize: "40px", fontWeight: 900, marginTop: "4px",
          backgroundImage: "linear-gradient(180deg, #fffbe0 0%, #ffe89a 25%, #fbc02d 55%, #c98a10 80%, #8a5a05 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          WebkitTextStroke: "1.2px #6b3f05",
          textShadow: "0 3px 6px rgba(0,0,0,0.5), 0 0 20px rgba(255,215,110,0.6)",
          animation: "pulseScale 0.8s infinite alternate",
        }}>
          +{amount} SPINS
        </div>
      </div>
    </div>
  );
}

function FreeSpinsCompletePopup({ totalWin, visible, onClose }: { totalWin: number; visible: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [visible, onClose]);

  if (!visible) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", animation: "fadeIn 0.2s ease" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }} />
      <div style={{ position: "relative", zIndex: 75, display: "flex", flexDirection: "column", alignItems: "center", animation: "popupDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
        <div style={{ fontSize: "16px", fontWeight: 900, color: "#fff1a8", letterSpacing: "0.15em", marginBottom: "6px", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
          FREE SPINS COMPLETE
        </div>
        <div style={{ fontSize: "14px", color: "#e8d9b0", marginBottom: "10px", letterSpacing: "0.1em" }}>
          TOTAL BONUS WIN
        </div>
        <div style={{
          fontSize: "72px", fontWeight: 900, letterSpacing: "0.02em",
          backgroundImage: "linear-gradient(180deg, #fffbe0 0%, #ffe89a 25%, #fbc02d 55%, #c98a10 80%, #8a5a05 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          WebkitTextStroke: "1.5px #6b3f05",
          textShadow: "0 5px 10px rgba(0,0,0,0.55), 0 0 30px rgba(255,215,110,0.6)",
          animation: "numberPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          {totalWin.toFixed(2)}
        </div>
      </div>
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
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "180px", zIndex: 65, background: "linear-gradient(180deg, #2a0808, #0f0404)", borderRight: "2px solid #d4af37", padding: "calc(20px + env(safe-area-inset-top)) 12px 16px", display: "flex", flexDirection: "column", boxShadow: "5px 0 25px rgba(0,0,0,0.9)", animation: "slideRight 0.3s ease-out" }}>
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
  const [revealingPositions, setRevealingPositions] = useState<string[]>([]);
  const [removingPositions, setRemovingPositions] = useState<string[]>([]);
  const [droppingPositions, setDroppingPositions] = useState<string[]>([]);

  // Free Spins state
  const [showFreeSpinsWon, setShowFreeSpinsWon] = useState(false);
  const [freeSpinsAwardedCount, setFreeSpinsAwardedCount] = useState(0);
  const [showFreeSpinsComplete, setShowFreeSpinsComplete] = useState(false);
  const [freeSpinTotalWin, setFreeSpinTotalWin] = useState(0);
  const [showRetrigger, setShowRetrigger] = useState(false);
  const [retriggerAmount, setRetriggerAmount] = useState(0);
  const freeSpinBetRef = useRef(1); // bet amount locked at the moment the bonus triggered

  const winShownRef = useRef(false);
  const tokenRef = useRef(token);
  const userIdRef = useRef(userId);
  const spinLockRef = useRef(false); // synchronous guard against double-fire from fast double clicks/taps

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
    if (isFreeSpinMode) return; // bet is locked during the bonus round
    const idx = BET_OPTIONS.indexOf(betAmount);
    const next = idx + dir;
    if (next >= 0 && next < BET_OPTIONS.length) setBetAmount(BET_OPTIONS[next]);
  };

  const handleCloseWin = useCallback(() => {
    setShowWin(false);
    winShownRef.current = false;
  }, []);

  // doSpin now takes an isFreeSpin flag. When true: no bet is deducted
  // locally, spinSaga is called with isFreeSpinMode=true (which tells
  // saga-service to skip the wallet deduction entirely — see saga.ts),
  // and the free-spin multiplier ladder is used instead of the base one.
  const doSpin = useCallback(async (tkn: string, bet: number, turbo: boolean, isFreeSpin: boolean) => {
    setSpinning(true);
    setLastWin(0);
    setWinPositions([]);
    setIsNewGrid(false);
    setShowWin(false);
    winShownRef.current = false;
    setSpinDeg((d) => d + 1080);
    try {
      const clientSeed = `seed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const sessionRes = await createGameSession(userIdRef.current, bet, clientSeed);
      const sessionId = sessionRes.data.sessionId;

      if (!isFreeSpin) {
        setBalance((b: number) => Number((b - bet).toFixed(8)));
      }

      const sagaRes = await spinSaga(
        userIdRef.current, sessionId, bet, clientSeed,
        isFreeSpin, isFreeSpin ? FREE_SPIN_MULTIPLIERS[0] : 1
      );
      if (!sagaRes.data.success) throw new Error(sagaRes.data.saga?.error || "Saga failed");
      const result = sagaRes.data.saga.result;

      setGrid(result.landedGrid || result.grid);
      setIsNewGrid(true);
      setCascadeStep(0);

      const landDelay = turbo ? 250 : 500;
      await delay(landDelay);

      const goldenPositions: number[][] = result.goldenPositions || [];
      let workingGrid = result.grid;
      if (goldenPositions.length > 0) {
        const revealKeys = goldenPositions.map(([reel, row]) => `${reel}-${row}`);
        setRevealingPositions(revealKeys);
        const staggerStep = turbo ? 40 : 80;
        const flipDuration = turbo ? 300 : 550;
        const totalFlipTime = (goldenPositions.length - 1) * staggerStep + flipDuration;
        await delay(totalFlipTime);
        setGrid(workingGrid);
        setRevealingPositions([]);
      }

      const initialWinPos: string[] = [];
      (result.wins || []).forEach((w: any) => w.positions.forEach(([reel, row]: number[]) => initialWinPos.push(`${reel}-${row}`)));
      if (initialWinPos.length > 0) {
        setWinPositions(initialWinPos);
        await delay(turbo ? 350 : 700);
      }

      const cascades = result.cascades || [];
      for (let i = 0; i < cascades.length; i++) {
        const step = cascades[i];
        const removeKeys: string[] = (step.removedPositions || []).map(([reel, row]: number[]) => `${reel}-${row}`);
        setRemovingPositions(removeKeys);
        await delay(turbo ? 180 : 300);
        workingGrid = step.newGrid;
        setGrid(workingGrid);
        setRemovingPositions([]);
        setDroppingPositions(removeKeys);
        setMultiplier(step.multiplier);
        setCascadeStep(i + 1);
        await delay(turbo ? 320 : 600);
        setDroppingPositions([]);
        const stepWinPos: string[] = [];
        (step.wins || []).forEach((w: any) => w.positions.forEach(([reel, row]: number[]) => stepWinPos.push(`${reel}-${row}`)));
        setWinPositions(stepWinPos);
        await delay(turbo ? 350 : 700);
      }

      const jackpotWin = result.jackpot?.triggered ? result.jackpot.winAmount : 0;
      const displayWin = result.totalWin + jackpotWin;

      if (displayWin > 0) {
        setBalance((b: number) => Number((b + displayWin).toFixed(8)));
        setLastWin(displayWin);
        if (isFreeSpin) {
          setFreeSpinTotalWin((prev) => Number((prev + displayWin).toFixed(8)));
        }
        if (!winShownRef.current) {
          winShownRef.current = true;
          setWinAmount(displayWin);
          setShowWin(true);
        }
      } else {
        setWinPositions([]);
      }

      if (isFreeSpin) {
        // Retrigger: 3+ scatters landed DURING the bonus round. Add the
        // awarded spins to what's left, rather than starting a fresh
        // bonus round (that would wrongly reset the running total win).
        const retrigger = result.freeSpinsAwarded > 0 ? result.freeSpinsAwarded : 0;
        const remaining = Math.min(freeSpinsLeft - 1 + retrigger, MAX_FREE_SPINS_TOTAL);

        if (retrigger > 0) {
          setRetriggerAmount(retrigger);
          setShowRetrigger(true);
        }

        if (remaining <= 0) {
          setFreeSpinMode(false, 0);
          setShowFreeSpinsComplete(true);
        } else {
          setFreeSpinMode(true, remaining);
        }
      } else if (result.freeSpinsAwarded > 0) {
        // Fresh trigger from a normal base-game spin.
        freeSpinBetRef.current = bet;
        setFreeSpinTotalWin(0);
        setFreeSpinsAwardedCount(result.freeSpinsAwarded);
        setFreeSpinMode(true, result.freeSpinsAwarded);
        setShowFreeSpinsWon(true);
      }

      if (jackpotWin > 0) setMessage(`JACKPOT! ${result.jackpot.tier?.toUpperCase()}`);
    } catch (err: any) {
      setMessage(err.message || "Spin error");
    } finally {
      setSpinning(false);
    }
  }, [userIdRef, freeSpinsLeft, setSpinning, setLastWin, setWinPositions, setIsNewGrid, setShowWin, setSpinDeg, setBalance, setGrid, setMultiplier, setCascadeStep, setWinAmount, setFreeSpinMode, setMessage]);

  const handleSpin = useCallback(async () => {
    if (!tokenRef.current || isSpinning || isFreeSpinMode) return;
    if (spinLockRef.current) return;
    spinLockRef.current = true;
    try {
      await doSpin(tokenRef.current, betAmount, isTurbo, false);
    } finally {
      spinLockRef.current = false;
    }
  }, [isSpinning, isFreeSpinMode, betAmount, isTurbo, doSpin, tokenRef]);

  useEffect(() => {
    if (!isAuto || isSpinning || !token || autoSpins <= 0 || isFreeSpinMode) {
      if (isAuto && autoSpins <= 0) setIsAuto(false);
      return;
    }
    const t = setTimeout(() => {
      if (spinLockRef.current) return;
      spinLockRef.current = true;
      setAutoSpins((n) => n - 1);
      doSpin(token, betAmount, isTurbo, false).finally(() => { spinLockRef.current = false; });
    }, isTurbo ? 400 : 1200);
    return () => clearTimeout(t);
  }, [isAuto, isSpinning, autoSpins, token, betAmount, isTurbo, isFreeSpinMode, doSpin]);

  // Auto-play loop for Free Spins: fires automatically once the trigger
  // banner has been dismissed, uses the locked bet amount, and keeps
  // going until freeSpinsLeft hits 0 (handled inside doSpin above).
  useEffect(() => {
    if (!isFreeSpinMode || isSpinning || !token || freeSpinsLeft <= 0 || showFreeSpinsWon) return;
    const t = setTimeout(() => {
      if (spinLockRef.current) return;
      spinLockRef.current = true;
      doSpin(token, freeSpinBetRef.current, isTurbo, true).finally(() => { spinLockRef.current = false; });
    }, isTurbo ? 500 : 1000);
    return () => clearTimeout(t);
  }, [isFreeSpinMode, isSpinning, token, freeSpinsLeft, showFreeSpinsWon, isTurbo, doSpin]);

  const displayGrid = grid.length > 0 ? grid : Array.from({ length: 5 }, (_, i) => Array.from({ length: 4 }, (_, j) => ["A", "K", "Q", "J"][(i + j) % 4]));
  const isAnyWin = winPositions.length > 0 && showWin;

  if (!token)
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0d0503", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div style={{ background: "linear-gradient(180deg,#2a1510,#1a0a06)", border: "2px solid #d4af37", borderRadius: "16px", padding: "32px 24px", width: "100%", maxWidth: "340px" }}>
          <h1 style={{ fontFamily: "serif", fontSize: "32px", fontWeight: 900, textAlign: "center", margin: "0 0 12px", color: "#fff1a8" }}>Super Ace</h1>
          <input style={{ width: "100%", padding: "10px", marginBottom: "10px", background: "#1a0a06", border: "1px solid #d4af37", borderRadius: "6px", color: "#fff" }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={{ width: "100%", padding: "10px", marginBottom: "16px", background: "#1a0a06", border: "1px solid #d4af37", borderRadius: "6px", color: "#fff" }} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={handleLogin} style={{ width: "100%", padding: "12px", borderRadius: "20px", border: "none", background: "linear-gradient(180deg,#fff1a8,#d4af37)", fontWeight: 900, cursor: "pointer" }}>LOGIN TO PLAY</button>
        </div>
      </div>
    );

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", justifyContent: "center", background: "#000000" }}>
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Arial, sans-serif",
          overflow: "hidden",
          position: "relative",
          backgroundImage: "url(/bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", background: "radial-gradient(circle at 50% 40%, rgba(212,175,55,0.15), transparent 60%)", animation: "bgPulse 6s ease-in-out infinite" }} />

        <TotalWinPopup amount={winAmount} cascadeStep={cascadeStep} visible={showWin} onClose={handleCloseWin} />
        <FreeSpinsWonPopup count={freeSpinsAwardedCount} visible={showFreeSpinsWon} onClose={() => setShowFreeSpinsWon(false)} />
        <RetriggerPopup amount={retriggerAmount} visible={showRetrigger} onClose={() => setShowRetrigger(false)} />
        <FreeSpinsCompletePopup totalWin={freeSpinTotalWin} visible={showFreeSpinsComplete} onClose={() => setShowFreeSpinsComplete(false)} />
        <JackpotDrawer jackpots={jackpots} isOpen={showJackpotDrawer} onClose={() => setShowJackpotDrawer(false)} />

        <button
          onClick={() => setShowJackpotDrawer(true)}
          style={{ position: "absolute", left: 0, top: "8%", zIndex: 20, width: "32px", height: "70px", background: "linear-gradient(90deg, #854d0e, #451a03)", border: "2px solid #fef08a", borderLeft: "none", borderRadius: "0 8px 8px 0", color: "#fef08a", fontSize: "12px", fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", writingMode: "vertical-rl", textOrientation: "mixed", boxShadow: "2px 0 10px rgba(0,0,0,0.8)" }}
        >
          JP
        </button>

        {isFreeSpinMode && (
          <div style={{
            position: "absolute", top: "8%", right: 0, zIndex: 20,
            background: "linear-gradient(90deg, #451a03, #854d0e)",
            border: "2px solid #fef08a", borderRight: "none", borderRadius: "8px 0 0 8px",
            padding: "8px 14px", color: "#fef08a", fontWeight: 900, fontSize: "13px",
            boxShadow: "-2px 0 10px rgba(0,0,0,0.8)", textAlign: "center",
          }}>
            <div style={{ fontSize: "9px", letterSpacing: "0.1em", opacity: 0.85 }}>FREE SPINS</div>
            <div style={{ fontSize: "18px" }}>{freeSpinsLeft}</div>
          </div>
        )}

        {showBetPanel && (
          <div onClick={() => setShowBetPanel(false)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "linear-gradient(180deg, #2a0808, #120303)", borderTop: "2px solid #d4af37", borderRadius: "16px 16px 0 0", padding: "16px 16px calc(24px + env(safe-area-inset-bottom))" }}>
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
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", background: "linear-gradient(180deg, #2a0808, #120303)", borderTop: "2px solid #a855f7", borderRadius: "16px 16px 0 0", padding: "16px 16px calc(24px + env(safe-area-inset-bottom))" }}>
              <div style={{ color: "#d8b4fe", fontSize: "12px", fontWeight: 800, marginBottom: "12px", textAlign: "center" }}>AUTO SPINS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
                {AUTO_OPTIONS.map((n) => (
                  <button key={n} onClick={() => { setAutoSpins(n); setIsAuto(true); setShowAutoPanel(false); }} style={{ padding: "12px 0", borderRadius: "6px", border: "1px solid #a855f7", background: "rgba(168,85,247,0.2)", color: "#d8b4fe", fontWeight: 800, fontSize: "14px", cursor: "pointer" }}>{n}x</button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ flexShrink: 0, paddingTop: "calc(24px + env(safe-area-inset-top))", paddingBottom: "10px", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10, position: "relative" }}>
          <MultiplierBar current={multiplier} steps={isFreeSpinMode ? FREE_SPIN_MULTIPLIERS : BASE_MULTIPLIERS} />
        </div>

        <div style={{ flex: 1, padding: "0 8px", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 5 }}>
          <div style={{ width: "100%", aspectRatio: "1/1", background: "rgba(0,0,0,0.5)", border: isFreeSpinMode ? "2px solid #fef08a" : "2px solid rgba(212,175,55,0.7)", borderRadius: "6px", padding: "1px", boxShadow: isFreeSpinMode ? "inset 0 0 20px rgba(0,0,0,0.9), 0 0 25px rgba(254,240,138,0.4)" : "inset 0 0 20px rgba(0,0,0,0.9), 0 0 15px rgba(212,175,55,0.2)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gridTemplateRows: "repeat(4, 1fr)", gap: "0", width: "100%", height: "100%" }}>
              {Array.from({ length: 4 }, (_, row) =>
                displayGrid.map((col, reel) => {
                  const cellKey = `${reel}-${row}`;
                  const isWinningCell = winPositions.includes(cellKey);
                  return (
                    <SymbolCard
                      key={`${reel}-${row}-${isNewGrid}`}
                      symbol={col[row] || "A"}
                      isWinning={isWinningCell}
                      isNew={isNewGrid}
                      isRevealing={revealingPositions.includes(cellKey)}
                      isRemoving={removingPositions.includes(cellKey)}
                      isDropping={droppingPositions.includes(cellKey)}
                      delay={isTurbo ? reel * 10 : reel * 40 + row * 15}
                      idleDelay={(reel * 4 + row) * 180}
                      dim={isAnyWin && !isWinningCell}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", position: "relative", zIndex: 10, background: "linear-gradient(180deg, #3e1c12, #210d07)", borderTop: "2px solid #d4af37", paddingBottom: "calc(24px + env(safe-area-inset-bottom))", boxShadow: "0 -4px 15px rgba(0,0,0,0.8)" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 12px 16px" }}>
            <button onClick={() => setIsTurbo((t) => !t)} style={{ width: `${SMALL_BTN}px`, height: `${SMALL_BTN}px`, borderRadius: "50%", border: `1.5px solid ${isTurbo ? "#fef08a" : "rgba(212,175,55,0.4)"}`, background: isTurbo ? "#ca8a04" : "linear-gradient(180deg, #3e1c12, #180505)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isTurbo ? "0 0 12px #ca8a04" : "0 4px 6px rgba(0,0,0,0.5)" }}>
              <IconLightning c={isTurbo ? "#ffffff" : "#d4af37"} />
            </button>

            <button onClick={() => changeBet(-1)} disabled={isFreeSpinMode} style={{ width: `${SMALL_BTN}px`, height: `${SMALL_BTN}px`, borderRadius: "50%", border: "1.5px solid rgba(212,175,55,0.4)", background: "linear-gradient(180deg, #3e1c12, #180505)", cursor: isFreeSpinMode ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.5)", opacity: isFreeSpinMode ? 0.4 : 1 }}>
              <IconMinus />
            </button>

            <button
              onClick={isAuto ? () => { setIsAuto(false); setAutoSpins(0); } : handleSpin}
              disabled={(isSpinning && !isAuto) || isFreeSpinMode}
              style={{ width: `${SPIN_BTN}px`, height: `${SPIN_BTN}px`, borderRadius: "50%", border: "2px solid #fef08a", cursor: isFreeSpinMode ? "not-allowed" : "pointer", background: "radial-gradient(circle, #fef08a, #ca8a04, #713f12)", boxShadow: isSpinning ? "0 0 25px #fef08a" : "0 6px 15px rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", opacity: isFreeSpinMode ? 0.6 : 1 }}
            >
              <img src="/assets/symbols/spin-button.webp" alt="SPIN" style={{ position: "absolute", top: "50%", left: "50%", width: "125%", height: "125%", objectFit: "cover", transform: `translate(-50%, -50%) rotate(${spinDeg}deg)`, transition: isSpinning ? "transform 0.8s ease" : "transform 0.2s ease", pointerEvents: "none" }} />
              {isAuto && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.6)", borderRadius:"50%", color:"#fff", fontWeight:900, fontSize:"16px", textShadow: "0 2px 4px #000" }}>{autoSpins}</div>}
              {isFreeSpinMode && <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.5)", borderRadius:"50%", color:"#fef08a", fontWeight:900, fontSize:"13px", textShadow: "0 2px 4px #000" }}>AUTO</div>}
            </button>

            <button onClick={() => changeBet(1)} disabled={isFreeSpinMode} style={{ width: `${SMALL_BTN}px`, height: `${SMALL_BTN}px`, borderRadius: "50%", border: "1.5px solid rgba(212,175,55,0.4)", background: "linear-gradient(180deg, #3e1c12, #180505)", cursor: isFreeSpinMode ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 6px rgba(0,0,0,0.5)", opacity: isFreeSpinMode ? 0.4 : 1 }}>
              <IconPlus />
            </button>

            <button onClick={() => setShowAutoPanel(true)} disabled={isFreeSpinMode} style={{ width: `${SMALL_BTN}px`, height: `${SMALL_BTN}px`, borderRadius: "50%", border: `1.5px solid ${isAuto ? "#a855f7" : "rgba(212,175,55,0.4)"}`, background: isAuto ? "#7e22ce" : "linear-gradient(180deg, #3e1c12, #180505)", cursor: isFreeSpinMode ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isAuto ? "0 0 12px #7e22ce" : "0 4px 6px rgba(0,0,0,0.5)", opacity: isFreeSpinMode ? 0.4 : 1 }}>
              <IconAuto c={isAuto ? "#ffffff" : "#d4af37"} />
            </button>
          </div>

          <div style={{ background: "rgba(0,0,0,0.85)", borderTop: "1px solid #d4af37", padding: "6px 12px", display: "flex", gap: "6px" }}>
            <div style={{ flex: 1, padding: "2px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", marginBottom: "2px", letterSpacing: "0.05em" }}>WALLET</div>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#4ade80", fontFamily: "monospace" }}>${Number(balance).toFixed(2)}</div>
            </div>
            <div onClick={() => !isFreeSpinMode && setShowBetPanel(true)} style={{ flex: 1, borderLeft: "1px solid rgba(212,175,55,0.3)", borderRight: "1px solid rgba(212,175,55,0.3)", padding: "2px", textAlign: "center", cursor: isFreeSpinMode ? "not-allowed" : "pointer" }}>
              <div style={{ fontSize: "9px", color: "#d4af37", marginBottom: "2px", letterSpacing: "0.05em" }}>BET</div>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#ffffff", fontFamily: "monospace" }}>${(isFreeSpinMode ? freeSpinBetRef.current : betAmount).toFixed(2)}</div>
            </div>
            <div style={{ flex: 1, padding: "2px", textAlign: "center" }}>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)", marginBottom: "2px", letterSpacing: "0.05em" }}>WIN</div>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#fef08a", fontFamily: "monospace" }}>${lastWin.toFixed(2)}</div>
            </div>
          </div>

        </div>

        <style>{`
          @keyframes cardShake {
            0%, 100% { transform: rotate(0deg) scale(1.08); filter: brightness(1.1); }
            25% { transform: rotate(-3deg) scale(1.08); filter: brightness(1.25); }
            75% { transform: rotate(3deg) scale(1.08); filter: brightness(1.25); }
          }
          @keyframes pulseScale {
            from { transform: scale(1); opacity: 0.9; }
            to { transform: scale(1.1); opacity: 1; }
          }
          @keyframes numberPop {
            0% { transform: scale(0.3) translateY(50px); opacity: 0; }
            60% { transform: scale(1.2) translateY(-10px); opacity: 1; }
            100% { transform: scale(1) translateY(0); opacity: 1; }
          }
          @keyframes popupDrop {
            0% { transform: translateY(-100px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideRight {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
          @keyframes shimmerSweep {
            0%   { background-position: 200% 200%; }
            100% { background-position: -50% -50%; }
          }
          @keyframes goldenGlowPulse {
            0%, 100% { filter: drop-shadow(0 0 5px rgba(255,200,60,0.55)); }
            50%      { filter: drop-shadow(0 0 12px rgba(255,215,110,0.9)); }
          }
          @keyframes sparklePulse {
            0%, 100% { opacity: 0; transform: scale(0.6); }
            50%      { opacity: 1; transform: scale(1.3); }
          }
          @keyframes scatterGlowPulse {
            0%, 100% { opacity: 0.5; transform: scale(0.9); }
            50%      { opacity: 1; transform: scale(1.15); }
          }
          @keyframes scatterSpinShine {
            0%   { filter: brightness(1) drop-shadow(0 0 4px rgba(255,215,90,0.5)); }
            50%  { filter: brightness(1.25) drop-shadow(0 0 10px rgba(255,215,90,0.9)); }
            100% { filter: brightness(1) drop-shadow(0 0 4px rgba(255,215,90,0.5)); }
          }
          * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        `}</style>
      </div>
    </div>
  );
}
