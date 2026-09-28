/*
 * Shared helpers for the headless runners: argument parsing, statistics and
 * loading the TypeScript simulation through Vite's SSR loader (no build step,
 * no extra dependencies).
 */
import { createServer } from "vite";

const args = process.argv.slice(2);

export const flag = (name) => args.includes(`--${name}`);

export function option(name, fallback) {
  const index = args.indexOf(`--${name}`);

  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
}

// every value of a repeatable option: --set a=1 --set b=2 → ["a=1", "b=2"]
export function options(name) {
  const values = [];

  args.forEach((arg, index) => {
    if (arg === `--${name}` && args[index + 1] !== undefined) {
      values.push(args[index + 1]);
    }
  });

  return values;
}

export function positiveInteger(name, value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`--${name} must be a positive integer, got "${value}"`);
  }

  return number;
}

export function oneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`unknown --${name} "${value}", expected one of: ${allowed.join(", ")}`);
  }

  return value;
}

/*
 * "turnGain=2" → ["turnGain", [2]]; "turnGain=1,2,4" → ["turnGain", [1, 2, 4]].
 * Keys must be AntRules settings.
 */
export function parseAssignment(text, defaults) {
  const [key, list] = text.split("=");

  if (!(key in defaults) || list === undefined) {
    throw new Error(
      `bad assignment "${text}", expected key=value with key one of: ${Object.keys(defaults).join(", ")}`,
    );
  }

  const values = list.split(",").map(Number);

  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(`bad number in "${text}"`);
  }

  return [key, values];
}

export function meanAndError(values) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  if (values.length < 2) {
    return { mean, error: 0 };
  }

  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);

  return { mean, error: Math.sqrt(variance / values.length) };
}

// intervalo de Wilson (95%) para uma proporção
export function wilson(successes, total) {
  const z = 1.96;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const half =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator;

  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export const format = ({ mean, error }, digits = 1) =>
  `${mean.toFixed(digits)} ± ${error.toFixed(digits)}`;

export function millCount(trials) {
  const mills = trials.filter((trial) => trial.millFormed).length;
  const [low, high] = wilson(mills, trials.length);

  return `${mills}/${trials.length} [${(100 * low).toFixed(0)}–${(100 * high).toFixed(0)}%]`;
}

// mean radius while rotating, over the runs that rotated at all
export function millRadius(trials) {
  const radii = trials.filter((t) => t.rotatingTicks > 0).map((t) => t.meanRotatingRadius);

  return radii.length > 0 ? format(meanAndError(radii)) : "—";
}

// share of rotating time with the mill touching a wall, over runs that rotated
export function wallMill(trials) {
  const shares = trials.filter((t) => t.rotatingTicks > 0).map((t) => 100 * t.wallMill);

  return shares.length > 0 ? format(meanAndError(shares)) : "—";
}

// runs `body` with the simulation module loaded, then shuts Vite down
export async function withSimulation(body) {
  const server = await createServer({
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    const experiment = await server.ssrLoadModule("/src/simulation/windExperiment.ts");
    const rules = await server.ssrLoadModule("/src/rules/antsRules.ts");

    await body({ ...experiment, ...rules });
  } finally {
    await server.close();
  }
}
