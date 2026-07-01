"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { login, getBalance, placeBet, creditWin, spinGame } from "@/lib/api";
import { WinCelebration } from "@/components/WinCelebration";

const SYMBOL_IMAGES: Record<string,string> = {
  A:"/assets/symbols/symbol-a.webp", K:"/assets/symbols/symbol-k.webp",
  Q:"/assets/symbols/symbol-q.webp", J:"/assets/symbols/symbol-j.webp",
  SPADE:"/assets/symbols/symbol-spade.webp", HEART:"/assets/symbols/symbol-heart.webp",
  CLUB:"/assets/symbols/symbol-club.webp", DIAMOND:"/assets/symbols/symbol-diamond.webp",
  GOLDEN:"/assets/symbols/symbol-golden.webp", WILD:"/assets/symbols/symbol-wild.webp",
  SCATTER:"/assets/symbols/symbol-scatter.webp",
};
const MULTIPLIERS = [1,2,3,5];
const BET_OPTIONS = [0.1,0.5,1,5,10,50,100,500];
const AUTO_OPTIONS = [10,25,50,100];

function SymbolCard({symbol,isWinning=false,isNew=false,delay=0}:{symbol:string;isWinning?:boolean;isNew?:boolean;delay?:number}) {
  const [vis,setVis] = useState(!isNew);
  useEffect(() => { if(isNew){setVis(false);const t=setTimeout(()=>setVis(true),delay+30);return()=>clearTimeout(t);} },[isNew,delay]);
  return (
    <div style={{ width:"100%",height:"100%",borderRadius:"8px",overflow:"hidden",position:"relative",
      transform:vis?"translateY(0) scale(1)":"translateY(-80px) scale(0.85)",
      opacity:vis?1:0,
      transition:`transform 0.35s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms,opacity 0.2s ease ${delay}ms`,
      boxShadow:isWinning?"0 0 0 2px #fff1a8,0 0 20px rgba(212,175,55,0.9)":"0 2px 8px rgba(0,0,0,0.6)",
      animation:isWinning?"cardWin 0.6s ease infinite alternate":"none" }}>
      <img src={SYMBOL_IMAGES[symbol]||SYMBOL_IMAGES.A} alt={symbol}
        style={{ width:"100%",height:"100%",objectFit:"cover",display:"block" }} />
    </div>
  );
}

function MultiplierBar({current}:{current:number}) {
  return (
    <div style={{ display:"flex",gap:"4px",justifyContent:"center",padding:"4px 10px",
      background:"linear-gradient(180deg,#3e2000,#2a1500)",border:"1px solid rgba(212,175,55,0.4)",
      borderRadius:"10px",width:"fit-content",margin:"0 auto" }}>
      {MULTIPLIERS.map(m => {
        const on=current>=m;
        return <div key={m} style={{ padding:"4px 11px",borderRadius:"6px",fontFamily:"serif",fontWeight:900,fontSize:"13px",
          background:on?"linear-gradient(180deg,#4c3a00,#3c2f00)":"linear-gradient(180deg,#2a1a10,#1a0f08)",
          border:on?"1px solid #fff1a8":"1px solid rgba(212,175,55,0.2)",
          color:on?"#fff1a8":"rgba(212,175,55,0.25)",
          boxShadow:on?"0 0 12px rgba(255,241,168,0.7)":"none",transition:"all 0.3s" }}>x{m}</div>;
      })}
    </div>
  );
}

function JackpotBar({jackpots}:{jackpots:any}) {
  return (
    <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"3px" }}>
      {[["GRAND",jackpots.grand,"#d4af37"],["MAJOR",5000,"#c0c0c0"],["MINOR",500,"#cd7f32"],["MINI",50,"#4fc3f7"]].map(([n,v,c]:any)=>(
        <div key={n} style={{ textAlign:"center",padding:"3px 2px",
          background:"linear-gradient(180deg,#2a1510,#1a0a06)",
          border:`1px solid ${c}`,borderRadius:"5px",overflow:"hidden",position:"relative" }}>
          <div style={{ position:"absolute",top:0,left:"-100%",width:"60%",height:"100%",
            background:"linear-gradient(90deg,transparent,rgba(255,241,168,0.15),transparent)",
            animation:"shimmer 3s infinite" }} />
          <div style={{ fontSize:"8px",fontWeight:700,color:c,letterSpacing:"0.06em" }}>{n}</div>
          <div style={{ fontSize:"12px",fontWeight:700,color:"#ffdad4",fontFamily:"serif" }}>{Number(v).toFixed(0)}</div>
        </div>
      ))}
    </div>
  );
}

export default function GamePage() {
  const {balance,betAmount,isSpinning,lastWin,grid,token,multiplier,
    jackpots,onlinePlayers,freeSpinsLeft,isFreeSpinMode,
    setBalance,setBetAmount,setSpinning,setLastWin,setGrid,
    setToken,setUsername,setOnlinePlayers,setJackpots,setMultiplier,setFreeSpinMode
  } = useGameStore();
  const [email,setEmail] = useState("shafin@test.com");
  const [password,setPassword] = useState("password123");
  const [userId,setUserId] = useState("");
  const [message,setMessage] = useState("");
  const [cascadeStep,setCascadeStep] = useState(0);
  const [isNewGrid,setIsNewGrid] = useState(false);
  const [winPositions,setWinPositions] = useState<string[]>([]);
  const [showWin,setShowWin] = useState(false);
  const [winAmount,setWinAmount] = useState(0);
  const [isTurbo,setIsTurbo] = useState(false);
  const [autoSpins,setAutoSpins] = useState(0);
  const [isAuto,setIsAuto] = useState(false);
  const [showBetPanel,setShowBetPanel] = useState(false);
  const [showAutoPanel,setShowAutoPanel] = useState(false);
  const [spinDeg,setSpinDeg] = useState(0);
  const winShownRef = useRef(false);
  const tokenRef = useRef(token);
  const userIdRef = useRef(userId);
  useEffect(()=>{ tokenRef.current=token; },[token]);
  useEffect(()=>{ userIdRef.current=userId; },[userId]);

  useEffect(()=>{
    if(!userId) return;
    const ws = new WebSocket(`ws://localhost:3005?userId=${userId}`);
    ws.onopen = () => console.log("🎰 Game WS connected");
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if(data.type === "ONLINE_COUNT") setOnlinePlayers(data.count);
      } catch(err) {}
    };
    ws.onerror = (err) => console.error("WS error:", err);
    ws.onclose = () => console.log("🎰 Game WS disconnected");
    return () => ws.close();
  },[userId]);

  const handleLogin = async () => {
    try {
      const r=await login(email,password);
      setToken(r.data.token); setUsername(r.data.user.username); setUserId(r.data.user.id);
      const b=await getBalance(r.data.token);
      setBalance(Number(b.data.balance));
    } catch { setMessage("Login failed"); }
  };

  const changeBet = (dir:1|-1) => {
    const idx = BET_OPTIONS.indexOf(betAmount);
    const next = idx + dir;
    if(next>=0 && next<BET_OPTIONS.length) setBetAmount(BET_OPTIONS[next]);
  };

  const doSpin = useCallback(async (tkn:string,bet:number,turbo:boolean,freeMode:boolean) => {
    setSpinning(true);
    setLastWin(0);
    setWinPositions([]);
    setIsNewGrid(false);
    setShowWin(false);
    winShownRef.current = false;
    setSpinDeg(d=>d+720);
    try {
      await placeBet(tkn,bet);
      setBalance((b:number)=>Number((b-bet).toFixed(8)));
      const res=await spinGame(tkn,bet,freeMode,userIdRef.current);
      const result=res.data.result;
      setGrid(result.grid);
      setIsNewGrid(true);
      setMultiplier(result.multiplier);
      setCascadeStep(result.cascades.length);
      const landDelay=turbo?350:850;
      await new Promise(r=>setTimeout(r,landDelay));
      const winPos:string[]=[];
      result.wins.forEach((w:any)=>w.positions.forEach(([reel,row]:number[])=>winPos.push(`${reel}-${row}`)));
      result.cascades.forEach((c:any)=>c.wins.forEach((w:any)=>w.positions.forEach(([reel,row]:number[])=>winPos.push(`${reel}-${row}`))));
      setWinPositions(winPos);
      if(result.totalWin>0) {
        await creditWin(tkn,result.totalWin,`spin-${Date.now()}`);
        setBalance((b:number)=>Number((b+result.totalWin).toFixed(8)));
        setLastWin(result.totalWin);
        await new Promise(r=>setTimeout(r,turbo?150:500));
        if(!winShownRef.current) {
          winShownRef.current=true;
          setWinAmount(result.totalWin);
          setShowWin(true);
        }
      }
      if(result.freeSpinsAwarded>0) setFreeSpinMode(true,result.freeSpinsAwarded);
    } catch { setMessage("Spin error"); }
    finally { setSpinning(false); }
  },[]);

  const handleSpin = useCallback(async()=>{
    if(!tokenRef.current||isSpinning) return;
    await doSpin(tokenRef.current,betAmount,isTurbo,isFreeSpinMode);
  },[isSpinning,betAmount,isTurbo,isFreeSpinMode,doSpin]);

  useEffect(()=>{
    if(!isAuto||isSpinning||!token||autoSpins<=0){if(isAuto&&autoSpins<=0)setIsAuto(false);return;}
    const t=setTimeout(()=>{ setAutoSpins(n=>n-1); doSpin(token,betAmount,isTurbo,isFreeSpinMode); },isTurbo?600:1400);
    return ()=>clearTimeout(t);
  },[isAuto,isSpinning,autoSpins,token,betAmount,isTurbo,isFreeSpinMode,doSpin]);

  const displayGrid=grid.length>0?grid:Array.from({length:5},(_,i)=>Array.from({length:4},(_,j)=>["A","K","Q","J"][(i+j)%4]));

  if(!token) return (
    <div style={{ position:"fixed",inset:0,background:"radial-gradient(ellipse at center,#1a0a06,#0d0503)",display:"flex",alignItems:"center",justifyContent:"center",padding:"16px" }}>
      <div style={{ background:"linear-gradient(180deg,#2a1510,#1a0a06)",border:"2px solid #d4af37",borderRadius:"16px",padding:"32px 24px",width:"100%",maxWidth:"340px",boxShadow:"0 0 40px rgba(212,175,55,0.3)" }}>
        <h1 style={{ fontFamily:"serif",fontSize:"38px",fontWeight:900,textAlign:"center",margin:"0 0 4px",
          background:"linear-gradient(180deg,#fff1a8,#d4af37,#a07d20)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>Super Ace</h1>
        <p style={{ textAlign:"center",color:"#99907c",marginBottom:"20px",fontSize:"12px" }}>VIP Casino · Est. 2024</p>
        <input style={{ width:"100%",padding:"11px",marginBottom:"10px",background:"#1a0a06",border:"1px solid rgba(212,175,55,0.5)",borderRadius:"8px",color:"#ffdad4",fontSize:"14px",boxSizing:"border-box" }}
          placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input style={{ width:"100%",padding:"11px",marginBottom:"18px",background:"#1a0a06",border:"1px solid rgba(212,175,55,0.5)",borderRadius:"8px",color:"#ffdad4",fontSize:"14px",boxSizing:"border-box" }}
          type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button onClick={handleLogin} style={{ width:"100%",padding:"13px",borderRadius:"999px",border:"2px solid #fff1a8",cursor:"pointer",fontSize:"15px",fontWeight:900,
          background:"radial-gradient(circle at 35% 35%,#fff1a8,#d4af37,#a07d20)",color:"#3c2f00" }}>LOGIN TO PLAY</button>
        {message&&<p style={{ marginTop:"10px",textAlign:"center",color:"#ffb4ab",fontSize:"12px" }}>{message}</p>}
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed",inset:0,display:"flex",justifyContent:"center",background:"#050f07" }}>
      <div style={{ width:"100%",maxWidth:"390px",height:"100%",display:"flex",flexDirection:"column",
        background:"radial-gradient(ellipse at top,#1a0a06,#0d0503)",fontFamily:"Plus Jakarta Sans,sans-serif",overflow:"hidden",position:"relative" }}>

        {showWin&&<WinCelebration amount={winAmount} onClose={()=>{setShowWin(false);winShownRef.current=false;}} />}

        {/* Bet panel */}
        {showBetPanel&&(
          <div onClick={()=>setShowBetPanel(false)} style={{ position:"absolute",inset:0,zIndex:50,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end" }}>
            <div onClick={e=>e.stopPropagation()} style={{ width:"100%",background:"linear-gradient(180deg,#2a1510,#1a0a06)",borderTop:"2px solid rgba(212,175,55,0.4)",borderRadius:"16px 16px 0 0",padding:"16px" }}>
              <div style={{ color:"#d4af37",fontSize:"12px",fontWeight:700,marginBottom:"12px",letterSpacing:"0.1em" }}>SELECT BET AMOUNT</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"16px" }}>
                {BET_OPTIONS.map(b=>(
                  <button key={b} onClick={()=>{setBetAmount(b);setShowBetPanel(false);}}
                    style={{ padding:"10px 0",borderRadius:"8px",border:`2px solid ${betAmount===b?"#fff1a8":"rgba(212,175,55,0.3)"}`,cursor:"pointer",fontWeight:700,fontSize:"14px",
                      background:betAmount===b?"linear-gradient(180deg,#4c3a00,#3c2f00)":"rgba(20,10,5,0.9)",
                      color:betAmount===b?"#fff1a8":"#d4af37" }}>{b}</button>
                ))}
              </div>
              <button onClick={()=>setShowBetPanel(false)} style={{ width:"100%",padding:"12px",borderRadius:"999px",border:"1px solid rgba(212,175,55,0.3)",background:"transparent",color:"#99907c",cursor:"pointer" }}>CANCEL</button>
            </div>
          </div>
        )}

        {/* Auto panel */}
        {showAutoPanel&&(
          <div onClick={()=>setShowAutoPanel(false)} style={{ position:"absolute",inset:0,zIndex:50,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end" }}>
            <div onClick={e=>e.stopPropagation()} style={{ width:"100%",background:"linear-gradient(180deg,#2a1510,#1a0a06)",borderTop:"2px solid rgba(168,85,247,0.4)",borderRadius:"16px 16px 0 0",padding:"16px" }}>
              <div style={{ color:"#d8b4fe",fontSize:"12px",fontWeight:700,marginBottom:"12px",letterSpacing:"0.1em" }}>AUTO SPIN</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"12px" }}>
                {AUTO_OPTIONS.map(n=>(
                  <button key={n} onClick={()=>{setAutoSpins(n);setIsAuto(true);setShowAutoPanel(false);}}
                    style={{ padding:"12px 0",borderRadius:"8px",border:"2px solid rgba(168,85,247,0.5)",cursor:"pointer",
                      background:"rgba(168,85,247,0.15)",color:"#d8b4fe",fontWeight:700,fontSize:"15px" }}>{n}×</button>
                ))}
              </div>
              {isAuto&&(
                <button onClick={()=>{setIsAuto(false);setAutoSpins(0);setShowAutoPanel(false);}}
                  style={{ width:"100%",padding:"12px",borderRadius:"999px",border:"2px solid #ef4444",background:"rgba(239,68,68,0.15)",color:"#fca5a5",fontWeight:700,cursor:"pointer",marginBottom:"8px" }}>STOP AUTO</button>
              )}
              <button onClick={()=>setShowAutoPanel(false)} style={{ width:"100%",padding:"12px",borderRadius:"999px",border:"1px solid rgba(212,175,55,0.3)",background:"transparent",color:"#99907c",cursor:"pointer" }}>CANCEL</button>
            </div>
          </div>
        )}

        {/* TOP BAR */}
        <div style={{ padding:"8px 10px 6px",background:"linear-gradient(180deg,#2a1510,#1a0a06)",borderBottom:"1px solid rgba(212,175,55,0.3)",flexShrink:0 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"5px" }}>
            <h1 style={{ fontFamily:"serif",fontSize:"18px",fontWeight:900,margin:0,
              background:"linear-gradient(180deg,#fff1a8,#d4af37)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>⚡ Super Ace</h1>
            <span style={{ color:"#99907c",fontSize:"10px" }}>👥 {onlinePlayers}</span>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:"#99907c",fontSize:"9px" }}>BALANCE</div>
              <div style={{ color:"#4ade80",fontWeight:700,fontSize:"14px" }}>{Number(balance).toFixed(2)}</div>
            </div>
          </div>
          <JackpotBar jackpots={jackpots} />
        </div>

        {/* MULTIPLIER */}
        <div style={{ padding:"5px",flexShrink:0,display:"flex",justifyContent:"center" }}>
          <MultiplierBar current={multiplier} />
        </div>

        {/* GAME GRID */}
        <div style={{ flex:1,padding:"0 6px",minHeight:0 }}>
          <div style={{ height:"100%",background:"radial-gradient(ellipse at center,#0d3518,#0a2a12 60%,#061a0b)",
            border:"2px solid rgba(212,175,55,0.4)",borderRadius:"12px",padding:"5px",
            boxShadow:"inset 0 0 25px rgba(0,0,0,0.7)" }}>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gridTemplateRows:"repeat(4,1fr)",gap:"4px",height:"100%" }}>
              {Array.from({length:4},(_,row)=>
                displayGrid.map((col,reel)=>(
                  <SymbolCard key={`${reel}-${row}-${isNewGrid}`}
                    symbol={col[row]||"A"}
                    isWinning={winPositions.includes(`${reel}-${row}`)}
                    isNew={isNewGrid}
                    delay={isTurbo?reel*12:reel*50+row*20} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* WIN BAR */}
        <div style={{ height:"28px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
          {lastWin>0?(
            <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
              <span style={{ color:"#99907c",fontSize:"10px" }}>WIN</span>
              <span style={{ fontFamily:"serif",fontWeight:900,fontSize:"18px",
                background:"linear-gradient(180deg,#fff1a8,#d4af37)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>
                {lastWin.toFixed(2)}
              </span>
              <span style={{ color:"#99907c",fontSize:"10px" }}>USDT</span>
              {cascadeStep>0&&<span style={{ color:"#a855f7",fontSize:"9px" }}>×{cascadeStep} cascade</span>}
            </div>
          ):isFreeSpinMode?(
            <span style={{ color:"#a855f7",fontWeight:700,fontSize:"12px" }}>🌟 FREE SPINS: {freeSpinsLeft}</span>
          ):null}
        </div>

        {/* BOTTOM CONTROLS */}
        <div style={{ flexShrink:0,background:"linear-gradient(180deg,#2a1510,#1a0a06)",borderTop:"2px solid rgba(212,175,55,0.3)",padding:"8px 10px 12px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>

            {/* TURBO */}
            <button onClick={()=>setIsTurbo(t=>!t)} style={{ width:"46px",height:"46px",borderRadius:"999px",flexShrink:0,
              border:`2px solid ${isTurbo?"#fbbf24":"rgba(212,175,55,0.3)"}`,cursor:"pointer",
              background:isTurbo?"radial-gradient(circle,#fbbf24,#d97706)":"rgba(15,8,4,0.9)",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              boxShadow:isTurbo?"0 0 14px rgba(251,191,36,0.8)":"none",transition:"all 0.2s" }}>
              <span style={{ fontSize:"16px",lineHeight:1 }}>⚡</span>
              <span style={{ fontSize:"7px",color:isTurbo?"#3c2f00":"#d4af37",fontWeight:700,marginTop:"1px" }}>TURBO</span>
            </button>

            {/* BET CONTROLS */}
            <div style={{ flex:1,display:"flex",alignItems:"center",gap:"3px" }}>
              <button onClick={()=>changeBet(-1)} style={{ width:"28px",height:"28px",borderRadius:"999px",border:"2px solid rgba(212,175,55,0.4)",background:"rgba(15,8,4,0.9)",color:"#d4af37",fontSize:"18px",fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}>−</button>
              <button onClick={()=>setShowBetPanel(true)} style={{ flex:1,padding:"6px 4px",borderRadius:"10px",
                border:"2px solid rgba(212,175,55,0.4)",background:"rgba(15,8,4,0.9)",cursor:"pointer",textAlign:"center" }}>
                <div style={{ color:"#99907c",fontSize:"8px",lineHeight:1 }}>BET</div>
                <div style={{ color:"#d4af37",fontWeight:700,fontSize:"16px",fontFamily:"serif",lineHeight:1.2 }}>{betAmount}</div>
              </button>
              <button onClick={()=>changeBet(1)} style={{ width:"28px",height:"28px",borderRadius:"999px",border:"2px solid rgba(212,175,55,0.4)",background:"rgba(15,8,4,0.9)",color:"#d4af37",fontSize:"18px",fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}>+</button>
            </div>

            {/* SPIN */}
            <button onClick={isAuto?()=>{setIsAuto(false);setAutoSpins(0);}:handleSpin}
              disabled={isSpinning&&!isAuto}
              style={{ width:"76px",height:"76px",borderRadius:"999px",border:"none",cursor:"pointer",background:"transparent",padding:0,flexShrink:0,position:"relative" }}>
              <img src="/assets/symbols/spin-button.webp" alt="SPIN"
                style={{ width:"100%",height:"100%",objectFit:"contain",
                  transform:`rotate(${spinDeg}deg)`,
                  transition:isSpinning?"transform 0.9s cubic-bezier(0.4,0,0.2,1)":"transform 0.3s ease",
                  filter:isSpinning?"drop-shadow(0 0 18px rgba(212,175,55,1))":"drop-shadow(0 0 6px rgba(212,175,55,0.5))",
                  opacity:isSpinning&&!isAuto?0.75:1 }} />
              {isAuto&&(
                <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  background:"rgba(0,0,0,0.55)",borderRadius:"999px",pointerEvents:"none" }}>
                  <span style={{ color:"#fca5a5",fontWeight:900,fontSize:"9px" }}>STOP</span>
                  <span style={{ color:"#d8b4fe",fontSize:"13px",fontWeight:900 }}>{autoSpins}</span>
                </div>
              )}
            </button>

            {/* AUTO CONTROLS */}
            <div style={{ flex:1,display:"flex",alignItems:"center",gap:"3px" }}>
              <button onClick={()=>setShowAutoPanel(true)} style={{ flex:1,padding:"6px 4px",borderRadius:"10px",
                border:`2px solid ${isAuto?"rgba(168,85,247,0.6)":"rgba(212,175,55,0.4)"}`,background:"rgba(15,8,4,0.9)",cursor:"pointer",textAlign:"center" }}>
                <div style={{ color:"#99907c",fontSize:"8px",lineHeight:1 }}>AUTO</div>
                <div style={{ color:isAuto?"#d8b4fe":"#d4af37",fontWeight:700,fontSize:"14px",lineHeight:1.2 }}>{isAuto?`${autoSpins}×`:"OFF"}</div>
              </button>
            </div>

            {/* MENU */}
            <button style={{ width:"46px",height:"46px",borderRadius:"999px",flexShrink:0,
              border:"2px solid rgba(212,175,55,0.3)",cursor:"pointer",
              background:"rgba(15,8,4,0.9)",display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",gap:"3px" }}>
              {[0,1,2].map(i=><div key={i} style={{ width:"14px",height:"2px",background:"#d4af37",borderRadius:"2px" }} />)}
            </button>
          </div>
        </div>

        <style>{`
          @keyframes shimmer{0%{left:-100%}100%{left:200%}}
          @keyframes cardWin{from{box-shadow:0 0 0 2px #d4af37,0 0 12px rgba(212,175,55,0.5)}to{box-shadow:0 0 0 2px #fff1a8,0 0 25px rgba(255,241,168,0.9)}}
          *{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
        `}</style>
      </div>
    </div>
  );
}
