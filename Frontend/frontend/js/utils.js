/**
 * JobNex Utilities
 * Helper functions for formatting, component inclusion, audio feedback, and toasts.
 */

// Format Currency
function formatCurrency(amount, currency = "INR") {
  if (amount == null) return "";
  if (currency === "USD") {
    return "$" + Number(amount).toLocaleString("en-US");
  }
  if (currency === "BDT") {
    return Number(amount).toLocaleString("en-IN") + " ৳";
  }
  return "₹" + Number(amount).toLocaleString("en-IN");
}

// Audio Feedback Synthesizer
let audioEnabled = true;

function playSound(type) {
  if (!audioEnabled || !window.AudioContext) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else if (type === "error") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch (e) {}
}

// Global Toast System
function showToast(message, type = "success") {
  let toastEl = document.getElementById("jobnex-toast");
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "jobnex-toast";
    toastEl.className = "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-slate-900/95 border border-brand-400/40 text-white text-xs sm:text-sm font-semibold shadow-2xl flex items-center gap-2.5 transition-all duration-300 opacity-0 pointer-events-none translate-y-6";
    document.body.appendChild(toastEl);
  }

  const icon = type === "error" ? "⚠️" : "✓";
  toastEl.innerHTML = `<span class="${type === 'error' ? 'text-rose-400' : 'text-emerald-400'}">${icon}</span><span>${message}</span>`;
  toastEl.classList.remove("opacity-0", "translate-y-6", "pointer-events-none");
  toastEl.classList.add("opacity-100", "translate-y-0");

  clearTimeout(window.__toastTimeout);
  window.__toastTimeout = setTimeout(() => {
    toastEl.classList.remove("opacity-100", "translate-y-0");
    toastEl.classList.add("opacity-0", "translate-y-6", "pointer-events-none");
  }, 3500);
}

// Reusable HTML Component Includer
async function loadComponent(targetId, componentRelativePath) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const res = await fetch(componentRelativePath);
    if (!res.ok) throw new Error(`Failed to load ${componentRelativePath}`);
    const html = await res.text();
    container.innerHTML = html;
  } catch (err) {
    console.warn(`Error loading component from ${componentRelativePath}:`, err);
  }
}

// Starfield Background Canvas Generator
function initStarfield(canvasId = "hero-canvas") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
  let height = (canvas.height = canvas.parentElement?.clientHeight || 650);

  window.addEventListener("resize", () => {
    if (!canvas || !canvas.parentElement) return;
    width = canvas.width = canvas.parentElement.clientWidth;
    height = canvas.height = canvas.parentElement.clientHeight;
  });

  const starCount = 80;
  const stars = [];
  const colors = ["rgba(186, 192, 225, 0.9)", "rgba(235, 171, 187, 0.85)", "rgba(165, 180, 252, 0.9)", "rgba(255, 255, 255, 0.95)"];

  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: (Math.random() - 0.5) * width * 1.8,
      y: (Math.random() - 0.5) * height * 1.6,
      z: Math.random() * 850 + 50,
      baseRadius: Math.random() * 1.8 + 0.8,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }

  let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    targetX = (e.clientX - rect.left - width / 2) * 0.12;
    targetY = (e.clientY - rect.top - height / 2) * 0.12;
  });

  function render() {
    ctx.clearRect(0, 0, width, height);
    mouseX += (targetX - mouseX) * 0.05;
    mouseY += (targetY - mouseY) * 0.05;

    const cx = width / 2 + mouseX;
    const cy = height / 2 + mouseY;
    const fov = 380;
    const projected = [];

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.z -= 0.5;
      if (s.z <= 20) {
        s.z = 850;
        s.x = (Math.random() - 0.5) * width * 1.8;
        s.y = (Math.random() - 0.5) * height * 1.6;
      }

      const scale = fov / (fov + s.z);
      const px = cx + s.x * scale;
      const py = cy + s.y * scale;

      if (px >= -50 && px <= width + 50 && py >= -50 && py <= height + 50) {
        const r = Math.max(s.baseRadius * scale * 1.6, 0.6);
        projected.push({ x: px, y: py, color: s.color });

        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.shadowBlur = r * 6;
        ctx.shadowColor = s.color;
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;
    for (let i = 0; i < projected.length; i++) {
      for (let j = i + 1; j < projected.length; j++) {
        const dx = projected[i].x - projected[j].x;
        const dy = projected[i].y - projected[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(projected[i].x, projected[i].y);
          ctx.lineTo(projected[j].x, projected[j].y);
          ctx.strokeStyle = `rgba(186, 192, 225, ${(1 - dist / 100) * 0.2})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(render);
  }

  render();
}
