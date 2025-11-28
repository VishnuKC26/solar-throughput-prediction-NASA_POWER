import sys, json
from subprocess import run, PIPE
import argparse, os, pathlib

parser = argparse.ArgumentParser()
parser.add_argument('--lat', required=True)
parser.add_argument('--lon', required=True)
parser.add_argument('--area', required=True)
parser.add_argument('--eff', required=True)
args=parser.parse_args()

py = os.getenv('ML_PYTHON', sys.executable)
predict_script = str(pathlib.Path(__file__).resolve().parents[1] / 'ml' / 'predict.py')
proc = run([py, predict_script, '--lat', args.lat, '--lon', args.lon, '--area', args.area, '--eff', args.eff], stdout=PIPE, stderr=PIPE, encoding='utf8')
if proc.returncode == 0:
    print(proc.stdout)
    sys.exit(0)
else:
    print(proc.stderr, file=sys.stderr)
    sys.exit(proc.returncode)
