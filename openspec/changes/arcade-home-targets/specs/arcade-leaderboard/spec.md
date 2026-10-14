# Arcade leaderboard

## Purpose
`/api/arcade-leaderboard` reads a fixed PostHog aggregate for the All Games board.

## Requirements

### Requirement: Serve the last good aggregate
When the PostHog query fails or exceeds 8 seconds, and this process has stored a good aggregate, the route SHALL respond 200 with that aggregate and `stale: true`. It SHALL respond 503 only when no good aggregate has been stored. The HogQL query SHALL stay the same.

#### Scenario: PostHog fails after a good read
- **WHEN** a good aggregate is in memory, the five minute window has passed, and the next PostHog call fails
- **THEN** the response is 200, `stale` is true, and the game counts match the last good read

#### Scenario: No good read yet
- **WHEN** this process has never stored a good aggregate and PostHog fails or the read key is missing
- **THEN** the response is 503 and the body does not include the read key

### Requirement: Edge cache while refreshing
A response that carries counts SHALL send `Cache-Control` with `s-maxage` and `stale-while-revalidate`, so the edge can keep serving the aggregate while it refreshes. A 503 SHALL stay `no-store`.

#### Scenario: A fresh count response
- **WHEN** PostHog returns a valid aggregate
- **THEN** the response is 200 without `stale: true`, and `Cache-Control` includes `s-maxage` and `stale-while-revalidate`
