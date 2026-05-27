import "dotenv/config";
import {
  buildUserPreferences,
  computeScoreBreakdown,
  extractJobFacts,
  FINAL_SCORE_FLOOR,
  matchEligible,
  MIN_MATCHED_CHUNKS,
  matchPassesTierFilter,
  type JobFacts,
  type ScoreBreakdown,
  type UserPreferences,
} from "../matching/index.js";
import {
  getJobForMatch,
  getUserProfilesForMatching,
  getUserSectionEmbeddings,
  getJobSectionEmbeddings,
  insertJobMatchV2,
} from "../db.js";
import { adjudicateMatch } from "./adjudicateMatch.js";

export interface MatchResult {
  matchIds: number[];
}

/**
 * Forward match: Layer 1 gate → Layer 2 scoring → Layer 3 LLM adjudication.
 */
export async function matchJob(jobId: string): Promise<MatchResult> {
  console.log(`  [matchJob] jobId=${jobId}`);

  const job = await getJobForMatch(jobId);
  if (!job) {
    console.log(`  [matchJob] job not found`);
    return { matchIds: [] };
  }

  const facts: JobFacts =
    job.jobFactsJson ??
    extractJobFacts(job.title, job.company, job.location, job.description, job.formLabels);

  const jobSections = await getJobSectionEmbeddings(jobId);
  if (jobSections.length === 0 && job.embedding?.length) {
    jobSections.push({ sectionKey: "posting_core", embedding: job.embedding });
  }
  if (jobSections.length === 0) {
    console.log(`  [matchJob] no job embeddings`);
    return { matchIds: [] };
  }

  const users = await getUserProfilesForMatching();
  if (users.length === 0) {
    console.log(`  [matchJob] no users with profile embeddings`);
    return { matchIds: [] };
  }

  const matchIds: number[] = [];

  for (const user of users) {
    const prefs: UserPreferences = user.preferencesJson
      ? (user.preferencesJson as unknown as UserPreferences)
      : buildUserPreferences(user.profileJson);

    const gate = matchEligible(prefs, facts);
    if (!gate.ok) {
      console.log(`  [matchJob] gate fail user=${user.userId}: ${gate.reasons.join("; ")}`);
      continue;
    }

    const userChunks = await getUserSectionEmbeddings(user.userId);
    if (userChunks.length === 0) {
      continue;
    }

    const score: ScoreBreakdown = computeScoreBreakdown(userChunks, jobSections);
    if (score.finalScore < FINAL_SCORE_FLOOR || score.matchedChunks < MIN_MATCHED_CHUNKS) {
      console.log(
        `  [matchJob] score fail user=${user.userId} final=${score.finalScore.toFixed(3)} chunks=${score.matchedChunks}`,
      );
      continue;
    }

    let adjudication = null;
    if (process.env.MATCH_ADJUDICATION_ENABLED !== "false") {
      adjudication = await adjudicateMatch(prefs, facts, job, score);
      if (!adjudication.recommend || adjudication.preferenceViolations.length > 0) {
        console.log(
          `  [matchJob] adjudication reject user=${user.userId}: ${adjudication.preferenceViolations.join("; ")}`,
        );
        continue;
      }
    }

    if (!matchPassesTierFilter(prefs, score.finalScore, score, adjudication)) {
      console.log(`  [matchJob] tier filter reject user=${user.userId}`);
      continue;
    }

    const matchId = await insertJobMatchV2(
      user.userId,
      jobId,
      score.finalScore,
      score.matchedChunks,
      gate,
      score,
      adjudication,
    );
    if (matchId !== null) {
      matchIds.push(matchId);
      console.log(
        `  [matchJob] matched user=${user.userId} score=${score.finalScore.toFixed(3)} matchId=${matchId}`,
      );
    }
  }

  console.log(`  [matchJob] created ${matchIds.length} matches`);
  return { matchIds };
}
