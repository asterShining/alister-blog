import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const validReleaseTypes = new Set(["patch", "minor", "major"]);

export function parseVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error(`Unsupported version "${version}". Expected stable SemVer x.y.z.`);
  return match.slice(1).map((part) => {
    const number = Number(part);
    if (!Number.isSafeInteger(number)) throw new Error(`Version component is too large: ${part}`);
    return number;
  });
}

export function bumpVersion(version, releaseType) {
  if (!validReleaseTypes.has(releaseType)) {
    throw new Error(`Unknown release type "${releaseType}". Choose patch, minor, or major.`);
  }
  const [major, minor, patch] = parseVersion(version);
  const next = releaseType === "major"
    ? [major + 1, 0, 0]
    : releaseType === "minor"
      ? [major, minor + 1, 0]
      : [major, minor, patch + 1];
  if (next.some((part) => !Number.isSafeInteger(part))) throw new Error("The next version component exceeds the safe integer range.");
  return next.join(".");
}

function command(program, args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(program, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${program} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`);
  }
  return { ...result, stdout: result.stdout?.trim() ?? "", stderr: result.stderr?.trim() ?? "" };
}

function outputValue(program, args) {
  return command(program, args, { capture: true }).stdout;
}

async function readPackage() {
  const source = await readFile(new URL("../package.json", import.meta.url), "utf8");
  const pkg = JSON.parse(source);
  return { source, pkg };
}

function ensureCleanTree() {
  const status = outputValue("git", ["status", "--porcelain", "--untracked-files=all"]);
  if (status) {
    throw new Error("Working tree must be clean. Commit, move, or remove your changes before releasing; no files were staged automatically.");
  }
}

function ensureBranchAndRemote() {
  const branch = outputValue("git", ["branch", "--show-current"]);
  if (branch !== "dev") throw new Error("Release must be started from dev.");
  ensureCleanTree();
  const remotes = outputValue("git", ["remote"]);
  if (!remotes.split(/\r?\n/).includes("origin")) throw new Error("Git remote 'origin' is required.");
  return branch;
}

function ensureGitHubCli() {
  command("gh", ["--version"]);
  command("gh", ["auth", "status"]);
}

function ensureReleaseHistory() {
  command("git", ["fetch", "origin"]);
  for (const ref of ["refs/remotes/origin/main", "refs/remotes/origin/dev"]) {
    const exists = command("git", ["show-ref", "--verify", "--quiet", ref], { allowFailure: true });
    if (exists.status !== 0) throw new Error(`Remote branch ${ref.replace("refs/remotes/", "")} was not found.`);
  }
  const mainIncluded = command("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], { allowFailure: true });
  if (mainIncluded.status !== 0) {
    throw new Error("dev does not include the latest origin/main. Run 'git merge origin/main', resolve it, then push dev before releasing.");
  }
  const remoteDevIncluded = command("git", ["merge-base", "--is-ancestor", "origin/dev", "HEAD"], { allowFailure: true });
  if (remoteDevIncluded.status !== 0) {
    throw new Error("Local dev is behind or diverged from origin/dev. Synchronize dev safely before releasing.");
  }
}

function replaceVersion(source, oldVersion, newVersion) {
  const versionLine = /("version"\s*:\s*")[^"]+("\s*,?)/g;
  let replacements = 0;
  const updated = source.replace(versionLine, (match, before, after) => {
    if (match.includes(`"${oldVersion}"`)) {
      replacements += 1;
      return `${before}${newVersion}${after}`;
    }
    return match;
  });
  if (replacements !== 1) throw new Error("Could not safely locate the root package version in package.json.");
  return updated;
}

async function validateRelease() {
  const checks = [
    ["pnpm", ["exec", "astro", "check"], "astro check"],
    ["pnpm", ["build"], "build"],
    ["pnpm", ["test:e2e:smoke"], "smoke E2E"],
  ];
  for (const [program, args, label] of checks) {
    console.log(`\nRunning ${label}...`);
    command(program, args);
    console.log(`✓ ${label}`);
  }
}

async function createOrReusePullRequest(version, releaseType) {
  const existingUrl = outputValue("gh", [
    "pr", "list", "--base", "main", "--head", "dev", "--state", "open", "--json", "url", "--jq", ".[0].url // \"\"",
  ]);
  let pullRequestUrl = existingUrl;
  if (pullRequestUrl) {
    console.log("Existing dev → main PR detected.");
  } else {
    const body = [
      `Alister Blog v${version}`,
      "",
      `Release type: ${releaseType}`,
      "",
      "Validation:",
      "- astro check",
      "- build",
      "- smoke E2E",
      "",
      "Production: https://alistereno.top",
    ].join("\n");
    pullRequestUrl = outputValue("gh", [
      "pr", "create", "--base", "main", "--head", "dev", "--title", `release: v${version}`, "--body", body,
    ]);
  }

  console.log(`\nPR: ${pullRequestUrl}`);
  const autoMerge = command("gh", ["pr", "merge", pullRequestUrl, "--auto", "--squash"], {
    capture: true,
    allowFailure: true,
  });
  if (autoMerge.status === 0) {
    console.log("Auto-merge enabled; GitHub will squash-merge after required checks pass.");
  } else {
    console.log("Auto-merge is unavailable or could not be enabled. Merge manually after CI passes.");
    if (autoMerge.stderr) console.log(autoMerge.stderr);
  }
  return pullRequestUrl;
}

export async function runRelease(args) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: pnpm release:<patch|minor|major> [-- --dry-run]");
    return;
  }
  const releaseType = args.find((arg) => !arg.startsWith("-"));
  const dryRun = args.includes("--dry-run");
  if (!validReleaseTypes.has(releaseType)) throw new Error("Choose a release type: patch, minor, or major.");

  console.log("Alister Blog Release\n");
  const branch = ensureBranchAndRemote();
  ensureGitHubCli();
  const { source, pkg } = await readPackage();
  const currentVersion = pkg.version;
  const nextVersion = bumpVersion(currentVersion, releaseType);

  console.log(`Current version: ${currentVersion}`);
  console.log(`Release type: ${releaseType}`);
  console.log(`New version: ${nextVersion}`);
  console.log(`Branch: ${branch}`);
  console.log("Remote: origin");

  if (dryRun) {
    console.log("\nDry run: no files, commits, branches, or remotes were changed.");
    return;
  }

  ensureReleaseHistory();
  await writeFile(new URL("../package.json", import.meta.url), replaceVersion(source, currentVersion, nextVersion));

  try {
    await validateRelease();
    const status = outputValue("git", ["status", "--porcelain", "--untracked-files=all"]);
    const expected = "M package.json";
    if (status !== expected) {
      throw new Error(`Validation changed files beyond package.json; refusing to stage or commit them. Current status:\n${status}`);
    }
    command("git", ["add", "--", "package.json"]);
    const staged = outputValue("git", ["diff", "--cached", "--name-only"]);
    if (staged !== "package.json") throw new Error("Staged release changes are not limited to package.json; refusing to commit.");
    command("git", ["commit", "-m", `chore(release): v${nextVersion}`]);
  } catch (error) {
    console.error(`\nRelease validation or commit failed. Version file remains modified at ${nextVersion}.`);
    console.error("Fix the issue or restore package.json manually; no hidden reset was performed.");
    throw error;
  }

  console.log("\nPushing dev...");
  command("git", ["push", "origin", "dev"]);
  console.log("\nCreating or reusing release PR...");
  await createOrReusePullRequest(nextVersion, releaseType);
  console.log("\nWaiting for CI / merge: GitHub");
  console.log("Production after merge: https://alistereno.top");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRelease(process.argv.slice(2)).catch((error) => {
    console.error(`Release stopped: ${error.message}`);
    process.exitCode = 1;
  });
}
