const vm=require('node:vm');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname, '../rsvp.js'),'utf8');
function setup(fetchImpl,values={}) {
 const nodes={}; const fields={name:'Test Family',contact:'test@example.com',attending:'yes',adults:'2',kids:'1',message:'',...values};
 function node(){const classes=new Set(); return {textContent:'Send Our RSVP',disabled:false,classList:{add(...v){v.forEach(x=>classes.add(x))},remove(...v){v.forEach(x=>classes.delete(x))},contains(x){return classes.has(x)},toggle(){}},focus(){this.focused=true},setAttribute(){},removeAttribute(){},addEventListener(type,fn){this[type]=fn},querySelectorAll(){return []}}}
 for(const id of ['rsvp-form','rsvp-done','rsvp-msg','rsvp-summary','rsvp-edit']) nodes[id]=node();
 const form=nodes['rsvp-form'], button=node(), input=node(); form.querySelector=()=>input; form.querySelector=s=>s==='button[type="submit"]'?button:input; form.reportValidity=()=>true; form.reset=()=>{};
 nodes['rsvp-done'].classList.add('hidden'); let calls=0, timer;
 const context={document:{getElementById:id=>nodes[id],querySelectorAll:()=>[]},FormData:class{get(k){return fields[k]}},crypto:require('node:crypto').webcrypto,fetch:async(...args)=>{calls++;return fetchImpl(...args)},SUPABASE_URL:'https://example.com',SUPABASE_ANON_KEY:'test',AbortController,console:{warn(){}},setTimeout(fn){timer=fn;return 1},clearTimeout(){},Date};
 vm.runInNewContext(source,context);
 return {nodes,button,fields,send:()=>form.submit({preventDefault(){}}),calls:()=>calls,timeout:()=>timer()};
}
(async()=>{
 let t=setup(async()=>({ok:true})); await t.send(); assert(t.nodes['rsvp-form'].classList.contains('hidden')); assert.match(t.nodes['rsvp-summary'].textContent,/2 adult/);
 t=setup(async()=>({ok:false,status:500,json:async()=>({})})); await t.send(); assert(!t.nodes['rsvp-form'].classList.contains('hidden')); assert(t.nodes['rsvp-done'].classList.contains('hidden')); assert.match(t.nodes['rsvp-msg'].textContent,/couldn't confirm/); assert.equal(t.button.disabled,false);
 t=setup(async()=>{throw Error('offline')}); await t.send(); assert.match(t.nodes['rsvp-msg'].textContent,/details are still here/);
 t=setup(async()=>({ok:true}),{attending:''}); await t.send(); assert.equal(t.calls(),0); assert.match(t.nodes['rsvp-msg'].textContent,/Please choose/);
 let release; t=setup(()=>new Promise(resolve=>release=resolve)); const flight=t.send(); assert.equal(t.button.textContent,'Sending…'); await t.send(); assert.equal(t.calls(),1); release({ok:true}); await flight;
 t=setup((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'}))))); const slow=t.send(); t.timeout(); await slow; assert.match(t.nodes['rsvp-msg'].textContent,/longer than expected/); assert.equal(t.button.disabled,false);
 let bodies=[]; t=setup(async(url,opts)=>{bodies.push(JSON.parse(opts.body)); if(bodies.length===1) throw Error('lost response'); return {ok:false,status:409,json:async()=>({code:'23505'})}}); await t.send(); await t.send(); assert.equal(bodies[0].id,bodies[1].id); assert(!t.nodes['rsvp-done'].classList.contains('hidden'));
 t=setup(async(url,opts)=>{assert.equal(JSON.parse(opts.body).adults,0); assert.equal(JSON.parse(opts.body).kids,0); return {ok:true}},{attending:'no'}); await t.send(); assert.match(t.nodes['rsvp-summary'].textContent,/Can't make it/);
 t.nodes['rsvp-edit'].onclick(); assert(!t.nodes['rsvp-form'].classList.contains('hidden')); assert(t.nodes['rsvp-done'].classList.contains('hidden'));
 console.log('Passed: confirmed save, server error, offline, attendance validation, double click, timeout, retry deduplication, decline counts, another family.');
})().catch(e=>{console.error(e);process.exit(1)});
