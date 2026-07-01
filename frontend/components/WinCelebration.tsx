"use client";
import { useEffect, useState, useRef } from "react";

interface Particle {
  id: number; x: number; y: number; vx: number; vy: number;
  color: string; size: number; rotation: number; opacity: number;
}

const WIN_LEVELS = [
  { min: 0,    max: 50,   label: "WIN",       color1: "#fff1a8", color2: "#d4af37", scale: 1.0, duration: 2000 },
  { min: 50,   max: 200,  label: "BIG WIN",   color1: "#fff1a8", color2: "#f97316", scale: 1.2, duration: 2500 },
  { min: 200,  max: 500,  label: "SUPER WIN", color1: "#fff1a8", color2: "#a855f7", scale: 1.4, duration: 3000 },
  { min: 500,  max: 2000, label: "MEGA WIN",  color1: "#fff1a8", color2: "#ec4899", scale: 1.6, duration: 3500 },
  { min: 2000, max: Infinity, label: "GIGA WIN", color1: "#ffffff", color2: "#06b6d4", scale: 1.8, duration: 4000 },
];

function getWinLevel(amount: number) {
  return WIN_LEVELS.find(l => amount >= l.min && amount < l.max) || WIN_LEVELS[0];
}

function Particles({ color1, color2 }: { color1: string; color2: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = [color1, color2, "#ffffff", "#ffdad4", "#d4af37"];
    const particles: any[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 20,
        vx: (Math.random() - 0.5) * 6,
        vy: -(Math.random() * 12 + 6),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 10 + 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
        shape: Math.random() > 0.5 ? "rect" : "circle",
      });
    }
    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.3;
        p.rotation += p.rotSpeed; p.opacity -= 0.008;
        if (p.opacity <= 0) return;
        ctx.save(); ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        else { ctx.beginPath(); ctx.arc(0, 0, p.size/2, 0, Math.PI*2); ctx.fill(); }
        ctx.restore();
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    const interval = setInterval(() => {
      for (let i = 0; i < 5; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 20,
          vx: (Math.random() - 0.5) * 6,
          vy: -(Math.random() * 12 + 6),
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 10 + 4,
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 10,
          opacity: 1,
          shape: Math.random() > 0.5 ? "rect" : "circle",
        });
      }
    }, 200);
    return () => { cancelAnimationFrame(animId); clearInterval(interval); };
  }, [color1, color2]);
  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:101 }} />;
}

export function WinCelebration({ amount, onClose }: { amount: number; onClose: () => void }) {
  const level = getWinLevel(amount);
  const [countUp, setCountUp] = useState(0);
  const [labelVisible, setLabelVisible] = useState(false);
  const [amountVisible, setAmountVisible] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLabelVisible(true), 100);
    const t2 = setTimeout(() => setAmountVisible(true), 400);
    let start = 0;
    const step = amount / 60;
    const t3 = setTimeout(() => {
      const interval = setInterval(() => {
        start += step;
        if (start >= amount) { setCountUp(amount); clearInterval(interval); }
        else setCountUp(start);
      }, 16);
    }, 400);
    const t4 = setTimeout(onClose, level.duration);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [amount, level.duration, onClose]);

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, zIndex:100,
      background:"radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.95) 100%)",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
      <Particles color1={level.color1} color2={level.color2} />
      {/* Glow ring */}
      <div style={{ position:"relative", zIndex:102, display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ width:"200px", height:"200px", borderRadius:"50%", position:"absolute",
          background:`radial-gradient(circle, ${level.color2}33 0%, transparent 70%)`,
          animation:"glowPulse 0.8s ease infinite alternate", top:"50%", left:"50%",
          transform:"translate(-50%, -50%)" }} />
        {/* Win label */}
        <div style={{ fontFamily:"serif", fontWeight:900, letterSpacing:"0.08em", textAlign:"center",
          fontSize:`${Math.min(52, 32 + level.scale * 10)}px`,
          background:`linear-gradient(180deg, #ffffff 0%, ${level.color1} 30%, ${level.color2} 100%)`,
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          transform: labelVisible ? `scale(${level.scale})` : "scale(0.2)",
          opacity: labelVisible ? 1 : 0,
          transition:"transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease",
          textShadow:"none", marginBottom:"16px",
          filter:`drop-shadow(0 0 20px ${level.color2})` }}>
          {level.label}
        </div>
        {/* Amount counter */}
        <div style={{ fontFamily:"serif", fontWeight:900, fontSize:"40px", textAlign:"center",
          color:"#fff1a8",
          transform: amountVisible ? "scale(1) translateY(0)" : "scale(0.5) translateY(20px)",
          opacity: amountVisible ? 1 : 0,
          transition:"transform 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.2s, opacity 0.3s ease 0.2s",
          filter:`drop-shadow(0 0 10px ${level.color2})` }}>
          {countUp.toFixed(2)}
          <span style={{ fontSize:"20px", color:"#99907c", marginLeft:"8px" }}>USDT</span>
        </div>
        {/* Tap hint */}
        <div style={{ color:"rgba(255,255,255,0.4)", fontSize:"12px", marginTop:"32px",
          animation:"fadeInOut 2s ease infinite" }}>Tap to continue</div>
      </div>
      <style>{`
        @keyframes glowPulse { from{transform:translate(-50%,-50%) scale(1);opacity:0.5} to{transform:translate(-50%,-50%) scale(1.3);opacity:1} }
        @keyframes fadeInOut { 0%,100%{opacity:0.3} 50%{opacity:0.8} }
      `}</style>
    </div>
  );
}
