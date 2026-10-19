"""FR1 deployment-notice test (19 Oct 2026). Needs s6e approved first. Sends s0, s6a, s6b, s6c (expect skipped),
then s6g and s6f (expect updates of s6e, approved when pending), then asks the chatbot when Simpan Artikel went live.
Usage: python3 run_deploy_test.py [results.json]"""
import json, sys, re, time
OUT = sys.argv[1] if len(sys.argv) > 1 else 'results.json'
sys.argv = ['x', OUT]
exec(open('/home/cendi/kms-paper-nisya/docs/evaluation/2026-10-19/evaluate.py').read().split('def save():')[0])
R = {'ingest': [], 'approve': [], 'chat': []}
def save(): json.dump(R, open(OUT, 'w'), ensure_ascii=False, indent=1)
def ingest(name, expect):
    e = json.load(open(D + name + '.json'))
    r = call('/ingest-email', {'user_id': e['messages'][0]['from'], 'email': e})[1]
    s, secs = wait(r['candidate_id'])
    owner = e['messages'][0]['from']
    items = call(f'/my-candidates?user_id={owner}')[1]; items = items.get('candidates') or items.get('items') or []
    c = next((c for c in items if c.get('candidate_id') == r['candidate_id']), {})
    row = {'email': name, 'expected': expect, 'candidate_id': r['candidate_id'], 'status': s.get('status'), 'seconds': secs,
           'is_update': c.get('is_update'), 'title': (s.get('curated_summary') or {}).get('title'),
           'summary': (s.get('curated_summary') or {}).get('summary'),
           'deploy_facts': [f.get('fact') for f in c.get('facts', []) if re.search(r'v4\.19|10[.:]21|SUCCESS|live|deploy', json.dumps(f), re.I)]}
    R['ingest'].append(row); save()
    print('INGEST', name, row['status'], 'update' if row['is_update'] else '', f"{secs}s", '|', (row['summary'] or '')[:160], flush=True)
    for f in row['deploy_facts']: print('   fakta:', f)
    return row, owner
def approve(row, owner):
    code, r = call('/validate-knowledge', {'candidate_id': row['candidate_id'], 'user_id': owner, 'action': 'approve'})
    R['approve'].append({'candidate_id': row['candidate_id'], 'http': code, 'new_status': r.get('new_status'), 'superseded': r.get('superseded_candidates')}); save()
    print('APPROVE', row['email'], code, r.get('new_status'), r.get('superseded_candidates'), flush=True)
for n in ['s0-non-knowledge', 's6a-daily-report', 's6b-it-support-reply', 's6c-deploy-notice']:
    ingest(n, 'skipped')
for n in ['s6g-deploy-notice-linked', 's6f-deploy-reply-in-thread']:
    row, owner = ingest(n, 'pending_validation (update s6e)')
    if row['status'] == 'pending_validation': approve(row, owner)
for user, should in [('STAFF-1A', True), ('SPV-A', True), ('STAFF-3A', False)]:
    ans = call('/chat-rag', {'chatInput': 'Kapan fitur Simpan Artikel live di production dan versi berapa?', 'user_id': user}, timeout=180)[1].get('output', '')
    found = bool(re.search(r'v4\.19\.0', ans)) and bool(re.search(r'10[.:]21', ans))
    R['chat'].append({'user': user, 'should_answer': should, 'answered': found, 'ok': found == should, 'answer': ans[:700]}); save()
    print('CHAT', user, 'OK' if found == should else 'FAIL', '|', ans[:300].replace('\n', ' '), flush=True)
