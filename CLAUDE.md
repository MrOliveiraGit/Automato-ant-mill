# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server (serves `index.html` / `src/index.ts`, and `/report`: `report.html` + `src/report.ts` render `REPORT.md` with marked + KaTeX — update REPORT.md's timeline and results when adding commits or experiments).
- `npm run build` — Vite production build, with no type checking (output would go to `dist/`, but see note below).
- `npx tsc --noEmit` — the only type check available (no npm script for it). It currently passes cleanly, so run it after TypeScript changes.
- `npm run preview` — preview the production build (`vite.config.ts` builds both `index.html` and `report.html`, with relative `base: "./"`).
- `npm run deploy` — builds and commits `dist/` to the `gh-pages` branch through a temporary git worktree, then pushes it (`scripts/deploy-pages.mjs`); GitHub Pages serves that branch at https://mroliveiragit.github.io/Automato-ant-mill/. The site only changes when this is run.
- `npm run format` — format `src` with Prettier. The config file is misspelled `.prittierc`, so Prettier ignores it and uses its defaults (2-space indent, trailing commas, 80 print width) — which is what the code actually follows. `scripts/` isn't covered by this command.
- `npm run movement -- --scenario random|column|ring|trails|classic --runs N --ticks N [--set key=v] [--sweep key=v1,v2 ...] [--wind S] [--layout ...] [--json]` — headless tests of the base movement in a neutral arena (`scripts/movement-tests.mjs`); `--sweep` builds a cartesian grid over `AntRulesSettings` keys. Roughly 1 s per 1000 ticks per run.
- `npm run experiment -- --runs N --ticks N --seed N --layout none|gap|block [--scenario trails] [--set key=v] [--json]` — wind presets × runs (`scripts/wind-experiment.mjs`).
- Both runners share `scripts/common.mjs`, which loads the TypeScript through Vite's SSR loader (`createServer` + `ssrLoadModule`) — also the easiest way to run any ad-hoc headless check of the simulation without adding dependencies.

There is no test suite and no linter configured in this project — do not assume `npm test` or `npm run lint` exist.

## Conventions

- Identifiers and README are in English, but code comments (and a few UI/log strings) are in Portuguese — keep new comments in Portuguese to match.
- Relative imports use the `.js` extension (`from "../models/grid.js"`) even though the files are `.ts`.
- `tsconfig.json` sets `exactOptionalPropertyTypes`, so optional properties that may be passed `undefined` must be declared `?: T | undefined` (see `SimulationOptions`).

## Architecture

This is a browser-based cellular-automaton / ant-colony simulation rendered on an HTML5 `<canvas>`, with no build server or backend — `index.html` loads `src/index.ts` directly as an ES module via Vite.

The ant simulation is based on Li & Chen, ["Exploring the Ant Mill: Numerical and Analytical Investigations of Mixed Memory-Reinforcement Systems"](https://doi.org/10.48550/arXiv.1703.06859) (arXiv:1703.06859). The paper rejects an individual-particle phase-space model (linear, no nontrivial solution) in favor of a continuum diffusion-advection model — density ρ(x,t), pheromone g(x,t), velocity field v(x,t) with `∂v/∂t + v·∇v = b∇g` — whose nonlinearity produces a stable rotating "death spiral" (ant mill). This codebase keeps individual `Ant` agents (the style the paper's own first attempt was rejected for) and applies the fluid model's local force law per-agent instead of solving a true velocity field — a Lagrangian approximation of the paper's Eulerian result. See `README.md` for the full mapping, the paper's equations, and the current tunable-constant table.

**Entry point (`src/index.ts`)** builds the simulation with `createSimulation()` from `src/simulation/windExperiment.ts`, choosing the scenario from `?scenario=` (default `random`). Right-click places an `Obstacle`, 1–4 restart from the same seeded initial condition with no/weak/moderate/strong wind, R restarts; placed obstacles survive restarts. It drives the simulation with `setInterval` (~10 fps): each tick calls `AntRules.update(grid)`, feeds the ants to `MillMetrics.measure()`, redraws grid/obstacles plus the overlay (`experimentOverlay.ts`: wind arrow, A/B markers, mill marker), and writes the `#hud` text in `index.html`.

**Movement model — `AntRules` (`src/rules/antsRules.ts`)** is the only simulation driver. Ants are blind trail-followers, modelled on army ants: constant speed, two antennae ahead at `±sensorAngle`, turn `clamp(turnGain·(gL−gR)/(turnSaturation+gL+gR), ±maxTurn) + turnNoise·N(0,1)`, then step; walls and obstacles reflect the heading specularly. This is the paper's `∂v/∂t = b∇g` at constant speed (only the component of ∇g normal to the heading turns the ant). There is deliberately no target/POI, no Lévy flight and no random-walk phase — an earlier version had them, and they prevented mills (removed in branch `army-ant-movement`; see git history). All tunables live in `AntRulesSettings` / `DEFAULT_ANT_RULES`; the constructor is `(ants, obstacles, wind, settings)`. Each tick: clear per-cell ant counts, move every ant, deposit `deposit × cell.ants`, then `diffusePheromone` (discrete Laplacian + first-order upwind wind term, `∂g/∂t = D∇²g − v·∇g − evaporation·g`). `advectionVelocity()` returns the wind velocity actually applied, scaled down to `|vx| + |vy| ≤ 1 − 4D − evaporation`, the condition for the explicit update to stay positive and stable. The rule must stay left/right symmetric: nothing may steer ants toward rotation, so mills have to emerge from trails that close on themselves.

**Ant/Grid/Cell (`src/models/`)**: `Ant` has a *continuous* position `x, y` (in cells; it occupies `cellX = floor(x)`, `cellY = floor(y)`) and a `heading` in radians, which is its whole memory. `Grid` owns a 2D array of `Cell`s (`pheromone`, `ants` count) and is the shared mutable state; `Grid.get(x, y)` is the bounds-checked accessor. Its canvas context is optional (`null` for headless runs); `draw()` throws without one. Coordinate convention is `(x = row, y = col)`, and every `draw()` flips them to canvas `(pixelX = y * cellSize, pixelY = x * cellSize)`. Pheromone lives on the grid; cell-index coordinates (lane endpoints, obstacles) refer to cell `(i, j)`, whose centre is `(i + 0.5, j + 0.5)` in ant coordinates.

**Scenarios and experiments (`src/simulation/`)**: `windExperiment.ts` holds every parameter (`WIND_EXPERIMENT` incl. `ring`/`column`/`trails` geometry, `WIND_PRESETS`, `OBSTACLE_LAYOUTS`, `SCENARIOS`), the `createSimulation()` factory shared by the browser and the runners (accepts `rules` overrides), `runTrial` (also reports late-run rotating fraction, `followingFraction` = ants in single-file columns, `crowdedFraction` = ants in clumps) and `runWindExperiment` (run r of every preset uses seed `seed + r`, so comparisons are paired). `initialConditions.ts` implements `InitialCondition` as `RandomScatter` (neutral test), `Column` (Test B), `Ring` (Test A: a ready-made mill), `TwoWayTrails` (wind experiment) and `CornerCluster` (classic); placement uses a seeded mulberry32 PRNG while the dynamics use `Math.random`. `millMetrics.ts` is a read-only ant-mill detector: an ant "loops" when its 5-tick displacement direction turns a consistent 2π within a 300-tick exponential window, and the state is "rotating" when ≥ 15 same-sense loopers mostly circle their shared centroid (it deliberately doesn't use plain `|⟨r̂ × v̂⟩|`, because counter-flowing lanes score high on it). The wind acts only on the pheromone field, never on ants. See README for results, numerics, calibration and known artifacts (downwind drift into walls, upwind numerical diffusion, tight circling balls, wall-shaped loops).

## Repo layout notes

- `dist/` is a stale, previously-committed build output from an earlier Conway-only version of this project (no ant/pheromone code) — it predates the current `src/` (which no longer has any Conway/Game-of-Life code at all) and should not be treated as a reference. It's gitignored, so it won't be re-committed.
- `vite-project/` is an unrelated, unused default `npm create vite` scaffold (counter demo) left in the repo; it is not part of the simulation and has its own separate `package.json`.
- `AGENTS.md` (guidance for Codex) exists locally but is excluded via `.git/info/exclude` — never commit or push it.
- This is a git repository, pushed to `https://github.com/MrOliveiraGit/Automato-ant-mill` (remote `origin`, branch `master`).
