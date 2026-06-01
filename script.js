/**
 * 🎙️ 智能指令音訊隨機播放器 - 獨立邏輯控制
 * 特色：RWD 彈性版面渲染（手機不擠壓）、全行無把手拖曳排序、高發差螢光綠機率
 */

// ==========================================
// 1. PWA Service Worker 註冊
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('PWA SW 註冊失敗:', err));
    });
}

// ==========================================
// 2. 全域變數與初始資料
// ==========================================
let commands = [
    { id: 1, text: "左直拳", weight: 50 },
    { id: 2, text: "右勾拳", weight: 30 },
    { id: 3, text: "閃躲", weight: 20 }
];

let timerId = null;        
let countdownId = null;    
let isPlaying = false;     
let sequenceIndex = 0;     
let totalSecondsLeft = 0;  

// ==========================================
// 3. 初始化監聽與生命週期
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    renderCommands();        
    setupDragAndDrop();     
    updateInitialCountdownDisplay(); 
    
    // 讓輸入框與電子計時鐘同步連動
    document.getElementById('durationMin').addEventListener('input', updateInitialCountdownDisplay);
    document.getElementById('durationSec').addEventListener('input', updateInitialCountdownDisplay);
});

// ==========================================
// 4. 響應式 UI 渲染功能 (手機獨立排版，保證指令欄寬敞)
// ==========================================
function renderCommands() {
    const container = document.getElementById('commandList');
    container.innerHTML = '';
    
    const totalWeight = commands.reduce((sum, cmd) => sum + cmd.weight, 0);

    if (commands.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-500 bg-slate-950/20 rounded-xl border border-slate-800/50">目前清單空空如也，請在下方新增。</div>`;
        document.getElementById('nextIndex').innerText = "#1";
        return;
    }

    commands.forEach((cmd, index) => {
        const percentage = totalWeight > 0 ? ((cmd.weight / totalWeight) * 100).toFixed(1) : 0;
        
        const itemRow = document.createElement('div');
        itemRow.setAttribute('draggable', 'true'); 
        itemRow.setAttribute('data-id', cmd.id);   
        
        // 手機：垂直微卡片布局 (flex-col) 讓指令輸入框有 100% 寬度；電腦：自動展開為單行橫向布局 (sm:flex-row)
        itemRow.className = 'dragging-target p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl transition flex flex-col sm:flex-row gap-3 items-stretch sm:items-center cursor-grab active:cursor-grabbing hover:bg-slate-800/20';
        
        itemRow.innerHTML = `
            <div class="flex items-center gap-3 flex-1">
                <div class="w-6 text-center font-bold text-slate-500 text-xs select-none">#${index + 1}</div>
                <div class="flex-1">
                    <input type="text" value="${cmd.text}" 
                           onchange="updateText(${cmd.id}, this.value)" 
                           class="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition text-sm sm:text-base">
                </div>
            </div>
            
            <div class="flex items-center justify-between sm:justify-end gap-3 border-t border-slate-800/50 sm:border-t-0 pt-2 sm:pt-0">
                <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-500 sm:hidden">權重:</span>
                    <input type="number" value="${cmd.weight}" min="1" max="100" 
                           onchange="updateWeight(${cmd.id}, this.value)" 
                           class="w-16 px-1 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-center text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-sm">
                </div>
                
                <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-500 sm:hidden">機率:</span>
                    <div class="w-20 py-1.5 text-center font-black text-emerald-400 text-xs sm:text-sm tracking-wide bg-emerald-950/20 rounded-lg select-none">
                        ${percentage}%
                    </div>
                </div>

                <button onclick="deleteCommand(${cmd.id})" class="text-slate-500 hover:text-rose-500 transition p-1 flex items-center justify-center">
                    <span class="material-icons-round text-lg sm:text-xl">delete_outline</span>
                </button>
            </div>
        `;
        container.appendChild(itemRow);
    });

    document.getElementById('nextIndex').innerText = `#${commands.length + 1}`;
}

// ==========================================
// 5. 資料變更核心操作 (新增、修改、刪除)
// ==========================================
function addCommand() {
    const textInput = document.getElementById('cmdText');
    const weightInput = document.getElementById('cmdWeight');
    const text = textInput.value.trim();
    const weight = parseInt(weightInput.value);

    if (!text || isNaN(weight) || weight < 1 || weight > 100) return;

    commands.push({ id: Date.now(), text: text, weight: weight });
    renderCommands();

    textInput.value = '';
    weightInput.value = '10';
    updateInitialCountdownDisplay();
}

function updateText(id, newText) {
    const trimmed = newText.trim();
    if (!trimmed) { renderCommands(); return; }
    const cmd = commands.find(c => c.id === id);
    if (cmd) cmd.text = trimmed;
}

function updateWeight(id, newWeight) {
    let val = parseInt(newWeight);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 100) val = 100;
    const cmd = commands.find(c => c.id === id);
    if (cmd) { cmd.weight = val; renderCommands(); }
}

function deleteCommand(id) {
    commands = commands.filter(cmd => cmd.id !== id);
    renderCommands();
}

// ==========================================
// 6. 全行 / 全卡片拖曳排序邏輯
// ==========================================
function setupDragAndDrop() {
    const container = document.getElementById('commandList');

    container.addEventListener('dragstart', (e) => {
        const target = e.target.closest('.dragging-target');
        if (target) target.classList.add('dragging');
    });

    container.addEventListener('dragend', (e) => {
        const target = e.target.closest('.dragging-target');
        if (target) target.classList.remove('dragging');
        
        const rows = Array.from(container.querySelectorAll('.dragging-target'));
        const newOrder = [];
        rows.forEach(row => {
            const id = parseInt(row.getAttribute('data-id'));
            const found = commands.find(c => c.id === id);
            if (found) newOrder.push(found);
        });
        commands = newOrder; 
        renderCommands(); 
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        const draggingRow = container.querySelector('.dragging');
        if (!draggingRow) return;

        const target = e.target.closest('.dragging-target');
        if (target && target !== draggingRow) {
            const bounding = target.getBoundingClientRect();
            const offset = e.clientY - bounding.top - (bounding.height / 2);
            if (offset > 0) {
                container.insertBefore(draggingRow, target.nextSibling);
            } else {
                container.insertBefore(draggingRow, target);
            }
        }
    });
}

// ==========================================
// 7. 播放控制與系統語音演算法 (粵語發音)
// ==========================================
function toggleTimeInputs() {
    const mode = document.querySelector('input[name="timeMode"]:checked').value;
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
    utterance.lang = 'zh-HK';        // 預設為廣東話發音
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
        delay = (Math.random() * (Math.max(min, max) - Math.min(min, max)) + Math.min(min, max)) * 1000;
    }
    timerId = setTimeout(playLoop, delay);
}

// ==========================================
// 8. 倒數計時與狀態切換
// ==========================================
function startCountdown() {
    updateCountdownUI(totalSecondsLeft);
    countdownId = setInterval(() => {
        totalSecondsLeft--;
        updateCountdownUI(totalSecondsLeft);
        if (totalSecondsLeft <= 0) {
            stopPlayback();
            document.getElementById('statusDisplay').innerText = "⏱️ 訓練結束";
        }
    }, 1000);
}

function updateCountdownUI(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById('countdownContainer').innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startPlayback() {
    if (commands.length === 0) return alert('請先加入指令！');
    const min = parseInt(document.getElementById('durationMin').value) || 0;
    const sec = parseInt(document.getElementById('durationSec').value) || 0;
    totalSecondsLeft = (min * 60) + sec;
    if (totalSecondsLeft <= 0) return alert('請設定總時長！');
    
    isPlaying = true;
    sequenceIndex = 0; 
    toggleButtons(true);
    
    document.getElementById('statusDot').className = "w-3 h-3 rounded-full bg-emerald-500 animate-ping";
    document.getElementById('countdownContainer').className = "text-2xl font-black font-mono tracking-wider bg-slate-800 px-4 py-1.5 rounded-xl border border-emerald-500 text-emerald-400";
    
    playLoop();
    startCountdown();
}

function stopPlayback() {
    isPlaying = false;
    if (timerId) clearTimeout(timerId);
    if (countdownId) clearInterval(countdownId);
    window.speechSynthesis.cancel(); 
    
    document.getElementById('statusDisplay').innerText = "狀態：已停止";
    document.getElementById('statusDot').className = "w-3 h-3 rounded-full bg-slate-500";
    document.getElementById('countdownContainer').className = "text-2xl font-black font-mono tracking-wider bg-slate-800 px-4 py-1.5 rounded-xl border border-slate-700 text-slate-400";
    
    toggleButtons(false);
    updateInitialCountdownDisplay();
}

function toggleButtons(running) {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    if (running) {
        startBtn.disabled = true;
        startBtn.className = "flex-1 bg-slate-800 text-slate-600 font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-not-allowed text-sm sm:text-base";
        stopBtn.disabled = false;
        stopBtn.className = "flex-1 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm sm:text-base";
    } else {
        startBtn.disabled = false;
        startBtn.className = "flex-1 bg-blue-500 hover:bg-blue-600 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm sm:text-base";
        stopBtn.disabled = true;
        stopBtn.className = "flex-1 bg-slate-800 text-slate-500 font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-not-allowed border border-slate-900 text-sm sm:text-base";
    }
}
