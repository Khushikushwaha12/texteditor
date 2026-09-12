/* ============ Formatting (unchanged core) ============ */
function formatDoc(cmd, value = null) {
    if (value) {
        document.execCommand(cmd, false, value);
    } else {
        document.execCommand(cmd);
    }
    scheduleSave();
}

function addLink() {
    const url = prompt('Insert url');
    if (url) formatDoc('createLink', url);
}

const content = document.getElementById('content');
const filenameInput = document.getElementById('filename');
const docListEl = document.getElementById('doc-list');
const saveIndicator = document.getElementById('save-indicator');
const wordCountEl = document.getElementById('word-count');
const charCountEl = document.getElementById('char-count');
const readTimeEl = document.getElementById('read-time');
const voiceStatusEl = document.getElementById('voice-status');

content.addEventListener('mouseenter', function () {
    const a = content.querySelectorAll('a');
    a.forEach(item => {
        item.addEventListener('mouseenter', function () {
            content.setAttribute('contenteditable', false);
            item.target = '_blank';
        });
        item.addEventListener('mouseleave', function () {
            content.setAttribute('contenteditable', true);
            item.target = '_blank';
        });
    });
});

/* ============ Font size & font name — reliable manual method ============
   document.execCommand('fontSize'/'fontName') is old & unreliable in
   modern browsers, so instead we wrap the selected text in a <span>
   with the CSS style applied directly. Works every time. */
function applyInlineStyle(cssProp, cssValue) {
    content.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        alert('Pehle text ko select/highlight karo, phir dropdown se choose karo.');
        return;
    }
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style[cssProp] = cssValue;

    try {
        range.surroundContents(span);
    } catch (e) {
        // selection spans multiple elements — extract & wrap instead
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);
    }

    sel.removeAllRanges();
    scheduleSave();
}

function applyFontSize(px) {
    applyInlineStyle('fontSize', px);
}

function applyFontName(name) {
    applyInlineStyle('fontFamily', `'${name}'`);
}

/* ============ View source toggle ============ */
const showCode = document.getElementById('show-code');
let codeActive = false;

showCode.addEventListener('click', function () {
    codeActive = !codeActive;
    showCode.dataset.active = codeActive;
    if (codeActive) {
        content.textContent = content.innerHTML;
        content.setAttribute('contenteditable', false);
    } else {
        content.innerHTML = content.textContent;
        content.setAttribute('contenteditable', true);
        scheduleSave();
    }
});

/* ============ File menu: new / txt / pdf / docx ============ */
function fileHandle(value) {
    if (value === 'new') {
        createDocument('blank');
    } else if (value === 'txt') {
        const blob = new Blob([content.innerText]);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filenameInput.value || 'untitled'}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    } else if (value === 'pdf') {
        html2pdf(content).save(filenameInput.value || 'untitled');
    } else if (value === 'docx') {
        const htmlString =
            `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${content.innerHTML}</body></html>`;
        const converted = htmlDocx.asBlob(htmlString);
        const url = URL.createObjectURL(converted);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filenameInput.value || 'untitled'}.docx`;
        link.click();
        URL.revokeObjectURL(url);
    }
}

/* ==========================================================
   Multi-document workspace — stored only in this browser
   via localStorage. No backend.
   ========================================================== */
const STORAGE_KEY = 'scratchpad_docs';
const CURRENT_KEY = 'scratchpad_current';
const CHIP_COLORS = ['#4a63e7', '#e5484d', '#2fa571', '#e6a53c', '#a24fe0', '#3fb8c9'];

const TEMPLATES = {
    blank: 'Start typing…',
    resume:
        '<h1>Your Name</h1><p>Email • Phone • City</p><h2>Objective</h2><p>Write a short summary here.</p>' +
        '<h2>Education</h2><p>Degree, Institute, Year</p><h2>Skills</h2><ul><li>Skill 1</li><li>Skill 2</li></ul>' +
        '<h2>Projects</h2><p>Project name — one line description.</p>',
    letter:
        '<p>Your Name<br>Your Address</p><p>Date</p><p>To,<br>Recipient Name<br>Recipient Address</p>' +
        '<p>Subject: </p><p>Dear Sir/Madam,</p><p>Write your letter body here.</p><p>Yours sincerely,<br>Your Name</p>',
    todo:
        '<h2>To-Do List</h2><ul><li>Task 1</li><li>Task 2</li><li>Task 3</li></ul>'
};

function loadDocs() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function saveDocs(docs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

function getCurrentId() {
    return localStorage.getItem(CURRENT_KEY);
}

function setCurrentId(id) {
    localStorage.setItem(CURRENT_KEY, id);
}

function uid() {
    return 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function createDocument(templateKey) {
    const docs = loadDocs();
    const newDoc = {
        id: uid(),
        name: 'Untitled',
        html: TEMPLATES[templateKey] || TEMPLATES.blank,
        color: CHIP_COLORS[docs.length % CHIP_COLORS.length],
        updatedAt: Date.now()
    };
    docs.unshift(newDoc);
    saveDocs(docs);
    setCurrentId(newDoc.id);
    renderDocList();
    openDocument(newDoc.id);
}

function openDocument(id) {
    const docs = loadDocs();
    const doc = docs.find(d => d.id === id);
    if (!doc) return;
    setCurrentId(id);
    filenameInput.value = doc.name;
    content.innerHTML = doc.html;
    codeActive = false;
    showCode.dataset.active = false;
    content.setAttribute('contenteditable', true);
    updateWordCount();
    renderDocList();
}

function deleteDocument(id, evt) {
    evt.stopPropagation();
    if (!confirm('Delete this document? This cannot be undone.')) return;
    let docs = loadDocs();
    docs = docs.filter(d => d.id !== id);
    saveDocs(docs);

    if (getCurrentId() === id) {
        if (docs.length > 0) {
            openDocument(docs[0].id);
        } else {
            createDocument('blank');
            return;
        }
    }
    renderDocList();
}

function renameDocument(id, newName) {
    const docs = loadDocs();
    const doc = docs.find(d => d.id === id);
    if (!doc) return;
    doc.name = newName.trim() || 'Untitled';
    doc.updatedAt = Date.now();
    saveDocs(docs);
    if (getCurrentId() === id) filenameInput.value = doc.name;
    renderDocList();
}

function renderDocList() {
    const docs = loadDocs();
    const currentId = getCurrentId();
    docListEl.innerHTML = '';
    docs.forEach(doc => {
        const item = document.createElement('div');
        item.className = 'doc-item' + (doc.id === currentId ? ' active' : '');
        item.onclick = () => openDocument(doc.id);

        const chip = document.createElement('span');
        chip.className = 'doc-chip';
        chip.style.background = doc.color;

        const name = document.createElement('span');
        name.className = 'doc-name';
        name.textContent = doc.name || 'Untitled';
        name.ondblclick = (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.className = 'doc-name-input';
            input.value = doc.name || 'Untitled';
            item.replaceChild(input, name);
            input.focus();
            input.select();
            const finish = () => {
                renameDocument(doc.id, input.value);
            };
            input.addEventListener('blur', finish);
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') input.blur();
                ev.stopPropagation();
            });
        };

        const del = document.createElement('button');
        del.className = 'doc-delete';
        del.innerHTML = "<i class='bx bx-x'></i>";
        del.onclick = (e) => deleteDocument(doc.id, e);

        item.appendChild(chip);
        item.appendChild(name);
        item.appendChild(del);
        docListEl.appendChild(item);
    });
}

/* ============ New document + template menu ============ */
const newDocBtn = document.getElementById('new-doc-btn');
const templateMenu = document.getElementById('template-menu');

newDocBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    templateMenu.classList.toggle('open');
});

templateMenu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
        createDocument(btn.dataset.template);
        templateMenu.classList.remove('open');
    });
});

document.addEventListener('click', (e) => {
    if (!templateMenu.contains(e.target) && e.target !== newDocBtn) {
        templateMenu.classList.remove('open');
    }
});

/* ============ Autosave (debounced) ============ */
let saveTimer = null;
function scheduleSave() {
    saveIndicator.textContent = 'Saving…';
    saveIndicator.classList.add('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistCurrentDoc, 500);
    updateWordCount();
}

function persistCurrentDoc() {
    const id = getCurrentId();
    if (!id) return;
    const docs = loadDocs();
    const doc = docs.find(d => d.id === id);
    if (!doc) return;
    doc.name = filenameInput.value || 'Untitled';
    doc.html = content.innerHTML;
    doc.updatedAt = Date.now();
    saveDocs(docs);
    saveIndicator.textContent = 'Saved';
    saveIndicator.classList.remove('saving');
    renderDocList();
}

content.addEventListener('input', scheduleSave);
filenameInput.addEventListener('input', scheduleSave);

/* ============ Word count / char count / reading time ============ */
function updateWordCount() {
    const text = content.innerText.trim();
    const words = text.length ? text.split(/\s+/).length : 0;
    const chars = text.length;
    const minutes = Math.max(1, Math.round(words / 200));
    wordCountEl.textContent = `${words} word${words !== 1 ? 's' : ''}`;
    charCountEl.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
    readTimeEl.textContent = `${minutes} min read`;
}

/* ============ Dark mode ============ */
const themeToggle = document.getElementById('theme-toggle');
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.innerHTML = theme === 'dark'
        ? "<i class='bx bx-sun'></i>"
        : "<i class='bx bx-moon'></i>";
    localStorage.setItem('scratchpad_theme', theme);
}

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
});

/* ============ Mobile sidebar toggle ============ */
const sidebar = document.getElementById('sidebar');
document.getElementById('sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

/* ============ Search in document ============ */
const searchBtn = document.getElementById('search-btn');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const searchNext = document.getElementById('search-next');
const searchPrev = document.getElementById('search-prev');
const searchClose = document.getElementById('search-close');

function openSearch() {
    searchBar.classList.add('open');
    searchInput.focus();
}
function closeSearch() {
    searchBar.classList.remove('open');
    searchInput.value = '';
}

searchBtn.addEventListener('click', () => {
    searchBar.classList.contains('open') ? closeSearch() : openSearch();
});
searchClose.addEventListener('click', closeSearch);

function runSearch(backwards) {
    const query = searchInput.value.trim();
    if (!query) return;
    if (window.find) {
        window.find(query, false, backwards, true);
    } else {
        alert('Search is not supported in this browser.');
    }
}

searchNext.addEventListener('click', () => runSearch(false));
searchPrev.addEventListener('click', () => runSearch(true));
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch(e.shiftKey);
    if (e.key === 'Escape') closeSearch();
});

/* ============ Print ============ */
document.getElementById('print-btn').addEventListener('click', () => {
    window.print();
});

/* ============ Read aloud (Text-to-Speech) ============ */
const readAloudBtn = document.getElementById('read-aloud-btn');
let speaking = false;

readAloudBtn.addEventListener('click', () => {
    if (!('speechSynthesis' in window)) {
        alert('Text-to-speech is not supported in this browser.');
        return;
    }
    if (speaking) {
        window.speechSynthesis.cancel();
        speaking = false;
        readAloudBtn.classList.remove('active-toggle');
        readAloudBtn.innerHTML = "<i class='bx bx-volume-full'></i>";
        return;
    }
    const text = content.innerText.trim();
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
        speaking = false;
        readAloudBtn.classList.remove('active-toggle');
        readAloudBtn.innerHTML = "<i class='bx bx-volume-full'></i>";
    };
    window.speechSynthesis.speak(utterance);
    speaking = true;
    readAloudBtn.classList.add('active-toggle');
    readAloudBtn.innerHTML = "<i class='bx bx-volume-mute'></i>";
});

/* ============ Voice typing (Speech-to-Text) ============ */
const voiceBtn = document.getElementById('voice-btn');
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;

if (SpeechRecognitionAPI) {
    recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = function (event) {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                const transcript = event.results[i][0].transcript;
                content.focus();
                document.execCommand('insertText', false, transcript + ' ');
                scheduleSave();
            }
        }
    };

    recognition.onend = function () {
        if (listening) {
            recognition.start();
        }
    };

    recognition.onerror = function (e) {
        console.error('Speech recognition error:', e.error);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            alert('Microphone permission is required for voice typing.');
            stopListening();
        }
    };
}

function startListening() {
    if (!recognition) return;
    content.focus();
    listening = true;
    recognition.start();
    voiceBtn.classList.add('active-toggle');
    voiceStatusEl.classList.add('on');
    voiceStatusEl.innerHTML = "<i class='bx bx-microphone'></i> Listening…";
}

function stopListening() {
    if (!recognition) return;
    listening = false;
    recognition.stop();
    voiceBtn.classList.remove('active-toggle');
    voiceStatusEl.classList.remove('on');
    voiceStatusEl.textContent = '';
}

voiceBtn.addEventListener('click', () => {
    if (!SpeechRecognitionAPI) {
        alert('Voice typing is not supported in this browser. Please try Google Chrome.');
        return;
    }
    listening ? stopListening() : startListening();
});

/* ============ Focus mode ============ */
const focusBtn = document.getElementById('focus-btn');
focusBtn.addEventListener('click', () => {
    document.body.classList.toggle('focus-mode');
    const isFocus = document.body.classList.contains('focus-mode');
    focusBtn.innerHTML = isFocus ? "<i class='bx bx-collapse'></i>" : "<i class='bx bx-expand'></i>";
});

/* ============ Import .txt file ============ */
document.getElementById('import-file').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        if (confirm('Import will replace the current document content. Continue?')) {
            const paragraphs = evt.target.result
                .split(/\n+/)
                .map(line => `<p>${line || '<br>'}</p>`)
                .join('');
            content.innerHTML = paragraphs;
            scheduleSave();
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

/* ============ Keyboard shortcuts ============ */
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        clearTimeout(saveTimer);
        persistCurrentDoc();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openSearch();
    }
});

/* ==========================================================
   Grammar & Spelling checker (free LanguageTool public API,
   direct browser fetch, no server of our own)
   ========================================================== */
const grammarBtn = document.getElementById('grammar-btn');
const grammarPanel = document.getElementById('grammar-panel');
const grammarList = document.getElementById('grammar-list');
const grammarClose = document.getElementById('grammar-close');

grammarClose.addEventListener('click', () => {
    grammarPanel.classList.remove('open');
});

grammarBtn.addEventListener('click', async () => {
    const text = content.innerText.trim();
    if (!text) return;

    grammarPanel.classList.add('open');
    grammarList.innerHTML = '<div class="grammar-loading">Checking your text…</div>';

    try {
        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `text=${encodeURIComponent(text)}&language=en-US`
        });

        if (!response.ok) throw new Error('Request failed');

        const data = await response.json();
        renderGrammarResults(data.matches || [], text);
    } catch (err) {
        grammarList.innerHTML =
            '<div class="grammar-empty">Could not check right now. Please check your internet connection and try again.</div>';
    }
});

function renderGrammarResults(matches, text) {
    if (matches.length === 0) {
        grammarList.innerHTML = '<div class="grammar-empty">No issues found! 🎉</div>';
        return;
    }

    grammarList.innerHTML = '';
    matches.slice(0, 30).forEach(match => {
        const original = text.substr(match.offset, match.length);
        const suggestions = (match.replacements || []).slice(0, 3).map(r => r.value);

        const item = document.createElement('div');
        item.className = 'grammar-item';

        const issueText = document.createElement('div');
        issueText.className = 'grammar-issue-text';
        issueText.innerHTML = `<span class="wrong">${escapeHtml(original)}</span>`;

        const message = document.createElement('div');
        message.className = 'grammar-message';
        message.textContent = match.message;

        const suggBox = document.createElement('div');
        suggBox.className = 'grammar-suggestions';

        if (suggestions.length === 0) {
            const noSugg = document.createElement('span');
            noSugg.className = 'grammar-message';
            noSugg.textContent = 'No suggestion available';
            suggBox.appendChild(noSugg);
        } else {
            suggestions.forEach(sugg => {
                const btn = document.createElement('button');
                btn.textContent = `✓ ${sugg}`;
                btn.onclick = () => {
                    const applied = replaceTextInContent(original, sugg);
                    if (applied) {
                        item.remove();
                        scheduleSave();
                    }
                };
                suggBox.appendChild(btn);
            });
        }

        item.appendChild(issueText);
        item.appendChild(message);
        item.appendChild(suggBox);
        grammarList.appendChild(item);
    });
}

function replaceTextInContent(original, replacement) {
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
        const idx = node.textContent.indexOf(original);
        if (idx !== -1) {
            const before = node.textContent.slice(0, idx);
            const after = node.textContent.slice(idx + original.length);
            node.textContent = before + replacement + after;
            return true;
        }
    }
    return false;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* ============ Init ============ */
(function init() {
    applyTheme(localStorage.getItem('scratchpad_theme') || 'light');

    const docs = loadDocs();
    if (docs.length === 0) {
        createDocument('blank');
    } else {
        const currentId = getCurrentId() || docs[0].id;
        renderDocList();
        openDocument(currentId);
    }
})();