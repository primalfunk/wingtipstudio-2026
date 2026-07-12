# Replay And Review Notes

## Purpose

The replay/review layer sits on top of saved study memory from `studyStore.ts`.
It is meant to show the user what happened at a prior decision point, not to
re-solve the hand.

## Data Flow

- Saved live hands come from `SavedHandHistory`.
- Saved hero decisions come from `SavedDecisionRecord`.
- Saved drill attempts come from `SavedDrillAttempt`.
- `src/history/review.ts` prepares review-friendly payloads for the UI.

For live hands, the review helper pairs hero decision events with saved decision
records by `handId` and hero-decision order. That lets replay use the explicit
saved coaching snapshot when it exists.

## Replay Step Model

- Hand replay uses the existing event stream from `SavedHandHistory.events`.
- Navigation is still step-based:
  - first
  - previous street
  - previous step
  - next step
  - next street
  - last
- The current step can surface a focused hero decision review block when the
  current event is a hero action.

## Hand Review vs Drill Review

- Hand review is timeline-based and step-through.
- Drill review is a single saved attempt plus static scenario context loaded from
  the scenario library.

Drill review does not reconstruct a full engine replay. It shows:

- scenario id and spot key
- board / hero hand / stack context when available
- prior scenario action line
- saved coach verdict and explanation

## Saved Context Preference

The review UI prefers saved context over recomputation:

- saved `spotKey`
- saved coach recommendation text
- saved evaluation label
- saved explanation snapshot
- saved inferred range summary

If older hand records only contain the lighter hand-event snapshot, the review
view falls back to that instead of failing.

## Limitations

- Decision-to-event pairing is sequential within a hand, not a richer event id.
- Review is intentionally lightweight and browser-local.
- This does not add concept analytics, solver review, or cloud history.
