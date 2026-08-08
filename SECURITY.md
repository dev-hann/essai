# Reporting a vulnerability

If you believe you have found a security issue in essai, please report
it privately rather than opening a public issue.

**Preferred:** open a [GitHub Security Advisory](https://github.com/dev-hann/essai/security/advisories/new)
using the "Report a vulnerability" flow.

**Alternative:** email `developer.hann@gmail.com` with `[essai security]`
in the subject line.

Please include:

- A minimal reproduction (commands, project config with `apiKey` redacted).
- Affected versions (`essai --version`).
- What you expected vs. what happened.
- Any impact you can characterize.

## Scope

essai is a local-first writing tool. The realistic security surface is
small:

- API keys live in `essai.json` and `~/.essai/config.json` in plaintext.
  This is by design (matches the documented workflow) — treat both
  files as secrets.
- The web UI binds to `localhost` only and ships without auth.
- The CLI shells out to `$EDITOR` for `bible edit`; that's the user's
  own environment.

Issues that fit the model above ("AI wrote a bad chapter") are **not**
security issues — open a normal bug report.

## Disclosure

I'll acknowledge within 72 hours and aim for a fix within 30 days for
confirmed issues. Coordinated disclosure happens once a patched release
lands on npm.
