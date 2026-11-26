import type { CategorySlug } from "../lib/categories";
import type { SourceType } from "./schema";

/**
 * Curated starter sources. Every URL below was checked for a valid RSS/Atom
 * response at build time. Sources are intentionally a mix of first-party labs,
 * independent reporting, security advisories, and community feeds.
 */
type SeedFeed = {
  category: CategorySlug;
  name: string;
  url: string;
  sourceType: SourceType;
};

export const SEED_FEEDS: SeedFeed[] = [
  // -------------------------------------------------------------------------
  // Artificial Intelligence
  // -------------------------------------------------------------------------
  {
    category: "AI",
    name: "OpenAI",
    url: "https://openai.com/news/rss.xml",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Google DeepMind",
    url: "https://deepmind.google/blog/rss.xml",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Google Research",
    url: "https://research.google/blog/rss/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Hugging Face",
    url: "https://huggingface.co/blog/feed.xml",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "The Verge · AI",
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "MIT Technology Review · AI",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "NVIDIA Blog",
    url: "https://blogs.nvidia.com/feed/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "arXiv · cs.AI",
    url: "https://rss.arxiv.org/rss/cs.AI",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Import AI",
    url: "https://importai.substack.com/feed",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "The Gradient",
    url: "https://thegradient.pub/rss/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Simon Willison",
    url: "https://simonwillison.net/atom/everything/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "The Decoder",
    url: "https://the-decoder.com/feed/",
    sourceType: "rss",
  },
  {
    category: "AI",
    name: "Hacker News",
    url: "https://hnrss.org/frontpage",
    sourceType: "community",
  },
  {
    category: "AI",
    name: "Hacker News · AI",
    url: "https://hnrss.org/newest?q=AI",
    sourceType: "community",
  },

  // -------------------------------------------------------------------------
  // Cybersecurity
  // -------------------------------------------------------------------------
  {
    category: "CYBERSEC",
    name: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "BleepingComputer",
    url: "https://www.bleepingcomputer.com/feed/",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "Krebs on Security",
    url: "https://krebsonsecurity.com/feed/",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "CISA Advisories",
    url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    sourceType: "advisory",
  },
  {
    category: "CYBERSEC",
    name: "Dark Reading",
    url: "https://www.darkreading.com/rss.xml",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "SecurityWeek",
    url: "https://www.securityweek.com/feed/",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "The Record",
    url: "https://therecord.media/feed",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "Schneier on Security",
    url: "https://www.schneier.com/feed/atom/",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "SANS Internet Storm Center",
    url: "https://isc.sans.edu/rssfeed.xml",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "Google Project Zero",
    url: "https://googleprojectzero.blogspot.com/feeds/posts/default",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "CyberScoop",
    url: "https://cyberscoop.com/feed/",
    sourceType: "rss",
  },
  {
    category: "CYBERSEC",
    name: "Hacker News · Security",
    url: "https://hnrss.org/newest?q=cybersecurity",
    sourceType: "community",
  },
];
