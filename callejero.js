/* ============================================================
   CALLEJERO DE PARROQUIAS (Archidiócesis de Madrid)
   Traído de Herramientas (callejero-parroquias.html): mismos datos
   (datos/callejero-parroquias.json) y misma búsqueda. Los datos se
   descargan la primera vez que se escribe en el buscador.
   ============================================================ */
const Callejero = (function(){
'use strict';
var DATA=null, STREETS=[], MUNIS=[], PAR={}, TOWNS={};
var $q, $x, $mun, $out, $status, $sug, CARGA=null, Q='', M='';

/* ---------- utilidades ---------- */
function norm(s){
  return String(s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'')
    .replace(/ç/g,'c').replace(/[^a-z0-9ñ]+/g,' ').trim();
}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
var STOP={de:1,del:1,la:1,las:1,el:1,los:1,y:1,a:1,al:1,e:1,lo:1};
function words(s){return norm(s).split(' ').filter(function(w){return w && !STOP[w];});}
function lev(a,b,max){
  var la=a.length, lb=b.length; if(Math.abs(la-lb)>max) return max+1;
  var prev=new Array(lb+1), cur=new Array(lb+1), i, j;
  for(j=0;j<=lb;j++) prev[j]=j;
  for(i=1;i<=la;i++){
    cur[0]=i; var mn=i;
    for(j=1;j<=lb;j++){
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a.charCodeAt(i-1)===b.charCodeAt(j-1)?0:1));
      if(cur[j]<mn) mn=cur[j];
    }
    if(mn>max) return max+1;
    var t=prev; prev=cur; cur=t;
  }
  return prev[lb];
}

/* ---------- tipos de vía ---------- */
var TIPO_GRUPO={ 'C.':'C','Avda.':'AV','Pza.':'PZ','Pzo.':'PZ','Trv.':'TR','Cº.':'CM','Cmno.':'CM','Camino':'CM','Pº.':'PS',
  'Gta.':'GT','Pje.':'PJ','Cª.':'CR','Ctra.':'CR','Cra.':'CR','Cjón.':'CJ','Calleja':'CJ','Urb.':'UR','Rda.':'RD','Col.':'CO',
  'Autov.':'AU','Cost.':'CS','Cta.':'CT','Vereda':'VE','Parque':'PQ','Bulevar':'BU','Cañada':'CA','Pista':'PI','Puente':'PU','Vía':'VI' };
var TIPO_PAL={calle:'C',c:'C',cl:'C',cll:'C',avenida:'AV',avda:'AV',av:'AV',avd:'AV',plaza:'PZ',pza:'PZ',pl:'PZ',plz:'PZ',plazuela:'PZ',
  travesia:'TR',trv:'TR',trav:'TR',tr:'TR',camino:'CM',cno:'CM',cmno:'CM',cmo:'CM',co:'CM',paseo:'PS',po:'PS',ps:'PS',pso:'PS',
  glorieta:'GT',gta:'GT',pasaje:'PJ',pje:'PJ',psje:'PJ',carretera:'CR',ctra:'CR',cra:'CR',ca:'CR',callejon:'CJ',cjon:'CJ',calleja:'CJ',
  urbanizacion:'UR',urb:'UR',ronda:'RD',rda:'RD',colonia:'CO',col:'CO',autovia:'AU',autov:'AU',costanilla:'CS',cost:'CS',
  cuesta:'CT',cta:'CT',vereda:'VE',parque:'PQ',bulevar:'BU',boulevard:'BU',canada:'CA',cañada:'CA',pista:'PI',puente:'PU',via:'VI'};
var TIPO_LARGO={C:'calle',AV:'avenida',PZ:'plaza',TR:'travesía',CM:'camino',PS:'paseo',GT:'glorieta',PJ:'pasaje',CR:'carretera',CJ:'callejón',
  UR:'urbanización',RD:'ronda',CO:'colonia',AU:'autovía',CS:'costanilla',CT:'cuesta',VE:'vereda',PQ:'parque',BU:'bulevar',CA:'cañada',PI:'pista',PU:'puente',VI:'vía'};

/* ---------- municipios (alias) ---------- */
var MUNI_ALIAS={
  'Madrid':['madrid','madrid capital'],
  'Las Rozas de Madrid':['las rozas de madrid','rozas de madrid','las rozas','rozas'],
  'Pozuelo de Alarcón':['pozuelo de alarcon','pozuelo'],
  'San Sebastián de los Reyes':['san sebastian de los reyes','san sebastian reyes','sanse','s s reyes','ss reyes'],
  'Collado Villalba':['collado villalba','villalba','collado'],
  'Colmenar Viejo':['colmenar viejo','colmenar'],
  'Tres Cantos':['tres cantos'],
  'Alcobendas':['alcobendas'],'Majadahonda':['majadahonda','majadaonda'],'Galapagar':['galapagar'],
  'Torrelodones':['torrelodones'],'Alpedrete':['alpedrete'],'Cerceda':['cerceda']
};

/* ---------- carga (una sola vez, al empezar a escribir) ---------- */
function cargar(){
  if(CARGA) return CARGA;
  if($status) $status.textContent='Cargando callejero…';
  CARGA=fetch('datos/callejero-parroquias.json').then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }).then(function(d){
    DATA=d; MUNIS=d.m; PAR=d.p;
    /* se agrupan las variantes de una misma vía (p. ej. «C. Real» y «C. de Real», «Rios Rosas» y «Ríos Rosas») */
    var byKey={};
    d.s.forEach(function(s){
      var w=words(s[3]), g=TIPO_GRUPO[s[1]]||s[1], key=s[0]+'|'+g+'|'+w.join(' ');
      var st=byKey[key];
      if(!st){ st=byKey[key]={m:s[0], tipo:s[1], parte:s[2], name:s[3], g:g, segs:[], w:w, j:w.join(' '), _n:0}; STREETS.push(st); }
      var n=s[4].length, accented=/[áéíóúñ]/i.test(s[3]);
      if(n>st._n || (accented && !/[áéíóúñ]/i.test(st.name))){ st.tipo=s[1]; st.parte=s[2]; st.name=s[3]; st._n=Math.max(n,st._n); }
      s[4].forEach(function(z){
        if(!st.segs.some(function(y){return y[0]===z[0]&&y[1]===z[1]&&y[2]===z[2]&&y[3]===z[3];})) st.segs.push(z);
      });
    });
    /* poblaciones con parroquias pero sin callejero */
    var cubiertas={}; MUNIS.forEach(function(m){cubiertas[norm(m)]=1;});
    Object.keys(PAR).forEach(function(k){
      var pob=PAR[k][2]; if(!pob) return; var n=norm(pob);
      if(cubiertas[n] || n==='madrid') return;
      (TOWNS[n]=TOWNS[n]||{name:pob,codes:[]}).codes.push(k);
    });
    llenarMunicipios();
    run(); suggest();
  }).catch(function(e){
    CARGA=null;
    if($status) $status.textContent='No se ha podido cargar el callejero ('+e.message+'). Inténtalo otra vez.';
  });
  return CARGA;
}
function llenarMunicipios(){
  if(!DATA || !$mun || $mun.options.length>1) return;
  MUNIS.slice().sort(function(a,b){return a==='Madrid'?-1:b==='Madrid'?1:a.localeCompare(b,'es');}).forEach(function(m){
    var o=document.createElement('option'); o.value=String(MUNIS.indexOf(m)); o.textContent=m; $mun.appendChild(o);
  });
  $mun.value=M;
}

/* ---------- montaje: se llama cada vez que se dibuja la pantalla principal ---------- */
var tmr=null;
function montar(){
  $q=document.getElementById('callejeroQ'); if(!$q) return;
  $x=document.getElementById('callejeroX'); $mun=document.getElementById('callejeroMun');
  $out=document.getElementById('callejeroOut'); $status=document.getElementById('callejeroEstado'); $sug=document.getElementById('callejeroSug');
  $q.value=Q; llenarMunicipios();
  $q.addEventListener('input',function(){ Q=$q.value; cargar(); clearTimeout(tmr); tmr=setTimeout(run,120); suggest(); });
  $q.addEventListener('keydown',function(e){
    var open=!$sug.hidden, lis=$sug.children;
    if(open && (e.key==='ArrowDown' || e.key==='ArrowUp')){
      e.preventDefault();
      if(e.key==='ArrowDown') sel=sel+1>=lis.length?-1:sel+1;
      else sel=sel-1<-1?lis.length-1:sel-1;
      for(var i=0;i<lis.length;i++) lis[i].classList.toggle('on',i===sel);
      if(sel>=0) lis[sel].scrollIntoView({block:'nearest'});
      return;
    }
    if(e.key==='Escape' && open){ e.preventDefault(); e.stopPropagation(); hideSug(); return; }
    if((e.key==='Enter' || (e.key==='Tab' && open && !e.shiftKey)) && open && (sel>=0 || e.key==='Tab')){
      e.preventDefault(); pick(SUG[sel>=0?sel:0]); return;
    }
    if(e.key==='Enter'){ e.preventDefault(); clearTimeout(tmr); hideSug(); run(); }
  });
  $q.addEventListener('blur',function(){ setTimeout(hideSug,120); });
  $q.addEventListener('focus',function(){ cargar(); suggest(); });
  $sug.addEventListener('mousedown',function(e){ e.preventDefault(); });
  $sug.addEventListener('click',function(e){ var li=e.target.closest('li'); if(li) pick(SUG[+li.dataset.i]); });
  $mun.addEventListener('change',function(){ M=$mun.value; cargar(); run(); });
  $mun.addEventListener('focus',cargar);
  $x.addEventListener('click',function(){ $q.value=''; Q=''; hideSug(); run(); $q.focus(); });
  $out.addEventListener('click',function(e){ if(e.target.id==='callejeroMas'){ shown=1e9; run(true); } });
  run();
}

/* ---------- autocompletado (desde la 4.ª letra) ---------- */
var SUG=[], sel=-1;
function hideSug(){ if(!$sug) return; $sug.hidden=true; $sug.innerHTML=''; SUG=[]; sel=-1; $q.setAttribute('aria-expanded','false'); }
function hl(label, toks){
  /* resalta los comienzos de palabra que coinciden con lo escrito */
  return label.split(/(\s+)/).map(function(w){
    var nw=norm(w), t=null;
    toks.forEach(function(x){ if(x && nw.indexOf(x)===0 && (!t || x.length>t.length)) t=x; });
    if(!t) return esc(w);
    var cut=0, acc=''; while(cut<w.length && norm(acc).length<t.length){ acc+=w[cut]; cut++; }
    return '<b>'+esc(w.slice(0,cut))+'</b>'+esc(w.slice(cut));
  }).join('');
}
function suggest(){
  if(!DATA || !$q || document.activeElement!==$q){ return hideSug(); }
  var raw=$q.value, n=norm(raw);
  if(n.replace(/[^a-zñ]/g,'').length<4){ return hideSug(); }
  var q=parse(raw);
  if(q.num!=null){ return hideSug(); }
  var out=[], seen={};
  /* municipios (con callejero y sin él) */
  var nt=n.split(' '), last=nt[nt.length-1], last2=nt.slice(-2).join(' '), last3=nt.slice(-3).join(' ');
  function muniMatch(name){
    var nm=norm(name);
    if((' '+n+' ').indexOf(' '+nm+' ')>=0) return false;           /* ya está escrito entero */
    if(last.length<3 && nt.length>1) return false;
    return [n,last3,last2,last].some(function(f){ return f.replace(/ /g,'').length>=4 && (nm.indexOf(f)===0 || (' '+nm).indexOf(' '+f)>=0); });
  }
  var muniSel=$mun.value;
  if(muniSel===''){
    MUNIS.forEach(function(m,i){ if(i!==q.muni && muniMatch(m)) out.push({k:'m', i:i, label:m, sub:'municipio'}); });
    Object.keys(TOWNS).forEach(function(t){ if(muniMatch(TOWNS[t].name)) out.push({k:'t', label:TOWNS[t].name.trim(), sub:'municipio sin callejero'}); });
  }
  /* calles: cada palabra escrita debe ser comienzo de una palabra del nombre (la última puede estar a medias) */
  var w=q.w;
  if(w.length && w.join('').length>=3){
    var mf=muniSel!==''?parseInt(muniSel,10):(q.muni!=null?q.muni:null), cand=[];
    for(var i=0;i<STREETS.length;i++){
      var st=STREETS[i]; if(mf!=null && st.m!==mf) continue;
      var ok=true, firstPos=99;
      for(var k=0;k<w.length && ok;k++){
        var hit=-1;
        for(var j=0;j<st.w.length;j++){ if(st.w[j].indexOf(w[k])===0){ hit=j; break; } }
        if(hit<0) ok=false; else if(k===0) firstPos=hit;
      }
      if(!ok) continue;
      if(q.g && st.g!==q.g) continue;
      var sc=(st.j===w.join(' ')?0:1)*10+firstPos*3+(st.j.indexOf(w.join(' '))===0?0:2)+(st.m===3?0:1)+st.w.length*.1;
      cand.push({st:st, sc:sc});
    }
    cand.sort(function(a,b){ return a.sc-b.sc || a.st.name.localeCompare(b.st.name,'es'); });
    for(var c=0;c<cand.length && out.length<9;c++){
      var st2=cand[c].st, key=stName(st2)+'|'+st2.m;
      if(seen[key]) continue; seen[key]=1;
      out.push({k:'s', st:st2, label:stName(st2), sub:MUNIS[st2.m]});
    }
  }
  /* si lo escrito ya es exactamente la única sugerencia, no se muestra */
  if(out.length===1 && out[0].k==='s' && norm(raw).indexOf(norm(out[0].label))===0){ return hideSug(); }
  SUG=out.slice(0,9); sel=-1;
  if(!SUG.length){ return hideSug(); }
  var toks=n.split(' ').filter(function(t){return t.length>=1 && !STOP[t];});
  $sug.innerHTML=SUG.map(function(o,i){
    return '<li role="option" data-i="'+i+'"><span class="sl">'+hl(o.label,toks)+'</span><span class="ss">'+esc(o.sub)+'</span></li>';
  }).join('');
  $sug.hidden=false; $q.setAttribute('aria-expanded','true');
}
function pick(o){
  if(!o) return;
  var raw=$q.value;
  if(o.k==='s'){
    var name=stName(o.st);
    if($mun.value===''){ $q.value=name+' , '+MUNIS[o.st.m]; $q.setSelectionRange(name.length+1,name.length+1); }
    else { $q.value=name+' '; }
  }else if(o.k==='m'){
    /* se quita el trozo de municipio escrito y se fija el municipio en el desplegable */
    var nm=norm(o.label), parts=raw.trim().split(/\s+/), keep=parts.length;
    for(var k=parts.length;k>=1;k--){
      var frag=norm(parts.slice(k-1).join(' '));
      if(frag && (nm.indexOf(frag)===0 || (' '+nm).indexOf(' '+frag)>=0)) keep=k-1;
    }
    $mun.value=String(o.i);
    $q.value=parts.slice(0,keep).join(' ').replace(/[,\s]+$/,'')+(keep?' ':'');
  }else{
    $q.value=o.label;
  }
  M=$mun.value; Q=$q.value; hideSug(); clearTimeout(tmr); run(); $q.focus();
  if(o.k==='s' && $mun.value===''){ var p=stName(o.st).length+1; $q.setSelectionRange(p,p); }
}

/* ---------- análisis de la consulta ---------- */
function parse(raw){
  var s=' '+raw+' ';
  s=s.replace(/\bc\s*\/\s*/gi,' calle ').replace(/\bn\.?\s*[ºo°]\.?\s*(?=\d)/gi,' ').replace(/\bn[uú]m(ero)?\.?\s*(?=\d)/gi,' ');
  s=s.replace(/\b\d+\s*[ºª°]\s*[a-z]?\b/gi,' ');                          /* 3º B, 2ª */
  s=s.replace(/\b(piso|planta|esc(alera)?|puerta|pta|bajo|izq(da|uierda)?|dcha|derecha|portal|bloque|blq)\b.*$/i,' ');
  s=s.replace(/\b28\d{3}\b/g,' ');                                         /* código postal */
  var n=norm(s), q={raw:raw, muni:null, muniFromText:false, num:null, numTxt:'', g:'', w:[]};
  /* municipio: el alias más largo; se prefiere el que aparece más al final */
  var found=[], best=null;
  Object.keys(MUNI_ALIAS).forEach(function(m){
    MUNI_ALIAS[m].forEach(function(a){
      var re=new RegExp('(^| )'+a+'(?= |$)','g'), mt;
      while((mt=re.exec(n))){ var pos=mt.index+(mt[1]?1:0); found.push({m:m,a:a,pos:pos,end:pos+a.length}); re.lastIndex=pos+1; }
    });
  });
  /* se descartan los alias contenidos en otro más largo («madrid» dentro de «las rozas de madrid») */
  found=found.filter(function(f){ return !found.some(function(g){ return g!==f && g.pos<=f.pos && g.end>=f.end && (g.end-g.pos)>(f.end-f.pos); }); });
  found.forEach(function(f){ if(!best || f.end>best.end || (f.end===best.end && f.a.length>best.a.length)) best=f; });
  if(best) best.pos=best.pos-(best.pos>0?1:0);
  var n2=n;
  if(best){
    var rest=(n.slice(0,best.pos)+' '+n.slice(best.pos+best.a.length+1)).trim();
    if(words(rest.replace(/\d+/g,'')).length){ q.muni=MUNIS.indexOf(best.m); q.muniFromText=true; n2=rest; }
  }
  var toks=n2.split(' ').filter(Boolean);
  /* número: último número suelto (admite letra, p. ej. 45b) */
  for(var i=toks.length-1;i>=1;i--){
    var mt=toks[i].match(/^(\d+)([a-z])?$/);
    if(mt){ q.num=parseInt(mt[1],10); q.numTxt=toks[i].toUpperCase(); q.numIdx=i;
      if(i+1<toks.length && /^(bis|[a-d])$/.test(toks[i+1])) toks.splice(i+1,1);
      break; }
    if(/^(km|kilometro)$/.test(toks[i])) break;
  }
  if(q.numIdx!=null){
    q.tokAll=toks.slice(); toks.splice(q.numIdx,1);
    /* rangos tipo 45-47: se toma el primero */
    var pi=q.numIdx-1;
    if(pi>=1 && /^\d+$/.test(toks[pi])){ q.num=parseInt(toks[pi],10); q.numTxt=toks[pi]; toks.splice(pi,1); }
  }
  /* tipo de vía al principio */
  if(toks.length>1 && TIPO_PAL[toks[0]]){ q.g=TIPO_PAL[toks[0]]; toks.shift(); }
  q.w=toks.filter(function(t){return !STOP[t];});
  return q;
}

/* ---------- puntuación de calles ---------- */
function tokScore(t, w){
  var bestv=0;
  for(var k=0;k<w.length;k++){
    var x=w[k], v=0;
    if(x===t) v=1;
    else if(t.length>=2 && x.indexOf(t)===0) v=.86;
    else if(t.length>=4){
      var mx=t.length>=8?2:1, d=lev(t,x,mx);
      if(d<=mx) v=.72-(d-1)*.1;
      else if(x.length>t.length){ var d2=lev(t,x.slice(0,t.length),1); if(d2<=1) v=.6; }
    }
    if(v>bestv){ bestv=v; if(v===1) break; }
  }
  return bestv;
}
function scoreStreet(st, q){
  var qw=q.w; if(!qw.length) return 0;
  var qj=qw.join(' ');
  var base;
  if(qj===st.j) base=100;
  else{
    var sum=0, miss=0;
    for(var i=0;i<qw.length;i++){ var v=tokScore(qw[i],st.w); sum+=v; if(!v) miss++; }
    if(miss && (miss>1 || qw.length<3)) return 0;
    var avg=sum/qw.length, cover=Math.min(1,(qw.length-miss)/Math.max(1,st.w.length));
    base=avg*70+cover*22;
    if(st.j.indexOf(qj)===0) base+=4;
    if(miss) base*=.6;
  }
  if(q.g){ base+= (st.g===q.g)?8:-6; }
  return base;
}
function search(q){
  var muniSel=$mun.value!==''?parseInt($mun.value,10):(q.muni!=null?q.muni:null);
  var res=[];
  for(var i=0;i<STREETS.length;i++){
    var st=STREETS[i];
    if(muniSel!=null && st.m!==muniSel) continue;
    var sc=scoreStreet(st,q);
    if(sc>=45) res.push({st:st,sc:sc});
  }
  res.sort(function(a,b){ return b.sc-a.sc || (a.st.m===3?-1:0)-(b.st.m===3?-1:0) || a.st.name.localeCompare(b.st.name,'es'); });
  if(res.length){ var top=res[0].sc; res=res.filter(function(r){return r.sc>=top-14;}); }
  return {list:res, muni:muniSel};
}

/* ---------- parroquia según número ---------- */
function resolve(st, num){
  var segs=st.segs, codes=[], hits=[], approx=false, ranged=[], whole=[];
  if(num==null){
    segs.forEach(function(s){ if(codes.indexOf(s[3])<0) codes.push(s[3]); });
    var kn=codes.filter(function(c){return PAR[c];}); if(kn.length) codes=kn;
    return {codes:codes, hits:segs.slice(), approx:false};
  }
  var odd=num%2===1;
  segs.forEach(function(s){
    var pOk=s[0]===0 || (s[0]===1)===odd;
    if(!pOk) return;
    if(s[1]===0 && s[2]===0) whole.push(s);
    else if(num>=s[1] && num<=s[2]) ranged.push(s);
  });
  hits=ranged.length?ranged:whole;
  if(!hits.length){
    /* fuera de los tramos registrados: el tramo más cercano del mismo lado */
    var bestd=1e9;
    segs.forEach(function(s){
      if(s[1]===0 && s[2]===0) return;
      if(!(s[0]===0 || (s[0]===1)===odd)) return;
      var d=num<s[1]?s[1]-num:num-s[2];
      if(d<bestd){ bestd=d; hits=[s]; } else if(d===bestd) hits.push(s);
    });
    if(!hits.length) hits=segs.slice();
    approx=true;
  }
  hits.forEach(function(s){ if(codes.indexOf(s[3])<0) codes.push(s[3]); });
  var known=codes.filter(function(c){return PAR[c];});
  if(known.length && known.length<codes.length){ codes=known; hits=hits.filter(function(s){return PAR[s[3]];}); }
  return {codes:codes, hits:hits, approx:approx};
}

/* ---------- presentación ---------- */
function stName(st){
  var t=st.tipo?st.tipo+' ':'';
  return t+(st.parte?st.parte+' ':'')+st.name;
}
function tramo(s){
  var lado=s[0]===1?'impares':s[0]===2?'pares':'ambos lados';
  if(s[1]===0 && s[2]===0) return s[0]?lado+' (sin tramo)':'sin número concreto';
  if(s[1]===s[2]) return lado==='ambos lados'?'nº '+s[1]:lado+': nº '+s[1];
  return lado+' '+s[1]+'–'+s[2];
}
function parInfo(code){
  var p=PAR[code];
  if(!p) return {name: code?'Código «'+code+'» (no figura en la lista de parroquias)':'Sin parroquia asignada en el callejero', html:'', unknown:true};
  var nm=p[0], dir=p[1], pob=p[2], cp=p[3], tel=p[4], vic=p[5], arc=p[6], aeq=p[7];
  var bits=[];
  var dirTxt=[dir, [cp,pob].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  if(dirTxt) bits.push(esc(dirTxt)+' · <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+
    encodeURIComponent('Parroquia '+nm+', '+dir+', '+pob)+'">mapa</a>');
  if(tel) bits.push('<a href="tel:'+esc(tel.replace(/\s+/g,''))+'">'+esc(tel)+'</a>');
  var meta=[]; if(vic) meta.push('Vicaría '+esc(vic)); if(arc) meta.push('Arciprestazgo '+esc(arc));
  if(aeq && PAR[aeq]) meta.push('unida <i>aeque principaliter</i> a '+esc(PAR[aeq][0])+' (nº '+esc(aeq)+')');
  return {name:nm, html:bits.join(' · ')+(meta.length?'<br>'+meta.join(' · '):'')};
}
function parBlock(code, segs, alt){
  var info=parInfo(code);
  var tr=segs?segs.filter(function(s){return s[3]===code;}).map(tramo).join(' · '):'';
  return '<div class="par'+(alt?' alt':'')+'"><div class="pn">'+esc(info.name)+(PAR[code]?'<small>nº '+esc(code)+'</small>':'')+'</div>'+
    (info.html?'<div class="pd">'+info.html+'</div>':'')+(tr?'<div class="tr">Tramo: '+esc(tr)+'</div>':'')+'</div>';
}
function tramosTable(st, hits, open){
  var rows=st.segs.slice().sort(function(a,b){return a[0]-b[0]||a[1]-b[1];}).map(function(s){
    var p=PAR[s[3]], hit=hits && hits.indexOf(s)>=0;
    return '<tr'+(hit?' class="hit"':'')+'><td>'+esc(tramo(s))+'</td><td>'+esc(p?p[0]:(s[3]||'—'))+(p?' <span style="color:var(--text2)">('+esc(s[3])+')</span>':'')+'</td></tr>';
  }).join('');
  return '<details class="tramos"'+(open?' open':'')+'><summary>Ver todos los tramos de esta vía ('+st.segs.length+')</summary><table><tr><th>Números</th><th>Parroquia</th></tr>'+rows+'</table></details>';
}
function card(st, q, isBest){
  var r=resolve(st,q.num), h='';
  h+='<div class="card'+(isBest?' best':'')+'"><div class="st"><h3>'+esc(stName(st))+(q.num!=null?' <span class="num">'+esc(q.numTxt)+'</span>':'')+'</h3>'+
     '<span class="muni">'+esc(MUNIS[st.m])+'</span>';
  if(r.codes.length===1 && !r.approx) h+='<span class="tag">'+(q.num!=null||st.segs.every(function(s){return s[3]===r.codes[0];})?'Parroquia':'Parroquia probable')+'</span>';
  h+='</div>';
  if(q.num==null && r.codes.length>1){
    h+='<div class="hint">Esta vía se reparte entre <b>'+r.codes.length+' parroquias</b> según el número. Escribe el número del portal para saber cuál es.</div>';
    if(r.codes.length<=4) r.codes.forEach(function(c){ h+=parBlock(c, st.segs, true); });
    else return h+tramosTable(st, null, true)+'</div>';
  }else if(r.approx){
    h+='<div class="hint">El nº '+esc(q.numTxt)+' no está en los tramos registrados de esta vía. Lo más probable, por el tramo más cercano'+(r.codes.length>1?', es una de estas':'')+':</div>';
    r.codes.forEach(function(c){ h+=parBlock(c, r.hits, r.codes.length>1); });
  }else if(r.codes.length>1){
    h+='<div class="hint">Este número aparece en tramos de <b>varias parroquias</b>. Comprueba los tramos o confirma con la parroquia.</div>';
    r.codes.forEach(function(c){ h+=parBlock(c, r.hits, true); });
  }else{
    h+=parBlock(r.codes[0], q.num!=null?r.hits:st.segs, false);
  }
  if(st.segs.length>1) h+=tramosTable(st, q.num!=null?r.hits:null);
  return h+'</div>';
}
var shown=6;
function run(mas){
  if(!$q) return;
  var raw=$q.value.trim();
  $x.hidden=!raw;
  if(!mas) shown=6;
  if(!DATA){ $out.innerHTML=''; $status.textContent=raw?'Cargando callejero…':''; return; }
  if(!raw){ $status.textContent=''; $out.innerHTML=''; return; }
  var q=parse(raw), r=search(q), alt=null;
  /* si el número parece formar parte del nombre ("Doce de Octubre", "calle 3"), probar sin separarlo */
  if(q.num!=null && (!r.list.length || r.list[0].sc<70)){
    var q2=Object.assign({},q,{num:null,numTxt:''}); q2.w=q.tokAll.filter(function(t,i){return !STOP[t] && !(i===0 && TIPO_PAL[t] && q.g);});
    var r2=search(q2);
    if(r2.list.length && (!r.list.length || r2.list[0].sc>r.list[0].sc+5)){ q=q2; r=r2; }
  }
  /* si el municipio escrito no da resultados, buscar en todos */
  if(!r.list.length && q.muniFromText && $mun.value===''){
    var q3=Object.assign({},q,{muni:null}); var r3=search(q3);
    if(r3.list.length){ alt='No encuentro esa vía en '+MUNIS[q.muni]+'; muestro coincidencias en otros municipios.'; q=q3; r=r3; }
  }
  render(q,r,alt);
}
function render(q,r,alt){
  var list=r.list, h='';
  if(!q.w.length && q.muni!=null){
    $status.textContent=''; $out.innerHTML='<div class="hint">Escribe también el nombre de la calle.</div>'; return;
  }
  if(!list.length){
    var n=norm(q.raw), towns=Object.keys(TOWNS).filter(function(t){return (' '+n+' ').indexOf(' '+t+' ')>=0;});
    if(towns.length){
      $status.textContent='';
      towns.forEach(function(t){
        var T=TOWNS[t];
        h+='<div class="card best"><div class="st"><h3>'+esc(T.name)+'</h3><span class="tag soft">sin callejero</span></div>'+
           '<div class="hint">Este municipio no tiene callejero detallado; '+(T.codes.length>1?'estas son sus parroquias':'esta es su parroquia')+':</div>';
        T.codes.forEach(function(c){ h+=parBlock(c,null,T.codes.length>1); });
        h+='</div>';
      });
      $out.innerHTML=h; return;
    }
    $status.textContent='';
    $out.innerHTML='<div class="hint">No encuentro ninguna vía con «'+esc(q.raw)+'»'+(r.muni!=null?' en '+esc(MUNIS[r.muni]):'')+
      '. Prueba con el nombre principal de la calle (p. ej. «Alcalá» en vez de «Calle de Alcalá»), sin abreviaturas raras'+
      (r.muni!=null?', o cambia el municipio a «Todos»':'')+'.</div>';
    return;
  }
  /* pistas para afinar */
  var munis={}, tipos={}, names={};
  list.forEach(function(x){ munis[x.st.m]=1; tipos[x.st.g]=1; names[x.st.j]=1; });
  var nM=Object.keys(munis).length, nT=Object.keys(tipos).length, nN=Object.keys(names).length;
  var exact=list[0].sc>=100 && (list.length===1 || list[1].sc<100);
  $status.textContent=list.length===1?'1 vía encontrada':list.length+' vías posibles';
  if(alt) h+='<div class="hint">'+esc(alt)+'</div>';
  if(list.length>1){
    var tips=[];
    if(nM>1 && r.muni==null) tips.push('el <b>municipio</b> ('+Object.keys(munis).slice(0,4).map(function(m){return esc(MUNIS[m]);}).join(', ')+(nM>4?'…':'')+')');
    if(nT>1 && !q.g) tips.push('el <b>tipo de vía</b> ('+Object.keys(tipos).filter(Boolean).slice(0,4).map(function(g){return TIPO_LARGO[g]||g;}).join(', ')+')');
    if(nN>1 && !exact) tips.push('el <b>nombre completo</b> de la vía');
    if(q.num==null && list.some(function(x){ return resolve(x.st,null).codes.length>1; })) tips.push('el <b>número</b> del portal');
    if(tips.length) h+='<div class="hint">Hay varias vías que encajan. Para afinar, indica '+(tips.length>1?tips.slice(0,-1).join('; ')+' y '+tips[tips.length-1]:tips[0])+'.</div>';
  }
  list.slice(0,shown).forEach(function(x,i){ h+=card(x.st,q,i===0 && (list.length===1 || x.sc>list[1].sc+6)); });
  if(list.length>shown) h+='<button class="btn enlace" type="button" id="callejeroMas">Ver '+(list.length-shown)+' más</button>';
  $out.innerHTML=h;
}

return { montar: montar, cargar: cargar };
})();
