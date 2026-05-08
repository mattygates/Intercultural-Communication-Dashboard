document.addEventListener('DOMContentLoaded', () => {
  
  // === GLOBAL STATE ===
  let mrtsData = null; // { m:3, r:4, t:3, s:2, raw: {...} }
  let cultureMapData = {}; // { communicating:5, evaluating:6, ... }

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

  // Drag & drop handlers
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'));
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'));
  });

  dropZone.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files[0]?.type === 'application/pdf') handlePDF(files[0]);
  });

  pdfInput.addEventListener('change', e => {
    if (e.target.files[0]) handlePDF(e.target.files[0]);
  });

  async function handlePDF(file) {
    pdfStatus.className = 'status-box processing';
    pdfStatus.textContent = '🔄 Parsing PDF...';
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(item => item.str).join(' ');
      }
      
      // Extract MRTS profile using regex patterns from Intrivity PDF structure
      const mrtsProfile = extractMRTSProfile(fullText);
      
      if (mrtsProfile) {
        mrtsData = mrtsProfile;
        displayMRTSResults(mrtsProfile);
        pdfStatus.className = 'status-box success';
        pdfStatus.textContent = '✅ MRTS profile extracted successfully!';
        mrtsDisplay.style.display = 'block';
        saveToStorage();
      } else {
        throw new Error('Could not find MRTS profile in PDF. Please ensure you uploaded the correct Intrivity results file.');
      }
    } catch (err) {
      console.error('PDF parse error:', err);
      pdfStatus.className = 'status-box error';
      pdfStatus.textContent = `❌ Error: ${err.message}`;
    }
  }

  function extractMRTSProfile(text) {
    // Pattern 1: Look for "MRTS PROFILE X X X X" or "M R T S X X X X"
    const profileMatch = text.match(/(?:MRTS\s*PROFILE|M\s+R\s+T\s+S)\s+(\d)\s+(\d)\s+(\d)\s+(\d)/i);
    if (profileMatch) {
      const [, m, r, t, s] = profileMatch;
      return {
        profile: `${m}${r}${t}${s}`,
        m: parseInt(m), r: parseInt(r), t: parseInt(t), s: parseInt(s),
        raw: extractRawScores(text)
      };
    }
    
    // Pattern 2: Look for domain scores table
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
    // Intrivity mapping: 4.3-5.0→5, 3.5-4.2→4, 2.7-3.4→3, 1.9-2.6→2, 1.0-1.8→1
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
  const correlations = {
    // Intrivity Message ↔ Culture Map dimensions
    message: {
      dimensions: ['communicating', 'evaluating', 'disagreeing'],
      insights: {
        high: (cm) => `Your high Message score (${mrtsData.m}/5) suggests you naturally pick up subtle, implicit cues. Combined with your Culture Map ${cm.communicating >= 6 ? 'high-context' : 'low-context'} communication style, you may excel at reading between the lines—but watch for over-interpretation when working with very direct communicators.`,
        low: (cm) => `Your lower Message score (${mrtsData.m}/5) indicates a preference for explicit, literal communication. Paired with your Culture Map ${cm.communicating >= 6 ? 'high-context' : 'low-context'} style, you may need to consciously ask clarifying questions when working with indirect communicators.`,
        neutral: (cm) => `Your neutral Message score (${mrtsData.m}/5) gives you flexibility. You can adapt between explicit and implicit styles—use this to bridge gaps between high- and low-context team members.`
      }
    },
    // Intrivity Relationship ↔ Culture Map dimensions
    relationship: {
      dimensions: ['leading', 'trusting', 'deciding'],
      insights: {
        high: (cm) => `Your high Relationship score (${mrtsData.r}/5) means you adjust communication based on status and connection. With your Culture Map ${cm.leading >= 6 ? 'hierarchical' : 'egalitarian'} leadership preference, you likely navigate power dynamics skillfully—but ensure you don't withhold feedback to preserve harmony.`,
        low: (cm) => `Your lower Relationship score (${mrtsData.r}/5) suggests you communicate consistently across status levels. Combined with your ${cm.leading >= 6 ? 'hierarchical' : 'egalitarian'} Culture Map style, you may need to consciously adjust formality when working in strongly hierarchical cultures.`,
        neutral: (cm) => `Your neutral Relationship score (${mrtsData.r}/5) offers balance. You can flex between formal and informal styles—use this to build trust across diverse team structures.`
      }
    },
    // Intrivity Time ↔ Culture Map dimensions
    time: {
      dimensions: ['scheduling', 'deciding'],
      insights: {
        high: (cm) => `Your high Time score (${mrtsData.t}/5) indicates comfort with flexible scheduling and fluid deadlines. Paired with your ${cm.scheduling >= 6 ? 'flexible-time' : 'linear-time'} Culture Map preference, you may thrive in dynamic environments—but clarify expectations explicitly with linear-time colleagues.`,
        low: (cm) => `Your lower Time score (${mrtsData.t}/5) suggests you prefer structured schedules and firm deadlines. Combined with your ${cm.scheduling >= 6 ? 'flexible-time' : 'linear-time'} Culture Map style, you may need to practice patience when working with fluid-time cultures.`,
        neutral: (cm) => `Your neutral Time score (${mrtsData.t}/5) gives you adaptability. You can work in both structured and fluid environments—use this to help teams establish shared timing norms.`
      }
    },
    // Intrivity Space ↔ Culture Map dimensions
    space: {
      dimensions: ['communicating', 'disagreeing', 'leading'],
      insights: {
        high: (cm) => `Your high Space score (${mrtsData.s}/5) means you're comfortable with expressive nonverbals, close proximity, and shared communication space. With your ${cm.disagreeing >= 6 ? 'confrontational' : 'avoid-confrontation'} Culture Map style, you may excel at reading tension—but label your nonverbal cues to avoid misinterpretation.`,
        low: (cm) => `Your lower Space score (${mrtsData.s}/5) suggests you prefer reserved nonverbals and personal distance. Combined with your ${cm.disagreeing >= 6 ? 'confrontational' : 'avoid-confrontation'} Culture Map style, you may need to consciously signal engagement when working with expressive cultures.`,
        neutral: (cm) => `Your neutral Space score (${mrtsData.s}/5) offers flexibility. You can adapt your nonverbal style to match your counterpart—use this to build rapport across cultural divides.`
      }
    }
  };

  // === GENERATE COMBINED INSIGHTS ===
  document.getElementById('generate-insights-btn')?.addEventListener('click', () => {
    if (!mrtsData) {
      alert('Please upload your Intrivity MRTS PDF first.');
      return;
    }
    
    // Update cultureMapData from sliders
    ['communicating','evaluating','persuading','leading','deciding','trusting','disagreeing','scheduling'].forEach(dim => {
      cultureMapData[dim] = parseInt(document.getElementById(dim).value);
    });
    
    const insights = [];
    
    // Generate insight for each MRTS domain
    ['message', 'relationship', 'time', 'space'].forEach(domain => {
      const score = mrtsData[domain.charAt(0)]; // m,r,t,s
      const config = correlations[domain];
      let insight = config.insights.neutral(cultureMapData);
      
      if (score >= 4) insight = config.insights.high(cultureMapData);
      else if (score <= 2) insight = config.insights.low(cultureMapData);
      
      insights.push(`<h4>${domain.charAt(0).toUpperCase() + domain.slice(1)} Domain</h4>
        <p><span class="insight-tag">MRTS: ${score}/5</span> <span class="insight-tag">Culture Map: ${config.dimensions.join(', ')}</span></p>
        <p>${insight}</p>`);
    });
    
    // Add cross-framework synthesis
    const synthesis = generateSynthesis(mrtsData, cultureMapData);
    insights.push(`<h4>🔗 Cross-Framework Synthesis</h4><p>${synthesis}</p>`);
    
    document.getElementById('insights-content').innerHTML = insights.join('');
    document.getElementById('insights-box').style.display = 'block';
    
    // Scroll to insights
    document.getElementById('insights-box').scrollIntoView({ behavior: 'smooth' });
  });

  function generateSynthesis(mrts, cm) {
    // Key pattern: High MRTS Relationship + High Culture Map Trusting = strong relational trust builder
    // High MRTS Message + Low Culture Map Communicating = potential clarity gap
    
    const patterns = [];
    
    if (mrts.r >= 4 && cm.trusting >= 6) {
      patterns.push("You likely build trust through personal connection—leverage this when working with relationship-based cultures.");
    }
    if (mrts.m >= 4 && cm.communicating <= 4) {
      patterns.push("You read subtle cues well, but your direct communication style may require you to explicitly state intentions to avoid ambiguity.");
    }
    if (mrts.t <= 2 && cm.scheduling <= 4) {
      patterns.push("Your preference for structure aligns with linear-time cultures—use your clarity to help flexible-time colleagues understand deadlines.");
    }
    if (mrts.s >= 4 && cm.disagreeing >= 6) {
      patterns.push("Your expressive nonverbals combined with comfort with debate may make you a powerful facilitator of healthy conflict.");
    }
    
    if (patterns.length === 0) {
      return "Your MRTS and Culture Map profiles show balanced flexibility. Focus on consciously adapting one domain at a time when entering new cultural contexts.";
    }
    
    return patterns.join(" ");
  }

  // === LOCAL STORAGE ===
  function saveToStorage() {
    const data = {
      mrts: mrtsData,
      cultureMap: cultureMapData,
      reflections: {} // Could add reflection saving here
    };
    localStorage.setItem('intercultural-dashboard', JSON.stringify(data));
  }

  function loadFromStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem('intercultural-dashboard'));
      if (saved?.cultureMap) {
        cultureMapData = saved.cultureMap;
        Object.entries(cultureMapData).forEach(([key, val]) => {
          const slider = document.getElementById(key);
          if (slider) {
            slider.value = val;
            updateVal(key, val);
          }
        });
      }
      if (saved?.mrts) {
        mrtsData = saved.mrts;
        displayMRTSResults(mrtsData);
        document.getElementById('mrts-display').style.display = 'block';
      }
    } catch (e) {
      console.warn('Could not load saved data:', e);
    }
  }

  // Initialize
  loadFromStorage();

  // === EXPORT/IMPORT JSON ===
  document.getElementById('save-profile-btn')?.addEventListener('click', () => {
    const data = {
      mrts: mrtsData,
      cultureMap: cultureMapData,
      exported: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intercultural-profile-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        if (data.mrts) {
          mrtsData = data.mrts;
          displayMRTSResults(mrtsData);
          document.getElementById('mrts-display').style.display = 'block';
        }
        if (data.cultureMap) {
          cultureMapData = data.cultureMap;
          Object.entries(cultureMapData).forEach(([key, val]) => {
            const slider = document.getElementById(key);
            if (slider) {
              slider.value = val;
              updateVal(key, val);
            }
          });
        }
        alert('✅ Profile loaded successfully!');
      } catch (err) {
        alert('❌ Error loading profile: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // === SNAPSHOT GENERATION (enhanced with MRTS data) ===
  document.getElementById('generate-snapshot-btn')?.addEventListener('click', () => {
    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
    
    // Enhanced strengths with MRTS
    const strengths = [];
    if (mrtsData?.m >= 4) strengths.push("Reading subtle, implicit messages");
    if (mrtsData?.r >= 4) strengths.push("Building trust through personal connection");
    if (cultureMapData?.communicating >= 6) strengths.push("Navigating high-context communication");
    strengths.push("Bridging communication gaps and clarifying intent");
    
    document.getElementById('snap-strengths').innerHTML = strengths.slice(0,3).map(s => `<li>I may be strong at: ${s}</li>`).join('');
    
    // Enhanced risks
    const risks = [];
    if (mrtsData?.m <= 2 && cultureMapData?.communicating >= 6) risks.push("Miss implicit cues in high-context settings");
    if (mrtsData?.t <= 2 && cultureMapData?.scheduling >= 6) risks.push("Experience frustration with flexible deadlines");
    risks.push("Others may misread me as hesitant when processing silently");
    
    document.getElementById('snap-risks').innerHTML = risks.slice(0,3).map(r => `<li>I may unintentionally: ${r}</li>`).join('');
    
    // Actions from Section 10
    document.getElementById('snap-action-1').textContent = `Be more explicit about: ${getVal('sec10-adapt') || 'decision finality and feedback expectations'}`;
    document.getElementById('snap-action-2').textContent = `Ask before assuming: ${getVal('sec10-keep') || 'meaning behind indirect cues or silence'}`;
    document.getElementById('snap-action-3').textContent = `Clarify team norms around: ${getVal('sec10-norm') || 'urgency, feedback style, and conflict approach'}`;
    
    const conv = getVal('sec10-ask') || getVal('sec9-check') || 'How we align on communication and decision styles';
    document.getElementById('snap-conversation').textContent = `"The conversation I need to have with my team is: ${conv}."`;
    
    // Switch to summary
    navigateTo('summary');
    window.scrollTo(0, 0);
  });

  // === AUTO-SAVE REFLECTIONS (existing functionality) ===
  document.querySelectorAll('textarea').forEach(input => {
    const saved = localStorage.getItem(input.id);
    if (saved) input.value = saved;
    input.addEventListener('input', () => {
      localStorage.setItem(input.id, input.value);
    });
  });
});