import { prisma } from "./db";
import { hashPassword } from "./password";
import {
  buy,
  createBinaryMarket,
  createMultiMarket,
  resolveMarket,
  marketSnapshot,
  sell,
  type LedgerMarket,
  type ResolveInput,
  type Wallet,
} from "./ledger";

type SeedUser = Wallet & {
  username: string;
  name: string;
  email: string;
  bio: string;
  avatarColor: string;
  startingBalance: number;
  isDemo: boolean;
  password: string;
  createdAt: Date;
};

type AnswerSpec = { key: string; text: string; probability: number };

type Spec = {
  slug: string;
  question: string;
  description: string;
  topic: string;
  creator: string;
  ante: number;
  createdDaysAgo: number;
  closeInDays: number;
  closeOn?: string;
  trades: number;
  comments: { user: string; body: string; replyTo?: number; daysAgo: number }[];
  demo?: { amount: number; outcome?: "YES" | "NO"; answer?: string; daysAgo: number };
} & (
  | { type: "BINARY"; probability: number; path: number[] }
  | { type: "MULTIPLE"; answers: AnswerSpec[]; path: number[][] }
) &
  (
    | { resolve?: undefined }
    | { resolve: { daysAgo: number; input: ResolveInput } }
  );

const DAY = 86_400_000;

const CLOSE_ON: Record<string, string> = {
  "fed-cuts-june-2027": "2027-07-01T16:00:00.000Z",
  "bitcoin-150k": "2027-06-30T23:00:00.000Z",
  "agent-benchmark-90": "2028-06-30T23:00:00.000Z",
  "us-china-tariff-pause": "2027-04-01T16:00:00.000Z",
  "foldable-iphone": "2027-12-31T23:00:00.000Z",
  "starship-crew-2028": "2027-12-31T23:00:00.000Z",
  "cpi-below-25-h1": "2027-07-15T16:00:00.000Z",
  "eth-etf-20b": "2027-12-31T23:00:00.000Z",
  "openai-hardware": "2027-12-31T23:00:00.000Z",
  "spx-7000-2026": "2027-12-31T23:00:00.000Z",
  "quantum-advantage-paper": "2027-12-31T23:00:00.000Z",
  "warmest-year-2027": "2028-01-31T16:00:00.000Z",
  "euro-2028": "2028-07-15T18:00:00.000Z",
  "nba-champion-2027": "2027-06-30T16:00:00.000Z",
  "model-leader-2027": "2027-12-31T23:00:00.000Z",
};

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(path: number[], u: number) {
  if (path.length === 1) return path[0];
  const x = Math.min(path.length - 1, Math.max(0, u * (path.length - 1)));
  const i = Math.min(path.length - 2, Math.floor(x));
  const t = x - i;
  return path[i] * (1 - t) + path[i + 1] * t;
}

const users: Omit<SeedUser, "balance" | "createdAt">[] = [
  { id: "usr_demo", username: "demo", name: "Demo Trader", email: "demo@triggerpoint.global", bio: "A shared desk for trying the market. Play money only.", avatarColor: "#2A333D", startingBalance: 1000, isDemo: true, password: "demo" },
  { id: "usr_elena", username: "elena", name: "Elena Voss", email: "elena@triggerpoint.global", bio: "Macro and policy. I fade crowded narratives.", avatarColor: "#3D4F63", startingBalance: 12000, isDemo: false, password: "elena" },
  { id: "usr_marcus", username: "marcus", name: "Marcus Hale", email: "marcus@triggerpoint.global", bio: "Rates, indexes, and the occasional long shot.", avatarColor: "#345E4A", startingBalance: 15000, isDemo: false, password: "marcus" },
  { id: "usr_priya", username: "priya", name: "Priya Raman", email: "priya@triggerpoint.global", bio: "AI labs and the gap between demos and deployments.", avatarColor: "#4A4458", startingBalance: 8000, isDemo: false, password: "priya" },
  { id: "usr_jonas", username: "jonas", name: "Jonas Adler", email: "jonas@triggerpoint.global", bio: "Cross-asset. Mostly here for the close dates.", avatarColor: "#5C5346", startingBalance: 9000, isDemo: false, password: "jonas" },
  { id: "usr_sofia", username: "sofia", name: "Sofia Mendes", email: "sofia@triggerpoint.global", bio: "Tech hardware and the ships that slip.", avatarColor: "#6E4545", startingBalance: 7000, isDemo: false, password: "sofia" },
  { id: "usr_kenji", username: "kenji", name: "Kenji Sato", email: "kenji@triggerpoint.global", bio: "Crypto structure, not the timeline memes.", avatarColor: "#3E4C55", startingBalance: 10000, isDemo: false, password: "kenji" },
  { id: "usr_amira", username: "amira", name: "Amira Hassan", email: "amira@triggerpoint.global", bio: "Geopolitics, slowly. I trade the calendar.", avatarColor: "#3A5348", startingBalance: 6500, isDemo: false, password: "amira" },
  { id: "usr_leo", username: "leo", name: "Leo Park", email: "leo@triggerpoint.global", bio: "Sports markets and mispriced 'other'.", avatarColor: "#4E5A46", startingBalance: 5000, isDemo: false, password: "leo" },
  { id: "usr_nora", username: "nora", name: "Nora Berg", email: "nora@triggerpoint.global", bio: "Science milestones. Patient bids.", avatarColor: "#5A4E46", startingBalance: 8500, isDemo: false, password: "nora" },
];

const traderIds = users.filter((user) => user.username !== "demo").map((user) => user.id);

function specs(now: number): Spec[] {
  return [
    {
      slug: "fed-cuts-june-2027",
      type: "BINARY",
      question: "Will the Fed cut the policy rate at least twice between December 2026 and June 2027?",
      description:
        "Resolves YES if the Federal Reserve's target range for the federal funds rate is lowered at two or more scheduled FOMC meetings with decision dates from 1 December 2026 through 30 June 2027, inclusive.\n\nA cut is a lower upper bound of the target range versus the previous scheduled decision. Emergency intermeeting moves count. Holding the range steady does not. The source is the FOMC statement and implementation note on federalreserve.gov.",
      topic: "Economics",
      creator: "usr_elena",
      ante: 280,
      probability: 0.46,
      path: [0.46, 0.41, 0.33, 0.38, 0.52, 0.47, 0.44],
      createdDaysAgo: 46,
      closeInDays: 210,
      trades: 72,
      demo: { amount: 50, outcome: "YES", daysAgo: 1 },
      comments: [
        { user: "usr_marcus", body: "The dots still say one cut and the market keeps pricing two. I'm with the dots until the next labor print.", daysAgo: 12 },
        { user: "usr_demo", body: "Buying a little YES. Shelter inflation is the only piece that still looks sticky, and that lags.", daysAgo: 6 },
        { user: "usr_elena", body: "Shelter lags, but the committee has been explicit that they want more than one soft quarter. I wouldn't size this yet.", daysAgo: 5, replyTo: 1 },
        { user: "usr_jonas", body: "Close date is the June meeting. Worth remembering a July cut does not count.", daysAgo: 2 },
      ],
    },
    {
      slug: "bitcoin-150k",
      type: "BINARY",
      question: "Will Bitcoin trade above $150,000 before 1 July 2027?",
      description:
        "Resolves YES if any print of the BTCUSD index on a named reference venue (Coinbase, Bitstamp, or Kraken spot) is at or above 150,000 between the open of this market and 23:59 UTC on 30 June 2027.\n\nWicks count. A futures-only print does not. If the venues disagree, the median of the three is used.",
      topic: "Crypto",
      creator: "usr_kenji",
      ante: 320,
      probability: 0.38,
      path: [0.38, 0.51, 0.44, 0.29, 0.36, 0.41, 0.34],
      createdDaysAgo: 60,
      closeInDays: 220,
      trades: 80,
      demo: { amount: 40, outcome: "NO", daysAgo: 1 },
      comments: [
        { user: "usr_kenji", body: "The path to 150 needs both ETF inflows and a weaker dollar. One of those is in the price already.", daysAgo: 9 },
        { user: "usr_sofia", body: "NO at this level feels like selling a call. Fine if you are happy to be wrong slowly.", daysAgo: 4 },
      ],
    },
    {
      slug: "agent-benchmark-90",
      type: "BINARY",
      question: "Will a public AI agent benchmark post a verified score above 90 before July 2028?",
      description:
        "Resolves YES if, before 1 July 2028, a widely cited public agent benchmark (SWE-bench Verified, OSWorld, or a successor adopted by at least two frontier labs) shows a score above 90 from a named model, reproduced by a party other than the lab that trained it.\n\nVendor blog posts without a public eval harness do not count. The resolution note will link the reproduction.",
      topic: "AI",
      creator: "usr_priya",
      ante: 240,
      probability: 0.57,
      path: [0.57, 0.63, 0.58, 0.49, 0.54, 0.61],
      createdDaysAgo: 38,
      closeInDays: 500,
      trades: 64,
      demo: { amount: 25, outcome: "YES", daysAgo: 1 },
      comments: [
        { user: "usr_priya", body: "The harnesses keep moving. I'm only counting a frozen test set, which is why this isn't 80.", daysAgo: 8 },
        { user: "usr_leo", body: "If they refresh the test set in December the whole market gets messy. Criteria should say frozen.", daysAgo: 3 },
        { user: "usr_priya", body: "Agreed — I'll resolve against the version of the benchmark published on the day the score is claimed.", daysAgo: 3, replyTo: 1 },
      ],
    },
    {
      slug: "us-china-tariff-pause",
      type: "BINARY",
      question: "Will the US and China announce a formal tariff pause before April 2027?",
      description:
        "Resolves YES if, before 1 April 2027, both governments publish a measure that suspends or rolls back at least one existing bilateral tariff category for a stated period of 90 days or more.\n\nA joint communique that only promises talks does not count. The texts that count are the US Federal Register notice and the corresponding PRC Customs Tariff Commission notice.",
      topic: "Geopolitics",
      creator: "usr_amira",
      ante: 260,
      probability: 0.41,
      path: [0.41, 0.36, 0.48, 0.44, 0.39, 0.42],
      createdDaysAgo: 28,
      closeInDays: 125,
      trades: 58,
      comments: [
        { user: "usr_amira", body: "A pause is a scheduling tool, not a deal. The base rate on '90 days of quiet' is higher than people trade.", daysAgo: 7 },
        { user: "usr_elena", body: "I'll take the NO. The calendar is full of midterms-adjacent hearings and nobody wants the photo.", daysAgo: 2 },
      ],
    },
    {
      slug: "foldable-iphone",
      type: "BINARY",
      question: "Will Apple release a foldable iPhone for retail sale during 2027?",
      description:
        "Resolves YES if Apple offers a foldable iPhone for customer purchase, in at least one country, with a ship date in the 2027 calendar year.\n\nAn unveiling with a 2028 ship date is NO. A developer-only prototype is NO. The source is Apple's own store listing or a press release naming a price and a ship window.",
      topic: "Tech",
      creator: "usr_sofia",
      ante: 200,
      probability: 0.33,
      path: [0.33, 0.29, 0.37, 0.31, 0.28, 0.34],
      createdDaysAgo: 22,
      closeInDays: 400,
      trades: 48,
      comments: [
        { user: "usr_sofia", body: "Supply chain notes are not a ship date. I'm short this until there's a panel in mass production.", daysAgo: 6 },
      ],
    },
    {
      slug: "starship-crew-2028",
      type: "BINARY",
      question: "Will SpaceX complete a crewed Starship orbital flight before 2028?",
      description:
        "Resolves YES if a Starship vehicle carries at least one human to orbit and returns them to Earth, with splashdown or landing before 1 January 2028.\n\nAn uncrewed flight, a hop, or a crewed flight that does not reach orbit does not count. The source is a SpaceX mission summary corroborated by a second outlet.",
      topic: "Science",
      creator: "usr_nora",
      ante: 220,
      probability: 0.44,
      path: [0.44, 0.5, 0.47, 0.39, 0.42, 0.46],
      createdDaysAgo: 33,
      closeInDays: 400,
      trades: 52,
      comments: [
        { user: "usr_nora", body: "The uncrewed cadence is the tell. Crew needs a repeatable reentry, and that is still the long pole.", daysAgo: 10 },
        { user: "usr_jonas", body: "Bought a small YES. The definition is kinder than 'lands on the tower with people aboard'.", daysAgo: 4 },
      ],
    },
    {
      slug: "cpi-below-25-h1",
      type: "BINARY",
      question: "Will US CPI inflation print below 2.5% for any month in the first half of 2027?",
      description:
        "Resolves YES if any monthly year-over-year CPI-U reading published by the BLS, covering a month from January 2027 through June 2027, is strictly below 2.5%.\n\nThe first print counts, not a later revision. Core CPI does not count. The source is the BLS CPI news release.",
      topic: "Economics",
      creator: "usr_marcus",
      ante: 210,
      probability: 0.52,
      path: [0.52, 0.48, 0.55, 0.61, 0.57, 0.53],
      createdDaysAgo: 18,
      closeInDays: 230,
      trades: 44,
      comments: [
        { user: "usr_marcus", body: "Base effects do a lot of the work in Q1. I'm not sure the committee will enjoy the number even if we get it.", daysAgo: 5 },
      ],
    },
    {
      slug: "eth-etf-20b",
      type: "BINARY",
      question: "Will spot Ethereum ETFs record more than $20B of net inflows during 2027?",
      description:
        "Resolves YES if the sum of net creations across US spot ether ETFs, from 1 January 2027 through 31 December 2027, exceeds 20 billion US dollars.\n\nThe source is the issuer flow tally compiled by Bloomberg and cross-checked against the funds' daily creation files. A single issuer's marketing number does not count.",
      topic: "Crypto",
      creator: "usr_kenji",
      ante: 180,
      probability: 0.29,
      path: [0.29, 0.34, 0.26, 0.22, 0.27, 0.24],
      createdDaysAgo: 40,
      closeInDays: 400,
      trades: 50,
      comments: [
        { user: "usr_kenji", body: "Twenty billion is a bitcoin-ETF number. Ether's share of flows has not looked like that for a full year.", daysAgo: 11 },
      ],
    },
    {
      slug: "openai-hardware",
      type: "BINARY",
      question: "Will OpenAI ship a first-party consumer hardware device before 2028?",
      description:
        "Resolves YES if OpenAI, under its own brand, offers a physical consumer device for public purchase with a ship date before 1 January 2028.\n\nA partnership where another company is the seller of record is NO. Software, an API, or a developer kit that is not a consumer product is NO.",
      topic: "AI",
      creator: "usr_priya",
      ante: 190,
      probability: 0.36,
      path: [0.36, 0.42, 0.33, 0.3, 0.35],
      createdDaysAgo: 15,
      closeInDays: 400,
      trades: 40,
      comments: [
        { user: "usr_sofia", body: "Hardware slips by a year as a habit. I'd want a named manufacturer before I pay up for YES.", daysAgo: 4 },
      ],
    },
    {
      slug: "spx-7000-2026",
      type: "BINARY",
      question: "Will the S&P 500 close above 7,500 on the last trading day of 2027?",
      description:
        "Resolves YES if the official S&P 500 index close on the final NYSE trading session of 2027 is strictly above 7,500.\n\nIntraday prints do not count. The source is the S&P Dow Jones closing value republished by the exchange.",
      topic: "Economics",
      creator: "usr_marcus",
      ante: 300,
      probability: 0.48,
      path: [0.48, 0.55, 0.51, 0.43, 0.46, 0.5, 0.47],
      createdDaysAgo: 55,
      closeInDays: 400,
      trades: 76,
      comments: [
        { user: "usr_elena", body: "This is mostly a multiples question from here. Earnings are not the swing factor into year end.", daysAgo: 8 },
        { user: "usr_nora", body: "Bought NO into the last push. Happy to be wrong if breadth confirms it.", daysAgo: 1 },
      ],
    },
    {
      slug: "eu-ai-act-delay",
      type: "BINARY",
      question: "Will the European Commission delay a major EU AI Act obligation into 2027?",
      description:
        "Resolves YES if, before this market closes, the Commission or Council formally postpones the application date of a core EU AI Act obligation (general-purpose model duties or high-risk system duties) to a date in 2027 or later.\n\nGuidance, a grace period for fines, or a member-state delay does not count. The source is the Official Journal or a Commission implementing decision.",
      topic: "Politics",
      creator: "usr_amira",
      ante: 160,
      probability: 0.61,
      path: [0.61, 0.66, 0.58, 0.63, 0.6],
      createdDaysAgo: 12,
      closeInDays: 180,
      trades: 36,
      comments: [
        { user: "usr_amira", body: "Delay is the path of least resistance once the codes of practice slip. I'm long YES, small.", daysAgo: 3 },
      ],
    },
    {
      slug: "quantum-advantage-paper",
      type: "BINARY",
      question: "Will a peer-reviewed paper demonstrate quantum advantage on a commercially relevant problem before 2028?",
      description:
        "Resolves YES if a peer-reviewed journal publishes, before 1 January 2028, an experiment showing a quantum device outperforming the best classical method on a problem with a stated commercial use, and an independent group does not refute the comparison within 90 days.\n\nRandom-circuit sampling and purely cryptographic demonstrations do not count. The source is the journal article plus the independent note, if any.",
      topic: "Science",
      creator: "usr_nora",
      ante: 170,
      probability: 0.22,
      path: [0.22, 0.26, 0.19, 0.21, 0.18],
      createdDaysAgo: 25,
      closeInDays: 420,
      trades: 34,
      comments: [
        { user: "usr_nora", body: "The word 'commercial' is doing the work. Advantage on a toy Hamiltonian should stay a NO.", daysAgo: 9 },
      ],
    },
    {
      slug: "warmest-year-2027",
      type: "BINARY",
      question: "Will 2027 be the warmest year on record in the NOAA global series?",
      description:
        "Resolves YES if NOAA's annual global surface temperature anomaly for 2027, in the first full-year release, is higher than every prior year in that same series.\n\nLater revisions are ignored. Other agencies' series are ignored. The source is the NOAA National Centers for Environmental Information annual climate report.",
      topic: "Science",
      creator: "usr_nora",
      ante: 150,
      probability: 0.55,
      path: [0.55, 0.58, 0.51, 0.49, 0.53],
      createdDaysAgo: 20,
      closeInDays: 450,
      trades: 32,
      comments: [
        { user: "usr_jonas", body: "A strong El Niño would settle this early. Without one it's a coin flip dressed up as a trend.", daysAgo: 6 },
      ],
    },
    {
      slug: "euro-2028",
      type: "MULTIPLE",
      question: "Which country will win UEFA Euro 2028?",
      description:
        "Resolves to the country that wins the final of UEFA Euro 2028. If the tournament is cancelled or not completed by the close date, the market resolves N/A and stakes are returned.\n\nExtra time and penalties count. The source is UEFA's official match report for the final.",
      topic: "Sports",
      creator: "usr_leo",
      ante: 360,
      answers: [
        { key: "france", text: "France", probability: 0.18 },
        { key: "england", text: "England", probability: 0.16 },
        { key: "spain", text: "Spain", probability: 0.15 },
        { key: "germany", text: "Germany", probability: 0.13 },
        { key: "portugal", text: "Portugal", probability: 0.1 },
        { key: "italy", text: "Italy", probability: 0.09 },
        { key: "netherlands", text: "Netherlands", probability: 0.08 },
        { key: "other", text: "Another country", probability: 0.11 },
      ],
      path: [
        [0.18, 0.16, 0.15, 0.13, 0.1, 0.09, 0.08, 0.11],
        [0.16, 0.18, 0.14, 0.14, 0.11, 0.09, 0.08, 0.1],
        [0.17, 0.15, 0.16, 0.13, 0.1, 0.1, 0.08, 0.11],
        [0.19, 0.16, 0.14, 0.13, 0.1, 0.09, 0.08, 0.11],
      ],
      createdDaysAgo: 50,
      closeInDays: 230,
      trades: 70,
      demo: { amount: 35, answer: "france", daysAgo: 1 },
      comments: [
        { user: "usr_leo", body: "Other is still rich. A quarter of the bracket lives in that bucket and it's priced like a single side.", daysAgo: 14 },
        { user: "usr_sofia", body: "France at 16 feels like the market remembering 2022 more than the current squad.", daysAgo: 3 },
      ],
    },
    {
      slug: "nba-champion-2027",
      type: "MULTIPLE",
      question: "Which team will win the 2027 NBA championship?",
      description:
        "Resolves to the team that wins the 2027 NBA Finals. If the season is cancelled before a champion is named, the market resolves N/A.\n\nRelocations and renames follow the franchise. The source is the NBA's official Finals result.",
      topic: "Sports",
      creator: "usr_leo",
      ante: 240,
      answers: [
        { key: "bos", text: "Boston Celtics", probability: 0.22 },
        { key: "okc", text: "Oklahoma City Thunder", probability: 0.2 },
        { key: "den", text: "Denver Nuggets", probability: 0.14 },
        { key: "nyk", text: "New York Knicks", probability: 0.12 },
        { key: "dal", text: "Dallas Mavericks", probability: 0.1 },
        { key: "other", text: "Another team", probability: 0.22 },
      ],
      path: [
        [0.22, 0.2, 0.14, 0.12, 0.1, 0.22],
        [0.19, 0.24, 0.13, 0.13, 0.09, 0.22],
        [0.18, 0.22, 0.15, 0.14, 0.1, 0.21],
      ],
      createdDaysAgo: 16,
      closeInDays: 200,
      trades: 42,
      comments: [
        { user: "usr_leo", body: "Other at 22 is the honest side of this market. I'm not picking a favorite eight months out.", daysAgo: 5 },
      ],
    },
    {
      slug: "model-leader-2027",
      type: "MULTIPLE",
      question: "Which lab will have the leading public model at the end of 2027?",
      description:
        "Resolves to the lab whose flagship public model leads a fixed basket of third-party leaderboards (Chatbot Arena text, SWE-bench Verified, and GPQA) on 31 December 2027, using a simple average of ranks.\n\nTies break toward the model with the higher Arena score. A lab that has not released weights or an API to the public is not eligible. The resolution note will show the three ranks.",
      topic: "AI",
      creator: "usr_priya",
      ante: 260,
      answers: [
        { key: "openai", text: "OpenAI", probability: 0.28 },
        { key: "anthropic", text: "Anthropic", probability: 0.26 },
        { key: "google", text: "Google", probability: 0.22 },
        { key: "meta", text: "Meta", probability: 0.1 },
        { key: "other", text: "Another lab", probability: 0.14 },
      ],
      path: [
        [0.28, 0.26, 0.22, 0.1, 0.14],
        [0.24, 0.3, 0.22, 0.09, 0.15],
        [0.26, 0.27, 0.24, 0.1, 0.13],
      ],
      createdDaysAgo: 27,
      closeInDays: 400,
      trades: 54,
      comments: [
        { user: "usr_priya", body: "Arena and SWE-bench have picked different winners all year. The average is the point of the market.", daysAgo: 7 },
        { user: "usr_kenji", body: "Another lab is the option on a surprise open model. It's not a throwaway at 14.", daysAgo: 2 },
      ],
    },
    {
      slug: "glasses-free-3d-2026",
      type: "BINARY",
      question: "Will a major phone maker ship a glasses-free 3D display phone in 2026?",
      description:
        "Resolves YES if Apple, Samsung, or Google sells a phone in 2026 whose primary display is marketed as glasses-free 3D or light-field. A limited demo unit that is not for public sale is NO.\n\nThis demo market has been settled by its creator under those criteria.",
      topic: "Tech",
      creator: "usr_sofia",
      ante: 140,
      probability: 0.24,
      path: [0.24, 0.18, 0.14, 0.11],
      createdDaysAgo: 70,
      closeInDays: -20,
      trades: 36,
      demo: { amount: 30, outcome: "YES", daysAgo: 24 },
      resolve: { daysAgo: 18, input: { resolution: "NO" } },
      comments: [
        { user: "usr_sofia", body: "Settled NO. Nothing in the fall lineups matched the criteria.", daysAgo: 18 },
      ],
    },
    {
      slug: "q3-gdp-2026",
      type: "BINARY",
      question: "Will the first print of US Q3 2026 real GDP growth be above 2%?",
      description:
        "Resolves to the advance estimate of quarter-over-quarter annualized real GDP growth for 2026 Q3, as published by the BEA. Above 2.0% is YES. The advance estimate is the one that counts, not the second or third print.\n\nThis demo market was settled by its creator against that release.",
      topic: "Economics",
      creator: "usr_elena",
      ante: 200,
      probability: 0.58,
      path: [0.58, 0.62, 0.54, 0.6, 0.66],
      createdDaysAgo: 40,
      closeInDays: -12,
      trades: 40,
      resolve: { daysAgo: 2, input: { resolution: "MKT", probability: 0.62 } },
      comments: [
        { user: "usr_elena", body: "Settled at 62%. The print was close enough to the line that a binary felt unfair to both sides.", daysAgo: 2 },
        { user: "usr_marcus", body: "Appreciate the partial. A hard YES would have been a coin flip on rounding.", daysAgo: 2, replyTo: 0 },
      ],
    },
    {
      slug: "october-asset-2026",
      type: "MULTIPLE",
      question: "Which asset finished October 2026 higher, gold or bitcoin?",
      description:
        "Resolves to the asset with the larger percentage gain over the October 2026 calendar month. Gold is the LBMA PM fix. Bitcoin is the Coinbase BTCUSD daily close. The comparison is percent, not dollars.\n\nThis demo market was settled by its creator.",
      topic: "Economics",
      creator: "usr_jonas",
      ante: 180,
      answers: [
        { key: "gold", text: "Gold", probability: 0.46 },
        { key: "bitcoin", text: "Bitcoin", probability: 0.54 },
      ],
      path: [
        [0.46, 0.54],
        [0.52, 0.48],
        [0.58, 0.42],
      ],
      createdDaysAgo: 35,
      closeInDays: -15,
      trades: 30,
      resolve: { daysAgo: 20, input: { resolution: "ANSWER", answerId: "ans_october-asset-2026_gold" } },
      comments: [
        { user: "usr_jonas", body: "Settled to gold. Bitcoin's month was positive, just not as positive.", daysAgo: 20 },
      ],
    },
    {
      slug: "summit-keynote-2026",
      type: "BINARY",
      question: "Will the keynote of the 2026 Global Compute Summit be delivered in person?",
      description:
        "Resolves YES if the scheduled opening keynote is delivered by the named speaker, physically on stage. A remote appearance is NO. If the summit is cancelled, the market resolves N/A and stakes are returned.\n\nThis demo market was cancelled by its creator after the organizer withdrew the session.",
      topic: "Tech",
      creator: "usr_sofia",
      ante: 100,
      probability: 0.72,
      path: [0.72, 0.64, 0.6],
      createdDaysAgo: 24,
      closeInDays: -3,
      trades: 18,
      resolve: { daysAgo: 6, input: { resolution: "CANCEL" } },
      comments: [
        { user: "usr_sofia", body: "Cancelled. The session was pulled, so everyone gets their stake back.", daysAgo: 6 },
      ],
    },
  ];
}

type TradeRow = {
  id: string;
  userId: string;
  marketId: string;
  answerId: string;
  outcome: string;
  side: string;
  amount: number;
  shares: number;
  probBefore: number;
  probAfter: number;
  createdAt: Date;
};

type PointRow = { id: string; marketId: string; probability: number; snapshot: string; createdAt: Date };
type PnlRow = { id: string; userId: string; marketId: string; amount: number; createdAt: Date };
type NoteRow = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: Date;
};

let seq = 0;
function nid(prefix: string) {
  seq += 1;
  return `${prefix}_${seq.toString(36)}`;
}

export async function seedDatabase() {
  const existing = await prisma.market.count();
  if (existing > 0) {
    console.log(`Seed skipped: ${existing} markets already in the database.`);
    return;
  }

  const now = Date.now();
  const rand = mulberry32(20261127);
  const wallets = new Map<string, SeedUser>();
  for (const user of users) {
    wallets.set(user.id, {
      ...user,
      balance: user.startingBalance,
      createdAt: new Date(now - (20 + user.startingBalance % 40) * DAY),
    });
  }

  const trades: TradeRow[] = [];
  const worth: { id: string; userId: string; worth: number; createdAt: Date }[] = [];
  const points: PointRow[] = [];
  const pnls: PnlRow[] = [];
  const notes: NoteRow[] = [];
  const persisted: {
    market: LedgerMarket;
    spec: Spec;
    createdAt: Date;
    closeAt: Date;
    resolvedAt: Date | null;
  }[] = [];

  const weight = (id: string) => (id === "usr_marcus" || id === "usr_elena" ? 2 : 1);

  function pickWallet(amount: number) {
    const pool: string[] = [];
    for (const id of traderIds) {
      const wallet = wallets.get(id)!;
      if (wallet.balance >= amount + 20) {
        for (let n = 0; n < weight(id); n++) pool.push(id);
      }
    }
    if (!pool.length) return null;
    return wallets.get(pool[Math.floor(rand() * pool.length)])!;
  }

  function record(market: LedgerMarket, fill: ReturnType<typeof buy>, createdAt: Date) {
    trades.push({
      id: nid("trd"),
      userId: fill.userId,
      marketId: market.id,
      answerId: fill.answerId,
      outcome: fill.outcome,
      side: fill.side,
      amount: fill.amount,
      shares: fill.shares,
      probBefore: fill.probBefore,
      probAfter: fill.probAfter,
      createdAt,
    });
    points.push({
      id: nid("pt"),
      marketId: market.id,
      probability: fill.probAfter,
      snapshot: fill.snapshot,
      createdAt,
    });
    if (fill.side === "SELL" && Math.abs(fill.realizedPnl) > 1e-6) {
      pnls.push({ id: nid("pnl"), userId: fill.userId, marketId: market.id, amount: fill.realizedPnl, createdAt });
    }
    const wallet = wallets.get(fill.userId);
    if (wallet) worth.push({ id: nid("wth"), userId: fill.userId, worth: wallet.balance, createdAt });
  }

  for (const spec of specs(now)) {
    const id = `mkt_${spec.slug}`;
    const creator = wallets.get(spec.creator)!;
    if (creator.balance < spec.ante) throw new Error(`${creator.username} cannot fund ${spec.slug}`);
    creator.balance -= spec.ante;
    const createdAt = new Date(now - spec.createdDaysAgo * DAY);
    worth.push({ id: nid("wth"), userId: creator.id, worth: creator.balance, createdAt });
    const closeAt = spec.closeOn
      ? new Date(spec.closeOn)
      : CLOSE_ON[spec.slug]
        ? new Date(CLOSE_ON[spec.slug])
        : new Date(now + spec.closeInDays * DAY);
    const end = spec.resolve ? new Date(now - spec.resolve.daysAgo * DAY - 2 * DAY) : new Date(now - 6 * 3_600_000);
    const market =
      spec.type === "BINARY"
        ? createBinaryMarket(id, spec.ante, spec.probability)
        : createMultiMarket(
            id,
            spec.ante,
            spec.answers.map((answer) => ({
              id: `ans_${spec.slug}_${answer.key}`,
              text: answer.text,
              probability: answer.probability,
            })),
          );

    points.push({
      id: nid("pt"),
      marketId: id,
      probability: market.probability,
      snapshot: marketSnapshot(market),
      createdAt,
    });

    const steps = spec.trades;
    const demoStep = Math.floor(steps * 0.42);
    for (let step = 0; step < steps; step++) {
      if (spec.demo && step === demoStep) {
        const demo = wallets.get("usr_demo")!;
        const when = new Date(createdAt.getTime() + (end.getTime() - createdAt.getTime()) * 0.42);
        try {
          if (spec.type === "BINARY" && spec.demo.outcome) {
            record(market, buy(market, demo, { amount: spec.demo.amount, outcome: spec.demo.outcome }), when);
          } else if (spec.type === "MULTIPLE" && spec.demo.answer) {
            record(market, buy(market, demo, { amount: spec.demo.amount, answerId: `ans_${spec.slug}_${spec.demo.answer}` }), when);
          }
          notes.push({
            id: nid("ntf"),
            userId: demo.id,
            type: "TRADE",
            title: "Trade filled",
            body: `Bought ${spec.demo.amount.toFixed(2)} TP.`,
            href: `/market/${spec.slug}`,
            read: false,
            createdAt: when,
          });
        } catch (error) {
          console.warn(`Demo trade skipped on ${spec.slug}:`, error instanceof Error ? error.message : error);
        }
      }
      const u = steps === 1 ? 1 : step / (steps - 1);
      const when = new Date(createdAt.getTime() + (end.getTime() - createdAt.getTime()) * ((step + rand()) / steps));
      if (spec.type === "BINARY") {
        const target = lerp(spec.path, u);
        let outcome: "YES" | "NO" = market.probability < target ? "YES" : "NO";
        if (rand() < 0.16) outcome = outcome === "YES" ? "NO" : "YES";
        const gap = Math.abs(target - market.probability);
        let amount = Math.round(8 + rand() * 36 + gap * 220);
        amount = Math.max(5, Math.min(240, amount));
        const wallet = pickWallet(amount);
        if (!wallet) continue;
        const held = market.positions.find((position) => position.userId === wallet.id);
        const sideShares = outcome === "YES" ? held?.sharesYes ?? 0 : held?.sharesNo ?? 0;
        try {
          if (rand() < 0.22 && sideShares > 4) {
            record(market, sell(market, wallet, { shares: sideShares * (0.25 + rand() * 0.45), outcome }), when);
          } else {
            record(market, buy(market, wallet, { amount: Math.min(amount, wallet.balance - 10), outcome }), when);
          }
        } catch {
          // A pool can refuse a trade at the extremes. Skip it.
        }
      } else {
        const waypoint = u * (spec.path.length - 1);
        const left = Math.min(spec.path.length - 2, Math.floor(waypoint));
        const mix = waypoint - left;
        const blended = spec.path[left].map((value, index) => value * (1 - mix) + spec.path[left + 1][index] * mix);
        const total = blended.reduce((sum, value) => sum + value, 0);
        const targets = blended.map((value) => value / total);
        let best = 0;
        let gap = -Infinity;
        market.answers.forEach((answer, index) => {
          const distance = targets[index] - answer.probability;
          if (distance > gap) {
            gap = distance;
            best = index;
          }
        });
        if (rand() < 0.22) best = Math.floor(rand() * market.answers.length);
        let amount = Math.round(4 + rand() * 10 + Math.max(0, gap) * 36);
        amount = Math.max(4, Math.min(22, amount));
        const wallet = pickWallet(amount);
        if (!wallet) continue;
        const answer = market.answers[best];
        const held = market.positions.find((position) => position.userId === wallet.id && position.answerId === answer.id);
        try {
          if (rand() < 0.18 && (held?.shares ?? 0) > 4) {
            record(market, sell(market, wallet, { shares: held!.shares * (0.3 + rand() * 0.4), answerId: answer.id }), when);
          } else {
            record(market, buy(market, wallet, { amount: Math.min(amount, wallet.balance - 10), answerId: answer.id }), when);
          }
        } catch {
          // Skip an unpriceable multi trade.
        }
      }
    }

    if (spec.demo && !spec.resolve) {
      const favorable = spec.slug === "fed-cuts-june-2027" || spec.slug === "bitcoin-150k";
      const when = new Date(end.getTime() - 30 * 60_000);
      try {
        const wallet = wallets.get("usr_marcus")!;
        if (spec.type === "BINARY" && spec.demo.outcome && wallet.balance > 200) {
          const outcome = favorable ? spec.demo.outcome : spec.demo.outcome === "YES" ? "NO" : "YES";
          for (let nudge = 0; nudge < 3; nudge++) {
            record(market, buy(market, wallet, { amount: 55, outcome }), new Date(when.getTime() + nudge * 60_000));
          }
        } else if (spec.type === "MULTIPLE" && spec.demo.answer && wallet.balance > 120) {
          const target = favorable
            ? market.answers.find((answer) => answer.id.endsWith(`_${spec.demo?.answer}`))
            : market.answers.find((answer) => !answer.id.endsWith(`_${spec.demo?.answer}`));
          if (target) {
            record(market, buy(market, wallet, { amount: 28, answerId: target.id }), when);
          }
        }
      } catch {
        // A follow-up nudge can fail if the pool is thin. Earlier trades still move the mark.
      }
    }

    let resolvedAt: Date | null = null;
    if (spec.resolve) {
      resolvedAt = new Date(now - spec.resolve.daysAgo * DAY);
      const input = spec.resolve.input;
      const result = resolveMarket(market, wallets, spec.creator, input);
      points.push({
        id: nid("pt"),
        marketId: id,
        probability: result.probability,
        snapshot: marketSnapshot(market),
        createdAt: resolvedAt,
      });
      for (const entry of result.pnl) {
        pnls.push({ id: nid("pnl"), userId: entry.userId, marketId: id, amount: entry.amount, createdAt: resolvedAt });
      }
      const question = spec.question;
      for (const credit of result.credits) {
        if (credit.role !== "trader") continue;
        notes.push({
          id: nid("ntf"),
          userId: credit.userId,
          type: "RESOLUTION",
          title: "Market resolved",
          body:
            credit.payout > 0.004
              ? `“${question}” paid you ${credit.payout.toFixed(2)} TP.`
              : `“${question}” resolved. Your position paid 0 TP.`,
          href: `/market/${spec.slug}`,
          read: false,
          createdAt: resolvedAt,
        });
      }
    }

    persisted.push({ market, spec, createdAt, closeAt, resolvedAt });
  }

  const fed = persisted.find((item) => item.spec.slug === "fed-cuts-june-2027");
  if (fed) {
    notes.push({
      id: nid("ntf"),
      userId: "usr_demo",
      type: "REPLY",
      title: "New reply",
      body: "Elena Voss replied to your comment on the Fed market.",
      href: "/market/fed-cuts-june-2027",
      read: false,
      createdAt: new Date(now - 5 * DAY),
    });
  }

  const passwordById = new Map<string, string>();
  for (const user of wallets.values()) {
    passwordById.set(user.id, hashPassword(user.password));
  }

  await prisma.user.createMany({
    data: [...wallets.values()].map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      passwordHash: passwordById.get(user.id)!,
      balance: user.balance,
      startingBalance: user.startingBalance,
      bio: user.bio,
      avatarColor: user.avatarColor,
      isDemo: user.isDemo,
      createdAt: user.createdAt,
    })),
  });

  await prisma.market.createMany({
    data: persisted.map(({ market, spec, createdAt, closeAt, resolvedAt }) => ({
      id: market.id,
      slug: spec.slug,
      question: spec.question,
      description: spec.description,
      type: spec.type,
      topic: spec.topic,
      closeAt,
      createdAt,
      resolvedAt,
      resolution: market.resolution,
      resolutionProb: market.resolutionProb,
      resolutionNote: spec.resolve ? "Settled by the market creator under the written criteria." : "",
      poolYes: market.poolYes,
      poolNo: market.poolNo,
      p: market.p,
      probability: market.probability,
      pot: market.pot,
      ante: market.ante,
      volume: market.volume,
      traderCount: market.traderIds.length,
      creatorId: spec.creator,
    })),
  });

  const answerRows = persisted.flatMap(({ market }) =>
    market.answers.map((answer, index) => ({
      id: answer.id,
      marketId: market.id,
      text: answer.text,
      sortIndex: index,
      pool: answer.pool,
      probability: answer.probability,
    })),
  );
  if (answerRows.length) await prisma.answer.createMany({ data: answerRows });

  await prisma.market.createMany({
    data: [
      {
        id: "mkt_poll-desk",
        slug: "poll-desk-setup",
        question: "Which setup do you actually use for a full day of work?",
        description: "A free poll. One vote per person, and you can change it until the poll closes. Nothing here moves TP.",
        type: "POLL",
        topic: "Tech",
        closeAt: new Date("2027-03-01T16:00:00.000Z"),
        createdAt: new Date(now - 12 * DAY),
        probability: 0,
        pot: 0,
        ante: 0,
        volume: 0,
        traderCount: 0,
        creatorId: "usr_priya",
      },
      {
        id: "mkt_poll-news",
        slug: "poll-news-habit",
        question: "Where do you first hear that a market has moved?",
        description: "A free poll. Pick one source. You can switch your vote later. No TP is staked.",
        type: "POLL",
        topic: "Science",
        closeAt: new Date("2027-06-01T16:00:00.000Z"),
        createdAt: new Date(now - 6 * DAY),
        probability: 0,
        pot: 0,
        ante: 0,
        volume: 0,
        traderCount: 0,
        creatorId: "usr_elena",
      },
    ],
  });
  await prisma.answer.createMany({
    data: [
      { id: "ans_desk_laptop", marketId: "mkt_poll-desk", text: "Laptop only", sortIndex: 0, pool: 0, probability: 0 },
      { id: "ans_desk_one", marketId: "mkt_poll-desk", text: "Desktop and one monitor", sortIndex: 1, pool: 0, probability: 0 },
      { id: "ans_desk_dock", marketId: "mkt_poll-desk", text: "Laptop docked to two monitors", sortIndex: 2, pool: 0, probability: 0 },
      { id: "ans_desk_else", marketId: "mkt_poll-desk", text: "Something else", sortIndex: 3, pool: 0, probability: 0 },
      { id: "ans_news_feed", marketId: "mkt_poll-news", text: "The feed itself", sortIndex: 0, pool: 0, probability: 0 },
      { id: "ans_news_chat", marketId: "mkt_poll-news", text: "A group chat", sortIndex: 1, pool: 0, probability: 0 },
      { id: "ans_news_letter", marketId: "mkt_poll-news", text: "A newsletter", sortIndex: 2, pool: 0, probability: 0 },
      { id: "ans_news_alert", marketId: "mkt_poll-news", text: "A price alert", sortIndex: 3, pool: 0, probability: 0 },
    ],
  });
  await prisma.pollVote.createMany({
    data: [
      { id: "vote_desk_demo", userId: "usr_demo", marketId: "mkt_poll-desk", answerId: "ans_desk_dock", createdAt: new Date(now - 2 * DAY) },
      { id: "vote_desk_marcus", userId: "usr_marcus", marketId: "mkt_poll-desk", answerId: "ans_desk_one", createdAt: new Date(now - 4 * DAY) },
      { id: "vote_desk_elena", userId: "usr_elena", marketId: "mkt_poll-desk", answerId: "ans_desk_dock", createdAt: new Date(now - 3 * DAY) },
      { id: "vote_desk_priya", userId: "usr_priya", marketId: "mkt_poll-desk", answerId: "ans_desk_laptop", createdAt: new Date(now - 8 * DAY) },
      { id: "vote_desk_jonas", userId: "usr_jonas", marketId: "mkt_poll-desk", answerId: "ans_desk_dock", createdAt: new Date(now - 1 * DAY) },
      { id: "vote_news_demo", userId: "usr_demo", marketId: "mkt_poll-news", answerId: "ans_news_chat", createdAt: new Date(now - 1 * DAY) },
      { id: "vote_news_nora", userId: "usr_nora", marketId: "mkt_poll-news", answerId: "ans_news_letter", createdAt: new Date(now - 2 * DAY) },
      { id: "vote_news_amira", userId: "usr_amira", marketId: "mkt_poll-news", answerId: "ans_news_feed", createdAt: new Date(now - 3 * DAY) },
      { id: "vote_news_leo", userId: "usr_leo", marketId: "mkt_poll-news", answerId: "ans_news_alert", createdAt: new Date(now - 2 * DAY) },
    ],
  });

  const positionRows = persisted.flatMap(({ market }) =>
    market.positions.map((position) => ({
      id: nid("pos"),
      marketId: market.id,
      ...position,
    })),
  );
  if (positionRows.length) await prisma.position.createMany({ data: positionRows });
  if (trades.length) await prisma.trade.createMany({ data: trades });
  if (points.length) await prisma.probPoint.createMany({ data: points });
  if (pnls.length) await prisma.pnlEntry.createMany({ data: pnls });
  if (worth.length) await prisma.worthPoint.createMany({ data: worth });

  const commentRows: {
    id: string;
    marketId: string;
    userId: string;
    parentId: string | null;
    body: string;
    createdAt: Date;
  }[] = [];
  for (const { market, spec } of persisted) {
    const ids = spec.comments.map(() => nid("cmt"));
    spec.comments.forEach((comment, index) => {
      commentRows.push({
        id: ids[index],
        marketId: market.id,
        userId: comment.user,
        parentId: comment.replyTo === undefined ? null : ids[comment.replyTo],
        body: comment.body,
        createdAt: new Date(now - comment.daysAgo * DAY),
      });
    });
  }
  if (commentRows.length) await prisma.comment.createMany({ data: commentRows });
  if (notes.length) await prisma.notification.createMany({ data: notes });

  await prisma.bookmark.createMany({
    data: [
      { userId: "usr_demo", marketId: "mkt_euro-2028", createdAt: new Date(now - 3 * DAY) },
      { userId: "usr_demo", marketId: "mkt_spx-7000-2026", createdAt: new Date(now - 2 * DAY) },
    ],
  });

  const wealth =
    [...wallets.values()].reduce((sum, user) => sum + user.balance, 0) +
    persisted.reduce((sum, item) => sum + item.market.pot, 0);
  const granted = users.reduce((sum, user) => sum + user.startingBalance, 0);
  console.log(
    `Seeded ${persisted.length} markets, ${trades.length} trades, ${commentRows.length} comments. Wealth ${wealth.toFixed(2)} vs granted ${granted.toFixed(2)}.`,
  );
  if (Math.abs(wealth - granted) > 1) {
    throw new Error(`Seed leaked money: wealth ${wealth} granted ${granted}`);
  }

  await prisma.user.update({ where: { id: "usr_elena" }, data: { balance: { decrement: 40 } } });
  await prisma.user.update({ where: { id: "usr_marcus" }, data: { balance: { decrement: 55 } } });
  await prisma.user.update({ where: { id: "usr_jonas" }, data: { balance: { decrement: 30 } } });
  await prisma.limitOrder.createMany({
    data: [
      {
        id: "ord_fed_yes_48",
        userId: "usr_elena",
        marketId: "mkt_fed-cuts-june-2027",
        outcome: "YES",
        limitProb: 0.48,
        amount: 40,
        remaining: 40,
        status: "OPEN",
      },
      {
        id: "ord_fed_yes_41",
        userId: "usr_marcus",
        marketId: "mkt_fed-cuts-june-2027",
        outcome: "YES",
        limitProb: 0.41,
        amount: 25,
        remaining: 25,
        status: "OPEN",
      },
      {
        id: "ord_fed_yes_41b",
        userId: "usr_marcus",
        marketId: "mkt_fed-cuts-june-2027",
        outcome: "YES",
        limitProb: 0.41,
        amount: 30,
        remaining: 30,
        status: "OPEN",
      },
      {
        id: "ord_fed_no_46",
        userId: "usr_jonas",
        marketId: "mkt_fed-cuts-june-2027",
        outcome: "NO",
        limitProb: 0.28,
        amount: 30,
        remaining: 30,
        status: "OPEN",
      },
    ],
  });
}
