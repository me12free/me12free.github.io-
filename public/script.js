/* script.js — sanitized, autoscroll-friendly interactive resume */
(() => {
  'use strict';

  // --- DOM refs (may be null if the page was edited) ---
  const terminalOutput = document.getElementById('terminal-output');
  const terminalInput = document.getElementById('terminal-input');
  const promptEl = document.getElementById('prompt');
  const helpOverlay = document.getElementById('helpOverlay');
  const helpContents = document.getElementById('helpContents');
  const closeHelp = document.getElementById('closeHelp');
  const themeSelect = document.getElementById('themeSelect');
  const lightbox = document.getElementById('lightbox');
  const lbContent = document.querySelector('.lb-content');
  const lbClose = document.querySelector('.lb-close');

  if (!terminalOutput || !terminalInput) {
    console.error('Required terminal DOM elements are missing.');
    window.cvCommands = {};
    return;
  }

  // --- state ---
  let prompt = 'ekiru@portfolio:~$';
  let commandHistory = [];
  let historyIndex = -1;
  let analytics = {};
  try { analytics = JSON.parse(localStorage.getItem('cv_analytics') || '{}'); } catch (e) { analytics = {}; }

  const commandOrder = [
    'about','summary','skills','keyskills','experience','projects','volunteering',
    'certifications','education','contact','media','audio','audio2','video','image',
    'clear','download','vcard','stats','sudo','nightmode','help'
  ];

  // --- utilities ---
  const safeStr = v => (typeof v === 'string' ? v : '');
  function fuzzyMatches(input, list) {
    const s = safeStr(input).toLowerCase();
    if (!s) return [];
    return list.filter(x => x.toLowerCase().includes(s));
  }
  function trackCommand(cmd) {
    if (!cmd) return;
    analytics[cmd] = (analytics[cmd] || 0) + 1;
    try { localStorage.setItem('cv_analytics', JSON.stringify(analytics)); } catch (e) { /* ignore */ }
  }
  function resetAnalytics() {
    analytics = {};
    try { localStorage.removeItem('cv_analytics'); } catch (e) {}
  }

  // Basic HTML escape
  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // Create a sanitized DOM node from an allowed HTML snippet.
  // Whitelist a small set of tags and restore them after escaping.
  function createHtmlNode(html) {
  // For trusted command outputs, render HTML directly
  const container = document.createElement('div');
  container.className = 'terminal-html-block animated-content';
  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'flex-start';
  container.innerHTML = html;
  return container;
  }

  // Append and autoscroll
  function appendLine(node) {
  terminalOutput.appendChild(node);
  try { node.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
  }

  // printLine: accepts string or HTMLElement. sanitizes allowed HTML
  function printLine(input, isCmd = false) {
  const line = document.createElement('div');
  line.className = 'terminal-line animated-line';
  line.style.display = 'flex';
  line.style.flexDirection = 'row';
  line.style.alignItems = 'center';
  line.style.justifyContent = 'flex-start';

  if (isCmd) {
    const cmdSpan = document.createElement('span');
    cmdSpan.className = 'terminal-cmd';
    cmdSpan.textContent = prompt;
    cmdSpan.style.alignSelf = 'center';
    line.appendChild(cmdSpan);

    const inputSpan = document.createElement('span');
    inputSpan.textContent = safeStr(input);
    inputSpan.style.alignSelf = 'center';
    line.appendChild(inputSpan);

    appendLine(line);
    return line;
  }

  // Animate output as a single line, but show HTML only after animation
  const text = safeStr(input);
  const outSpan = document.createElement('span');
  outSpan.className = 'terminal-output-text animated-content';
  outSpan.style.alignSelf = 'center';
  line.appendChild(outSpan);
  appendLine(line);
  if (/<[^>]+>/.test(text)) {
    // Strip tags for animation, then swap to HTML after typing
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    typeText(outSpan, plainText, 0, () => {
      outSpan.innerHTML = text;
      outSpan.classList.remove('typing');
      try { line.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (e) {}
    });
    return line;
  } else {
    // plain text -> typewriter
    typeText(outSpan, text, 0, () => {
      try { line.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (e) {}
    });
    return line;
  }
  }

  // simple typewriter effect
  function typeText(element, text, i = 0, cb = null) {
    try {
      if (i === 0) element.textContent = '';
      if (i < text.length) {
        element.textContent += text[i];
        element.classList.add('typing');
        const pl = element.closest('.terminal-line');
        if (pl) try { pl.scrollIntoView({ behavior: 'auto', block: 'end' }); } catch (e) {}
        setTimeout(() => typeText(element, text, i + 1, cb), 10 + Math.random() * 30);
      } else {
        element.classList.remove('typing');
        if (typeof cb === 'function') cb();
      }
    } catch (err) {
      console.error('typeText error', err);
      if (typeof cb === 'function') cb();
    }
  }

  // embed media (returns HTMLElement container)
  function embedMedia(type, src, alt) {
    const container = document.createElement('div');
    container.style.display = 'block';
    container.style.margin = '8px 0';

    if (type === 'img') {
      const img = document.createElement('img');
      img.src = safeStr(src);
      img.alt = safeStr(alt || '');
      img.style.maxWidth = '220px';
      img.style.borderRadius = '8px';
      img.style.cursor = 'zoom-in';
      img.addEventListener('load', () => { try { img.closest('.terminal-line')?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (e) {} });
      img.addEventListener('click', () => openLightbox(src, alt));
      container.appendChild(img);
      return container;
    }

    if (type === 'audio') {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = safeStr(src);
      audio.style.maxWidth = '420px';
      audio.addEventListener('loadedmetadata', () => { try { audio.closest('.terminal-line')?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (e) {} });
      container.appendChild(audio);
      return container;
    }

    if (type === 'video') {
      const video = document.createElement('video');
      video.controls = true;
      video.src = safeStr(src);
      video.style.maxWidth = '640px';
      video.style.borderRadius = '8px';
      video.addEventListener('loadedmetadata', () => { try { video.closest('.terminal-line')?.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (e) {} });
      container.appendChild(video);
      return container;
    }

    const a = document.createElement('a');
    a.href = safeStr(src);
    a.textContent = safeStr(alt || src);
    a.target = '_blank';
    container.appendChild(a);
    return container;
  }

  // lightbox
  function openLightbox(src, alt = '') {
    if (!lightbox || !lbContent) return;
    lbContent.innerHTML = '';
    const img = document.createElement('img');
    img.src = safeStr(src);
    img.alt = safeStr(alt);
    img.style.maxWidth = '90vw';
    img.style.maxHeight = '80vh';
    lbContent.appendChild(img);
    lightbox.classList.remove('hidden');
  }
  function closeLightbox() {
    if (!lightbox || !lbContent) return;
    lightbox.classList.add('hidden');
    lbContent.innerHTML = '';
  }

  // render skill bar container
  function renderSkillBar(label, percent) {
    const wrap = document.createElement('div');
    wrap.className = 'skill-wrap';
    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:6px;">
        <span>${escapeHtml(label)}</span><span>${percent}%</span>
      </div>
      <div class="skill-bar-outer"><div class="skill-bar-inner" style="width:0%"></div></div>
    `;
    setTimeout(() => {
      const inner = wrap.querySelector('.skill-bar-inner');
      if (inner) inner.style.width = percent + '%';
    }, 70);
    return wrap;
  }

  // vCard download
  function downloadVCard() {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:John Ekiru',
      'TEL;TYPE=cell:+254748100347',
      'EMAIL:johnekiru72@gmail.com',
      'TITLE:Software Developer',
      'ORG:Self',
      'ADR;TYPE=WORK:;;Nairobi;Kenya;;',
      'URL:https://github.com/me12free',
      'URL:https://www.linkedin.com/in/john-ekiru-2797a01b3/',
      'URL:https://www.salesforce.com/trailblazer/jekiru',
      'END:VCARD'
    ].join('\n');
    const blob = new Blob([vcf], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'JohnEkiru.vcf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // PDF (uses html2pdf if present)
  function downloadPDF() {
    try {
      // Build CV header with profile photo and contact info
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.marginBottom = '18px';
      header.innerHTML = `
        <img src='media/profile.jpg' alt='Profile photo' style='width:80px;height:80px;border-radius:50%;margin-right:18px;'>
        <div>
          <div style='font-size:1.25rem;font-weight:700;'>John Ekiru</div>
          <div style='font-size:1.08rem;'>Software Developer</div>
          <div style='font-size:1.01rem;'>Nairobi, Kenya</div>
          <div style='font-size:0.98rem;'>Email: johnekiru72@gmail.com</div>
          <div style='font-size:0.98rem;'>Phone: +254748100347</div>
          <div style='font-size:0.98rem;'>LinkedIn: linkedin.com/in/john-ekiru-2797a01b3</div>
          <div style='font-size:0.98rem;'>GitHub: github.com/me12free</div>
          <div style='font-size:0.98rem;'>Trailblazer: jekiru</div>
        </div>
      `;

      // Media section
      const mediaSection = document.createElement('div');
      mediaSection.style.margin = '18px 0';
      mediaSection.innerHTML = `
        <div style='font-size:1.08rem;font-weight:600;margin-bottom:8px;'>Media & Downloads</div>
        <ul style='font-size:0.98rem;'>
          <li>Profile Photo: <a href='media/profile.jpg'>media/profile.jpg</a></li>
          <li>CV PDF: <a href='media/John Ekiru CV 2025.pdf'>media/John Ekiru CV 2025.pdf</a></li>
          <li>Image: <a href='media/ekiru.png'>media/ekiru.png</a></li>
          <li>Audio: <a href='media/Aylex - Last Summer (freetouse.com).mp3'>Aylex - Last Summer</a></li>
          <li>Audio: <a href='media/Pufino - Enlivening (freetouse.com).mp3'>Pufino - Enlivening</a></li>
          <li>Video: <a href='media/CampusBite.webm'>CampusBite Demo</a></li>
        </ul>
      `;

      // Terminal output
      const clone = terminalOutput.cloneNode(true);
      clone.querySelectorAll('.terminal-line').forEach(el => { el.style.boxShadow = 'none'; el.style.border = 'none'; });

      // Compose wrapper
      const wrapper = document.createElement('div');
      wrapper.style.background = '#fff';
      wrapper.style.color = '#111';
      wrapper.style.padding = '20px';
      wrapper.style.fontFamily = 'Arial, sans-serif';
      wrapper.appendChild(header);
      wrapper.appendChild(mediaSection);
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const opt = {
        margin: 0.4,
        filename: 'JohnEkiru_Resume.pdf',
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      if (window.html2pdf) {
        html2pdf().from(wrapper).set(opt).save().then(() => wrapper.remove()).catch(() => wrapper.remove());
      } else {
        window.print();
        wrapper.remove();
      }
    } catch (err) {
      console.error('downloadPDF error', err);
      window.print();
    }
  }

  // --- commands (use createHtmlNode for HTML outputs) ---
  const commands = {
    help: {
      description: 'List available commands',
      action: () => {
        const keys = Object.keys(commands).sort();
        const line = 'Available commands: ' + keys.join(', ');
        printLine(line);
        return '';
      }
    },
    about: {
      description: 'About John Ekiru',
      action: () => {
        const line = `👋 <b>John Ekiru</b>, <b>Email:</b> <a href="mailto:johnekiru72@gmail.com" class="terminal-link">johnekiru72@gmail.com</a>, <b>Phone:</b> <span class="highlight">+254748100347</span>, <b>LinkedIn:</b> <a href="https://www.linkedin.com/in/john-ekiru-2797a01b3/" target="_blank" class="terminal-link">linkedin.com/in/john-ekiru</a>, <b>GitHub:</b> <a href="https://github.com/me12free" target="_blank" class="terminal-link">github.com/me12free</a>, <b>Trailblazer:</b> <a href="https://www.salesforce.com/trailblazer/jekiru" target="_blank" class="terminal-link">jekiru</a>, <b>Location:</b> Nairobi, Kenya`;
        printLine(line);
        return '';
      }
    },
    summary: {
      description: 'Professional summary',
      action: () => {
        const line = `💼 <b>Results‑driven Software Engineer specializing in the Laravel PHP ecosystem.</b> I design, build, and ship production-ready web apps through the full software-development lifecycle, from requirements and UI prototypes to CI/CD pipelines and cloud deployment. Adept at <b>Vue.js</b> front-end work, RESTful API design, MySQL data modeling, and automated testing. Hands-on experience deploying via <b>GitHub Actions</b> to <b>Hostinger®</b> and <b>cPanel</b> hosts, enabling zero-downtime releases. Comfortable collaborating in agile, remote-first, or on-site teams. Domain exposure in higher education portals, agritech marketplaces, and nonprofit CRM workflows. Passionate about continuous learning and bringing extra value through add-on experience with ERP/CRM integrations—<b>Salesforce</b>, <b>Odoo</b>, and <b>HubSpot</b>.`;
        printLine(line);
        return '';
      }
    },
    skills: {
      description: 'Technical skills (summary)',
      action: () => {
        const line = `
<div style='max-width:680px;'>
<b>Web Technologies:</b> <span class='highlight'>Laravel</span>, <span class='highlight'>JavaScript</span>, <span class='highlight'>HTML</span>, <span class='highlight'>CSS</span>, Bootstrap, Blade, <span class='highlight'>Vue.js</span><br>
<b>Salesforce System Administration:</b> <span class='highlight'>Service Cloud</span>, <span class='highlight'>Sales Cloud</span>, <span class='highlight'>Apex</span><br>
<b>Odoo ERP System Administration:</b> <span class='highlight'>Odoo 16</span><br>
<b>Programming Languages:</b> <span class='highlight'>PHP</span>, <span class='highlight'>C++</span>, <span class='highlight'>C</span>, Kotlin, <span class='highlight'>Java</span><br>
<b>Database Technologies:</b> <span class='highlight'>MySQL</span>, <span class='highlight'>SQL</span>, <span class='highlight'>Postgres</span>, MariaDB<br>
<b>Tools & Platforms:</b> <span class='highlight'>Git & GitHub</span>, <span class='highlight'>Visual Studio Code</span>, <span class='highlight'>Linux</span>, Arduino, Odoo, Salesforce, AI, Vi & Vim editors<br>
<b>Languages & Frameworks:</b> <span class='highlight'>PHP8+</span>, <span class='highlight'>Laravel10+</span>, <span class='highlight'>Vue3</span>, <span class='highlight'>JavaScript (ES6)</span>, <span class='highlight'>HTML5</span>, <span class='highlight'>CSS3/Bootstrap</span>, Blade, C++, Java, C, Python<br>
<b>Databases:</b> <span class='highlight'>MySQL</span>, <span class='highlight'>MariaDB</span>, <span class='highlight'>PostgreSQL</span>, SQL<br>
<b>Key Skills:</b> <span class='highlight'>Adaptability and Flexibility</span>, <span class='highlight'>Open-minded</span>, <span class='highlight'>Quick Learning</span>, <span class='highlight'>Collaborative Team Player</span>, <span class='highlight'>Problem-solving</span>, <span class='highlight'>Effective Communicator</span><br>
<b>Tools & Collaboration:</b> <span class='highlight'>Git</span>, <span class='highlight'>GitHub</span>, <span class='highlight'>Linux (Ubuntu)</span>, Vi, AI, Slack, <span class='highlight'>VS Code</span><br>
<b>DevOps & Cloud:</b> <span class='highlight'>GitHub Actions</span>, <span class='highlight'>CI/CD</span>, <span class='highlight'>Hostinger hPanel</span>, <span class='highlight'>cPanel</span><br>
<b>Integrations/CRMs/ERPs:</b> <span class='highlight'>Salesforce (Admin & Sales Cloud Cert)</span>, <span class='highlight'>Odoo 16</span>, <span class='highlight'>HubSpot</span><br>
<b>APIs:</b> <span class='highlight'>M‑Pesa STK</span><br>
</div>
<span style="color:#ffd700;">Type <b>skillsDetailed</b> for animated skill bars.</span>`;
        printLine(line);
        return '';
      }
    },
    skillsDetailed: {
      description: 'Show animated skill bars',
      action: () => {
        const container = document.createElement('div');
        container.appendChild(renderSkillBar('Laravel', 90));
        container.appendChild(renderSkillBar('JavaScript', 85));
        container.appendChild(renderSkillBar('HTML/CSS', 95));
        container.appendChild(renderSkillBar('MySQL', 82));
        container.appendChild(renderSkillBar('Salesforce Admin', 75));
        return container;
      }
    },
    keyskills: { description: 'Key soft skills', action: () => {
  const line = '🌟 <b>Adaptability and Flexibility</b>, <b>Open-minded</b>, <b>Quick Learning</b>, <b>Collaborative Team Player</b>, <b>Problem-solving</b>, <b>Effective Communicator</b>';
  printLine(line);
  return '';
    } },
    experience: {
      description: 'Work experience',
      action: () => {
        const line = '💼 <b>Web Developer</b> @ <b>Strathmore University</b> (2025), Built document verification & student systems, <b>Laravel Developer</b> @ <b>StreamTalk.Online</b> (2024-2025)';
        printLine(line);
        return '';
      }
    },
    projects: {
      description: 'Project list',
      action: () => {
        const line = '🚀 <b>Pesalink × Strathmore Hackathon Winner</b> (2025), <b>Campus Indoor Navigation System</b>, <b>PettyPay (Laravel)</b>';
        printLine(line);
        return '';
      }
    },
    volunteering: { description: 'Volunteering', action: () => {
  const line = '🤝 <b>Hope Children\'s Home</b>, <b>Flying Kites community support</b>';
  printLine(line);
  return '';
    } },
    certifications: { description: 'Certs & awards', action: () => {
  const line = '🎓 <b>Salesforce Certified Administrator</b>, <b>Sales Cloud Consultant</b>';
  printLine(line);
  return '';
    } },
    education: { description: 'Education', action: () => {
  const line = '🎓 <b>Strathmore University</b> (2022-2026), <b>ALX</b> (2023-2024)';
  printLine(line);
  return '';
    } },
    contact: {
      description: 'Contact information',
      action: () => {
        const line = `📧 <a href='mailto:johnekiru72@gmail.com' class='terminal-link'>johnekiru72@gmail.com</a>, 📱 <span class="highlight">+254748100347</span>, 🔗 <a href='https://github.com/me12free' target='_blank' class='terminal-link'>github.com/me12free</a>, 🔗 <a href='https://www.linkedin.com/in/john-ekiru-2797a01b3/' target='_blank' class='terminal-link'>Linkedin</a>, 🔗 <a href='https://www.salesforce.com/trailblazer/jekiru' target='_blank' class='terminal-link'>Trailblazer</a>`;
        printLine(line);
        return '';
      }
    },
    image: { description: 'Show profile photo', action: () => embedMedia('img', 'media/profile.jpg', 'Profile photo') },
    media: { description: 'List available media', action: () => {
      const mediaFiles = [
        { type: 'img', src: 'media/profile.jpg', label: 'Profile Photo' },
        { type: 'img', src: 'media/ekiru.png', label: 'Ekiru PNG' },
        { type: 'audio', src: 'media/Aylex - Last Summer (freetouse.com).mp3', label: 'Aylex - Last Summer' },
        { type: 'audio', src: 'media/Pufino - Enlivening (freetouse.com).mp3', label: 'Pufino - Enlivening' },
        { type: 'video', src: 'media/CampusBite.webm', label: 'CampusBite Demo' },
        { type: 'pdf', src: 'media/John Ekiru CV 2025.pdf', label: 'CV PDF' }
      ];
      const container = document.createElement('div');
      mediaFiles.forEach(file => {
        let el;
        if (file.type === 'img') {
          el = document.createElement('img');
          el.src = file.src;
          el.alt = file.label;
          el.style.maxWidth = '120px';
          el.style.margin = '8px';
          el.style.borderRadius = '8px';
          el.style.cursor = 'zoom-in';
          el.title = file.label;
          el.addEventListener('click', () => openLightbox(file.src, file.label));
        } else if (file.type === 'audio') {
          el = document.createElement('audio');
          el.controls = true;
          el.src = file.src;
          el.style.maxWidth = '220px';
          el.title = file.label;
        } else if (file.type === 'video') {
          el = document.createElement('video');
          el.controls = true;
          el.src = file.src;
          el.style.maxWidth = '320px';
          el.style.borderRadius = '8px';
          el.title = file.label;
        } else if (file.type === 'pdf') {
          el = document.createElement('a');
          el.href = file.src;
          el.textContent = file.label + ' (PDF)';
          el.target = '_blank';
          el.style.display = 'block';
          el.style.margin = '8px 0';
        }
        if (el) container.appendChild(el);
      });
      printLine(container);
      return '';
    } },
    audio: { description: 'Play audio intro', action: () => embedMedia('audio', 'media/Aylex - Last Summer (freetouse.com).mp3', 'Audio intro') },
    audio2: { description: 'Play second audio', action: () => embedMedia('audio', 'media/Pufino - Enlivening (freetouse.com).mp3', 'Second audio') },
    video: { description: 'Play project demo', action: () => embedMedia('video', 'media/CampusBite.webm', 'Campus demo') },
    clear: { description: 'Clear terminal', action: () => { terminalOutput.innerHTML = ''; return ''; } },
    nightmode: {
      description: 'Cycle UI themes',
      action: () => {
        if (document.body.classList.contains('theme-solar')) {
          document.body.classList.remove('theme-solar');
          document.body.classList.add('theme-matrix');
          if (themeSelect) themeSelect.value = 'matrix';
          return 'Theme: Matrix';
        } else if (document.body.classList.contains('theme-matrix')) {
          document.body.classList.remove('theme-matrix');
          if (themeSelect) themeSelect.value = 'night';
          return 'Theme: Night';
        } else {
          document.body.classList.add('theme-solar');
          if (themeSelect) themeSelect.value = 'solar';
          return 'Theme: Solar';
        }
      }
    },
    download: { description: 'Download resume as PDF', action: () => { downloadPDF(); return 'Preparing PDF...'; } },
    vcard: { description: 'Download vCard contact', action: () => { downloadVCard(); return 'vCard downloaded.'; } },
    stats: {
      description: 'Show local command usage stats',
      action: () => {
        const rows = Object.entries(analytics).sort((a,b) => b[1] - a[1]);
        if (!rows.length) {
          printLine('No stats yet. Interact with the terminal!');
          return '';
        }
        const line = 'Command usage: ' + rows.map(r => `<b>${r[0]}</b>: ${r[1]}`).join(', ');
        printLine(line);
        return '';
      }
    },
    nightmode: {
      description: 'Cycle UI themes',
      action: () => {
        if (document.body.classList.contains('theme-solar')) {
          document.body.classList.remove('theme-solar');
          document.body.classList.add('theme-matrix');
          if (themeSelect) themeSelect.value = 'matrix';
          return 'Theme: Matrix';
        } else if (document.body.classList.contains('theme-matrix')) {
          document.body.classList.remove('theme-matrix');
          if (themeSelect) themeSelect.value = 'night';
          return 'Theme: Night';
        } else {
          document.body.classList.add('theme-solar');
          if (themeSelect) themeSelect.value = 'solar';
          return 'Theme: Solar';
        }
      }
    },
    download: { description: 'Download resume as PDF', action: () => {
      // Directly download the static PDF file
      const a = document.createElement('a');
      a.href = 'media/John Ekiru CV 2025.pdf';
      a.download = 'John Ekiru CV 2025.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return 'Downloading CV PDF...';
    } },
    vcard: { description: 'Download vCard contact', action: () => { downloadVCard(); return 'vCard downloaded.'; } }
  };

  // --- command execution ---
  function handleCommand(cmdStr) {
    if (!cmdStr || !cmdStr.trim()) return;
    const [command, ...args] = cmdStr.trim().split(/\s+/);
    // Always print prompt and command first
    printLine(cmdStr, true);
    if (commands[command]) {
      try {
        trackCommand(command);
        const result = commands[command].action(args);
        // Always print output after prompt/command
        if (result instanceof HTMLElement) printLine(result);
        else if (result) printLine(result);
        const idx = commandOrder.indexOf(command);
        if (idx !== -1 && idx < commandOrder.length - 1) {
          setTimeout(() => { terminalInput.value = commandOrder[idx + 1]; terminalInput.focus(); }, 450);
        }
      } catch (err) {
        console.error('Command error', err);
        printLine('Error executing command: ' + (err && err.message ? err.message : String(err)));
      }
    } else {
      // Print output after prompt/command for errors too
      const matches = fuzzyMatches(command, Object.keys(commands));
      if (matches.length) printLine(`Command not found: ${command}. Did you mean: ${matches.slice(0,6).join(', ')}?`);
      else printLine(`Command not found: ${command}\nType 'help' to see available commands.`);
    }
  }

  // --- input handlers ---
  terminalInput.addEventListener('keydown', (e) => {
    try {
      if (e.key === 'Enter') {
        const cmd = terminalInput.value || '';
        if (cmd.trim()) { commandHistory.push(cmd); historyIndex = commandHistory.length; }
        handleCommand(cmd);
        terminalInput.value = '';
      } else if (e.key === 'ArrowUp') {
        if (commandHistory.length && historyIndex > 0) { historyIndex--; terminalInput.value = commandHistory[historyIndex]; }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (commandHistory.length && historyIndex < commandHistory.length - 1) { historyIndex++; terminalInput.value = commandHistory[historyIndex]; } else { terminalInput.value = ''; historyIndex = commandHistory.length; }
        e.preventDefault();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const val = (terminalInput.value || '').trim();
        if (!val) return;
        const matches = Object.keys(commands).filter(c => c.startsWith(val));
        if (matches.length === 1) terminalInput.value = matches[0];
        else if (matches.length > 1) printLine('Suggestions: ' + matches.join(', '));
      }
    } catch (err) {
      console.error('input handler error', err);
    }
  });

  // help overlay toggle
  function toggleHelp() {
    if (!helpOverlay || !helpContents) return;
    if (helpOverlay.classList.contains('hidden')) {
      helpContents.textContent = Object.keys(commands).sort().map(k => `${k} — ${commands[k].description || ''}`).join('\n');
      helpOverlay.classList.remove('hidden');
      setTimeout(() => (closeHelp ? closeHelp.focus() : null), 20);
    } else {
      helpOverlay.classList.add('hidden');
      terminalInput.focus();
    }
  }

  // global shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'l') { e.preventDefault(); terminalOutput.innerHTML = ''; }
    if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); terminalInput.focus(); }
    if (e.key === '?') { toggleHelp(); }
  });

  // help overlay events
  if (closeHelp) closeHelp.addEventListener('click', toggleHelp);
  if (helpOverlay) helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) toggleHelp(); });

  // lightbox events
  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lightbox) lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

  // theme selector
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      document.body.classList.remove('theme-solar', 'theme-matrix', 'theme-night');
      if (e.target.value === 'solar') document.body.classList.add('theme-solar');
      else if (e.target.value === 'matrix') document.body.classList.add('theme-matrix');
      else document.body.classList.add('theme-night');
    });
  }

  // Theme media assets and logic
const themeMedia = {
  night: {
    video: 'media/matrix.mp4',
    audio: 'media/Aylex - Last Summer (freetouse.com).mp3',
  },
  solar: {
    video: 'media/matrix.mp4',
    audio: 'media/Pufino - Enlivening (freetouse.com).mp3',
  },
  matrix: {
    video: 'media/matrix.mp4',
    audio: 'media/Pufino - Enlivening (freetouse.com).mp3',
  }
};

function setThemeMedia(theme) {
  const video = document.getElementById('theme-bg-video');
  const audio = document.getElementById('theme-bg-audio');
  const media = themeMedia[theme] || themeMedia.night;
  video.src = media.video;
  audio.src = media.audio;
}

function updateMediaPlayback() {
  const video = document.getElementById('theme-bg-video');
  const flipcardVideo = document.getElementById('flipcard-bg-video');
  const audio = document.getElementById('theme-bg-audio');
  const playVideo = document.getElementById('playThemeVideo').checked;
  const playAudio = document.getElementById('playThemeAudio').checked;
  video.style.opacity = playVideo ? '0.18' : '0';
  if (flipcardVideo) flipcardVideo.style.opacity = playVideo ? '0.22' : '0';
  if (playVideo) { video.play(); if (flipcardVideo) flipcardVideo.play(); } else { video.pause(); if (flipcardVideo) flipcardVideo.pause(); }
  if (playAudio) { audio.play(); audio.style.display = 'block'; } else { audio.pause(); audio.style.display = 'none'; }
}

document.getElementById('themeSelect').addEventListener('change', function(e) {
  const theme = e.target.value;
  document.body.className = 'theme-' + theme;
  setThemeMedia(theme);
  updateMediaPlayback();
});
document.getElementById('playThemeVideo').addEventListener('change', updateMediaPlayback);
document.getElementById('playThemeAudio').addEventListener('change', updateMediaPlayback);

// List of available media files
const videoFiles = [
  'media/',
  'media/5377684-uhd_3840_2160_25fps.mp4',
  'media/9783697-uhd_4096_2160_25fps.mp4',
  'media/CampusBite.webm'
];
const audioFiles = [
  'media/Aylex - Last Summer (freetouse.com).mp3',
  'media/Pufino - Enlivening (freetouse.com).mp3'
];

function populateMediaDropdowns() {
  const videoSelect = document.getElementById('videoSelect');
  const audioSelect = document.getElementById('audioSelect');
  if (videoSelect) {
    videoFiles.forEach(file => {
      const opt = document.createElement('option');
      opt.value = file;
      opt.textContent = file.split('/').pop();
      videoSelect.appendChild(opt);
    });
    videoSelect.value = videoFiles[0];
  }
  if (audioSelect) {
    audioFiles.forEach(file => {
      const opt = document.createElement('option');
      opt.value = file;
      opt.textContent = file.split('/').pop();
      audioSelect.appendChild(opt);
    });
    audioSelect.value = audioFiles[0];
  }
}

function setThemeMediaFromDropdowns() {
  const video = document.getElementById('theme-bg-video');
  const flipcardVideo = document.getElementById('flipcard-bg-video');
  const audio = document.getElementById('theme-bg-audio');
  const videoSelect = document.getElementById('videoSelect');
  const audioSelect = document.getElementById('audioSelect');
  if (videoSelect) {
    video.src = videoSelect.value;
    if (flipcardVideo) {
      flipcardVideo.src = videoSelect.value;
    } else {
      // If flipcard video doesn't exist, create it and insert before .flip-card
      const mainFlex = document.querySelector('.main-flex');
      if (mainFlex) {
        const fcVideo = document.createElement('video');
        fcVideo.id = 'flipcard-bg-video';
        fcVideo.autoplay = true;
        fcVideo.loop = true;
        fcVideo.muted = true;
        fcVideo.playsInline = true;
        fcVideo.src = videoSelect.value;
        fcVideo.style.position = 'absolute';
        fcVideo.style.zIndex = '-2';
        fcVideo.style.top = '0';
        fcVideo.style.left = '0';
        fcVideo.style.width = '100%';
        fcVideo.style.height = '100%';
        fcVideo.style.objectFit = 'cover';
        fcVideo.style.opacity = '0.22';
        fcVideo.style.pointerEvents = 'none';
        fcVideo.style.transition = 'opacity 0.5s';
        mainFlex.insertBefore(fcVideo, mainFlex.firstChild);
      }
    }
  }
  if (audioSelect) audio.src = audioSelect.value;
}

document.getElementById('videoSelect').addEventListener('change', function() {
  setThemeMediaFromDropdowns();
  updateMediaPlayback();
});
document.getElementById('audioSelect').addEventListener('change', function() {
  setThemeMediaFromDropdowns();
  updateMediaPlayback();
});

// Initial setup
populateMediaDropdowns();
setThemeMediaFromDropdowns();
updateMediaPlayback();

  // buttons

  // deep links
  const deepLinkMap = { '#about': 'about', '#skills': 'skillsDetailed', '#experience': 'experience', '#projects': 'projects', '#contact': 'contact' };
  function handleHash() { const h = location.hash; if (deepLinkMap[h]) handleCommand(deepLinkMap[h]); }
  window.addEventListener('hashchange', handleHash);

  // placeholder animation
  function animatedPrompt(msg, cb) {
    let i = 0;
    function next() {
      if (!terminalInput) return;
      if (i < (msg || '').length) {
        terminalInput.setAttribute('placeholder', (msg || '').slice(0, i + 1) + ((i % 2) ? '_' : ''));
        i++;
        setTimeout(next, 30);
      } else {
        terminalInput.setAttribute('placeholder', '');
        if (typeof cb === 'function') cb();
      }
    }
    next();
  }

  // initial welcome
  animatedPrompt("Welcome to John Ekiru's Interactive Resume! Type 'help' to get started.", () => {
  printLine("Hi, I'm John Ekiru, a Software Developer.\n\nWelcome to my interactive 'AI powered' portfolio terminal!\nType 'help' to see available commands.");
    terminalInput.focus();
    handleHash();
  });

  // focus helpers
  terminalOutput.addEventListener('click', () => terminalInput.focus());
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') terminalInput.focus();
  });

  // expose for debugging
  window.cvCommands = commands;
  window.resetAnalytics = resetAnalytics;

  // accessibility: observe adding nodes
  try {
    const obs = new MutationObserver((mutations) => {
      mutations.forEach(m => { if (m.addedNodes && m.addedNodes.length) terminalOutput.setAttribute('aria-busy', 'false'); });
    });
    obs.observe(terminalOutput, { childList: true });
  } catch (e) {}

  // set initial theme selector properly
  (function initThemeSelect() {
    if (!themeSelect) return;
    // Set default theme to matrix
    document.body.classList.remove('theme-solar', 'theme-night');
    document.body.classList.add('theme-matrix');
    themeSelect.value = 'matrix';
    setThemeMedia('matrix');
    updateMediaPlayback();
  })();

})();
