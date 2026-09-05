const prisma = require("../config/db");

const LANGS = ["ro", "en", "es", "fr", "ru", "pt", "zh", "ja", "tr"];
const ITEM_TYPES = ["new", "improved", "fixed"];
const FALLBACK_ORDER = ["en", "ro"];

function parseTranslations(raw) {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => ({
      type: ITEM_TYPES.includes(it && it.type) ? it.type : "new",
      text: String((it && it.text) || "").trim().slice(0, 600),
    }))
    .filter((it) => it.text.length > 0);
}

function sanitizeLangPayload(body) {
  return {
    title: String(body.title || "").trim().slice(0, 200),
    intro: body.intro != null && String(body.intro).trim() ? String(body.intro).trim().slice(0, 1000) : null,
    items: sanitizeItems(body.items),
  };
}

/** Pick the best available translation for `lang`. */
function pickLang(translations, lang) {
  const order = [lang, ...FALLBACK_ORDER, ...LANGS];
  for (const code of order) {
    const v = translations[code];
    if (v && (v.title || (Array.isArray(v.items) && v.items.length))) return v;
  }
  return { title: "", intro: null, items: [] };
}

/** Public shape for one entry, resolved to a language. */
function resolveEntry(entry, lang) {
  const tr = parseTranslations(entry.translations);
  const picked = pickLang(tr, lang);
  return {
    version: entry.version,
    date: entry.releaseDate,
    title: picked.title || "",
    intro: picked.intro || undefined,
    items: Array.isArray(picked.items) ? picked.items : [],
  };
}

// GET /api/changelog?lang=xx — published entries, newest first, resolved to `lang`.
async function getChangelog(req, res, next) {
  try {
    const lang = LANGS.includes(req.query.lang) ? req.query.lang : "ro";
    const entries = await prisma.changelogEntry.findMany({
      where: { published: true },
      orderBy: [{ sortKey: "desc" }, { createdAt: "desc" }],
    });
    res.json({ entries: entries.map((e) => resolveEntry(e, lang)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/changelog/all — admin: raw entries with every translation.
async function listAll(req, res, next) {
  try {
    const entries = await prisma.changelogEntry.findMany({
      orderBy: [{ sortKey: "desc" }, { createdAt: "desc" }],
    });
    res.json({
      langs: LANGS,
      itemTypes: ITEM_TYPES,
      entries: entries.map((e) => ({
        id: e.id,
        version: e.version,
        releaseDate: e.releaseDate,
        published: e.published,
        sortKey: e.sortKey,
        translations: parseTranslations(e.translations),
        updatedAt: e.updatedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/changelog — admin: create an entry (content for one language).
async function createEntry(req, res, next) {
  try {
    const body = req.body || {};
    const version = String(body.version || "").trim().slice(0, 40);
    const releaseDate = String(body.releaseDate || "").trim().slice(0, 60);
    const lang = LANGS.includes(body.lang) ? body.lang : "ro";
    if (!version) return res.status(400).json({ error: "Versiunea este obligatorie." });
    if (!releaseDate) return res.status(400).json({ error: "Data lansării este obligatorie." });

    const langPayload = sanitizeLangPayload(body);
    if (!langPayload.title) return res.status(400).json({ error: "Titlul este obligatoriu." });

    const exists = await prisma.changelogEntry.findUnique({ where: { version } });
    if (exists) return res.status(409).json({ error: "Există deja o intrare cu această versiune." });

    const maxRow = await prisma.changelogEntry.aggregate({ _max: { sortKey: true } });
    const sortKey = Number.isFinite(body.sortKey) ? Math.trunc(body.sortKey) : (maxRow._max.sortKey || 0) + 1;

    const created = await prisma.changelogEntry.create({
      data: {
        version,
        releaseDate,
        published: body.published !== false,
        sortKey,
        translations: JSON.stringify({ [lang]: langPayload }),
      },
    });
    res.status(201).json({ entry: { id: created.id, version: created.version } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/changelog/:id — admin: update meta and/or one language's content.
async function updateEntry(req, res, next) {
  try {
    const body = req.body || {};
    const existing = await prisma.changelogEntry.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Intrare inexistentă." });

    const data = {};
    if (body.version != null) {
      const version = String(body.version).trim().slice(0, 40);
      if (!version) return res.status(400).json({ error: "Versiunea este obligatorie." });
      if (version !== existing.version) {
        const clash = await prisma.changelogEntry.findUnique({ where: { version } });
        if (clash) return res.status(409).json({ error: "Există deja o intrare cu această versiune." });
      }
      data.version = version;
    }
    if (body.releaseDate != null) {
      const releaseDate = String(body.releaseDate).trim().slice(0, 60);
      if (!releaseDate) return res.status(400).json({ error: "Data lansării este obligatorie." });
      data.releaseDate = releaseDate;
    }
    if (typeof body.published === "boolean") data.published = body.published;
    if (Number.isFinite(body.sortKey)) data.sortKey = Math.trunc(body.sortKey);

    if (body.lang && LANGS.includes(body.lang)) {
      const translations = parseTranslations(existing.translations);
      if (body.removeLang === true) {
        delete translations[body.lang];
      } else {
        const langPayload = sanitizeLangPayload(body);
        if (!langPayload.title) return res.status(400).json({ error: "Titlul este obligatoriu." });
        translations[body.lang] = langPayload;
      }
      data.translations = JSON.stringify(translations);
    }

    await prisma.changelogEntry.update({ where: { id: existing.id }, data });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/changelog/:id — admin.
async function deleteEntry(req, res, next) {
  try {
    await prisma.changelogEntry.delete({ where: { id: req.params.id } }).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { getChangelog, listAll, createEntry, updateEntry, deleteEntry, LANGS, ITEM_TYPES };
