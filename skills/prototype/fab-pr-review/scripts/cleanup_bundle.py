#!/usr/bin/env python3
"""Delete one fab Code Review temporary bundle."""
from __future__ import annotations

import argparse
import os
import shutil
import stat
from pathlib import Path


def _force_remove(func, path, exc_info):
    # Windows: git pack files are read-only; clear the attribute so the
    # unlink can proceed. Without this, cleanup of a cloned bundle fails.
    os.chmod(path, stat.S_IWRITE)
    func(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    args = parser.parse_args()
    bundle = args.bundle.expanduser().resolve()
    if bundle.exists():
        shutil.rmtree(bundle, onerror=_force_remove)
    print(f"CLEANED={bundle}")


if __name__ == "__main__":
    main()
