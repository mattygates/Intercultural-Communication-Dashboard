document.addEventListener('DOMContentLoaded', () => {
  
  // === GLOBAL STATE ===
  let mrtsData = null; // { profile: "3432", m:3, r:4, t:3, s:2, raw: {...} }
  let cultureMapData = {};

  // === NAVIGATION ===
  const navBtns = document.querySelectorAll('.nav-btn[data-section]');
  const panels = document.querySelectorAll('.panel');

  window.navigateTo = function(sectionId) {
    panels.forEach(p => p.classList.remove('active'));
    navBtns.forEach(b => b.classList.remove('active'));
    document.getElementById(sectionId)?.classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
  };

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  });

  // === HELPER: Update slider display ===
  window.updateVal = function(id, val) {
    document.getElementById(`val-${id}`).textContent = val;
    cultureMapData[id] = parseInt(val);
    saveToStorage();
  };

  // === PDF UPLOAD & PARSING ===
  const dropZone = document.getElementById('drop-zone');
  const pdfInput = document.getElementById('pdf-input');
  const pdfStatus = document.getElementById('pdf-status');
  const mrtsDisplay = document.getElementById('mrts-display');

  function isPDFjsReady() {
    return typeof pdfjsLib !== 'undefined' && pdfjsLib.getDocument;
  }

  function showManualEntry() {
    pdfStatus.className = 'status-box error';
    pdfStatus.innerHTML = `
      ⚠️ PDF parsing unavailable. Please enter your MRTS profile manually:
      <div style="margin-top:12px; display:grid; grid-template-columns:repeat(4,1fr); gap:8px;">
        <div><label>Message (1-5): <input type="number" id="manual-m" min="1" max="5" value="3"></label></div>
        <div><label>Relationship (1-5): <input type="number" id="manual-r" min="1" max="5" value="4"></label></div>
        <div><label>Time (1-5): <input type="number" id="manual-t" min="1" max="5" value="3"></label></div>
        <div><label>Space (1-5): <input type="number" id="manual-s" min="1" max="5" value="2"></label></div>
      </div>
      <button id="use-manual-btn" class="btn-primary" style="margin-top:12px;">Use Manual Entry</button>
    `;
    
    document.getElementById('use-manual-btn')?.addEventListener('click', () => {
      const m = parseInt(document.getElementById('manual-m').value);
      const r = parseInt(document.getElementById('manual-r').value);
      const t = parseInt(document.getElementById('manual-t').value);
      const s = parseInt(document.getElementById('manual-s').value);
      mrtsData = { profile: `${m}${r}${t}${s}`, m, r, t, s };
      displayMRTSResults(mrtsData);
      mrtsDisplay.style.display = 'block';
      pdfStatus.className = 'status-box success';
      pdfStatus.textContent = '✅ Manual profile loaded!';
      saveToStorage();
    });
  }

  // Drag & drop handlers
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone?.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
  });
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone?.addEventListener(eventName, () => dropZone?.classList.add('dragover'), false);
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone?.addEventListener(eventName, () => dropZone?.classList.remove('dragover'), false);
  });

  dropZone?.addEventListener('drop', e => {
    const file = e.dataTransfer?.files?.[0];
    if (file?.type === 'application/pdf') handlePDF(file);
  }, false);

  pdfInput?.addEventListener('change', e => {
    if (e.target.files?.[0]) handlePDF(e.target.files[0]);
  }, false);

  async function handlePDF(file) {
    if (!isPDFjsReady()) {
      console.warn('PDF.js not loaded, falling back to manual entry');
      showManualEntry();
      return;
    }

    pdfStatus.className = 'status-box processing';
    pdfStatus.textContent = '🔄 Parsing PDF...';
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument(arrayBuffer);
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ') + ' ';
      }
      
      const mrtsProfile = extractMRTSProfile(fullText);
      
      if (mrtsProfile) {
        mrtsData = mrtsProfile;
        displayMRTSResults(mrtsProfile);
        pdfStatus.className = 'status-box success';
        pdfStatus.textContent = '✅ MRTS profile extracted!';
        mrtsDisplay.style.display = 'block';
        saveToStorage();
      } else {
        throw new Error('MRTS profile not found in PDF');
      }
    } catch (err) {
      console.error('PDF parse error:', err);
      pdfStatus.className = 'status-box error';
      pdfStatus.innerHTML = `❌ ${err.message}<br><button id="retry-manual-btn" class="btn-secondary" style="margin-top:8px;">Enter Manually</button>`;
      document.getElementById('retry-manual-btn')?.addEventListener('click', showManualEntry);
    }
  }

  function extractMRTSProfile(text) {
    const profileMatch = text.match(/(?:MRTS\s*PROFILE|M\s+R\s+T\s+S)\s+(\d)\s+(\d)\s+(\d)\s+(\d)/i);
    if (profileMatch) {
      const [, m, r, t, s] = profileMatch;
      return {
        profile: `${m}${r}${t}${s}`,
        m: parseInt(m), r: parseInt(r), t: parseInt(t), s: parseInt(s),
        raw: extractRawScores(text)
      };
    }
    
    const domainMatch = text.match(/MESSAGE[\s\S]*?(\d\.\d)[\s\S]*?RELATIONSHIP[\s\S]*?(\d\.\d)[\s\S]*?TIME[\s\S]*?(\d\.\d)[\s\S]*?SPACE[\s\S]*?(\d\.\d)/i);
    if (domainMatch) {
      const [, mRaw, rRaw, tRaw, sRaw] = domainMatch;
      return {
        profile: `${scoreToNumeral(parseFloat(mRaw))}${scoreToNumeral(parseFloat(rRaw))}${scoreToNumeral(parseFloat(tRaw))}${scoreToNumeral(parseFloat(sRaw))}`,
        m: scoreToNumeral(parseFloat(mRaw)),
        r: scoreToNumeral(parseFloat(rRaw)),
        t: scoreToNumeral(parseFloat(tRaw)),
        s: scoreToNumeral(parseFloat(sRaw)),
        raw: { m: parseFloat(mRaw), r: parseFloat(rRaw), t: parseFloat(tRaw), s: parseFloat(sRaw) }
      };
    }
    return null;
  }

  function extractRawScores(text) {
    const scores = {};
    const patterns = [
      [/MESSAGE[\s\S]*?(\d\.\d)/i, 'm'],
      [/RELATIONSHIP[\s\S]*?(\d\.\d)/i, 'r'],
      [/TIME[\s\S]*?(\d\.\d)/i, 't'],
      [/SPACE[\s\S]*?(\d\.\d)/i, 's']
    ];
    patterns.forEach(([regex, key]) => {
      const match = text.match(regex);
      if (match) scores[key] = parseFloat(match[1]);
    });
    return scores;
  }

  function scoreToNumeral(raw) {
    if (raw >= 4.3) return 5;
    if (raw >= 3.5) return 4;
    if (raw >= 2.7) return 3;
    if (raw >= 1.9) return 2;
    return 1;
  }

  function displayMRTSResults(data) {
    document.getElementById('mrts-code').textContent = data.profile;
    document.getElementById('m-score').textContent = data.m;
    document.getElementById('r-score').textContent = data.r;
    document.getElementById('t-score').textContent = data.t;
    document.getElementById('s-score').textContent = data.s;
    if (data.raw) {
      document.getElementById('m-raw').textContent = data.raw.m?.toFixed(1) || '-';
      document.getElementById('r-raw').textContent = data.raw.r?.toFixed(1) || '-';
      document.getElementById('t-raw').textContent = data.raw.t?.toFixed(1) || '-';
      document.getElementById('s-raw').textContent = data.raw.s?.toFixed(1) || '-';
    }
  }

  // === CORRELATION ENGINE: Intrivity ↔ Culture Map ===
  const mrtscultureMap = {
    message: {
      dimensions: ['communicating', 'evaluating', 'disagreeing'],
      insight: (mrtsscore, cmscore) => {
        if (mrtsscore <= 2 && cmscore >= 6) return "Your direct expression style may feel abrupt to high-context colleagues. Practice softening with downgraders ('perhaps', 'maybe') when working with indirect cultures.";
        if (mrtsscore >= 4 && cmscore <= 4) return "Your implicit expression may be missed by low-context colleagues. Practice stating key points explicitly before adding nuance.";
        return "Your neutral expression style offers flexibility. Consciously adapt directness based on your counterpart's cultural positioning.";
      }
    },
    relationship: {
      dimensions: ['leading', 'trusting', 'deciding'],
      insight: (mrtsscore, cmscore) => {
        if (mrtsscore >= 4 && cmscore <= 4) return "Your reliance on personal networks aligns with relationship-based cultures, but task-based colleagues may see this as 'favoritism'. Explicitly state criteria for decisions to build trust.";
        if (mrtsscore <= 2 && cmscore >= 6) return "Your transactional approach may feel cold in relationship-based cultures. Invest time in personal connection before business: 'Before we dive in, how has your week been?'";
        return "Your balanced relational awareness is a bridge-builder. Use it to help task-focused colleagues understand relationship norms, and relationship-focused colleagues understand task expectations.";
      }
    },
    time: {
      dimensions: ['scheduling', 'deciding'],
      insight: (mrtsscore, cmscore) => {
        if (mrtsscore <= 2 && cmscore >= 6) return "Your strict timeframe preference fits linear-time cultures, but may feel rigid in flexible-time settings. Build buffer time into plans and expect schedule shifts.";
        if (mrtsscore >= 4 && cmscore <= 4) return "Your flexible timeframe approach fits fluid-time cultures, but may seem unreliable in linear-time settings. Explicitly confirm deadlines: 'Just to confirm, this is due Friday at 3pm?'";
        return "Your neutral time management is adaptable. Clarify expectations upfront: 'Is this deadline fixed or flexible?' and adjust your planning accordingly.";
      }
    },
    space: {
      dimensions: ['communicating', 'disagreeing', 'leading'],
      insight: (mrtsscore, cmscore) => {
        if (mrtsscore <= 2 && cmscore >= 6) return "Your reserved nonverbals fit high-context cultures, but may seem disengaged in expressive settings. Signal attention explicitly: nodding, brief verbal acknowledgments.";
        if (mrtsscore >= 4 && cmscore <= 4) return "Your expressive nonverbals fit low-context cultures, but may overwhelm reserved colleagues. Practice 'nonverbal calibration': match your counterpart's energy level.";
        return "Your moderate nonverbal style is adaptable. Scan your counterpart's cues and adjust: more expressiveness for expressive cultures, more restraint for reserved cultures.";
      }
    }
  };

  // === GENERATE COMBINED INSIGHTS ===
  document.getElementById('generate-insights-btn')?.addEventListener('click', () => {
    if (!mrtsData) {
      alert('Please upload your Intrivity MRTS PDF first.');
      return;
    }
    
    ['communicating','evaluating','persuading','leading','deciding','trusting','disagreeing','scheduling'].forEach(dim => {
      cultureMapData[dim] = parseInt(document.getElementById(dim).value);
    });
    
    const insights = [];
    ['message', 'relationship', 'time', 'space'].forEach(domain => {
      const score = mrtsData[domain.charAt(0)];
      const config = mrtscultureMap[domain];
      let insight = config.insights?.neutral || "Balanced style detected. Consciously adapt to your counterpart's cultural positioning.";
      
      if (score >= 4) insight = config.insight(score, 10);
      else if (score <= 2) insight = config.insight(score, 0);
      else insight = config.insight(score, 5);
      
      insights.push(`<h4>${domain.charAt(0).toUpperCase() + domain.slice(1)} Domain</h4>
        <p><span class="insight-tag">MRTS: ${score}/5</span> <span class="insight-tag">Culture Map: ${config.dimensions.join(', ')}</span></p>
        <p>${insight}</p>`);
    });
    
    const synthesis = [];
    if (mrtsData.r >= 4 && cultureMapData.trusting >= 6) synthesis.push("You likely build trust through personal connection—leverage this when working with relationship-based cultures.");
    if (mrtsData.m >= 4 && cultureMapData.communicating <= 4) synthesis.push("You read subtle cues well, but your direct communication style may require you to explicitly state intentions to avoid ambiguity.");
    if (mrtsData.t <= 2 && cultureMapData.scheduling <= 4) synthesis.push("Your preference for structure aligns with linear-time cultures—use your clarity to help flexible-time colleagues understand deadlines.");
    
    if (synthesis.length > 0) {
      insights.push(`<h4>🔗 Cross-Framework Synthesis</h4><p>${synthesis.join(" ")}</p>`);
    } else {
      insights.push(`<h4>🔗 Cross-Framework Synthesis</h4><p>Your MRTS and Culture Map profiles show balanced flexibility. Focus on consciously adapting one domain at a time when entering new cultural contexts.</p>`);
    }
    
    document.getElementById('insights-content').innerHTML = insights.join('');
    document.getElementById('insights-box').style.display = 'block';
    document.getElementById('insights-box').scrollIntoView({ behavior: 'smooth' });
  });

  // === LOCAL STORAGE ===
  function saveToStorage() {
    const data = { mrts: mrtsData, cultureMap: cultureMapData };
    localStorage.setItem('intercultural-dashboard-profile', JSON.stringify(data));
  }

  function loadFromStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem('intercultural-dashboard-profile'));
      if (saved?.cultureMap) {
        cultureMapData = saved.cultureMap;
        Object.entries(cultureMapData).forEach(([key, val]) => {
          const slider = document.getElementById(key);
          if (slider) { slider.value = val; updateVal(key, val); }
        });
      }
      if (saved?.mrts) {
        mrtsData = saved.mrts;
        displayMRTSResults(mrtsData);
        mrtsDisplay.style.display = 'block';
      }
    } catch (e) { console.warn('Could not load saved profile:', e); }
  }

  loadFromStorage();

  // === EXPORT/IMPORT JSON ===
  document.getElementById('save-profile-btn')?.addEventListener('click', () => {
    const data = { mrts: mrtsData, cultureMap: cultureMapData, exported: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `intercultural-profile-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  });

  document.getElementById('load-profile-btn')?.addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  document.getElementById('file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.mrts) { mrtsData = data.mrts; displayMRTSResults(mrtsData); mrtsDisplay.style.display = 'block'; }
        if (data.cultureMap) {
          cultureMapData = data.cultureMap;
          Object.entries(cultureMapData).forEach(([key, val]) => {
            const slider = document.getElementById(key);
            if (slider) { slider.value = val; updateVal(key, val); }
          });
        }
        alert('✅ Profile loaded successfully!');
      } catch (err) { alert('❌ Error loading profile: ' + err.message); }
    };
    reader.readAsText(file);
