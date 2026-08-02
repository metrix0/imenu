import { spawnSync } from "node:child_process";

const message = process.argv.slice(2).join(" ").trim();

if (!message) {
    console.error('Usage: npm run commit -- "commit message"');
    process.exit(1);
}

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        stdio: "inherit",
        shell: false,
        ...options,
    });

    if (result.error) {
        console.error(`Failed to run ${command}:`, result.error.message);
        process.exit(1);
    }

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }

    return result;
}

function capture(command, args) {
    const result = spawnSync(command, args, {
        encoding: "utf8",
        shell: false,
    });

    if (result.error) {
        console.error(`Failed to run ${command}:`, result.error.message);
        process.exit(1);
    }

    return result;
}

run("git", ["add", "."]);

const stagedChanges = capture("git", ["diff", "--cached", "--quiet"]);
if (stagedChanges.status === 0) {
    console.log("No changes to commit.");
    process.exit(0);
}
if (stagedChanges.status !== 1) {
    process.exit(stagedChanges.status ?? 1);
}

run("git", ["commit", "-m", message]);

const branchResult = capture("git", ["branch", "--show-current"]);
if (branchResult.status !== 0) {
    process.stderr.write(branchResult.stderr || "Unable to determine current branch.\n");
    process.exit(branchResult.status ?? 1);
}

const branch = branchResult.stdout.trim();
if (!branch) {
    console.error("Cannot push from a detached HEAD.");
    process.exit(1);
}

const upstreamResult = capture("git", [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{u}",
]);

if (upstreamResult.status === 0) {
    run("git", ["push"]);
} else {
    run("git", ["push", "--set-upstream", "origin", branch]);
}
