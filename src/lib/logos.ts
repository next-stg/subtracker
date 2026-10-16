// Simple Icons (https://simpleicons.org) expose gratuitement les logos de
// marque au format SVG via ce CDN public, sans clé API :
// https://cdn.simpleicons.org/<slug>[/<couleur hex>]
const SERVICE_SLUGS: Record<string, string> = {
  netflix: "netflix",
  spotify: "spotify",
  "spotify family": "spotify",
  "apple music": "applemusic",
  icloud: "icloud",
  "icloud+": "icloud",
  "apple tv": "appletv",
  "apple tv+": "appletv",
  "amazon prime": "amazonprime",
  "prime video": "amazonprime",
  amazon: "amazon",
  "disney+": "disneyplus",
  disney: "disneyplus",
  "youtube premium": "youtube",
  youtube: "youtube",
  "hbo max": "hbo",
  hbo: "hbo",
  "adobe creative cloud": "adobecreativecloud",
  adobe: "adobe",
  photoshop: "adobephotoshop",
  canva: "canva",
  notion: "notion",
  figma: "figma",
  github: "github",
  gitlab: "gitlab",
  dropbox: "dropbox",
  "google drive": "googledrive",
  "google one": "google",
  slack: "slack",
  zoom: "zoom",
  chatgpt: "openai",
  openai: "openai",
  claude: "anthropic",
  anthropic: "anthropic",
  midjourney: "midjourney",
  deepl: "deepl",
  linkedin: "linkedin",
  "linkedin premium": "linkedin",
  playstation: "playstationnetwork",
  "playstation plus": "playstationnetwork",
  xbox: "xbox",
  "xbox game pass": "xbox",
  nintendo: "nintendoswitch",
  twitch: "twitch",
  vercel: "vercel",
  cloudflare: "cloudflare",
  namecheap: "namecheap",
  ovh: "ovh",
  digitalocean: "digitalocean",
};

export function getServiceLogoUrl(name: string): string | null {
  const key = name.trim().toLowerCase();
  const slug = SERVICE_SLUGS[key];
  if (slug) return `https://cdn.simpleicons.org/${slug}`;

  // essai simple : nom sans espaces/symboles comme slug direct
  const guess = key.replace(/[^a-z0-9]/g, "");
  if (guess.length >= 3) {
    return `https://cdn.simpleicons.org/${guess}`;
  }
  return null;
}
