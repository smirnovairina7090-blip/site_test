export const PARTS = ['Монитор','Системный блок','Клавиатура','Мышь','Наушники','Веб-камера','Колонка','Геймпад'];
export const AWARDS = [
 {id:'level',name:'Новый уровень',image:'level.webp',description:'Справился с тем, что раньше не получалось.'},
 {id:'idea',name:'Автор идеи',image:'idea.webp',description:'Предложил свой способ или полезную доработку.'},
 {id:'explain',name:'Могу объяснить',image:'explain.webp',description:'Понятно объяснил, как выполнить задание.'},
 {id:'friend',name:'Друг Креайтивики',image:'friend_award_transparent.webp',description:'Пригласил друга, и он посетил пробное занятие.'},
 {id:'voice',name:'Голос Креайтивики',image:'review_award.webp',description:'Вместе с родителем оставил честный отзыв. Оценка любая.'},
];
export const BINGO = [
 ['Объясняю новое','Объясни правило с урока своими словами.','Например: цикл в коде или сложение дробей.'],
 ['Делаю сам','Выполни похожее задание без подсказки.','Например: ещё одна задача того же типа.'],
 ['Исправляю ошибку','Найди ошибку и объясни исправление.','Например: в коде, вычислении или рисунке.'],
 ['Есть своя идея','Предложи свой способ или доработку.','Например: другая формула или ход в игре.'],
 ['Мой новый навык','Что теперь умеешь делать?','Запиши свой новый навык.'],
 ['Проверяю работу','Проверь результат до проверки учителя.','Например: запусти проект или проверь ответ.'],
 ['Вспоминаю','Примени то, что изучали на прошлом уроке.','Например: знакомую команду, правило или приём.'],
 ['Довожу до конца','Заверши задание и покажи результат.','Например: решённая задача или этап проекта.'],
 ['Показываю дома','Покажи работу и объясни её близким.','Например: расскажи о работе за минуту.'],
];
export const ITEM_IDS=[...PARTS.map((_,i)=>`part-${i+1}`),...AWARDS.map(a=>a.id)];
export type DiaryState = {
 profile: {student:string;direction:string;teacher:string;period:string;route:string;skillLogin:string;skillPassword:string;materialsUrl:string};
 lessons: {date:string;topic:string}[];bingo:boolean[];newSkill:string;
 reflection:{skill:string;proof:string;goal:string};
};
export type Snapshot={username:string;state:DiaryState;unlocked:string[];revision:number};
export function blankState():DiaryState{return {profile:{student:'',direction:'',teacher:'',period:'',route:'1',skillLogin:'',skillPassword:'',materialsUrl:'https://skillspace.ru/'},lessons:Array.from({length:8},()=>({date:'',topic:''})),bingo:Array(9).fill(false),newSkill:'',reflection:{skill:'',proof:'',goal:''}};}
export function applyUpdates(state:DiaryState,updates:{path:string;value:unknown}[]):DiaryState{
 const next=structuredClone(state);
 if(!Array.isArray(updates)||updates.length>40)throw new Error('Слишком много изменений.');
 for(const u of updates){
  if(!u||typeof u.path!=='string')throw new Error('Некорректное поле.');
  const p=u.path.split('.');
  if(p[0]==='profile'&&p.length===2&&Object.hasOwn(next.profile,p[1])){
   if(typeof u.value!=='string'||u.value.length>200)throw new Error('Поле слишком длинное.');
   if(p[1]==='materialsUrl'&&u.value){let url;try{url=new URL(u.value);}catch{throw new Error('Укажите полный адрес материалов.');}if(url.protocol!=='https:')throw new Error('Ссылка должна начинаться с https://');}
   (next.profile as Record<string,string>)[p[1]]=u.value;
  }else if(p[0]==='lessons'&&p.length===3&&/^[0-7]$/.test(p[1])&&['date','topic'].includes(p[2])){
   if(typeof u.value!=='string'||u.value.length>(p[2]==='date'?10:160))throw new Error('Некорректная запись урока.');
   if(p[2]==='date'&&u.value&&!/^\d{4}-\d{2}-\d{2}$/.test(u.value))throw new Error('Некорректная дата.');
   next.lessons[+p[1]][p[2] as 'date'|'topic']=u.value;
  }else if(p[0]==='bingo'&&p.length===2&&/^[0-8]$/.test(p[1])&&typeof u.value==='boolean')next.bingo[+p[1]]=u.value;
  else if(u.path==='newSkill'&&typeof u.value==='string'&&u.value.length<=300)next.newSkill=u.value;
  else if(p[0]==='reflection'&&p.length===2&&Object.hasOwn(next.reflection,p[1])&&typeof u.value==='string'&&u.value.length<=500)(next.reflection as Record<string,string>)[p[1]]=u.value;
  else throw new Error('Это поле нельзя изменить самостоятельно.');
 }
 return next;
}
export function bingoLines(b:boolean[]){return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].filter(l=>l.every(i=>b[i])).length;}
