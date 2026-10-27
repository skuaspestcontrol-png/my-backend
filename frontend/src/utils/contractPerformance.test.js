import test from 'node:test';
import assert from 'node:assert/strict';
import { sameSnapshotValue, reuseUnchangedSnapshot, sortContractRows } from './contractPerformance.js';

const parseDateOnly = (value) => { if (!value) return null; const date = new Date(value); if (Number.isNaN(date.getTime())) return null; date.setHours(0, 0, 0, 0); return date; };
const statusOrder = { Active: 0, Upcoming: 1, 'Expiring Soon': 2, Expired: 3, Renewed: 4, Draft: 5, Proforma: 6, Cancelled: 7, Void: 8 };
const legacy = (rows, sort) => {
  const get = (row) => { switch (sort.key) {
    case 'contractNo': case 'customer': case 'property': return String(row[sort.key] || '');
    case 'duration': return parseDateOnly(row.endDate)?.getTime() || 0;
    case 'type': return parseDateOnly(row.invoiceDate)?.getTime() || 0;
    case 'services': case 'total': case 'paid': case 'due': return Number(row[sort.key] || 0);
    case 'status': return Number(statusOrder[row.status] ?? 99);
    default: return String(row[sort.key] || '');
  } };
  return [...rows].sort((a, b) => { const av = get(a), bv = get(b); const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }); return sort.direction === 'asc' ? result : -result; });
};

test('unchanged full snapshots retain state identity; nested changes are never ignored', () => {
  const previous = { invoices: [{ _id: 'I1', amount: 100.25, items: [{ rate: 25, status: 'Sent' }] }], schedules: [{ status: 'Scheduled', date: '2026-10-27' }] };
  const copy = JSON.parse(JSON.stringify(previous));
  const same = reuseUnchangedSnapshot(previous, copy);
  assert.equal(same.changed, false); assert.equal(same.snapshot.invoices, previous.invoices); assert.equal(same.snapshot.schedules, previous.schedules);
  copy.invoices[0].items[0].rate = 26;
  const changed = reuseUnchangedSnapshot(previous, copy);
  assert.equal(changed.changed, true); assert.equal(changed.snapshot.invoices, copy.invoices); assert.equal(changed.snapshot.schedules, previous.schedules);
  assert.equal(previous.invoices[0].items[0].rate, 25);
});

test('snapshot comparison detects deletions, additions, reordering and null/missing changes', () => {
  for (const [a,b] of [[[1,2],[2,1]],[[1],[1,2]],[{amount:1},{amount:2}],[{x:null},{}],[{x:[]},{x:{}}],[{id:1,extra:0},{id:1}]]) assert.equal(sameSnapshotValue(a,b),false);
  assert.equal(sameSnapshotValue({a:1,b:2},{b:2,a:1}),true);
});

test('all sort keys/directions preserve legacy order, stable ties and input rows', () => {
  const names=['Sample 2','Sample 10','Élan','elan','Alpha','alpha','',null];
  const rows=Array.from({length:160},(_,i)=>({_id:'I'+i,contractNo:names[(i*3)%names.length],customer:names[i%names.length],property:names[(i*5)%names.length],endDate:i%9?'2026-10-'+String(i%27+1).padStart(2,'0'):'invalid',invoiceDate:i%7?'2026-09-'+String(i%26+1).padStart(2,'0'):null,services:i%4,total:i%5?i*.25:null,paid:i%8,due:i%2?0:-i,status:Object.keys(statusOrder)[i%10]||'Unknown',extra:names[(i*7)%names.length]}));
  const original=JSON.stringify(rows);
  for(const key of ['contractNo','customer','property','duration','type','services','status','total','paid','due','extra'])for(const direction of ['asc','desc']){
    assert.deepEqual(sortContractRows(rows,{key,direction},parseDateOnly).map(v=>v._id),legacy(rows,{key,direction}).map(v=>v._id),key+' '+direction);
  }
  assert.equal(JSON.stringify(rows),original);
});

test('sort parses a date only once per row',()=>{
  const rows=Array.from({length:200},(_,i)=>({invoiceDate:'2026-10-'+String(i%27+1).padStart(2,'0')}));let count=0;
  sortContractRows(rows,{key:'type',direction:'desc'},v=>{count++;return parseDateOnly(v)});assert.equal(count,rows.length);
});
