# Repository Guidelines

## Project Structure & Module Organization

This repository is a Python package using the `src/` layout. Application code
lives in `src/docdeploy/`; keep reusable functionality in focused modules under
that package and expose the command-line entry point through `docdeploy:main`.
`pyproject.toml` owns Python packaging and runtime metadata. `package.json` and
`tsconfig.json` are a TypeScript/Node scaffold; put future TypeScript in `web/`
or `tools/`, not the Python package. Add worker Python tests under `worker/tests/`
and package tests under `tests/`, mirroring their respective source paths.

## Build, Test, and Development Commands

- `uv run docdeploy` runs the installed Python console script locally.
- `uv run python -m docdeploy` is suitable once `src/docdeploy/__main__.py` is
  added.
- `uv build` creates distributable Python artifacts in `dist/`.
- `npm run verify` runs the complete local quality gate and test suite.
- `npx tsc --noEmit` type-checks future TypeScript without writing output.

Use Python 3.14 or later, as required by `pyproject.toml`, and keep the local
virtual environment in `.venv/` (already ignored by Git).

## Coding Style & Naming Conventions

Use four spaces for Python indentation, type annotations for public functions,
and `snake_case` for modules, functions, and variables. Use `PascalCase` for
classes and concise, imperative names for CLI functions (for example,
`deploy_document`). Keep `main()` lightweight and delegate work to testable modules.
For TypeScript, retain the strict compiler settings. Add formatter and linter
configuration before relying on automated style checks.

## Testing Guidelines

Use `pytest` for Python changes and name tests `test_<behavior>.py`, such as
`test_deploy_rejects_missing_file`.
Test command-line behavior, errors, and filesystem effects with temporary directories.
Update this guide and project commands when a runner is introduced.

Use `.agents/skills/test-driven-development` before implementing features, bug
fixes, refactors, or behavior changes. Follow red-green-refactor: write one
failing behavior test first, verify the expected failure, implement the minimal
change, then run the relevant test and the complete `npm run verify` gate.
Prefer tests at public interfaces and system boundaries, derive expected values
independently, and mock only slow or external dependencies when unavoidable.

### Required Regression Checklist for Every Future Change

- For every feature, bug fix, or behavior change, add or update automated tests
  covering the new behavior, relevant failure cases, and affected existing flows.
- Before changing production behavior, run the new test and confirm that it
  fails for the intended reason; then implement and verify the minimal fix.
- For coverage of existing behavior, add regression tests at public boundaries;
  identify the concrete regression each test would catch. Do not rewrite working
  production code merely to force a red test.
- Keep new tests discoverable by the existing runners: API tests in `api/test/`,
  frontend tests in `web/src/test/`, and worker tests in `worker/tests/`.
  Wire any new test suite into the root `npm run verify` command.
- Run affected tests during development and the complete `npm run verify` gate
  after the final code or configuration edit, including test-only changes and
  refactors. The required `code_quality` subagent must also perform its review
  and final verification as specified below.
- Never skip, delete, or weaken a valid regression assertion just to make the
  gate pass. Report failed or unavailable checks explicitly; do not claim a
  successful verification when the gate did not finish with exit code zero.
- In the completion report, state the behavior protected by the tests and the
  verification result. Documentation-only edits do not require artificial tests.

## Mandatory Code-Quality Subagent

After every edit to a code or configuration file, the primary Codex agent MUST
delegate to a `code_quality` subagent before reporting the change as complete.
The subagent must:

1. Review the changed diff for correctness, security, maintainability, and
   adherence to this guide; report actionable findings to the primary agent.
2. Run the complete verification suite from the repository root: `npm run verify`
   (`npm.cmd run verify` when PowerShell execution policy prevents `npm`).
3. Treat a non-zero command exit as a failed quality gate. The primary agent must
   resolve the failure or clearly report why it cannot be resolved.

The quality subagent may run only the checks relevant to an intermediate edit
when rapid feedback is needed, but it must run the full `verify` command after
the final code edit. This is an instruction-driven Codex workflow; the repository
cannot observe individual keystrokes, so it is triggered after each saved edit.

## Commit & Pull Request Guidelines

The repository has no commits yet, so there is no established message style.
Use short imperative subjects, preferably scoped (for example,
`feat: add deployment command` or `fix: validate output directory`). Keep commits
focused. Pull requests should explain the change, validation performed, relevant
issue, and terminal output or screenshots for CLI/UI changes.

## Configuration & Security

Do not commit credentials, tokens, generated distributions, or `.venv/`.
Document required environment variables in `README.md` and provide safe example
values in an `.env.example` file if configuration is added.
