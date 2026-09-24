export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const format = value => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value);
export function mealTotals(ingredients,factor=1){
 return Object.fromEntries(['calories','protein','fat','carbs','grams'].map(key=>[key,Math.round(ingredients.reduce((s,i)=>s+number(i[key]),0)*factor)]));
}
export function parseCSV(text){
 if(text.length>200000)throw Error('Для демо выберите таблицу до 200 тысяч символов.');
 const first=text.replace(/^\uFEFF/,'').split(/\r?\n/)[0];const delimiter=first.includes(';')?';':first.includes('\t')?'\t':',';
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&(ch===delimiter||ch==='\n')){row.push(field.trim());field='';if(ch==='\n'){if(row.some(Boolean))rows.push(row);row=[];}}
  else if(ch!=='\r')field+=ch;
 }
 if(quoted)throw Error('В CSV не закрыты кавычки. Проверьте файл.');
 row.push(field.trim());if(row.some(Boolean))rows.push(row);
 if(rows.length<2)throw Error('В таблице нужны заголовок и хотя бы одна строка данных.');
 if(rows.length>501)throw Error('Для демо оставьте не более 500 строк.');
 const headers=rows.shift().map((h,i)=>h.replace(/^\uFEFF/,'')||`Столбец ${i+1}`);
 if(headers.length>30)throw Error('Для демо оставьте не более 30 столбцов.');
 if(rows.some(r=>r.length!==headers.length))throw Error('Количество столбцов различается. Проверьте разделители CSV.');
 return {headers,rows};
}
export function numeric(value){
 const raw=String(value).trim().replace(/[\s\u00a0₽]/g,'').replace(/руб\.?$/i,'').replace(',','.');
 return /^[-+]?\d+(\.\d+)?$/.test(raw)?Number(raw):null;
}
export function tableAnalysis(table){
 const cols=table.headers.map((label,index)=>({label,index,values:table.rows.map(r=>numeric(r[index]))})).filter(c=>c.values.every(v=>v!==null));
 if(!cols.length)throw Error('Не нашёл числовых столбцов для графика. Текст можно разобрать после подключения ИИ.');
 const labelCol=table.headers.findIndex((_,i)=>!cols.some(c=>c.index===i));
 const selected=cols.find(c=>/выруч|revenue|продаж/i.test(c.label))||cols[0];
 const sum=selected.values.reduce((a,b)=>a+b,0),first=selected.values[0],last=selected.values.at(-1),growth=first!==0?(last-first)/Math.abs(first)*100:null;
 const max=Math.max(...selected.values),maxAt=selected.values.indexOf(max);
 return {title:'Что видно в таблице',summary:`${table.rows.length} строк данных. Числа рассчитаны из файла.`,metrics:[{label:`${selected.label}: сумма`,value:format(sum)},{label:'Изменение первой / последней строки',value:growth===null?'Нет базы для сравнения':`${growth>0?'+':''}${format(growth)}%`}],chart:{title:selected.label,points:table.rows.map((r,i)=>({label:labelCol>=0?r[labelCol]:String(i+1),value:selected.values[i]}))},findings:[{text:`Максимум: ${format(max)}. ${labelCol>=0?table.rows[maxAt][labelCol]:`Строка ${maxAt+2}`}.`,source:`Строка ${maxAt+2}, столбец «${selected.label}»`},{text:'График сохраняет порядок строк исходного файла. Причины изменений по одной таблице определить нельзя.',source:`Строки 2–${table.rows.length+1}`}],questions:['Где максимальное значение?','Какая сумма по столбцу?']};
}
export function tableAnswer(table,question){
 const q=question.toLowerCase();const a=tableAnalysis(table);const stems=text=>text.toLowerCase().split(/[^а-яёa-z0-9]+/).filter(w=>w.length>3).map(w=>/[а-яё]/.test(w)?w.replace(/(?:иями|ами|ого|ему|ыми|ими|ия|ие|ий|ая|ые|ой|ей|ам|ям|ов|ев|ах|ях|ом|ем|а|я|ы|и|у|ю|е)$/,''):w);
 const words=stems(q);const matched=table.headers.map((h,i)=>({i,match:q.includes(h.toLowerCase())||stems(h).some(w=>words.includes(w))})).filter(c=>c.match);
 if(matched.length>1)return null;
 const col=matched[0]?.i??-1;
 const allowed=new Set(['где','какой','какая','какое','какие','чему','равна','равен','равно','покажи','покажите','посчитай','посчитайте','сумма','сумму','всего','итог','максимум','максимальное','максимальный','самое','самый','большое','больший','значение','значений','среднее','по','столбцу','столбца','колонке','колонки','в','таблице','всех','строк','строкам','данных','пожалуйста']);
 const selectedStems=col>=0?stems(table.headers[col]):[];
 // Unknown periods, filters or metrics go to the model; never answer a different calculation.
 if(q.split(/[^а-яёa-z0-9]+/).filter(Boolean).some(w=>!allowed.has(w)&&!stems(w).some(v=>selectedStems.includes(v))))return null;
 const index=col>=0?col:table.headers.findIndex(h=>h===a.chart.title);const values=table.rows.map(r=>numeric(r[index]));
 if(values.some(v=>v===null))return null;
 const source=`Столбец «${table.headers[index]}», строки 2–${table.rows.length+1}`;
 if(/сумм|всего|итог/.test(q))return {answer:`Сумма: ${format(values.reduce((s,v)=>s+v,0))}.`,source};
 if(/максим|больш|пик|лучш/.test(q)){const max=Math.max(...values);return {answer:`Максимум: ${format(max)} (${table.rows[values.indexOf(max)][0]}).`,source:`Строка ${values.indexOf(max)+2}, «${table.headers[index]}»`};}
 if(/средн/.test(q))return {answer:`Среднее: ${format(values.reduce((s,v)=>s+v,0)/values.length)}.`,source};
 return null;
}
