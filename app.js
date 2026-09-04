let currentDate = new Date();
let selectedDateStr = "";
let todoData = JSON.parse(localStorage.getItem('calendar_planner_data')) || {};
let timerInterval = null;
let elapsedSeconds = 0; 

let configData = JSON.parse(localStorage.getItem('planner_config_data')) || {
    mainTitle: "🗓️ 달력 플래너", primaryColor: "#2ecc71", fontStyle: "'Malgun Gothic', sans-serif", ddayText: "🔥 필기 시험까지", ddayTargetDate: "2027-03-02"
};

const grid = document.getElementById('calendar-grid');
const monthYearTitle = document.getElementById('month-year-title');
const plannerContainer = document.getElementById('planner-container');
const selectedDateTitle = document.getElementById('selected-date-title');
const taskInput = document.getElementById('new-task-input');
const timeInput = document.getElementById('task-time-input');
const todoListContainer = document.getElementById('todo-list');
const swDisplay = document.getElementById('stopwatch-display');
const quotaSelect = document.getElementById('quota-select');
const progressBar = document.getElementById('quota-progress-bar');
const progressText = document.getElementById('quota-progress-text');

function initCalendar() {
    applyConfig(); initSettingsUI(); updateDDay(); renderCalendar();
    document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
    document.getElementById('add-task-btn').addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addTask(); });
    document.getElementById('toggle-settings-btn').addEventListener('click', () => { document.getElementById('settings-panel').classList.toggle('hidden'); });
    document.getElementById('sw-start-btn').addEventListener('click', startStopwatch);
    document.getElementById('sw-stop-btn').addEventListener('click', stopStopwatch);
    document.getElementById('sw-reset-btn').addEventListener('click', resetStopwatch);
    quotaSelect.addEventListener('change', updateProgressBar);
}

function applyConfig() { document.getElementById('main-title').innerText = configData.mainTitle; document.documentElement.style.setProperty('--primary', configData.primaryColor); document.body.style.fontFamily = configData.fontStyle; document.getElementById('dday-custom-text').innerText = configData.ddayText; }
function initSettingsUI() {
    const titleInput = document.getElementById('setting-main-title'); const colorInput = document.getElementById('setting-color'); const fontSelect = document.getElementById('setting-font'); const ddayTextInput = document.getElementById('setting-dday-text'); const ddayDateInput = document.getElementById('setting-dday-date');
    titleInput.value = configData.mainTitle; colorInput.value = configData.primaryColor; fontSelect.value = configData.fontStyle; ddayTextInput.value = configData.ddayText; ddayDateInput.value = configData.ddayTargetDate;
    titleInput.addEventListener('input', (e) => { configData.mainTitle = e.target.value; saveConfig(); });
    colorInput.addEventListener('input', (e) => { configData.primaryColor = e.target.value; saveConfig(); });
    fontSelect.addEventListener('change', (e) => { configData.fontStyle = e.target.value; saveConfig(); });
    ddayTextInput.addEventListener('input', (e) => { configData.ddayText = e.target.value; saveConfig(); });
    ddayDateInput.addEventListener('change', (e) => { configData.ddayTargetDate = e.target.value; saveConfig(); updateDDay(); });
}
function saveConfig() { localStorage.setItem('planner_config_data', JSON.stringify(configData)); applyConfig(); }
function updateDDay() { const today = new Date(); today.setHours(0,0,0,0); const target = new Date(configData.ddayTargetDate); target.setHours(0,0,0,0); const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24)); document.getElementById('dday-count').innerText = diffDays > 0 ? `D-${diffDays}` : (diffDays === 0 ? `D-Day` : `종료`); }

function renderCalendar() {
    grid.innerHTML = ''; const year = currentDate.getFullYear(); const month = currentDate.getMonth(); monthYearTitle.innerText = `${year}년 ${month + 1}월`;
    const firstDayIndex = new Date(year, month, 1).getDay(); const lastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDayIndex; i++) { const em = document.createElement('div'); em.className = 'day-cell empty'; grid.appendChild(em); }
    const today = new Date();
    for (let day = 1; day <= lastDay; day++) {
        const cell = document.createElement('div'); cell.className = 'day-cell'; const dDiv = document.createElement('div'); dDiv.className = 'day'; dDiv.innerText = day;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) dDiv.classList.add('today');
        if (dateStr === selectedDateStr) dDiv.classList.add('selected');
        cell.appendChild(dDiv);
        if (todoData[dateStr] && todoData[dateStr].tasks && todoData[dateStr].tasks.some(t => !t.completed)) { const dot = document.createElement('div'); dot.className = 'dot'; cell.appendChild(dot); }
        cell.addEventListener('click', () => selectDate(dateStr, dDiv)); grid.appendChild(cell);
    }
}

function selectDate(dateStr, element) {
    stopStopwatch(); document.querySelectorAll('.day').forEach(d => d.classList.remove('selected')); element.classList.add('selected'); selectedDateStr = dateStr; plannerContainer.classList.remove('hidden'); selectedDateTitle.innerText = `📌 ${dateStr} 학습 계획`;
    if (!todoData[selectedDateStr] || Array.isArray(todoData[selectedDateStr])) { const old = Array.isArray(todoData[selectedDateStr]) ? todoData[selectedDateStr] : []; todoData[selectedDateStr] = { tasks: old, studySeconds: 0, quotaHours: 3 }; }
    elapsedSeconds = todoData[selectedDateStr].studySeconds || 0; quotaSelect.value = todoData[selectedDateStr].quotaHours || 3;
    updateStopwatchDisplay(); updateProgressBar(); renderTodoList();
}

function renderTodoList() {
    todoListContainer.innerHTML = ''; const tasks = todoData[selectedDateStr]?.tasks || [];
    tasks.forEach(task => {
        const item = document.createElement('div'); item.className = `todo-item ${task.completed ? 'completed' : ''}`; const left = document.createElement('label'); left.style.display = 'flex'; left.style.alignItems = 'center';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = task.completed; cb.style.marginRight = '8px'; cb.addEventListener('change', () => { task.completed = cb.checked; saveData(); renderTodoList(); renderCalendar(); });
        const span = document.createElement('span'); span.innerText = task.text; left.appendChild(cb); left.appendChild(span);
        if (task.time) { const tag = document.createElement('span'); tag.className = 'task-time-tag'; tag.innerText = `⏰ ${task.time}`; left.appendChild(tag); }
        const del = document.createElement('button'); del.className = 'delete-btn'; del.innerText = '❌'; del.addEventListener('click', () => { todoData[selectedDateStr].tasks = todoData[selectedDateStr].tasks.filter(t => t.id !== task.id); saveData(); renderTodoList(); renderCalendar(); });
        item.appendChild(left); item.appendChild(del); todoListContainer.appendChild(item);
    });
}

function startStopwatch() { if (timerInterval) return; timerInterval = setInterval(() => { elapsedSeconds++; todoData[selectedDateStr].studySeconds = elapsedSeconds; saveData(); updateStopwatchDisplay(); updateProgressBar(); }, 1000); }
function stopStopwatch() { clearInterval(timerInterval); timerInterval = null; }
function resetStopwatch() { if (confirm("공부 시간을 리셋하시겠습니까?")) { stopStopwatch(); elapsedSeconds = 0; todoData[selectedDateStr].studySeconds = 0; saveData(); updateStopwatchDisplay(); updateProgressBar(); } }
function updateStopwatchDisplay() { const hrs = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0'); const mins = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0'); const secs = String(elapsedSeconds % 60).padStart(2, '0'); swDisplay.innerText = `${hrs}:${mins}:${secs}`; }
function updateProgressBar() { const targetHours = parseInt(quotaSelect.value); const targetSeconds = targetHours * 3600; let percentage = Math.floor((elapsedSeconds / targetSeconds) * 100); if (percentage > 100) percentage = 100; progressBar.style.width = `${percentage}%`; progressText.innerText = `오늘 목표 달성률: ${percentage}%`; }

function addTask() {
    const text = taskInput.value.trim(); const time = timeInput.value; if (!text) return;
    todoData[selectedDateStr].tasks.push({ id: Date.now(), text: text, time: time || null, completed: false });
    saveData(); taskInput.value = ''; timeInput.value = ''; renderTodoList(); renderCalendar();
}
function saveData() { localStorage.setItem('calendar_planner_data', JSON.stringify(todoData)); }

initCalendar();
