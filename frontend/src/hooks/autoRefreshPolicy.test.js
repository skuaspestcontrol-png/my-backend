import test from 'node:test';import assert from 'node:assert/strict';import{shouldAutoRefresh}from'./autoRefreshPolicy.js';
const base={visibilityState:'visible',running:false,lastStartedAt:null,now:0};
test('visible first refresh runs; hidden/in-flight work does not',()=>{
 assert.equal(shouldAutoRefresh(base),true);assert.equal(shouldAutoRefresh({...base,visibilityState:'hidden'}),false);assert.equal(shouldAutoRefresh({...base,running:true}),false);
});
test('focus/visibility bursts coalesce, later refresh remains eligible',()=>{
 assert.equal(shouldAutoRefresh({...base,lastStartedAt:0,now:999}),false);assert.equal(shouldAutoRefresh({...base,lastStartedAt:0,now:1000}),true);assert.equal(shouldAutoRefresh({...base,lastStartedAt:0,now:60000}),true);
});
test('clock correction and explicit custom gap do not permanently stall refresh',()=>{
 assert.equal(shouldAutoRefresh({...base,lastStartedAt:10000,now:9000}),true);assert.equal(shouldAutoRefresh({...base,lastStartedAt:0,now:1,minGapMs:0}),true);
});
