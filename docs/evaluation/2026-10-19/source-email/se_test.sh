#!/bin/bash
# End-to-end test for source_email: s7 (redaction), s5 -> approve -> s5b (new-message marker).
S=$(dirname "$0"); D=/home/cendi/kms-paper-nisya/dummy-emails; API=http://localhost:5173/api
mkdir -p $S/se
mk() { sed -e "s/EMAIL-S$2/EMAIL-SE$2/g" $D/$1.json > $S/se/$1.json; }
mk s7-sensitive-mixed 7; mk s5-long-thread 5; mk s5b-long-thread-continued 5
ingest() { # file user -> candidate_id after final status
  local f=$1 u=$2
  local id=$(curl -s -X POST $API/ingest-email -H 'Content-Type: application/json' -d "{\"user_id\":\"$u\",\"email\":$(cat $S/se/$f.json)}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["candidate_id"])')
  for i in $(seq 1 60); do
    st=$(curl -s "$API/candidate-status?id=$id" | python3 -c 'import sys,json;print(json.load(sys.stdin)["status"])')
    [ "$st" != processing ] && break; sleep 10
  done
  echo "$f $id $st" >&2; echo $id
}
u7=$(python3 -c "import json;print(json.load(open('$S/se/s7-sensitive-mixed.json'))['messages'][0]['from'])")
c7=$(ingest s7-sensitive-mixed $u7) & 
c5=$(ingest s5-long-thread STAFF-1B)
wait
r=$(curl -s -X POST $API/validate-knowledge -H 'Content-Type: application/json' -d "{\"candidate_id\":\"$c5\",\"user_id\":\"STAFF-1B\",\"action\":\"approve\"}")
echo "approve $c5: $r" >&2
c5b=$(ingest s5b-long-thread-continued STAFF-1B)
curl -s "$API/my-candidates?user_id=STAFF-1B" > $S/se/my_1b.json
curl -s "$API/my-candidates?user_id=$u7" > $S/se/my_s7.json
echo done >&2
