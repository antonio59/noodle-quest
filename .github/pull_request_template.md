## Summary

- What changed and why?

## Testing

- [ ] `pnpm run lint`
- [ ] `pnpm run typecheck`
- [ ] `pnpm test`
- [ ] `pnpm run build`

## Release checklist

- [ ] User-facing change? Bump `version` in `package.json` (new feature: minor; fix only: patch).
- [ ] Added a `## [x.y.z] - YYYY-MM-DD` section to `CHANGELOG.md` and updated `RELEASE_NOTES.md` (`## x.y — <date>`).
- [ ] Updated `README.md` / docs if what users see has changed.
- [ ] Not user-facing (CI, tests, refactor only), so no version bump needed.
