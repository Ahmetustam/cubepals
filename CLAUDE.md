<!-- The rules live in AGENTS.md, which every agent and person reads; Claude Code reads it through this import. The section below is the full form of one of them. -->
@AGENTS.md

## Business internals stay private

The repository is public, and so are its commits, pull requests and issues. Business internals never go in any of them:

- fraud and abuse weights, thresholds and signal tuning;
- costs, margins, and what a plan earns;
- competitors;
- pricing history, and why a price is what it is;
- strategy and vendor trials.

They live in the private records repository or in private configuration. Code keeps the mechanism and reads such numbers from private configuration, an env var or a Fly secret (`FREE_LINK_TUNING`, `ABUSE_LIMITS`), with a harmless default for development and tests. Public prices are what the pricing page shows.
