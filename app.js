
const $=s=>document.querySelector(s);let D,R,G,sel=new Set(),cat=null,guides=false,res=[],shown=0,cur=-1;
const norm=s=>s.toLowerCase().replace(/ё/g,'е');
const ENDS=['иями','ями','ами','ого','его','ому','ему','ыми','ими','ешь','ишь','ете','ите','ует','ают','яют','ов','ев','ей','ой','ый','ий','ая','яя','ое','ее','ые','ие','ах','ях','ом','ем','ам','ям','ть','ся','ы','и','а','я','у','ю','е','о','ь'];
function stem(w){for(const e of ENDS){if(w.length-e.length>=3&&w.endsWith(e))return w.slice(0,-e.length)}return w}
function hit(q,pool){if(pool.has(q))return true;const s=stem(q);for(const l of pool){if(l.startsWith(q)&&q.length>=3)return true;if(s.length>=4&&(l.startsWith(s)||s.startsWith(l)&&l.length>=4))return true}return false}
function search(){const q=norm($('#q').value).match(/[а-яa-z0-9]+/g)||[];const mt=+$('#time').value||null;const pool=guides?G:R;const prods=sel.size?sel:null;const out=[];
 for(const e of pool){if(cat&&e.c!==cat)continue;if(mt&&!(e.t&&e.t<=mt))continue;let sc=0,ok=true;
  for(const w of q){if(w.length<2)continue;if(hit(w,e.T))sc+=30;else if(hit(w,e.I))sc+=10;else if(hit(w,e.B))sc+=2;else{ok=false;break}}
  if(!ok)continue;if(prods){let m=0;for(const p of prods)if(e.P.has(p))m++;if(!m)continue;e.m=m;sc+=m*100+(m===prods.size?50:0)}else e.m=0;out.push([sc,e])}
 out.sort((a,b)=>b[0]-a[0]||a[1].n.localeCompare(b[1].n,'ru'));res=out.map(x=>x[1]);
 const parts=[];if(guides)parts.push('Справочник');else if(cat)parts.push(cat);if(q.length)parts.push('поиск «'+$('#q').value.trim()+'»');if(prods)parts.push('продукты: '+[...prods].map(k=>D.plabel[k]).join(', '));
 $('#status').textContent='Найдено '+res.length+(guides?' материалов':' рецептов')+(parts.length?' · '+parts.join(' · '):'');$('#grid').innerHTML='';shown=0;more()}
function more(){const g=$('#grid');if(!res.length){g.innerHTML='<div class="empty">Ничего не нашлось.<br>Попробуйте другое слово или уберите фильтры.</div>'}
 const end=Math.min(res.length,shown+30);for(let i=shown;i<end;i++){const e=res[i],d=document.createElement('div');d.className='card';
  const s=[];if(e.t)s.push(e.t+' мин');if(!cat)s.push(e.c);if(e.m)s.push('совпало '+e.m+' из '+sel.size);
  d.innerHTML='<img loading="lazy" src="data/'+e.th+'"><div class="t">'+e.n+'</div><div class="s">'+s.join(' · ')+'</div>';d.onclick=()=>open(i);g.appendChild(d)}
 shown=end;$('#more').style.display=shown<res.length?'block':'none'}
function open(i){cur=i;const e=res[i];$('#vt').textContent=e.n;const inf=[];if(e.t)inf.push('Активное время: '+e.t+' мин');inf.push('Раздел: '+e.c);inf.push('Файл: '+e.f);$('#vi').textContent=inf.join(' · ');
 $('#pages').innerHTML=e.pg.map(p=>'<img src="data/'+p+'">').join('');$('#pages').scrollTop=0;$('#view').classList.add('open');history.pushState({v:1},'')}
function close(){$('#view').classList.remove('open')}
function setCat(c){cat=c==='Справочник'?null:c;guides=c==='Справочник';document.querySelectorAll('#cats button').forEach(b=>b.classList.toggle('on',b.dataset.c===String(c)));search()}
fetch('data.json').then(r=>r.json()).then(d=>{D=d;for(const e of d.e){e.T=new Set(e.T);e.I=new Set(e.I);e.B=new Set(e.B);e.P=new Set(e.P)}R=d.e.filter(e=>e.k==='r');G=d.e.filter(e=>e.k==='g');
 const cs=$('#cats'),mk=(c,l,n)=>{const b=document.createElement('button');b.dataset.c=String(c);b.textContent=l+(n?' ('+n+')':'');b.onclick=()=>setCat(c);cs.appendChild(b)};
 mk(null,'Все рецепты',R.length);for(const c of d.cats)mk(c,c,d.cnt[c]||0);mk('Справочник','Справочник',G.length);
 const fb=$('#fbody');D.plabel={};for(const g of d.groups){const ps=d.products.filter(p=>p.group===g);if(!ps.length)continue;fb.insertAdjacentHTML('beforeend','<h3>'+g+'</h3>');
  for(const p of ps){D.plabel[p.key]=p.label;const l=document.createElement('label');l.innerHTML='<input type="checkbox" value="'+p.key+'"> '+p.label+' <span style="color:#999">('+p.count+')</span>';l.querySelector('input').onchange=ev=>{ev.target.checked?sel.add(p.key):sel.delete(p.key)};fb.appendChild(l)}}
 setCat(null)});
let tm;$('#q').oninput=()=>{clearTimeout(tm);tm=setTimeout(search,250)};$('#clr').onclick=()=>{$('#q').value='';search()};$('#time').onchange=search;$('#more').onclick=more;
$('#fbtn').onclick=()=>$('#fridge').classList.add('open');$('#fclose').onclick=()=>{$('#fridge').classList.remove('open');$('#fbtn').classList.toggle('on',sel.size>0);search()};
$('#freset').onclick=()=>{sel.clear();document.querySelectorAll('#fbody input').forEach(i=>i.checked=false)};
$('#rnd').onclick=()=>{const p=res.length&&!guides?res:R;const e=p[Math.floor(Math.random()*p.length)];res=p;open(p.indexOf(e))};
$('#back').onclick=()=>history.back();$('#prev').onclick=()=>{if(cur>0)open(cur-1)};$('#next').onclick=()=>{if(cur<res.length-1)open(cur+1)};
window.onpopstate=()=>close();document.onkeydown=e=>{if(e.key==='Escape')close()};
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
