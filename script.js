document.addEventListener('DOMContentLoaded', () => {
  
  // === GLOBAL STATE ===
  let mrtsData = null;
  let cultureMapData = {};

  // === NAVIGATION ===
  const navBtns = document.querySelectorAll('.nav-btn[data-section]');
  const panels = document.querySelectorAll('.panel');

  window.navigateTo = function(sectionId) {
    panels.forEach(p => p.classList.remove('active'));
    navBtns.forEach(b => b.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) {
      target.classList.add('active');
      const btn = document.querySelector(`[data-section="${sectionId}"]`);
      if (btn) btn.classList.add('active');
    }
  };

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  });

  // === HELPER: Update slider display ===
  window.updateVal = function(id, val) {
    const display = document.getElementById(`val-${id}`);
    if (display) display.textContent = val;
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
        <div><label>Message (1-5): <input type="number" id="manual-m" min="1" max="5" value="3" style="width:100%;padding:6px;"></label></div>
        <div><label>Relationship (1-5): <input type="number" id="manual-r" min="1" max="5" value="4" style="width:100%;padding:6px;"></label></div>
        <div><label>Time (1-5): <input type="number" id="manual-t" min="1" max="5" value="3" style="width:100%;padding:6px;"></label></div>
        <div><label>Space (1-5): <input type="number" id="manual-s" min="1" max="5" value="2" style="width:100%;padding:6px;"></label></div>
      </div>
      <button id="use-manual-btn" class="btn-primary" style="margin-top:12px;">Load Manual Profile</button>
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
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
    dropZone?.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); }, false);
  });
  ['dragenter', 'dragover'].forEach(e => {
    dropZone?.addEventListener(e, () => dropZone?.classList.add('dragover'), false);
  });
  ['dragleave', 'drop'].forEach(e => {
    dropZone?.addEventListener(e, () => dropZone?.classList.remove('dragover'), false);
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
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
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
    // Match MRTS 3 4 3 2 or MRTS PROFILE 3 4 3 2
    const profileMatch = text.match(/MRTS\s+(?:PROFILE\s+)?(\d)\s+(\d)\s+(\d)\s+(\d)/i);
    if (profileMatch) {
      const [, m, r, t, s] = profileMatch.map(Number);
      return { profile: `${m}${r}${t}${s}`, m, r, t, s };
    }
    // Fallback: look for "3 4 3 2" pattern anywhere
    const simpleMatch = text.match(/(\d)\s+(\d)\s+(\d)\s+(\d)/);
    if (simpleMatch) {
      const [, m, r, t, s] = simpleMatch.map(Number);
      if (m>=1 && m<=5 && r>=1 && r<=5 && t>=1 && t<=5 && s>=1 && s<=5) {
        return { profile: `${m}${r}${t}${s}`, m, r, t, s };
      }
    }
    return null;
  }

  function displayMRTSResults(data) {
    const ids = { m: 'm-score', r: 'r-score', t: 't-score', s: 's-score' };
    const rawIds = { m: 'm-raw', r: 'r-raw', t: 't-raw', s: 's-raw' };
    Object.entries(ids).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = data[key];
    });
    const codeEl = document.getElementById('mrts-code');
    if (codeEl) codeEl.textContent = data.profile;
  }

  // === CORRELATION ENGINE (FIXED) ===
  const correlationMap = {
    message: {
      cmDims: ['communicating', 'evaluating', 'disagreeing'],
      getInsight: (mScore, cmScores) => {
        const cmScore = cmScores[cmDims[0]] || 5;
        if (mScore <= 2 && cmScore >= 6) return "Your direct expression style may feel abrupt to high-context colleagues. Practice softening with downgraders ('perhaps', 'maybe') when working with indirect cultures.";
        if (mScore >= 4 && cmScore <= 4) return "Your implicit expression may be missed by low-context colleagues. Practice stating key points explicitly before adding nuance.";
        return "Your neutral expression style offers flexibility. Consciously adapt directness based on your counterpart's cultural positioning.";
      }
    },
    relationship: {
      cmDims: ['leading', 'trusting', 'deciding'],
      getInsight: (mScore, cmScores) => {
        const cmScore = cmScores[cmDims[0]] || 5;
        if (mScore >= 4 && cmScore <= 4) return "Your reliance on personal networks aligns with relationship-based cultures, but task-based colleagues may see this as 'favoritism'. Explicitly state criteria for decisions to build trust.";
        if (mScore <= 2 && cmScore >= 6) return "Your transactional approach may feel cold in relationship-based cultures. Invest time in personal connection before business.";
        return "Your balanced relational awareness is a bridge-builder.";
      }
    },
    time: {
      cmDims: ['scheduling', 'deciding'],
      getInsight: (mScore, cmScores) => {
        const cmScore = cmScores[cmDims[0]] || 5;
        if (mScore <= 2 && cmScore >= 6) return "Your strict timeframe preference fits linear-time cultures, but may feel rigid in flexible-time settings. Build buffer time into plans.";
        if (mScore >= 4 && cmScore <= 4) return "Your flexible timeframe approach fits fluid-time cultures, but may seem unreliable in linear-time settings. Explicitly confirm deadlines.";
        return "Your neutral time management is adaptable. Clarify expectations upfront.";
      }
    },
    space: {
      cmDims: ['communicating', 'disagreeing', 'leading'],
      getInsight: (mScore, cmScores) => {
        const cmScore = cmScores[cmDims[0]] || 5;
        if (mScore <= 2 && cmScore >= 6) return "Your reserved nonverbals fit high-context cultures, but may seem disengaged in expressive settings. Signal attention explicitly.";
        if (mScore >= 4 && cmScore <= 4) return "Your expressive nonverbals fit low-context cultures, but may overwhelm reserved colleagues. Practice 'nonverbal calibration'.";
        return "Your moderate nonverbal style is adaptable. Scan your counterpart's cues and adjust.";
      }
    }
  };

  // === GENERATE INSIGHTS BUTTON (ROBUST) ===
  document.getElementById('generate-insights-btn')?.addEventListener('click', () => {
    try {
      if (!mrtsData) {
        alert('Please upload your Intrivity MRTS PDF first.');
        return;
      }

      // Read all sliders
      ['communicating','evaluating','persuading','leading','deciding','trusting','disagreeing','scheduling'].forEach(dim => {
        cultureMapData[dim] = parseInt(document.getElementById(dim)?.value || 5);
      });

      const insightsBox = document.getElementById('insights-content');
      if (!insightsBox) {
        console.error('Missing #insights-content element. Check HTML structure.');
        return;
      }

      let html = '';
      Object.entries(correlationMap).forEach(([domain, config]) => {
        const score = mrtsData[domain.charAt(0)];
        const insight = config.getInsight(score, cultureMapData);
        const alignment = (score <= 2 || score >= 4) ? 'misaligned' : 'aligned';
        html += `
          <div class="insight-item ${alignment}">
            <h4>${domain.charAt(0).toUpperCase() + domain.slice(1)} Domain</h4>
            <p><span class="insight-tag">MRTS: ${score}/5</span> <span class="insight-tag">CM: ${config.cmDims.join(', ')}</span></p>
            <p>${insight}</p>
          </div>`;
      });

      insightsBox.innerHTML = html;
      document.getElementById('insights-box').style.display = 'block';
      document.getElementById('insights-box').scrollIntoView({ behavior: 'smooth' });
      
    } catch (err) {
      console.error('Insight generation failed:', err);
      alert('Error generating insights. Please check the browser console (F12) for details.');
    }
  });

  // === LOCAL STORAGE ===
  function saveToStorage() {
    try {
      localStorage.setItem('intercultural-dashboard-profile', JSON.stringify({ mrts: mrtsData, cultureMap: cultureMapData }));
    } catch (e) { console.warn('Storage save failed:', e); }
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
    } catch (e) { console.warn('Storage load failed:', e); }
  }

  loadFromStorage();

  // === EXPORT/IMPORT JSON ===
  document.getElementById('save-profile-btn')?.addEventListener('click', () => {
    const data = { mrts: mrtsData, cultureMap: cultureMapData, exported: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `intercultural-profile-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });

  document.getElementById('load-profile-btn')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
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
  });

  // === SNAPSHOT GENERATION ===
  document.getElementById('generate-snapshot-btn')?.addEventListener('click', () => {
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    const strengths = [];
    if (mrtsData?.m >= 4) strengths.push("Reading subtle, implicit messages");
    if (mrtsData?.r >= 4) strengths.push("Building trust through personal connection");
    if (cultureMapData?.communicating >= 6) strengths.push("Navigating high-context communication");
    strengths.push("Bridging communication gaps and clarifying intent");
    document.getElementById('snap-strengths').innerHTML = strengths.slice(0,3).map(s => `<li>I may be strong at: ${s}</li>`).join('');
    
    const risks = [];
    if (mrtsData?.m <= 2 && cultureMapData?.communicating >= 6) risks.push("Miss implicit cues in high-context settings");
    if (mrtsData?.t <= 2 && cultureMapData?.scheduling >= 6) risks.push("Experience frustration with flexible deadlines");
    risks.push("Others may misread me as hesitant when processing silently");
    document.getElementById('snap-risks').innerHTML = risks.slice(0,3).map(r => `<li>I may unintentionally: ${r}</li>`).join('');
    
    document.getElementById('snap-action-1').textContent = `Be more explicit about: ${getVal('sec10-adapt') || 'decision finality and feedback expectations'}`;
    document.getElementById('snap-action-2').textContent = `Ask before assuming: ${getVal('sec10-keep') || 'meaning behind indirect cues or silence'}`;
    document.getElementById('snap-action-3').textContent = `Clarify team norms around: ${getVal('sec10-norm') || 'urgency, feedback style, and conflict approach'}`;
    
    const conv = getVal('sec10-ask') || getVal('sec9-check') || 'How we align on communication and decision styles';
    document.getElementById('snap-conversation').textContent = `"The conversation I need to have with my team is: ${conv}."`;
    
    navigateTo('summary');
    window.scrollTo(0, 0);
  });

  // === AUTO-SAVE REFLECTIONS ===
  document.querySelectorAll('textarea').forEach(input => {
    const saved = localStorage.getItem(input.id);
    if (saved) input.value = saved;
    input.addEventListener('input', () => {
      localStorage.setItem(input.id, input.value);
    });
  });
});