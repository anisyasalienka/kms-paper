"""Controlled test of document_extractor on the s4 Google Doc (19 Oct 2026). Same conversation as eval run 3891,
only the two credentials change: raw, tagged, plain-masked, tagged + "Masked values" prompt rule. Calls 9router directly
with a temporary key read from ~/.9router-key (never stored in the repo). Usage: python3 extractor_experiment.py [runs] [out.json]"""
import json, sys, os, urllib.request, concurrent.futures as cf, re
B = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'extractor_input_s4.json')))
KEY = open(os.path.expanduser('~/.9router-key')).read().strip()
RULE = ("\n\n## Masked values\nValues written as [KREDENSIAL: ...] or [DATA_PRIBADI: ...] are real values that were masked "
        "before you received them. Treat them as normal content: keep each tag exactly as written in text, structured_details, "
        "and extracted_facts, including a fact that states which credentials or personal data the document contains. "
        "Never drop, guess, or unmask them.")
TAG_MK, TAG_CS = '[KREDENSIAL: MK_S****]', '[KREDENSIAL: Qris****]'
def tool_for(cond):
    t = B['tool']
    if cond == 'raw':
        t = t.replace(TAG_MK, 'MK_STG_9982401').replace(TAG_CS, 'Qris#StgSecr3t2026!')
        j = json.loads(t); j[0].pop('redactions', None); t = json.dumps(j, ensure_ascii=False)
    elif cond == 'plain':
        t = t.replace(TAG_MK, 'MK_S****').replace(TAG_CS, 'Qris****')
    return t
def call(cond, i):
    sysmsg = B['system'] + (RULE if cond == 'tag+rule' else '')
    ai = B['ai'][0]
    msgs = [{'role': 'system', 'content': sysmsg}, {'role': 'user', 'content': B['human']},
            {'role': 'assistant', 'content': None, 'tool_calls': [{'id': ai['id'], 'type': 'function',
              'function': {'name': 'gdocs_reader', 'arguments': json.dumps(ai['args'])}}]},
            {'role': 'tool', 'tool_call_id': ai['id'], 'content': tool_for(cond)}]
    tools = [{'type': 'function', 'function': {'name': 'gdocs_reader', 'description': 'Read a Google Doc by url',
              'parameters': {'type': 'object', 'properties': {'url': {'type': 'string'}}, 'required': ['url']}}}]
    body = json.dumps({'model': 'ag/gemini-3.8-flash', 'messages': msgs, 'tools': tools, 'stream': False}).encode()
    req = urllib.request.Request('http://127.0.0.1:20128/v1/chat/completions', body,
                                 {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY})
    txt = json.load(urllib.request.urlopen(req, timeout=180))['choices'][0]['message']['content'] or ''
    m = re.search(r'\{.*\}', txt, re.S)
    try: facts = json.loads(m.group(0)).get('extracted_facts') or []
    except Exception: facts = None
    return cond, i, facts, txt
conds = ['raw', 'tag', 'plain', 'tag+rule']
N = int(sys.argv[1]) if len(sys.argv) > 1 else 5
res = []
with cf.ThreadPoolExecutor(8) as ex:
    for r in ex.map(lambda a: call(*a), [(c, i) for c in conds for i in range(N)]): res.append(r)
json.dump([{'cond': c, 'i': i, 'facts': f, 'raw_text': t} for c, i, f, t in res], open(sys.argv[2] if len(sys.argv) > 2 else 'extractor_results.json', 'w'), ensure_ascii=False, indent=1)
def hit(facts, word):
    return any(re.search(word, str(x), re.I) for x in facts)
for c in conds:
    rows = [r for r in res if r[0] == c]
    mk = sum(1 for r in rows if r[2] is not None and hit(r[2], r'merchant.?key'))
    cs = sum(1 for r in rows if r[2] is not None and hit(r[2], r'client.?secret'))
    bad = sum(1 for r in rows if r[2] is None)
    print(f'{c:9s} merchant key di facts: {mk}/{len(rows)}   client secret di facts: {cs}/{len(rows)}   gagal parse: {bad}')
