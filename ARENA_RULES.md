# ARENA AI — PROJECT DEVELOPMENT RULES

You are responsible for developing this repository into a complete 3D factory automation game.

## 1. Mandatory documentation

Before performing any development task, read and respect the following files:

- `docs/GDD.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/DEVELOPMENT_ROADMAP.md`
- `PROJECT_STATUS.md`

These documents are the project's source of truth.

Do not contradict their requirements without identifying the reason and documenting the proposed change.

## 2. Step-by-step development

Development must strictly follow the roadmap.

- Work on one development phase at a time.
- Do not implement future phases prematurely.
- Do not skip unfinished requirements.
- Do not consider a phase complete based only on visual appearance.
- Validate all acceptance criteria before declaring a phase complete.

## 3. Repository inspection

Before modifying code:

1. Inspect the current repository.
2. Read the relevant documentation.
3. Understand the existing architecture.
4. Identify the current development phase.
5. Inspect existing implementations.
6. Identify potential regressions.
7. Prepare an implementation plan.

Never assume that a feature does not exist without checking.

## 4. Code modification rules

- Preserve existing working functionality.
- Avoid unnecessary rewrites.
- Avoid duplicated systems.
- Keep modules independent.
- Use TypeScript consistently.
- Respect existing naming conventions.
- Keep gameplay logic separate from rendering.
- Prefer data-driven systems.
- Avoid unnecessary dependencies.

## 5. Testing

Every implemented feature must be tested.

Use automated tests whenever possible.

Never claim that a feature works without validating it.

Never claim that tests passed if they were not executed.

Fix regressions before continuing.

## 6. Documentation maintenance

Documentation must remain synchronized with the actual implementation.

After completing a task:

- Update `PROJECT_STATUS.md`.
- Update `DEVELOPMENT_ROADMAP.md` if progress or scope changed.
- Update `TECHNICAL_ARCHITECTURE.md` when architectural decisions change.
- Update `CHANGELOG.md` with significant modifications.

Never mark planned functionality as implemented when it is not.

## 7. Scope control

Do not attempt to implement multiple major development phases in a single task.

If a phase is too large, divide it into smaller independently testable tasks.

Do not start the next phase automatically unless explicitly requested.

## 8. Final report

At the end of each task, provide:

- What was implemented.
- Files created or modified.
- Tests executed and their actual results.
- Known limitations.
- Remaining tasks.
- Updated project status.

The repository must always remain in a functional and understandable state.

## 9. Priority

Priority order:

1. Correct functionality.
2. Architectural consistency.
3. Stability.
4. Performance.
5. Visual quality.
6. Additional polish.

Never sacrifice the foundations of the game for a quick visual result.

## 10. Automatic Pull Request Merging

For every pull request created for development work, the agent owns its entire
lifecycle and must not leave completed work open for the user to merge manually.
Before merging, ensure implementation is complete, run required verification,
confirm all relevant automated tests and CI checks succeed, resolve conflicts,
and review the final changes for accidental modifications and regressions.
Investigate and fix failed checks; never bypass failing CI, branch protections or
unresolved conflicts. Once these requirements are met, merge without asking for
confirmation, preferring squash when supported and appropriate. Do not merge
unrelated pull requests or changes the agent did not create. If GitHub prevents
merging, report the precise blocker and leave the repository safe. After merging,
verify that the target branch contains the expected commit and verify the GitHub
Pages deployment workflow when applicable. This policy applies to future tasks,
not just Phase 3.
