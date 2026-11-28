export type WebImageResult = { title: string; imageUrl: string; sourceUrl: string; domain: string };

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

const cache = new Map<string, { expiresAt: number; results: WebSearchResult[] }>();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE = 150;
const FETCH_TIMEOUT = 7500;

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
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "))
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function unwrapUrl(href: string): string | null {
  try {
    let candidate = decodeHtml(href.trim());
    if (candidate.startsWith("//")) candidate = "https:" + candidate;
    const parsed = new URL(candidate, "https://duckduckgo.com");
    if (/(^|\.)duckduckgo\.com$/i.test(parsed.hostname) && parsed.pathname.startsWith("/l/")) {
      const target = parsed.searchParams.get("uddg") || parsed.searchParams.get("rut");
      if (target) return unwrapUrl(target);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (/(^|\.)(duckduckgo|bing)\.com$/i.test(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./i, ""); } catch { return ""; }
}

function extractAnchorResults(html: string, limit: number): WebSearchResult[] {
  const output: WebSearchResult[] = [];
  const seen = new Set<string>();
  const anchors = html.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi);
  for (const match of anchors) {
    const attrs = match[1];
    if (!/(?:result__a|b_algo|result-link|result__url)/i.test(attrs + " " + match[2])) continue;
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const url = href ? unwrapUrl(href) : null;
    const title = cleanText(match[2]);
    if (!url || !title || title.length < 2 || seen.has(url)) continue;
    const domain = domainOf(url);
    const index = match.index ?? 0;
    const surrounding = html.slice(Math.max(0, index - 900), Math.min(html.length, index + match[0].length + 1800));
    const snippetMatch = surrounding.match(/<(?:p|div|span)\b[^>]*class=["'][^"']*(?:result__snippet|b_caption|snippet)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div|span)>/i);
    output.push({ title, url, snippet: snippetMatch ? cleanText(snippetMatch[1]).slice(0, 500) : "", domain });
    seen.add(url);
    if (output.length >= limit) break;
  }
  return output;
}

function parseBingRss(xml: string, limit: number): WebSearchResult[] {
  const output: WebSearchResult[] = [];
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const item of items) {
    const title = cleanText(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
    const rawLink = cleanText(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "");
    const url = unwrapUrl(rawLink);
    if (!title || !url || output.some((entry) => entry.url === url)) continue;
    const snippet = cleanText(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "");
    output.push({ title, url, snippet: snippet.slice(0, 500), domain: domainOf(url) });
    if (output.length >= limit) break;
  }
  return output;
}

function parseDuckDuckGo(html: string, limit: number): WebSearchResult[] {
  const blocks = html.match(/<div\b[^>]*class=["'][^"']*\bresult\b[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*\bresult\b|$)/gi) || [];
  const output: WebSearchResult[] = [];
  for (const block of blocks) {
    const anchor = block.match(/<a\b([^>]*?)>([\s\S]*?)<\/a>/i);
    if (!anchor || !/result__a/i.test(anchor[1])) continue;
    const href = anchor[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const url = href ? unwrapUrl(href) : null;
    const title = cleanText(anchor[2]);
    if (!url || !title || output.some((entry) => entry.url === url)) continue;
    const snippetMatch = block.match(/<(?:a|div|span)\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    output.push({ title, url, snippet: snippetMatch ? cleanText(snippetMatch[1]).slice(0, 500) : "", domain: domainOf(url) });
    if (output.length >= limit) break;
  }
  return output.length ? output : extractAnchorResults(html, limit);
}

const SEARCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "uz,en-US;q=0.9,en;q=0.8,ru;q=0.7",
};

async function fetchText(url: string, accept: string): Promise<string> {
  const response = await fetch(url, {
    headers: { ...SEARCH_HEADERS, Accept: accept },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!response.ok) throw new Error("Search provider HTTP " + response.status);
  return response.text();
}

export function shouldSearchWeb(message: string): boolean {
  const text = message.toLocaleLowerCase("uz").trim();
  if (!text || /^(salom|assalomu alaykum|rahmat|katta rahmat|ok|okay|xo'p|tushunarli|ha|yo'q)[!. ]*$/i.test(text)) return false;

  const searchIntent = /internet(?:dan|da|ga)?|\bweb(?:dan|da)?\b|sayt(?:dan|da)?|google(?:da)?|qidir\w*|qid\w*|izla\w*|izlab\s+ber|topib\s+ber|tekshir\w*|aniqla\w*|surishtir\w*|manba\w*|havola\w*|link(?:lar)?|source(?:s)?|search|look\s*up|find\s+out|verify|fact[ -]?check|research|browse|check\s+online|поищи|найди|проверь|источник\w*|ссылк\w*|поиск/i;
  const currentInfo = /eng\s+so['’ʻ]?nggi|so['’ʻ]?nggi|oxirgi|yangilik\w*|xabar\w*|bugun|kecha|ertaga|hozir|ayni\s+payt|joriy|real[ -]?time|latest|breaking|today|yesterday|tomorrow|current|recent|this week|this month|right now|news|updates?|live|weather|forecast|ob[ -]?havo|valyuta|dollar|dollarning|usd|bitcoin|btc|kriptovalyuta|kripto|ethereum|kursi?|exchange rate|stock price|birja|aksiyalar|narxi|narxlar|inflatsiya|statistika|reyting|ranking|natija\w*|score|standings|сегодня|вчера|завтра|последн\w*|новост\w*|курс\w*|погод\w*|цена|стоимость|рейтинг/i;
  const factualTopic = /chiq\w*|qachon\s+chiq|chiqish\s+sanasi|rasman\s+chiq|release\s+date|released|top\s+\d+|best\s+\d+|eng\s+yaxshi|eng\s+zo['’ʻ]?r|tavsiya|recommend|review|taqqosla|solishtir|farqi|vs\.?\b|versus|ro['’ʻ]?yxat|kim\b|nima\b|qanday\b|qayer\w*|qachon\b|necha\b|qancha\b|haqida\b|ma['’ʻ]?lumot|tarix\w*|sabab\w*|foyda\w*|zarar\w*|xususiyat\w*|imkoniyat\w*|qoida\w*|qonun\w*|rasmiy\w*|kompaniya|prezident|davlat|shahar|aholi|population\b|history\b|facts\b|price\b|cost\b|specs\b|version\b|what\b|who\b|where\b|when\b|why\b|how\b|tell me about|explain\b|define\b|compare\b|recommend\b|review\b|обзор\w*|сравни\w*|разниц\w*|когда\b|почему\b|сколько\b|что\b|кто\b|где\b|как\b|истори\w*|характеристик\w*|официальн\w*|дата\s+выхода/i;

  return searchIntent.test(text) || currentInfo.test(text) || factualTopic.test(text) || /202[4-9]|20[3-9]\d/.test(text) || /[?؟]/.test(text);
}

export async function searchImages(query: string, limit = 8): Promise<WebImageResult[]> {
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 250);
  if (!normalized) return [];
  try {
    const initial = new URL("https://duckduckgo.com/");
    initial.searchParams.set("q", normalized);
    initial.searchParams.set("iax", "images");
    initial.searchParams.set("ia", "images");
    const html = await fetchText(initial.toString(), "text/html,application/xhtml+xml");
    const token = html.match(/vqd=["']([^"']+)["']/i)?.[1] || html.match(/\bvqd=([^&"' ]+)/i)?.[1];
    if (!token) return [];
    const endpoint = new URL("https://duckduckgo.com/i.js");
    endpoint.searchParams.set("q", normalized);
    endpoint.searchParams.set("o", "json");
    endpoint.searchParams.set("l", "us-en");
    endpoint.searchParams.set("vqd", token);
    endpoint.searchParams.set("f", ",,,,,");
    const response = await fetch(endpoint.toString(), {
      headers: { ...SEARCH_HEADERS, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!response.ok) return [];
    const data: any = await response.json();
    const output: WebImageResult[] = [];
    const seen = new Set<string>();
    for (const item of Array.isArray(data.results) ? data.results : []) {
      const imageUrl = typeof item.image === "string" ? item.image : typeof item.thumbnail === "string" ? item.thumbnail : "";
      const sourceUrl = typeof item.url === "string" ? item.url : typeof item.source === "string" ? item.source : "";
      if (!/^https?:\/\//i.test(imageUrl) || seen.has(imageUrl)) continue;
      output.push({ title: typeof item.title === "string" ? item.title : normalized, imageUrl, sourceUrl, domain: domainOf(sourceUrl) });
      seen.add(imageUrl);
      if (output.length >= Math.min(Math.max(limit, 1), 10)) break;
    }
    return output;
  } catch (error) {
    console.error(JSON.stringify({ type: "javy_image_search_error", provider: "duckduckgo-images", error: error instanceof Error ? error.message : String(error) }));
    return [];
  }
}

export async function searchWeb(query: string, limit = 7): Promise<WebSearchResult[]> {
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 350);
  if (!normalized) return [];
  const key = normalized.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;
  if (cached) cache.delete(key);

  const recent = /latest|breaking|today|current|recent|news|eng\s+so['’ʻ]?nggi|so['’ʻ]?nggi|oxirgi|yangilik|bugun|hozir|chiqdimi|chiqdi|chiqadimi|chiqqan|qachon\s+chiq|release\s+date|released/i.test(normalized);
  const params = new URLSearchParams({ q: normalized });
  if (recent) params.set("df", "w");

  const providers = [
    async () => {
      const url = "https://html.duckduckgo.com/html/?" + params.toString();
      const html = await fetchText(url, "text/html,application/xhtml+xml");
      return parseDuckDuckGo(html, limit);
    },
    async () => {
      const url = "https://lite.duckduckgo.com/lite/?" + params.toString();
      const html = await fetchText(url, "text/html,application/xhtml+xml");
      return extractAnchorResults(html, limit);
    },
    async () => {
      const url = new URL("https://www.bing.com/search");
      url.searchParams.set("format", "rss");
      url.searchParams.set("q", normalized);
      const xml = await fetchText(url.toString(), "application/rss+xml,application/xml,text/xml");
      return parseBingRss(xml, limit);
    },
  ];

  const settled = await Promise.allSettled(providers.map((provider) => provider()));
  const merged: WebSearchResult[] = [];
  const seen = new Set<string>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      if (!seen.has(item.url)) {
        merged.push(item);
        seen.add(item.url);
      }
      if (merged.length >= Math.min(Math.max(limit, 1), 10)) break;
    }
    if (merged.length >= Math.min(Math.max(limit, 1), 10)) break;
  }
  if (merged.length) {
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL, results: merged });
    if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
  } else {
    console.error(JSON.stringify({
      type: "javy_search_empty",
      providers: settled.map((result, index) => ({ name: ["google-news-rss", "duckduckgo-html", "duckduckgo-lite", "bing-rss"][index], status: result.status, error: result.status === "rejected" ? String(result.reason).slice(0, 180) : null })),
    }));
  }
  return merged;
}
