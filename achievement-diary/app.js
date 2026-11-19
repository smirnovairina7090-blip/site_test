(function(){
  'use strict';
  var config=JSON.parse(document.getElementById('diary-config').textContent);
  var KEY='creitivika-achievement-diary-v1';
  var fieldIds=['student','course','teacher','period','routeNumber','newSkill','result','nextGoal'];
  var eventIds=['eventOlympiad','eventProject','eventFriend'];
  var colors=config.colors.map(function(c){return c[1];});
  var $=function(id){return document.getElementById(id);};
  function blank(){return {version:1,fields:{routeNumber:'1'},lessons:Array.from({length:8},function(){return {date:'',note:'',color:'',done:false};}),bingo:Array(9).fill(false),awards:Array(6).fill(false),events:Array(3).fill(false),materialsUrl:''};}
  function clean(raw){
    if(!raw||raw.version!==1||!raw.fields||!Array.isArray(raw.lessons)||raw.lessons.length!==8||!Array.isArray(raw.bingo)||raw.bingo.length!==9||!Array.isArray(raw.awards)||raw.awards.length!==6||!Array.isArray(raw.events)||raw.events.length!==3)throw new Error('Неверный формат файла дневника');
    var s=blank();
    fieldIds.forEach(function(id){s.fields[id]=String(raw.fields[id]||'').slice(0,150);});
    s.fields.routeNumber=String(raw.fields.routeNumber||'1').slice(0,3);
    s.lessons=raw.lessons.map(function(x){x=x||{};return {date:String(x.date||'').slice(0,10),note:String(x.note||'').slice(0,95),color:colors.indexOf(x.color)>=0?x.color:'',done:x.done===true&&colors.indexOf(x.color)>=0};});
    s.bingo=raw.bingo.map(function(x){return x===true;});
    s.awards=raw.awards.map(function(x){return x===true;});
    s.events=raw.events.map(function(x){return x===true;});
    if(raw.materialsUrl){var u=new URL(String(raw.materialsUrl));if(u.protocol==='https:'||u.protocol==='http:')s.materialsUrl=u.href;}
    return s;
  }
  var state=blank();
  var storageOK=true;
  try{var old=localStorage.getItem(KEY);if(old)state=clean(JSON.parse(old));}catch(e){storageOK=false;$('saveStatus').textContent='Автосохранение недоступно. Скачайте прогресс перед выходом.';}
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;$('saveStatus').textContent='Прогресс сохранён в этом браузере';}
    catch(e){storageOK=false;$('saveStatus').textContent='Не удалось сохранить. Скачайте файл прогресса.';}
  }
  var toastTimer;
  function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').classList.remove('show');},3500);}
  function lineCount(){
    return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].filter(function(line){return line.every(function(i){return state.bingo[i];});}).length;
  }
  function paint(){
    fieldIds.forEach(function(id){$(id).value=state.fields[id]||'';});
    state.lessons.forEach(function(l,i){
      $('date-'+i).value=l.date;$('note-'+i).value=l.note;
      var zone=$('zone-'+(i+1));zone.style.fill=l.done?l.color:'#ffffff';zone.setAttribute('aria-pressed',String(l.done));
      document.querySelectorAll('[data-lesson="'+i+'"]').forEach(function(btn){btn.classList.toggle('done',l.done);btn.style.backgroundColor=l.done?l.color:'#ffffff';});
    });
    state.bingo.forEach(function(v,i){$('bingo-'+i).setAttribute('aria-pressed',String(v));if(i===4)document.querySelector('[data-bingo="4"]').setAttribute('aria-pressed',String(v));});
    state.awards.forEach(function(v,i){document.querySelector('[data-award="'+i+'"]').setAttribute('aria-pressed',String(v));});
    state.events.forEach(function(v,i){$(eventIds[i]).checked=v;});
    var completed=state.lessons.filter(function(l){return l.done;}).length;
    $('lessonCounter').textContent=completed+' из 8';
    var lines=lineCount();
    $('bingoStatus').textContent=lines?'Бинго! Линий: '+lines:state.bingo.filter(Boolean).length+' из 9';
    $('bingoStatus').classList.toggle('win',lines>0);
    $('materialsLink').href=state.materialsUrl||'https://skillspace.ru/';
    $('materialsLink').textContent=state.materialsUrl?'Открыть материалы':'Открыть Skillspace';
  }
  fieldIds.forEach(function(id){$(id).addEventListener('input',function(){state.fields[id]=$(id).value;save();});});
  state.lessons.forEach(function(l,i){
    ['date','note'].forEach(function(k){$(k+'-'+i).addEventListener('input',function(){state.lessons[i][k]=this.value;save();});});
  });
  eventIds.forEach(function(id,i){$(id).addEventListener('change',function(){state.events[i]=this.checked;save();});});
  document.querySelectorAll('[data-bingo]').forEach(function(btn){
    btn.addEventListener('click',function(){var i=Number(this.dataset.bingo);var before=lineCount();state.bingo[i]=!state.bingo[i];save();paint();if(lineCount()>before)toast('Бинго! Ещё одна линия твоих умений.');});
  });
  document.querySelectorAll('[data-award]').forEach(function(btn){
    btn.addEventListener('click',function(){var i=Number(this.dataset.award);state.awards[i]=!state.awards[i];save();paint();if(state.awards[i])toast('Награда отмечена: '+config.awards[i][0]);});
  });
  var currentLesson=0,currentColor=colors[0];
  function localDate(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function showPalette(){document.querySelectorAll('[data-color]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.color===currentColor));});$('colorName').textContent=config.colors.find(function(c){return c[1]===currentColor;})[0];}
  config.colors.forEach(function(c){var b=document.createElement('button');b.type='button';b.dataset.color=c[1];b.style.backgroundColor=c[1];b.setAttribute('aria-label',c[0]);b.setAttribute('aria-pressed','false');b.addEventListener('click',function(){currentColor=c[1];showPalette();});$('palette').appendChild(b);});
  function openLesson(i){
    currentLesson=i;var l=state.lessons[i];currentColor=l.color||colors[i];
    $('lessonDialogTitle').textContent='Занятие '+(i+1);
    $('dialogDate').value=/^\d{4}-\d{2}-\d{2}$/.test(l.date)?l.date:localDate();
    $('dialogNote').value=l.note;showPalette();$('lessonDialog').showModal();
  }
  document.querySelectorAll('[data-lesson]').forEach(function(b){b.addEventListener('click',function(){openLesson(Number(this.dataset.lesson));});});
  for(var i=0;i<8;i++)(function(i){var z=$('zone-'+(i+1));z.addEventListener('click',function(){openLesson(i);});z.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openLesson(i);}});})(i);
  $('lessonForm').addEventListener('submit',function(e){e.preventDefault();var l=state.lessons[currentLesson];l.date=$('dialogDate').value;l.note=$('dialogNote').value;l.color=currentColor;l.done=true;save();paint();$('lessonDialog').close();toast(state.lessons.every(function(x){return x.done;})?'Все восемь занятий в цвете! Заполни свой итог.':'Часть ракеты раскрашена. Ещё один шаг!');});
  $('clearLessonBtn').addEventListener('click',function(){state.lessons[currentLesson].done=false;save();paint();$('lessonDialog').close();});
  document.querySelectorAll('[data-close]').forEach(function(b){b.addEventListener('click',function(){b.closest('dialog').close();});});
  document.querySelectorAll('dialog').forEach(function(d){d.addEventListener('click',function(e){if(e.target===d){var r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});});
  $('printBtn').addEventListener('click',function(){window.print();});
  $('optionsBtn').addEventListener('click',function(){cancelConfirm();$('optionsDialog').showModal();});
  function download(){
    var blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='creitivika-diary-route-'+(state.fields.routeNumber||'1')+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  }
  $('exportBtn').addEventListener('click',download);
  $('importBtn').addEventListener('click',function(){$('importFile').click();});
  var pendingAction=null;
  function confirmAction(message,fn){pendingAction=fn;$('confirmText').textContent=message;$('confirmText').classList.remove('hidden');$('confirmActions').classList.remove('hidden');}
  function cancelConfirm(){pendingAction=null;$('confirmText').classList.add('hidden');$('confirmActions').classList.add('hidden');}
  $('confirmBtn').addEventListener('click',function(){if(pendingAction){var f=pendingAction;cancelConfirm();f();}});
  $('cancelConfirmBtn').addEventListener('click',cancelConfirm);
  $('importFile').addEventListener('change',async function(){
    var file=this.files[0];this.value='';if(!file)return;
    if(file.size>1000000){toast('Этот файл слишком большой для дневника.');return;}
    try{var imported=clean(JSON.parse(await file.text()));confirmAction('Загруженный файл заменит текущий прогресс. Сначала сохраните его, если он нужен.',function(){state=imported;save();paint();$('optionsDialog').close();toast('Дневник загружен.');});}
    catch(e){toast('Не удалось открыть файл. Выберите файл прогресса этого дневника.');}
  });
  $('resetBtn').addEventListener('click',function(){confirmAction('Очистить все записи этого дневника? Сохраните файл прогресса, если хотите оставить копию.',function(){state=blank();$('skillLogin').value='';$('skillPassword').value='';save();paint();$('optionsDialog').close();toast('Дневник очищен.');});});
  $('newRouteBtn').addEventListener('click',function(){confirmAction('Скачать текущий маршрут и открыть новый лист на 8 занятий? Имя, направление и преподаватель сохранятся.',function(){download();var old=state;state=blank();['student','course','teacher'].forEach(function(k){state.fields[k]=old.fields[k]||'';});state.fields.routeNumber=String(Math.min(999,(parseInt(old.fields.routeNumber,10)||1)+1));state.materialsUrl=old.materialsUrl;save();paint();$('optionsDialog').close();toast('Новый маршрут готов. Предыдущий скачан в файл.');});});
  $('materialsSettings').addEventListener('click',function(){$('materialsUrl').value=state.materialsUrl;$('materialsDialog').showModal();});
  $('materialsForm').addEventListener('submit',function(e){e.preventDefault();try{var url=new URL($('materialsUrl').value);if(url.protocol!=='https:'&&url.protocol!=='http:')throw new Error();state.materialsUrl=url.href;save();paint();$('materialsDialog').close();toast('Ссылка на материалы сохранена.');}catch(e){toast('Укажите полный адрес, начиная с https://');}});
  paint();
})();
