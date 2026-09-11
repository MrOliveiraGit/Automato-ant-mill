# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server (serves `index.html` / `src/index.ts`).
- `npm run build` — type-check-free Vite production build (output would go to `dist/`, but see note below).
- `npm run preview` — preview the production build.
- `npm run format` — format `src` with Prettier (config in `.prittierc`: 4-space tabs, double quotes, no trailing commas, 100 print width).

There is no test suite and no linter configured in this project — do not assume `npm test` or `npm run lint` exist.

## Architecture

This is a browser-based cellular-automaton / ant-colony (ACO-style) simulation rendered on an HTML5 `<canvas>`, with no build server or backend — `index.html` loads `src/index.ts` directly as an ES module via Vite.

The ant simulation is based on Li & Chen, ["Exploring the Ant Mill: Numerical and Analytical Investigations of Mixed Memory-Reinforcement Systems"](https://doi.org/10.48550/arXiv.1703.06859) (arXiv:1703.06859), which models army-ant trail behavior (including the "death spiral"/ant-mill phenomenon) as a combination of two mechanisms modeled via diffusion-advection PDEs:
- **Reinforcement** — a particle's movement is biased by the trails other particles have already laid down. This maps to the pheromone field on `Cell` and `AntRules.depositPheromone`/`diffusePheromone`, whose discrete Laplacian update is a finite-difference stand-in for the paper's diffusion-advection PDE.
- **Memory** — a particle is more likely to keep moving in its current direction than to turn randomly. This maps to `LevyFlight`'s persisted direction (`levyDirectionX/Y`, `levyRemainingSteps`) and `Ant.history`/`visited()`, which bias an ant toward continuing its current line of motion rather than reversing.

Note that the paper itself does not use Lévy flight or point-of-interest/food-source attraction — those are extensions layered on top of the paper's memory-reinforcement idea in `AntRules.chooseMovement` and `calculatePOIAttraction`.

**Entry point (`src/index.ts`)** wires everything together: it creates a `Grid`, spawns a cluster of `Ant`s in one corner, and lets the user left-click the canvas to drop a `PointOfInterest` (food/target) or right-click to place an `Obstacle`. It then drives the simulation with `setInterval` (~10 fps): each tick calls `AntRules.update(grid)` and redraws the grid, POIs, and obstacles.

**Grid/Cell (`src/models/grid.ts`, `src/models/cell.ts`)**: `Grid` owns a 2D array of `Cell`s and is the shared mutable simulation state. Each `Cell` tracks `pheromone` (float, decays/diffuses) and `ants` (count of ants currently occupying it) for the ant simulation, plus a legacy `alive` boolean used only by `ConwayRules`. `Grid.get(x, y)` is the bounds-checked accessor used everywhere instead of indexing `cells` directly. `Grid.draw()` owns all canvas rendering for cells (ants green, pheromone blue with alpha proportional to concentration, empty white); coordinate convention is `(x = row, y = col)`, and drawing flips them to canvas `(pixelX = y * cellSize, pixelY = x * cellSize)` — obstacles and POIs follow the same x/y-swap convention in their own `draw()` methods.

**Rules pattern (`src/rules/`)**: `Rules` is a one-method interface (`update(grid): void`) implemented by two independent, mutually exclusive simulations that both operate on the same `Grid`/`Cell` shape:
- `ConwayRules` — classic Conway's Game of Life using `cell.alive`. Currently unused by `index.ts` (superseded by the ant simulation) but kept as a `Rules` implementation.
- `AntRules` — the active simulation. Each tick: clears per-cell ant counts, moves every `Ant`, deposits pheromone proportional to ant density, then diffuses/evaporates pheromone across the grid using a discrete Laplacian (`D` = diffusion rate, `evaporation` = decay rate, `lambda` = deposit rate, all tunable constants at the top of the class).

**Movement strategies (`src/movement/`)**: `Movement` is the interface (`move(x, y): [number, number]`) for step-generation strategies, implemented by `RandomWalk` (uniform 4-directional step) and `LevyFlight` (Lévy-distributed long-range flights: picks a random direction and a heavy-tailed run length via `length = random()^(-1/(mu-1))`, capped at `maxLength`, then keeps stepping that direction until `levyRemainingSteps` hits 0). `Ant` itself carries the Lévy flight state (`levyRemainingSteps`, `levyDirectionX/Y`) and a short position `history` (last 20 cells) used to avoid immediate backtracking.

**Ant decision logic lives in `AntRules.moveAnts`/`chooseMovement`**, not in the movement strategies: each ant is either mid-Lévy-flight (continues it), or rolls to follow local gradients (80% of the time picks a neighboring cell weighted by pheromone concentration + alignment toward the nearest `PointOfInterest`, computed in `calculatePOIAttraction` as the dot product of the movement direction and the direction-to-POI), starts a new Lévy flight (1% chance), or falls back to `RandomWalk`. Moves into an `Obstacle` (`Obstacle.contains`) or outside the grid bounds are rejected and the ant stays in place for that tick.

**`src/simulation/initialConditions.ts`** defines an `InitialCondition` interface (`initialize(grid, ants): void`) for seeding starting state, but nothing in `src/` currently implements or calls it — initial ant placement is instead done inline in `index.ts`.

## Repo layout notes

- `dist/` is a stale, previously-committed build output from an earlier Conway-only version of this project (no ant/pheromone code) — it does not reflect current `src/` and should not be treated as a reference.
- `vite-project/` is an unrelated, unused default `npm create vite` scaffold (counter demo) left in the repo; it is not part of the simulation and has its own separate `package.json`.
- This directory is not a git repository.
