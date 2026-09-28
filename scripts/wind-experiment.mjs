/*
 * Runs the wind experiment headlessly: every wind preset × N runs, with run r
 * of every preset starting from the same seeded initial condition.
 *
 *   npm run experiment -- --runs 20 --ticks 2000 --seed 1 --layout gap \
 *     [--scenario trails] [--set turnGain=2] [--json]
 *
 * The TypeScript simulation is loaded through Vite's SSR loader, so this
 * needs no extra dependencies or build step.
 */
import {
  flag,
  format,
  meanAndError,
  millCount,
  oneOf,
  option,
  options,
  parseAssignment,
  positiveInteger,
  withSimulation,
} from "./common.mjs";

await withSimulation(
  async ({ WIND_EXPERIMENT, OBSTACLE_LAYOUTS, SCENARIOS, DEFAULT_ANT_RULES, runWindExperiment }) => {
    const runs = positiveInteger("runs", option("runs", 10));
    const ticks = positiveInteger("ticks", option("ticks", WIND_EXPERIMENT.ticksPerRun));
    const seed = Number(option("seed", WIND_EXPERIMENT.seed));
    const layout = oneOf("layout", option("layout", WIND_EXPERIMENT.layout), Object.keys(OBSTACLE_LAYOUTS));
    const scenario = oneOf("scenario", option("scenario", "trails"), SCENARIOS);

    const rules = Object.fromEntries(
      options("set").map((text) => {
        const [key, [value]] = parseAssignment(text, DEFAULT_ANT_RULES);
        return [key, value];
      }),
    );

    const results = runWindExperiment({
      scenario,
      runs,
      ticks,
      seed,
      layout,
      rules,
      onTrial: (trial, preset) =>
        process.stderr.write(
          `${preset.padEnd(9)} seed ${trial.seed}: ${trial.millFormed ? "mill" : "no mill"}\n`,
        ),
    });

    if (flag("json")) {
      console.log(JSON.stringify({ scenario, runs, ticks, seed, layout, rules, results }, null, 2));
      return;
    }

    console.log(
      `\nscenario "${scenario}", wind direction (${WIND_EXPERIMENT.windDirection.join(", ")}), layout "${layout}", ` +
        `${runs} runs × ${ticks} ticks, seeds ${seed}–${seed + runs - 1} (same seeds for every wind)\n` +
        `rule overrides: ${JSON.stringify(rules)}\n` +
        `"mill" = an episode with ≥ ${WIND_EXPERIMENT.minRotations} full rotation(s); ` +
        `other columns are mean ± standard error over runs\n`,
    );

    console.table(
      results.map(({ preset, trials }) => ({
        wind: preset.name,
        strength: preset.strength,
        mills: millCount(trials),
        "rotating % ticks": format(meanAndError(trials.map((t) => (100 * t.rotatingTicks) / t.ticks))),
        "longest episode": format(meanAndError(trials.map((t) => t.longestEpisodeTicks))),
        "max rotations": format(meanAndError(trials.map((t) => t.maxEpisodeRotations)), 2),
        "% ants near walls": format(meanAndError(trials.map((t) => 100 * t.meanNearWall))),
        "pheromone min/max": `${Math.min(...trials.map((t) => t.minPheromone)).toFixed(2)} / ${Math.max(...trials.map((t) => t.maxPheromone)).toFixed(1)}`,
      })),
    );
  },
);
