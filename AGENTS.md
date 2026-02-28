# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vite + React + TypeScript app.

- `src/main.tsx`: React bootstrap and root render.
- `src/App.tsx`: main UI flow (upload, analysis, chat).
- `src/services/gemini.ts`: Gemini API integration, prompts, and response typing.
- `src/index.css`: global styles.
- Root config: `package.json`, `vite.config.ts`, `tsconfig.json`, `.env.example`.

Keep business logic in `src/services/`. As UI complexity grows, split large JSX blocks into `src/components/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start local dev server on `0.0.0.0:3000`.
- `npm run build`: create production bundle in `dist/`.
- `npm run preview`: preview the built app locally.
- `npm run lint`: run TypeScript checks (`tsc --noEmit`).
- `npm run clean`: remove `dist/` (uses `rm -rf`, POSIX-style).

Use `npm run lint && npm run build` before opening a PR.

## Coding Style & Naming Conventions
- Language: TypeScript with React function components and hooks.
- Indentation: 2 spaces; keep semicolon usage consistent with surrounding code.
- Naming: `PascalCase` for components/types, `camelCase` for functions/variables, lowercase for service filenames (for example, `gemini.ts`).
- Prefer explicit interfaces for structured model responses (for example, `WheelchairAnalysis`).

Follow the existing style in each file; do not mix formatting styles in the same module.

## Testing Guidelines
No automated test framework is configured yet.

- Required checks: `npm run lint` and `npm run build`.
- For UI changes, include manual verification steps (example: upload a floor plan, run analysis, send a chat prompt).
- If adding tests, place them as `src/**/*.test.ts(x)` and prioritize service parsing/error handling paths first.

## Commit & Pull Request Guidelines
Current history follows Conventional Commit-style prefixes (`feat:`, `fix:`).

- Example: `fix: Improve image fetching and base64 encoding`
- Keep commits focused and written in imperative mood.
- PRs should include: summary, linked issue/task, verification commands run, and screenshots for UI changes.

## Security & Configuration Tips
- Never commit real secrets.
- Copy `.env.example` and set `GEMINI_API_KEY` locally.
- Treat model prompts/responses as potentially sensitive project data; avoid verbose production logging.
