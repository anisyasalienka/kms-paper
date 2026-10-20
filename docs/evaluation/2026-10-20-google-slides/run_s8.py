"""Google Slides test (s8a, s8b). Usage: python3 run_s8.py <step> where step is ingest-a, approve-a, ingest-b, approve-b or chat.
Each step appends to results.json."""
import json, re, subprocess, sys, time

API = 'http://localhost:5173/api'
D = '/home/cendi/kms-paper-nisya/dummy-emails/'
OUT = 'results.json'
try:
    R = json.load(open(OUT))
except FileNotFoundError:
    R = {}

def call(path, body=None, timeout=200):
    # curl: the proxied n8n sits behind Cloudflare, which rejects Python's default client.
    cmd = ['curl', '-s', '-m', str(timeout), '-w', '\n%{http_code}', API + path]
    if body is not None:
        cmd += ['-X', 'POST', '-H', 'Content-Type: application/json', '--data-binary', '@-']
    out = subprocess.run(cmd, input=json.dumps(body).encode() if body is not None else None, capture_output=True).stdout.decode()
    text, _, code = out.rpartition('\n')
    try:
        return int(code), json.loads(text or '{}')
    except ValueError:
        return int(code or 0), {'raw': text[:300]}

def ingest(name):
    e = json.load(open(D + name + '.json'))
    first = call('/ingest-email', {'user_id': e['messages'][0]['from'], 'email': e})[1]
    cid, t0 = first.get('candidate_id'), time.time()
    while True:
        s = call(f'/candidate-status?id={cid}')[1]
        if s.get('status') != 'processing' or time.time() - t0 > 600:
            break
        time.sleep(4)
    s['seconds'] = round(time.time() - t0)
    return s

def approve(cid, owner):
    return call('/validate-knowledge', {'candidate_id': cid, 'user_id': owner, 'action': 'approve'})[1]

step = sys.argv[1]
if step == 'ingest-a':
    R['s8a'] = ingest('s8a-google-slides')
elif step == 'approve-a':
    R['s8a_approve'] = approve(R['s8a']['candidate_id'], 'STAFF-1C')
elif step == 'ingest-b':
    R['s8b'] = ingest('s8b-google-slides-reply')
elif step == 'approve-b':
    R['s8b_approve'] = approve(R['s8b']['candidate_id'], 'STAFF-1C')
elif step == 'chat':
    R['chat'] = []
    for user, should in [('STAFF-3C', True), ('SPV-C', True), ('STAFF-1A', False)]:
        q = 'Kapan UAT Rekomendasi Artikel Personal v2 dan apa aturan rollback-nya?'
        code, r = call('/chat-rag', {'chatInput': q, 'user_id': user}, timeout=180)
        ans = r.get('output') or ''
        R['chat'].append({'user': user, 'should_answer': should, 'answer': ans[:900], 'leaked': 'Reko#Stg2026' in ans})
json.dump(R, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: R[k] for k in R if k.startswith(step.split('-')[0][:4]) or step == 'chat'}, ensure_ascii=False)[:200])
