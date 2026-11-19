import { env } from 'cloudflare:workers';
import { blankState,applyUpdates,ITEM_IDS } from '../../../lib/model';
export const dynamic='force-dynamic';
const COOKIE='creitivika_session';
const encoder=new TextEncoder();
const hex=(a:ArrayBuffer)=>Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,'0')).join('');
const random=(n:number)=>hex(crypto.getRandomValues(new Uint8Array(n)).buffer);
const hash=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
function json(data:unknown,status=200,extra:Record<string,string>={}){return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});}
const cookie=(token:string,request:Request,clear=false)=>`${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear?0:60*60*24*30}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
function database(){if(!env.DB)throw new Error('Хранилище временно недоступно.');return env.DB;}
async function limit(scope:string,max:number,seconds:number){const now=Date.now();const row=await database().prepare('INSERT INTO rate_limits(scope,count,reset_at) VALUES(?,1,?) ON CONFLICT(scope) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END RETURNING count').bind(scope,now+seconds*1000,now,now,now+seconds*1000).first<{count:number}>();return !!row&&row.count<=max;}
async function session(request:Request){const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return database().prepare('SELECT students.id,students.username,students.state,students.revision FROM sessions JOIN students ON sessions.student_id=students.id WHERE sessions.token_hash=? AND sessions.expires_at>?').bind(await hash(token),Date.now()).first<{id:string;username:string;state:string;revision:number}>();}
async function snapshot(student:{id:string;username:string;state:string;revision:number}){const r=await database().prepare('SELECT item_id FROM unlocks WHERE student_id=? ORDER BY created_at').bind(student.id).all<{item_id:string}>();return {username:student.username,state:JSON.parse(student.state),revision:student.revision,unlocked:r.results.map(x=>x.item_id)};}
async function makeSession(studentId:string){const token=random(32);await database().prepare('INSERT INTO sessions(token_hash,student_id,expires_at) VALUES(?,?,?)').bind(await hash(token),studentId,Date.now()+30*86400000).run();return token;}
async function handle(request:Request){
 try{
  const path=new URL(request.url).pathname.replace(/^\/api\//,'');
  if(request.method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Обновите страницу и попробуйте снова.'},403);
  if(request.method!=='GET'&&Number(request.headers.get('content-length')||0)>20000)return json({error:'Запрос слишком большой.'},413);
  const ip=request.headers.get('cf-connecting-ip')||'preview';
  if(path==='register'&&request.method==='POST'){
   if(!await limit('register:'+await hash(ip),60,3600))return json({error:'Слишком много новых аккаунтов. Попробуйте позже.'},429);
   const id=crypto.randomUUID(),username='student-'+random(4),password=random(10).toUpperCase(),salt=random(16),now=Date.now();
   await database().prepare('INSERT INTO students(id,username,password_hash,salt,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,username,await passwordHash(password,salt),salt,JSON.stringify(blankState()),now,now).run();
   const token=await makeSession(id);
   return json({username,password,snapshot:await snapshot({id,username,state:JSON.stringify(blankState()),revision:0})},201,{'Set-Cookie':cookie(token,request)});
  }
  if(path==='login'&&request.method==='POST'){
   const body=await request.json() as {username?:unknown;password?:unknown};
   if(typeof body.username!=='string'||typeof body.password!=='string'||body.username.length>60||body.password.length>100)return json({error:'Проверь логин и пароль.'},400);
   const username=body.username.trim().toLowerCase();
   if(!await limit('login-ip:'+await hash(ip),40,900)||!await limit('login-user:'+await hash(username),20,900))return json({error:'Много попыток входа. Попробуй через 15 минут.'},429);
   const student=await database().prepare('SELECT * FROM students WHERE username=?').bind(username).first<{id:string;username:string;password_hash:string;salt:string;state:string;revision:number}>();
   const actual=await passwordHash(body.password,student?.salt||'00000000000000000000000000000000');
   if(!student||actual!==student.password_hash)return json({error:'Логин или пароль не подошли.'},401);
   return json(await snapshot(student),200,{'Set-Cookie':cookie(await makeSession(student.id),request)});
  }
  const student=await session(request);
  if(!student)return json({error:'Войди в свой дневник.'},401);
  if(path==='me'&&request.method==='GET')return json(await snapshot(student));
  if(path==='logout'&&request.method==='POST'){
   const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
   if(token)await database().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();
   return json({ok:true},200,{'Set-Cookie':cookie('',request,true)});
  }
  if(path==='state'&&request.method==='PATCH'){
   const body=await request.json() as {updates:{path:string;value:unknown}[]};
   for(let attempt=0;attempt<5;attempt++){
    const current=await database().prepare('SELECT state,revision FROM students WHERE id=?').bind(student.id).first<{state:string;revision:number}>();
    if(!current)return json({error:'Аккаунт не найден.'},401);
    let next;try{next=applyUpdates(JSON.parse(current.state),body.updates);}catch(e){return json({error:(e as Error).message},400);}
    const result=await database().prepare('UPDATE students SET state=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(next),Date.now(),student.id,current.revision).run();
    if(result.meta.changes)return json({ok:true,revision:current.revision+1,savedAt:Date.now()});
   }
   return json({error:'Не удалось сохранить одновременно с другим устройством. Повтори сохранение.'},409);
  }
  if(path==='unlock'&&request.method==='POST'){
   if(!await limit('unlock:'+student.id,20,60))return json({error:'Подожди минуту перед следующей попыткой.'},429);
   const body=await request.json() as {itemId?:unknown;code?:unknown};
   if(typeof body.itemId!=='string'||!ITEM_IDS.includes(body.itemId)||typeof body.code!=='string'||body.code.length>100)return json({error:'Проверь код преподавателя.'},400);
   const config=env.UNLOCK_CODE_HASHES; if(!config)return json({error:'Преподаватель ещё не настроил коды.'},503);
   const hashes=JSON.parse(config) as Record<string,string>;
   const canonical=body.code.toUpperCase().replace(/[\s-]/g,'');
   if(await hash(canonical)!==hashes[body.itemId])return json({error:'Код не подошёл к этой детали или награде.'},403);
   await database().prepare('INSERT INTO unlocks(id,student_id,item_id,created_at) VALUES(?,?,?,?) ON CONFLICT(student_id,item_id) DO NOTHING').bind(crypto.randomUUID(),student.id,body.itemId,Date.now()).run();
   return json(await snapshot(student));
  }
  return json({error:'Неизвестное действие.'},404);
 }catch(error){console.error('Diary request failed:',error instanceof Error?error.message:'unknown');return json({error:import.meta.env.DEV&&error instanceof Error?error.message:'Не удалось выполнить действие. Попробуй ещё раз.'},500);}
}
export const GET=handle;export const POST=handle;export const PATCH=handle;
