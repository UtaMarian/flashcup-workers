const prisma = require("../config/db");

/**
 * Registry of every event type: its player-facing label/blurb, its "scope"
 * (how it plugs into the game), and its default tunables. Admin-supplied
 * config is merged over `defaults` at read time (see `config()`), so a row
 * only needs to store the keys it overrides.
 *
 * scope:
 *   GLOBAL_MULTIPLIER  — a `multiplier` applied to some value for everyone
 *   MATCH_CONTRIBUTION — extra post-match payouts for scorers/assisters
 *   JOB                — changes a background job's cadence
 *   CLAIM              — unlocks a per-player action (wheel / position / superbet)
 */
const EVENT_TYPES = {
  DOUBLE_TRAINING_XP: {
    label: "XP dublu la antrenament",
    blurb: "Orice sesiune de antrenament aduce XP dublu.",
    scope: "GLOBAL_MULTIPLIER",
    defaults: { multiplier: 2 },
  },
  DOUBLE_MATCH_XP: {
    label: "XP dublu din meciuri",
    blurb: "Prezența, golurile și pasele decisive aduc XP dublu din meciurile simulate.",
    scope: "GLOBAL_MULTIPLIER",
    defaults: { multiplier: 2 },
  },
  DOUBLE_MATCH_REWARDS: {
    label: "Recompense duble per meci",
    blurb: "Energia, banii și tokenii din recompensele de meci sunt dublați.",
    scope: "GLOBAL_MULTIPLIER",
    defaults: { multiplier: 2 },
  },
  DOUBLE_GOAL_ASSIST_REWARDS: {
    label: "Recompense duble pentru gol/assist",
    blurb: "Dacă marchezi sau dai o pasă decisivă, primești o recompensă dublă de meci — chiar și fără coregrafie.",
    scope: "MATCH_CONTRIBUTION",
    defaults: { multiplier: 2, cash: 60, energy: 15, tokens: 0 },
  },
  DOUBLE_CHOREO_INFLUENCE: {
    label: "Influență dublă în meci",
    blurb: "Fiecare coregrafie adaugă influență dublă pentru același cost.",
    scope: "GLOBAL_MULTIPLIER",
    defaults: { multiplier: 2 },
  },
  FAST_ENERGY_REGEN: {
    label: "Regenerare energie rapidă",
    blurb: "Energia se regenerează o dată la 2 minute în loc de 5.",
    scope: "JOB",
    defaults: { intervalMs: 120000 },
  },
  REWARD_WHEEL: {
    label: "Roata recompenselor",
    blurb: "Învârte roata o dată la câteva ore pentru energie, bani sau tokeni.",
    scope: "CLAIM",
    defaults: {
      cooldownMs: 3 * 60 * 60 * 1000,
      prizes: [
        { label: "+150 bani", weight: 5, cash: 150, tokens: 0, energy: 0 },
        { label: "+400 bani", weight: 3, cash: 400, tokens: 0, energy: 0 },
        { label: "+1000 bani", weight: 1, cash: 1000, tokens: 0, energy: 0 },
        { label: "+25 energie", weight: 4, cash: 0, tokens: 0, energy: 25 },
        { label: "+75 energie", weight: 2, cash: 0, tokens: 0, energy: 75 },
        { label: "+1 token", weight: 3, cash: 0, tokens: 1, energy: 0 },
        { label: "+3 tokeni", weight: 1, cash: 0, tokens: 3, energy: 0 },
        { label: "Ghinion — nimic", weight: 2, cash: 0, tokens: 0, energy: 0 },
      ],
    },
  },
  POSITION_CHANGE: {
    label: "Schimbă poziția jucătorului",
    blurb: "Îți poți schimba poziția pe teren în schimbul tokenilor.",
    scope: "CLAIM",
    defaults: { tokenCost: 50, oncePerEvent: false },
  },
  SUPERBET: {
    label: "Superpariu ×10",
    blurb: "Primești un superpariu care multiplică de 10 ori câștigul pe un singur meci.",
    scope: "CLAIM",
    defaults: { multiplier: 10, grantsPerUser: 1 },
  },
};

const EVENT_TYPE_KEYS = Object.keys(EVENT_TYPES);

/** Merge a stored event's configJson over its type defaults. */
function config(event) {
  const defaults = EVENT_TYPES[event.type]?.defaults || {};
  let stored = {};
  try {
    stored = event.configJson ? JSON.parse(event.configJson) : {};
  } catch {
    stored = {};
  }
  return { ...defaults, ...stored };
}

/**
 * Advances event lifecycle by wall-clock: SCHEDULED→ACTIVE once startsAt
 * passes, ACTIVE→ENDED once endsAt passes. Cheap enough to call lazily at
 * the top of every read path (mirrors settingsService's lazy-create), and
 * also run once a minute by the events cron job in the flashcup-workers repo.
 */
async function syncEventStatuses() {
  const now = new Date();
  await prisma.gameEvent.updateMany({
    where: { status: "SCHEDULED", startsAt: { lte: now } },
    data: { status: "ACTIVE" },
  });
  await prisma.gameEvent.updateMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
    data: { status: "ENDED" },
  });
}

/** Every event currently live (status ACTIVE and within its window), config merged in. */
async function getActiveEvents() {
  await syncEventStatuses();
  const now = new Date();
  const events = await prisma.gameEvent.findMany({
    where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { endsAt: "asc" },
  });
  return events.map((e) => ({ ...e, config: config(e) }));
}

/** The first live event of a given type, or null. */
async function getActiveEvent(type) {
  const active = await getActiveEvents();
  return active.find((e) => e.type === type) || null;
}

/** `config.multiplier` of a live event of `type`, or 1 when none is running. */
async function multiplierFor(type) {
  const event = await getActiveEvent(type);
  return event?.config?.multiplier ?? 1;
}

module.exports = {
  EVENT_TYPES,
  EVENT_TYPE_KEYS,
  config,
  syncEventStatuses,
  getActiveEvents,
  getActiveEvent,
  multiplierFor,
};
