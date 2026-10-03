// Seeded policies for BREAKTHROUGH. They never touch the game RNG.
import { mulberry32 } from "../../public/breakthrough2/model.js";

function effectScore(effect, state) {
  const fx = effect || {};
  const ecoWeight = state.ecology < 60 ? 2.5 : state.ecology < 66 ? 1.5 : 0.7;
  const energyWeight = state.energy > 48 ? 2.05 : 1.25;
  const prosWeight = state.prosperity < 64 ? 0.7 : 0.25;
  let score = 0;
  score += -(fx.emissions || 0) * 4.3;
  score += -(fx.energy || 0) * energyWeight;
  score += (fx.ecology || 0) * ecoWeight;
  score += (fx.prosperity || 0) * prosWeight;
  score += (fx.trust || 0) * 0.55;
  score += (fx.capital || 0) * 0.15;
  const trustAfter = state.trust + (fx.trust || 0) - ((fx.trust || 0) < 0 ? 0 : 0);
  if (state.trust + (fx.trust || 0) < 38) score -= (38 - (state.trust + (fx.trust || 0))) * 0.85;
  if (state.energy > 60 && (fx.energy || 0) > 0) score -= (fx.energy || 0) * 1.7;
  if (trustAfter < 0) score -= 2;
  return score;
}

function cardScore(offer, state) {
  let score = effectScore(offer.effect, state);
  const cost = offer.cost || {};
  score -= (cost.trust || 0) * 0.9;
  score -= (cost.political || 0) * 0.15;
  if (offer.synergy) score += offer.synergy.value * 1.35;
  const trustAfter = state.trust + (offer.effect.trust || 0) - (cost.trust || 0);
  if (trustAfter < 36) score -= (36 - trustAfter) * 0.7;
  return score;
}

export function greedyClean(offers, state) {
  if (offers.event && offers.event.options) {
    let best = null;
    let bestScore = -Infinity;
    for (const option of offers.event.options) {
      if (option.affordable === false) continue;
      const score = effectScore(option.effect, state) - ((option.cost && option.cost.capital) || 0) * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }
    return best ? best.id : offers.event.options[0].id;
  }
  const cards = offers.cards.filter((card) => card.affordable);
  const ideas = (offers.ideas || []).filter((idea) => idea.available && idea.affordable);
  if (!cards.length && !ideas.length) return "pass";
  const ranked = cards
    .map((card) => ({ card, score: cardScore(card, state) }))
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
  const bestCard = ranked[0];
  let bestIdea = null;
  for (const idea of ideas) {
    const score = cardScore(idea, state);
    if (!bestIdea || score > bestIdea.score) bestIdea = { idea, score };
  }
  if (bestIdea && (!bestCard || bestIdea.score > bestCard.score + 3.5)) return bestIdea.idea.id;
  return bestCard.card.id;
}

export function randomPolicy(seed) {
  const rng = mulberry32((Math.imul(seed, 997) ^ 0x5bd1e995) >>> 0);
  return function pick(offers) {
    if (offers.event && offers.event.options) {
      const options = offers.event.options.filter((option) => option.affordable !== false);
      const pool = options.length ? options : offers.event.options;
      return pool[Math.floor(rng() * pool.length)].id;
    }
    const cards = offers.cards.filter((card) => card.affordable);
    const ideas = (offers.ideas || []).filter((idea) => idea.available && idea.affordable);
    if (ideas.length && rng() < 0.18) return ideas[Math.floor(rng() * ideas.length)].id;
    if (!cards.length) return ideas.length ? ideas[Math.floor(rng() * ideas.length)].id : "pass";
    return cards[Math.floor(rng() * cards.length)].id;
  };
}

export function pathwayFocus(key) {
  return function pick(offers, state) {
    if (offers.event && offers.event.options) return greedyClean(offers, state);
    const path = (offers.pathways || []).find((item) => item.key === key && item.affordable && !item.done);
    if (path) {
      const cost = path.cost || {};
      const reserve = state.capital - (cost.capital || 0) >= 1
        && state.research - (cost.research || 0) >= 0
        && state.political - (cost.political || 0) >= 1
        && state.industry - (cost.industry || 0) >= 0;
      if (reserve) return path.id;
    }
    return greedyClean(offers, state);
  };
}

export function scripted(offers) {
  if (offers.event && offers.event.options) {
    const option = offers.event.options.find((item) => item.affordable !== false) || offers.event.options[0];
    return option.id;
  }
  const card = offers.cards.find((item) => item.affordable);
  if (card) return card.id;
  const idea = (offers.ideas || []).find((item) => item.available && item.affordable);
  if (idea) return idea.id;
  return "pass";
}
