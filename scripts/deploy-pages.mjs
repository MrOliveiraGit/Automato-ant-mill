/*
 * Publishes the production build to the gh-pages branch (served by GitHub
 * Pages). Builds first, then commits dist/ on top of gh-pages through a
 * temporary git worktree, so the current branch and working tree are never
 * touched and no force-push is needed.
 *
 *   npm run deploy
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (command, args, cwd = process.cwd()) =>
  execFileSync(command, args, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();

const source = run("git", ["rev-parse", "--short", "HEAD"]);
const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);

run("npm", ["run", "build"]);

const worktree = mkdtempSync(join(tmpdir(), "automato-pages-"));

try {
  run("git", ["fetch", "origin", "gh-pages"], process.cwd());
  run("git", ["worktree", "add", "-B", "gh-pages", worktree, "origin/gh-pages"]);
} catch {
  // primeira publicação: gh-pages ainda não existe no GitHub
  rmSync(worktree, { recursive: true, force: true });
  run("git", ["worktree", "add", "--orphan", "-b", "gh-pages", worktree]);
}

try {
  for (const entry of readdirSync(worktree)) {
    if (entry !== ".git") {
      rmSync(join(worktree, entry), { recursive: true, force: true });
    }
  }

  cpSync("dist", worktree, { recursive: true });
  // sem isso o Jekyll do GitHub Pages ignoraria arquivos que começam com _
  writeFileSync(join(worktree, ".nojekyll"), "");

  run("git", ["add", "--all"], worktree);

  if (run("git", ["status", "--porcelain"], worktree) === "") {
    console.log("gh-pages is already up to date.");
  } else {
    run("git", ["commit", "-m", `Deploy ${branch} @ ${source}`], worktree);
    run("git", ["push", "origin", "gh-pages"], worktree);
    console.log(`Published ${branch} @ ${source} to gh-pages.`);
  }
} finally {
  run("git", ["worktree", "remove", "--force", worktree]);
}
