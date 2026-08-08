import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface CheckRequest {
  job_text: string;
  company_name?: string;
  domain?: string;
  domain_age_days?: number;
}

interface RedFlag {
  type: string;
  description: string;
  severity: "low" | "medium" | "high";
}

interface AnalysisResult {
  risk_score: number;
  risk_level: "safe" | "cautious" | "high_risk";
  red_flags: RedFlag[];
  verdict: string;
  advice: string;
}

// Models are tried in order — free tier first, paid fallbacks after.
// OpenRouter deprecates / rate-limits models frequently, so we fail over.
const MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-4o-mini",
  "google/gemini-2.0-flash-001",
  "anthropic/claude-3.5-haiku",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<
  { ok: true; data: any } | { ok: false; status: number; message: string }
> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://jobshield.app",
      "X-OpenRouter-Title": "JobShield",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    }),
  });

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // non-JSON error body
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: data?.error?.message || data?.message || raw.slice(0, 300),
    };
  }

  return { ok: true, data };
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const body: CheckRequest = await req.json();
    const { job_text, company_name, domain, domain_age_days } = body;

    if (!job_text || job_text.trim().length < 10) {
      return jsonResponse({ error: "Job text must be at least 10 characters" }, 400);
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "Server configuration error: missing OPENROUTER_API_KEY" }, 500);
    }

    const systemPrompt = `You are a job scam detection expert. Analyze job postings and recruiter messages for scam indicators.

Return a JSON object with this exact structure:
{
  "risk_score": number between 0-100,
  "risk_level": "safe" (≥70) | "cautious" (40-69) | "high_risk" (<40),
  "red_flags": [
    {
      "type": "short_category_name",
      "description": "specific explanation of this red flag",
      "severity": "low" | "medium" | "high"
    }
  ],
  "verdict": "one-line verdict summarizing the analysis",
  "advice": "specific actionable advice for the job seeker"
}

Scoring guidelines:
- HIGH risk indicators (70+ points each): requests money/upfront payment, asks for credit card/bank details, guarantees unrealistic salary, no interview needed, uses free email (gmail/yahoo) for "company" correspondence
- MEDIUM risk indicators (40-70 points each): poor grammar/spelling, vague job description, mismatched company/role, urgent hiring pressure, requests personal documents upfront
- LOW risk indicators (10-40 points each): newly registered domain (<1 year on company domain), generic job title, limited company online presence
- Deductions: legitimate company with verifiable domain (-20), proper interview process described (-15), reasonable salary range (-10), well-written professional posting (-10)`;

    const domainInfo = domain
      ? `\nCompany domain: ${domain}${domain_age_days !== undefined ? `\nDomain age: ${domain_age_days} days` : ""}`
      : "";
    const companyInfo = company_name ? `\nCompany name: ${company_name}` : "";

    const userPrompt = `Analyze this job posting for scam indicators:${companyInfo}${domainInfo}\n\n---\n${job_text}\n---\n\nRespond with ONLY the JSON object.`;

    // Try models in order until one succeeds
    const failures: string[] = [];

    for (const model of MODELS) {
      console.log(`Trying model: ${model}`);
      const result = await callOpenRouter(apiKey, model, systemPrompt, userPrompt);

      if (!result.ok) {
        failures.push(`${model}: HTTP ${result.status} — ${result.message}`);
        console.error("OpenRouter error", result.status, result.message, "model:", model);
        continue;
      }

      const content = result.data?.choices?.[0]?.message?.content;
      if (!content) {
        failures.push(`${model}: empty response`);
        continue;
      }

      // Parse the JSON from the response (may be wrapped in markdown code blocks)
      try {
        const jsonStr = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const analysis = JSON.parse(jsonStr) as AnalysisResult;

        if (
          typeof analysis.risk_score !== "number" ||
          !["safe", "cautious", "high_risk"].includes(analysis.risk_level)
        ) {
          throw new Error("invalid risk fields");
        }

        // Ensure risk_score consistency with risk_level
        const computedLevel =
          analysis.risk_score >= 70
            ? "safe"
            : analysis.risk_score >= 40
              ? "cautious"
              : "high_risk";
        analysis.risk_level = computedLevel;
        analysis.red_flags = Array.isArray(analysis.red_flags) ? analysis.red_flags : [];

        // Scoring consistency: cap risk_score so AI's number never contradicts its own red flags
        const highSeverityCount = analysis.red_flags.filter(
          (f) => f.severity === "high"
        ).length;
        if (highSeverityCount >= 2 && analysis.risk_score > 35) {
          analysis.risk_score = 35;
        } else if (highSeverityCount === 1 && analysis.risk_score > 55) {
          analysis.risk_score = 55;
        }

        return jsonResponse(analysis, 200);
      } catch {
        failures.push(`${model}: unparseable response`);
        console.error("Failed to parse AI response model:", model, content);
      }
    }

    // All models failed — surface the first failure so we can diagnose
    const firstFailure = failures[0] || "All models unavailable";
    return jsonResponse(
      { error: `AI analysis service unavailable (${firstFailure}). Please try again.` },
      502,
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse({ error: "An unexpected error occurred. Please try again." }, 500);
  }
});