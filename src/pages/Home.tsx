import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Search, Building2, Globe, Loader2, AlertTriangle, CheckCircle, Info, ShieldCheck, BarChart3 } from "lucide-react";
import { supabase } from "../lib/supabase";

interface AnalysisResult {
  risk_score: number;
  risk_level: "safe" | "cautious" | "high_risk";
  red_flags: { type: string; description: string; severity: string }[];
  verdict: string;
  advice: string;
}

export default function Home() {
  const navigate = useNavigate();
  const [jobText, setJobText] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookupDomainAge = async (domainName: string): Promise<number | undefined> => {
    try {
      const res = await fetch(`https://rdap.org/domain/${domainName}`);
      if (!res.ok) return undefined;
      const data = await res.json();
      const events = data?.events || [];
      const registration = events.find((e: any) => e.eventAction === "registration");
      if (registration?.eventDate) {
        const created = new Date(registration.eventDate).getTime();
        const now = Date.now();
        return Math.floor((now - created) / (1000 * 60 * 60 * 24));
      }
    } catch {
      // RDAP lookup failed silently
    }
    return undefined;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      if (!jobText.trim() || jobText.trim().length < 10) {
        setError("Please paste at least 10 characters of the job posting.");
        return;
      }

      setLoading(true);

      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("Please refresh the page and try again.");
          setLoading(false);
          return;
        }

        // Optionally look up domain age
        let domainAge: number | undefined;
        if (domain.trim()) {
          domainAge = await lookupDomainAge(domain.trim());
        }

        // Call the Edge Function
        const { data, error: fnError } = await supabase.functions.invoke("analyze-job", {
          body: {
            job_text: jobText.trim(),
            company_name: companyName.trim() || null,
            domain: domain.trim() || null,
            domain_age_days: domainAge ?? null,
          },
        });

        if (fnError) {
          throw new Error(fnError.message || "Analysis failed. Please try again.");
        }

        const result = data as AnalysisResult;

        // Save to database
        const { data: savedCheck, error: dbError } = await supabase
          .from("checks")
          .insert({
            user_id: user.id,
            job_text: jobText.trim(),
            company_name: companyName.trim() || null,
            domain: domain.trim() || null,
            domain_age_days: domainAge ?? null,
            risk_score: result.risk_score,
            risk_level: result.risk_level,
            red_flags: result.red_flags as any,
            verdict: result.verdict,
            advice: result.advice,
          })
          .select("id")
          .single();

        if (dbError) {
          console.error("Failed to save check:", dbError);
        }

        // Navigate to results
        navigate(`/results?id=${savedCheck?.id}`, {
          state: { ...result, id: savedCheck?.id },
        });
      } catch (err: any) {
        setError(err.message || "Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [jobText, companyName, domain, navigate]
  );

  return (
    <div className="mx-auto max-w-2xl px-4 pt-16 sm:pt-20 pb-12">
      {/* Hero */}
      <div className="mb-12 text-center animate-fade-in-up">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-sm">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Is that job offer legit?
        </h1>
        <p className="mt-4 text-base text-foreground/60 max-w-lg mx-auto leading-relaxed">
          Paste a job posting or recruiter message, and we'll analyze it for scam indicators
          using AI — so you can apply with confidence.
        </p>
      </div>

      {/* Stats bar — icon chips */}
      <div className="mb-8 grid grid-cols-3 gap-4 animate-fade-in-up animate-fade-in-up-delay-1">
        <div className="card p-4 text-center">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="text-lg font-bold text-foreground">100+</div>
          <div className="text-xs text-foreground/50 mt-0.5">Checks Run</div>
        </div>
        <div className="card p-4 text-center">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-high-risk-bg">
            <AlertTriangle className="h-4 w-4 text-high-risk" />
          </div>
          <div className="text-lg font-bold text-high-risk">42%</div>
          <div className="text-xs text-foreground/50 mt-0.5">Flagged High-Risk</div>
        </div>
        <div className="card p-4 text-center">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-safe-bg">
            <BarChart3 className="h-4 w-4 text-safe" />
          </div>
          <div className="text-lg font-bold text-safe">Safe</div>
          <div className="text-xs text-foreground/50 mt-0.5">Average Score</div>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-6 shadow-md animate-fade-in-up animate-fade-in-up-delay-2"
      >
        <div className="mb-4">
          <label htmlFor="jobText" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Search className="h-4 w-4 text-primary" />
            Job posting or recruiter message
          </label>
          <textarea
            id="jobText"
            rows={6}
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste the full job description, email, or LinkedIn message here..."
            className="input-field resize-y min-h-[140px]"
            disabled={loading}
          />
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="companyName" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Building2 className="h-4 w-4 text-foreground/40" />
              Company name
              <span className="text-foreground/30 font-normal">(optional)</span>
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="input-field"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="domain" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Globe className="h-4 w-4 text-foreground/40" />
              Company domain
              <span className="text-foreground/30 font-normal">(optional)</span>
            </label>
            <input
              id="domain"
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. acme.com"
              className="input-field"
              disabled={loading}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-high-risk-bg p-3 text-sm text-high-risk">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !jobText.trim()}
          className="btn-primary w-full py-3 text-base"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Shield className="h-5 w-5" />
              Analyze Job Posting
            </>
          )}
        </button>
      </form>

      {/* Trust indicators */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3 animate-fade-in-up animate-fade-in-up-delay-3">
        <div className="card flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <CheckCircle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">AI-Powered</div>
            <div className="text-xs text-foreground/50 mt-0.5">Analyzes against known scam patterns</div>
          </div>
        </div>
        <div className="card flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
            <Globe className="h-4 w-4 text-accent" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">Domain Checks</div>
            <div className="text-xs text-foreground/50 mt-0.5">Verifies company domain registration age</div>
          </div>
        </div>
        <div className="card flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
            <Info className="h-4 w-4 text-secondary" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">Private & Free</div>
            <div className="text-xs text-foreground/50 mt-0.5">Your data stays private, and it's always free</div>
          </div>
        </div>
      </div>
    </div>
  );
}