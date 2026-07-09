# Chaos Club Online Mode

The current prototype has a tiny Python backend. It serves the app and stores shared group state in `chaos_data.json`, so people using the same public tunnel URL can play the same round.

For a production app, invite links still need two stronger pieces:

1. A public hosted URL, such as Vercel, Netlify, Cloudflare Pages, or an App Store build.
2. Durable shared backend storage so every device reads and writes the same group, answers, votes, and reveal state.

Recommended first backend:

- Supabase or Firebase
- Anonymous or magic-link player sessions
- Tables/collections for groups, players, rounds, answers, votes, and recaps
- Realtime updates for waiting states and reveal

Minimum data model:

- `groups`: code, name, created_at
- `players`: group_code, display_name, joined_at
- `rounds`: group_code, challenge_id, status, created_at
- `answers`: round_id, player_id, text, created_at
- `votes`: round_id, voter_id, answer_id, created_at
- `recaps`: round_id, text, created_at

The local backend is good enough for testing with friends through a temporary tunnel. It is not durable hosting.
