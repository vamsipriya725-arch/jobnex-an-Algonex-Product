import React, { useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { useRouter } from "@/lib/nav";
import { useJobNex } from "@/frontend/context/JobNexContext";
import { UserRole } from "@/domain/types";

export function LoginView({ initialMode = "login" }: { initialMode?: "login" | "signup" } = {}) {
  const router = useRouter();
  const { login } = useJobNex();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const failFxRef = useRef<HTMLDivElement | null>(null);

  // Form states
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("JOB_SEEKER");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & notifications
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Accessibility / Toggles
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // 3D interaction triggers
  const triggerShotRef = useRef<
    ((name: string, durationMs: number, cb?: () => void) => void) | null
  >(null);
  const setFocusKindRef = useRef<((kind: string | null) => void) | null>(null);
  const setIsTypingRef = useRef<((typing: boolean) => void) | null>(null);

  // Initialize 3D Character
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animFrameId: number;
    let isDisposed = false;

    try {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = false;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 1, 5.4);

      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.72);
      scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
      keyLight.position.set(2.5, 4, 3.5);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x7382f6, 0.55);
      fillLight.position.set(-3, 1.5, 2);
      scene.add(fillLight);

      const rimLights: THREE.DirectionalLight[] = [];
      const rimTarget = new THREE.Color(0x8b8cf6);
      [-1, 1].forEach((s) => {
        const r = new THREE.DirectionalLight(0x8b8cf6, 1.2);
        r.position.set(s * 2.4, 2.2, -3);
        scene.add(r);
        rimLights.push(r);
      });

      // Ground shadow
      const makeRadialTexture = (innerColor: string, outerColor: string) => {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const g = c.getContext("2d");
        if (g) {
          const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
          gr.addColorStop(0, innerColor);
          gr.addColorStop(1, outerColor);
          g.fillStyle = gr;
          g.fillRect(0, 0, 128, 128);
        }
        return new THREE.CanvasTexture(c);
      };

      const groundShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1.8),
        new THREE.MeshBasicMaterial({
          map: makeRadialTexture("rgba(0,0,0,0.85)", "rgba(0,0,0,0)"),
          transparent: true,
          depthWrite: false,
          opacity: 0.85,
        }),
      );
      groundShadow.rotation.x = -Math.PI / 2;
      groundShadow.position.y = 0.004;
      scene.add(groundShadow);

      // Materials
      const mat = (color: number, roughness = 0.7, metalness = 0) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness });

      const skinMat = mat(0xd8a07f, 0.55);
      const sweaterMat = mat(0x73737d, 0.9);
      const pantsMat = mat(0x1b1b21, 0.85);
      const hairMat = mat(0x2a1b12, 0.8);
      const beardMat = mat(0x3a2618, 0.9);
      const shoeMat = mat(0x16161a);
      const soleMat = mat(0xe9e9ee);
      const frameMat = mat(0x161616, 0.35);
      const leatherMat = mat(0x6b4a2f, 0.6);
      const goldMat = mat(0xc9b37a, 0.3, 0.8);

      // Character Group
      const bodyGroup = new THREE.Group();
      scene.add(bodyGroup);

      const addMesh = (
        geo: THREE.BufferGeometry,
        material: THREE.Material,
        x: number,
        y: number,
        z: number,
        parent = bodyGroup,
      ) => {
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, y, z);
        parent.add(mesh);
        return mesh;
      };

      // Torso & Neck
      const torso = addMesh(new THREE.CapsuleGeometry(0.17, 0.34, 10, 24), sweaterMat, 0, 1.2, 0);
      torso.scale.z = 0.7;
      addMesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 16), skinMat, 0, 1.53, 0);

      // Legs & Shoes
      [-1, 1].forEach((s) => {
        addMesh(new THREE.CapsuleGeometry(0.078, 0.62, 8, 16), pantsMat, s * 0.09, 0.5, 0);
        addMesh(new THREE.BoxGeometry(0.12, 0.05, 0.27), shoeMat, s * 0.09, 0.06, 0.05);
        addMesh(new THREE.BoxGeometry(0.125, 0.03, 0.28), soleMat, s * 0.09, 0.015, 0.05);
      });

      // Head
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 1.6, 0);
      bodyGroup.add(headGroup);

      addMesh(new THREE.SphereGeometry(1, 40, 28), skinMat, 0, 0.13, 0, headGroup).scale.set(
        0.108,
        0.135,
        0.118,
      );
      addMesh(
        new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5),
        hairMat,
        0,
        0.15,
        -0.01,
        headGroup,
      ).scale.set(0.116, 0.14, 0.126);
      addMesh(
        new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
        beardMat,
        0,
        0.1,
        0.012,
        headGroup,
      ).scale.set(0.112, 0.095, 0.12);

      // Glasses & Eyes
      const eyeWhite = mat(0xf4f2ec, 0.3);
      const pupil = new THREE.MeshBasicMaterial({ color: 0x111111 });
      [-1, 1].forEach((s) => {
        addMesh(
          new THREE.SphereGeometry(0.016, 12, 12),
          eyeWhite,
          s * 0.042,
          0.15,
          0.106,
          headGroup,
        ).scale.z = 0.5;
        addMesh(new THREE.SphereGeometry(0.009, 10, 10), pupil, s * 0.042, 0.15, 0.115, headGroup);
        addMesh(
          new THREE.TorusGeometry(0.036, 0.005, 10, 32),
          frameMat,
          s * 0.042,
          0.15,
          0.114,
          headGroup,
        );
        addMesh(
          new THREE.SphereGeometry(0.02, 10, 10),
          skinMat,
          s * 0.113,
          0.13,
          0,
          headGroup,
        ).scale.x = 0.4;
      });
      addMesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), frameMat, 0, 0.155, 0.115, headGroup);
      addMesh(new THREE.SphereGeometry(0.014, 12, 12), skinMat, 0, 0.125, 0.126, headGroup);

      // Mouth
      const mouth = addMesh(
        new THREE.TorusGeometry(0.03, 0.004, 8, 20, Math.PI),
        mat(0x6a2f2a, 0.5),
        0,
        0.083,
        0.113,
        headGroup,
      );
      mouth.rotation.z = Math.PI;

      // Arms
      function buildArm(x: number) {
        const armG = new THREE.Group();
        armG.position.set(x, 1.45, 0);
        bodyGroup.add(armG);
        addMesh(new THREE.SphereGeometry(0.058, 14, 14), sweaterMat, 0, 0, 0, armG);
        addMesh(new THREE.CapsuleGeometry(0.05, 0.22, 6, 14), sweaterMat, 0, -0.15, 0, armG);

        const forearmG = new THREE.Group();
        forearmG.position.y = -0.3;
        forearmG.rotation.order = "YXZ";
        armG.add(forearmG);
        (armG as any).userData.forearm = forearmG;

        addMesh(new THREE.CapsuleGeometry(0.043, 0.2, 6, 14), sweaterMat, 0, -0.14, 0, forearmG);
        addMesh(new THREE.SphereGeometry(0.05, 14, 14), skinMat, 0, -0.3, 0, forearmG).scale.set(
          1,
          1.1,
          0.8,
        );
        return armG;
      }

      const armLeft = buildArm(-0.21);
      const armRight = buildArm(0.21);

      // Thumbs-up
      const thumb = addMesh(
        new THREE.CapsuleGeometry(0.016, 0.05, 4, 8),
        skinMat,
        0,
        -0.36,
        0.03,
        (armLeft as any).userData.forearm,
      );
      thumb.visible = false;

      // Briefcase in right hand
      const briefcase = new THREE.Group();
      (armRight as any).userData.forearm.add(briefcase);
      briefcase.position.set(0, -0.3, 0.01);
      addMesh(new THREE.BoxGeometry(0.34, 0.25, 0.09), leatherMat, 0, -0.175, 0, briefcase);
      addMesh(
        new THREE.TorusGeometry(0.06, 0.009, 8, 20, Math.PI),
        goldMat,
        0,
        -0.05,
        0,
        briefcase,
      );
      addMesh(new THREE.BoxGeometry(0.04, 0.02, 0.1), goldMat, 0, -0.1, 0, briefcase);
      briefcase.rotation.y = Math.PI / 2;

      // Animation State
      const IDLE_POSE = {
        lx: 0,
        lz: -0.08,
        lex: -0.15,
        ley: 0,
        rx: 0,
        rz: 0.06,
        rex: -0.1,
        rey: 0,
        yaw: 0,
        lean: 0,
        nod: 0,
        thumb: 0,
        smile: 0.45,
        bounce: 0,
        sway: 0,
        twist: 0,
      };
      const currentPose = { ...IDLE_POSE };

      let shotName: string | null = "enter";
      let shotTime = 0;
      let shotTimer: any = null;
      let focusKind: string | null = null;
      let isTyping = false;
      let typingTimer: any = null;

      triggerShotRef.current = (name: string, durationMs: number, cb?: () => void) => {
        shotName = name;
        shotTime = performance.now() / 1000;
        clearTimeout(shotTimer);
        shotTimer = setTimeout(() => {
          shotName = null;
          if (cb) cb();
        }, durationMs);
      };

      setFocusKindRef.current = (kind: string | null) => {
        focusKind = kind;
      };

      setIsTypingRef.current = (typing: boolean) => {
        isTyping = typing;
        clearTimeout(typingTimer);
        if (typing) {
          typingTimer = setTimeout(() => {
            isTyping = false;
          }, 900);
        }
      };

      // Pointer parallax
      const pointer = { x: 0, y: 0 };
      const onPointerMove = (e: PointerEvent) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      };
      window.addEventListener("pointermove", onPointerMove);

      function computeTargetPose(phase: string, elapsed: number, now: number) {
        const T = { ...IDLE_POSE };
        if (phase === "enter") {
          Object.assign(T, {
            lx: -0.1,
            lz: -2.6,
            lex: -0.3 + Math.sin(elapsed * 10) * 0.5,
            yaw: 0,
            smile: 1,
          });
        }
        if (phase === "email" || phase === "switch") {
          T.yaw = 0.45;
          T.lean = 0.1;
          if (phase === "switch") T.nod = 0.1;
        }
        if (phase === "typing") {
          T.yaw = 0.45;
          T.lean = 0.1 + Math.sin(now * 12) * 0.03;
          T.nod = 0.06 + Math.sin(now * 12) * 0.05;
        }
        if (phase === "password") {
          Object.assign(T, { lx: -1.3, lz: 0.5, lex: -1.75, yaw: -0.3 });
        }
        if (phase === "error") {
          Object.assign(T, {
            lz: -0.5,
            lex: -0.9,
            rz: 0.4,
            rex: -0.5,
            yaw: elapsed < 1.1 ? Math.sin(elapsed * 16) * 0.35 : 0,
            smile: 0.1,
          });
        }
        if (phase === "fail") {
          if (elapsed < 1.1) {
            Object.assign(T, {
              lz: -0.5,
              lex: -0.9,
              rz: 0.4,
              rex: -0.5,
              yaw: Math.sin(elapsed * 16) * 0.35,
              smile: 0.05,
            });
          } else {
            Object.assign(T, { lx: -1.3, lz: 0.5, lex: -1.75, nod: 0.25, smile: 0 });
          }
        }
        if (phase === "success") {
          if (elapsed < 0.6) {
            Object.assign(T, { lx: -1.1, lz: -0.25, lex: -1.4, nod: 0.1, thumb: 1, smile: 1 });
          } else {
            const d = elapsed - 0.6;
            const beat = d / 0.55;
            const pulse = Math.abs(Math.sin(beat * Math.PI));
            const side = Math.sin(beat * Math.PI);
            Object.assign(T, {
              smile: 1,
              bounce: pulse * 0.06,
              sway: side * 0.08,
              nod: 0.08 + pulse * 0.12,
            });
            if (d < 1.1) {
              Object.assign(
                T,
                Math.floor(beat) % 2 === 0 ? { lz: -2.4, lex: -0.4 } : { rz: 2.4, rex: -0.4 },
              );
              T.twist = side * 0.25;
            } else if (d < 2.2) {
              Object.assign(T, {
                lx: -2.6,
                rx: -2.6,
                lex: -0.5 + Math.sin(beat * Math.PI * 2) * 0.4,
                rex: -0.5 - Math.sin(beat * Math.PI * 2) * 0.4,
              });
            } else if (d < 3.3) {
              Object.assign(T, {
                lz: -1.5 + side * 0.5,
                rz: 1.5 + side * 0.5,
                lex: -0.2,
                rex: -0.2,
                twist: side * 0.6,
              });
            } else {
              Object.assign(T, {
                lz: -2.5,
                rz: 2.5,
                lex: -0.3 + Math.sin(beat * Math.PI * 3) * 0.4,
                rex: -0.3 - Math.sin(beat * Math.PI * 3) * 0.4,
              });
            }
          }
        }
        return T;
      }

      let lastTime = performance.now();

      function animateLoop(nowTime: number) {
        if (isDisposed) return;
        const dt = Math.min((nowTime - lastTime) / 1000, 0.05);
        lastTime = nowTime;
        const timeSec = nowTime / 1000;

        const currentPhase = reducedMotion
          ? "idle"
          : shotName ||
            (focusKind === "password"
              ? "password"
              : focusKind === "text"
                ? isTyping
                  ? "typing"
                  : "email"
                : "idle");

        const targetPose = computeTargetPose(currentPhase, timeSec - shotTime, timeSec);
        const lerpFactor = 1 - Math.exp(-9 * dt);

        for (const k in targetPose) {
          (currentPose as any)[k] +=
            ((targetPose as any)[k] - (currentPose as any)[k]) * lerpFactor;
        }

        // Rim lighting
        if (currentPhase === "success" && timeSec - shotTime > 0.6) {
          rimTarget.setHSL((timeSec * 0.6) % 1, 0.85, 0.62);
        } else {
          rimTarget.set(currentPhase === "fail" ? 0xff4d5e : 0x8b8cf6);
        }
        rimLights.forEach((r) => r.color.lerp(rimTarget, lerpFactor));

        // Breathing & Positional adjustments
        const breath = Math.sin((timeSec / 2.5) * Math.PI * 2);
        armLeft.rotation.set(currentPose.lx, 0, currentPose.lz);
        (armLeft as any).userData.forearm.rotation.set(currentPose.lex, currentPose.ley, 0);

        armRight.rotation.set(currentPose.rx, 0, currentPose.rz);
        (armRight as any).userData.forearm.rotation.set(currentPose.rex, currentPose.rey, 0);

        headGroup.rotation.set(currentPose.nod + breath * 0.008, currentPose.yaw, 0);

        let spin = 0;
        if (currentPhase === "success") {
          const u = Math.min(1, Math.max(0, (timeSec - shotTime - 4.05) / 0.85));
          spin = u * u * (3 - 2 * u) * Math.PI * 2;
        }
        bodyGroup.rotation.set(currentPose.lean, currentPose.twist + spin, currentPose.sway);
        mouth.scale.set(1, 0.15 + currentPose.smile * 0.85, 1);
        thumb.visible = currentPose.thumb > 0.5;

        torso.scale.set(1 + breath * 0.012, 1, 0.7 * (1 + breath * 0.025));
        bodyGroup.position.y = breath * 0.006 + currentPose.bounce;

        const dParallax = reducedMotion ? 0 : 1;
        camera.position.lerp(
          new THREE.Vector3(pointer.x * 0.5 * dParallax, 1 + pointer.y * 0.2 * dParallax, 5.4),
          1 - Math.exp(-3 * dt),
        );

        if (currentPhase === "fail" && !reducedMotion) {
          const e = timeSec - shotTime;
          if (e < 0.5) camera.position.x += Math.sin(e * 70) * 0.04 * (1 - e / 0.5);
        }

        camera.lookAt(0, 0.9, 0);

        // Resize check
        if (canvas) {
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          if (
            w &&
            h &&
            (canvas.width !== Math.round(w * renderer.getPixelRatio()) ||
              canvas.height !== Math.round(h * renderer.getPixelRatio()))
          ) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
          }
        }

        renderer.render(scene, camera);
        animFrameId = requestAnimationFrame(animateLoop);
      }

      animFrameId = requestAnimationFrame(animateLoop);

      return () => {
        isDisposed = true;
        cancelAnimationFrame(animFrameId);
        window.removeEventListener("pointermove", onPointerMove);
        renderer.dispose();
      };
    } catch (e) {
      console.warn("WebGL character initialization skipped:", e);
      return undefined;
    }
  }, [reducedMotion]);

  // Initial enter wave
  useEffect(() => {
    if (triggerShotRef.current) {
      triggerShotRef.current("enter", 1600);
    }
  }, []);

  const switchMode = (newMode: "login" | "signup") => {
    setMode(newMode);
    setFailedBanner(null);
    setEmailError("");
    setPasswordError("");
    setNameError("");
    setPhoneError("");
    setConfirmError("");
    if (triggerShotRef.current) {
      triggerShotRef.current("switch", 900);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailedBanner(null);

    let hasError = false;
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Please enter a valid email address.");
      hasError = true;
    } else {
      setEmailError("");
    }

    if (!password) {
      setPasswordError("Please enter your password.");
      hasError = true;
    } else {
      setPasswordError("");
    }

    if (hasError) {
      if (triggerShotRef.current) triggerShotRef.current("error", 1300);
      return;
    }

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsSubmitting(false);

    // Fail case trigger
    if (password === "wrong-password") {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      setFailedBanner(
        attempts >= 3
          ? "Still not working? You can reset your password or click Try Again."
          : "Incorrect email or password. Check both and try again.",
      );

      if (cardRef.current && failFxRef.current) {
        cardRef.current.classList.remove("card-shake");
        failFxRef.current.classList.remove("failfx-on");
        void cardRef.current.offsetWidth;
        cardRef.current.classList.add("card-shake");
        failFxRef.current.classList.add("failfx-on");
        setTimeout(() => {
          cardRef.current?.classList.remove("card-shake");
          failFxRef.current?.classList.remove("failfx-on");
        }, 1800);
      }

      if (triggerShotRef.current) triggerShotRef.current("fail", 2400);
      return;
    }

    // Success login
    setToastMessage("You're in! Taking you to your JobNex dashboard…");
    const doLoginRedirect = () => {
      login(email.trim(), role);
      router.push("/");
    };
    if (triggerShotRef.current) {
      triggerShotRef.current("success", 750, doLoginRedirect);
    }
    setTimeout(doLoginRedirect, 800);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (!fullName.trim() || fullName.trim().length < 2) {
      setNameError("Full name must be at least 2 characters.");
      hasError = true;
    } else setNameError("");

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Please enter a valid email address.");
      hasError = true;
    } else setEmailError("");

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      hasError = true;
    } else setPasswordError("");

    if (confirmPassword !== password) {
      setConfirmError("Passwords do not match.");
      hasError = true;
    } else setConfirmError("");

    if (hasError) {
      if (triggerShotRef.current) triggerShotRef.current("error", 1300);
      return;
    }

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsSubmitting(false);

    setToastMessage("Account created! Entering JobNex platform…");
    const doSignupRedirect = () => {
      login(email.trim(), role);
      router.push("/");
    };
    if (triggerShotRef.current) {
      triggerShotRef.current("success", 750, doSignupRedirect);
    }
    setTimeout(doSignupRedirect, 800);
  };

  const handleGoogleAuth = async () => {
    setIsGoogleSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsGoogleSubmitting(false);

    setToastMessage("Signed in via Google! Entering JobNex…");
    const doGoogleRedirect = () => {
      login(email || "google.user@jobnex.ai", role);
      router.push("/");
    };
    if (triggerShotRef.current) {
      triggerShotRef.current("success", 750, doGoogleRedirect);
    }
    setTimeout(doGoogleRedirect, 800);
  };

  return (
    <div className="relative w-full min-h-screen bg-[#014BAA] text-white font-sans overflow-x-hidden selection:bg-[#8B8CF6] selection:text-[#0b0b18]">
      {/* Ambient background glow layers */}
      <div
        className="absolute left-[-5%] top-[10%] w-[60%] h-[90%] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 55%, rgba(139,140,246,0.45), transparent 62%)",
        }}
        aria-hidden="true"
      />

      {/* Screen-wide shockwave on password failure */}
      <div
        ref={failFxRef}
        className="pointer-events-none fixed inset-0 z-30 opacity-0 transition-opacity"
        style={{
          background:
            "radial-gradient(ellipse at 28% 55%, rgba(255,60,90,0.45), transparent 60%), radial-gradient(ellipse at center, transparent 55%, rgba(120,0,20,0.55) 100%)",
        }}
      />

      {/* Top Left Accessibility Badges (Matching Original UI) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-colors"
        >
          <span>🔊 Sound: {soundEnabled ? "On" : "Off"}</span>
        </button>
        <button
          type="button"
          onClick={() => setReducedMotion(!reducedMotion)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-colors"
        >
          <span>🚫 Motion: {reducedMotion ? "Reduced" : "Normal"}</span>
        </button>
      </div>

      {/* Success Toast Banner */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-black/60 backdrop-blur-lg border border-white/20 text-white text-sm font-semibold shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Grid: 3D Stage + Form Card */}
      <main className="grid grid-cols-1 md:grid-cols-2 min-h-screen w-full">
        {/* 3D Character Canvas */}
        <section className="relative min-h-[380px] md:min-h-screen flex items-center justify-center pointer-events-auto">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </section>

        {/* Auth Panel Card */}
        <section className="flex items-center justify-center p-4 sm:p-6 md:p-8 z-10">
          <div
            ref={cardRef}
            className="w-full max-w-[430px] p-6 sm:p-8 rounded-[24px] border border-white/15 bg-white/[0.09] backdrop-blur-[16px] shadow-[0_0_60px_-20px_rgba(139,140,246,0.5)] transition-all"
          >
            {/* Logo */}
            <div className="flex items-center gap-2.5 text-2xl font-bold tracking-tight mb-1">
              <svg
                width="34"
                height="34"
                viewBox="0 0 34 34"
                aria-hidden="true"
                className="shrink-0"
              >
                <rect width="34" height="34" rx="9" fill="#8B8CF6" />
                <path
                  d="M11 9v11a4 4 0 0 0 8 0V9"
                  fill="none"
                  stroke="#0b0b18"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="24.5" cy="24.5" r="2.5" fill="#0b0b18" />
              </svg>
              <span className="text-white font-bold text-2xl">Jobnex</span>
            </div>
            <p className="text-sm text-white/60 mb-6">Find your next job, faster.</p>

            {/* Error Notification Banner */}
            {failedBanner && (
              <div className="mb-4 p-3.5 rounded-xl border border-rose-300/60 bg-rose-950/40 text-xs text-rose-100 flex flex-col gap-1.5 animate-in fade-in">
                <strong className="text-rose-200">Login failed</strong>
                <span>{failedBanner}</span>
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFailedBanner(null);
                      setPassword("");
                    }}
                    className="underline text-indigo-200 hover:text-white"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      alert("Password reset link has been dispatched to your email address.")
                    }
                    className="underline text-indigo-200 hover:text-white"
                  >
                    Reset password
                  </button>
                </div>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
                <div>
                  <h1 className="text-xl font-semibold text-white">Welcome back</h1>
                </div>

                {/* Email Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 block">Email</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      data-kind="text"
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (setIsTypingRef.current) setIsTypingRef.current(true);
                      }}
                      onFocus={() => setFocusKindRef.current?.("text")}
                      onBlur={() => setFocusKindRef.current?.(null)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B8CF6] focus:border-[#8B8CF6] transition-all"
                    />
                  </div>
                  {emailError && <p className="text-xs text-rose-200 font-medium">{emailError}</p>}
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-white/70 block">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      data-kind="password"
                      onChange={(e) => {
                        setPassword(e.target.value);
                      }}
                      onFocus={() => setFocusKindRef.current?.("password")}
                      onBlur={() => setFocusKindRef.current?.(null)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B8CF6] focus:border-[#8B8CF6] transition-all pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-white/60 hover:text-white px-1.5 py-1"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-xs text-rose-200 font-medium">{passwordError}</p>
                  )}
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-xs text-white/70 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded accent-[#8B8CF6]"
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => alert("Password reset instructions dispatched to your email.")}
                    className="underline text-indigo-200 hover:text-white"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-[#8B8CF6] hover:bg-[#9d9ef8] text-[#0b0b18] shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    "Login"
                  )}
                </button>

                {/* Google Sign-in */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isGoogleSubmitting}
                  className="w-full py-3 px-4 rounded-xl font-medium text-sm border border-white/20 bg-white/5 hover:bg-white/10 text-white transition-all flex items-center justify-center gap-2.5"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 17.4C3.7 21.1 7.5 24 12 24z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Switch to Signup */}
                <p className="text-center text-xs text-white/60 pt-2">
                  New to Jobnex?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="underline text-indigo-200 hover:text-white font-semibold"
                  >
                    Sign up
                  </button>
                </p>

                {/* Demo Hint */}
                <p className="text-center text-[11px] text-white/50 pt-2 border-t border-white/10 mt-3">
                  Demo: any valid details sign in. Password{" "}
                  <code className="bg-white/10 px-1 py-0.5 rounded">wrong-password</code> shows the
                  error.
                </p>
              </form>
            ) : (
              /* SIGNUP FORM */
              <form onSubmit={handleSignupSubmit} className="space-y-4" noValidate>
                <div>
                  <h1 className="text-xl font-semibold text-white">Create your account</h1>
                </div>

                {/* Role Switcher */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 border border-white/15 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setRole("JOB_SEEKER")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                      role === "JOB_SEEKER"
                        ? "bg-[#8B8CF6] text-[#0b0b18]"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    Job Seeker
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("RECRUITER")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                      role === "RECRUITER"
                        ? "bg-[#8B8CF6] text-[#0b0b18]"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    Recruiter
                  </button>
                </div>

                {/* Full Name */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-white/70 block">Full name</label>
                  <input
                    type="text"
                    value={fullName}
                    data-kind="text"
                    onChange={(e) => setFullName(e.target.value)}
                    onFocus={() => setFocusKindRef.current?.("text")}
                    onBlur={() => setFocusKindRef.current?.(null)}
                    placeholder="Your Full Name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B8CF6]"
                  />
                  {nameError && <p className="text-xs text-rose-200">{nameError}</p>}
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-white/70 block">Email</label>
                  <input
                    type="email"
                    value={email}
                    data-kind="text"
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusKindRef.current?.("text")}
                    onBlur={() => setFocusKindRef.current?.(null)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B8CF6]"
                  />
                  {emailError && <p className="text-xs text-rose-200">{emailError}</p>}
                </div>

                {/* Phone */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-white/70 block">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    data-kind="text"
                    onChange={(e) => setPhone(e.target.value)}
                    onFocus={() => setFocusKindRef.current?.("text")}
                    onBlur={() => setFocusKindRef.current?.(null)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B8CF6]"
                  />
                  {phoneError && <p className="text-xs text-rose-200">{phoneError}</p>}
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-white/70 block">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      data-kind="password"
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusKindRef.current?.("password")}
                      onBlur={() => setFocusKindRef.current?.(null)}
                      placeholder="Minimum 8 characters"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B8CF6] pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/60 hover:text-white"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {passwordError && <p className="text-xs text-rose-200">{passwordError}</p>}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-white/70 block">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      data-kind="password"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocusKindRef.current?.("password")}
                      onBlur={() => setFocusKindRef.current?.(null)}
                      placeholder="Repeat password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B8CF6] pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/60 hover:text-white"
                    >
                      {showConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {confirmError && <p className="text-xs text-rose-200">{confirmError}</p>}
                </div>

                {/* Submit Signup */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-[#8B8CF6] hover:bg-[#9d9ef8] text-[#0b0b18] shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-2"
                >
                  {isSubmitting ? "Creating account…" : "Create account"}
                </button>

                {/* Switch to Login */}
                <p className="text-center text-xs text-white/60 pt-2">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="underline text-indigo-200 hover:text-white font-semibold"
                  >
                    Login
                  </button>
                </p>
              </form>
            )}
          </div>
        </section>
      </main>

      <style>{`
        @keyframes cardShake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(5px); }
          30%, 50%, 70% { transform: translateX(-9px); }
          40%, 60% { transform: translateX(9px); }
        }
        .card-shake {
          animation: cardShake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
        @keyframes failFxAnim {
          0% { opacity: 0; }
          15% { opacity: 1; }
          100% { opacity: 0; }
        }
        .failfx-on {
          animation: failFxAnim 1.8s ease-out both;
        }
      `}</style>
    </div>
  );
}
