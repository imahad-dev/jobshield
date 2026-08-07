import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  History,
  BarChart3,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Clock,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import type { CheckRow } from "../lib/database.types";

interface CommunityStats {
  total: number;
  highRisk: number;
  cautious: number;
  safe: number;
  highRiskPercent: number;
}

export default function Dashboard() {
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [stats, setStats] = useState<CommunityStats>({
    total: 0,
    highRisk: 0,
    cautious: 0,
    safe: 0,
    highRiskPercent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("Please refresh the page.");
          setLoading(false);
          return;
        }

        // Load user's checks
        const { data: userChecks, error: checksError } = await supabase
          .from("checks")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (checksError) throw checksError;
        setChecks(userChecks || []);

        // Load community stats
        const { data: allChecks, error: statsError } = await supabase
          .from("checks")
          .select("risk_level");

        if (statsError) throw statsError;

        const total = allChecks?.length || 0;
        const highRisk = allChecks?.filter((c) => c.risk_level === "high_risk").length || 0;
        const cautious = allChecks?.filter((c) => c.risk_level === "cautious").length || 0;
        const safe = allChecks?.filter((c) => c.risk_level === "safe").length || 0;

        setStats({
          total,
          highRisk,
          cautious,
          safe,
          highRiskPercent: total > 0 ? Math.round((highRisk / total) * 100) : 0,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-safe";
    if (score >= 40) return "text-cautious";
    return "text-high-risk";
  };

  const getScoreBadge = (level: string) => {
    switch (level) {
      case "safe":
        return "bg-safe-bg text-safe border-safe/20";
      case "cautious":
        return "bg-cautious-bg text-cautious border-cautious/20";
      case "high_risk":
        return "bg-high-risk-bg text-high-risk border-high-risk/20";
      default:
        return "bg-muted text-foreground/60";
    }
  };

  const getScoreLabel = (level: string) => {
    switch (level) {
      case "safe":
        return "Safe";
      case "cautious":
        return "Caution";
      case "high_risk":
        return "High Risk";
      default:
        return level;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-foreground/60">Loading your history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold text-foreground">
          <History className="h-6 w-6 text-primary" />
          Your Dashboard
        </h1>
        <p className="mt-1.5 text-sm text-foreground/60">
          View your check history and community-wide scam statistics.
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg bg-high-risk-bg p-3 text-sm text-high-risk">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Community stats */}
      <div className="mb-8 animate-fade-in-up animate-fade-in-up-delay-1">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="h-4 w-4 text-primary" />
          Community Overview
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="mt-1 text-xs text-foreground/50">Total Checks</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-high-risk">{stats.highRisk}</div>
            <div className="mt-1 text-xs text-foreground/50">High Risk</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-cautious">{stats.cautious}</div>
            <div className="mt-1 text-xs text-foreground/50">Cautious</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-safe">{stats.safe}</div>
            <div className="mt-1 text-xs text-foreground/50">Safe</div>
          </div>
        </div>
        {stats.total > 0 && (
          <div className="mt-3 card p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground/60">
                {stats.highRiskPercent}% of all checks were flagged as high-risk
              </span>
              <div className="flex h-2 gap-0.5 rounded-full overflow-hidden w-32">
                <div
                  className="bg-high-risk transition-all"
                  style={{ width: `${(stats.highRisk / stats.total) * 100}%` }}
                />
                <div
                  className="bg-cautious transition-all"
                  style={{ width: `${(stats.cautious / stats.total) * 100}%` }}
                />
                <div
                  className="bg-safe transition-all"
                  style={{ width: `${(stats.safe / stats.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="animate-fade-in-up animate-fade-in-up-delay-2">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock className="h-4 w-4 text-primary" />
          Recent Checks
        </h2>

        {checks.length === 0 ? (
          <div className="card p-8 text-center">
            <Shield className="mx-auto h-10 w-10 text-foreground/20" />
            <p className="mt-3 font-medium text-foreground">No checks yet</p>
            <p className="mt-1 text-sm text-foreground/50">
              Analyze your first job posting to see results here.
            </p>
            <Link to="/" className="btn-primary mt-4 inline-flex">
              Analyze a job
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {checks.map((check) => (
              <Link
                key={check.id}
                to={`/results?id=${check.id}`}
                className="block card p-4 transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${getScoreBadge(check.risk_level)}`}
                      >
                        {check.risk_level === "safe" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : check.risk_level === "high_risk" ? (
                          <ShieldAlert className="h-3 w-3" />
                        ) : (
                          <ShieldAlert className="h-3 w-3" />
                        )}
                        {getScoreLabel(check.risk_level)}
                      </span>
                      {check.company_name && (
                        <span className="truncate text-sm text-foreground/60">
                          {check.company_name}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-foreground/70">
                      {check.job_text}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-foreground/40">
                        {formatDate(check.created_at)}
                      </span>
                      <span className={`text-xs font-medium ${getScoreColor(check.risk_score)}`}>
                        Score: {check.risk_score}
                      </span>
                    </div>
                    {check.user_verification && (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-foreground/50">
                        {check.user_verification === "confirmed_scam" ? (
                          <>
                            <ThumbsDown className="h-3 w-3 text-high-risk" />
                            <span className="text-high-risk">Confirmed scam</span>
                          </>
                        ) : (
                          <>
                            <ThumbsUp className="h-3 w-3 text-safe" />
                            <span className="text-safe">Confirmed legitimate</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-foreground/20" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}