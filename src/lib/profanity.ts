import {
  DataSet,
  englishDataset,
  englishRecommendedTransformers,
  parseRawPattern,
  RegExpMatcher,
  skipNonAlphabeticTransformer,
} from 'obscenity'

/**
 * Extra terms to reject on top of obscenity's English dataset — slurs and
 * compound profanity a leaderboard name should never carry. Only unambiguous
 * words go here (no bare "ass"/"cunt"/"spic" — obscenity's own entries cover
 * those *with* a whitelist for "assassin", "Scunthorpe", etc.). Extend from
 * https://github.com/censor-text/profanity-list for broader coverage.
 */
const EXTRA_TERMS = [
  'wank',
  'twat',
  'bollocks',
  'arsehole',
  'jackass',
  'dumbass',
  'goddamn',
  'motherfucker',
  'cocksucker',
  'bullshit',
  'horseshit',
  'shithead',
  'dickhead',
  'douchebag',
  'jerkoff',
  'kike',
  'chink',
  'gook',
  'wetback',
  'nigger',
  'nigga',
  'faggot',
  'tranny',
  'retard',
]

const dataset = new DataSet<{ originalWord: string }>().addAll(englishDataset)
for (const word of EXTRA_TERMS) {
  dataset.addPhrase((phrase) =>
    phrase.setMetadata({ originalWord: word }).addPattern(parseRawPattern(word)),
  )
}

// Also strip separators so "f u c k" / "f-u-c-k" are caught. Added to both the
// blacklist and whitelist sides so the whitelist ("classic", "assassin") still
// lines up with what the blacklist sees.
const skip = skipNonAlphabeticTransformer()
const matcher = new RegExpMatcher({
  ...dataset.build(),
  blacklistMatcherTransformers: [
    ...(englishRecommendedTransformers.blacklistMatcherTransformers ?? []),
    skip,
  ],
  whitelistMatcherTransformers: [
    ...(englishRecommendedTransformers.whitelistMatcherTransformers ?? []),
    skip,
  ],
})

/** True when the name contains no profanity or slurs. Empty string counts as clean. */
export function isCleanName(name: string): boolean {
  if (!name) return true
  return !matcher.hasMatch(name)
}
