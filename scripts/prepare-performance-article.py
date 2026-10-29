#!/usr/bin/env python3
"""Build article data and a portable reproduction bundle from finalized benchmark evidence."""
import argparse
import csv
import datetime
import hashlib
import io
import json
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('evidence_parent', type=Path)
args = parser.parse_args()
site = Path(__file__).resolve().parent.parent
output = site/'static/data/framework-performance'
output.mkdir(parents=True, exist_ok=True)
roots = {
    'headtohead': args.evidence_parent/'stroppy-tpcc-headtohead-20261028',
    'no-reuse': args.evidence_parent/'stroppy-gotpc-noreuse-20261028',
    'client-efficiency': args.evidence_parent/'stroppy-client-efficiency-20261029',
}
load = lambda path: json.loads(path.read_text())
head = load(roots['headtohead']/'summaries/results.json')
followup = load(roots['no-reuse']/'summaries/results.json')
efficiency = load(roots['client-efficiency']/'summaries/results.json')
assert head['status'] == followup['status'] == efficiency['status'] == 'complete'
cases = []
runtime = []
selected = {}
for campaign, root in roots.items():
    directory = root/('runs/bm1' if campaign == 'headtohead' else 'remote/bm1/runs')
    paths = []
    for path in sorted(directory.glob('*/summary.json')):
        summary = load(path)
        if campaign == 'headtohead' and summary.get('repetition', 0) == 0:
            continue
        paths.append(path.parent)
        meta = load(path.parent/'meta.json')
        spec = load(path.parent/'spec.json')
        assert summary['valid'] and meta['exit_code'] == 0
        tool = spec.get('tool', spec.get('engine'))
        cases.append({'campaign': campaign, 'id': spec['id'], 'tool': tool, 'family': summary.get('family', 'go-tpc'), 'placement': summary.get('placement', 'local'), 'repetition': spec.get('repetition'), 'client_cores': spec.get('client_cores', 8), 'new_orders_per_second': summary['new_orders_per_second'], 'seconds': summary['actual_measurement_seconds'], 'client_cpu_us_per_order': summary.get('client_cpu_microseconds_per_new_order'), 'new_orders_per_client_cpu_second': summary.get('new_orders_per_client_cpu_second'), 'client_utilization': summary.get('client_core_utilization_fraction'), 'boundary': load(path.parent/'completion-classification.json') if (path.parent/'completion-classification.json').exists() else None})
        samples = [json.loads(line) for line in (path.parent/'monitor/samples.jsonl').read_text().splitlines()]
        samples = [row for row in samples if 'new_orders' in row and 'mysql' in row]
        points = []
        for before, after in zip(samples, samples[1:]):
            elapsed = datetime.datetime.fromisoformat(after['utc']).timestamp()-meta['started_epoch']
            seconds = after['monotonic']-before['monotonic']
            if elapsed < 0 or seconds <= 0:
                continue
            point = {'seconds': round(elapsed, 3), 'new_orders_per_second': round((after['new_orders']-before['new_orders'])/seconds, 3)}
            for key, name in [('client.pid', 'client_cpu_percent'), ('mysql.pid', 'database_cpu_percent')]:
                if before.get(key) and after.get(key) and before[key]['pid'] == after[key]['pid']:
                    ticks = sum(after[key][field]-before[key][field] for field in ['utime_ticks', 'stime_ticks'])
                    point[name] = round(100*ticks/after.get('clock_ticks_per_second', 100)/seconds, 3)
            points.append(point)
        client_samples = path.parent/'client-monitor/samples.jsonl'
        if client_samples.exists():
            client_rows = [json.loads(line) for line in client_samples.read_text().splitlines()]
            for before, after in zip(client_rows, client_rows[1:]):
                if not before.get('client.pid') or not after.get('client.pid') or before['client.pid']['pid'] != after['client.pid']['pid']:
                    continue
                seconds = after['monotonic']-before['monotonic']
                elapsed = datetime.datetime.fromisoformat(after['utc']).timestamp()-meta['started_epoch']
                if seconds <= 0 or elapsed < 0 or not points:
                    continue
                target = min(points, key=lambda point: abs(point['seconds']-elapsed))
                if abs(target['seconds']-elapsed) < 3:
                    ticks = sum(after['client.pid'][field]-before['client.pid'][field] for field in ['utime_ticks', 'stime_ticks'])
                    target['client_cpu_percent'] = round(100*ticks/after.get('clock_ticks_per_second', 100)/seconds, 3)
        runtime.append({'campaign': campaign, 'id': spec['id'], 'tool': tool, 'family': summary.get('family', 'go-tpc'), 'placement': summary.get('placement', 'local'), 'repetition': spec.get('repetition'), 'cores': spec.get('client_cores', 8), 'warmup': spec['warmup_seconds'], 'measurement': spec['measurement_seconds'], 'points': points})
    selected[campaign] = paths
assert len(cases) == 27
archives = {name: load(root.with_name(root.name+'-archive-verification.json')) for name, root in roots.items()}
data = {'headtohead': head, 'noReuse': followup, 'efficiency': efficiency, 'cases': cases, 'runtime': runtime, 'archives': archives}
(output/'results.json').write_text(json.dumps(data, indent=2)+'\n')
with (output/'cases.csv').open('w') as stream:
    fields = [key for key in cases[0] if key != 'boundary']
    writer = csv.DictWriter(stream, fields, lineterminator='\n')
    writer.writeheader()
    writer.writerows({key: row[key] for key in fields} for row in cases)

bundle_readme = '''# Stroppy / HammerDB / go-tpc reproduction files

All 27 measured invocations from three completed campaigns. This is evidence, not a database backup. No binaries or private SSH keys are included.

- `headtohead/`: 16 original/SDK cases, SF1000, local TCP and private LAN, two reversed-order repetitions, 5m warm-up + 10m planned measurement.
- `no-reuse/`: four additional native go-tpc cases without reusable statement handles. Earlier original/SDK rows are historical controls, not interleaved reruns.
- `client-efficiency/`: seven fresh low-core/control cases, 1/2 client cores plus one 8-core native control, 60s + 120s.

Each campaign contains exact specifications, effective MySQL settings, schema/routines, per-case command/environment/timing, stdout/stderr, raw samples, unchanged SDK reports where available, reset manifests, deadline classifiers, result CSV/JSON and verification receipts. Selected failed smokes/classification backups remain. Large pidstat/iostat logs, extracted dependency trees and executables are excluded; the original verified full-archive receipts identify them.

`recompute.py` reads raw samples and checks all 27 committed New-Order rates and the CPU costs in the seven efficiency cases. Run `python3 -I recompute.py` from this directory. It does not connect to a database or write to the original evidence.

To repeat the experiment, start on independent hosts and empty isolated paths. Use the pinned source/artifact identities in the article, `configs/mysql.cnf`, the exact CLI commands in each `meta.json`, the recorded physical-core allocations and each original tool's loader. Validate each original family population, make a complete stopped-server datadir template, and restore it before every invocation. The main suite used 16 loader workers and no full expensive go-tpc correlated SF1000 checks; exact counts and bounded per-district invariants are recorded. Use the recorded warm-up/measurement/order; do not compare native full-run tpmC with the external post-warm-up counter rate.

WARNING: included remote scripts are historical run records with absolute paths, service transitions, benchmark-only `bench` credentials and destructive working-copy restoration. Do not run them unchanged on existing infrastructure. Review destinations, preserve original service/config state, confine writes to new paths, and keep database accounts private. Do not rerun provisioning or loaders against preserved databases. Database files stay on the benchmark servers, not in this bundle.

No claim of audited TPC-C compliance. Unpaced 32-client/SF1000 runs omit strict terminal requirements. Deadline cancellations and SDK connection-close errors remain retained; valid measured windows are not error-free full runs. One low-core invocation per setting and two main repetitions do not establish statistical significance.

Licenses: upstream go-tpc and Stroppy are Apache-2.0; the HammerDB-derived module/procedure source is GPL-3.0. Original notices accompany included source where applicable. See project source links in the article before redistributing binaries.
'''
recompute = '''#!/usr/bin/env python3
"""Verify rates and efficiency costs against the bundled raw counter windows."""
import datetime
import json
import math
from pathlib import Path
root = Path(__file__).resolve().parent
count = 0
for campaign in ['headtohead', 'no-reuse', 'client-efficiency']:
    for path in sorted((root/campaign/'runs').glob('*/summary.json')):
        summary = json.loads(path.read_text())
        meta = json.loads((path.parent/'meta.json').read_text())
        spec = json.loads((path.parent/'spec.json').read_text())
        rows = [json.loads(line) for line in (path.parent/'monitor/samples.jsonl').read_text().splitlines()]
        measured = [row for row in rows if 'mysql' in row and 'new_orders' in row and spec['warmup_seconds'] <= datetime.datetime.fromisoformat(row['utc']).timestamp()-meta['started_epoch'] <= spec['warmup_seconds']+spec['measurement_seconds']]
        first, last = measured[0], measured[-1]
        seconds = last['monotonic']-first['monotonic']
        orders = last['new_orders']-first['new_orders']
        assert orders == summary['committed_new_orders']
        assert math.isclose(orders/seconds, summary['new_orders_per_second'], rel_tol=1e-12), path
        if campaign == 'client-efficiency':
            for key, label in [('client.pid','client'), ('mysql.pid','database')]:
                ticks = sum(last[key][field]-first[key][field] for field in ['utime_ticks','stime_ticks'])
                cpu = ticks/last['clock_ticks_per_second']
                assert math.isclose(cpu, summary[label+'_cpu_seconds'], rel_tol=1e-12), path
        count += 1
assert count == 27
print(f'Verified {count} raw measurement windows and seven client/database CPU-cost pairs.')
'''
files = {}
for campaign, root in roots.items():
    for folder in ['configs', 'specs', 'manifests', 'scripts']:
        for path in sorted((root/folder).rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.name not in ['transport-known-hosts']:
                files[campaign+'/'+str(path.relative_to(root))] = path
    for name in ['README.md','STATUS.md']:
        files[campaign+'/'+name] = root/name
    for path in (root/'summaries').glob('*'):
        if path.is_file() and path.suffix in ['.json','.csv','.md'] and path.name != 'evidence-manifest.json':
            files[campaign+'/summaries/'+path.name] = path
    for directory in selected[campaign]:
        for name in ['spec.json','meta.json','report.json','summary.json','completion-classification.json','statement-counters.json','stdout.log','stderr.log','meta-before-boundary-classification.json','before-server-deadline-meta.json','before-server-deadline-completion-classification.json']:
            path = directory/name
            if path.is_file():
                files[campaign+'/runs/'+directory.name+'/'+name] = path
        files[campaign+'/runs/'+directory.name+'/monitor/samples.jsonl'] = directory/'monitor/samples.jsonl'
        client_samples = directory/'client-monitor/samples.jsonl'
        if client_samples.exists():
            files[campaign+'/runs/'+directory.name+'/client-monitor/samples.jsonl'] = client_samples
        remote = root/'remote/bm1'
        for path in (remote/'restores'/directory.name).glob('*'):
            if path.is_file():
                files[campaign+'/restores/'+directory.name+'/'+path.name] = path
    for folder in ['inventory','cleanup']:
        for path in (root/'remote/bm1'/folder).glob('*'):
            if path.is_file() and path.stat().st_size < 2_000_000 and path.name not in ['authorized_keys-before','transport-public-line.txt']:
                files[campaign+'/'+folder+'/'+path.name] = path
    receipt = root.with_name(root.name+'-archive-verification.json')
    files[campaign+'/full-archive-verification.json'] = receipt
for campaign, root in roots.items():
    runs = root/'remote/bm1/runs'
    measured_names = {path.name for path in selected[campaign]}
    for path in runs.rglob('*'):
        if not path.is_file() or 'monitor' in path.parts or '__pycache__' in path.parts:
            continue
        relative = path.relative_to(runs)
        if relative.parts[0] not in measured_names and path.suffix in ['.json', '.log', '.tcl']:
            files[campaign+'/preparation/'+str(relative)] = path
    for directory in selected[campaign]:
        driver = directory/'driver.tcl'
        if driver.is_file():
            files[campaign+'/runs/'+directory.name+'/driver.tcl'] = driver
for path in (roots['no-reuse']/'artifacts').glob('*'):
    if path.suffix in ['.patch','.json','.log']:
        files['no-reuse/artifacts/'+path.name] = path
for path in (roots['no-reuse']/'source').rglob('*'):
    if path.is_file() and (path.suffix in ['.go','.mod','.sum'] or path.name.startswith(('LICENSE','NOTICE'))):
        files['no-reuse/source/'+str(path.relative_to(roots['no-reuse']/'source'))] = path
for folder in ['baseline']:
    for path in (roots['no-reuse']/folder).rglob('*'):
        if path.is_file():
            files['no-reuse/'+str(path.relative_to(roots['no-reuse']))] = path
collection = args.evidence_parent/'stroppy-contrib-fork'
for module in ['hammerdb-tpcc', 'go-tpc-tpcc']:
    for name in ['LICENSE', 'README.md', 'workload/NOTICE']:
        path = collection/module/name
        if path.is_file():
            files['source-notices/'+module+'/'+name] = path
bundle = output/'reproduction.zip'
manifest = []


def write_member(archive, name, body):
    member = zipfile.ZipInfo(name, date_time=(2026, 10, 29, 0, 0, 0))
    member.compress_type = zipfile.ZIP_DEFLATED
    member.external_attr = 0o644 << 16
    archive.writestr(member, body, compresslevel=9)


with zipfile.ZipFile(bundle,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for name, path in sorted(files.items()):
        assert path.name not in ['client_ed25519','authorized_keys-before']
        body = path.read_bytes()
        assert b'PRIVATE KEY-----' not in body, path
        write_member(archive, name, body)
        manifest.append({'path':name,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
    for name, body in [('README.md',bundle_readme.encode()),('recompute.py',recompute.encode())]:
        write_member(archive, name, body)
        manifest.append({'path':name,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
    write_member(archive, 'manifest.json', json.dumps({'files':manifest},indent=2)+'\n')
checks={path.name:{'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()} for path in [bundle,output/'results.json',output/'cases.csv']}
(output/'checksums.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps({'measured_cases':len(cases),'bundle_files':len(manifest),'downloads':checks}))
