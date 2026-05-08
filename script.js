document.addEventListener('DOMContentLoaded', () => {
  let mrtsData = null;
  const cm = {};
  const dims=['communicating','evaluating','persuading','leading','deciding','trusting','disagreeing','scheduling'];

  const scaleDefs={
    communicating:'Low-context = explicit/clear. High-context = nuanced/read-between-lines.',
    evaluating:'Low side favors diplomatic critique; high side favors frank/direct criticism.',
    persuading:'Lower scores lean inductive (examples first); higher scores lean deductive (principles first).',
    leading:'Lower scores = egalitarian; higher scores = hierarchical/deference to authority.',
    deciding:'Lower scores = top-down/individual decision; higher scores = group-consensus building.',
    trusting:'Lower scores = task/cognitive trust; higher scores = relationship/affective trust.',
    disagreeing:'Lower scores avoid open confrontation; higher scores view open debate as productive.',
    scheduling:'Lower scores are flexible/reactive; higher scores are structured/agenda-driven.'
  };

  const domainCfg={
    message:{key:'m',name:'Message',dims:['communicating','evaluating','disagreeing'],intrivity:'How your expression clarity, tone, and directness are typically interpreted.'},
    relationship:{key:'r',name:'Relationship',dims:['trusting','leading','deciding'],intrivity:'How you form trust, social connection, and authority expectations.'},
    time:{key:'t',name:'Time',dims:['scheduling','deciding'],intrivity:'How you handle urgency, sequence, and deadline reliability.'},
    space:{key:'s',name:'Space',dims:['communicating','disagreeing','leading'],intrivity:'How you use presence, silence, nonverbals, and interpersonal distance.'}
  };

  window.updateVal=(id,val)=>{cm[id]=Number(val);document.getElementById(`val-${id}`).textContent=`${val}/10`;renderBars();save()};

  async function parsePdf(file){
    const buf=await file.arrayBuffer();
    const pdf=await pdfjsLib.getDocument({data:buf}).promise;let text='';
    for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const c=await pg.getTextContent();text+=c.items.map(x=>x.str).join(' ')+' ';}
    return text;
  }
  function extract(text){const m=text.match(/MRTS\s*(?:PROFILE)?\s*[:\-]?\s*([1-5])\s+([1-5])\s+([1-5])\s+([1-5])/i);return m?{profile:`${m[1]}${m[2]}${m[3]}${m[4]}`,m:+m[1],r:+m[2],t:+m[3],s:+m[4]}:null}

  document.getElementById('pdf-input').addEventListener('change',async(e)=>{
    const f=e.target.files?.[0];if(!f)return; const s=document.getElementById('pdf-status'); s.className='status-box processing'; s.textContent='Parsing PDF...';
    try{const txt=await parsePdf(f); const p=extract(txt); if(!p) throw new Error('MRTS code not found'); mrtsData=p;
      ['m','r','t','s'].forEach(k=>document.getElementById(`${k}-score`).textContent=p[k]); document.getElementById('mrts-code').textContent=p.profile; document.getElementById('mrts-display').style.display='block';
      s.className='status-box success'; s.textContent='Intrivity loaded'; renderKpis(); save();
    }catch(err){s.className='status-box error'; s.textContent=`${err.message}. Expected “MRTS PROFILE 3 4 3 2”.`;}
  });

  function insightFor(domain){
    if(!mrtsData) return '<div class="insight-item misaligned">Upload Intrivity PDF first.</div>';
    const c=domainCfg[domain], sc=mrtsData[c.key], avg=Math.round(c.dims.reduce((a,d)=>a+(cm[d]??5),0)/c.dims.length), gap=Math.abs((sc*2)-avg);
    const tone=gap>=4?'misaligned':'aligned';
    const dimText=c.dims.map(d=>`${d}: ${scaleDefs[d]}`).join(' ');
    const behavior=gap>=4
      ? `Gap is high (${gap}). Your ${c.name.toLowerCase()} domain likely lands differently than team expectations. Translate intent explicitly, pre-brief your style, and set a norm before key interactions.`
      : `Gap is moderate/low (${gap}). You have workable alignment. Keep confirming interpretation and adapt with situational cues.`;
    return `<div class="insight-item ${tone}"><h4>${c.name} Domain</h4><p><strong>Intrivity lens:</strong> ${c.intrivity}</p><p><span class='insight-tag'>Intrivity ${sc}/5</span><span class='insight-tag'>Erin Meyer avg ${avg}/10</span></p><p>${behavior}</p><p class='small'><strong>Erin Meyer scale signals:</strong> ${dimText}</p></div>`;
  }

  function renderAll(){document.getElementById('insights-box').innerHTML=Object.keys(domainCfg).map(insightFor).join('');}
  function renderButtons(){const w=document.getElementById('domain-buttons');Object.keys(domainCfg).forEach(d=>{const b=document.createElement('button');b.className='btn-secondary';b.textContent=domainCfg[d].name;b.onclick=()=>document.getElementById('insights-box').innerHTML=insightFor(d);w.appendChild(b);});}
  function renderBars(){const wrap=document.getElementById('cm-bars'); if(!wrap) return; wrap.innerHTML=dims.map(d=>`<div class='bar-row'><div class='bar-head'><span>${d}</span><span>${cm[d]??5}/10</span></div><div class='bar-track'><div class='bar-fill' style='width:${(cm[d]??5)*10}%'></div></div></div>`).join('');}
  function renderKpis(){if(!mrtsData)return;const m=mrtsData;document.getElementById('kpi-grid').innerHTML=`<div class='kpi'><div class='label'>Message</div><div class='value'>${m.m}/5</div></div><div class='kpi'><div class='label'>Relationship</div><div class='value'>${m.r}/5</div></div><div class='kpi'><div class='label'>Time</div><div class='value'>${m.t}/5</div></div><div class='kpi'><div class='label'>Space</div><div class='value'>${m.s}/5</div></div>`;}

  function save(){localStorage.setItem('icd',JSON.stringify({mrtsData,cm}));}
  function load(){const r=localStorage.getItem('icd'); if(!r)return; const s=JSON.parse(r); if(s.cm){dims.forEach(d=>{const v=s.cm[d]??5;document.getElementById(d).value=v;updateVal(d,v);});} if(s.mrtsData){mrtsData=s.mrtsData;['m','r','t','s'].forEach(k=>document.getElementById(`${k}-score`).textContent=mrtsData[k]);document.getElementById('mrts-code').textContent=mrtsData.profile;document.getElementById('mrts-display').style.display='block';renderKpis();}}

  document.getElementById('generate-insights-btn').addEventListener('click',renderAll);
  renderButtons();
  document.querySelector('.card:nth-of-type(3)').insertAdjacentHTML('afterbegin',"<div id='kpi-grid' class='kpi-grid'></div><div class='chart-grid'><div class='chart-card'><h4>Erin Meyer Dimension Bars</h4><div id='cm-bars'></div></div><div class='chart-card'><h4>How to use</h4><p>Click a domain button for focused insights or generate all domains.</p></div></div>");
  dims.forEach(d=>updateVal(d,document.getElementById(d).value));
  load();
});
