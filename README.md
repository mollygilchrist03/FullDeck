# Full Deck

A small collection of classic card games built from scratch — the point isn't
displaying card data, it's implementing the actual games: shuffling, dealing,
hand scoring, dealer AI, win conditions, and the discrete state transitions each
game runs on. Five games — Blackjack, Memory Match, War, High-Low, and Video
Poker — share one foundation, and the interesting logic is factored into isolated
pure functions with their own unit tests rather than tangled into components.

**Live demo:** [full-deck-five.vercel.app](https://full-deck-five.vercel.app)

![Game hub — the five games on the felt table](docs/screenshots/hub.png)

![Blackjack — a hand in progress with the dealer's hole card face-down and the chip stack](docs/screenshots/blackjack.png)

![Video Poker — five cards dealt, two held, the Jacks-or-Better paytable below](docs/screenshots/video-poker.png)

## What it does

**Blackjack.** Place a bet from a chip stack, get dealt two cards against a
dealer showing one, then hit or stand. Aces score as 1 or 11 dynamically, the
dealer plays itself out by the book, and the hand settles to
win / loss / push / blackjack with the payout applied to your stack (3:2 on a
natural). Run out of chips and you can reset.

**Memory Match.** A grid of face-down cards — 4×4 or 6×6 — flipped two at a time.
Matches stay up with a brief pulse; a mismatch locks the board for a beat so you
can't click a third card mid-comparison, then flips back. Move counter and timer
run throughout, and clearing every pair shows a completion screen with your
moves and time.

**War.** The deck is split 26/26 and you flip a card each per battle — higher
rank takes the pair, ties stake both cards and play continues until someone wins
the pot. Won cards are shuffled back in (so games actually end), and the match is
over when a player holds all 52 or can't produce a card.

**High-Low.** One card face-up; call whether the next is higher or lower and
build a streak. Aces are high, equal ranks are a push. Best streak for the
session is tracked.

**Video Poker (Jacks or Better).** Bet 1–5 credits, get five cards, hold any of
them, and draw replacements for the rest. The resulting five-card poker hand is
evaluated and paid on a 9/6 schedule — right down to the max-bet royal-flush
bonus.

Every game draws a real, server-shuffled deck from the free, keyless
[Deck of Cards API](https://deckofcardsapi.com/) rather than simulating a deck
in memory, and render card fronts straight from the API's image URLs (the
[vector-playing-cards](https://code.google.com/archive/p/vector-playing-cards/)
set it serves), with a CSS-drawn fallback if an image fails to load.

## Notable engineering decisions

The parts worth reading are the pure functions — each is isolated, unit-tested,
and free of any React or network concerns.

- **Ace-aware hand scoring** ([`src/games/blackjack/handScoring.ts`](src/games/blackjack/handScoring.ts)).
  Every ace starts at 11; while the total is over 21 *and* an ace is still
  counted high, one ace is demoted to 1 and the check repeats. Whatever aces
  remain high make the hand *soft*, which the UI uses to show dual totals
  (`7 / 17`). This is the classic tricky bit of Blackjack, so it lives on its
  own with tests for multi-ace hands, forced demotion, and 3-card-21 ≠ natural.

- **Dealer AI as a pure, injectable function**
  ([`src/games/blackjack/dealerAI.ts`](src/games/blackjack/dealerAI.ts)).
  `dealerShouldHit(hand)` is a pure function of the hand — hit under 17, stand on
  17+ including soft 17 (an S17 table). `playDealerHand(hand, drawOne)` runs the
  whole turn, taking cards from an injected `drawOne` callback, so the rule is
  testable with a stubbed deck and the React layer supplies a `drawOne` that
  pulls from the live API with a delay between cards for feel.

- **The match-lock state machine**
  ([`src/games/memory/memoryReducer.ts`](src/games/memory/memoryReducer.ts)).
  On a mismatch the reducer sets `lock: true` and leaves both cards showing;
  `FLIP` is a no-op while locked, so a third click during the "look at it" beat
  is ignored. A timed `RESOLVE` action clears the pair. Small detail, but it's
  the kind of state-management bug that's obvious once it bites.

- **A reusable poker-hand evaluator**
  ([`src/games/videopoker/pokerHand.ts`](src/games/videopoker/pokerHand.ts)).
  `evaluateHand(cards)` reduces five cards to a category with an ordered set of
  checks — flush and straight flags plus rank-multiplicity shape — handling both
  the ace-high straight and the A-2-3-4-5 wheel, and distinguishing a low pair
  from a paying pair of jacks. The paytable
  ([`paytable.ts`](src/games/videopoker/paytable.ts)) is a separate lookup so
  the scoring and the economics stay independent.

- **War is made to terminate.** Classic War with fixed card ordering can loop
  forever; the pot is shuffled before it folds into the winner's pile
  ([`src/games/war/warReducer.ts`](src/games/war/warReducer.ts)), and ties stake
  into a shared pile rather than the three-face-down ritual — smaller state,
  guaranteed end.

- **Reducers stay pure; the container owns the network.** Both games are
  `useReducer` state machines (`DEAL`, `HIT`, `STAND`, `FLIP`, `RESOLVE`, …).
  Every API call happens in the container and drawn cards are passed *into*
  actions as payloads, so no reducer ever awaits anything and all of them are
  directly unit-testable — see the reducer tests alongside each file.

- **`useDeck`** ([`src/hooks/useDeck.ts`](src/hooks/useDeck.ts)) caches the deck
  id for the session, auto-reshuffles when the deck runs low (repeated Blackjack
  hands eventually dry a single deck), and exposes stable method identities so
  effects that depend on it don't re-fire on every render.

- **The dealer-turn effect is hardened against React 19 StrictMode.** Its async
  loop tracks both `cancelled` and `completed`; an aborted run (the double-invoke
  in dev) resets its guard so the turn restarts instead of hanging half-drawn.

- **Card flip is transform-only.** A `preserve-3d` wrapper with two
  `backface-hidden` faces and a `rotateY(180deg)` toggle — no layout shift, so it
  stays smooth on mobile.

- **81 unit tests** ([Vitest](https://vitest.dev/)) over scoring, dealer AI,
  outcome settlement, board building, card comparison, high-low judging, poker
  evaluation, payouts, and every reducer transition. They need no network and no
  DOM.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | React 19 + TypeScript (strict) |
| Build | Vite |
| Styling | Tailwind CSS v4 (palette defined in `@theme`) |
| Routing | React Router — `/`, `/blackjack`, `/memory`, `/war`, `/high-low`, `/video-poker` |
| State | `useReducer` per game; `useDeck` custom hook for the shared deck |
| Tests | Vitest (pure-logic unit tests) |
| Data | Deck of Cards API (free, no key) |
| Hosting | Vercel (static SPA) |

## Local setup

```bash
npm install      # .npmrc pins legacy-peer-deps — npm 11 crashes on vitest's optional-peer graph
npm run dev      # http://localhost:5173
npm test         # game-logic unit tests (offline)
npm run build    # tsc typecheck + production build
npm run lint
```

## Deployment

App → Vercel, framework preset **Vite**. [`vercel.json`](vercel.json) rewrites
every path to `index.html` so the client router handles the game routes on a
hard refresh. The repo is connected to Vercel, so a push to `master` is a
production deploy. No environment variables — the card API is keyless.

## What's next

Things worth adding if this grew past a portfolio piece:

- More games on the same `useDeck` foundation — Go Fish and heads-up Texas
  Hold'em (the poker evaluator already does most of the work) are the obvious
  next ones.
- Persisted best scores and bankrolls — `localStorage` first, a backend only if
  it ever needs to be shared.
- Component/interaction tests — the logic is covered, but the assembled UI
  currently leans on `tsc`, `vite build`, and manual play.
- Sound and haptics on deal / flip / win.
