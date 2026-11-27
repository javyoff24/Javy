export type WebImageResult = { title: string; imageUrl: string; sourceUrl: string; domain: string };

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

const cache = new Map<string, { expiresAt: number; results: WebSearchResult[] }>();
const CACHE_TTL = 3 * 60 * 1000;
const MAX_CACHE = 100;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function cleanText(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

function unwrapUrl(href: string): string | null {
  try {
    const parsed = new URL(decodeHtml(href), "https://duckduckgo.com");
    if (parsed.hostname.endsWith("duckduckgo.com") && parsed.pathname.startsWith("/l/")) {
      const target = parsed.searchParams.get("uddg");
      if (target) return unwrapUrl(target);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.hostname.endsWith("duckduckgo.com")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function parseResults(html: string, limit: number): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const seen = new Set<string>();
  const blocks = html.match(/<div\b[^>]*class=["'][^"']*\bresult\b[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*\bresult\b|$)/gi) || [];
  if (!blocks.length) {
    const links = html.matchAll(/<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
    for (const match of links) {
      const url = unwrapUrl(match[1]);
      const title = cleanText(match[2]);
      if (!url || !title || seen.has(url)) continue;
      let domain = "";
      try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch {}
      results.push({ title, url, snippet: "", domain });
      seen.add(url);
      if (results.length >= limit) break;
    }
    return results;
  }

  for (const block of blocks) {
    const linkMatch = block.match(/<a\b(?=[^>]*class=["'][^"']*\bresult__a\b)[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const url = unwrapUrl(linkMatch[1]);
    const title = cleanText(linkMatch[2]);
    if (!url || !title || seen.has(url)) continue;

    const snippetMatch = block.match(/<(?:a|div|span)\b[^>]*class=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    const snippet = snippetMatch ? cleanText(snippetMatch[1]) : "";
    let domain = "";
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch {}
    results.push({ title, url, snippet, domain });
    seen.add(url);
    if (results.length >= limit) break;
  }
  if (results.length === 0) {
    const links = html.matchAll(/<a\b(?=[^>]*class=["'][^"']*result__a)[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
    for (const match of links) {
      const url = unwrapUrl(match[1]);
      const title = cleanText(match[2]);
      if (!url || !title || seen.has(url)) continue;
      let domain = "";
      try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch {}
      results.push({ title, url, snippet: "", domain });
      seen.add(url);
      if (results.length >= limit) break;
    }
  }
  return results;
}

export function shouldSearchWeb(message: string): boolean {
  const text = message.toLocaleLowerCase("uz").trim();
  if (!text || /^(salom|assalomu alaykum|rahmat|katta rahmat|ok|okay|xo'p|tushunarli|ha|yo'q)[!. ]*$/i.test(text)) return false;

  // Search explicit requests, current information, factual questions and research intents
  // across Uzbek, Russian and English. Keep casual greetings/acknowledgements local.
  const searchIntent = /internetdan|internetda|webdan|saytdan|google(da)?|qidir\\w*|qid\\w*|izla\\w*|izlab ber|topib ber|top\\w*|tekshir\\w*|aniqla\\w*|surishtir\\w*|manba\\w*|havola\\w*|link(lar)?|source(s)?|search|look\\s*up|find\\s+out|verify|fact[ -]?check|research|browse|check\\s+online|поищи|найди|проверь|источник\\w*|ссылк\\w*|поиск/i;

  const currentInfo = /eng\\s+so['’ʻʻ]?nggi|so['’ʻ]?nggi|oxirgi|yangilik\\w*|xabar\\w*|bugun|kecha|ertaga|hozir|ayni\\s+payt|joriy|so‘nggi\\s+holat|real[ -]?time|latest|breaking|today|yesterday|tomorrow|current|recent|this week|this month|right now|news|updates?|live|weather|forecast|ob[ -]?havo|valyuta|kursi?|exchange rate|stock price|birja|aksiyalar|narxi|narxlar|inflatsiya|statistika|statistikasi|reyting|ranking|jadval|natija\\w*|hisob\\w*|score|standings|прямо\\s+сейчас|сегодня|вчера|завтра|последн\\w*|новост\\w*|курс\\w*|погод\\w*|цена|стоимость|статистик\\w*|рейтинг/i;

  const factualTopic = /chiq\\w*|qachon\\s+chiq|chiqish\\s+sanasi|rasman\\s+chiq|release\\s+date|released|top\\s+\\d+|best\\s+\\d+|eng\\s+yaxshi|eng\\s+zo['’ʻ]?r|tavsiya|recommend|review|taqqosla|solishtir|farqi|vs\\.?\\b|versus|ro['’ʻ]?yxat|kim\\b|nima\\b|qanday\\b|qayer\\w*|qachon\\b|necha\\b|qancha\\b|haqida\\b|ma['’ʻ]?lumot|tarix\\w*|sabab\\w*|foyda\\w*|zarar\\w*|xususiyat\\w*|imkoniyat\\w*|qoida\\w*|qonun\\w*|rasmiy\\w*|kompaniya|prezident|davlat|shahar|aholi|populyatsiya|capital\\b|population\\b|history\\b|facts\\b|price\\b|cost\\b|specs\\b|version\\b|what\\b|who\\b|where\\b|when\\b|why\\b|how\\b|tell me about|explain\\b|define\\b|compare\\b|versus|recommend\\b|review\\b|обзор\\w*|сравни\\w*|разниц\\w*|когда\\b|почему\\b|сколько\\b|что\\b|кто\\b|где\\b|как\\b|истори\\w*|характеристик\\w*|официальн\\w*|дата\\s+выхода/i;

  const futureYear = /202[4-9]|20[3-9]\\d/;
  return searchIntent.test(text) || currentInfo.test(text) || factualTopic.test(text) || futureYear.test(text) || /[?؟]\\s*$/.test(text);
}}

export async function searchImages(query: string, limit = 8): Promise<WebImageResult[]> {
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 250);
  if (!normalized) return [];
  const initial = new URL("https://duckduckgo.com/");
  initial.searchParams.set("q", normalized);
  initial.searchParams.set("iax", "images");
  initial.searchParams.set("ia", "images");
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9,uz;q=0.8",
  };
  const first = await fetch(initial.toString(), { headers, cache: "no-store", signal: AbortSignal.timeout(9000) });
  if (!first.ok) return [];
  const html = await first.text();
  const token = html.match(/vqd=["']([^"']+)["']/i)?.[1] || html.match(/\bvqd=([^&"' ]+)/i)?.[1];
  if (!token) return [];
  const endpoint = new URL("https://duckduckgo.com/i.js");
  endpoint.searchParams.set("q", normalized);
  endpoint.searchParams.set("o", "json");
  endpoint.searchParams.set("l", "us-en");
  endpoint.searchParams.set("vqd", token);
  endpoint.searchParams.set("f", ",,,,,");
  const response = await fetch(endpoint.toString(), { headers: { ...headers, "Accept": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(9000) });
  if (!response.ok) return [];
  const data: any = await response.json();
  const output: WebImageResult[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(data.results) ? data.results : []) {
    const imageUrl = typeof item.thumbnail === "string" ? item.thumbnail : typeof item.image === "string" ? item.image : "";
    const sourceUrl = typeof item.url === "string" ? item.url : typeof item.source === "string" ? item.source : "";
    if (!/^https?:\/\//i.test(imageUrl) || seen.has(imageUrl)) continue;
    let domain = "";
    try { domain = new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch {}
    output.push({ title: typeof item.title === "string" ? item.title : normalized, imageUrl, sourceUrl, domain });
    seen.add(imageUrl);
    if (output.length >= Math.min(Math.max(limit, 1), 10)) break;
  }
  return output;
}

export async function searchWeb(query: string, limit = 7): Promise<WebSearchResult[]> {
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 350);
  if (!normalized) return [];
  const key = normalized.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;
  if (cached) cache.delete(key);

  const recent = /latest|breaking|today|current|recent|news|eng\s+so['’ʻ]?nggi|so['’ʻ]?nggi|oxirgi|yangilik|bugun|hozir|chiqdimi|chiqdi|chiqadimi|chiqqan|qachon\s+chiq|chiqish\s+sanasi|rasman\s+chiq|release\s+date|released/i.test(normalized);
  const params = new URLSearchParams({ q: normalized, kl: "us-en" });
  if (recent) params.set("df", "w");

  const response = await fetch("https://html.duckduckgo.com/html/?" + params.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,uz;q=0.8",
    },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("DuckDuckGo HTTP " + response.status);
  const html = await response.text();
  const results = parseResults(html, Math.min(Math.max(limit, 1), 10));
  if (results.length) {
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL, results });
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
  }
  return results;
}
