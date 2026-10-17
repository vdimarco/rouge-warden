from pathlib import Path
import subprocess,sys
plan=Path(__file__).resolve().parent
for mode in ('author','verify'):
 subprocess.run([sys.executable,'-B',str(plan/'run_native_trial.py'),mode],check=True,timeout=420)
