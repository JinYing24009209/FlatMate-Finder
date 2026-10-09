import test from 'node:test';
import assert from 'node:assert/strict';
import {startPolling} from '../src/utils/polling.js';
function environment() {
  const host=new EventTarget(),page=new EventTarget();
  let tick,delay,cleared=false;
  host.setInterval=(callback,ms)=>{tick=callback;delay=ms;return 7;};
  host.clearInterval=id=>{assert.equal(id,7);cleared=true;};
  return {host,page,tick:()=>tick(),delay:()=>delay,cleared:()=>cleared};
}
test('polls every five seconds, pauses hidden tabs and refreshes on return',()=>{
  const env=environment();let calls=0;
  const stop=startPolling(()=>calls++,env);
  assert.equal(env.delay(),5000);env.tick();assert.equal(calls,1);
  env.page.hidden=true;env.tick();assert.equal(calls,1);
  env.page.hidden=false;env.page.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,2);
  env.host.dispatchEvent(new Event('focus'));assert.equal(calls,3);stop();
});
test('cleanup cancels timers and event listeners, including a queued old tick',()=>{
  const env=environment();let calls=0;
  const stop=startPolling(()=>calls++,env);stop();assert.ok(env.cleared());
  env.tick();env.host.dispatchEvent(new Event('focus'));env.page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(calls,0);
});
