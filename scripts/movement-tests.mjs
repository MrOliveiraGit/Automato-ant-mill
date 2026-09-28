/*
 * Tests the base movement in a neutral arena (no wind unless --wind is given,
 * no obstacles unless --layout is given), optionally sweeping AntRules
 * settings. Every combination runs the same seeds, so rows are paired.
 *
 *   Test A — can the rules sustain a ready-made mill?
 *     npm run movement -- --scenario ring --runs 10 --sweep turnGain=0.5,1,2
 *
 *   Test B — does a mill emerge on its own?
 *     npm run movement -- --scenario column --runs 20 --ticks 3000
 *     npm run movement -- --scenario random --runs 20 --ticks 3000
 *
 *   --set key=value      fix an AntRules setting (repeatable)
 *   --sweep key=v1,v2    sweep an AntRules setting (repeatable → cartesian grid)
 *   --wind S             wind strength (default 0)
 *   --json               raw results instead of the table
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

function cartesian(sweeps) {
  return sweeps.reduce(
    (combos, [key, values]) =>
      combos.flatMap((combo) => values.map((value) => ({ ...combo, [key]: value }))),
    [{}],
  );
}

await withSimulation(
  async ({ WIND_EXPERIMENT, OBSTACLE_LAYOUTS, SCENARIOS, DEFAULT_ANT_RULES, runTrial }) => {
    const scenario = oneOf("scenario", option("scenario", "random"), SCENARIOS);
    const runs = positiveInteger("runs", option("runs", 10));
    const ticks = positiveInteger("ticks", option("ticks", WIND_EXPERIMENT.ticksPerRun));
    const seed = Number(option("seed", WIND_EXPERIMENT.seed));
    const layout = oneOf("layout", option("layout", "none"), Object.keys(OBSTACLE_LAYOUTS));
    const windStrength = Number(option("wind", 0));

    const fixed = Object.fromEntries(
      options("set").map((text) => {
        const [key, [value]] = parseAssignment(text, DEFAULT_ANT_RULES);
        return [key, value];
      }),
    );

    const sweeps = options("sweep").map((text) => parseAssignment(text, DEFAULT_ANT_RULES));
    const combos = cartesian(sweeps);

    const results = combos.map((combo) => {
      const rules = { ...fixed, ...combo };
      const trials = [];

      for (let run = 0; run < runs; run++) {
        const trial = runTrial({
          scenario,
          windStrength,
          seed: seed + run,
          ticks,
          layout,
          rules,
        });

        trials.push(trial);
        process.stderr.write(
          `${JSON.stringify(combo)} seed ${trial.seed}: ${trial.millFormed ? "mill" : "no mill"}\n`,
        );
      }

      return { combo, rules, trials };
    });

    if (flag("json")) {
      console.log(
        JSON.stringify({ scenario, runs, ticks, seed, layout, windStrength, fixed, results }, null, 2),
      );
      return;
    }

    console.log(
      `\nscenario "${scenario}", layout "${layout}", wind ${windStrength}, ` +
        `${runs} runs × ${ticks} ticks, seeds ${seed}–${seed + runs - 1}\n` +
        `settings: ${JSON.stringify({ ...DEFAULT_ANT_RULES, ...fixed })}\n` +
        `"mill" = an episode with ≥ ${WIND_EXPERIMENT.minRotations} full rotation(s); ` +
        `"late" = last quarter of the run; other columns are mean ± standard error\n`,
    );

    console.table(
      results.map(({ combo, trials }) => {
        const first = trials.map((t) => t.firstRotatingTick).filter((t) => t !== null);

        return {
          ...combo,
          mills: millCount(trials),
          "first rotating tick": first.length > 0 ? format(meanAndError(first), 0) : "—",
          "rotating % ticks": format(meanAndError(trials.map((t) => (100 * t.rotatingTicks) / t.ticks))),
          "late rotating %": format(meanAndError(trials.map((t) => 100 * t.lateRotating))),
          "max rotations": format(meanAndError(trials.map((t) => t.maxEpisodeRotations)), 1),
          "max looping ants": format(meanAndError(trials.map((t) => t.maxParticipants)), 0),
          "late following %": format(meanAndError(trials.map((t) => 100 * t.following))),
          "late crowded %": format(meanAndError(trials.map((t) => 100 * t.crowded))),
          "% near walls": format(meanAndError(trials.map((t) => 100 * t.meanNearWall))),
        };
      }),
    );
  },
);
