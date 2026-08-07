import { useEffect, useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Shield, History, Menu, X } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.signInAnonymously().then(() => {});
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { to: "/", label: "Check", icon: Shield },
    { to: "/dashboard", label: "History", icon: History },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary text-sm font-bold">
              JS
            </div>
            <span className="text-lg font-semibold text-foreground">JobShield</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 sm:flex">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive(link.to)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/60 hover:bg-muted hover:text-foreground"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-foreground/60 hover:bg-muted sm:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="border-t border-border px-4 py-3 sm:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(link.to)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/60 hover:bg-muted"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-foreground/40">
        <p>JobShield — Protect yourself from job scams. Always verify before applying.</p>
      </footer>
    </div>
  );
}