const UPSTREAM='https://creitivika-achievement-diary.smirnova-irina7090.chatgpt.site';
const ALLOWED_ORIGIN='https://smirnovairina7090-blip.github.io';
const ACTIONS=new Set(['register','login','logout','me','state','unlock']);
export async function bridge(request,fetcher=fetch){
 const origin=request.headers.get('origin');
 const cors={'Access-Control-Allow-Origin':ALLOWED_ORIGIN,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const respond=(data,status=200)=>Response.json(data,{status,headers:cors});
 if(origin&&origin!==ALLOWED_ORIGIN)return respond({error:'Открой дневник по ссылке школы.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const action=new URL(request.url).searchParams.get('action');
 if(!ACTIONS.has(action))return respond({error:'Неизвестное действие.'},404);
 const expected={register:'POST',login:'POST',logout:'POST',me:'GET',state:'PATCH',unlock:'POST'};
 if(request.method!==expected[action])return respond({error:'Неподдерживаемое действие.'},405);
 const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(!['register','login'].includes(action)&&!token)return respond({error:'Войди в свой дневник.'},401);
 try{
  let body;
  if(request.method!=='GET'){
   body=await request.text();
   if(body.length>20000)return respond({error:'Запрос слишком большой.'},413);
   try{JSON.parse(body);}catch{return respond({error:'Некорректный запрос.'},400);}
  }
  const headers={'Content-Type':'application/json','Origin':UPSTREAM};
  if(token)headers.Cookie='creitivika_session='+token;
  const upstream=await fetcher(UPSTREAM+'/api/'+action,{method:request.method,headers,body,redirect:'error',signal:AbortSignal.timeout(20000)});
  const contentType=upstream.headers.get('content-type')||'';
  if(!contentType.includes('application/json'))return respond({error:'Сервис сохранения временно недоступен. Попробуй ещё раз.'},502);
  const data=await upstream.json();
  if(upstream.ok&&['register','login'].includes(action)){
   const sessionToken=upstream.headers.get('set-cookie')?.match(/(?:^|,\s*)creitivika_session=([a-f0-9]{64})(?:;|$)/)?.[1];
   if(!sessionToken)return respond({error:'Не удалось открыть сессию. Повтори вход.'},502);
   data.sessionToken=sessionToken;
  }
  return respond(data,upstream.status);
 }catch{return respond({error:'Не удалось связаться с сервисом сохранения. Попробуй ещё раз.'},502);}
}
export default {fetch(request){return bridge(request);}};
