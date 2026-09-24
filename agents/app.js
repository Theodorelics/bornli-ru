import {escapeHTML as e,format,mealTotals,parseCSV,tableAnalysis} from './core.js';
import {mealExample,sampleCSV,lessonScenes} from './demo-data.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],app=$('#app');
const valid=['analyst','tutor','nutrition'],params=new URLSearchParams(location.search);
const embeddedDemo=params.get('embedded')==='1'||document.body.dataset.offline==='1';
let agent=valid.includes(params.get('agent'))?params.get('agent'):(document.body.dataset.defaultAgent||'analyst');
document.body.classList.toggle('embedded',embeddedDemo);
let capabilities={live:false},pending=false,controller=null,requestEpoch=0,recognition=null,recordTimer=null;
// Personal material leaves the browser only after a separate, contextual choice.
let privacyResolve=null;
const privacyText={"title": "Перед отправкой", "send": "Выбранный текст, фото или документ будет передан сервису BORNLI и OpenAI для ответа. Не отправляйте конфиденциальную информацию и чужие персональные данные.", "voice": "Распознавание речи работает через сервис браузера и может передавать ему аудио. Распознанный текст можно проверить перед отдельной отправкой ИИ. Вместо голоса можно написать фразу.", "policy": "Как обрабатываются данные", "allow": "Разрешить и продолжить", "cancel": "Отмена", "url": "/ru/privacy.html#demo"};
const privacyDialog=document.createElement('dialog');
privacyDialog.className='demo-privacy';
privacyDialog.setAttribute('aria-labelledby','demo-privacy-title');
privacyDialog.innerHTML=`<h2 id="demo-privacy-title">${privacyText.title}</h2><p class="demo-privacy-copy"></p><a href="${privacyText.url}" target="_blank" rel="noopener noreferrer">${privacyText.policy} ↗</a><div><button type="button" data-privacy="cancel" autofocus>${privacyText.cancel}</button><button type="button" data-privacy="allow">${privacyText.allow}</button></div>`;
const privacyStyle=document.createElement('style');
privacyStyle.textContent='.demo-privacy{width:calc(100% - 36px);max-width:370px;max-height:calc(100svh - 36px);overflow:auto;padding:24px;border:1px solid #d4d8d0;border-radius:22px;background:#f5f6f1;color:#182216;font:15px/1.5 Arial,sans-serif;box-shadow:0 24px 80px #0006}.demo-privacy::backdrop{background:#071008ba}.demo-privacy h2{font:700 24px/1.2 Arial,sans-serif;margin:0 0 15px}.demo-privacy p{margin:0 0 16px}.demo-privacy a{color:inherit;text-underline-offset:3px}.demo-privacy>div{display:grid;grid-template-columns:1fr;gap:10px;margin-top:22px}.demo-privacy button{min-height:44px;border-radius:12px;border:1px solid #cdd3c8;background:white;color:#172214;font:700 14px/1.3 Arial,sans-serif;padding:12px}.demo-privacy button[data-privacy=allow]{background:#d1ff35;border-color:#b1d831}.demo-privacy :focus-visible{outline:3px solid #789b12;outline-offset:3px}';
document.head.append(privacyStyle);document.body.append(privacyDialog);
function settlePrivacy(allowed){const resolve=privacyResolve;privacyResolve=null;if(privacyDialog.open)privacyDialog.close();resolve?.(allowed);}
privacyDialog.addEventListener('click',event=>{const choice=event.target.closest('[data-privacy]')?.dataset.privacy;if(choice)settlePrivacy(choice==='allow');});
privacyDialog.addEventListener('cancel',event=>{event.preventDefault();settlePrivacy(false);});
privacyDialog.addEventListener('close',()=>{if(!privacyDialog.open&&privacyResolve)settlePrivacy(false);});
function confirmTransmission(kind='send'){
 settlePrivacy(false);privacyDialog.querySelector('.demo-privacy-copy').textContent=privacyText[kind];
 return new Promise(resolve=>{privacyResolve=resolve;privacyDialog.showModal();});
}

// Every demo is composed on one 390 × 844 portrait screen. Only uniform scaling.
function fitScreen(){document.documentElement.style.setProperty('--screen-scale',Math.min(innerWidth/390,innerHeight/844,1.18));}
fitScreen();addEventListener('resize',fitScreen,{passive:true});
const samplePhrase='I wants a coffee, please.';
const state={nutrition:{photo:null,file:null,result:null,example:true},tutor:{scene:'cafe',text:samplePhrase,result:null,example:true},analyst:{file:null,result:null,example:true}};
const demoPhrase=()=>state.tutor.scene==='cafe'?samplePhrase:lessonScenes[state.tutor.scene].sample;
const tutorExample=()=>state.tutor.scene==='cafe'?{reply:'Of course! Would you like a small or a large coffee?',correction:'I want a coffee, please.',explanation:'После I — want без окончания -s. Wants используется с he, she, it.'}:Object.fromEntries(['reply','correction','explanation'].map(key=>[key,lessonScenes[state.tutor.scene][key]]));
const exampleResult=id=>id==='nutrition'?structuredClone(mealExample):id==='tutor'?tutorExample():tableAnalysis(parseCSV(sampleCSV));

// Show a clearly labelled example immediately; a personal file replaces it.
const cache=new Map();
const icon=(name='i-arrow')=>`<svg aria-hidden="true"><use href="assets/icons.svg#${name}"/></svg>`;
function notice(text){$('#notice').innerHTML=`${e(text)}<button aria-label="Закрыть сообщение">×</button>`;$('#notice').hidden=false;}
$('#notice').addEventListener('click',()=>$('#notice').hidden=true);
function documentAccept(){return capabilities.live?'.csv,.tsv,.xlsx,.pdf,.txt,.md':'.csv,.tsv';}
function documentCaption(){const file=state.analyst.file;return file?(/\.(csv|tsv)$/i.test(file.name)?'Нажмите «Разобрать файл» — расчёт без ожидания.':'Нажмите «Разобрать файл» — документ обработает ИИ.'):(capabilities.live?'CSV, Excel, PDF или текст · до 3 МБ':'Свои CSV и TSV · до 3 МБ · без отправки на сервер');}
function updateStatus(){if(agent==='analyst'){const input=$('#document-file');if(input)input.accept=documentAccept();const caption=$('.source-caption');if(caption)caption.textContent=documentCaption();}const el=$('#connection');el.textContent=capabilities.live?'ИИ подключён':'Примеры доступны';el.classList.toggle('live',!!capabilities.live);$('#status-hint').textContent=agent==='nutrition'?'Калории и вес — приблизительная оценка.':agent==='tutor'?'Голос — через браузер. Разбор слов и грамматики.':'Главное — на экране. Полный разбор можно скачать.';}
async function checkConnection(){if(document.body.dataset.offline==='1'){updateStatus();return;}try{let r=await fetch(new URL('./capabilities.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(8000)});let data=await r.json();if(data.endpoint==='/api/agents'){r=await fetch('/api/agents',{cache:'no-store',signal:AbortSignal.timeout(9000)});data=await r.json();}if(data.service==='bornli-agents')capabilities={...data,checkedAt:Date.now()};}catch{}updateStatus();}
async function request(action,data){
 const target=action==='nutrition'?'nutrition':['document','document-question'].includes(action)?'analyst':'tutor';if(agent!==target)throw new DOMException('Cancelled','AbortError');
 if(!capabilities.live||Date.now()-(capabilities.checkedAt||0)>10*60000)await checkConnection();
 if(agent!==target)throw new DOMException('Cancelled','AbortError');
 if(!capabilities.live)throw Error('ИИ временно недоступен. Пока можно пройти готовый пример.');
 const consentEpoch=requestEpoch;if(!await confirmTransmission('send')||consentEpoch!==requestEpoch||agent!==target)throw new DOMException('Cancelled','AbortError');
 const ownController=new AbortController(),epoch=requestEpoch,activeAgent=agent;controller=ownController;let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;ownController.abort();},190000);
 try{
  let res=await fetch('/api/agents',{method:'POST',headers:{'Content-Type':'application/json','X-Bornli-Session':capabilities.token||''},body:JSON.stringify({action,quick:true,...data,consent:{accepted:true,version:'2026-09-21',at:new Date().toISOString()}}),signal:ownController.signal});
  let result;try{result=await res.json();}catch{throw Error('Сервер не ответил. Попробуйте ещё раз.');}
  while(res.status===202&&result.pending&&result.job){
   const job=result.job;if(!/^[0-9a-f-]{36}$/.test(job))throw Error('Не удалось получить номер запроса.');
   if($('#pending'))$('#pending').textContent='ИИ готовит короткий ответ…';
   await new Promise((resolve,reject)=>{if(ownController.signal.aborted){reject(new DOMException('Cancelled','AbortError'));return;}const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};const timer=setTimeout(()=>{ownController.signal.removeEventListener('abort',abort);resolve();},1200);ownController.signal.addEventListener('abort',abort,{once:true});});
   res=await fetch('/api/agents?job='+encodeURIComponent(job),{cache:'no-store',headers:{'X-Bornli-Session':capabilities.token||''},signal:ownController.signal});result=await res.json();
  }
  if(epoch!==requestEpoch||agent!==activeAgent)throw new DOMException('Cancelled','AbortError');
  if(!res.ok)throw Error(result.error||'Не удалось обработать запрос. Попробуйте ещё раз.');return result;
 }catch(error){if(error.name==='AbortError'&&timedOut)throw Error('Запрос занял слишком много времени. Попробуйте ещё раз.');throw error;}
 finally{clearTimeout(timeout);if(controller===ownController)controller=null;}
}
async function imageFile(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Выберите JPEG, PNG или WebP.');if(file.size>10*1024*1024)throw Error('Фото должно быть меньше 10 МБ.');
 const source=await fileData(file);const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Не удалось открыть изображение.'));img.src=source;});
 const scale=Math.min(1,1400/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.84);
}
const fileData=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Не удалось прочитать файл.'));reader.readAsDataURL(file);});
function upload(id,label,accept){return `<label class="upload">${icon('i-upload')}${label}<input id="${id}" class="upload-input" type="file" accept="${accept}" aria-label="${label}"></label>`;}
function sourceHTML(){
 const s=state[agent];
 if(agent==='nutrition')return `<div class="source-top"><span class="source-tag">${icon('i-spark')}${s.photo?'Ваше фото':'Пример · роллы'}</span>${upload('food-file','Своё фото','image/jpeg,image/png,image/webp')}</div><div class="photo-wrap"><img class="photo" src="${e(s.photo||'assets/sushi-editorial.webp')}" alt="${s.photo?'Ваше блюдо':'Роллы с лососем — учебный пример'}"><button type="button" class="photo-caption" data-action="replace-photo">${icon('i-edit')}Заменить</button></div>`;
 if(agent==='tutor')return `<div class="source-top"><span id="input-kind">${icon('i-spark')}${s.example?'Пример · измените фразу для ИИ':'Ваша фраза'}</span><span class="scene">${icon('i-cup')}<span id="voice-status">${e(lessonScenes[s.scene].label)}</span></span></div><div class="source-text"><div class="writing-area"><textarea id="tutor-input" maxlength="300" aria-label="Ваша фраза на английском" placeholder="Напишите фразу на английском">${e(s.text)}</textarea><span class="voice-handnote handwriting" aria-hidden="true">Можно нажать<br>и говорить <b>↗</b></span><div class="input-tools"><span id="char-count">${s.text.length}/300</span><button type="button" class="hint" data-action="hint">${icon('i-bulb')}Подсказка</button><button type="button" class="hint alternate" data-action="next-phrase">${icon('i-reset')}Другой вариант</button></div></div><button class="mic" type="button" data-action="record" aria-label="Ответить голосом" aria-pressed="false"><img src="assets/microphone.svg" alt=""><span>Говорить</span><span class="wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></button></div><p class="source-caption handwriting">Одна фраза — уже практика.</p>`;
 const name=s.file?s.file.name:'продажи.csv',size=s.file?(s.file.size<1024?`${s.file.size} Б`:`${format(s.file.size/1024)} КБ`):'6 строк · учебные данные';
 return `<div class="source-top"><span>${s.file?'Ваш файл':'Готовый пример'}</span>${upload('document-file',s.file?'Заменить файл':'Загрузить свой файл',documentAccept())}</div><div class="doc-content" data-dropzone><div class="doc-ready"><span class="file-icon">${icon('i-file')}<b>${e(name.split('.').pop().toUpperCase().slice(0,4))}</b></span><div><h2 title="${e(name)}">${e(name)}</h2><small>${e(size)}</small></div></div></div><p class="source-caption">${documentCaption()}</p>`;
}
function chartHTML(chart){
 if(!chart?.points?.length)return '';
 const points=chart.points.slice(0,6),max=Math.max(1,...points.map(p=>Math.abs(p.value)));
 return `<div class="chart-heading"><strong>${e(chart.title)}</strong><span>${points.length} ${points.length<5?'точки':'точек'}</span></div><div class="mini-chart" role="img" aria-label="${e(chart.title+': '+points.map(p=>p.label+' '+p.value).join(', '))}">${points.map((p,i)=>`<div class="bar" style="--bar-delay:${i*45}ms"><div class="bar-track"><span class="bar-value" style="bottom:calc(${Math.max(3,Math.abs(p.value)/max*70)}% + 3px)">${e(format(p.value))}</span><i style="--bar-height:${Math.max(3,Math.abs(p.value)/max*70)}%;${p.value<0?'background:#7a3744':''}"></i></div><small>${e(p.label)}</small></div>`).join('')}</div>`;
}
function resultHTML(){
 const s=state[agent],r=s.result;
 if(pending)return '<p class="simple-hint" id="pending">Готовим ответ…</p>';
 if(!r)return '<p class="simple-hint">Попробуйте готовый пример или добавьте свои данные.</p>';
 const label=s.example?'Демонстрационный пример':s.local?'Расчёт по вашему файлу':'Ответ ИИ';
 let main='',details='';
 if(agent==='nutrition'){
  const t=mealTotals(r.ingredients);
  main=`<h2>${e(r.title)}</h2><p class="simple-number">≈ ${format(t.calories)} <small>ккал</small></p><p>Приблизительная оценка порции.</p>`;
  details=`<p>${e(r.ingredients.map(i=>i.name).join(', '))}</p><p>Белки ${format(t.protein)} г · Жиры ${format(t.fat)} г · Углеводы ${format(t.carbs)} г</p><p>Диапазон: ${format(r.low)}–${format(r.high)} ккал. Состав зависит от рецепта.</p>`;
 }else if(agent==='tutor'){
  main=`<small>Лучше сказать так</small><h2>${e(r.correction)}</h2><p>${e(r.explanation)}</p>`;
  details=`<p>${e(r.reply)}</p><button class="hint" data-action="speak">${icon('i-volume')}Послушать ответ</button>`;
 }else{
  main=`<h2>${e(r.metrics[0]?.label||'Главное в файле')}</h2><p class="simple-number">${e(r.metrics[0]?.value||'')}</p><p>${e(r.summary||r.findings?.[0]?.text||'')}</p>`;
  details=chartHTML(r.chart)+r.metrics.slice(1).map(m=>`<p>${e(m.label)}: <b>${e(m.value)}</b></p>`).join('');
 }
 return `<div class="simple-result"><span class="simple-label">${label}</span>${main}<details><summary>Подробнее</summary>${details}<button class="hint" data-action="download">Скачать ответ</button></details></div>`;
}
function primaryLabel(){const s=state[agent];return pending?'ИИ готовит ответ…':s.result?'Начать заново':s.example?(agent==='analyst'?'Разобрать пример':'Показать пример'):agent==='nutrition'?'Разобрать фото':agent==='tutor'?'Ответить с ИИ':'Разобрать файл';}
function renderResult(){const box=$('#result');box.innerHTML=resultHTML();box.setAttribute('aria-busy',String(pending));$('#run').innerHTML=primaryLabel()+icon('i-right');$('#run').disabled=pending;}
function render(){
 document.body.dataset.agent=agent;
 const labels={nutrition:['Что в тарелке?','Фото → состав и примерная калорийность.'],tutor:['Проверить английский','Одна фраза → ответ и исправление.'],analyst:['Что в документе?','Таблица или отчёт → цифры и вывод.']};
 const art=agent==='nutrition'?'<span class="intro-sticker handwriting">Узнай,<br>что ты ешь!<b>⤶</b></span>':agent==='tutor'?'<div class="intro-art"><img src="assets/coffee-character.webp" alt=""><span class="handwriting">Let’s speak<br>English! ♡</span></div>':'<div class="intro-art"><img src="assets/city-collage.webp" alt=""><span class="handwriting">Los Angeles<br>Mode</span><span class="red-tape">SAME DATA<br>BIGGER PERSPECTIVE</span></div>';
 $$('.agent-nav button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.agent===agent)));
 app.innerHTML=`<header class="intro"><div>${agent==='analyst'?'<span class="eyebrow">DATA TO KNOWLEDGE</span>':''}<h1>${labels[agent][0]}</h1><p>${labels[agent][1]}</p></div>${art}</header><div class="demo-sheet"><div class="workspace"><div class="source">${sourceHTML()}</div><section class="result" id="result" aria-label="Результат" aria-live="polite">${resultHTML()}</section></div><div class="actions"><button id="run" type="button" class="primary" data-action="run">${primaryLabel()}${icon('i-right')}</button><button type="button" class="reset" aria-label="Сбросить" data-action="reset">${icon('i-reset')}<span>Сбросить</span></button></div></div>`;
 $('#closing-art').innerHTML=agent==='tutor'?'<img src="assets/english-desk.webp" alt=""><span class="practice-note handwriting">Практикуйся каждый день —<br>и ты реально заговоришь! ♡</span><span class="progress-note handwriting">Small steps<br>Big progress ♡</span><span class="notebook-note handwriting">Good coffee.<br>Better English :)</span>':agent==='analyst'?'<img src="assets/city-collage.webp" alt=""><span class="la-note handwriting">LOS ANGELES<br>VIBES ↗</span><span class="small-steps">SMALL STEPS<br>BIG RESULTS</span>':'';
 updateStatus();
}
function stopCapture(){if(recognition){recognition.onresult=null;recognition.onerror=null;recognition.onend=null;recognition.abort();recognition=null;}clearTimeout(recordTimer);}
function cancel(){settlePrivacy(false);requestEpoch++;controller?.abort();pending=false;stopCapture();window.speechSynthesis?.cancel();$('#notice').hidden=true;}
function selectAgent(id){if(!valid.includes(id)||agent===id)return;cancel();agent=id;render();parent.postMessage({channel:'bornli-agent',action:'agent-changed',agent},location.origin==='null'?'*':location.origin);}
$$('[data-agent]').forEach(b=>b.addEventListener('click',()=>selectAgent(b.dataset.agent)));
addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data?.channel!=='bornli-demo')return;if(event.data.agent)selectAgent(event.data.agent);if(event.data.suspended){stopCapture();window.speechSynthesis?.cancel();}});
// State stays in this tab; fullscreen continues the same demo without a server round trip.
function announceReady(){parent.postMessage({channel:'bornli-demo-state',action:'ready'},location.origin);}
addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin||event.data?.channel!=='bornli-demo')return;
 const data=event.data;
 if(data.action==='ready-request')announceReady();
 if(data.action==='export-state'){cancel();render();parent.postMessage({channel:'bornli-demo-state',action:'state',token:data.token,snapshot:{agent,state}},location.origin);}
 if(data.action==='import-state'&&valid.includes(data.snapshot?.agent)&&data.snapshot.state){cancel();for(const id of valid)if(data.snapshot.state[id])Object.assign(state[id],data.snapshot.state[id]);agent=data.snapshot.agent;render();parent.postMessage({channel:'bornli-agent',action:'agent-changed',agent},location.origin);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCapture();window.speechSynthesis?.cancel();}});
function reset(){cancel();if(agent==='nutrition')Object.assign(state.nutrition,{photo:null,file:null,result:null,example:true});if(agent==='tutor')Object.assign(state.tutor,{scene:'cafe',text:samplePhrase,result:null,example:true});if(agent==='analyst')Object.assign(state.analyst,{file:null,result:null,example:true,local:false});render();}
async function run(){
 if(pending)return;
 if(state[agent].result){reset();return;}
 const s=state[agent],ownAgent=agent,epoch=requestEpoch;
 $('#notice').hidden=true;
 if(s.example){
  s.result=exampleResult(agent);
  renderResult();return;
 }
 if(agent==='tutor'&&!s.text.trim()){notice('Напишите одну фразу на английском.');return;}
 pending=true;renderResult();stopCapture();
 try{
  let data,action;
  if(agent==='nutrition'){action='nutrition';data={image:s.photo};}
  else if(agent==='tutor'){action='tutor';data={text:s.text.trim(),scene:s.scene,history:[]};}
  else if(/\.(csv|tsv)$/i.test(s.file.name)){
   const text=await s.file.text();if(epoch!==requestEpoch)return;s.result=tableAnalysis(parseCSV(text));s.local=true;pending=false;renderResult();return;
  }else{action='document';data={file:await fileData(s.file),filename:s.file.name};}
  if(epoch!==requestEpoch||agent!==ownAgent)return;
  const keyBytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({action,...data})));
  const key=Array.from(new Uint8Array(keyBytes),n=>n.toString(16).padStart(2,'0')).join('');
  const result=cache.has(key)?cache.get(key):await request(action,data);
  if(epoch!==requestEpoch||agent!==ownAgent)return;
  if(action==='nutrition'&&!result.ingredients?.length)throw Error(result.note||'На фото не удалось распознать блюдо.');
  if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,result);
  s.result=result;s.local=false;pending=false;renderResult();
 }catch(error){if(epoch!==requestEpoch)return;if(error.name==='AbortError'){pending=false;renderResult();return;}pending=false;renderResult();notice(error.message||'Не удалось получить ответ. Попробуйте ещё раз.');}
}
function speak(){const r=state.tutor.result;if(!r)return;if(!('speechSynthesis' in window)){notice('В этом браузере озвучка недоступна. Ответ показан текстом.');return;}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(r.reply);u.lang='en-US';u.rate=.94;speechSynthesis.speak(u);}
async function record(){
 if(recognition){recognition.stop();return;}
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){notice('Распознавание голоса доступно в Chrome. Здесь можно написать фразу.');return;}
 if(pending)return;
 const consentEpoch=requestEpoch;if(!await confirmTransmission('voice')||consentEpoch!==requestEpoch||agent!=='tutor')return;
 window.speechSynthesis?.cancel();recognition=new Recognition();recognition.lang='en-US';recognition.interimResults=false;
 const restore=()=>{if(agent==='tutor'){$('[data-action="record"]')?.setAttribute('aria-pressed','false');if($('#voice-status'))$('#voice-status').textContent=lessonScenes[state.tutor.scene].label;}clearTimeout(recordTimer);};
 recognition.onresult=event=>{const text=event.results[0][0].transcript;stopCapture();restore();state.tutor.text=text.slice(0,300);state.tutor.example=false;state.tutor.result=null;render();};
 recognition.onerror=()=>{stopCapture();restore();notice('Не удалось распознать голос. Проверьте доступ к микрофону или напишите фразу.');};
 recognition.onend=()=>{recognition=null;restore();};
 try{recognition.start();$('[data-action="record"]').setAttribute('aria-pressed','true');$('#voice-status').textContent='Слушаю…';recordTimer=setTimeout(()=>recognition?.stop(),15000);}catch{stopCapture();restore();notice('Не удалось включить микрофон. Напишите фразу.');}
}
function download(){
 const s=state[agent],r=s.result;if(!r)return;
 let text=`BORNLI AI — ${s.example?'готовый пример':'ваши данные'}\n\n`;
 if(agent==='nutrition'){text+=r.title+'\n'+r.description+'\n\n'+r.ingredients.map(i=>`${i.name}: ~${i.grams} г, ${i.calories} ккал, Б ${i.protein}, Ж ${i.fat}, У ${i.carbs}`).join('\n')+`\n\nОценка: ${r.low}–${r.high} ккал\n${r.note}`;}
 if(agent==='tutor')text+=s.text+'\n\n'+r.reply+'\n\n'+r.correction+'\n'+r.explanation;
 if(agent==='analyst')text+=r.title+'\n'+r.summary+'\n\n'+r.metrics.map(m=>m.label+': '+m.value).join('\n')+'\n\n'+r.findings.map(f=>f.text+'\nИсточник: '+f.source).join('\n\n')+'\n\n'+(r.chart?.points||[]).map(p=>p.label+': '+p.value).join('\n');
 const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='BORNLI-'+agent+'-answer.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
app.addEventListener('input',event=>{if(event.target.id==='tutor-input'){state.tutor.text=event.target.value;state.tutor.example=event.target.value===demoPhrase();state.tutor.result=null;if($('.voice-handnote'))$('.voice-handnote').hidden=!state.tutor.example;$('#char-count').textContent=state.tutor.text.length+'/300';$('#input-kind').textContent=state.tutor.example?'Готовый пример':'Ваша фраза · английский';if(pending){cancel();}renderResult();}});
app.addEventListener('keydown',event=>{if(event.target.id==='tutor-input'&&event.key==='Enter'&&!event.shiftKey){event.preventDefault();run();}});
async function acceptFile(file,type){
 if(!file)return;
 cancel();const epoch=requestEpoch,ownAgent=agent;
 try{
  if(type==='food-file'){const photo=await imageFile(file);if(epoch!==requestEpoch||agent!==ownAgent)return;Object.assign(state.nutrition,{photo,file,result:null,example:false});}
  if(type==='document-file'){if(file.size>3*1024*1024)throw Error('Для демо выберите файл до 3 МБ.');if(!/\.(csv|tsv|xlsx|pdf|txt|md)$/i.test(file.name))throw Error('Поддерживаются CSV, XLSX, PDF, TXT и MD.');if(!capabilities.live&&!/\.(csv|tsv)$/i.test(file.name))throw Error('Сейчас доступны свои CSV и TSV. Для PDF и Excel требуется подключение ИИ.');Object.assign(state.analyst,{file,result:null,example:false,local:false});}
  render();
 }catch(error){notice(error.message);}
}
app.addEventListener('change',event=>acceptFile(event.target.files?.[0],event.target.id));
app.addEventListener('dragover',event=>{if(agent!=='analyst'||!event.target.closest('.source'))return;event.preventDefault();event.dataTransfer.dropEffect='copy';$('.source').classList.add('is-dragover');});
app.addEventListener('dragleave',event=>{if(!event.currentTarget.contains(event.relatedTarget))$('.source')?.classList.remove('is-dragover');});
app.addEventListener('drop',event=>{if(agent!=='analyst'||!event.target.closest('.source'))return;event.preventDefault();$('.source').classList.remove('is-dragover');acceptFile(event.dataTransfer.files?.[0],'document-file');});
app.addEventListener('click',event=>{const action=event.target.closest('button')?.dataset.action;if(action==='run')run();if(action==='reset')reset();if(action==='record')record();if(action==='speak')speak();if(action==='download')download();if(action==='hint')notice(state.tutor.scene==='cafe'?'После I используйте want без -s. Более вежливо: I’d like a coffee, please.':lessonScenes[state.tutor.scene].explanation);if(action==='replace-photo')$('#food-file').click();if(action==='next-phrase'){cancel();const scenes=Object.keys(lessonScenes);state.tutor.scene=scenes[(scenes.indexOf(state.tutor.scene)+1)%scenes.length];state.tutor.text=demoPhrase();state.tutor.example=true;state.tutor.result=null;render();}});
render();announceReady();checkConnection();
