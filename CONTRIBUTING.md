# Contributing

Thanks for helping. Requirements: Node 18+ (`.nvmrc` pins 20).

```sh
npm install
npm run typecheck
npm test -- --coverage   # 100% lines, branches, functions and statements are enforced
npm run build
```

- Keep the package free of runtime dependencies.
- Every change needs tests; coverage thresholds fail the run below 100%.
- Mock `fetch` in tests (see `test/helpers.ts`); never call the real API.
- Update `CHANGELOG.md` and keep `src/version.ts` equal to `package.json`.
- Open a pull request against `main` with a short description of the change.
