"""Counts raw sensitive values in n8n execution data after a given time (NFR4 leak check),
and in every n8n Data Table (staging rows, including kms_candidates.source_email).
Usage: leakcheck.py <db_dir> <started_at ISO UTC>"""
import sqlite3, sys, json
from collections import defaultdict

db_dir, since = sys.argv[1], sys.argv[2].replace('T', ' ')
RAW = {
    's3b': ['Vpn#Stg2026'],
    's4': ['Qris#StgSecr3t2026!', 'MK_STG_9982401'],
    's7': ['3174055203950002', '0813-2233-4455', 'rina.wulan@gmail.com', '5270123456', 'rwd_live_Q7m#Lp29xZ', 'Rw#2026db', '8f3kQ2mZp9Lx7Vb1Nc4R'],
}
# Workflows whose execution data contains what is sent to a model.
MODEL_FACING = {'KmsEvidAgent2026': 'kms_evidence_agent', 'KmsCurateStg2026': 'kms_curate_stage', 'AoK0uKKmiK5peSVp': 'kms_curator_llm'}
READERS = {'VO3XcHfsCmvZwLax': 'gdocs_reader', 'tYUmV5RKkwsiw6C8': 'gsheets_reader', 'ElNyCOiUqBdJJli0': 'gdrive_pdf_reader'}

c = sqlite3.connect(f'file:{db_dir}/database.sqlite?mode=ro', uri=True)
rows = c.execute("""select e.id, e.workflowId, e.status, d.data from execution_entity e join execution_data d on d.executionId = e.id
                    where e.startedAt >= ? and e.workflowId in (%s)""" % ','.join('?' * (len(MODEL_FACING) + len(READERS))),
                 [since, *MODEL_FACING, *READERS]).fetchall()

hits = defaultdict(list)
counts = defaultdict(int)
for eid, wid, status, data in rows:
    counts[wid] += 1
    if wid in READERS:
        # The reader's own Build node still holds the raw text (it never leaves n8n); only the returned result goes to a model.
        # n8n stores run data "flatted"; check what the last node, Redact Sensitive Data, returned.
        flat = json.loads(data)
        text = json.dumps(flat, ensure_ascii=False)
        idx = text.find('"Redact Sensitive Data"')
        scope = text if idx < 0 else None
        data_to_check = None
        try:
            # Resolve the flatted structure enough to get the Redact node output.
            def deref(v):
                return flat[int(v)] if isinstance(v, str) and v.isdigit() else v
            root = flat[0]
            result = deref(root['resultData'])
            run_data = deref(result['runData'])
            redact_runs = deref(run_data['Redact Sensitive Data'])
            parts = []
            def walk(v, depth=0):
                if depth > 40: return
                v = deref(v)
                if isinstance(v, dict):
                    for x in v.values(): walk(x, depth + 1)
                elif isinstance(v, list):
                    for x in v: walk(x, depth + 1)
                elif isinstance(v, str):
                    parts.append(v)
            walk(redact_runs)
            data_to_check = '\n'.join(parts)
        except Exception as ex:
            data_to_check = scope or ''
            hits[('reader-parse-error', wid)].append(str(ex))
    else:
        data_to_check = data
    for scenario, values in RAW.items():
        for v in values:
            if v in data_to_check or json.dumps(v)[1:-1] in data_to_check:
                hits[(scenario, v)].append(f'{MODEL_FACING.get(wid) or READERS.get(wid)}#{eid}')

print('executions checked:', {(MODEL_FACING.get(w) or READERS.get(w)): n for w, n in counts.items()})
total = sum(len(v) for v in RAW.values())
leaked = [k for k in hits if k[0] in RAW]
print(f'raw values checked: {total}, found in model-facing data: {len(leaked)}')
for k, v in hits.items():
    print('  LEAK' if k[0] in RAW else '  NOTE', k, v[:6])

# Data Tables: stored rows must never hold a raw value (n8n keeps each table as data_table_user_<id>).
tables = [r[0] for r in c.execute("select name from sqlite_master where type='table' and name like 'data_table_user_%'")]
dt_hits = []
for tb in tables:
    blob = json.dumps(c.execute(f'select * from "{tb}"').fetchall(), ensure_ascii=False)
    for scenario, values in RAW.items():
        dt_hits += [(tb, scenario, v) for v in values if v in blob]
print(f'data tables checked: {len(tables)}, raw values found: {len(dt_hits)}')
for h in dt_hits:
    print('  LEAK', h)
