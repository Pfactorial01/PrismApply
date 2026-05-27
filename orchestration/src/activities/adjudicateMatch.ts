import "dotenv/config";
import OpenAI from "openai";
import {
  FINAL_SCORE_FLOOR,
  reconcileAdjudicationSeniority,
  compareSeniority,
  type AdjudicationResult,
  type JobFacts,
  type ScoreBreakdown,
  type UserPreferences,
} from "../matching/index.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const rawModel = process.env.MATCH_ADJUDICATION_MODEL ?? process.env.MODEL ?? "gpt-4o-mini";
const model = rawModel.includes("/") ? rawModel.split("/").pop()! : rawModel;

export interface JobMatchContext {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
}

const ADJUDICATION_SYSTEM = `You are a job matching adjudicator. Given a user's hard preferences and a job posting, decide if this job should be recommended.

Rules:
- recommend=false if ANY hard preference or dealbreaker would be violated
- preference_violations must list specific violations (empty if none)
- Seniority target is a MINIMUM, not an exact level. Jobs at the user's target level are ideal (seniority_fit=good). Jobs ABOVE the target are acceptable (seniority_fit=over) — do NOT treat a more senior title as a preference violation. Only reject seniority when the job is clearly BELOW the user's target (seniority_fit=under).
- Be conservative on dealbreakers (defense, crypto, gambling, on-call, ads)`;

/**
 * Layer 3: structured LLM check for preference adherence and fit.
 */
export async function adjudicateMatch(
  prefs: UserPreferences,
  facts: JobFacts,
  job: JobMatchContext,
  score: ScoreBreakdown,
): Promise<AdjudicationResult> {
  const user = `## User hard preferences
${prefs.hardPreferenceBullets.map((b) => `- ${b}`).join("\n")}

## Job
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? "unknown"}
Remote policy: ${facts.remotePolicy}
Seniority: ${facts.seniorityLevel}
Employment: ${facts.employmentType}
Industry signals: ${facts.industryTags.join(", ") || "none"}
On-call: ${facts.hasHeavyOncall ? "yes" : "no"}
Visa sponsorship: ${facts.requiresSponsorship === undefined ? "unknown" : facts.requiresSponsorship ? "yes" : "no"}

Description excerpt:
${(job.description ?? "").slice(0, 4000)}

## Vector score summary
final=${score.finalScore.toFixed(3)} resume=${score.resumePosting.toFixed(3)} skills=${score.skillsReqs.toFixed(3)}`;

  try {
    const res = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: ADJUDICATION_SYSTEM },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "match_adjudication",
          strict: true,
          schema: {
            type: "object",
            properties: {
              recommend: { type: "boolean" },
              fit_score: { type: "number" },
              preference_violations: { type: "array", items: { type: "string" } },
              strengths: { type: "array", items: { type: "string" } },
              gaps: { type: "array", items: { type: "string" } },
              seniority_fit: {
                type: "string",
                enum: ["good", "stretch", "under", "over"],
              },
            },
            required: [
              "recommend",
              "fit_score",
              "preference_violations",
              "strengths",
              "gaps",
              "seniority_fit",
            ],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.1,
    });

    const raw = res.choices[0]?.message?.content;
    if (!raw) {
      return finalizeAdjudication(prefs, facts, fallback(score, prefs, facts));
    }
    const parsed = JSON.parse(raw) as {
      recommend: boolean;
      fit_score: number;
      preference_violations: string[];
      strengths: string[];
      gaps: string[];
      seniority_fit: string;
    };
    return finalizeAdjudication(prefs, facts, {
      recommend: parsed.recommend,
      fitScore: Math.round(parsed.fit_score),
      preferenceViolations: parsed.preference_violations ?? [],
      strengths: parsed.strengths ?? [],
      gaps: parsed.gaps ?? [],
      seniorityFit: parsed.seniority_fit ?? "good",
    });
  } catch (err) {
    console.warn(`  [adjudicateMatch] LLM failed, using score-only pass:`, err);
    return finalizeAdjudication(prefs, facts, fallback(score, prefs, facts));
  }
}

function finalizeAdjudication(
  prefs: UserPreferences,
  facts: JobFacts,
  adj: AdjudicationResult,
): AdjudicationResult {
  return reconcileAdjudicationSeniority(prefs, facts, { ...adj });
}

function fallback(score: ScoreBreakdown, prefs: UserPreferences, facts: JobFacts): AdjudicationResult {
  const { fit } = compareSeniority(prefs.seniorityTarget, facts.seniorityLevel);
  return {
    recommend: score.finalScore >= FINAL_SCORE_FLOOR,
    fitScore: Math.round(score.finalScore * 100),
    preferenceViolations: [],
    strengths: [],
    gaps: [],
    seniorityFit: fit,
  };
}
