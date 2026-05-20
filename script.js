/* ── SERVER API CONFIG ── */
const API_BASE = 'http://localhost:3000/api';

/* ── AUDIO SYNTHESIZER ENGINE (Web Audio API) ── */
let audioCtx;
let currentAudioNodes = [];

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function createNoiseBuffer() {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    return buffer;
}

function playRain() {
    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer();
    noise.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 800;
    const gain = audioCtx.createGain(); gain.gain.value = 0.5;
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    noise.start(); currentAudioNodes.push(noise);
}

function playForest() {
    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(); noise.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 400; filter.Q.value = 0.5;
    const gain = audioCtx.createGain(); gain.gain.value = 0.8;
    const lfo = audioCtx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.15;
    const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 300;
    lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start();
    noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    noise.start(); currentAudioNodes.push(noise, lfo);
}

function playSpace() {
    const osc1 = audioCtx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = 55;
    const osc2 = audioCtx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 56.5;
    const noise = audioCtx.createBufferSource(); noise.buffer = createNoiseBuffer(); noise.loop = true;
    const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 150;
    const gain = audioCtx.createGain(); gain.gain.value = 0.4;
    osc1.connect(gain); osc2.connect(gain); noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
    osc1.start(); osc2.start(); noise.start(); currentAudioNodes.push(osc1, osc2, noise);
}

function stopAllAudio() {
    currentAudioNodes.forEach(n => {
        try { n.stop(); } catch (e) { }
        try { n.disconnect(); } catch (e) { }
    });
    currentAudioNodes = [];
    document.querySelectorAll('.sound-btn').forEach(btn => btn.classList.remove('playing'));
    const vis = document.getElementById('calm-visualizer');
    if (vis) vis.style.display = 'none';
}

function toggleSound(btn, type) {
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const wasPlaying = btn.classList.contains('playing');
    stopAllAudio();
    if (wasPlaying) return;
    btn.classList.add('playing');
    document.getElementById('calm-visualizer').style.display = 'inline-block';
    if (type === 'Rain') playRain();
    if (type === 'Forest') playForest();
    if (type === 'Space') playSpace();
}

/* ── STATE & VARIABLE DECLARATIONS ── */
let adminKidsList = []; // Pulled from Database
let staffAccounts = [
    { username: 'admin', password: 'admin123', name: 'Principal Hayes', role: 'Administrator' },
    { username: 'guide', password: 'guide123', name: 'Ms. Miller', role: 'Counselor' }
];

let currentUser = null;
let currentStaff = null;
let playerStats = { stars: 0, xp: 0, level: 1 };
let healthStats = { steps: 0, sleep: 0 };
let currentMood = '';
let alertCount = 1;
let BUDDY_SYSTEM = '';
let zenActive = false;
let zenTimeouts = [];
let balloonScore = 0;
let balloonInterval = null;
let gameTimeout = null;
let portalChatHistory = [];
let selectedAdminAvatar = 'fa-cat';

/* ── BOOT SEQUENCE ── */
window.addEventListener("DOMContentLoaded", () => {
    document.getElementById('auth-wrapper').classList.remove('hidden');
});

/* ── DATABASE SYNC ENGINE ── */
async function syncDatabase() {
    if (!currentUser) return;
    try {
        await fetch(`${API_BASE}/user/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: currentUser.username,
                updateData: {
                    stars: playerStats.stars,
                    xp: playerStats.xp,
                    level: playerStats.level,
                    history: currentUser.history,
                    chatHistory: currentUser.chatHistory,
                    alerts: currentUser.alerts,
                    status: currentUser.status
                }
            })
        });
    } catch (err) {
        console.error("Database sync failed", err);
    }
}

/* ── AI SEMANTIC MODERATION ENGINE ── */
async function checkSafetyWithAI(msg) {
    try {
        const response = await fetch(`${API_BASE}/ai/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msg })
        });
        const data = await response.json();
        return data;
    } catch (e) {
        return { status: "AI_ERROR", reason: "AI Connection Offline" };
    }
}

/* ── UI FUNCTIONS ── */
function showCustomAlert(title, msg, type) {
    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-msg').innerText = msg;
    const iconEl = document.getElementById('custom-alert-icon');
    if (type === 'danger') iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i>';
    else if (type === 'success') iconEl.innerHTML = '<i class="fa-solid fa-check-circle" style="color:var(--success)"></i>';
    else if (type === 'action') iconEl.innerHTML = '<i class="fa-solid fa-bolt" style="color:var(--action)"></i>';
    else iconEl.innerHTML = '<i class="fa-solid fa-bell" style="color:var(--primary)"></i>';
    document.getElementById('custom-alert-buttons').innerHTML = `<button class="btn-kid btn-${type || 'primary'}" onclick="closeCustomAlert()">Got it</button>`;
    document.getElementById('custom-alert-overlay').classList.remove('hidden');
}

function closeCustomAlert() { document.getElementById('custom-alert-overlay').classList.add('hidden'); }

function showCustomConfirm(title, msg, onConfirm) {
    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-msg').innerText = msg;
    document.getElementById('custom-alert-icon').innerHTML = '<i class="fa-solid fa-circle-question" style="color:var(--primary)"></i>';
    const btns = document.getElementById('custom-alert-buttons');
    btns.innerHTML = `
        <button class="btn-kid btn-outline" onclick="closeCustomAlert()">Cancel</button>
        <button class="btn-kid btn-danger" id="confirm-action-btn">Confirm</button>
    `;
    document.getElementById('confirm-action-btn').onclick = () => {
        closeCustomAlert();
        if (onConfirm) onConfirm();
    };
    document.getElementById('custom-alert-overlay').classList.remove('hidden');
}

/* ── INTERACTIVE PORTAL NAV CONTROLLERS ── */
function switchAuthTab(tab) {
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-staff').classList.add('hidden');
    document.getElementById('staff-link').classList.remove('hidden');
    if (tab === 'login') document.getElementById('form-login').classList.remove('hidden');
    else if (tab === 'staff') { document.getElementById('form-staff').classList.remove('hidden'); document.getElementById('staff-link').classList.add('hidden'); }
}

async function doLogin() {
    const user = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    if (!user || !pass) return showCustomAlert("Login Error", "Please provide both username and password.", "danger");

    try {
        const res = await fetch(`${API_BASE}/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        const data = await res.json();
        if (!res.ok) return showCustomAlert("Login Failed", data.error || "Incorrect credentials.", "danger");

        currentUser = data.user;
        playerStats = { stars: currentUser.stars, xp: currentUser.xp, level: currentUser.level };
        launchStudentPortal();
    } catch (err) {
        showCustomAlert("Connection Error", "Cannot connect to the server.", "danger");
    }
}

async function fetchAdminKids() {
    try {
        const res = await fetch(`${API_BASE}/admin/users`);
        adminKidsList = await res.json();
        renderAdminKids();
        renderAdminDashboard();
        renderAdminAlerts();
    } catch (err) {
        console.error("Failed to load users from DB", err);
    }
}

function doStaffLogin() {
    const user = document.getElementById('staff-username').value.trim();
    const pass = document.getElementById('staff-password').value.trim();
    const staffMember = staffAccounts.find(s => s.username.toLowerCase() === user.toLowerCase() && s.password === pass);

    if (staffMember) {
        currentStaff = staffMember;
        document.getElementById('auth-wrapper').classList.add('hidden');
        document.body.classList.add('app-active');
        document.getElementById('app-view').classList.remove('hidden');
        document.getElementById('nav-student').classList.add('hidden');
        document.getElementById('nav-admin').classList.remove('hidden');
        document.getElementById('student-hud').classList.add('hidden');
        document.getElementById('admin-header-exit').classList.remove('hidden');

        document.getElementById('header-name').innerText = staffMember.name;
        document.getElementById('header-role').innerText = staffMember.role;
        document.getElementById('header-avatar').innerHTML = "<i class='fa-solid fa-user-tie'></i>";

        const configBtn = document.querySelector('#nav-admin .app-nav-btn:nth-child(4)');
        configBtn.style.display = staffMember.role !== 'Administrator' ? 'none' : 'flex';

        switchAppTab('admin', 'dashboard', document.querySelector('#nav-admin .app-nav-btn'));
        fetchAdminKids();
    } else {
        showCustomAlert("Access Denied", "Incorrect staff username or password.", "danger");
    }
}

function configurePortal(age) {
    const isTeen = age >= 12;
    if (isTeen) document.body.classList.add('teen-theme');
    else document.body.classList.remove('teen-theme');

    BUDDY_SYSTEM = isTeen
        ? `You are "Buddy", a chill, relatable, validating, and supportive AI companion for a teenager. Keep responses concise (2-4 sentences). Never mention you are an AI or an LLM.`
        : `You are "Buddy", a warm, playful robot companion for a child. Be empathetic, short (2-3 sentences max), and use cute emojis! Never mention you are an AI.`;

    document.getElementById('nav-journal-text').innerText = isTeen ? "Journal" : "Diary";
    document.getElementById('nav-lifesync-text').innerText = isTeen ? "Habits" : "Life Sync";
    document.getElementById('nav-quests-text').innerText = isTeen ? "Goals" : "Quests";
    document.getElementById('nav-buddy-text').innerText = isTeen ? "Chat" : "Buddy";
    document.getElementById('nav-arcade-text').innerText = isTeen ? "Decompress" : "Playzone";
    document.getElementById('nav-calm-text').innerText = isTeen ? "Focus Rm" : "Calm Rm";

    document.getElementById('title-journal').innerHTML = isTeen ? `<i class="fa-solid fa-book-journal-whills"></i> Daily Journal` : `<i class="fa-solid fa-book-journal-whills"></i> My Magic Diary`;
    document.getElementById('title-lifesync').innerHTML = isTeen ? `<i class="fa-solid fa-heart-pulse"></i> Routine Sync` : `<i class="fa-solid fa-heart-pulse"></i> Life Sync`;
    document.getElementById('title-quests').innerHTML = isTeen ? `<i class="fa-solid fa-list-check"></i> Daily Goals` : `<i class="fa-solid fa-list-check"></i> Daily Quests`;
    document.getElementById('title-buddy').innerHTML = isTeen ? `<i class="fa-solid fa-robot"></i> AI Companion` : `<i class="fa-solid fa-robot"></i> Buddy Chat`;
    document.getElementById('title-arcade').innerHTML = isTeen ? `<i class="fa-solid fa-gamepad"></i> Decompression Zone` : `<i class="fa-solid fa-gamepad"></i> The Playzone`;
    document.getElementById('title-calm').innerHTML = isTeen ? `<i class="fa-solid fa-headphones"></i> Focus Room` : `<i class="fa-solid fa-headphones"></i> The Calm Room`;

    document.getElementById('journal-input').placeholder = isTeen ? "What's on your mind today?" : "Once upon a time...";
    document.getElementById('chat-input').placeholder = isTeen ? "Message Buddy..." : "Type to Buddy...";

    const gamesGrid = document.getElementById('games-grid-container');
    if (isTeen) {
        gamesGrid.innerHTML = `
            <div class="custom-card"><div style="padding: 25px; text-align: center;">
                <h3 style="font-size:1.6rem; font-weight:800; margin-bottom:8px;">Stress Shredder</h3>
                <p style="color:var(--text-muted); font-weight:600; font-size:0.95rem;">Type what is inducing anxiety and shred it out of existence.</p>
                <div style="font-size:4rem;color:var(--danger);margin:15px 0; animation: float 4s infinite;" id="monster-emoji"><i class="fa-solid fa-dumpster-fire"></i></div>
                <input type="text" id="worry-input" class="kid-input" placeholder="Type an anxiety-inducing thought..." style="margin-bottom:15px; padding:10px;">
                <button class="btn-kid btn-danger" style="width:100%; padding:10px;" onclick="feedMonster(event)">Shred Message</button>
            </div></div>
            <div class="custom-card"><div style="padding: 25px; text-align: center;">
                <h3 style="font-size:1.6rem; font-weight:800; margin-bottom:8px;">Focus Matrix</h3>
                <p style="color:var(--text-muted); font-weight:600; font-size:0.95rem;">Match sequential target nodes to center your focus bandwidth.</p>
                <div class="memory-board" id="memory-board"></div>
                <button class="btn-kid btn-outline" style="width:100%; padding:10px;" onclick="initMemoryGame()">Reset Grid</button>
            </div></div>
            <div class="custom-card" style="background:#f8fafc;"><div style="padding: 25px; text-align: center;">
                <h3 style="color:var(--success);font-size:1.6rem; font-weight:800; margin-bottom:8px;">Box Breathing</h3>
                <p style="color:var(--text-muted);margin-bottom:15px; font-weight:600; font-size:0.95rem;">Tactical regulation exercise to calm the autonomic nervous system.</p>
                <div class="zen-ring" id="zen-ring">Start</div>
                <button class="btn-kid btn-success" style="width:100%;margin-top:15px; padding:10px;" id="zen-btn" onclick="startZenGame(event)">Begin Box Routine</button>
            </div></div>
            <div class="custom-card" style="grid-column: 1 / -1;"><div style="padding: 25px; text-align: center;">
                <h3 style="color:var(--primary);font-size:1.6rem; font-weight:800; margin-bottom:8px;">Cognitive Reflex Test</h3>
                <p style="color:var(--text-muted);margin-bottom:10px; font-weight:600; font-size:0.95rem;">Intercept rapid sensory inputs to lock into a clean flow state.</p>
                <h2 id="balloon-score" style="color:var(--text-dark);font-size:2.5rem;margin:10px 0; font-weight:800;">Score: 0</h2>
                <button class="btn-kid btn-primary" id="balloon-btn" style="font-size:1.1rem; padding:12px 30px;" onclick="startBalloonGame()">Initialize Matrix</button>
            </div></div>`;
    } else {
        gamesGrid.innerHTML = `
            <div class="custom-card"><div style="padding: 25px; text-align: center;">
                <h3 style="color:var(--danger);font-size:1.6rem; font-weight:800; margin-bottom:8px;">The Worry Eater</h3>
                <p style="color:var(--text-muted); font-weight:600; font-size:0.95rem;">Feed the friendly monster your worries so they vanish!</p>
                <div style="font-size:4rem;color:var(--danger);margin:15px 0; animation: float 4s infinite;" id="monster-emoji"><i class="fa-solid fa-ghost"></i></div>
                <input type="text" id="worry-input" class="kid-input" placeholder="I am worried about..." style="margin-bottom:15px; padding:10px;">
                <button class="btn-kid btn-danger" style="width:100%; padding:10px;" onclick="feedMonster(event)">Feed Him!</button>
            </div></div>
            <div class="custom-card"><div style="padding: 25px; text-align: center;">
                <h3 style="color:var(--action);font-size:1.6rem; font-weight:800; margin-bottom:8px;">Emotion Match</h3>
                <p style="color:var(--text-muted); font-weight:600; font-size:0.95rem;">Find and pair the matching happy feeling faces!</p>
                <div class="memory-board" id="memory-board"></div>
                <button class="btn-kid btn-outline" style="width:100%; padding:10px;" onclick="initMemoryGame()">Restart Game</button>
            </div></div>
            <div class="custom-card" style="background:#f8fafc;"><div style="padding: 25px; text-align: center;">
                <h3 style="color:var(--success);font-size:1.6rem; font-weight:800; margin-bottom:8px;">Calming Breaths</h3>
                <p style="color:var(--text-muted);margin-bottom:15px; font-weight:600; font-size:0.95rem;">Follow the magic circle to take nice, deep breaths.</p>
                <div class="zen-ring" id="zen-ring">Start</div>
                <button class="btn-kid btn-success" style="width:100%;margin-top:15px; padding:10px;" id="zen-btn" onclick="startZenGame(event)">Breathe Along</button>
            </div></div>
            <div class="custom-card" style="grid-column: 1 / -1;"><div style="padding: 25px; text-align: center;">
                <h3 style="color:var(--primary);font-size:1.6rem; font-weight:800; margin-bottom:8px;">Stress Balloon Pop</h3>
                <p style="color:var(--text-muted);margin-bottom:10px; font-weight:600; font-size:0.95rem;">Pop all the colorful balloons before they float away! 🎈</p>
                <h2 id="balloon-score" style="color:var(--text-dark);font-size:2.5rem;margin:10px 0; font-weight:800;">Score: 0</h2>
                <button class="btn-kid btn-primary" id="balloon-btn" style="font-size:1.1rem; padding:12px 30px;" onclick="startBalloonGame()">Start Popping!</button>
            </div></div>`;
    }
    initMemoryGame();
}

/* ── LOAD SAVED DATA INTO UI ── */
function renderJournalHistory() {
    const timeline = document.getElementById('journal-timeline');
    timeline.innerHTML = '';

    if (currentUser && currentUser.history && currentUser.history.length > 0) {
        currentUser.history.forEach(item => {
            const entry = document.createElement('div');
            entry.className = 'journal-entry';

            let moodSpan = '';
            let mainText = item.text;

            if (item.text.includes('| "')) {
                const parts = item.text.split(' | "');
                const moodText = parts[0].replace('Mood: ', '');
                mainText = parts[1].slice(0, -1);
                moodSpan = `<span style="float:right; color:var(--action); font-weight:800; background:#eef9ff; padding:5px 12px; border-radius:12px;">${moodText}</span>`;
            }

            entry.innerHTML = `
                ${moodSpan}
                <span style="font-size:0.9rem;color:var(--text-muted);display:block;margin-bottom:12px;font-weight:800;"><i class="fa-regular fa-clock"></i> ${item.date}</span>
                <p style="margin:0; font-weight:500; font-size:1.2rem;">${mainText}</p>
            `;
            timeline.appendChild(entry);
        });
    }
}

function loadChatHistory() {
    const box = document.getElementById('chat-history');
    box.innerHTML = '';

    const isTeen = currentUser && currentUser.age >= 12;
    const welcomeMsg = isTeen ? "Hey there, I'm Buddy! How are things going today?" : "Beep boop! Hi there, I'm Buddy! 😊";

    box.innerHTML = `<div class="bubble bot"><i class="fa-solid fa-robot" style="margin-right: 8px; color: var(--action)"></i>${welcomeMsg}</div>`;
    portalChatHistory = [{ role: 'system', content: BUDDY_SYSTEM }];

    if (currentUser && currentUser.chatHistory && currentUser.chatHistory.length > 0) {
        currentUser.chatHistory.forEach(msg => {
            portalChatHistory.push(msg);

            const type = msg.role === 'user' ? 'user' : 'bot';
            const b = document.createElement('div');
            b.className = `bubble ${type}`;

            if (type === 'bot') {
                b.innerHTML = `<i class="fa-solid fa-robot" style="margin-right: 8px; color: var(--action)"></i>${msg.content}`;
            } else {
                b.innerText = msg.content;
            }
            box.appendChild(b);
        });
    }
    box.scrollTop = box.scrollHeight;
}

function launchStudentPortal() {
    document.getElementById('auth-wrapper').classList.add('hidden');
    document.body.classList.add('app-active');
    document.getElementById('app-view').classList.remove('hidden');
    document.getElementById('nav-admin').classList.add('hidden');
    document.getElementById('nav-student').classList.remove('hidden');
    document.getElementById('student-hud').classList.remove('hidden');
    document.getElementById('admin-header-exit').classList.add('hidden');

    document.getElementById('header-name').innerText = currentUser.name.charAt(0).toUpperCase() + currentUser.name.slice(1);
    document.getElementById('header-role').innerText = 'Level ' + playerStats.level;
    document.getElementById('header-avatar').innerHTML = `<i class="fa-solid ${currentUser.avatar}"></i>`;

    configurePortal(currentUser.age);
    switchAppTab('student', 'journal', document.querySelector('#nav-student .app-nav-btn'));

    renderJournalHistory();
    loadChatHistory();
    updateHUD();
}

function logoutApp() {
    stopAllAudio();
    document.body.classList.remove('app-active', 'teen-theme');
    document.getElementById('app-view').classList.add('hidden');
    document.getElementById('auth-wrapper').classList.remove('hidden');
    document.getElementById('login-password').value = '';
    document.getElementById('staff-username').value = '';
    document.getElementById('staff-password').value = '';

    clearInterval(balloonInterval); clearTimeout(gameTimeout);
    zenTimeouts.forEach(clearTimeout); zenTimeouts = [];
    currentUser = null; currentStaff = null;
    switchAuthTab('login');
}

function switchAppTab(role, tabId, btnEl) {
    if (role === 'student' && tabId !== 'calm') stopAllAudio();
    document.querySelectorAll('.app-nav-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(t => t.classList.add('hidden'));
    const targetTab = document.getElementById(`${role}-${tabId}-tab`);
    if (targetTab) targetTab.classList.remove('hidden');

    if (tabId === 'dashboard') {
        document.querySelectorAll('.mood-bar').forEach(bar => { bar.style.height = '0%'; });
        setTimeout(() => {
            document.querySelectorAll('.mood-bar').forEach(bar => { bar.style.height = bar.dataset.h + '%'; });
        }, 150);
    }
}

/* ── ADMIN LOGIC ── */
function renderAdminDashboard() {
    const totalKids = adminKidsList.length;
    const totalLogs = adminKidsList.reduce((sum, kid) => sum + (kid.history ? kid.history.length : 0), 0);
    let activeAlerts = []; let recentFeeds = [];

    adminKidsList.forEach((kid, idx) => {
        if (kid.alerts && kid.alerts.length > 0) {
            kid.alerts.forEach((alertText, alertIdx) => {
                activeAlerts.push({ kidIdx: idx, alertIdx: alertIdx, name: kid.name, text: alertText });
            });
        }
        if (kid.history && kid.history.length > 0) {
            recentFeeds.push({ name: kid.name, text: kid.history[0].text, date: kid.history[0].date });
        }
    });

    document.getElementById('dash-total-kids').innerText = totalKids;
    document.getElementById('dash-total-logs').innerText = totalLogs;
    document.getElementById('dash-total-alerts').innerText = activeAlerts.length;

    const feedContainer = document.getElementById('live-activity-feed');
    if (recentFeeds.length === 0) {
        feedContainer.innerHTML = `<p style="color:var(--text-muted); font-style:italic; padding: 20px;">No recent activity.</p>`;
    } else {
        feedContainer.innerHTML = recentFeeds.map(f => `
            <div class="activity-feed-item">
                <span class="activity-time">${f.date.replace('Today ', '')}</span>
                <p class="activity-text"><span class="activity-name">${f.name}:</span> ${f.text}</p>
            </div>
        `).join('');
    }
}

function renderAdminAlerts() {
    const tbody = document.getElementById('admin-alerts-tbody');
    let hasAlerts = false; tbody.innerHTML = '';
    adminKidsList.forEach((kid, kidIndex) => {
        if (kid.alerts && kid.alerts.length > 0) {
            hasAlerts = true;
            kid.alerts.forEach((alertText, alertIndex) => {
                let textStyle = alertText.includes("[SYSTEM ERROR]") ? "color: #e67e22;" : "color: var(--danger);";
                tbody.innerHTML += `
                <tr class="kid-row">
                    <td style="font-weight:700;"><i class="fa-solid ${kid.avatar}" style="color:var(--action); margin-right:8px; font-size:1.2rem;"></i> ${kid.name}</td>
                    <td style="color:var(--text-muted); font-weight:600;">${kid.lastLogin || 'N/A'}</td>
                    <td style="${textStyle} font-weight:700; line-height:1.4; max-width:350px;">
                        <span style="display:block; font-size:0.85rem; color:#64748b; margin-bottom:4px; text-transform:uppercase;">Flagged Message</span>
                        ${alertText}
                    </td>
                    <td><button class="btn-kid btn-success" style="padding:8px 15px;font-size:1rem;border-width:2px;" onclick="resolveAlert(${kidIndex}, ${alertIndex})"><i class="fa-solid fa-check"></i> Resolve</button></td>
                </tr>`;
            });
        }
    });
    if (!hasAlerts) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-style:italic; padding:30px; font-size:1.1rem;">All active monitoring systems are stable. ✨</td></tr>`;
    }
}

function resolveAlert(kidIndex, alertIndex) {
    adminKidsList[kidIndex].alerts.splice(alertIndex, 1);
    if (adminKidsList[kidIndex].alerts.length === 0) adminKidsList[kidIndex].status = "Stable";

    fetch(`${API_BASE}/user/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: adminKidsList[kidIndex].username,
            updateData: { alerts: adminKidsList[kidIndex].alerts, status: adminKidsList[kidIndex].status }
        })
    });

    renderAdminDashboard(); renderAdminKids(); renderAdminAlerts();
    showCustomAlert("Resolved", "The specific issue has been cleared and logged.", "success");
}

function renderAdminKids() {
    const tbody = document.getElementById('admin-kids-tbody');
    const select = document.getElementById('broadcast-target');
    select.innerHTML = '<option value="all">Global (All Active Students)</option>';

    tbody.innerHTML = adminKidsList.map((kid, i) => {
        let badgeClass = kid.status === 'Stable' ? 'status-good' : 'status-warn';
        let icon = kid.status === 'Stable' ? 'fa-check' : 'fa-circle-exclamation';
        select.innerHTML += `<option value="${i}">${kid.name} only</option>';`;

        return `
        <tr class="kid-row">
            <td style="text-align:center;">
                <label class="checkbox-container"><input type="checkbox" class="kid-cb" value="${i}"></label>
            </td>
            <td><div style="width:50px;height:50px;background:white;border-radius:16px;display:flex;justify-content:center;align-items:center;border:2px solid #cbd5e1;font-size:1.5rem;color:var(--text-dark);"><i class="fa-solid ${kid.avatar}"></i></div></td>
            <td style="font-weight:800; font-size:1.1rem;" class="kid-name-cell">
                ${kid.name}<br>
                <span style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">Last Login: ${kid.lastLogin || 'N/A'}</span>
            </td>
            <td><span style="color:var(--action); font-weight:800; font-size:1.1rem;"><i class="fa-solid fa-star"></i> Lvl ${kid.level || 1}</span></td>
            <td><span class="status-badge ${badgeClass}"><i class="fa-solid ${icon}"></i> ${kid.status}</span></td>
            <td>
                <div style="display:flex; gap:10px;">
                    <button class="btn-kid btn-primary" style="padding:8px 15px;font-size:0.9rem;border-width:2px; color:var(--text-dark);" onclick="viewKidHistory(${i})"><i class="fa-solid fa-folder-open"></i> Logs</button>
                    <button class="btn-kid btn-outline" style="padding:8px 15px;font-size:0.9rem;border-width:2px;" onclick="openEditKidModal(${i})"><i class="fa-solid fa-pen"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterKids() {
    const query = document.getElementById('kid-search').value.toLowerCase();
    document.querySelectorAll('.kid-row').forEach(row => {
        row.style.display = row.querySelector('.kid-name-cell').innerText.toLowerCase().includes(query) ? '' : 'none';
    });
}

function toggleAllKids(source) {
    document.querySelectorAll('.kid-cb').forEach(cb => {
        if (cb.closest('tr').style.display !== 'none') cb.checked = source.checked;
    });
}

function downloadSelectedKids() {
    const checkboxes = document.querySelectorAll('.kid-cb:checked');
    if (checkboxes.length === 0) return showCustomAlert('Hold on!', 'Please select at least one profile.', 'danger');
    const selectedData = Array.from(checkboxes).map(cb => adminKidsList[cb.value]);
    const headers = ['Name', 'Username', 'Age', 'Avatar', 'Level', 'Status', 'Last Login', 'Logs Count'];
    const csvRows = selectedData.map(kid => [`"${kid.name}"`, `"${kid.username}"`, kid.age, `"${kid.avatar}"`, kid.level, `"${kid.status}"`, `"${kid.lastLogin}"`, kid.history ? kid.history.length : 0].join(','));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURIComponent([headers.join(','), ...csvRows].join('\n')));
    dlAnchor.setAttribute("download", "SafeHaven_Export.csv");
    document.body.appendChild(dlAnchor); dlAnchor.click(); document.body.removeChild(dlAnchor);
}

function closeAdminModals() {
    document.getElementById('admin-modal-bg').classList.add('hidden');
    document.getElementById('history-kid-modal').classList.add('hidden');
    document.getElementById('kid-form-modal').classList.add('hidden');
}

function pickAdminAvatar(el, iconClass) {
    document.querySelectorAll('#admin-avatar-selector .avatar-opt').forEach(o => o.classList.remove('active'));
    el.classList.add('active'); selectedAdminAvatar = iconClass;
}

function openAddKidModal() {
    document.getElementById('edit-kid-index').value = "-1";
    document.getElementById('kid-form-title').innerHTML = `<i class="fa-solid fa-user-plus" style="color:var(--success)"></i> Add Profile`;
    document.getElementById('kid-form-name').value = '';
    document.getElementById('kid-form-username').value = '';
    document.getElementById('kid-form-age').value = '';
    document.getElementById('kid-form-password').value = '';
    document.getElementById('admin-modal-bg').classList.remove('hidden');
    document.getElementById('kid-form-modal').classList.remove('hidden');
}

function openEditKidModal(index) {
    const kid = adminKidsList[index];
    document.getElementById('edit-kid-index').value = index;
    document.getElementById('kid-form-title').innerHTML = `<i class="fa-solid fa-pen" style="color:var(--action)"></i> Edit Settings`;
    document.getElementById('kid-form-name').value = kid.name;
    document.getElementById('kid-form-username').value = kid.username;
    document.getElementById('kid-form-age').value = kid.age;
    document.getElementById('kid-form-password').value = kid.password;
    selectedAdminAvatar = kid.avatar;
    document.getElementById('admin-modal-bg').classList.remove('hidden');
    document.getElementById('kid-form-modal').classList.remove('hidden');
}

async function saveKidForm() {
    const index = parseInt(document.getElementById('edit-kid-index').value);
    const name = document.getElementById('kid-form-name').value.trim() || 'Student';
    const usernameInput = document.getElementById('kid-form-username').value.trim();
    const ageVal = document.getElementById('kid-form-age').value;
    const age = ageVal ? parseInt(ageVal) : 10;
    const password = document.getElementById('kid-form-password').value || 'pass123';
    const username = usernameInput ? usernameInput.toLowerCase().replace(/\s/g, '') : name.toLowerCase().replace(/\s/g, '') + Math.floor(Math.random() * 100);

    if (index === -1) {
        try {
            const res = await fetch(`${API_BASE}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, age, password, avatar: selectedAdminAvatar })
            });
            const data = await res.json();
            if (res.ok) {
                showCustomAlert('Created', `${name}'s profile configured.\nUsername: ${username}`, 'success');
                fetchAdminKids();
            } else {
                showCustomAlert('Error', data.error, 'danger');
            }
        } catch (err) { console.error(err); }
    } else {
        fetch(`${API_BASE}/user/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: adminKidsList[index].username,
                updateData: { name, age, password, avatar: selectedAdminAvatar }
            })
        }).then(() => {
            showCustomAlert('Updated', `${name}'s access profile has been updated.`, 'success');
            fetchAdminKids();
        });
    }
    closeAdminModals();
}

function viewKidHistory(index) {
    const kid = adminKidsList[index];
    document.getElementById('admin-modal-bg').classList.remove('hidden');
    document.getElementById('history-kid-modal').classList.remove('hidden');
    document.getElementById('kid-form-modal').classList.add('hidden');
    document.getElementById('history-title').innerHTML = `<i class="fa-solid ${kid.avatar}"></i> ${kid.name}'s Records`;

    const content = document.getElementById('history-content');
    if (!kid.history || kid.history.length === 0) content.innerHTML = `<p style="color:var(--text-muted); font-style:italic;">No events logged.</p>`;
    else content.innerHTML = kid.history.map(h => `
        <div style="background:#f8fafc; border:2px solid #cbd5e1; border-radius:12px; padding:15px; margin-bottom:15px;">
            <span style="font-size:0.9rem; color:var(--text-muted); font-weight:700; display:block; margin-bottom:5px;">${h.date}</span>
            <p style="margin:0; font-weight:600;">${h.text}</p>
        </div>`).join('');

    const chatContent = document.getElementById('history-chat-content');
    if (!kid.chatHistory || kid.chatHistory.length === 0) chatContent.innerHTML = `<p style="color:var(--text-muted); font-style:italic;">No transcripts.</p>`;
    else chatContent.innerHTML = kid.chatHistory.map(c => {
        const isUser = c.role === 'user';
        const color = isUser ? 'var(--action)' : 'var(--purple)';
        const bg = isUser ? 'white' : '#f8fafc';
        const icon = isUser ? 'fa-user' : 'fa-robot';
        return `
        <div style="background:${bg}; border:2px solid #cbd5e1; border-radius:12px; padding:15px; margin-bottom:15px; border-left: 6px solid ${color};">
            <p style="margin:0; font-weight:600; color:var(--text-dark);"><i class="fa-solid ${icon}" style="color:${color}; margin-right:8px;"></i> ${c.content}</p>
        </div>`;
    }).join('');
}

function sendBroadcast() {
    const msg = document.getElementById('broadcast-input').value.trim();
    if (!msg) return showCustomAlert('Wait', 'You cannot send an empty broadcast message.', 'danger');
    document.getElementById('broadcast-text').innerText = msg;
    document.getElementById('student-broadcast-banner').style.display = 'block';
    showCustomAlert('Dispatched', `Message actively pushed.`, 'success');
    document.getElementById('broadcast-input').value = '';
}

/* ── GAMIFICATION ENGINE ── */
function addReward(stars, e) {
    playerStats.stars += stars;
    playerStats.xp += stars * 10;
    if (playerStats.xp >= 100) {
        playerStats.level++; playerStats.xp = 0;
        document.getElementById('header-role').innerText = 'Level ' + playerStats.level;
    }
    updateHUD();
    syncDatabase();

    if (e) {
        const anim = document.createElement('div');
        anim.className = 'reward-anim'; anim.innerHTML = `+${stars} <i class="fa-solid fa-star" style="color:#f39c12"></i>`;
        const rect = (e.target || e).getBoundingClientRect();
        anim.style.left = rect.left + 'px'; anim.style.top = rect.top + 'px';
        document.body.appendChild(anim); setTimeout(() => anim.remove(), 1200);
    }
}

function updateHUD() {
    const starsEl = document.getElementById('hud-stars');
    starsEl.innerText = playerStats.stars;
    starsEl.parentElement.style.transform = 'scale(1.15)';
    setTimeout(() => { starsEl.parentElement.style.transform = 'scale(1)'; }, 200);
}

function completeQuest(id, stars, e) {
    const el = document.getElementById(id);
    if (el.classList.contains('done')) return;
    el.classList.add('done'); addReward(stars, e);
}

function logHealth(type, e) {
    const input = document.getElementById(`${type}-input`);
    const val = parseInt(input.value);
    if (!val || val <= 0) return;
    input.value = '';

    if (type === 'steps') {
        healthStats.steps += val;
        const pct = Math.min((healthStats.steps / 10000) * 100, 100);
        document.getElementById('steps-progress').style.width = pct + '%';
        document.getElementById('steps-text').innerText = healthStats.steps.toLocaleString();
    } else {
        healthStats.sleep += val;
        const pct = Math.min((healthStats.sleep / 8) * 100, 100);
        document.getElementById('sleep-progress').style.width = pct + '%';
        document.getElementById('sleep-text').innerText = healthStats.sleep;
    }
    addReward(5, e);
}

/* ── JOURNAL ENGINE ── */
function selectMood(el, moodName) {
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected'); currentMood = moodName;
}

function saveJournalEntry(e) {
    const input = document.getElementById('journal-input');
    const msg = input.value.trim();
    if (!msg) return showCustomAlert("Hold on", "Share a thought first!", "danger");
    if (!currentMood) return showCustomAlert("Hold on", "Please select your current state above.", "danger");

    addReward(5, e);
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const entry = document.createElement('div');
    entry.className = 'journal-entry slide-up';
    const entryId = 'scan-' + Date.now() + Math.floor(Math.random() * 1000);

    entry.innerHTML = `
        <span style="float:right; color:var(--action); font-weight:800; background:#eef9ff; padding:5px 12px; border-radius:12px;">${currentMood}</span>
        <span style="font-size:0.9rem;color:var(--text-muted);display:block;margin-bottom:12px;font-weight:800;"><i class="fa-regular fa-clock"></i> ${dateStr}</span>
        <p style="margin:0; font-weight:500; font-size:1.2rem;">${msg}</p>
        <div id="${entryId}" style="margin-top: 15px; font-size: 0.9rem; font-weight: 700; color: var(--action);"><i class="fa-solid fa-robot fa-bounce"></i> AI analyzing...</div>
    `;

    if (currentUser) {
        currentUser.history.unshift({ date: `Today ${dateStr}`, text: `Mood: ${currentMood} | "${msg}"` });
        syncDatabase();

        checkSafetyWithAI(msg).then(result => {
            const scanUI = document.getElementById(entryId);
            if (result.status === "FLAGGED" || result.status === "AI_ERROR") {
                currentUser.alerts.push(`[JOURNAL FLAG] "${msg}" - ${result.reason}`);
                currentUser.status = "Review";
                syncDatabase();
                if (scanUI) scanUI.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i> Flagged for Review';
            } else {
                if (scanUI) { scanUI.style.color = 'var(--success)'; scanUI.innerHTML = '<i class="fa-solid fa-check-circle"></i> AI Scan: Clear'; }
            }
        });
    }
    document.getElementById('journal-timeline').prepend(entry);
    input.value = ''; currentMood = '';
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
}

/* ── REAL AI CHAT (Groq / Backend Proxy) ── */
function addBubble(text, type) {
    const box = document.getElementById('chat-history');
    const b = document.createElement('div');
    b.className = `bubble ${type} pop-in`;
    if (type === 'bot') b.innerHTML = `<i class="fa-solid fa-robot" style="margin-right: 8px; color: var(--action)"></i>${text}`;
    else b.innerText = text;
    box.appendChild(b); box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    addBubble(msg, 'user');
    input.value = '';

    if (portalChatHistory.length === 0) portalChatHistory = [{ role: 'system', content: BUDDY_SYSTEM }];

    if (currentUser) {
        checkSafetyWithAI(msg).then(result => {
            if (result.status === "FLAGGED" || result.status === "AI_ERROR") {
                currentUser.alerts.push(`[CHAT FLAG] "${msg}" - ${result.reason}`);
                currentUser.status = "Review";
                syncDatabase();
            }
        });
    }

    portalChatHistory.push({ role: 'user', content: msg });
    if (currentUser) {
        currentUser.chatHistory.push({ role: 'user', content: msg });
        syncDatabase();
    }

    const box = document.getElementById('chat-history');
    const loader = document.createElement('div');
    loader.className = 'typing-bubble fade-in'; loader.id = 'typing-loader';
    loader.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    box.appendChild(loader); box.scrollTop = box.scrollHeight;

    try {
        const response = await fetch(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: portalChatHistory })
        });
        loader.remove();
        if (!response.ok) throw new Error("Connection failed");

        const data = await response.json();
        const output = data.reply;

        addBubble(output, 'bot');
        portalChatHistory.push({ role: 'assistant', content: output });
        if (currentUser) {
            currentUser.chatHistory.push({ role: 'assistant', content: output });
            syncDatabase();
        }
    } catch (e) {
        loader.remove();
        addBubble("Oops! I'm having trouble connecting to my network right now.", 'bot');
    }
}

/* ── ARCADE GAMES ── */
function feedMonster(e) {
    const input = document.getElementById('worry-input');
    const m = document.getElementById('monster-emoji');
    const msg = input.value.trim();
    if (!msg) return showCustomAlert("Hey!", "Type something that's stressing you out first!", "action");

    m.innerHTML = '<i class="fa-solid fa-face-grin-tongue"></i>';
    input.value = '';

    if (currentUser) {
        checkSafetyWithAI(msg).then(result => {
            if (result.status === "FLAGGED" || result.status === "AI_ERROR") {
                currentUser.alerts.push(`[WORRY EATER FLAG] "${msg}" - ${result.reason}`);
                currentUser.status = "Review";
                syncDatabase();
            }
        });
    }

    setTimeout(() => { m.innerHTML = '<i class="fa-solid fa-face-laugh-beam"></i>'; addReward(10, e); }, 500);
    const isTeen = currentUser && currentUser.age >= 12;
    setTimeout(() => { m.innerHTML = isTeen ? '<i class="fa-solid fa-dumpster-fire"></i>' : '<i class="fa-solid fa-ghost"></i>'; }, 2500);
}

const icons = ['fa-face-smile', 'fa-face-sad-tear', 'fa-face-angry', 'fa-face-surprise'];
let firstCard, secondCard, lockBoard, matches = 0;
function initMemoryGame() {
    const board = document.getElementById('memory-board');
    if (!board) return;
    board.innerHTML = ''; matches = 0; lockBoard = false; firstCard = null; secondCard = null;
    [...icons, ...icons].sort(() => Math.random() - 0.5).forEach((ic, idx) => {
        const card = document.createElement('div');
        card.className = `mem-card delay-${(idx % 4) + 1} pop-in`;
        card.dataset.icon = ic; card.innerHTML = `<i class="fa-solid ${ic}"></i>`;
        card.onclick = (e) => flipCard(card, e); board.appendChild(card);
    });
}
function flipCard(card, e) {
    if (lockBoard || card === firstCard || card.classList.contains('flipped')) return;
    card.classList.add('flipped');
    if (!firstCard) return void (firstCard = card);
    secondCard = card; lockBoard = true;
    if (firstCard.dataset.icon === secondCard.dataset.icon) {
        matches++; firstCard = null; secondCard = null; lockBoard = false;
        if (matches === 4) setTimeout(() => addReward(15, e), 400);
    } else {
        setTimeout(() => { firstCard.classList.remove('flipped'); secondCard.classList.remove('flipped'); firstCard = null; secondCard = null; lockBoard = false; }, 1000);
    }
}

function startZenGame(e) {
    if (zenActive) return; zenActive = true;
    const ring = document.getElementById('zen-ring'); const btn = document.getElementById('zen-btn');
    btn.disabled = true; btn.style.opacity = '0.5';
    const phases = [{ text: 'Breathe In', dur: 4000, scale: 1.4 }, { text: 'Hold', dur: 3000, scale: 1.4 }, { text: 'Breathe Out', dur: 4000, scale: 1 }];
    let elapsed = 0;
    phases.forEach(p => {
        zenTimeouts.push(setTimeout(() => { ring.innerText = p.text; ring.style.transform = `scale(${p.scale})`; ring.classList.add('breathing'); }, elapsed));
        elapsed += p.dur;
    });
    zenTimeouts.push(setTimeout(() => {
        ring.innerText = 'Done!'; ring.classList.remove('breathing');
        btn.disabled = false; btn.style.opacity = '1'; btn.innerText = 'Again';
        zenActive = false; addReward(5, e);
    }, elapsed));
}

function startBalloonGame() {
    const btn = document.getElementById('balloon-btn');
    const scoreDisplay = document.getElementById('balloon-score');
    btn.classList.add('hidden'); balloonScore = 0; scoreDisplay.innerText = 'Score: 0';
    const colors = ['#ff6b6b', '#48dbfb', '#1dd1a1', '#ffc048'];

    balloonInterval = setInterval(() => {
        const b = document.createElement('div'); b.className = 'real-balloon pop-in';
        const c = colors[Math.floor(Math.random() * colors.length)];
        b.style.background = `radial-gradient(circle at 30% 30%, #fff 1%, ${c} 40%, #2d3436 150%)`;
        b.style.color = c; b.style.left = (Math.random() * 80 + 10) + 'vw';
        b.style.animation = `floatFullScreen ${Math.random() * 2 + 3}s linear forwards`;
        const pop = (ev) => {
            ev.preventDefault(); balloonScore += 10; scoreDisplay.innerText = 'Score: ' + balloonScore;
            scoreDisplay.style.transform = 'scale(1.2)'; setTimeout(() => scoreDisplay.style.transform = 'scale(1)', 150);
            b.style.background = 'transparent'; b.style.boxShadow = 'none';
            b.innerHTML = '<i class="fa-solid fa-burst" style="font-size:3rem;color:var(--danger)"></i>';
            b.style.animationPlayState = 'paused'; setTimeout(() => b.remove(), 250);
        };
        b.addEventListener('mousedown', pop); b.addEventListener('touchstart', pop, { passive: false });
        document.body.appendChild(b); setTimeout(() => { if (b.parentElement) b.remove(); }, 5000);
    }, 600);

    gameTimeout = setTimeout(() => {
        clearInterval(balloonInterval); btn.classList.remove('hidden'); btn.innerText = "Play Again!"; addReward(10, null);
    }, 15000);
}