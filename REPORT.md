# Automato — project report

**Ant mills in an agent-based pheromone simulation, and what wind does to them**

Repository: `MrOliveiraGit/Automato-ant-mill` · period covered: 2026-09-11 → 2026-09-28 · 10 commits on 4 branches

---

## 1. Summary

The project simulates ants on a 100 × 100 grid. Each ant is an individual agent, and all ants share one pheromone field. The goal is to reproduce the **ant mill**, the "death spiral" in which army ants circle endlessly following each other's trail. It then asks one scientific question:

> **Can wind that moves the pheromone trails change whether a mill emerges?**

The work went through two movement models:

| | Movement v1 (commits `54fd7bd` → `4085dfc`) | Movement v2, "army ant" (`7c124f7` → `6082cec`) |
|---|---|---|
| How an ant moves | Lattice steps; random walk + Lévy flights; follows the trail **only if a food target (POI) exists**, and is pulled toward it | Continuous position, constant speed; two antennae; turns toward the side with more pheromone; nothing else |
| Mills from scratch | **0 mills in 120 runs** (every wind level and obstacle layout) | **Mills in ~80–90% of runs**, with no rule mentioning rotation |
| Effect of wind | Colony blown into the downwind wall; still no mills | Strong wind **destroys** mills; weak wind gives **more, smaller, briefer** mills; walls are a confound |

Nowhere in the code is a mill imposed. The turning rule is symmetric between left and right, and nothing refers to a centre, a circle or a direction of rotation. The one exception is **Test A (`ring`)**, which *starts* from a mill on purpose. It checks whether a mill keeps itself going; it says nothing about how one forms.

---

## 2. Timeline

```
master             54fd7bd ── 0f61a19
                                 │
poi-lifespan                     ├── 03bcb80 ── 9531694
                                 │
wind-on-pheromone                └── 1016866 ── b2d048a ── fe297df ── 4085dfc
                                                                         │
army-ant-movement                                                        └── 7c124f7 ── 6082cec
                                                                                           │
project-report                                                                             └── (this report)
```

| # | Date | Commit | Branch | Concept | Why | Result |
|---|---|---|---|---|---|---|
| 1 | 09-11 | `54fd7bd` | master | First simulation: pheromone field + memory/reinforcement steering (v1) | Starting point, based on Li & Chen | Ants forage to a POI; mills claimed only "occasionally" |
| 2 | 09-11 | `0f61a19` | master | Remove the Conway (Game of Life) scaffolding | Dead code from the project's origin | Codebase is only the ant model |
| 3 | 09-18 | `03bcb80` | poi-lifespan | Food (POI) runs out after 300 ticks | Real food is finite | POI fades and is removed |
| 4 | 09-25 | `9531694` | poi-lifespan | Keep following trails after the POI expires | Bug: ants stopped following pheromone once the food was gone | Trails still followed after expiry |
| 5 | 09-25 | `1016866` | wind-on-pheromone | Prettier formatting only | Keep the next diff readable | No behaviour change |
| 6 | 09-25 | `b2d048a` | wind-on-pheromone | Wind as advection of pheromone; A↔B trails; mill detector; batch runner | Test the wind hypothesis | **0/120 mills**; wind pushes the colony into the wall |
| 7 | 09-28 | `fe297df` | wind-on-pheromone | AGENTS.md committed | Selected by mistake | — |
| 8 | 09-28 | `4085dfc` | wind-on-pheromone | AGENTS.md untracked again | Keep it private | — |
| 9 | 09-28 | `7c124f7` | army-ant-movement | New movement: blind army ant with two antennae (v2) | v1 never milled and was judged unrealistic | Ring persists 10/10; **mills emerge in ~90%** |
| 10 | 09-28 | `6082cec` | army-ant-movement | Wind experiments E1–E3 on v2 | Re-ask the question with a model that can mill | Strong wind kills mills; weak wind → more, smaller mills |

Only `master`, `poi-lifespan` and `wind-on-pheromone` are on GitHub. `army-ant-movement` and this report exist only locally.

---

## 3. Background: the ant mill and the paper

**The biology.** Army ants are nearly blind and navigate by pheromone alone. An ant follows the trail left by the ants ahead and lays its own trail as it walks. No individual knows where the nest or food is. A mill (Beebe 1921; Schneirla 1944) happens when a group loses the main trail and the head of the column runs into its own tail. From then on the closed loop sustains itself, because every ant keeps doing exactly what it always does.

**The paper.** Li & Chen, *Exploring the Ant Mill: Numerical and Analytical Investigations of Mixed Memory-Reinforcement Systems* (arXiv:1703.06859), makes two attempts at modelling this.

1. *Rejected:* a density in position–velocity phase space, $\rho(\vec x, \theta, t)$. The equation is linear, so it has no non-trivial solution and cannot produce a spiral.
2. *Accepted:* a continuum fluid model with density $\rho$, pheromone $g$ and velocity $\vec v$:

$$
\frac{\partial \rho}{\partial t} + \vec v\cdot\nabla\rho = \nabla\cdot\left(\nabla\rho - \rho\,\frac{\beta}{\alpha+\beta g}\,\nabla g\right)
$$

$$
\frac{\partial g}{\partial t} = \lambda\rho - g
\qquad\qquad
\frac{\partial \vec v}{\partial t} + \vec v\cdot\nabla\vec v = b\,\nabla g
$$

The coupling between density and pheromone makes the system non-linear. That non-linearity allows a stationary, axially symmetric **spiral** solution, which the paper shows is stable.

Two ingredients drive it: **reinforcement**, since ants are pulled up the pheromone gradient, and **memory**, since velocity persists, so ants keep going the way they were going.

**Where this code sits.** The simulation keeps *individual* ants, the style of the rejected first attempt, but gives each ant the *local force law* of the accepted model. It is a Lagrangian, agent-based approximation of an Eulerian, continuum result. So a mill is not guaranteed here the way the paper's steady state is: mills form, merge and break up, with run-to-run variance.

---

## 4. The physics and the maths

### 4.1 The pheromone field (reaction–diffusion)

Pheromone $g(x,y,t)$ lives on the grid. Without wind:

$$
\frac{\partial g}{\partial t} = D\,\nabla^2 g \;+\; \lambda\rho \;-\; \mu g
$$

- $D\nabla^2 g$: diffusion, the pheromone spreading out.
- $\lambda\rho$: deposition, where $\rho$ is the number of ants in the cell and $\lambda$ is `deposit` = 0.2 per ant per tick.
- $\mu g$: evaporation, with $\mu$ = `evaporation` = 0.05 per tick.

**Discretisation.** Explicit Euler with $\Delta t = 1$ tick and $\Delta x = 1$ cell, using the 5-point Laplacian:

$$
g^{n+1}_{i,j} = g^n_{i,j} + D\left(g_{i+1,j}+g_{i-1,j}+g_{i,j+1}+g_{i,j-1}-4g_{i,j}\right) - \mu\, g_{i,j}
$$

At the edges a missing neighbour counts as equal to the cell itself, so no pheromone flows through the walls (zero-flux, or Neumann, boundary).

**Why it is stable.** The coefficient of $g_{i,j}$ is $1-4D-\mu = 0.93 > 0$, and every neighbour's coefficient is $D>0$. The new value is therefore a weighted average of old non-negative values minus decay. Pheromone can never become negative or blow up.

**Useful scales** (these explain much of the behaviour):

| Quantity | Formula | Value |
|---|---|---|
| Pheromone lifetime | $1/\mu$ | 20 ticks (2 s on screen) |
| Diffusion length during that lifetime | $\sqrt{D/\mu}$ | 0.32 cells: pheromone basically stays where it was laid |
| Steady level under one stationary ant | $\lambda(1-\mu)/\mu$ | 3.8 |

Because diffusion is so weak, the pheromone field is essentially **a recent history of where the ants walked**, fading over about 20 ticks. A trail survives only if ants keep walking it.

### 4.2 Wind: advection of the pheromone

Wind is a uniform velocity $\vec v_w=(v_x,v_y)$ that carries pheromone along. This adds an advection term:

$$
\frac{\partial g}{\partial t} = D\nabla^2 g \;-\; \vec v_w\cdot\nabla g \;+\; \lambda\rho \;-\; \mu g
$$

The wind acts **only on $g$**. No line of the movement code reads the wind. An ant feels it only through the pheromone values its antennae read. This was checked: with deposition switched off, ant trajectories are identical with and without wind.

**First-order upwind scheme.** The derivative along each axis is taken from the side the wind comes from:

$$
\vec v_w\cdot\nabla g \;\approx\; |v_x|\,(g_{i,j} - g_{\text{upwind},x}) + |v_y|\,(g_{i,j} - g_{\text{upwind},y})
$$

*Why not central differences?* Central differences combined with explicit Euler are unconditionally unstable for advection: they create oscillations and negative concentrations.

**Stability and positivity.** With the upwind term, the update is

$$
g^{n+1} = (1-4D-\mu-|v_x|-|v_y|)\,g + (D+|v_x|)\,g_{\text{up},x} + D\,g_{\text{down},x} + (D+|v_y|)\,g_{\text{up},y} + D\,g_{\text{down},y}
$$

All coefficients are non-negative exactly when

$$
|v_x| + |v_y| \;\le\; 1 - 4D - \mu = 0.93 \text{ cells/tick}
$$

This is a CFL-type condition. `advectionVelocity()` scales any stronger wind down to this limit while keeping its direction. Stress tests with requested speeds up to $10^6$ stay finite and $\ge 0$.

**Boundaries.** Clean air ($g=0$) enters across the upwind edge, and pheromone leaves freely across the downwind edge.

**Checks that were run:**
- With $\vec v_w = 0$ the solver is bit-for-bit the old diffusion-only one.
- A pheromone blob loses mass exactly by the evaporation factor $0.95^{20}$ over 20 ticks.

**Drift speed (a small discretisation effect).** Take the first moment $M_1=\sum_i i\,g_i$ and the mass $M=\sum_i g_i$ of the 1-D upwind update:

$$
M' = (1-\mu)M,\qquad M_1' = (1-\mu)M_1 + v\,M
\;\Rightarrow\;
\bar x' = \bar x + \frac{v}{1-\mu}
$$

A blob therefore moves at $v/(1-\mu)\approx 1.05\,v$ cells per tick. The measured value (6.316 cells in 20 ticks at $v=0.3$) matches exactly.

**Numerical diffusion (an important caveat).** The modified-equation analysis of first-order upwind with $\Delta x=\Delta t=1$ gives

$$
g_t + v g_x = \underbrace{\tfrac{1}{2}|v|(1-|v|)}_{D_{\text{num}}}\, g_{xx} + \dots
$$

The scheme itself smears the field along the wind:

| Wind preset | $v$ | $D_{\text{num}}$ | vs physical $D=0.005$ |
|---|---|---|---|
| weak | 0.05 | 0.024 | ~5× |
| moderate | 0.15 | 0.064 | ~13× |
| strong | 0.40 | 0.12 | ~24× |

Part of the "trail disruption" at stronger winds is therefore numerical smearing rather than real transport.

**How the presets were chosen.** A pheromone parcel lives about $1/\mu$ ticks, so it travels an **advection length** $L = v/\mu$:

| Preset | $L$ | Meaning |
|---|---|---|
| weak | ~1 cell | barely moves the trail |
| moderate | ~3 cells | about half the distance between the two lanes |
| strong | ~8 cells | more than the lane separation |

### 4.3 Movement v1 (commits 1–8): lattice ants with a food target

Each ant sits on a grid cell. Every tick:

1. If it is in a **Lévy flight**, it keeps stepping in a fixed direction. Flight length is $L = U^{-1/(\mu_L-1)}$ with $U$ uniform, $\mu_L=1.5$ and a cap of 20. This gives a power-law tail $P(L>\ell)=\ell^{-(\mu_L-1)}$: many short flights and a few very long ones.
2. Otherwise, **only if a POI (food) exists**, with probability 0.8 it calls `steerTowardTrail`:
   - Gradient from the 8 neighbours: $\vec G=\sum_k \hat u_k\,g_k$.
   - Saturated so faint traces don't count: $\vec G_s=\hat G\,\dfrac{|G|}{\alpha+|G|}$. This is the paper's $\beta/(\alpha+\beta g)$ idea.
   - Signal: $\vec S = \text{normalise}(3\,\vec G_s + 2\,\hat r_{\text{POI}})$.
   - Memory: $\vec d_{\text{new}}=\text{normalise}(0.5\,\vec d_{\text{old}} + 0.5\,\vec S + \text{noise})$.
   - Step to the neighbour cell best aligned with $\vec d_{\text{new}}$.
3. Otherwise it takes a random 4-direction step, with a 1% chance of starting a Lévy flight.

**Why v1 could not mill** (this is what the first wind experiment revealed):

- **A point attractor points every heading inward.** The POI term $\hat r_{\text{POI}}$ makes all ants converge on the food and form a jittering clump. A mill needs headings *along* a loop, not toward its centre. In the classic scenario about 60 ants ended within 4 cells of the POI with speed ~0.3, and no rotation.
- **No POI means no trail following at all** (`followChance` = 0), so the pheromone was ignored until food was placed.
- **Lattice steps** can only trace 8-direction "staircases", not smooth circles.
- **Weak memory.** With `memoryWeight` = 0.5 the heading forgets half of itself every tick.

### 4.4 Movement v2 (commits 9–10): the blind army ant

**State.** A continuous position $(x,y)$ in cell units and a heading $\theta$. The heading is the ant's **entire memory**.

**From the paper's force law to a turning rule.** The paper steers velocity with $\partial\vec v/\partial t = b\nabla g$. If the speed $s$ is held constant, the component of $b\nabla g$ along the heading cannot change the motion; only the perpendicular component can. Writing $\hat n$ for the ant's left-hand normal:

$$
\frac{d\theta}{dt} = \frac{b}{s}\,\left(\nabla g\cdot\hat n\right)
$$

**The antennae measure exactly that.** Two sensors sit $d$ = 3 cells ahead at $\pm\varphi$ = ±45°. To first order:

$$
g_L - g_R \;\approx\; 2d\sin\varphi\;(\nabla g\cdot\hat n)
$$

The sensors are 4.2 cells apart. Their readings are interpolated bilinearly between cell centres, so the difference varies smoothly instead of jumping when an antenna crosses a cell border. Nothing behind the ant is sensed, so its own fresh trail cannot pull it backwards.

**The rule the code applies every tick:**

$$
\Delta\theta = \operatorname{clamp}\!\left(b\,\frac{g_L-g_R}{\alpha+g_L+g_R},\;\pm\theta_{\max}\right) + \sigma\,\xi,\qquad \xi\sim\mathcal N(0,1)
$$

| Symbol | Setting | Default | Role |
|---|---|---|---|
| $b$ | `turnGain` | 1 | strength of the pull toward the stronger antenna |
| $\alpha$ | `turnSaturation` | 0.05 | below this, differences count little (the paper's saturation) |
| $\theta_{\max}$ | `maxTurn` | 0.5 rad | minimum turning radius $s/\theta_{\max}$ = 2 cells |
| $\sigma$ | `turnNoise` | 0.1 rad | random heading noise per tick |
| $s$ | `speed` | 1 cell/tick | constant; ants never stop |

Then the ant steps $s$ along $\theta$. Walls and obstacles reflect the heading like light off a mirror: the velocity component that would cross the wall is flipped.

**Why this can make a mill without anything "mill-like" in the code:**

- **Symmetry.** The rule is unchanged if left and right are swapped. Neither sense of rotation is favoured, and no centre or circle appears anywhere. A mill can only appear when a trail *closes on itself*.
- **A ring is self-consistent.** An ant on a circular trail of radius $R$ must turn $s/R$ per tick to stay on it. On a curved trail the inner antenna lies closer to the trail than the outer one, so $g_{\text{inner}}>g_{\text{outer}}$ and the ant turns inward. The turn stays proportional to the imbalance, so heading persistence and the trail's sideways pull can balance. This requires $\theta_{\max}\ge s/R$. For $R$ = 15 the needed turn is 0.067 rad per tick, well below 0.5.
- **Positive feedback.** Ants follow trails, following deposits more pheromone, and stronger trails attract more ants. Open trails evaporate within about 20 ticks unless walked, while a closed loop is walked continuously. Loops therefore out-compete open trails. This is the paper's "reinforcement".
- **Noise is the control parameter.** Heading noise acts like rotational diffusion. A free ant's heading decorrelates as $e^{-\sigma^2 t/2}$, so its **persistence length** is $\ell_p = 2s/\sigma^2$:

| $\sigma$ | $\ell_p$ | Measured result |
|---|---|---|
| 0.1 | 200 cells | mills form |
| 0.2 | 50 cells | mills form |
| 0.3 | 22 cells | mills mostly collapse |

A typical mill has a circumference of $2\pi\cdot23\approx145$ cells. Once noise makes ants lose direction over much less than one loop, trail following can't hold them. This is a heuristic explanation (it ignores the trail's restoring pull), but it matches the measurements.

### 4.5 Detecting a mill (`millMetrics.ts`)

The detector only observes; it never feeds back into the simulation.

**Why not the classic order parameter?** The standard rotation order parameter (Couzin et al. 2002) is

$$
O_r = \left|\frac{1}{N}\sum_i \hat r_i\times\hat v_i\right|
$$

where $\hat r_i$ points from the centre to ant $i$ and $\hat v_i$ is its direction of motion. About an arbitrary centre $c$, even pure translation gives $\sum_i(\vec r_i-c)\times\vec v = N(\bar r - c)\times\vec v\ne0$. In particular, two **counter-flowing straight lanes**, the wind experiment's own starting condition, score about 0.3 with nobody going round in circles. $O_r$ alone would report fake mills.

**Two-step detector:**

1. **Is each ant really looping?** Its direction is that of its net displacement over 5 ticks. The detector accumulates the turning of that direction in an exponential window of $W$ = 300 ticks:
   $$w_i \leftarrow w_i\left(1-\tfrac1W\right)+\Delta\theta_i$$
   The ant is *looping* if $|w_i|\ge 2\pi$ (one full turn) **and** $|w_i| \ge 0.3\sum|\Delta\theta_i|$ (it turned mostly to one side). Turns over 60° in a single tick are reversals and are ignored rather than counted as ±π; without that rule, ants going back and forth accumulated fake rotation.
2. **Are they circling together?** Take the looping ants of the majority sense (the *participants*) and their centroid. The *alignment* is the fraction of participants whose angular momentum about that centroid has the loop's sense. The state is **rotating** when there are ≥ 15 participants and alignment ≥ 0.8. Unrelated loops scattered around the grid sit near 0.5.

A run counts as **"mill formed"** when one continuous rotating episode completes ≥ 1 full rotation.

**Calibration against known answers:**

| Situation | Outcome |
|---|---|
| Synthetic circular mills (15–40 ants, radius 4–15), a drifting mill, a clump chasing round a ring, a racetrack around both lanes | Detected; participant counts exact (e.g. 40/40, radius 7.7 for a true 8) |
| Counter-flowing lanes, scattered independent loops, pure random walkers | Never flagged |
| Mills of radius ≥ 20 | Only partly detected |

### 4.6 Statistics

- **Paired design.** Run $r$ of every wind level uses the same seed. Initial conditions are identical; only the random dynamics differ.
- **Proportion of runs with a mill:** 95% Wilson interval
  $$\frac{\hat p + \frac{z^2}{2n} \pm z\sqrt{\frac{\hat p(1-\hat p)}{n}+\frac{z^2}{4n^2}}}{1+\frac{z^2}{n}},\qquad z=1.96$$
- **Wind vs no wind, same seeds: exact McNemar test.** Only seeds whose outcome flipped count: $b$ lost a mill, $c$ gained one.
  $$p = \min\!\left(1,\;2\sum_{k=0}^{\min(b,c)}\binom{b+c}{k}2^{-(b+c)}\right)$$
  Example: pooled weak wind, 5 lost and 19 gained, gives $p = 2\cdot 55455/2^{24} \approx 0.007$.
- **Continuous metrics:** mean ± standard error $s/\sqrt n$, and paired differences for the Δ columns.

---

## 5. Commit by commit

### 1 · `54fd7bd` — Initial commit (2026-09-11, master)
- **Concept:** a canvas cellular automaton with a pheromone field (diffusion + evaporation + deposition) and ants steered by memory and reinforcement toward a point of interest, with random walk and Lévy flights for exploration. This is movement v1, §4.3.
- **Why:** the starting point, loosely based on Li & Chen.
- **Result:** ants find and swarm the food. The mill was described as "a handful of ants circling an obstacle for a while". It was never measured, and the later detector found no sustained mill with this model.

### 2 · `0f61a19` — Remove Conway scaffolding (2026-09-11, master)
- **Concept:** delete the unused Game-of-Life rules, the `Rules` interface and `Cell.alive`.
- **Why:** leftover from the project's origin; only the ant model runs.
- **Result:** simpler codebase, no behaviour change.

### 3 · `03bcb80` — Food that runs out (2026-09-18, poi-lifespan)
- **Concept:** each POI has a lifespan (default 300 ticks). It fades as it depletes, then disappears.
- **Why:** real food sources are finite.
- **Result:** POIs vanish over time. This exposed the bug fixed in the next commit.

### 4 · `9531694` — Keep following trails after food expires (2026-09-25, poi-lifespan)
- **Concept:** the rule "follow trails only if a POI exists" became "only if a POI has *ever* existed".
- **Why:** when the last POI expired, the follow probability fell to 0 and ants ignored an established trail.
- **Result:** trails keep being followed after the food is gone. *This branch was never merged, and movement v2 later removed POIs entirely.*

### 5 · `1016866` — Prettier formatting (2026-09-25, wind-on-pheromone)
- **Concept / why:** formatting only, so the next commit's diff shows only real changes.
- **Result:** no behaviour change.

### 6 · `b2d048a` — Wind experiment platform (2026-09-25, wind-on-pheromone)
- **Concept:**
  - wind as advection of pheromone, with the upwind scheme and stability cap of §4.2;
  - seeded A→B / B→A lanes;
  - the mill detector of §4.5;
  - a headless paired batch runner (`npm run experiment`);
  - on screen: wind arrow, heads-up display, keys 1–4.
- **Why:** to test whether trail disruption by wind favours mills, with wind acting only on the pheromone.
- **Validation:**
  - zero wind reproduces the old code exactly;
  - wind never moves ants directly;
  - pheromone stays $\ge 0$ and finite;
  - random walk, Lévy flights, memory, obstacles and POIs all still work.
- **Result (pilot, 10 paired runs × 4 winds × 3 obstacle layouts):** **0/10 mills in every condition.** Wind carried the whole trail system downwind at about the wind speed until the colony was pinned to the downwind wall. A crosswind also broke the two lanes into drifting clusters. The conclusion was that the model, not the wind, was the bottleneck.

### 7–8 · `fe297df`, `4085dfc` — AGENTS.md (2026-09-28, wind-on-pheromone)
- **Concept / why:** a local guidance file for another tool was committed by mistake, then untracked.
- **Result:** no code change. The file stays local, excluded from git.

### 9 · `7c124f7` — Army-ant movement (2026-09-28, army-ant-movement)
- **Concept:** movement v2 of §4.4 (continuous position, constant speed, two antennae, proportional saturating turn, heading noise, reflecting walls). Removed the POI, Lévy flights and random-walk phases. Added neutral test scenarios (`random`, `column`, `ring`) and `npm run movement` with parameter sweeps.
- **Why:** v1 never milled and was judged unrealistic for army ants, which are blind, always walking and pure trail followers. The goal was to get a neutral baseline that can mill before studying perturbations.
- **Results:**
  - **Test A** (`ring`, the only *seeded* mill): it persists in 10/10 runs, with all 200 ants participating for about 28 rotations. This shows the rule can sustain a mill.
  - **Test B** (`random`: random positions and headings, *no pheromone*): a mill forms in **10/10** runs, first rotation after 510 ± 126 ticks, with 73% of ants in columns. The mill here **emerges**.
  - **Robustness:** mills form in 8–9 of 10 runs for $b\in\{0.5,1,2\}$ with $\sigma\le0.2$. At $\sigma=0.3$ they drop to 0–5 of 10, so noise is the control parameter (§4.4).

### 10 · `6082cec` — Wind experiments on the army-ant movement (2026-09-28, army-ant-movement)
- **Concept:** added mill radius and wall-contact diagnostics, and ran three paired experiments with a crosswind and no obstacles.
- **Why:** re-ask the wind question with a model that can actually mill.
- **Results:**

**E1 — does wind destroy an existing mill?** (`ring`, 20 runs × 2000 ticks)

| Wind | Mill (≥ 1 rotation) | Rotating, last quarter | Rotations | Ants near walls |
|---|---|---|---|---|
| none | 20/20 | 100% | 27.6 | 0% |
| weak | 20/20 | 43 ± 7% | 14.3 | 10% |
| moderate | 20/20 | 33 ± 5% | 4.2 | 15% |
| strong | 5/20 (p < 0.001) | 6 ± 3% | 0.7 | 19% |

**E2 — mills from scratch, default settings** (`random`, 40 runs × 3000 ticks)

| Wind | Mills | Lost / gained, p | Rotating % (paired Δ) | Mill radius | Mill touching wall |
|---|---|---|---|---|---|
| none | 33/40 | | 46 ± 4 | 23 ± 1 | 42 ± 5% |
| weak | 39/40 | 1 / 7, 0.07 | 45 ± 2 (−1 ± 5) | 15 ± 0.4 | 61 ± 3% |
| moderate | 37/40 | 3 / 7, 0.34 | 30 ± 2 (−16 ± 5) | 13 ± 0.5 | 58 ± 2% |
| strong | 10/40 | 27 / 4, < 0.001 | 9 ± 1 (−37 ± 4) | 12 ± 0.6 | 62 ± 2% |

**E3 — mills from scratch where they are rare** ($\sigma$ = 0.3, 40 runs × 3000 ticks)

| Wind | Mills | Lost / gained, p | Rotating % (paired Δ) | Mill radius | Mill touching wall |
|---|---|---|---|---|---|
| none | 21/40 | | 23 ± 4 | 22 ± 1.5 | 38 ± 5% |
| weak | 29/40 | 4 / 12, 0.08 | 19 ± 2 (−4 ± 4) | 16 ± 0.6 | 71 ± 4% |
| moderate | 16/40 | 12 / 7, 0.36 | 6 ± 1 (−16 ± 4) | 16 ± 1.0 | 75 ± 4% |
| strong | 0/40 | 21 / 0, < 0.001 | 0.3 ± 0.1 (−22 ± 4) | 28 ± 1.1 | 90 ± 5% |

---

## 6. What the results mean

1. **A mill can emerge from purely local, symmetric trail following.** With movement v2, random ants with no initial trail self-organise into columns, then loops, then usually one large mill. No line of code refers to rotation. This reproduces, in an agent model, the qualitative claim of Li & Chen that memory plus reinforcement produces a self-sustaining circulation.
2. **Strong wind suppresses mills** in every experiment. It destroys an existing mill (E1), almost prevents new ones (E2: 10/40; E3: 0/40), and cuts rotating time. Physically, the advection length $v/\mu\approx8$ cells is larger than the structure of a trail, so the trail no longer lies where the ants walked.
3. **Weak wind makes a mill *episode* more likely.** Pooled over E2 and E3, 5 seeds lost a mill and 19 gained one ($p\approx0.007$). But those mills are smaller (radius ~15 vs ~23) and shorter-lived, and the total time spent rotating does not increase. **Wind gives more, briefer, smaller mills, not more milling.**
4. **The walls are a confound.** Without wind, mills of radius ~23 in a 100-cell arena touch a wall about 40% of the time; under wind this rises to 60–90%, as the colony is pushed against the downwind wall. The weak-wind increase therefore **cannot yet be attributed to the wind acting on trails** rather than to loops pinned against the wall.

**Answer to the question so far:** wind is mainly **destructive** to mills. The one hint of a favourable effect (weak wind) is real statistically, but it is entangled with the arena boundary.

---

## 7. Limitations

- **Agent-based, not the paper's PDEs.** A mill is not guaranteed to be stationary; there is run-to-run variance.
- **Constants** were chosen by reasoning plus parameter sweeps, not derived from the paper.
- **Small, closed arena.** Walls reflect ants, mills often touch them, and a steady wind drives everything downwind into a wall.
- **Numerical diffusion.** First-order upwind adds 5–24× the physical diffusion at the wind presets (§4.2).
- **Idealised wind.** It is uniform and passes through obstacles: no wake, no gusts.
- **No crowding.** Ants don't exclude each other (a cell can hold any number), and the minimum turning radius of 2 cells allows tight "balls" of circling ants smaller than real mills.
- **The detector is a calibrated heuristic.** It needs ≥ 15 participants and only partly detects mills of radius ≥ 20.

## 8. Suggested next steps

- **Remove the wall confound:** use periodic (wrap-around) boundaries, which requires the detector to unwrap positions, or an arena much larger than a mill. Then re-run E2 and E3.
- **Separate transport from smearing:** add a control with the same extra diffusion but no wind, or use a less diffusive second-order flux-limited scheme.
- **Perturb without net push:** use gusty or oscillating zero-mean wind, so trails are disrupted without the colony being blown into a wall.
- **Choose the baseline:** decide whether the ~80–90% no-wind mill rate is too high, and use `turnNoise` as the dial (0.3 gives ~50%).
- **Obstacles:** reintroduce them only after the neutral baseline is settled.

## 9. Reproducing the results

```
git checkout army-ant-movement
npm install
npm run movement -- --scenario ring   --runs 10                       # Test A
npm run movement -- --scenario random --runs 10 --ticks 3000          # Test B
npm run movement -- --scenario random --runs 10 --ticks 3000 \
  --sweep turnGain=0.5,1,2 --sweep turnNoise=0.05,0.1,0.2,0.3         # robustness
npm run experiment -- --scenario ring   --runs 20 --ticks 2000        # E1
npm run experiment -- --scenario random --runs 40 --ticks 3000        # E2
npm run experiment -- --scenario random --runs 40 --ticks 3000 --set turnNoise=0.3   # E3
npm run dev    # then open /?scenario=random and press 1–4 for the wind levels
```
