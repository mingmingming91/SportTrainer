/**
 * 🎙️ 智能指令音訊隨機播放器 - 進階多方案管理版
 */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
    });
}

// 預設核心資料
const DEFAULT_COMMANDS = [
    { id: 1, text: "左直拳", weight: 50 },
    { id: 2, text: "右勾拳", weight: 30 },
    { id: 3, text: "閃躲", weight: 20 }
];

let commands = [];
let profiles = {}; // 🌟 用於儲存所有命名配置的物件容器
let currentProfileName = "預設配置";

let timerId = null;        
let countdownId = null;    
let isPlaying = false;     
let sequenceIndex = 0;     
let totalSecondsLeft = 0;  

document.addEventListener("DOMContentLoaded", () => {
    loadAllDataFromStorage(); 
    renderCommands();        
    setupDragAndDrop();     
    updateInitialCountdownDisplay(); 
    setupSettingsListeners();
});

// ==========================================
// 💾 核心：多配置儲存管理演算法 (LocalStorage)
// ==========================================

// 讀取全部資料 (包含當前工作區 + 配置倉庫)
function loadAllDataFromStorage() {
    // 1. 讀取命名配置庫
    const savedProfiles = localStorage.getItem('smart_player_profiles');
    if (savedProfiles) {
        profiles = JSON.parse(savedProfiles);
    } else {
        // 初次使用，初始化預設配置
        profiles = {
            "基本拳擊訓練": {
                commands: [...DEFAULT_COMMANDS], playMode: 'sequence', timeMode: 'fixed',
                fixedSeconds: '3', minSeconds: '1', maxSeconds: '5', durationMin: '3', durationSec: '0'
            }
        };
    }

    // 2. 讀取上次關閉網頁時的「當前工作設定」
    const savedCurrent = localStorage.getItem('smart_player_current_workspace');
    if (savedCurrent) {
        const workspace = JSON.parse(savedCurrent);
        commands = workspace.commands || [...DEFAULT_COMMANDS];
        currentProfileName = workspace.currentProfileName || "自訂配置";
        restoreInputsToUI(workspace);
    } else {
        commands = [...DEFAULT_COMMANDS];
        currentProfileName = "基本拳擊訓練";
        restoreInputsToUI(profiles["基本拳擊訓練"]);
    }

    renderProfileSelectUI();
}

// 即時自動儲存當前工作狀態
function saveCurrentWorkspace() {
    const workspace = getCurrentValuesFromUI();
    localStorage.setItem('smart_player_current_workspace', JSON.stringify(workspace));
}

// 獲取目前畫面上所有的數值物件
function getCurrentValuesFromUI() {
    return {
        commands: commands,
        currentProfileName: currentProfileName,
        playMode: document.querySelector('input[name="playMode"]:checked')?.value || 'sequence',
        timeMode: document.querySelector('input[name="timeMode"]:checked')?.value || 'fixed',
        fixedSeconds: document.getElementById('fixedSeconds').value,
        minSeconds: document.getElementById('minSeconds').value,
        maxSeconds: document.getElementById('maxSeconds').value,
        durationMin: document.getElementById('durationMin').value,
        durationSec: document.getElementById('durationSec').value
    };
}

// 將指定的資料還原填入 UI 畫面
function restoreInputsToUI(data) {
    if (!data) return;
    if (data.playMode) document.querySelector(`input[name="playMode"][value="${data.playMode}"]`).checked = true;
    if (data.timeMode) document.querySelector(`input[name="timeMode"][value="${data.timeMode}"]`).checked = true;
    if (data.fixedSeconds) document.getElementById('fixedSeconds').value = data.fixedSeconds;
    if (data.minSeconds) document.getElementById('minSeconds').value = data.minSeconds;
    if (data.maxSeconds) document.getElementById('maxSeconds').value = data.maxSeconds;
    if (data.durationMin) document.getElementById('durationMin').value = data.durationMin;
    if (data.durationSec) document.getElementById('durationSec').value = data.durationSec;
    toggleTimeInputs();
}

// 刷新下拉選單的選項
function renderProfileSelectUI() {
    const select = document.getElementById('profileSelect');
    select.innerHTML = '';

    // 加入一個提示性未選擇項或當前狀態
    const optGroup = document.createElement('optgroup');
    optGroup.label = `當前正載入: ${currentProfileName}`;
    select.appendChild(optGroup);

    Object.keys(profiles).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.innerText = name;
        if (name === currentProfileName) opt.selected = true;
        select.appendChild(opt);
    });
}

// 【按鈕功能】將當前畫面的設定命名並儲存到庫中
function saveCurrentToNewProfile() {
    const nameInput = document.getElementById('profileNameInput');
    const name = nameInput.value.trim();
    
    if (!name) return alert('請輸入配置方案的名稱！');

    // 取得當前設定並寫入庫中
    profiles[name] = getCurrentValuesFromUI();
    currentProfileName = name;

    // 持久化儲存
    localStorage.setItem('smart_player_profiles', JSON.stringify(profiles));
    saveCurrentWorkspace();

    // 介面更新
    nameInput.value = '';
    renderProfileSelectUI();
    alert(`成功儲存方案：【${name}】`);
}

// 【下拉連動】當選取其他方案時，立刻載入
function loadSelectedProfile() {
    const select = document.getElementById('profileSelect');
    const name = select.value;
    if (!name || !profiles[name]) return;

    currentProfileName = name;
    const targetData = profiles[name];

    // 更新核心陣列與介面
    commands = JSON.parse(JSON.stringify(targetData.commands)); // 深拷貝
    restoreInputsToUI(targetData);
    renderCommands();
    updateInitialCountdownDisplay();

    // 同步到工作緩存
    saveCurrentWorkspace();
    renderProfileSelectUI();
}

// 【按鈕功能】刪除選定的方案
function deleteSelectedProfile() {
    const select = document.getElementById('profileSelect');
    const name = select.value;
    if (!name || !profiles[name]) return;

    if (Object.keys(profiles).length <= 1) {
        return alert('必須保留至少一個配置方案！');
    }

    if (!confirm(`確定要刪除【${name}】這個配置方案嗎？`)) return;

    delete profiles[name];
    localStorage.setItem('smart_player_profiles', JSON.stringify(profiles));

    // 如果刪除的是當前正開啟的，自動載入剩餘的第一個
    if (currentProfileName === name) {
        currentProfileName = Object.keys(profiles)[0];
        commands = JSON.parse(JSON.stringify(profiles[currentProfileName].commands));
        restoreInputsToUI(profiles[currentProfileName]);
        renderCommands();
        updateInitialCountdownDisplay();
    }

    saveCurrentWorkspace();
    renderProfileSelectUI();
}

// 綁定輸入框即時變更監聽
function setupSettingsListeners() {
    const inputs = ['fixedSeconds', 'minSeconds', 'maxSeconds', 'durationMin', 'durationSec'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            saveCurrentWorkspace();
        });
    });
    document.querySelectorAll('input[name="playMode"], input[name="timeMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            saveCurrentWorkspace();
            if(radio.name === 'timeMode') updateInitialCountdownDisplay();
        });
    });
}

// ==========================================
// 🎨 以下為原有的 UI 渲染、拖曳排序與播放核心邏輯 (維持不變)
// ==========================================
function renderCommands() {
    const container = document.getElementById('commandList');
    container.innerHTML = '';
    const totalWeight = commands.reduce((sum, cmd) => sum + cmd.weight, 0);

    if (commands.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-500 bg-slate-950/20 rounded-xl border border-slate-800/50">目前清單空空如也。</div>`;
        document.getElementById('nextIndex').innerText = "#1";
        return;
    }

    commands.forEach((cmd, index) => {
        const percentage = totalWeight > 0 ? ((cmd.weight / totalWeight) * 100).toFixed(1) : 0;
        const itemRow = document.createElement('div');
        itemRow.setAttribute('draggable', 'true'); 
        itemRow.setAttribute('data-id', cmd.id);   
        itemRow.className = 'dragging-target p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl transition flex flex-col sm:flex-row gap-3 items-stretch sm:items-center cursor-grab active:cursor-grabbing hover:bg-slate-800/20';
        
        itemRow.innerHTML = `
            <div class="flex items-center gap-3 flex-1">
                <div class="w-6 text-center font-bold text-slate-500 text-xs select-none">#${index + 1}</div>
                <div class="flex-1">
                    <input type="text" value="${cmd.text}" onchange="updateText(${cmd.id}, this.value)" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm sm:text-base">
                </div>
            </div>
            <div class="flex items-center justify-between sm:justify-end gap-3 border-t border-slate-800/50 sm:border-t-0 pt-2 sm:pt-0">
                <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-500 sm:hidden">權重:</span>
                    <input type="number" value="${cmd.weight}" min="1" max="100" onchange="updateWeight(${cmd.id}, this.value)" class="w-16 px-1 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-center text-slate-100 font-semibold focus:outline-none text-sm">
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-500 sm:hidden">機率:</span>
                    <div class="w-20 py-1.5 text-center font-black text-emerald-400 text-xs sm:text-sm tracking-wide bg-emerald-950/20 rounded-lg select-none">${percentage}%</div>
                </div>
                <button onclick="deleteCommand(${cmd.id})" class="text-slate-500 hover:text-rose-500 transition p-1"><span class="material-icons-round text-lg sm:text-xl">delete_outline</span></button>
            </div>
        `;
        container.appendChild(itemRow);
    });
    document.getElementById('nextIndex').innerText = `#${commands.length + 1}`;
}

function addCommand() {
    const textInput = document.getElementById('cmdText');
    const weightInput = document.getElementById('cmdWeight');
    const text = textInput.value.trim();
    const weight = parseInt(weightInput.value);
    if (!text || isNaN(weight) || weight < 1 || weight > 100) return;

    commands.push({ id: Date.now(), text: text, weight: weight });
    renderCommands();
    saveCurrentWorkspace();
    textInput.value = '';
    weightInput.value = '10';
    updateInitialCountdownDisplay();
}

function updateText(id, newText) {
    const trimmed = newText.trim();
    if (!trimmed) { renderCommands(); return; }
    const cmd = commands.find(c => c.id === id);
    if (cmd) { cmd.text = trimmed; saveCurrentWorkspace(); }
}

function updateWeight(id, newWeight) {
    let val = parseInt(newWeight);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 100) val = 100;
    const cmd = commands.find(c => c.id === id);
    if (cmd) { cmd.weight = val; renderCommands(); saveCurrentWorkspace(); }
}

function deleteCommand(id) {
    commands = commands.filter(cmd => cmd.id !== id);
    renderCommands();
    saveCurrentWorkspace();
}

function setupDragAndDrop() {
    const container = document.getElementById('commandList');
    container.addEventListener('dragstart', (e) => { const t = e.target.closest('.dragging-target'); if(t) t.classList.add('dragging'); });
    container.addEventListener('dragend', (e) => {
        const t = e.target.closest('.dragging-target'); if(t) t.classList.remove('dragging');
        const rows = Array.from(container.querySelectorAll('.dragging-target'));
        const newOrder = [];
        rows.forEach(row => {
            const id = parseInt(row.getAttribute('data-id'));
            const found = commands.find(c => c.id === id);
            if (found) newOrder.push(found);
        });
        commands = newOrder; renderCommands(); saveCurrentWorkspace();
    });
    container.addEventListener('dragover', (e) => {
        e.preventDefault(); const dragRow = container.querySelector('.dragging'); if (!dragRow) return;
        const target = e.target.closest('.dragging-target');
        if (target && target !== dragRow) {
            const bound = target.getBoundingClientRect();
            const offset = e.clientY - bound.top - (bound.height / 2);
            container.insertBefore(dragRow, offset > 0 ? target.nextSibling : target);
        }
    });
}

function toggleTimeInputs() {
    const mode = document.querySelector('input[name="timeMode"]:checked')?.value || 'fixed';
    document.getElementById('fixedTimeInput').classList.toggle('hidden', mode !== 'fixed');
    document.getElementById('randomTimeInput').classList.toggle('hidden', mode === 'fixed');
}

function updateInitialCountdownDisplay() {
    if (isPlaying) return;
    const min = parseInt(document.getElementById('durationMin').value) || 0;
    const sec = parseInt(document.getElementById('durationSec').value) || 0;
    updateCountdownUI((min * 60) + sec);
}

function speak(text) {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-HK';        
    window.speechSynthesis.speak(utterance);
}

function getNextCommand() {
    if (commands.length === 0) return null;
    const mode = document.querySelector('input[name="playMode"]:checked').value;
    if (mode === 'sequence') {
        const cmd = commands[sequenceIndex];
        sequenceIndex = (sequenceIndex + 1) % commands.length; 
        return cmd;
    } else {
        const total = commands.reduce((sum, cmd) => sum + cmd.weight, 0);
        let random = Math.random() * total;
        for (const cmd of commands) {
            if (random < cmd.weight) return cmd;
            random -= cmd.weight;
        }
        return commands[commands.length - 1];
    }
}

function playLoop() {
    if (!isPlaying) return;
    const cmd = getNextCommand();
    if (!cmd) { stopPlayback(); return; }
    document.getElementById('statusDisplay').innerHTML = `🔊 播放：<span class="text-blue-400 font-extrabold text-lg">${cmd.text}</span>`;
    speak(cmd.text);
    const mode = document.querySelector('input[name="timeMode"]:checked').value;
    let delay = 3000; 
    if (mode === 'fixed') {
        delay = parseFloat(document.getElementById('fixedSeconds').value) * 1000;
    } else {
        const min = parseFloat(document.getElementById('minSeconds').value);
        const max = parseFloat(document.getElementById('maxSeconds').value);
        delay = (Math.random() * (max - min) + min) * 1000;
    }
    timerId = setTimeout(playLoop, delay);
}

function startCountdown() {
    updateCountdownUI(totalSecondsLeft);
    countdownId = setInterval(() => {
        totalSecondsLeft--;
        updateCountdownUI(totalSecondsLeft);
        if (totalSecondsLeft <= 0) { stopPlayback(); document.getElementById('statusDisplay').innerText = "⏱️ 訓練結束"; }
    }, 1000);
}

function updateCountdownUI(seconds) {
    const mins = Math.floor(seconds / 60); const secs = seconds % 60;
    document.getElementById('countdownContainer').innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startPlayback() {
    if (commands.length === 0) return alert('請先加入指令！');
    const min = parseInt(document.getElementById('durationMin').value) || 0;
    const sec = parseInt(document.getElementById('durationSec').value) || 0;
    totalSecondsLeft = (min * 60) + sec;
    if (totalSecondsLeft <= 0) return alert('請設定總時長！');
    isPlaying = true; sequenceIndex = 0; toggleButtons(true);
    document.getElementById('statusDot').className = "w-3 h-3 rounded-full bg-emerald-500 animate-ping";
    document.getElementById('countdownContainer').className = "text-2xl font-black font-mono tracking-wider bg-slate-800 px-4 py-1.5 rounded-xl border border-emerald-500 text-emerald-400";
    playLoop(); startCountdown();
}

// 停止功能保持清空語音快取
function stopPlayback() {
    isPlaying = false; if (timerId) clearTimeout(timerId); if (countdownId) clearInterval(countdownId);
    window.speechSynthesis.cancel(); 
    document.getElementById('statusDisplay').innerText = "狀態：已停止";
    document.getElementById('statusDot').className = "w-3 h-3 rounded-full bg-slate-500";
    document.getElementById('countdownContainer').className = "text-2xl font-black font-mono tracking-wider bg-slate-800 px-4 py-1.5 rounded-xl border border-slate-700 text-slate-400";
    toggleButtons(false); updateInitialCountdownDisplay();
}

function toggleButtons(running) {
    const startBtn = document.getElementById('startBtn'); const stopBtn = document.getElementById('stopBtn');
    if (running) {
        startBtn.disabled = true; startBtn.className = "flex-1 bg-slate-800 text-slate-600 font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-not-allowed text-sm sm:text-base";
        stopBtn.disabled = false; stopBtn.className = "flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm sm:text-base";
    } else {
        startBtn.disabled = false; startBtn.className = "flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm sm:text-base";
        stopBtn.disabled = true; stopBtn.className = "flex-1 bg-slate-800 text-slate-500 font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-not-allowed border border-slate-900 text-sm sm:text-base";
    }
}
