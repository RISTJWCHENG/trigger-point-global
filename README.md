# TriggerPointGlobal

Play-money prediction markets. The desk follows the browse, trade, and resolve flow of a modern prediction market, with a constant-product market maker and a low-saturation stone, sage, and terracotta palette.

New accounts start with **1,000 TP**. TP has no cash value.

## Stack

- Next.js (App Router) and React
- TypeScript
- Tailwind CSS
- Prisma with SQLite (the schema is also valid for Postgres if you swap the datasource)

## Run it

```bash
npm install
npm run dev
```

`npm run dev` creates the SQLite database, seeds it if it is empty, and starts the app at [http://localhost:3000](http://localhost:3000). The browse feed is at [http://localhost:3000/?fy=0](http://localhost:3000/?fy=0).

Open **Continue as demo** on the sign-in page to trade immediately. The demo password is `demo` if you would rather type it. Other seeded desks use the username as the password (`elena`, `marcus`, `priya`, …).

### Other commands

```bash
npm test          # CPMM math, ledger conservation, and database trades
npm run typecheck
npm run lint
npm run build
npm start         # production; seeds first if the database is empty
npm run seed      # idempotent: does nothing if markets already exist
```

To reseed from scratch, stop the app, delete `prisma/dev.db`, and run `npm run seed`.

## What’s included

- Market feed with search, topics, sort, and binary / multiple-choice filters
- Inline quick bets and a sticky trade ticket (a bottom sheet on small screens)
- CPMM-1 binary pools and a fixed-product multiple-choice pool, including sells
- Probability history with 1D / 1W / 1M / ALL
- Comments with replies, an activity log, holders, and resolution criteria
- Create a market, then resolve it YES, NO, at a percentage, to an answer, or N/A
- Portfolio, public profiles, leaderboard, and notifications
- Twenty seeded markets with historical trades so the charts are already alive
- Binary limit orders with a public order book, free polls, liquidity subsidies, comment likes, a once-a-day 50 TP bonus, 24-hour movers, a portfolio net-worth chart, and three themes: Atelier, Stone, and Charcoal

The trading rules live in `src/lib/cpmm.ts` and `src/lib/ledger.ts`. Buys, sells, percentage resolutions, and cancellations conserve the supply of TP.
