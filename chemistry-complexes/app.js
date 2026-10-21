
(function(){
"use strict";
var $=function(s){return document.querySelector(s)};
var $$=function(s){return Array.from(document.querySelectorAll(s))};
var navi=$(".topnav"),menu=$("#nav-toggle");
if(menu)menu.addEventListener("click",function(){var open=navi.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));menu.textContent=open?"Закрыть":"Разделы"});
$$(".topnav a").forEach(function(a){a.addEventListener("click",function(){navi.classList.remove("open");if(menu){menu.textContent="Разделы";menu.setAttribute("aria-expanded","false")}})});
function updateScroll(){var h=document.documentElement.scrollHeight-innerHeight;var pct=h>0?100*scrollY/h:0;var bar=$("#scroll-progress");if(bar)bar.style.width=Math.min(100,Math.max(0,pct))+"%"}
document.addEventListener("scroll",updateScroll,{passive:true});updateScroll();
$$("[data-scroll]").forEach(function(el){el.addEventListener("click",function(){var target=$(el.dataset.scroll);if(target)target.scrollIntoView({behavior:"smooth"})})});
$$(".case-tabs button").forEach(function(b){b.addEventListener("click",function(){
$$(".case-tabs button").forEach(function(x){x.classList.toggle("on",x===b);x.setAttribute("aria-selected",x===b?"true":"false")});
$$(".case-body").forEach(function(x){x.classList.toggle("on",x.id===b.dataset.target)});
})});
var presets=[
{id:"ag",metal:"Ag",ox:1,lig:"NH₃",ligName:"аммиак",ligCharge:0,total:2,cn:2,formula:"[Ag(NH₃)₂]⁺",salt:"[Ag(NH₃)₂]Cl",name:"Диамминсеребро(I)",geometry:"Линейная",note:"Две молекулы аммиака связаны с Ag⁺ через атомы азота. Степень окисления серебра не меняется.",color:"#a890f7"},
{id:"al",metal:"Al",ox:3,lig:"OH",ligName:"гидроксид-ион",ligCharge:-1,total:4,cn:4,formula:"[Al(OH)₄]⁻",salt:"Na[Al(OH)₄]",name:"Тетрагидроксоалюминат",geometry:"Тетраэдрическая",note:"В избытке щёлочи осадок Al(OH)₃ растворяется за счёт образования гидроксокомплекса.",color:"#63b8ef"},
{id:"zn",metal:"Zn",ox:2,lig:"OH",ligName:"гидроксид-ион",ligCharge:-1,total:4,cn:4,formula:"[Zn(OH)₄]²⁻",salt:"Na₂[Zn(OH)₄]",name:"Тетрагидроксоцинкат",geometry:"Тетраэдрическая",note:"Цинк сохраняет степень окисления +2. Для образования анионного комплекса достаточно четырёх OH⁻.",color:"#51c5b0"},
{id:"co",metal:"Co",ox:3,lig:"NH₃",ligName:"аммиак",ligCharge:0,total:6,cn:6,formula:"[Co(NH₃)₆]³⁺",salt:"[Co(NH₃)₆]Cl₃",name:"Гексаамминкобальт(III)",geometry:"Октаэдрическая",note:"Соединение Co(III) с шестью нейтральными лигандами NH₃. Для получения из соли Co(II) требуется окисление.",color:"#a176ee"},
{id:"fe",metal:"Fe",ox:2,lig:"CN",ligName:"цианид-ион",ligCharge:-1,total:6,cn:6,formula:"[Fe(CN)₆]⁴⁻",salt:"K₄[Fe(CN)₆]",name:"Гексацианоферрат(II)",geometry:"Октаэдрическая",note:"Шесть отрицательных лигандов дают −6, железо +2, поэтому заряд частицы −4. Только теоретический разбор.",color:"#5d9ed8"},
{id:"pt",metal:"Pt",ox:4,lig:"Cl",ligName:"хлорид-ион",ligCharge:-1,total:6,cn:6,formula:"[PtCl₆]²⁻",salt:"K₂[PtCl₆]",name:"Гексахлороплатинат(IV)",geometry:"Октаэдрическая",note:"Шесть Cl⁻ дают −6, Pt(IV) даёт +4, поэтому заряд комплексного иона −2.",color:"#75cba5"},
{id:"cr",metal:"Cr",ox:3,lig:"H₂O",ligName:"вода",ligCharge:0,total:6,cn:6,formula:"[Cr(H₂O)₆]³⁺",salt:"[Cr(H₂O)₆]Cl₃",name:"Гексааквахром(III)",geometry:"Октаэдрическая",note:"Вода тоже лиганд: атом кислорода предоставляет неподелённую пару электронов.",color:"#61b7e8"},
{id:"cu",metal:"Cu",ox:2,lig:"NH₃",ligName:"аммиак",ligCharge:0,total:4,cn:6,formula:"[Cu(NH₃)₄(H₂O)₂]²⁺",salt:"[Cu(NH₃)₄(H₂O)₂]SO₄",name:"Тетраамминдиаквамедь(II)",geometry:"Искажённая октаэдрическая",note:"У меди четыре NH₃ и дополнительно две H₂O. Координационное число 6; цвет раствора интенсивно-синий.",color:"#538ce9"}
];
var preset=$("#complex-select"),add=$("#add-ligand"),remove=$("#remove-ligand"),complete=$("#complete-ligands"),count=0,chosen=presets[0];
function supers(n){if(n===0)return "⁰";var s=Math.abs(n);return (s===1?"":String(s).replace(/[0-9]/g,function(d){return "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]}))+(n>0?"⁺":"⁻")}
function roman(n){return {1:"I",2:"II",3:"III",4:"IV"}[n]||String(n)}
function svgEscape(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function updateBuilder(){
var charge=chosen.ox+count*chosen.ligCharge;
if($("#builder-count"))$("#builder-count").textContent=count+" / "+chosen.total;
if($("#builder-charge"))$("#builder-charge").textContent=(charge>0?"+":"")+charge;
if($("#builder-oxidation"))$("#builder-oxidation").textContent="+"+chosen.ox;
if($("#builder-coordination"))$("#builder-coordination").textContent=count===chosen.total?chosen.cn:String(count);
var f;
if(count===0)f=chosen.metal+supers(chosen.ox);
else if(count===chosen.total)f=chosen.formula;
else f="["+chosen.metal+(chosen.lig.length>2?"("+chosen.lig+")":chosen.lig)+(count>1?String(count).replace(/[0-9]/g,function(d){return "₀₁₂₃₄₅₆₇₈₉"[Number(d)]}):"")+"]"+supers(charge);
$("#builder-formula").textContent=f;
$("#builder-name").textContent=count===chosen.total?chosen.name:"Добавлено лигандов: "+count;
$("#builder-description").textContent=count===chosen.total?chosen.note:"На промежуточном шаге показан расчётный состав. Запись не доказывает, что такая частица существует как устойчивый комплекс.";
$("#builder-salt").textContent=count===chosen.total?"Пример соли: "+chosen.salt:"Добавь все лиганды для получения характерного комплекса.";
$("#add-ligand").disabled=count>=chosen.total;
$("#remove-ligand").disabled=count<=0;
drawBuilder();
}
function drawBuilder(){
var svg=$("#builder-svg");if(!svg)return;
var cX=220,cY=131,lines="",nodes="",n=count;
var positions={2:[[-122,0],[122,0]],4:[[0,-97],[105,0],[0,97],[-105,0]],6:[[0,-106],[103,-35],[103,55],[0,106],[-103,55],[-103,-35]]};
var spots=positions[chosen.total]||positions[4]; 
var arr=[];
for(var i=0;i<n;i++){var p=spots[i];if(chosen.total===4&&n<4)p=[[0,-96],[105,0],[0,96],[-105,0]][i];arr.push(p)}
arr.forEach(function(p,i){
var x=cX+p[0],y=cY+p[1];var dx=p[0],dy=p[1],len=Math.hypot(dx,dy)||1;
lines+='<line x1="'+(cX+dx/len*31)+'" y1="'+(cY+dy/len*31)+'" x2="'+(x-dx/len*34)+'" y2="'+(y-dy/len*20)+'" stroke="#b2a5f3" stroke-width="3" stroke-linecap="round" opacity=".85"/>';
var lab=chosen.lig;
if(chosen.id==="cu"&&i>=4)lab="H₂O";
nodes+='<rect x="'+(x-35)+'" y="'+(y-20)+'" width="70" height="40" rx="16" fill="#514883" stroke="#8f81ce"/><text x="'+x+'" y="'+(y+6)+'" fill="#fff" font-family="Arial,sans-serif" font-size="17" text-anchor="middle" font-weight="700">'+svgEscape(lab)+'</text>';
});
svg.innerHTML='<defs><radialGradient id="metalf"><stop stop-color="'+chosen.color+'"/><stop offset="1" stop-color="#5044ab"/></radialGradient></defs><circle cx="220" cy="131" r="108" stroke="#8375d0" stroke-dasharray="5 9" stroke-opacity=".25" fill="none"/>'+lines+'<circle cx="220" cy="131" r="38" fill="url(#metalf)" stroke="#c8bcff" stroke-width="2"/><text x="220" y="138" fill="#fff" font-size="22" font-weight="800" text-anchor="middle" font-family="Arial,sans-serif">'+chosen.metal+'</text>'+nodes;
}
if(preset){
presets.forEach(function(p){var o=document.createElement("option");o.value=p.id;o.textContent=p.metal+" · "+p.name;preset.appendChild(o)});
preset.addEventListener("change",function(){chosen=presets.find(function(p){return p.id===preset.value})||presets[0];count=0;updateBuilder()});
add.addEventListener("click",function(){if(count<chosen.total){count++;updateBuilder()}});
remove.addEventListener("click",function(){if(count>0){count--;updateBuilder()}});
complete.addEventListener("click",function(){count=chosen.total;updateBuilder()});
updateBuilder();
}
var pairSteps=[
{title:"Шаг 1. У азота есть свободная пара",text:"В NH₃ атом азота образует три связи N-H. Два оставшихся валентных электрона образуют неподелённую пару.",html:'<text x="85" y="107" font-size="35" fill="#332458" font-weight="800">H₃N</text><circle cx="164" cy="91" r="6" fill="#8955db"/><circle cx="164" cy="108" r="6" fill="#8955db"/><text x="205" y="105" font-size="16" fill="#7263a2">•• = пара</text>'},
{title:"Шаг 2. Пара направлена к акцептору",text:"Ag⁺ может взаимодействовать с электронной парой азота. Стрелка N: → Ag⁺ показывает направление донорно-акцепторного взаимодействия.",html:'<text x="37" y="109" font-size="32" fill="#332458" font-weight="800">H₃N</text><circle cx="120" cy="91" r="5" fill="#8955db"/><circle cx="120" cy="107" r="5" fill="#8955db"/><path d="M141 101 H224 M210 89 L224 101 L210 113" stroke="#8955db" stroke-width="4" fill="none" stroke-linecap="round"/><text x="245" y="109" font-size="31" fill="#332458" font-weight="800">Ag⁺</text>'},
{title:"Шаг 3. Образуется комплекс",text:"Две молекулы NH₃ координируются к Ag⁺. Пара становится общей в связи Ag-N, а формальная степень окисления Ag остаётся +1.",html:'<text x="26" y="109" font-size="29" fill="#332458" font-weight="800">H₃N</text><path d="M104 97 H139 M212 97 H246" stroke="#8955db" stroke-width="4"/><text x="145" y="109" font-size="30" fill="#332458" font-weight="800">Ag</text><text x="247" y="109" font-size="29" fill="#332458" font-weight="800">NH₃</text><path d="M14 60 H6 V141 H14 M326 60 H334 V141 H326" stroke="#7965c0" stroke-width="2" fill="none"/><text x="327" y="55" font-size="23" fill="#6d4cca">+</text>'}
];
function stepPair(i){
var p=pairSteps[i];$("#pair-title").textContent=p.title;$("#pair-text").textContent=p.text;$("#pair-svg").innerHTML=p.html;
$$("[data-pair]").forEach(function(b){var yes=Number(b.dataset.pair)===i;b.classList.toggle("selected",yes);b.setAttribute("aria-pressed",String(yes))});
}
$$("[data-pair]").forEach(function(b){b.addEventListener("click",function(){stepPair(Number(b.dataset.pair))})});
if($("#pair-svg"))stepPair(0);
var questions=[
{q:"Сколько неподелённых электронных пар у атома азота в NH₃?",o:["Ни одной","Одна","Две","Три"],a:1,e:"Азот имеет пять валентных электронов. Три участвуют в связях N-H, оставшиеся два составляют одну неподелённую пару."},
{q:"Кто предоставляет электронную пару при связывании NH₃ с Ag⁺?",o:["Ион серебра","Атом водорода","Атом азота","Противоион Cl⁻"],a:2,e:"Донор - азот в NH₃. Его неподелённая электронная пара участвует в образовании координационной связи."},
{q:"Чему равен заряд иона [Al(OH)₄]?",o:["+3","−1","−4","0"],a:1,e:"+3 + 4×(−1) = −1. Алюминий остаётся в степени окисления +3."},
{q:"Какая формула соответствует соли тетрагидроксоцинката натрия?",o:["Na[Zn(OH)₄]","Na₂[Zn(OH)₄]","Na₄[Zn(OH)₂]","Zn(OH)₂"],a:1,e:"[Zn(OH)₄]²⁻ имеет заряд −2, значит требуются два иона Na⁺."},
{q:"Сколько молекул NH₃ в [Co(NH₃)₆]Cl₃?",o:["Три","Шесть","Девять","Одна"],a:1,e:"Индекс 6 указывает на шесть молекул аммиака внутри координационной сферы."},
{q:"Какова степень окисления Co в [Co(NH₃)₆]Cl₃?",o:["+2","+6","+3","0"],a:2,e:"Три внешних Cl⁻ означают заряд комплекса +3; NH₃ нейтрален, значит Co имеет степень окисления +3."},
{q:"Какая степень окисления Fe в K₄[Fe(CN)₆]?",o:["+2","+3","+4","+6"],a:0,e:"Четыре K⁺ компенсируют комплекс с зарядом −4. x−6=−4, поэтому x=+2."},
{q:"Что случится с Al(OH)₃ при добавлении избытка NaOH?",o:["Выделится алюминий","Осадок растворится с образованием [Al(OH)₄]⁻","Образуется H₂","Образуется Al₂O₃"],a:1,e:"Al(OH)₃ - амфотерный гидроксид: Al(OH)₃ + OH⁻ → [Al(OH)₄]⁻."},
{q:"Каково координационное число в [Cu(NH₃)₄(H₂O)₂]²⁺?",o:["2","4","6","8"],a:2,e:"Четыре NH₃ и две H₂O координируются через шесть донорных атомов."},
{q:"Что находится за квадратными скобками в [Co(NH₃)₆]Cl₃?",o:["Три лиганда Cl⁻","Три противоиона Cl⁻","Три атома хлора, ковалентно связанные с Co","Три электрона"],a:1,e:"Внутри скобок - координационная сфера, три внешних Cl⁻ балансируют заряд +3."},
{q:"Какая частица имеет линейную геометрию?",o:["[Ag(NH₃)₂]⁺","[Co(NH₃)₆]³⁺","[Zn(OH)₄]²⁻","[Fe(CN)₆]⁴⁻"],a:0,e:"Для типичного диамминсеребра(I) характерны две связи Ag-N и линейное расположение N-Ag-N."},
{q:"Что происходит со степенью окисления Ag при образовании [Ag(NH₃)₂]⁺ из Ag⁺?",o:["+1 превращается в −1","+1 превращается в +2","Не меняется","Становится нулевой"],a:2,e:"Образование координационной связи с нейтральным NH₃ не является восстановлением серебра."},
{q:"Почему добавление кислоты может разрушить амминокомплекс?",o:["Кислота связывает NH₃ в NH₄⁺","Кислота всегда восстанавливает металлы","Все комплексы взрываются в кислоте","Кислота удаляет атомы азота"],a:0,e:"Протонирование аммиака снижает концентрацию свободного NH₃, смещая равновесие комплексообразования."},
{q:"Какой гидроксид при обычных условиях НЕ растворяется в избытке водного NaOH?",o:["Al(OH)₃","Zn(OH)₂","Fe(OH)₃","Оба Al(OH)₃ и Zn(OH)₂"],a:2,e:"Fe(OH)₃ не ведёт себя как Zn(OH)₂ и Al(OH)₃ в обычных школьных условиях."},
{q:"Какой ион комплексный анион?",o:["[Ag(NH₃)₂]⁺","[Co(NH₃)₆]³⁺","[Zn(OH)₄]²⁻","[Cu(NH₃)₄(H₂O)₂]²⁺"],a:2,e:"Суммарный заряд [Zn(OH)₄]²⁻ равен −2, поэтому это анионный комплекс."},
{q:"Кто окислитель при получении Co(III) из Co(II) в аммиачной среде с H₂O₂?",o:["NH₃","Co²⁺","H₂O₂","Cl⁻"],a:2,e:"Пероксид водорода принимает электроны. Образование Co-N связей само по себе не изменяет степень окисления."},
{q:"Почему координационное число не всегда равно числу лигандов?",o:["Потому что лиганды всегда нейтральны","Потому что один лиганд может связываться через несколько донорных атомов","Из-за квадратных скобок","Из-за степени окисления кислорода"],a:1,e:"Бидентатные лиганды, например этилендиамин en, присоединяются через два донорных атома."},
{q:"Какие коэффициенты у Zn(OH)₂ + NaOH → Na₂[Zn(OH)₄]?",o:["1, 1, 1","1, 2, 1","2, 1, 2","1, 4, 1"],a:1,e:"Zn(OH)₂ + 2NaOH → Na₂[Zn(OH)₄]. Две дополнительные OH-группы входят в состав комплекса."},
{q:"Какова степень окисления Pt в K₂[PtCl₆]?",o:["+2","+3","+4","+6"],a:2,e:"Заряд [PtCl₆]²⁻ равен −2. x−6=−2, следовательно x=+4."},
{q:"Как классифицировать [Pt(NH₃)₂Cl₂] при Pt(+2)?",o:["Катионный","Анионный","Нейтральный","Это ион водорода"],a:2,e:"+2 от Pt и −2 от двух Cl⁻ компенсируются, NH₃ нейтрален. Общий заряд 0."}
];
var index=0,selected=null,answers=[],isChecked=false;
function renderQuiz(){
var slot=$("#quiz-zone");if(!slot)return;
if(index>=questions.length){var good=answers.filter(Boolean).length;slot.innerHTML='<div class="quiz-score">'+good+' / '+questions.length+'</div><h3>'+(good>=18?"Отличное понимание!":good>=14?"Очень хороший результат":"Продолжим тренироваться")+'</h3><p class="muted">Ты прошёл все 20 вопросов. Ошибки можно разобрать по объяснениям в задачах, затем повторить тест.</p><button id="quiz-restart" class="btn">Пройти ещё раз</button>';$("#quiz-restart").addEventListener("click",function(){index=0;selected=null;answers=[];isChecked=false;renderQuiz()});$("#quiz-progress").style.width="100%";$("#quiz-position").textContent="20 из 20";return}
var q=questions[index];$("#quiz-position").textContent=(index+1)+" из "+questions.length;$("#quiz-progress").style.width=(index/questions.length*100)+"%";
var html='<div class="quiz-top"><span class="tag">'+(index<7?"Разминка":index<14?"Применение":"Продвинутый уровень")+'</span><span class="small muted">Правильных: '+answers.filter(Boolean).length+'</span></div><h3>'+q.q+'</h3><div class="choices">';
q.o.forEach(function(v,i){var classes="choice"+(selected===i?" sel":"")+(isChecked&&i===q.a?" correct":"")+(isChecked&&selected===i&&i!==q.a?" wrong":"");html+='<button type="button" class="'+classes+'" data-choice="'+i+'" '+(isChecked?"disabled":"")+'><span class="letter">'+String.fromCharCode(65+i)+'</span><span>'+v+'</span></button>'});
html+='</div><div class="quiz-feedback '+(isChecked?(selected===q.a?"good":"bad"):"")+'" aria-live="polite">'+(isChecked?(selected===q.a?"Верно. ":"Правильный ответ: "+q.o[q.a]+". ")+q.e:"")+'</div><div class="quiz-bottom"><button class="btn" id="quiz-action" '+(selected===null?"disabled":"")+'>'+(isChecked?(index===questions.length-1?"Завершить":"Следующий вопрос →"):"Проверить ответ")+'</button><button class="btn outline" id="quiz-skip" '+(isChecked?"disabled":"")+'>Пропустить</button></div>';
slot.innerHTML=html;
$$("[data-choice]").forEach(function(b){b.addEventListener("click",function(){if(!isChecked){selected=Number(b.dataset.choice);renderQuiz()}})});
$("#quiz-action").addEventListener("click",function(){if(!isChecked){isChecked=true;answers.push(selected===q.a);renderQuiz()}else{index++;selected=null;isChecked=false;renderQuiz()}});
$("#quiz-skip").addEventListener("click",function(){if(!isChecked){selected=-1;isChecked=true;answers.push(false);renderQuiz()}});
}
renderQuiz();
var taskChecks={
"charge-ag":{answer:"1",explain:"Ag⁺ + 2NH₃: +1 + 2×0 = +1."},
"charge-zn":{answer:"-2",explain:"Zn²⁺ + 4OH⁻: +2 − 4 = −2."},
"charge-pt":{answer:"4",explain:"В K₂[PtCl₆] ион комплекса имеет заряд −2. x−6=−2, x=+4."},
"count-co":{answer:"6",explain:"У [Co(NH₃)₆]³⁺ координационное число 6."},
"count-cu":{answer:"6",explain:"4 NH₃ и 2 H₂O связаны через шесть донорных атомов."}
};
$$("[data-check]").forEach(function(btn){btn.addEventListener("click",function(){var key=btn.dataset.check,obj=taskChecks[key],input=$('[data-input="'+key+'"]'),reply=$('[data-result="'+key+'"]');if(!obj||!input||!reply)return;var v=input.value.trim().replace(/,/g,".").replace(/\s/g,"").replace(/−/g,"-").replace(/\+/g,"");var good=Number(v)===Number(obj.answer)&&v!=="";reply.textContent=(good?"Верно. ":"Пока неверно. ")+obj.explain;reply.style.color=good?"#147c65":"#a34a60"})});
var toast=$("#toast");if($("#copy-summary"))$("#copy-summary").addEventListener("click",function(){var s="Комплекс: центральный атом + лиганды. Донор - лиганд с электронной парой; акцептор - металл. Заряд комплекса = степень окисления центра + сумма зарядов лигандов. [Ag(NH₃)₂]⁺: +1. [Al(OH)₄]⁻: -1. [Zn(OH)₄]²⁻: -2. [Co(NH₃)₆]³⁺: +3. Координационное число равно числу донорных атомов.";if(navigator.clipboard){navigator.clipboard.writeText(s).then(function(){if(toast){toast.textContent="Краткая схема скопирована";toast.classList.add("visible");setTimeout(function(){toast.classList.remove("visible")},2200)}})}});
if($("#print-page"))$("#print-page").addEventListener("click",function(){window.print()});
})();
