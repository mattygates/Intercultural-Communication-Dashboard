document.addEventListener('DOMContentLoaded', () => {
  let mrtsData = null;
  let cultureMapData = {};

  const navBtns = document.querySelectorAll('.nav-btn[data-section]');
  const panels = document.querySelectorAll('.panel');

  window.navigateTo = function(sectionId) {
    panels.forEach((p) => p.classList.remove('active'));
    navBtns.forEach((b) => b.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) {
      target.classList.add('active');
      const btn = document.querySelector(`[data-section="${sectionId}"]`);
      if (btn) btn.classList.add('active');
    }
  };

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  });

  window.updateVal = function(id, val) {
    const display = document.getElementById(`val-${id}`);
    if (display) display.textContent = `${val}/10`;
    cultureMapData[id] = Number.parseInt(val, 10);
    saveToStorage();
  };

  function displayMRTSResults(data) {
    const ids = { m: 'm-score', r: 'r-score', t: 't-score', s: 's-score' };
    Object.entries(ids).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = data[key];
    });
    const codeEl = document.getElementById('mrts-code');
    if (codeEl) codeEl.textContent = data.profile;
  }

  const correlationMap = {
    message: {
      cmDims: ['communicating', 'evaluating', 'disagreeing'],
      getInsight: (mScore, cmScores, cmDims) => {
        const cmScore = cmScores[cmDims[0]] || 5;
        if (mScore <= 2 && cmScore >= 6) return "Your direct expression style may feel abrupt to high-context colleagues.";
        if (mScore >= 4 && cmScore <= 4) return 'Your implicit expression may be missed by low-context colleagues.';
        return 'Your neutral expression style offers flexibility.';
      }
    },
    relationship: {
      cmDims: ['leading', 'trusting', 'deciding'],
      getInsight: (mScore, cmScores, cmDims) => {
        const cmScore = cmScores[cmDims[0]] || 5;
        if (mScore >= 4 && cmScore <= 4) return 'Your relationship orientation may need explicit task criteria in low-context teams.';
        if (mScore <= 2 && cmScore >= 6) return 'Invest in personal connection before business in relationship-based contexts.';
        return 'Your balanced relational awareness is a bridge-builder.';
      }
    },
    time: {
      cmDims: ['scheduling', 'deciding'],
      getInsight: (mScore, cmScores, cmDims) => {
        const cmScore = cmScores[cmDims[0]] || 5;
        if (mScore <= 2 && cmScore >= 6) return 'Your strict timeframe preference may feel rigid in flexible-time settings.';
        if (mScore >= 4 && cmScore <= 4) return 'Your flexible timeframe may seem unreliable in linear-time settings.';
        return 'Your neutral time management is adaptable.';
      }
    },
    space: {
      cmDims: ['communicating', 'disagreeing', 'leading'],
      getInsight: (mScore, cmScores, cmDims) => {
        const cmScore = cmScores[cmDims[0]] || 5;
        if (mScore <= 2 && cmScore >= 6) return 'Your reserved nonverbals may seem disengaged in expressive settings.';
        if (mScore >= 4 && cmScore <= 4) return 'Your expressive nonverbals may overwhelm reserved colleagues.';
        return 'Your moderate nonverbal style is adaptable.';
      }
    }
  };

  document.getElementById('generate-insights-btn')?.addEventListener('click', () => {
    if (!mrtsData) return;
    const insightsBox = document.getElementById('insights-content');
    if (!insightsBox) return;

    let html = '';
    Object.entries(correlationMap).forEach(([domain, config]) => {
      const score = mrtsData[domain.charAt(0)];
      const insight = config.getInsight(score, cultureMapData, config.cmDims);
      const alignment = score <= 2 || score >= 4 ? 'misaligned' : 'aligned';
      html += `<div class="insight-item ${alignment}"><h4>${domain}</h4><p>${insight}</p></div>`;
    });

    insightsBox.innerHTML = html;
    const insightsContainer = document.getElementById('insights-box');
    if (insightsContainer) insightsContainer.style.display = 'block';
  });

  function saveToStorage() {
    localStorage.setItem('intercultural-dashboard-profile', JSON.stringify({ mrts: mrtsData, cultureMap: cultureMapData }));
  }

  function loadFromStorage() {
    const raw = localStorage.getItem('intercultural-dashboard-profile');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved?.cultureMap) cultureMapData = saved.cultureMap;
    if (saved?.mrts) {
      mrtsData = saved.mrts;
      displayMRTSResults(mrtsData);
    }
  }

  loadFromStorage();
});
