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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const body: CheckRequest = await req.json();
    const { job_text, company_name, domain, domain_age_days } = body;

    if (!job_text || job_text.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Job text must be at least 10 characters" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
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

    const openrouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://jobshield.app",
          "X-OpenRouter-Title": "JobShield",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 1024,
        }),
      }
    );

    if (!openrouterResponse.ok) {
      const errorText = await openrouterResponse.text();
      console.error("OpenRouter error:", openrouterResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI analysis service unavailable. Please try again." }),
        { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const openrouterData = await openrouterResponse.json();
    const content = openrouterData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No analysis returned. Please try again." }),
        { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Parse the JSON from the response (it may be wrapped in markdown code blocks)
    let analysis: AnalysisResult;
    try {
      const jsonStr = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse analysis. Please try again." }),
        { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Validate the analysis
    if (
      typeof analysis.risk_score !== "number" ||
      !["safe", "cautious", "high_risk"].includes(analysis.risk_level)
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid analysis format. Please try again." }),
        { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Ensure risk_score consistency with risk_level
    const computedLevel =
      analysis.risk_score >= 70
        ? "safe"
        : analysis.risk_score >= 40
          ? "cautious"
          : "high_risk";
    analysis.risk_level = computedLevel;

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});