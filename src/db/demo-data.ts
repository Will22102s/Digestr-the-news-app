import { count, eq } from "drizzle-orm";
import { estimateReadTimeMinutes } from "../lib/text";
import { db } from "./index";
import { articles, briefings, categories, feeds, settings } from "./schema";

/**
 * A small, hand-written library that lets a fresh install show a complete
 * reading experience before the user adds a key or syncs a feed. The stories
 * are clearly labelled as samples in the UI and can be replaced from Settings.
 */

const DEMO_SEEDED_SETTING = "demo_seeded";

export type DemoStatus = {
  active: boolean;
  articles: number;
  briefings: number;
};

type DemoArticle = {
  feed: string;
  category: "AI" | "CYBERSEC";
  title: string;
  url: string;
  snippet: string;
  minutesAgo: number;
};

const DEMO_ARTICLES: DemoArticle[] = [
  {
    feed: "OpenAI",
    category: "AI",
    title: "OpenAI previews a more deliberate reasoning model",
    url: "https://openai.com/news/",
    snippet:
      "The company showed a model that spends longer on multi-step problems before answering. Early testers say the trade-off is latency, not capability.",
    minutesAgo: 42,
  },
  {
    feed: "Google DeepMind",
    category: "AI",
    title: "DeepMind pairs reasoning traces with a new evaluation suite",
    url: "https://deepmind.google/discover/blog/",
    snippet:
      "Researchers published a benchmark that scores not only final answers but the quality of the intermediate steps. The goal is to make progress easier to audit.",
    minutesAgo: 68,
  },
  {
    feed: "The Verge · AI",
    category: "AI",
    title: "The benchmark race is now about showing the work",
    url: "https://www.theverge.com/ai-artificial-intelligence",
    snippet:
      "Every major lab is suddenly shipping a reasoning mode. The interesting question is no longer who tops the leaderboard, but whose explanations hold up under scrutiny.",
    minutesAgo: 95,
  },
  {
    feed: "Simon Willison",
    category: "AI",
    title: "Notes from a week of testing reasoning APIs",
    url: "https://simonwillison.net/",
    snippet:
      "A hands-on log of prompt patterns, token costs, and the places where a slower model is genuinely worth the wait. The short version: use it for planning, not for autocomplete.",
    minutesAgo: 130,
  },
  {
    feed: "Hugging Face",
    category: "AI",
    title: "Open-weight models close the gap on long-context tasks",
    url: "https://huggingface.co/blog",
    snippet:
      "A new wave of community checkpoints handles much longer inputs without the usual memory blow-up. Teams are already testing them for document review and local assistants.",
    minutesAgo: 175,
  },
  {
    feed: "NVIDIA Blog",
    category: "AI",
    title: "A smaller inference stack for always-on assistants",
    url: "https://blogs.nvidia.com/blog/category/generative-ai/",
    snippet:
      "The pitch is simple: keep the model warm, keep the power draw low, and move the boring parts closer to the user. Edge inference is becoming an operations story.",
    minutesAgo: 210,
  },
  {
    feed: "MIT Technology Review · AI",
    category: "AI",
    title: "The quiet economics of running models at the edge",
    url: "https://www.technologyreview.com/topic/artificial-intelligence/",
    snippet:
      "Cloud bills are only one line item. Latency, privacy, and the cost of a bad offline experience are reshaping where teams choose to run their models.",
    minutesAgo: 265,
  },
  {
    feed: "Import AI",
    category: "AI",
    title: "Three labs, three bets on the next scaling curve",
    url: "https://importai.substack.com/",
    snippet:
      "One lab is betting on data, another on inference-time compute, and a third on tool use. The disagreement is useful because it makes the next year testable.",
    minutesAgo: 320,
  },
  {
    feed: "Google AI Blog",
    category: "AI",
    title: "A practical guide to grounded retrieval for assistants",
    url: "https://blog.google/technology/ai/",
    snippet:
      "The engineering write-up focuses on the unglamorous parts: chunking, freshness, and refusing to answer when the evidence is thin. Grounding is a product decision.",
    minutesAgo: 380,
  },
  {
    feed: "The Decoder",
    category: "AI",
    title: "Why model routers are suddenly everywhere",
    url: "https://the-decoder.com/",
    snippet:
      "Instead of picking one model, teams send each request to the cheapest capable option. The result is a new layer of infrastructure that nobody planned to own.",
    minutesAgo: 440,
  },
  {
    feed: "CISA Advisories",
    category: "CYBERSEC",
    title: "CISA adds an edge-device flaw to its exploited vulnerabilities list",
    url: "https://www.cisa.gov/news-events/cybersecurity-advisories",
    snippet:
      "The advisory urges federal agencies to patch immediately, citing evidence of active exploitation. The affected devices sit at the boundary between public and private networks.",
    minutesAgo: 55,
  },
  {
    feed: "SecurityWeek",
    category: "CYBERSEC",
    title: "What defenders should know about the latest edge exploitation",
    url: "https://www.securityweek.com/",
    snippet:
      "A close read of the observed chain and the telemetry that catches it. The common thread is an internet-facing appliance that was never treated as critical.",
    minutesAgo: 82,
  },
  {
    feed: "Krebs on Security",
    category: "CYBERSEC",
    title: "A rushed patch leaves the back door ajar",
    url: "https://krebsonsecurity.com/",
    snippet:
      "Researchers found that an emergency fix closed the advertised hole but left a diagnostic path reachable. The lesson is to verify the fix, not just the version number.",
    minutesAgo: 118,
  },
  {
    feed: "BleepingComputer",
    category: "CYBERSEC",
    title: "Attackers chain an old bug with a new bypass",
    url: "https://www.bleepingcomputer.com/",
    snippet:
      "The campaign combines a well-known configuration mistake with a fresh authentication bypass. Neither flaw is exotic on its own; the combination is what makes it dangerous.",
    minutesAgo: 150,
  },
  {
    feed: "CyberScoop",
    category: "CYBERSEC",
    title: "How a credential-phishing wave hit small SaaS teams",
    url: "https://cyberscoop.com/",
    snippet:
      "Attackers targeted shared inboxes and approval workflows rather than executives. Small teams are attractive because a single compromised account can reach every customer.",
    minutesAgo: 195,
  },
  {
    feed: "The Record",
    category: "CYBERSEC",
    title: "Identity providers tighten session rules after a phishing surge",
    url: "https://therecord.media/",
    snippet:
      "Several providers are shortening refresh tokens and prompting for re-authentication more often. The changes are small on paper and disruptive in practice.",
    minutesAgo: 235,
  },
  {
    feed: "Google Project Zero",
    category: "CYBERSEC",
    title: "Tracking the infrastructure behind a phishing kit",
    url: "https://googleprojectzero.blogspot.com/",
    snippet:
      "Analysts mapped the hosting patterns and reused certificates behind a widely sold kit. The infrastructure is cheap to rebuild, which is why takedowns rarely stick.",
    minutesAgo: 280,
  },
  {
    feed: "Schneier on Security",
    category: "CYBERSEC",
    title: "The real lesson from another password reset",
    url: "https://www.schneier.com/",
    snippet:
      "Every incident produces a fresh round of advice to change passwords. The structural problem is that so much of the web still treats a shared secret as proof of identity.",
    minutesAgo: 330,
  },
  {
    feed: "Dark Reading",
    category: "CYBERSEC",
    title: "Security teams rethink the patch window",
    url: "https://www.darkreading.com/",
    snippet:
      "The old monthly cadence is colliding with exploits that arrive in days. Teams are experimenting with staged rollouts and better rollback plans instead of simply patching faster.",
    minutesAgo: 390,
  },
  {
    feed: "SANS Internet Storm Center",
    category: "CYBERSEC",
    title: "A quiet week for exploits, a loud week for misconfigurations",
    url: "https://isc.sans.edu/",
    snippet:
      "Handlers note that most of the incidents they saw came from exposed storage and default credentials. The boring controls are still doing most of the work.",
    minutesAgo: 450,
  },
];

type DemoBriefing = {
  categorySlug: "ALL" | "AI" | "CYBERSEC";
  title: string;
  contentMarkdown: string;
  articleCount: number;
  minutesAgo: number;
};

const DEMO_BRIEFINGS: DemoBriefing[] = [
  {
    categorySlug: "ALL",
    title: "The reasoning race meets a patching problem",
    articleCount: 12,
    minutesAgo: 45,
    contentMarkdown: `The day's reporting splits into two conversations that rarely share a page. One is about models that are learning to slow down and show their work. The other is about defenders who are running out of time to patch the devices that sit at the edge of the network.

## Models learn to show their work

[OpenAI](https://openai.com/news/) previewed a model that spends longer on multi-step problems before it answers, and early testers describe the trade-off as latency rather than capability. [Google DeepMind](https://deepmind.google/discover/blog/) used the same week to publish an evaluation suite that scores the intermediate steps, not just the final answer. The shift matters because it makes progress easier to audit — and easier to challenge.

[The Verge](https://www.theverge.com/ai-artificial-intelligence) frames the benchmark race as a contest over explanations, while [Simon Willison](https://simonwillison.net/) offers the practitioner's version: reasoning modes are worth the wait for planning, and a poor fit for autocomplete. The useful disagreement is about where the extra compute actually buys reliability.

## Efficiency moves closer to the user

[Hugging Face](https://huggingface.co/blog) highlighted open-weight checkpoints that handle longer inputs without the usual memory blow-up. [NVIDIA](https://blogs.nvidia.com/blog/category/generative-ai/) is pitching a smaller inference stack for always-on assistants, and [MIT Technology Review](https://www.technologyreview.com/topic/artificial-intelligence/) points out that cloud bills are only one line item. Latency, privacy, and the cost of a bad offline experience are reshaping where teams choose to run their models.

[Import AI](https://importai.substack.com/) captures the strategic split: one lab is betting on data, another on inference-time compute, a third on tool use. The disagreement is useful because it makes the next year testable.

## A familiar flaw, a familiar rush

[CISA](https://www.cisa.gov/news-events/cybersecurity-advisories) added an edge-device flaw to its exploited vulnerabilities list and urged agencies to patch immediately. [SecurityWeek](https://www.securityweek.com/) walked through the observed chain and the telemetry that catches it. The common thread is an internet-facing appliance that was never treated as critical.

[Krebs on Security](https://krebsonsecurity.com/) reports that an emergency fix closed the advertised hole but left a diagnostic path reachable. [BleepingComputer](https://www.bleepingcomputer.com/) describes a campaign that chains an old configuration mistake with a fresh authentication bypass. Neither flaw is exotic on its own; the combination is what makes it dangerous.

## Identity is still the front door

[CyberScoop](https://cyberscoop.com/) traced a credential-phishing wave aimed at small SaaS teams and their shared inboxes. [The Record](https://therecord.media/) notes that identity providers are shortening sessions and prompting for re-authentication more often — small changes on paper, disruptive in practice. [Google Project Zero](https://googleprojectzero.blogspot.com/) mapped the cheap, rebuildable infrastructure behind a widely sold phishing kit.

[Schneier on Security](https://www.schneier.com/) makes the structural point: another password reset is not a fix while so much of the web still treats a shared secret as proof of identity. The practical agenda is less dramatic than the headlines — verify patches, shorten sessions, and treat the edge as critical infrastructure.

*This is a sample briefing bundled with Digestr so the reading experience is complete before you add a key or sync a feed.*`,
  },
  {
    categorySlug: "AI",
    title: "Reasoning models learn to show their work",
    articleCount: 8,
    minutesAgo: 95,
    contentMarkdown: `The most interesting AI story this week is not a leaderboard score. It is the slow, awkward transition from models that answer quickly to models that explain how they got there.

## The evaluation moves inside the answer

[OpenAI](https://openai.com/news/) previewed a model that spends longer on multi-step problems, and [Google DeepMind](https://deepmind.google/discover/blog/) published a suite that scores the intermediate steps. [The Verge](https://www.theverge.com/ai-artificial-intelligence) is right that the benchmark race is now about whose explanations hold up, not just whose final answer is correct.

For builders, [Simon Willison](https://simonwillison.net/) supplies the useful field notes: reasoning modes earn their latency on planning tasks and feel wasteful in autocomplete. The practical question is where to spend the extra compute, not whether to spend it everywhere.

## Smaller stacks, longer contexts

[Hugging Face](https://huggingface.co/blog) reports open-weight checkpoints closing the gap on long-context work, while [NVIDIA](https://blogs.nvidia.com/blog/category/generative-ai/) is optimising a smaller inference stack for always-on assistants. [MIT Technology Review](https://www.technologyreview.com/topic/artificial-intelligence/) adds the economics: latency, privacy, and offline reliability can matter more than the raw cloud bill.

[Import AI](https://importai.substack.com/) frames the strategic disagreement between labs betting on data, inference-time compute, and tool use. That disagreement is healthy. It gives the next year a set of falsifiable bets instead of a single narrative.

The through-line is maturity. The conversation is moving from what a model can demo to what a team can operate, audit, and afford.`,
  },
  {
    categorySlug: "CYBERSEC",
    title: "The edge is where the pressure shows",
    articleCount: 8,
    minutesAgo: 140,
    contentMarkdown: `This week's security reporting keeps returning to the same uncomfortable place: the internet-facing appliance that everyone forgot to treat as critical.

## Patch, then verify the patch

[CISA](https://www.cisa.gov/news-events/cybersecurity-advisories) added an edge-device flaw to its exploited vulnerabilities list, citing active exploitation. [SecurityWeek](https://www.securityweek.com/) published the telemetry that catches the observed chain. The details differ, but the pattern is familiar: a device at the boundary, a rushed maintenance window, and a gap between "patched" and "fixed."

[Krebs on Security](https://krebsonsecurity.com/) has the sharpest example. An emergency fix closed the advertised hole but left a diagnostic path reachable. [BleepingComputer](https://www.bleepingcomputer.com/) describes attackers chaining an old configuration mistake with a new authentication bypass. Neither flaw is exotic on its own. The combination is what makes it dangerous.

## Identity remains the soft target

[CyberScoop](https://cyberscoop.com/) traced a credential-phishing wave aimed at small SaaS teams, where a single compromised shared inbox can reach every customer. [The Record](https://therecord.media/) reports that identity providers are tightening session rules in response — shorter refresh tokens, more re-authentication prompts.

[Google Project Zero](https://googleprojectzero.blogspot.com/) mapped the hosting patterns and reused certificates behind a widely sold phishing kit. The infrastructure is cheap to rebuild, which is why takedowns rarely stick. [Schneier on Security](https://www.schneier.com/) supplies the structural conclusion: another password reset is not a fix while a shared secret remains the primary proof of identity.

The useful takeaways are unglamorous. Verify the fix, shorten sessions, inventory the edge, and assume the phishing kit will be rebuilt by next week.`,
  },
];

function setDemoSeeded(): void {
  const updatedAt = new Date();
  db.insert(settings)
    .values({ key: DEMO_SEEDED_SETTING, value: "1", updatedAt })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: "1", updatedAt },
    })
    .run();
}

function demoSeeded(): boolean {
  const row = db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, DEMO_SEEDED_SETTING))
    .get();

  return row?.value === "1";
}

export function getDemoStatus(): DemoStatus {
  const articleCount = Number(
    db
      .select({ value: count() })
      .from(articles)
      .where(eq(articles.isDemo, true))
      .get()?.value ?? 0,
  );
  const briefingCount = Number(
    db
      .select({ value: count() })
      .from(briefings)
      .where(eq(briefings.isDemo, true))
      .get()?.value ?? 0,
  );

  return {
    active: articleCount > 0,
    articles: articleCount,
    briefings: briefingCount,
  };
}

/**
 * Populate the sample library. Feed rows are used as the "sources" so story
 * clusters look like real multi-source coverage, but every sample article and
 * briefing carries `isDemo` and can be removed without touching live data.
 */
export function seedDemoData(): DemoStatus {
  const existing = getDemoStatus();
  if (existing.articles > 0 || existing.briefings > 0) return existing;

  const feedRows = db
    .select({
      id: feeds.id,
      name: feeds.name,
      categoryId: feeds.categoryId,
      slug: categories.slug,
    })
    .from(feeds)
    .innerJoin(categories, eq(feeds.categoryId, categories.id))
    .all();

  if (feedRows.length === 0) return existing;

  const byName = new Map(feedRows.map((row) => [row.name, row]));
  const byCategory = new Map<string, typeof feedRows>();

  for (const row of feedRows) {
    const pool = byCategory.get(row.slug) ?? [];
    pool.push(row);
    byCategory.set(row.slug, pool);
  }

  const now = Date.now();
  const articleRows = DEMO_ARTICLES.flatMap((definition) => {
    const feed =
      byName.get(definition.feed) ?? byCategory.get(definition.category)?.[0];

    if (!feed) return [];

    return [
      {
        feedId: feed.id,
        categoryId: feed.categoryId,
        title: definition.title,
        url: definition.url,
        snippet: definition.snippet,
        publishedAt: new Date(now - definition.minutesAgo * 60_000),
        isDemo: true,
        createdAt: new Date(now),
      },
    ];
  });

  if (articleRows.length > 0) {
    db.insert(articles)
      .values(articleRows)
      .onConflictDoNothing({ target: articles.url })
      .run();
  }

  const briefingRows = DEMO_BRIEFINGS.map((definition) => ({
    categorySlug: definition.categorySlug,
    title: definition.title,
    contentMarkdown: definition.contentMarkdown,
    readTimeMinutes: estimateReadTimeMinutes(definition.contentMarkdown),
    articleCount: definition.articleCount,
    provider: "demo",
    isDemo: true,
    createdAt: new Date(now - definition.minutesAgo * 60_000),
  }));

  db.insert(briefings).values(briefingRows).run();
  setDemoSeeded();

  return getDemoStatus();
}

/** Seed once, only when the library has never held any stories. */
export function seedDemoDataIfNeeded(): DemoStatus {
  const articleCount = Number(
    db.select({ value: count() }).from(articles).get()?.value ?? 0,
  );

  if (articleCount > 0 || demoSeeded()) return getDemoStatus();

  return seedDemoData();
}

export function clearDemoData(): DemoStatus {
  db.delete(briefings).where(eq(briefings.isDemo, true)).run();
  db.delete(articles).where(eq(articles.isDemo, true)).run();
  return getDemoStatus();
}

/** Replace the sample library with a fresh copy (used by Settings). */
export function resetDemoData(): DemoStatus {
  clearDemoData();
  return seedDemoData();
}
