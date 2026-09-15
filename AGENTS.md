# Repository Guidelines

## Project Structure & Module Organization

This repository is a Python package using the `src/` layout. Application code
lives in `src/docdeploy/`; keep reusable functionality in focused modules under
that package and expose the command-line entry point through `docdeploy:main`.
`pyproject.toml` owns Python packaging and runtime metadata. `package.json` and
`tsconfig.json` are a TypeScript/Node scaffold; put future TypeScript in `web/`
or `tools/`, not the Python package. Add Python tests under `tests/`, mirroring paths
(for example, `tests/test_cli.py`).

## Build, Test, and Development Commands

- `uv run docdeploy` runs the installed Python console script locally.
- `uv run python -m docdeploy` is suitable once `src/docdeploy/__main__.py` is
  added.
- `uv build` creates distributable Python artifacts in `dist/`.
- `npm test` currently exits with “no test specified”; replace it when JS code is added.
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

No test framework or coverage threshold is configured. Add `pytest` for Python
changes and name tests `test_<behavior>.py`, such as `test_deploy_rejects_missing_file`.
Test command-line behavior, errors, and filesystem effects with temporary directories.
Update this guide and project commands when a runner is introduced.

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
