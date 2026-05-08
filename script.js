document.addEventListener('DOMContentLoaded', () => {
  let mrtsData = null;
  const cultureMapData = {};
  const dims = ['communicating','evaluating','persuading','leading','deciding','trusting','disagreeing','scheduling'];

  window.updateVal = function(id, val) {
    const display = document.getElementById(`val-${id}`);
    if (display) display.textContent = `${val}/10`;
    cultureMapData[id] = Number(val);
    saveToStorage();
  };

  function displayMRTSResults(data) {
    document.getElementById('m-score').textContent = data.m;
    document.getElementById('r-score').textContent = data.r;
    document.getElementById('t-score').textContent = data.t;
    document.getElementById('s-score').textContent = data.s;
    document.getElementById('mrts-code').textContent = data.profile;
    document.getElementById('mrts-display').style.display = 'block';
  }

  function extractMRTSProfile(text) {
    const m = text.match(/MRTS\s*(?:PROFILE)?\s*[:\-]?\s*([1-5])\s+([1-5])\s+([1-5])\s+([1-5])/i);
    if (!m) return null;
    return { profile: `${m[1]}${m[2]}${m[3]}${m[4]}`, m: +m[1], r: +m[2], t: +m[3], s: +m[4] };
  }

  async function parsePdfText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(' ') + ' ';
    }
    return text;
  }

  document.getElementById('pdf-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const status = document.getElementById('pdf-status');
    status.className = 'status-box processing';
    status.textContent = 'Parsing Intrivity PDF...';

    try {
      if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js unavailable');
      const text = await parsePdfText(file);
      const parsed = extractMRTSProfile(text);
      if (!parsed) throw new Error('Could not find MRTS profile in PDF');
      mrtsData = parsed;
      displayMRTSResults(parsed);
      status.className = 'status-box success';
      status.textContent = 'Intrivity profile loaded successfully.';
      saveToStorage();
    } catch (err) {
      status.className = 'status-box error';
      status.textContent = `${err.message}. Expected format like: MRTS PROFILE 3 4 3 2`;
    }
  });

  const domainConfig = {
    message: { key: 'm', dims: ['communicating','evaluating','disagreeing'], definition: 'How explicit vs implicit your communication tends to be.' },
    relationship: { key: 'r', dims: ['trusting','leading','deciding'], definition: 'How much you prioritize relational trust before task execution.' },
    time: { key: 't', dims: ['scheduling','deciding'], definition: 'How fixed vs flexible you are about timelines and sequencing.' },
    space: { key: 's', dims: ['communicating','disagreeing','leading'], definition: 'How you use presence, nonverbals, silence, and interaction distance.' }
  };

  function buildDomainInsight(name) {
    if (!mrtsData) return '<div class="insight-item misaligned">Upload Intrivity PDF first.</div>';
    const cfg = domainConfig[name];
    const score = mrtsData[cfg.key];
    const avg = Math.round(cfg.dims.reduce((a,d)=>a+(cultureMapData[d] ?? 5),0) / cfg.dims.length);
    const gap = Math.abs((score * 2) - avg);
    const tone = gap >= 4 ? 'misaligned' : 'aligned';
    const action = gap >= 4
      ? 'High gap: explicitly name your intent and agree working norms in advance.'
      : 'Moderate/low gap: keep adapting, and confirm understanding at key moments.';
    return `<div class="insight-item ${tone}">
      <h4>${name[0].toUpperCase()+name.slice(1)} Domain</h4>
      <p><strong>Intrivity definition:</strong> ${cfg.definition}</p>
      <p><span class="insight-tag">Intrivity: ${score}/5</span> <span class="insight-tag">Erin Meyer Avg: ${avg}/10</span></p>
      <p>${action}</p>
    </div>`;
  }

  function renderAllInsights() {
    const box = document.getElementById('insights-box');
    box.innerHTML = Object.keys(domainConfig).map(buildDomainInsight).join('');
  }

  function renderDomainButtons() {
    const wrap = document.getElementById('domain-buttons');
    wrap.innerHTML = '';
    Object.keys(domainConfig).forEach((d) => {
      const b = document.createElement('button');
      b.className = 'btn-secondary';
      b.textContent = d[0].toUpperCase() + d.slice(1);
      b.addEventListener('click', () => {
        document.getElementById('insights-box').innerHTML = buildDomainInsight(d);
      });
      wrap.appendChild(b);
    });
  }

  document.getElementById('generate-insights-btn')?.addEventListener('click', renderAllInsights);

  function saveToStorage() {
    localStorage.setItem('intercultural-dashboard-profile', JSON.stringify({ mrtsData, cultureMapData }));
  }
  function loadFromStorage() {
    const raw = localStorage.getItem('intercultural-dashboard-profile');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.cultureMapData) {
      dims.forEach((d) => {
        const v = saved.cultureMapData[d] ?? 5;
        const el = document.getElementById(d);
        if (el) {
          el.value = v;
          updateVal(d, v);
        }
      });
    }
    if (saved.mrtsData) {
      mrtsData = saved.mrtsData;
      displayMRTSResults(mrtsData);
    }
  }

  dims.forEach((d) => updateVal(d, document.getElementById(d)?.value ?? 5));
  renderDomainButtons();
  loadFromStorage();
});
