import { Link } from 'react-router-dom'
import { Layout } from '../../components/Layout'

interface GameCardProps {
  to: string
  title: string
  blurb: string
  glyph: string
}

function GameCard({ to, title, blurb, glyph }: GameCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-2xl border border-gold/40 bg-felt p-6 shadow-xl shadow-black/30 transition-transform hover:-translate-y-1 hover:border-gold"
    >
      <span className="text-4xl text-gold transition-transform group-hover:scale-110">{glyph}</span>
      <h2 className="font-display text-2xl font-bold text-card">{title}</h2>
      <p className="text-sm text-card/75">{blurb}</p>
      <span className="mt-2 text-sm font-semibold text-casino">Play →</span>
    </Link>
  )
}

export function Hub() {
  return (
    <Layout>
      <section className="mx-auto max-w-2xl text-center">
        <p className="mb-2 text-sm uppercase tracking-[0.3em] text-gold/80">Take a seat</p>
        <h1 className="font-display text-4xl font-bold text-card sm:text-5xl">Full Deck</h1>
        <p className="mx-auto mt-3 max-w-md text-card/75">
          A handful of classic card games, built from scratch — real shuffling, dealing, and
          game logic, with cards drawn live from the Deck of Cards API.
        </p>
      </section>

      <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <GameCard
          to="/blackjack"
          title="Blackjack"
          blurb="Beat the dealer to 21. Betting, hit/stand, dynamic ace scoring, and a dealer that plays by the book."
          glyph="♠"
        />
        <GameCard
          to="/memory"
          title="Memory Match"
          blurb="Flip and match every pair in as few moves as you can. Pick your grid size and race the clock."
          glyph="♥"
        />
        <GameCard
          to="/war"
          title="War"
          blurb="Split the deck and flip. High card takes the pair, ties mean war. First to hold all 52 wins."
          glyph="♦"
        />
        <GameCard
          to="/high-low"
          title="High-Low"
          blurb="One card up. Guess whether the next is higher or lower and build the longest streak you can."
          glyph="♣"
        />
        <GameCard
          to="/video-poker"
          title="Video Poker"
          blurb="Jacks or Better. Deal five, hold what you want, draw the rest, and get paid on the poker hand."
          glyph="♠"
        />
        <GameCard
          to="/crazy-eights"
          title="Crazy Eights"
          blurb="Shed your hand first. Match the suit or rank, eights are wild — against an opponent that plays its own game."
          glyph="♥"
        />
      </div>

      <div className="mx-auto mt-8 max-w-2xl text-center">
        <Link
          to="/leaderboard"
          className="inline-flex items-center gap-2 rounded-full border border-gold/50 bg-black/20 px-5 py-2.5 text-sm font-semibold text-gold hover:border-gold hover:bg-white/5"
        >
          🏆 Leaderboard
        </Link>
      </div>
    </Layout>
  )
}
