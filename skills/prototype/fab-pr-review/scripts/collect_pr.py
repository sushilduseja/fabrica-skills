#!/usr/bin/env python3
"""Collect a deterministic GitHub PR review bundle using gh and git."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PR_RE = re.compile(r"^https://github\.com/([^/]+)/([^/]+)/pull/(\d+)(?:/.*)?$")
SECURITY_PATH_RE = re.compile(
    r"(auth|authoriz|permission|middleware|security|token|secret|deserialize|"
    r"exec|shell|sql|query|crypto|password|session)", re.IGNORECASE
)
SECURITY_CONTENT_RE = re.compile(
    r"(authorization|authentication|jwt|oauth|token|secret|password|deserialize|"
    r"exec\(|system\(|shell|sql|raw_query|eval\(|permission|role|acl|idor)",
    re.IGNORECASE,
)


def run(
    cmd: list[str],
    cwd: Path | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=cwd,
        text=True,
        capture_output=True,
        check=check,
        shell=False,
    )


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(2)


def require(binary: str) -> None:
    if shutil.which(binary) is None:
        fail(f"required command not found: {binary}")


def validate_pr_url(pr_url: str) -> tuple[str, str, int]:
    match = PR_RE.fullmatch(pr_url.strip())
    if not match:
        fail(
            "GitHub.com PR URL required, for example: "
            "https://github.com/owner/repo/pull/123"
        )
    owner, repo, number = match.group(1), match.group(2), int(match.group(3))
    return owner, repo, number


def gh_json(pr_url: str, fields: str) -> dict:
    proc = run(["gh", "pr", "view", pr_url, "--json", fields], check=False)
    if proc.returncode != 0:
        details = (proc.stderr or proc.stdout or "no error output").strip()
        fail(
            "gh could not fetch the pull request.\n"
            f"gh output: {details}\n"
            "Action: confirm you are logged in (`gh auth login`), that your account "
            "has access to the repository, or export GH_TOKEN for an account that does."
        )
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        fail(f"could not parse gh pr view JSON: {exc}")


def get_output_bundle(output: str) -> Path:
    if output:
        bundle = Path(output).expanduser().resolve()
        if bundle.exists():
            fail(
                f"output directory already exists: {bundle}. "
                "Refusing to reuse an existing review bundle."
            )
        bundle.mkdir(parents=True)
        return bundle
    return Path(tempfile.mkdtemp(prefix="fab-code-review-"))


def cleanup_bundle(bundle: Path) -> None:
    shutil.rmtree(bundle, ignore_errors=True)


def determine_security_relevance(changed_files: list[str], diff: str) -> bool:
    if any(SECURITY_PATH_RE.search(path) for path in changed_files):
        return True
    return bool(SECURITY_CONTENT_RE.search(diff))


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect a GitHub PR review bundle")
    parser.add_argument("--url", required=True, help="GitHub.com pull request URL")
    parser.add_argument("--context", default="", help="Optional free-form intent context")
    parser.add_argument("--output", default="", help="Optional unique output directory")
    args = parser.parse_args()

    require("gh")
    require("git")

    auth = run(["gh", "auth", "status"], check=False)
    if auth.returncode != 0:
        fail(
            "GitHub CLI authentication is unavailable. "
            "Run `gh auth login` and make sure the repository is accessible."
        )

    pr_url = args.url.strip()
    owner, repo, number = validate_pr_url(pr_url)
    bundle = get_output_bundle(args.output)

    try:
        fields = (
            "number,title,body,url,state,isDraft,author,baseRefName,baseRefOid,"
            "headRefName,headRefOid,headRepository,headRepositoryOwner,additions,"
            "deletions,changedFiles,files,commits,closingIssuesReferences,mergeable,"
            "reviewDecision,statusCheckRollup,isCrossRepository"
        )
        metadata = gh_json(pr_url, fields)

        context = args.context.strip()
        (bundle / "context.md").write_text(
            (context + "\n") if context else "No user supplied context.\n",
            encoding="utf-8",
        )

        base_sha = metadata.get("baseRefOid")
        head_sha = metadata.get("headRefOid")
        base_branch = metadata.get("baseRefName")
        if not base_sha or not head_sha:
            fail("PR metadata did not include base/head SHAs")
        if not base_branch:
            fail("PR metadata did not include the base branch")

        repo_url = f"https://github.com/{owner}/{repo}.git"
        repo_dir = bundle / "repo"
        run(
            ["git", "clone", "--filter=blob:none", "--no-checkout", repo_url, str(repo_dir)]
        )

        fetch = run(
            [
                "git", "fetch", "--no-tags", "origin", base_branch,
                f"+refs/pull/{number}/head:refs/remotes/origin/fab-pr-head",
            ],
            cwd=repo_dir,
            check=False,
        )
        if fetch.returncode != 0:
            details = (fetch.stderr or fetch.stdout).strip()
            fail(f"could not fetch base/PR commits from the base repository: {details}")

        for sha, label in ((base_sha, "base"), (head_sha, "head")):
            check = run(["git", "cat-file", "-e", f"{sha}^{{commit}}"], cwd=repo_dir, check=False)
            if check.returncode != 0:
                fail(f"{label} commit {sha} is not available in the local checkout")

        run(["git", "checkout", "--detach", head_sha], cwd=repo_dir)

        diff = run(
            [
                "git", "diff", "--no-ext-diff", "--find-renames",
                f"{base_sha}...{head_sha}", "--",
            ],
            cwd=repo_dir,
        ).stdout
        (bundle / "pr.diff").write_text(diff, encoding="utf-8")

        changed = run(
            ["git", "diff", "--name-only", f"{base_sha}...{head_sha}", "--"],
            cwd=repo_dir,
        ).stdout
        changed_files = [line.strip() for line in changed.splitlines() if line.strip()]
        (bundle / "changed-files.txt").write_text(
            "\n".join(changed_files) + ("\n" if changed_files else ""),
            encoding="utf-8",
        )

        security_relevant = determine_security_relevance(changed_files, diff)
        metadata["security_relevant"] = security_relevant
        metadata["collection"] = {
            "source_repository": f"https://github.com/{owner}/{repo}",
            "diff_source": "local_git_diff_three_dot",
            "pr_ref": f"refs/pull/{number}/head",
            "security_heuristic": "path_or_diff_keyword",
            "limitations": [
                "GitHub.com URLs only for v1.1",
                "security_relevant=false means heuristic did not trigger, not that security was verified",
                "cross-repository consumers are outside the review boundary",
            ],
        }
        write_json(bundle / "metadata.json", metadata)

        checks = run(
            ["gh", "pr", "checks", pr_url, "--json", "name,state,bucket,link"],
            check=False,
        )
        checks_stdout = checks.stdout.strip()
        if checks_stdout:
            # gh pr checks can return a non-zero status for pending checks;
            # JSON output is still usable review evidence in that case.
            try:
                json.loads(checks_stdout)
            except json.JSONDecodeError:
                checks_status = "fetch_failed"
                checks_data = "[]\n"
            else:
                checks_status = "fetched"
                checks_data = checks_stdout + "\n"
        elif checks.returncode == 0:
            checks_status = "no_checks_configured"
            checks_data = "[]\n"
        else:
            stderr = (checks.stderr or "").lower()
            if "no checks" in stderr or "no checks reported" in stderr:
                checks_status = "no_checks_configured"
                checks_data = "[]\n"
            else:
                checks_status = "fetch_failed"
                checks_data = "[]\n"
        (bundle / "checks.json").write_text(checks_data, encoding="utf-8")
        (bundle / "checks-status.txt").write_text(checks_status + "\n", encoding="utf-8")

        summary = "\n".join(
            [
                f"PR: {metadata.get('url', pr_url)}",
                f"Title: {metadata.get('title', '')}",
                f"State: {metadata.get('state', '')}",
                f"Draft: {metadata.get('isDraft', '')}",
                f"Base: {base_branch} @ {base_sha}",
                f"Head: {metadata.get('headRefName', '')} @ {head_sha}",
                f"Cross repository: {metadata.get('isCrossRepository', '')}",
                f"Security relevant: {str(security_relevant).lower()}",
                f"CI status: {checks_status}",
                f"Changed files: {len(changed_files)}",
                f"Additions: {metadata.get('additions')}",
                f"Deletions: {metadata.get('deletions')}",
            ]
        )
        if context:
            summary += "\n\nUser supplied intent context:\n" + context
        (bundle / "snapshot.md").write_text(summary + "\n", encoding="utf-8")

        print(f"BUNDLE_DIR={bundle}")
        print(f"PR_URL={pr_url}")
        print(f"HEAD_SHA={head_sha}")
        print(f"BASE_SHA={base_sha}")
        print(f"SECURITY_RELEVANT={str(security_relevant).lower()}")
        print(f"CHECKS_STATUS={checks_status}")
    except subprocess.CalledProcessError as exc:
        cleanup_bundle(bundle)
        details = (exc.stderr or exc.stdout or "").strip()
        fail(
            f"command failed: {' '.join(exc.cmd)}"
            + (f"\n{details}" if details else "")
        )
    except BaseException:
        cleanup_bundle(bundle)
        raise


if __name__ == "__main__":
    main()
