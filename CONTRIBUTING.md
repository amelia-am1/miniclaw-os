# Contributing to MiniClaw

Thanks for your interest in MiniClaw. Here's how to get involved.

## Ways to contribute

- **Report bugs** — [open an issue](https://github.com/augmentedmike/miniclaw-os/issues/new?template=bug_report.md)
- **Request features** — [open a feature request](https://github.com/augmentedmike/miniclaw-os/issues/new?template=feature_request.md)
- **Propose a plugin** — [submit a plugin idea](https://github.com/augmentedmike/miniclaw-os/issues/new?template=plugin_idea.md)
- **Fix a bug or add a feature** — fork, branch, PR
- **Improve docs** — wiki, README, plugin docs
- **Join the discussion** — [GitHub Discussions](https://github.com/augmentedmike/miniclaw-os/discussions)

## Development setup

```bash
git clone https://github.com/augmentedmike/miniclaw-os.git
cd miniclaw-os
```

The pre-commit hook (`scripts/security-check.sh`) runs automatically on every commit. It scans for hardcoded secrets, API keys, and PII. Do not bypass it.

## Pull request process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `./scripts/security-check.sh --all` to verify no secrets
4. Open a PR using the template
5. Wait for review

## Writing plugins

See the [Writing Plugins](https://github.com/augmentedmike/miniclaw-os/wiki/Writing-Plugins) wiki page for the full guide.

Quick version:

```
plugins/mc-my-plugin/
├── openclaw.plugin.json
├── package.json
├── index.ts
├── tools/
└── cli/
```

## Security

Never commit secrets, API keys, tokens, or personal information. The pre-commit hook will block it, but please be careful. If you find a security issue, please email security concerns to the maintainer rather than opening a public issue.

## Code style

- TypeScript for plugins
- Keep it simple — no over-engineering
- One plugin, one job
- Test your changes

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
