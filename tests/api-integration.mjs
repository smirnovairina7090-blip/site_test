import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
import fs from 'node:fs';
import assert from 'node:assert/strict';
await build({entryPoints:['tests/api-worker.ts'],bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers'],outfile:'.sites-runtime/api-test.mjs'});
const vars=fs.readFileSync('.dev.vars','utf8').trim().slice('UNLOCK_CODE_HASHES='.length);
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/api-test.mjs',compatibilityDate:'2026-05-22',d1Databases:['DB'],bindings:{UNLOCK_CODE_HASHES:vars}});
try{
 const db=await mf.getD1Database('DB');
 const sql=fs.readFileSync('drizzle/0000_married_mentor.sql','utf8').replaceAll('--> statement-breakpoint','').replace(/\n/g,' ');
 for(const statement of sql.split(';').filter(s=>s.trim()))await db.prepare(statement).run();
 async function call(client,path,method='GET',body){const r=await mf.dispatchFetch('https://diary.test/api/'+path,{method,headers:{Origin:'https://diary.test','Content-Type':'application/json',...(client.cookie?{Cookie:client.cookie}:{})},body:body?JSON.stringify(body):undefined});const c=r.headers.get('set-cookie');if(c)client.cookie=c.split(';')[0];return [r.status,await r.json()];}
 const a={},b={};let [status,x]=await call(a,'register','POST',{});assert.equal(status,201,JSON.stringify(x));let [s,y]=await call(b,'register','POST',{});assert.equal(s,201);assert.notEqual(x.username,y.username);
 [s,y]=await call(a,'state','PATCH',{updates:[{path:'profile.student',value:'Тестовый ученик'},{path:'lessons.0.topic',value:'Циклы Python'},{path:'bingo.0',value:true}]});assert.equal(s,200);
 [s,y]=await call(a,'state','PATCH',{updates:[{path:'unlocked',value:['part-1']}]});assert.equal(s,400);
 [s,y]=await call(a,'unlock','POST',{itemId:'part-1',code:'WRONG'});assert.equal(s,403);
 const codes=JSON.parse(fs.readFileSync(process.env.DIARY_TEST_CODES_PATH||'.teacher-codes.test.json','utf8'));
 for(const [itemId,code] of Object.entries(codes)){[s,y]=await call(a,'unlock','POST',{itemId,code});assert.equal(s,200,JSON.stringify(y));}
 assert.equal(y.unlocked.length,13);
 [s,y]=await call(b,'me');assert.equal(y.unlocked.length,0);assert.equal(y.state.profile.student,'');
 const c={};[s,y]=await call(c,'login','POST',{username:x.username,password:x.password});assert.equal(s,200);assert.equal(y.unlocked.length,13);assert.equal(y.state.lessons[0].topic,'Циклы Python');
 [s,y]=await call(a,'unlock','POST',{itemId:'part-1',code:codes['part-1']});assert.equal(s,200);assert.equal(y.unlocked.length,13);
 const denied=await mf.dispatchFetch('https://diary.test/api/state',{method:'PATCH',headers:{Origin:'https://other.test',Cookie:a.cookie,'Content-Type':'application/json'},body:JSON.stringify({updates:[]})});assert.equal(denied.status,403);
 [s,y]=await call(a,'logout','POST',{});assert.equal(s,200);[s,y]=await call(a,'me');assert.equal(s,401);
 console.log('PASS: registration; unique accounts; cross-device login; saved fields; student isolation; wrong-code rejection; 13 unlocks; idempotence; no client self-unlock; origin validation; logout.');
}finally{await mf.dispose();}
