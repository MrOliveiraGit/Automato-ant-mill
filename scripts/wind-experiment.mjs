/*
 * Runs the wind experiment headlessly: every wind preset × N runs, with run r
 * of every preset starting from the same seeded initial condition.
 *
 *   npm run experiment -- --runs 20 --ticks 2000 --seed 1 --layout gap [--json]
 *
 * The TypeScript simulation is loaded through Vite's SSR loader, so this
 * needs no extra dependencies or build step.
 */
import { createServer } from "vite";

const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(`--${name}`);

  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
}

function positiveInteger(name, value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`--${name} must be a positive integer, got "${value}"`);
  }

  return number;
}

function meanAndError(values) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  if (values.length < 2) {
    return { mean, error: 0 };
  }

  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);

  return { mean, error: Math.sqrt(variance / values.length) };
}

// intervalo de Wilson (95%) para a proporção de corridas que formaram mill
function wilson(successes, total) {
  const z = 1.96;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const half =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator;

  return [Math.max(0, center - half), Math.min(1, center + half)];
}

const format = ({ mean, error }, digits = 1) => `${mean.toFixed(digits)} ± ${error.toFixed(digits)}`;

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const { WIND_EXPERIMENT, OBSTACLE_LAYOUTS, runWindExperiment } = await server.ssrLoadModule(
    "/src/simulation/windExperiment.ts",
  );

  const runs = positiveInteger("runs", option("runs", 10));
  const ticks = positiveInteger("ticks", option("ticks", WIND_EXPERIMENT.ticksPerRun));
  const seed = Number(option("seed", WIND_EXPERIMENT.seed));
  const layout = option("layout", WIND_EXPERIMENT.layout);

  if (!(layout in OBSTACLE_LAYOUTS)) {
    throw new Error(
      `unknown --layout "${layout}", expected one of: ${Object.keys(OBSTACLE_LAYOUTS).join(", ")}`,
    );
  }

  const results = runWindExperiment({
    runs,
    ticks,
    seed,
    layout,
    onTrial: (trial, preset) =>
      process.stderr.write(
        `${preset.padEnd(9)} seed ${trial.seed}: ${trial.millFormed ? "mill" : "no mill"}\n`,
      ),
  });

  if (args.includes("--json")) {
    console.log(JSON.stringify({ runs, ticks, seed, layout, results }, null, 2));
  } else {
    console.log(
      `\nwind direction (${WIND_EXPERIMENT.windDirection.join(", ")}), layout "${layout}", ` +
        `${runs} runs × ${ticks} ticks, seeds ${seed}–${seed + runs - 1} (same seeds for every wind)\n` +
        `"mill" = an episode with ≥ ${WIND_EXPERIMENT.minRotations} full rotation(s); ` +
        `other columns are mean ± standard error over runs\n`,
    );

    console.table(
      results.map(({ preset, trials }) => {
        const mills = trials.filter((trial) => trial.millFormed).length;
        const [low, high] = wilson(mills, trials.length);

        return {
          wind: preset.name,
          strength: preset.strength,
          mills: `${mills}/${trials.length} [${(100 * low).toFixed(0)}–${(100 * high).toFixed(0)}%]`,
          "rotating % ticks": format(
            meanAndError(trials.map((t) => (100 * t.rotatingTicks) / t.ticks)),
          ),
          "longest episode": format(meanAndError(trials.map((t) => t.longestEpisodeTicks))),
          "max rotations": format(
            meanAndError(trials.map((t) => t.maxEpisodeRotations)),
            2,
          ),
          "% ants near walls": format(meanAndError(trials.map((t) => 100 * t.meanNearWall))),
          "pheromone min/max": `${Math.min(...trials.map((t) => t.minPheromone)).toFixed(2)} / ${Math.max(...trials.map((t) => t.maxPheromone)).toFixed(1)}`,
        };
      }),
    );
  }
} finally {
  await server.close();
}
