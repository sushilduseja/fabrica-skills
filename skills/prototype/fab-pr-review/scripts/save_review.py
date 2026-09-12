#!/usr/bin/env python3
"""Save a completed fab review report to disk, outside the managed install
directory so it survives `update`'s atomic staging swap."""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--core-dir", required=True, help="Path substituted for __fab_CORE_DIR__")
    parser.add_argument("--owner", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--number", required=True, type=int)
    args = parser.parse_args()

    report = sys.stdin.read()
    if not report.strip():
        print("ERROR: no report content received on stdin", file=sys.stderr)
        return 2

    install_dir = Path(args.core_dir).expanduser().resolve().parent
    reviews_dir = install_dir.parent / f"{install_dir.name}-reviews"
    reviews_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"{args.owner}-{args.repo}-{args.number}-{timestamp}.md"
    target = reviews_dir / filename
    target.write_text(report, encoding="utf-8")

    print(f"SAVED_REVIEW={target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
