/**
 * 🎙️ 智能指令音訊隨機播放器 - 獨立邏輯控制
 * 特色：全行無把手拖曳排序、高發差螢光綠機率、與權重樣式相同的指令方塊
 */

// ==========================================
// 1. PWA Service Worker 註冊
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('Service Worker 註冊成功！', reg.scope))
            .catch((err) => console.log('Service Worker 註冊失敗:', err));
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
// 4. UI 渲染功能 (整行可拖曳，機率高反差)
// ==========================================
function renderCommands() {
    const tbody = document.getElementById('commandList');
    tbody.innerHTML = '';
    
    const totalWeight = commands.reduce((sum, cmd) => sum + cmd.weight, 0);

    if (commands.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500 bg-slate-950/20">目前清單空空如也，請在下方新增。</td></tr>`;
        document.getElementById('nextIndex').innerText = "#1";
        return;
    }

    commands.forEach((cmd, index) => {
        const percentage = totalWeight > 0 ? ((cmd.weight / totalWeight) * 100).toFixed(1) : 0;
        
        const tr = document.createElement('tr');
        tr.setAttribute('draggable', 'true'); 
        tr.setAttribute('data-id', cmd.id);   
        // hover 變亮，並加上抓取小手的滑鼠指標提示
        tr.className = 'hover:bg-slate-800/30 transition group cursor-grab active:cursor-grabbing';
        
        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-slate-500 text-xs select-none">${index + 1}</td>
            <td class="p-3">
                <input type="text" value="${cmd.text}" 
                       onchange="updateText(${cmd.id}, this.value)" 
                       class="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition">
            </td>
            <td class="p-3 text-center">
                <input type="number" value="${cmd.weight}" min="1" max="100" 
                       onchange="updateWeight(${cmd.id}, this.value)" 
                       class="w-16 px-1 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-center text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition">
            </td>
            <td class="p-3 text-center font-black text-emerald-400 text-sm tracking-wide bg-emerald-950/20 rounded-lg select-none">
                ${percentage}%
            </td>
            <td class="p-3 text-center">
                <button onclick="deleteCommand(${cmd.id})" class="text-slate-600 hover:text-rose-500 transition flex items-center justify-center mx-auto">
                    <span class="material-icons-round text-lg">delete_outline</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
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

    if (!text) return;
    if (isNaN(weight) || weight < 1 || weight > 100) return;

    const newCmd = { id: Date.now(), text: text, weight: weight };
    commands.push(newCmd);
    renderCommands();

    textInput.value = '';
    weightInput.value = '10';
    updateInitialCountdownDisplay();
}

function updateText(id, newText) {
    const trimmedText = newText.trim();
    if (!trimmedText) {
        renderCommands(); 
        return;
    }
    const cmd = commands.find(c => c.id === id);
    if (cmd) cmd.text = trimmedText;
}

function updateWeight(id, newWeight) {
    let weight = parseInt(newWeight);
    if (isNaN(weight) || weight < 1) weight = 1;
    if (weight > 100) weight = 100;

    const cmd = commands.find(c => c.id === id);
    if (cmd) {
        cmd.weight = weight;
        renderCommands(); 
    }
}

function deleteCommand(id) {
    commands = commands.filter(cmd => cmd.id !== id);
    renderCommands();
}

// ==========================================
// 6. 整合式全行拖曳排序邏輯
// ==========================================
function setupDragAndDrop() {
    const tbody = document.getElementById('commandList');

    tbody.addEventListener('dragstart', (e) => {
        const targetRow = e.target.closest('tr');
        if (targetRow) targetRow.classList.add('dragging');
    });

    tbody.addEventListener('dragend', (e) => {
        const targetRow = e.target.closest('tr');
        if (targetRow) targetRow.classList.remove('dragging');
        
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const newCommandsOrder = [];
        
        rows.forEach(row => {
            const id = parseInt(row.getAttribute('data-id'));
            const foundCmd = commands.find(c => c.id === id);
            if (foundCmd) newCommandsOrder.push(foundCmd);
        });
        
        commands = newCommandsOrder; 
        renderCommands(); 
    });

    tbody.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        const draggingRow = tbody.querySelector('.dragging');
        if (!draggingRow) return;

        const targetRow = e.target.closest('tr');
        if (targetRow && targetRow !== draggingRow) {
            const bounding = targetRow.getBoundingClientRect();
            const offset = e.clientY - bounding.top - (bounding.height / 2);
            
            if (offset > 0) {
                tbody.insertBefore(draggingRow, targetRow.nextSibling);
            } else {
                tbody.insertBefore(draggingRow, targetRow);
            }
        }
    });
}

// ==========================================
// 7. 播放控制與系統語音演算法 (粵語發音)
// ==========================================
function toggleTimeInputs() {
    const mode = document.querySelector('input[name="timeMode"]:checked').value;
    if (mode === 'fixed') {
        document.getElementById('fixedTimeInput').classList.remove('hidden');
        document.getElementById('randomTimeInput').classList.add('hidden');
    } else {
        document.getElementById('fixedTimeInput').classList.add('hidden');
        document.getElementById('randomTimeInput').classList.remove('hidden');
    }
}

function updateInitialCountdownDisplay() {
    if (isPlaying) return;
    const minInput = parseInt(document.getElementById('durationMin').value) || 0;
    const secInput = parseInt(document.getElementById('durationSec').value) || 0;
    const total = (minInput * 60) + secInput;
    updateCountdownUI(total);
}

function speak(text) {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-HK';        
    utterance.rate = 1.0;            
    window.speechSynthesis.speak(utterance);
}

function getNextCommand() {
    if (commands.length === 0) return null;
    const playMode = document.querySelector('input[name="playMode"]:checked').value;

    if (playMode === 'sequence') {
        const cmd = commands[sequenceIndex];
        sequenceIndex = (sequenceIndex + 1) % commands.length; 
        return cmd;
    } else {
        const totalWeight = commands.reduce((sum, cmd) => sum + cmd.weight, 0);
        let random = Math.random() * totalWeight;
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
    if (!cmd) {
        stopPlayback();
        return;
    }

    document.getElementById('statusDisplay').innerHTML = `🔊 正在播放：<span class="text-blue-400 font-extrabold text-xl">${cmd.text}</span>`;
    speak(cmd.text);

    const timeMode = document.querySelector('input[name="timeMode"]:checked').value;
    let nextDelay = 3000; 

    if (timeMode === 'fixed') {
        const seconds = parseFloat(document.getElementById('fixedSeconds').value);
        nextDelay = seconds * 1000;
    } else {
        const min = parseFloat(document.getElementById('minSeconds').value);
        const max = parseFloat(document.getElementById('maxSeconds').value);
        const actualMin = Math.min(min, max);
        const actualMax = Math.max(min, max);
        nextDelay = (Math.random() * (actualMax - actualMin) + actualMin) * 1000;
    }

    timerId = setTimeout(playLoop, nextDelay);
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
            document.getElementById('statusDisplay').innerText = "⏱️ 時間到！訓練結束";
        }
    }, 1000);
}

function updateCountdownUI(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.getElementById('countdownContainer').innerText = formattedTime;
}

function startPlayback() {
    if (commands.length === 0) {
        alert('請先加入指令！');
        return;
    }

    const minInput = parseInt(document.getElementById('durationMin').value) || 0;
    const secInput = parseInt(document.getElementById('durationSec').value) || 0;
    totalSecondsLeft = (minInput * 60) + secInput;

    if (totalSecondsLeft <= 0) {
        alert('請設定總播放時長！');
        return;
    }
    
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
        startBtn.className = "flex-1 bg-slate-800 text-slate-600 font-bold py-4 px-6 rounded-xl transition flex items-center justify-center gap-2 text-lg cursor-not-allowed";
        stopBtn.disabled = false;
        stopBtn.className = "flex-1 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-rose-600/10 transition flex items-center justify-center gap-2 text-lg";
    } else {
        startBtn.disabled = false;
        startBtn.className = "flex-1 bg-blue-500 hover:bg-blue-600 active:scale-[0.99] text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 text-lg";
        stopBtn.disabled = true;
        stopBtn.className = "flex-1 bg-slate-800 text-slate-500 font-bold py-4 px-6 rounded-xl transition flex items-center justify-center gap-2 text-lg cursor-not-allowed border border-slate-900";
    }
}