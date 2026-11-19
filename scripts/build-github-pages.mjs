import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const bridgeOrigin='https://creitivika-diary-api-smirnovairina7090-8722s-projects.vercel.app';
const apiImplementation=`const SESSION_KEY='creitivika.account.session.v1';
let memoryToken='';
function sessionToken(){try{return localStorage.getItem(SESSION_KEY)||memoryToken;}catch{return memoryToken;}}
function saveToken(token:string){memoryToken=token;try{localStorage.setItem(SESSION_KEY,token);}catch{}}
function clearToken(){memoryToken='';try{localStorage.removeItem(SESSION_KEY);}catch{}}
async function api(path:string,method='GET',body?:unknown){
 let response:Response;
 try{response=await fetch('${bridgeOrigin}/api/diary?action='+encodeURIComponent(path),{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(sessionToken()?{Authorization:'Bearer '+sessionToken()}:{})},body:body?JSON.stringify(body):undefined});}
 catch{throw new Error('Не удалось связаться с сервисом сохранения. Проверь интернет и попробуй ещё раз.');}
 let data:any;try{data=await response.json();}catch{throw new Error('Сервис сохранения временно недоступен. Попробуй ещё раз.');}
 if(!response.ok){if(response.status===401&&path==='me')clearToken();throw new Error(data.error||'Не удалось выполнить действие.');}
 if(typeof data.sessionToken==='string'&&/^[a-f0-9]{64}$/.test(data.sessionToken)){saveToken(data.sessionToken);delete data.sessionToken;}
 if(path==='logout')clearToken();
 return data;
}
`;
let source=await fs.readFile('app/page.tsx','utf8');
const start=source.indexOf('async function api('),end=source.indexOf('\nfunction download(',start);
if(start<0||end<0)throw new Error('Frontend API function changed: update the Pages build adapter.');
source=source.slice(0,start)+apiImplementation+source.slice(end);
source=source.replaceAll('/assets/','assets/').replaceAll('href="/diary-a4.pdf"','href="diary-a4.pdf"').replaceAll('${location.origin}','${location.href.split(/[?#]/)[0]}');
await fs.writeFile('github-pages/Diary.tsx',source);
let css=await fs.readFile('app/globals.css','utf8');css=css.replace(/^@import url\('\/assets\/fonts.css'\);\n/,'');await fs.writeFile('github-pages/style.css',css);
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','vite.pages.config.ts'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
await fs.cp('public/assets','dist-pages/assets',{recursive:true});
let fonts=await fs.readFile('dist-pages/assets/fonts.css','utf8');fonts=fonts.replaceAll('/assets/','./');await fs.writeFile('dist-pages/assets/fonts.css',fonts);
await fs.copyFile('public/diary-a4.pdf','dist-pages/diary-a4.pdf');await fs.writeFile('dist-pages/.nojekyll','');
console.log('GitHub Pages build ready, API origin: '+bridgeOrigin);
