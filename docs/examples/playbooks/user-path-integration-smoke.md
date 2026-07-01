---
id: user-path-integration-smoke
triggers:
  - ship release
  - publish
  - release smoke
  - user path test
  - integration smoke
  - before release
connections: []
---

# User path integration smoke

**Use before any release** where users install, run setup, or depend on CLI output consumed by another app (IDE footer, hooks, CI).

Prevents shipping **half-features**: code exists, docs claim it works, but the install → configure → run path was never exercised.

## The failure mode

Teams test **units** and **dev workflows** but skip **fresh-user simulation**:

| Layer | Often tested | Often skipped |
|-------|--------------|---------------|
| Library / API | ✓ | |
| Command exists | ✓ | |
| Installer / setup writes config | | ✗ |
| Files on disk after install | | ✗ |
| Output shape host app expects | | ✗ |
| Published artifact = git tag | | ✗ |

**Symptom:** Changelog says shipped; users run one command; nothing appears; docs say “paste this JSON manually.”

## Invariant chain

For every **user-visible surface**, verify the full chain:

```
Release note claim  →  artifact contains code  →  installer wires it  →  files on disk  →  runtime output contract
```

If any link is missing, the feature is **not shipped** — move the bullet to “pending” or “manual only.”

## Surface checklist (copy per feature)

| # | Question | Red flag |
|---|----------|----------|
| 1 | What is the **one command** a new user runs? | Multiple doc-only steps |
| 2 | What **files** must exist after that command? | “Create this file yourself” |
| 3 | What **config keys** are written? | Whole-file replace instead of merge |
| 4 | What **stdout/stderr** does the host read? | Wrapper prints warnings before real output |
| 5 | Does it work in **prod-like** env, not only dev? | Different ports, paths, or data dirs in dev |
| 6 | Is the release note **honest**? | Listed as shipped before integration test passes |
| 7 | Does the **published package** include the module? | Source in repo but not in tarball |

## Fresh-user simulation (15 min)

1. **Clean environment** — temp `HOME`, empty config dir, or disposable VM/container.
2. **Install like a user** — package manager, `npm pack` + install, or published version — not monorepo `src/` directly.
3. **Run the documented command** — usually `setup`, `init`, or `install --client`.
4. **Inventory artifacts** — `test -f` every path your docs mention.
5. **Exercise the host contract** — pipe stdin, call hook, or open IDE the way the real host does.
6. **Assert output** — line count, prefix, no tool-manager noise on stdout, no ANSI unless documented.

## Output contracts (hooks & status lines)

When another program parses your CLI stdout:

- **One line** unless documented otherwise
- **No** package-manager warnings on stdout (redirect stderr; set `NO_COLOR`)
- **Stable prefix** or format documented for the host
- Test with: `your-command … | wc -l` and `… 2>/dev/null`

## Automate the gate

Add a script (e.g. `release:smoke`) that CI and `prepare-release` run **before publish**:

1. Pack / build release artifact
2. Assert required files in the artifact
3. Run setup in clean `HOME`
4. Assert artifacts + stdout contract

**Publish fails** if the script fails.

## Anti-patterns

1. Ship the **command**, skip the **installer**
2. Test only in **monorepo dev** (masks paths, ports, env)
3. **Doc-only** integration (manual JSON) when setup should automate
4. **CHANGELOG as wishlist**
5. **Replace** user config files instead of merging
6. Assume **dev data** is visible to **prod** runtime

## When done

- Release notes list only what passed integration smoke
- Pending items live under a separate heading
- New surfaces add a checklist row + script assertion
