import { useEffect, useState } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { supabase } from "../lib/supabase";

interface RedFlag {
  type: string;
  description: string;
  severity: "low" | "medium" | "high";
}

interface AnalysisResult {
  id?: string;
  risk_score: number;
  risk_level: "safe" | "cautious" | "high_risk";
  red_flags: RedFlag[];
  verdict: string;
  advice: string;
  domain?: string;
  domain_age_days?: number | null;
  company_name?: string;
}

export default function Results() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [result, setResult] = useState<AnalysisResult | null>(location.state as AnalysisResult | null);
  const [loading, setLoading] = useState(!result);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkId = searchParams.get("id");
    if (!checkId) {
      setLoading(false);
      setError("No analysis found.");
      return;
    }

    // If we already have state, no need to fetch
    if (result) {
      setLoading(false);
      return;
    }

    // Fetch from DB
    supabase
      .from("checks")
      .select("*")
      .eq("id", checkId)
      .single()
      .then(({ data, error: dbError }) => {
        if (dbError || !data) {
          setError("Analysis not found. It may have been deleted.");
        } else {
          setResult({
            id: data.id,
            risk_score: data.risk_score,
            risk_level: data.risk_level as "safe" | "cautious" | "high_risk",
            red_flags: data.red_flags as unknown as RedFlag[],
            verdict: data.verdict,
            advice: data.advice,
            domain: data.domain || undefined,
            domain_age_days: data.domain_age_days,
            company_name: data.company_name || undefined,
          });
        }
        setLoading(false);
      });
  }, [searchParams, result]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-foreground/60">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive/60" />
        <h2 className="mt-4 text-xl font-semibold">Analysis not found</h2>
        <p className="mt-2 text-sm text-foreground/60">{error || "This analysis doesn't exist or has been removed."}</p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          <ArrowLeft className="h-4 w-4" />
          Check a new job
        </Link>
      </div>
    );
  }

  const { risk_score, risk_level, red_flags, verdict, advice } = result;

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-safe";
    if (score >= 40) return "text-cautious";
    return "text-high-risk";
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-high-risk-bg text-high-risk border-high-risk/20";
      case "medium":
        return "bg-cautious-bg text-cautious border-cautious/20";
      case "low":
        return "bg-muted text-foreground/60 border-border";
      default:
        return "bg-muted text-foreground/60 border-border";
    }
  };

  const getLevelIcon = () => {
    switch (risk_level) {
      case "safe":
        return <ShieldCheck className="h-8 w-8 text-safe" />;
      case "cautious":
        return <ShieldAlert className="h-8 w-8 text-cautious" />;
      case "high_risk":
        return <ShieldAlert className="h-8 w-8 text-high-risk" />;
    }
  };

  const getLevelLabel = () => {
    switch (risk_level) {
      case "safe":
        return "Looks Safe";
      case "cautious":
        return "Proceed with Caution";
      case "high_risk":
        return "High Risk — Likely Scam";
    }
  };

  const getLevelBg = () => {
    switch (risk_level) {
      case "safe":
        return "bg-safe-bg border-safe/20";
      case "cautious":
        return "bg-cautious-bg border-cautious/20";
      case "high_risk":
        return "bg-high-risk-bg border-high-risk/20";
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      {/* Back link */}
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Check another job
      </Link>

      {/* Verdict banner */}
      <div className={`rounded-2xl border p-6 mb-6 ${getLevelBg()} animate-fade-in-up`}>
        <div className="flex items-start gap-4">
          <div className="shrink-0">{getLevelIcon()}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{getLevelLabel()}</h2>
            <p className="mt-1 text-sm text-foreground/70">{verdict}</p>
          </div>
        </div>
      </div>

      {/* Score card */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 animate-fade-in-up animate-fade-in-up-delay-1">
        <div className="card p-5 text-center">
          <div className="text-xs font-medium uppercase tracking-wider text-foreground/40 mb-2">
            Trust Score
          </div>
          <div className={`text-4xl font-bold ${getScoreColor(risk_score)}`}>
            {risk_score}
            <span className="text-lg font-normal text-foreground/30">/100</span>
          </div>
          <div className={`mt-2 h-2 w-full rounded-full bg-muted overflow-hidden`}>
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                risk_score >= 70
                  ? "bg-safe"
                  : risk_score >= 40
                    ? "bg-cautious"
                    : "bg-high-risk"
              }`}
              style={{ width: `${risk_score}%` }}
            />
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-foreground/40 mb-2">
            Domain Age
          </div>
          {result.domain ? (
            <>
              <div className="text-lg font-semibold text-foreground">
                {result.domain_age_days !== null && result.domain_age_days !== undefined
                  ? result.domain_age_days < 365
                    ? `${result.domain_age_days} days`
                    : `${Math.floor(result.domain_age_days / 365)} years`
                  : "Unknown"}
              </div>
              <div className="mt-1 text-xs text-foreground/50">{result.domain}</div>
            </>
          ) : (
            <div className="text-sm text-foreground/50">No domain provided</div>
          )}
        </div>
      </div>

      {/* Red flags */}
      {red_flags.length > 0 && (
        <div className="mb-6 animate-fade-in-up animate-fade-in-up-delay-2">
          <h3 className="mb-3 font-semibold text-foreground">
            Red Flags Identified ({red_flags.length})
          </h3>
          <div className="space-y-2.5">
            {red_flags.map((flag, index) => (
              <div
                key={index}
                className={`rounded-xl border p-4 ${getSeverityColor(flag.severity)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-sm font-medium capitalize">{flag.type.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-1 text-sm opacity-80">{flag.description}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-white/50 px-2 py-0.5 text-xs font-medium capitalize">
                    {flag.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advice */}
      <div className="mb-8 card p-5 animate-fade-in-up animate-fade-in-up-delay-3">
        <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
          <CheckCircle className="h-4 w-4 text-accent" />
          What to do next
        </h3>
        <p className="text-sm text-foreground/70 leading-relaxed">{advice}</p>
      </div>

      {/* Verify again */}
      <div className="text-center animate-fade-in-up animate-fade-in-up-delay-4">
        <Link to="/" className="btn-primary">
          <RefreshCw className="h-4 w-4" />
          Check another job
        </Link>
      </div>
    </div>
  );
}