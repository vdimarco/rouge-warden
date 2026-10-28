// First Breath: stage scores and grades (design.md section 7, 16.2). Each stage scores Goal (3,000), Skill (up to
// 6,000) and Flourish (up to 1,000). Only this file clamps and grades; only core/run.js adds up. Pure.
//
// Contract choices: clampScore rounds each part to an integer inside 0..its max (a non-number counts as 0);
// grade(total, goalMet) is null when the goal was not met (a stage 1 Go on shows no grade word), else Glowing from
// 8,500, Great from 6,500, else Good; runTotal(stageScores) takes entries such as summary().stages
// ({ score: number | { total }, grade } or { total, grade }) and adds 500 for each Glowing.

export const PARTS = { goal: 3000, skill: 6000, flourish: 1000 };
export const GRADE_AT = Object.freeze({ Great: 6500, Glowing: 8500 });
export const GLOWING_BONUS = 500;

const part = (v, max) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);

export function clampScore({ goal, skill, flourish } = {}) {
  const g = part(goal, PARTS.goal), s = part(skill, PARTS.skill), f = part(flourish, PARTS.flourish);
  return { goal: g, skill: s, flourish: f, total: g + s + f };
}

export function grade(total, goalMet) {
  if (!goalMet || !Number.isFinite(total)) return null;
  if (total >= GRADE_AT.Glowing) return "Glowing";
  if (total >= GRADE_AT.Great) return "Great";
  return "Good";
}

const totalOf = (e) => {
  if (!e || typeof e !== "object") return 0;
  if (Number.isFinite(e.total)) return e.total;
  if (Number.isFinite(e.score)) return e.score;
  if (e.score && Number.isFinite(e.score.total)) return e.score.total;
  return 0;
};

// The run total: the stages' totals + 500 per Glowing (at most 84,000).
export function runTotal(stageScores) {
  let sum = 0;
  for (const e of stageScores || []) {
    const t = Math.max(0, Math.round(totalOf(e)));
    sum += t;
    if (e && e.grade === "Glowing") sum += GLOWING_BONUS;
  }
  return sum;
}
