#!/usr/bin/env python3
"""One entry point for 2.3.1 regressions. Full mode requires Chromium + Xvfb.
  python tests/verify.py --simulation-only
  xvfb-run -a python tests/verify.py
A policy-blocked file:// navigation is recorded as BLOCKED, never as PASS.
"""
from pathlib import Path
import subprocess,sys
ROOT=Path(__file__).resolve().parents[1]
args=sys.argv[1:]
commands=[[sys.executable,'tests/verify_base.py',*args],['node','tests/starform_checks.js']]
if '--simulation-only' not in args:commands.append([sys.executable,'tests/starform_browser.py'])
failed=False
for cmd in commands:
    result=subprocess.run(cmd,cwd=ROOT)
    failed=failed or result.returncode!=0
raise SystemExit(1 if failed else 0)
