// Cloudflare Worker: scrapes Greenhouse + Lever job board APIs for selected companies,
// caches results in KV, and serves a /jobs endpoint with filters.
// NOTE: This does NOT bypass robots or scrape HTML; it uses vendor JSON APIs (ToS-friendly).
// Greenhouse: https://boards-api.greenhouse.io/v1/boards/{company}/jobs
// Lever:     https://api.lever.co/v0/postings/{company}?mode=json

const COMPANIES = {
  greenhouse: [
    // put Greenhouse "board tokens" here:
    "google", "atlassian", "datadog"
  ],
  lever: [
    // put Lever company slugs here:
    "stripe", "roblox", "fivetran"
  ]
};

const KV_KEY = "internsurf:jobs:v1";
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/jobs") {
      // read cached, optionally refresh if stale
      let { results, ts } = await readCache(env);
      if (!results || Date.now() - ts > CACHE_TTL_SECONDS * 1000) {
        results = await scrapeAll();
        await writeCache(env, results);
      }
      // basic filters
      const query = (url.searchParams.get("query") || "").toLowerCase();
      const location = (url.searchParams.get("location") || "").toLowerCase();
      const remote = (url.searchParams.get("remote") || "").toLowerCase();

      let filtered = results;
      if (query) {
        filtered = filtered.filter(j =>
          `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(query)
        );
      }
      if (location) {
        filtered = filtered.filter(j => (j.location || "").toLowerCase().includes(location));
      }
      if (remote) {
        const wantRemote = ["true","yes","remote","hybrid"].includes(remote);
        filtered = filtered.filter(j => !!j.is_remote === wantRemote);
      }

      return jsonResponse({ count: filtered.length, jobs: filtered }, 200);
    }

    // Admin: force refresh
    if (url.pathname === "/refresh" && request.method === "POST") {
      const results = await scrapeAll();
      await writeCache(env, results);
      return jsonResponse({ ok: true, count: results.length }, 200);
    }

    // health
    if (url.pathname === "/") {
      return new Response("InternSurf scraper running", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  },

  // Scheduled cron: refresh cache
  async scheduled(event, env, ctx) {
    const results = await scrapeAll();
    await writeCache(env, results);
  },
};

// ---------- helpers ----------

async function readCache(env) {
  const raw = await env.JOBS.get(KV_KEY);
  if (!raw) return { results: null, ts: 0 };
  try {
    const data = JSON.parse(raw);
    return { results: data.results, ts: data.ts || 0 };
  } catch {
    return { results: null, ts: 0 };
  }
}

async function writeCache(env, results) {
  const body = JSON.stringify({ ts: Date.now(), results });
  await env.JOBS.put(KV_KEY, body, { expirationTtl: CACHE_TTL_SECONDS * 2 });
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // CORS: allow your GitHub Pages site to fetch this
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}

async function scrapeAll() {
  const [greenhouseJobs, leverJobs] = await Promise.all([
    scrapeGreenhouse(COMPANIES.greenhouse),
    scrapeLever(COMPANIES.lever),
  ]);
  // normalize and merge
  return [...greenhouseJobs, ...leverJobs].sort((a,b) =>
    (a.company || "").localeCompare(b.company || "")
  );
}

async function scrapeGreenhouse(companies) {
  const out = [];
  for (const company of companies) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company}/jobs`;
    try {
      const res = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true }});
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of data.jobs || []) {
        out.push({
          source: "greenhouse",
          company,
          title: job.title,
          location: job.location?.name || "",
          is_remote: detectRemote(job.title, job.location?.name),
          url: job.absolute_url,
        });
      }
    } catch(_) {}
  }
  return out;
}

async function scrapeLever(companies) {
  const out = [];
  for (const company of companies) {
    const url = `https://api.lever.co/v0/postings/${company}?mode=json`;
    try {
      const res = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true }});
      if (!res.ok) continue;
      const data = await res.json();
      for (const job of data || []) {
        out.push({
          source: "lever",
          company,
          title: job.text,
          location: Array.isArray(job.categories?.location) ? job.categories.location.join(", ") : (job.categories?.location || ""),
          is_remote: detectRemote(job.text, job.categories?.location),
          url: job.hostedUrl,
        });
      }
    } catch(_) {}
  }
  return out;
}

function detectRemote(title = "", location = "") {
  const t = `${title} ${location}`.toLowerCase();
  return t.includes("remote") || t.includes("hybrid") || t.includes("work from home");
}
