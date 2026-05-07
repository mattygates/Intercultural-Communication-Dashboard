document.addEventListener('DOMContentLoaded', () => {
  // 1. Navigation Logic
  const navBtns = document.querySelectorAll('.nav-btn[data-section]');
  const panels = document.querySelectorAll('.panel');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;
      panels.forEach(p => p.classList.remove('active'));
      navBtns.forEach(b => b.classList.remove('active'));
      
      const targetPanel = document.getElementById(target) || document.getElementById('summary');
      targetPanel.classList.add('active');
      btn.classList.add('active');
    });
  });

  // 2. Auto-Save / Load from LocalStorage
  const inputs = document.querySelectorAll('textarea');
  
  // Load saved values
  inputs.forEach(input => {
    const saved = localStorage.getItem(input.id);
    if (saved) input.value = saved;

    // Save on input
    input.addEventListener('input', () => {
      localStorage.setItem(input.id, input.value);
    });
  });

  // 3. Snapshot Generation Logic
  const generateBtn = document.getElementById('generate-snapshot-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      // Map inputs to snapshot placeholders
      const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
      
      document.getElementById('snap-strengths').innerHTML = `
        <li>I may be strong at: ${getVal('sec5-reflection') || 'adapting to different trust-building styles'}</li>
        <li>I may help the team by: ${getVal('sec2-reflection') || 'bridging communication gaps and clarifying intent'}</li>
        <li>I may bridge differences around: ${getVal('sec3-reflection') || 'feedback clarity and relationship preservation'}</li>
      `;

      document.getElementById('snap-risks').innerHTML = `
        <li>I may unintentionally: ${getVal('sec2-goal') || 'assume clarity without explicit confirmation'}</li>
        <li>Others may misread me as: ${getVal('sec6-reflection') || 'hesitant or withholding when processing silently'}</li>
        <li>I may struggle when: ${getVal('sec4-reflection') || 'decision ownership and speed expectations are unclear'}</li>
      `;

      document.getElementById('snap-action-1').textContent = `Be more explicit about: ${getVal('sec10-adapt') || 'decision finality and feedback expectations'}`;
      document.getElementById('snap-action-2').textContent = `Ask before assuming: ${getVal('sec10-keep') || 'meaning behind indirect cues or silence'}`;
      document.getElementById('snap-action-3').textContent = `Clarify team norms around: ${getVal('sec10-norm') || 'urgency, feedback style, and conflict approach'}`;
      
      const conv = getVal('sec10-ask') || getVal('sec9-check') || 'How we align on communication and decision styles';
      document.getElementById('snap-conversation').textContent = `“The conversation I need to have with my team is: ${conv}.”`;

      // Switch to summary tab
      navBtns.forEach(b => b.classList.remove('active'));
      document.querySelector('[data-section="summary"]').classList.add('active');
      panels.forEach(p => p.classList.remove('active'));
      document.getElementById('summary').classList.add('active');
      
      // Scroll to top
      window.scrollTo(0, 0);
    });
  }

  // Optional: Clear all button (uncomment if desired)
  // document.getElementById('clear-data')?.addEventListener('click', () => {
  //   if(confirm('Clear all saved reflections?')) { localStorage.clear(); location.reload(); }
  // });
});