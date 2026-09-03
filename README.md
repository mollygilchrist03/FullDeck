# Full Deck

A small collection of classic card games built from scratch — not a card-data viewer, but
real game logic: shuffling, dealing, hand scoring, dealer AI, and match-lock state
machines. Two games share one foundation:

- **Blackjack** — betting, hit/stand, dynamic ace scoring, a by-the-book dealer, and
  win / loss / push / blackjack detection.
- **Memory Match** — flip-state tracking, pair matching with a mismatch lock, a move
  counter and timer, and a completion screen.

Cards are drawn live from the free, keyless [Deck of Cards API](https://deckofcardsapi.com/)
(images come from the [vector-playing-cards](https://code.google.com/archive/p/vector-playing-cards/)
set it serves) — the deck is genuinely shuffled server-side rather than simulated in memory.

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · React Router · Vitest.
Deployed as a static SPA on Vercel.

## Running locally

```bash
npm install      # .npmrc pins legacy-peer-deps for npm 11
npm run dev      # http://localhost:5173
npm test         # game-logic unit tests (no network needed)
npm run build    # tsc typecheck + production build
```

## Project layout

```
src/
  api/deckClient.ts      typed wrappers over the Deck of Cards API
  hooks/useDeck.ts        deck lifecycle: new / draw / reshuffle, cached deck id
  components/Card.tsx     CSS 3D flip (transform-only), API image + CSS fallback
  games/
    hub/                  landing screen
    blackjack/
      handScoring.ts      pure — ace-aware hand scoring
      dealerAI.ts         pure — dealer hit/stand rule + turn playout
      outcome.ts          pure — settle a finished hand
      blackjackReducer.ts useReducer state machine (betting → player → dealer → settled)
    memory/
      memoryLogic.ts      pure — board building, match check, win check
      memoryReducer.ts    useReducer state machine with the mismatch lock
```

## Game-logic notes

These are the parts worth reading — each is an isolated pure function with its own tests.

### Ace scoring (`handScoring.ts`)

Every ace starts at 11. After summing the hand, while the total is over 21 **and** an ace
is still counted high, one ace is demoted from 11 to 1 (subtract 10) and the check repeats.
Whatever aces remain high at the end make the hand *soft*.

- `A + K` → 21 (soft) — a natural blackjack
- `A + A` → 12 (soft): one ace high, one low
- `A + A + 9` → 21 (soft)
- `A + 6 + 10` → 17 (hard): the ace was forced down to keep the hand alive

`scoreHand` returns `{ total, soft }`; the UI uses `soft` to show `7/17` style dual totals.

### Dealer AI (`dealerAI.ts`)

`dealerShouldHit(hand)` is a pure function of the hand: draw while the total is under 17,
otherwise stand — including on a soft 17 (this is an **S17** table). `playDealerHand(hand,
drawOne)` runs the whole turn, taking its cards from an injected `drawOne` callback so the
rule is testable without a deck or any UI. The React container supplies a `drawOne` that
pulls from the live deck with a short delay between cards for feel.

### Match-lock (`memoryReducer.ts`)

When two flipped cards don't match, the reducer sets `lock: true` and leaves both cards
face-up. `FLIP` is a no-op while locked, so a third click during the "look at the mismatch"
beat is ignored. A timed `RESOLVE` action clears the pair and the lock. Matches resolve
immediately and set `justMatched` for a brief gold-ring pulse. Win is `matched.length ===
tiles.length`.

Both games keep all discrete transitions (`DEAL`, `HIT`, `STAND`, `FLIP`, `RESOLVE`, …) in
a `useReducer`; all network calls live in the container and pass drawn cards in as action
payloads, so every reducer is pure and unit-tested.

## Deploy

Vercel, framework preset **Vite**. `vercel.json` rewrites all paths to `index.html` so the
client router handles `/blackjack` and `/memory` on refresh.
