# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server (serves `index.html` / `src/index.ts`).
- `npm run build` — type-check-free Vite production build (output would go to `dist/`, but see note below).
- `npm run preview` — preview the production build.
- `npm run format` — format `src` with Prettier (config in `.prittierc`: 4-space tabs, double quotes, no trailing commas, 100 print width).

There is no test suite and no linter configured in this project — do not assume `npm test` or `npm run lint` exist.

## Architecture

This is a browser-based cellular-automaton / ant-colony simulation rendered on an HTML5 `<canvas>`, with no build server or backend — `index.html` loads `src/index.ts` directly as an ES module via Vite.

The ant simulation is based on Li & Chen, ["Exploring the Ant Mill: Numerical and Analytical Investigations of Mixed Memory-Reinforcement Systems"](https://doi.org/10.48550/arXiv.1703.06859) (arXiv:1703.06859). The paper rejects an individual-particle phase-space model (linear, no nontrivial solution) in favor of a continuum diffusion-advection model — density ρ(x,t), pheromone g(x,t), velocity field v(x,t) with `∂v/∂t + v·∇v = b∇g` — whose nonlinearity produces a stable rotating "death spiral" (ant mill). This codebase keeps individual `Ant` agents (the style the paper's own first attempt was rejected for) and applies the fluid model's local force law per-agent instead of solving a true velocity field — a Lagrangian approximation of the paper's Eulerian result. See `README.md` for the full mapping, the paper's equations, and the current tunable-constant table.

**Entry point (`src/index.ts`)** wires everything together: it creates a `Grid`, spawns a cluster of `Ant`s in one corner, and lets the user left-click the canvas to drop a `PointOfInterest` (food/target) or right-click to place an `Obstacle`. It then drives the simulation with `setInterval` (~10 fps): each tick calls `AntRules.update(grid)` and redraws the grid, POIs, and obstacles.

**Grid/Cell (`src/models/grid.ts`, `src/models/cell.ts`)**: `Grid` owns a 2D array of `Cell`s and is the shared mutable simulation state. Each `Cell` tracks `pheromone` (float, decays/diffuses) and `ants` (count of ants currently occupying it). `Grid.get(x, y)` is the bounds-checked accessor used everywhere instead of indexing `cells` directly. `Grid.draw()` owns all canvas rendering for cells (ants green, pheromone blue with alpha proportional to concentration, empty white); coordinate convention is `(x = row, y = col)`, and drawing flips them to canvas `(pixelX = y * cellSize, pixelY = x * cellSize)` — obstacles and POIs follow the same x/y-swap convention in their own `draw()` methods.

**`AntRules` (`src/rules/antsRules.ts`)** is the only simulation driver — there's no `Rules` interface or alternate implementation to swap in. Each tick: clears per-cell ant counts, moves every `Ant`, deposits pheromone proportional to ant density, then diffuses/evaporates pheromone across the grid using a discrete Laplacian (`D` = diffusion rate, `evaporation` = decay rate, `lambda` = deposit rate — all tunable constants at the top of the class, alongside the mill-related ones below).

**Movement strategies (`src/movement/`)**: `Movement` is the interface (`move(x, y): [number, number]`) for step-generation strategies, implemented by `RandomWalk` (uniform 4-directional step) and `LevyFlight` (Lévy-distributed long-range flights: picks a random direction and a heavy-tailed run length via `length = random()^(-1/(mu-1))`, capped at `maxLength`, then keeps stepping that direction until `levyRemainingSteps` hits 0). `Ant` carries the Lévy flight state (`levyRemainingSteps`, `levyDirectionX/Y`) plus a persisted heading (`dirX`/`dirY`) that `steerTowardTrail` blends each tick — this heading, not any position history, is what gives an ant "memory."

**Ant decision logic lives in `AntRules.moveAnts`/`steerTowardTrail`**, not in the movement strategies. Per tick, per ant: if mid-Lévy-flight, continue it. Otherwise, *only if a `PointOfInterest` exists* (80% of ticks), call `steerTowardTrail` — it reads the local pheromone gradient, saturates its magnitude (`gradientSaturation`) so faint trail noise doesn't glue every ant into one rigid block, sums it with the direction to the nearest POI, blends the result into the ant's *existing* heading (`memoryWeight` controls how much), then steps into whichever valid neighbor cell best matches that heading. With no POI yet, ants only explore via `RandomWalk`/`LevyFlight` (see the comment in `moveAnts` for why — otherwise the spawn cluster's own pheromone would collapse it into a mill before anything is placed). Moves into an `Obstacle` (`Obstacle.contains`) or outside the grid bounds are excluded from the candidate set, which is what lets ants slide tangentially along an obstacle's edge instead of stalling against it — the mechanism behind ant-mill formation.

**`src/simulation/initialConditions.ts`** defines an `InitialCondition` interface (`initialize(grid, ants): void`) for seeding starting state, but nothing in `src/` currently implements or calls it — initial ant placement is instead done inline in `index.ts`.

## Repo layout notes

- `dist/` is a stale, previously-committed build output from an earlier Conway-only version of this project (no ant/pheromone code) — it predates the current `src/` (which no longer has any Conway/Game-of-Life code at all) and should not be treated as a reference. It's gitignored, so it won't be re-committed.
- `vite-project/` is an unrelated, unused default `npm create vite` scaffold (counter demo) left in the repo; it is not part of the simulation and has its own separate `package.json`.
- This is a git repository, pushed to `https://github.com/MrOliveiraGit/Automato-ant-mill` (remote `origin`, branch `master`).
