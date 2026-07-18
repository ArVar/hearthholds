# Contributing

Hearthholds is in an early Friends & Family alpha. Small, focused bug fixes and
well-described feedback are especially useful.

## Local development

Use Node.js 22 (or another version allowed by `package.json`) and npm:

```bash
npm install
npm run dev
```

Before opening a pull request, run:

```bash
npm run typecheck
npm test
npm run test:e2e
```

Keep changes focused, add tests for changed behavior, and update documentation
when the user-facing workflow changes. Pull requests should explain both the
problem and the chosen behavior.

## Data, artwork, and licenses

Never commit real campaign data, private settlement exports, secrets, or local
reference material. Only add artwork when its origin and redistribution rights
are known and the applicable license is documented. See
[LICENSING.md](LICENSING.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

By contributing, you agree that your contribution may be distributed under the
license that applies to its repository area.
