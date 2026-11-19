(function(){
  'use strict';
  var config=JSON.parse(document.getElementById('diary-config').textContent);
  var KEY='creitivika-achievement-diary-v3';
  var fieldIds=['student','course','teacher','period','routeNumber','newSkill','result','proof','nextGoal'];
  var eventIds=['friendInvited','friendVisited'];
  var colors=config.colors.map(function(c){return c[1];});
  var robotPixels=null,robotRegions=null,robotContext=null,robotConfig=JSON.parse(document.getElementById('robot-config').textContent);
  function drawRobot(){
    if(!robotPixels)return;
    var frame=new ImageData(new Uint8ClampedArray(robotPixels.data),robotConfig.width,robotConfig.height);
    for(var p=0;p<robotRegions.length;p++){
      var region=robotRegions[p]-1;
      if(region<0||!state.lessons[region].done)continue;
      var color=state.lessons[region].color;
      for(var channel=0;channel<3;channel++)frame.data[p*4+channel]=parseInt(color.slice(1+channel*2,3+channel*2),16);
    }
    robotContext.putImageData(frame,0,0);
    document.querySelectorAll('[data-robot-lesson]').forEach(function(b){var i=Number(b.dataset.robotLesson);b.setAttribute('aria-pressed',String(state.lessons[i].done));});
  }
  function setupRobot(){
    var canvas=document.getElementById('robotCanvas');robotContext=canvas.getContext('2d',{willReadFrequently:true});
    var img=new Image();img.onload=function(){
      robotContext.drawImage(img,0,0,canvas.width,canvas.height);robotPixels=robotContext.getImageData(0,0,canvas.width,canvas.height);
      var width=canvas.width,height=canvas.height,pixels=robotPixels.data;
      robotRegions=new Uint8Array(width*height);var queue=new Int32Array(width*height);
      function eligible(i){return i>=0&&i<width*height&&!robotRegions[i]&&pixels[i*4]>robotConfig.threshold&&pixels[i*4+1]>robotConfig.threshold&&pixels[i*4+2]>robotConfig.threshold;}
      robotConfig.seeds.forEach(function(seeds,g){seeds.forEach(function(seed){
        var first=seed[1]*width+seed[0];if(!eligible(first))return;
        var head=0,tail=1;queue[0]=first;robotRegions[first]=g+1;
        while(head<tail){var i=queue[head++],x=i%width;var neighbors=[i-width,i+width];if(x)neighbors.push(i-1);if(x<width-1)neighbors.push(i+1);
          neighbors.forEach(function(n){if(eligible(n)){robotRegions[n]=g+1;queue[tail++]=n;}});
        }
      });});
      canvas.parentElement.classList.add('robot-ready');drawRobot();
    };img.src='assets/robot-coloring.webp';
  }
  var $=function(id){return document.getElementById(id);};
  function blank(){return {version:3,fields:{routeNumber:'1'},lessons:Array.from({length:8},function(){return {date:'',note:'',color:'',done:false};}),bingo:Array(9).fill(false),awards:Array(config.awards.length).fill(false),events:Array(2).fill(false),materialsUrl:''};}
  function clean(raw){
    if(!raw||(raw.version!==1&&raw.version!==2&&raw.version!==3)||!raw.fields||!Array.isArray(raw.lessons)||raw.lessons.length!==8||!Array.isArray(raw.bingo)||raw.bingo.length!==9||!Array.isArray(raw.awards)||raw.awards.length!==(raw.version===1?6:raw.version===2?4:config.awards.length)||!Array.isArray(raw.events)||raw.events.length!==(raw.version===3?2:3))throw new Error('Неверный формат файла дневника');
    var s=blank();
    fieldIds.forEach(function(id){s.fields[id]=String(raw.fields[id]||'').slice(0,id==='newSkill'?44:150);});
    s.fields.routeNumber=String(raw.fields.routeNumber||'1').slice(0,3);
    s.lessons=raw.lessons.map(function(x){x=x||{};return {date:String(x.date||'').slice(0,10),note:String(x.note||'').slice(0,95),color:colors.indexOf(x.color)>=0?x.color:'',done:x.done===true&&colors.indexOf(x.color)>=0};});
    s.bingo=raw.version===3?raw.bingo.map(function(x){return x===true;}):Array(9).fill(false);
    s.awards=raw.version===3?raw.awards.map(function(x){return x===true;}):Array(config.awards.length).fill(false);
    s.events=raw.version===3?raw.events.map(function(x){return x===true;}):[false,raw.events[2]===true];
    if(raw.materialsUrl){var u=new URL(String(raw.materialsUrl));if(u.protocol==='https:'||u.protocol==='http:')s.materialsUrl=u.href;}
    return s;
  }
  var state=blank();
  var storageOK=true;
  try{var old=localStorage.getItem(KEY)||localStorage.getItem('creitivika-achievement-diary-v2')||localStorage.getItem('creitivika-achievement-diary-v1');if(old){var parsed=JSON.parse(old);state=clean(parsed);if(parsed.version<3)$('saveStatus').textContent='Дизайн обновлён. Записи занятий сохранены.';}}catch(e){storageOK=false;$('saveStatus').textContent='Автосохранение недоступно. Скачайте прогресс перед выходом.';}
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
      $('date-'+i).value=/^\d{4}-\d{2}-\d{2}$/.test(l.date)?l.date.slice(8,10)+'.'+l.date.slice(5,7):l.date;$('note-'+i).value=l.note;
      var zone=$('zone-'+(i+1));zone.style.backgroundColor=l.done?l.color:'#ffffff';zone.setAttribute('aria-pressed',String(l.done));
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
    drawRobot();
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
  document.querySelectorAll('[data-robot-lesson]').forEach(function(b){b.addEventListener('click',function(){openLesson(Number(this.dataset.robotLesson));});});
  
  $('lessonForm').addEventListener('submit',function(e){e.preventDefault();var l=state.lessons[currentLesson];l.date=$('dialogDate').value;l.note=$('dialogNote').value;l.color=currentColor;l.done=true;save();paint();$('lessonDialog').close();toast(state.lessons.every(function(x){return x.done;})?'Робот раскрашен! Заполни итог восьми занятий.':'Занятие отмечено. Добавлен ещё один результат!');});
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
  setupRobot();paint();
})();
