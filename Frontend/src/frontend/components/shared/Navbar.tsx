import React, { useEffect, useState } from "react";
import { Link } from "@/lib/nav";
import { usePathname } from "@/lib/nav";
import { useJobNex } from "@/frontend/context/JobNexContext";
import { Button } from "@/frontend/components/ui/button";
import {
  Briefcase,
  Home,
  BookOpen,
  BrainCircuit,
  BarChart3,
  Send,
  Zap,
  ShieldCheck,
  FileText,
  UserCheck,
  Menu,
  X,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { currentUser, isLoggedIn, logout } = useJobNex();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      setScrolled(scrollY > 40);
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  const isAdmin = currentUser?.role === "ADMIN" || currentUser?.role === "RECRUITER";

  const navLinks = [
    { name: "Home", href: "/", icon: Home },
    { name: "Jobs", href: "/jobs", icon: Briefcase },
    { name: "Resume Builder", href: "/resume-builder", icon: FileText },
    { name: "Interview Prep", href: "/interview-prep", icon: BrainCircuit },
    { name: "Skill Gap", href: "/skill-gap", icon: BarChart3 },
    { name: "Auto-Apply", href: "/auto-apply", icon: Zap },
    { name: "Referral", href: "/cold-referral", icon: Send },
    { name: "Dashboard", href: "/dashboard", icon: UserCheck },
    { name: "Resume & Privacy", href: "/resume-privacy", icon: ShieldCheck },
    ...(isAdmin ? [{ name: "Admin", href: "/admin/jobs", icon: ShieldCheck }] : []),
    { name: "AI Agent", href: "/ai-assistant", icon: BrainCircuit },
  ];

  return (
    <>
    <div
      style={{ width: `${scrollProgress}%` }}
      className="fixed top-0 left-0 h-[3px] bg-brand-600 z-[60] transition-all duration-75 pointer-events-none"
    />
    <header
      className={`fixed top-0 left-0 right-0 w-full z-50 border-b border-border transition-all duration-200 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
          : "bg-white shadow-none"
      }`}
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
        <div className={`flex items-center justify-between gap-4 transition-all duration-200 ${scrolled ? "h-[60px]" : "h-[72px]"}`}>
          {/* Logo */}
          <Link
            href="/"
            aria-label="JobNex home"
            className="flex shrink-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="w-10 h-10 rounded-md bg-brand-600 flex items-center justify-center text-primary-foreground">
              <Briefcase className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center">
                <span className="font-bold text-2xl leading-6 text-foreground">
                  Job<span className="text-brand-600">Nex</span>
                </span>
              </div>
              <p className="text-[11px] leading-4 font-medium text-muted-foreground whitespace-nowrap">
                Career Network
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            className="hidden min-[1100px]:flex items-center justify-center flex-1 min-w-0"
            style={{ fontSize: "clamp(11.5px, 0.78vw, 13.5px)", gap: "clamp(3px, 0.6vw, 10px)", whiteSpace: "nowrap", overflow: "hidden" }}
            aria-label="Main navigation"
          >
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-1 px-1.5 py-1 text-xs font-medium whitespace-nowrap rounded-md transition-colors ${
                    isActive
                      ? "bg-brand-600 text-white font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="hidden w-3.5 h-3.5" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Auth Section */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Profile Avatar & Login */}
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/resume-privacy"
                  className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-brand-600 transition-colors"
                >
                  <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-border">
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="hidden lg:inline">{currentUser.name.split(" ")[0]}</span>
                </Link>
                <Button
                  variant="ghost"
                  onClick={logout}
                  className="h-8 px-1 text-xs text-muted-foreground hover:text-foreground font-medium"
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-foreground hover:text-brand-600 px-3 py-1.5 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="btn-polish text-xs font-medium bg-brand-600 hover:bg-brand-700 text-primary-foreground px-3.5 py-2"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger button */}
          <div className="flex items-center gap-2 min-[1100px]:hidden">
            <Button
              variant="ghost"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="min-[1100px]:hidden max-h-[calc(100dvh-72px)] overflow-y-auto bg-background border-b border-border px-4 pt-2 pb-6 space-y-2 shadow-sm animate-in slide-in-from-top">
          <div className="grid grid-cols-2 gap-2 pt-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg ${
                    isActive
                      ? "bg-brand-600 text-primary-foreground"
                      : "text-foreground bg-muted hover:bg-accent"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
    <div className="h-[72px] w-full" aria-hidden="true" />
    </>
  );
};
