import React, { useEffect, useRef, useState } from "react";

interface Star3D {
  x: number;
  y: number;
  z: number;
  baseRadius: number;
  color: string;
}

export default function HeroBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // 3D Starfield & Neural Constellation Canvas (Pure Canvas 2D + 3D perspective math, no WebGL)
  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 650);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - width / 2) * 0.15;
      const y = (e.clientY - rect.top - height / 2) * 0.15;
      mouseRef.current.targetX = x;
      mouseRef.current.targetY = y;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Initialize 3D Starfield
    const starCount = 85;
    const stars: Star3D[] = [];
    const colors = [
      "rgba(186, 192, 225, 0.9)", // periwinkle
      "rgba(235, 171, 187, 0.85)", // soft rose
      "rgba(165, 180, 252, 0.9)", // indigo/cyan
      "rgba(255, 255, 255, 0.95)", // white
    ];

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width * 1.8,
        y: (Math.random() - 0.5) * height * 1.6,
        z: Math.random() * 850 + 50,
        baseRadius: Math.random() * 1.8 + 0.8,
        color: colors[Math.floor(Math.random() * colors.length)]!,
      });
    }

    const fov = 380;
    const speed = 0.55;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const centerX = width / 2 + mouseRef.current.x;
      const centerY = height / 2 + mouseRef.current.y;

      const projectedPoints: { x: number; y: number; z: number; color: string; r: number }[] = [];

      // Update and project each star in 3D
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i]!;
        star.z -= speed;
        if (star.z <= 20) {
          star.z = 850;
          star.x = (Math.random() - 0.5) * width * 1.8;
          star.y = (Math.random() - 0.5) * height * 1.6;
        }

        const scale = fov / (fov + star.z);
        const px = centerX + star.x * scale;
        const py = centerY + star.y * scale;

        if (px >= -50 && px <= width + 50 && py >= -50 && py <= height + 50) {
          const r = Math.max(star.baseRadius * scale * 1.6, 0.6);
          const alpha = Math.min(Math.max((1 - star.z / 850) * 1.2, 0.15), 1);

          projectedPoints.push({ x: px, y: py, z: star.z, color: star.color, r });

          // Render glowing star
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = star.color;
          ctx.shadowBlur = r * 6;
          ctx.shadowColor = star.color;
          ctx.fill();
        }
      }

      // Draw 3D Neural constellation filaments between nearby stars
      ctx.shadowBlur = 0;
      for (let i = 0; i < projectedPoints.length; i++) {
        const p1 = projectedPoints[i]!;
        for (let j = i + 1; j < projectedPoints.length; j++) {
          const p2 = projectedPoints[j]!;
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dz = p1.z - p2.z;
          const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz * 0.3);

          if (dist3D < 110) {
            const lineAlpha = (1 - dist3D / 110) * 0.22;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(186, 192, 225, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none perspective-hero select-none"
      aria-hidden="true"
    >
      {/* 1. Volumetric Ambient Color Blooms */}
      <div className="hero-blob hero-blob-1 opacity-70" />
      <div className="hero-blob hero-blob-2 opacity-65" />
      <div className="hero-blob hero-blob-3 opacity-60" />

      {/* 2. 3D Perspective Grid Floor (Cyberspace Horizon) */}
      <div className="hero-grid-floor" />

      {/* 3. Cinematic Anamorphic Horizontal Lens Streak */}
      <div className="cinematic-lens-flare" />

      {/* 4. Interactive 3D Starfield & Neural Constellation Canvas */}
      {!prefersReducedMotion && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full mix-blend-screen opacity-90"
        />
      )}

      {/* 5. 3D Floating Wireframe Gyroscope Rings (Left Horizon) */}
      <div
        className="gyro-container hidden md:block left-[-2%] top-[20%] w-56 h-56 lg:w-72 lg:h-72 opacity-35"
        style={{ transform: "rotateX(30deg) rotateY(-25deg)" }}
      >
        <div className="gyro-ring gyro-ring-1" />
        <div className="gyro-ring gyro-ring-2" />
        <div className="gyro-ring gyro-ring-3" />
        {/* Core glow */}
        <div className="absolute inset-[35%] rounded-full bg-brand-400/25 blur-xl" />
      </div>

      {/* 6. 3D Floating Gyroscope Rings (Right Horizon) */}
      <div
        className="gyro-container hidden md:block right-[-1%] top-[28%] w-60 h-60 lg:w-80 lg:h-80 opacity-30"
        style={{ transform: "rotateX(-25deg) rotateY(35deg)" }}
      >
        <div className="gyro-ring gyro-ring-2" />
        <div className="gyro-ring gyro-ring-3" />
        <div className="gyro-ring gyro-ring-1" />
        {/* Core glow */}
        <div className="absolute inset-[35%] rounded-full bg-accent-amber/20 blur-xl" />
      </div>

      {/* 7. Floating 3D Holographic Badges in Deep Space */}
      <div className="hidden xl:block absolute left-8 top-28 float-card-3d-left preserve-3d">
        <div className="glass-dark border border-white/20 rounded-2xl px-4 py-3 shadow-lg backdrop-blur-md flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-xs">
            <span className="text-xs font-bold">98%</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-white tracking-wide">Neural Match</p>
            <p className="text-[9px] text-white/70">Vector Vector Scoring</p>
          </div>
        </div>
      </div>

      <div className="hidden xl:block absolute right-8 top-36 float-card-3d-right preserve-3d">
        <div className="glass-dark border border-white/20 rounded-2xl px-4 py-3 shadow-lg backdrop-blur-md flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-brand-500/20 border border-brand-400/40 flex items-center justify-center text-brand-200 shadow-xs">
            <span className="text-xs font-bold">50k+</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-white tracking-wide">Verified Jobs</p>
            <p className="text-[9px] text-white/70">Updated Live Every Hour</p>
          </div>
        </div>
      </div>
    </div>
  );
}
