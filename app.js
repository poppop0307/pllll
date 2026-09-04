let currentDate = new Date();
let selectedDateStr = "";
let todoData = JSON.parse(localStorage.getItem('calendar_planner_data')) || {};
let notifiedTasks = JSON.parse(localStorage.getItem('notified_tasks')) || [];

// 🛠️ 설정 데이터 초기화
let configData = JSON.parse(localStorage.getItem('planner_config_data')) || {
    mainTitle: "🗓️ 쌍기사 합격 달력 플래너",
    primaryColor: "#2ecc71",
    fontStyle: "'Malgun Gothic', sans-serif",
    ddayText: "🔥 전기기사 1회차 필기 시험까지"
};

// ⏱️ 스탑워치 글로벌 변수
let timerInterval = null;
let elapsedSeconds = 0; 

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

const EXAM_DATE = new Date("2027-03-02T00:00:00");

function initCalendar() {
    applyConfig(); 
    initSettingsUI(); 
    updateDDay();
    renderCalendar();
    
    document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
    document.getElementById('add-task-btn').addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') addTask(); });

    document.getElementById('toggle-settings-btn').addEventListener('click', () => {
        document.getElementById('settings-panel').classList.toggle('hidden');
    });

    document.getElementById('sw-start-btn').addEventListener('click', startStopwatch);
    document.getElementById('sw-stop-btn').addEventListener('click', stopStopwatch);
    document.getElementById('sw-reset-btn').addEventListener('click', resetStopwatch);
    quotaSelect.addEventListener('change', updateProgressBar);

    setInterval(checkAlarms, 10000);
}

function applyConfig() {
    document.getElementById('main-title').innerText = configData.mainTitle || "🗓️ 쌍기사 합격 달력 플래너";
    document.documentElement.style.setProperty('--primary', configData.primaryColor);
    document.body.style.fontFamily = configData.fontStyle;
    document.getElementById('dday-custom-text').innerText = configData.ddayText;
}

function initSettingsUI() {
    const titleInput = document.getElementById('setting-main-title');
    const colorInput = document.getElementById('setting-color');
    const fontSelect = document.getElementById('setting-font');
    const ddayTextInput = document.getElementById('setting-dday-text');

    titleInput.value = configData.mainTitle || "🗓️ 쌍기사 합격 달력 플래너";
    colorInput.value = configData.primaryColor;
    fontSelect.value = configData.fontStyle;
    ddayTextInput.value = configData.ddayText;

    titleInput.addEventListener('input', (e) => { configData.mainTitle = e.target.value; saveConfig(); });
    colorInput.addEventListener('input', (e) => { configData.primaryColor = e.target.value; saveConfig(); });
    fontSelect.addEventListener('change', (e) => { configData.fontStyle = e.target.value; saveConfig(); });
    ddayTextInput.addEventListener('input', (e) => { configData.ddayText = e.target.value; saveConfig(); });
}

function saveConfig() { localStorage.setItem('planner_config_data', JSON.stringify(configData)); applyConfig(); }

function updateDDay() {
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(EXAM_DATE); target.setHours(0,0,0,0);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    document.getElementById('dday-count').innerText = diffDays > 0 ? `D-${diffDays}` : (diffDays === 0 ? `D-Day` : `종료`);
}

function renderCalendar() {
    grid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthYearTitle.innerText = `${year}년 ${month + 1}월`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'day-cell empty';
        grid.appendChild(emptyDiv);
    }

    const today = new Date();
    for (let day = 1; day <= lastDay; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'day-cell';
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.innerText = day;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) dayDiv.classList.add('today');
        if (dateStr === selectedDateStr) dayDiv.classList.add('selected');

        dayCell.appendChild(dayDiv);

        if (todoData[dateStr] && todoData[dateStr].tasks && todoData[dateStr].tasks.some(t => !t.completed)) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dayCell.appendChild(dot);
        }

        dayCell.addEventListener('click', () => selectDate(dateStr, dayDiv));
        grid.appendChild(dayCell);
    }
}

function selectDate(dateStr, element) {
    stopStopwatch(); 
    document.querySelectorAll('.day').forEach(d => d.classList.remove('selected'));
    element.classList.add('selected');
    
    selectedDateStr = dateStr;
    plannerContainer.classList.remove('hidden');
    selectedDateTitle.innerText = `📌 ${dateStr} 학습 계획`;
    
    if (!todoData[selectedDateStr] || Array.isArray(todoData[selectedDateStr])) {
        const oldTasks = Array.isArray(todoData[selectedDateStr]) ? todoData[selectedDateStr] : [];
        todoData[selectedDateStr] = { tasks: oldTasks, studySeconds: 0, quotaHours: 3 };
    }

    elapsedSeconds = todoData[selectedDateStr].studySeconds || 0;
    quotaSelect.value = todoData[selectedDateStr].quotaHours || 3;

    updateStopwatchDisplay();
    updateProgressBar();
    renderTodoList();
}

function renderTodoList() {
    todoListContainer.innerHTML = '';
    const tasks = todoData[selectedDateStr].tasks || [];

    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `todo-item ${task.completed ? 'completed' : ''}`;
        const leftZone = document.createElement('label');
        leftZone.style.display = 'flex'; leftZone.style.alignItems = 'center';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => toggleTask(task.id));

        const textSpan = document.createElement('span'); textSpan.innerText = task.text;

        leftZone.appendChild(checkbox); leftZone.appendChild(textSpan);
        if (task.time) {
            const timeTag = document.createElement('span'); timeTag.className = 'task-time-tag'; timeTag.innerText = `⏰ ${task.time}`;
            leftZone.appendChild(timeTag);
        }

        const delBtn = document.createElement('button'); delBtn.className = 'delete-btn'; delBtn.innerText = '❌';
        delBtn.addEventListener('click', () => deleteTask(task.id));

        item.appendChild(leftZone); item.appendChild(delBtn);
        todoListContainer.appendChild(item);
    });
}

function startStopwatch() {
    if (timerInterval) return; 
    timerInterval = setInterval(() => {
        elapsedSeconds++;
        todoData[selectedDateStr].studySeconds = elapsedSeconds;
        saveData();
        updateStopwatchDisplay();
        updateProgressBar();
    }, 1000);
}

function stopStopwatch() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function resetStopwatch() {
    if (confirm("정말 오늘 측정한 공부 시간을 리셋하시겠습니까?")) {
        stopStopwatch();
        elapsedSeconds = 0;
        todoData[selectedDateStr].studySeconds = 0;
        saveData();
        updateStopwatchDisplay();
        updateProgressBar();
    }
}

function updateStopwatchDisplay() {
    const hrs = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(elapsedSeconds % 60).padStart(2, '0');
    swDisplay.innerText = `${hrs}:${mins}:${secs}`;
}

function updateProgressBar() {
    const targetHours = parseInt(quotaSelect.value);
    todoData[selectedDateStr].quotaHours = targetHours;
    saveData();

    const targetSeconds = targetHours * 3600;
    let percentage = Math.floor((elapsedSeconds / targetSeconds) * 100);
    if (percentage > 100) percentage = 100;

    progressBar.style.width = `${percentage}%`;
    progressText.innerText = `오늘 목표 달성률: ${percentage}%`;
}

function addTask() {
    const text = taskInput.value.trim(); const time = timeInput.value;
    if (!text) return;
    todoData[selectedDateStr].tasks.push({ id: Date.now(), text: text, time: time || null, completed: false });
    saveData(); taskInput.value = ''; timeInput.value = ''; renderTodoList(); renderCalendar();
}

function toggleTask(id) {
    todoData[selectedDateStr].tasks = todoData[selectedDateStr].tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveData(); renderTodoList(); renderCalendar();
}

function deleteTask(id) {
    todoData[selectedDateStr].tasks = todoData[selectedDateStr].tasks.filter(t => t.id !== id);
    saveData(); renderTodoList(); renderCalendar();
}

function saveData() { localStorage.setItem('calendar_planner_data', JSON.stringify(todoData)); }

function checkAlarms() {
    const now = new Date();
    for (const dateStr in todoData) {
        const tasks = todoData[dateStr].tasks || [];
        tasks.forEach(task => {
            if (task.time && !task.completed && !notifiedTasks.includes(task.id)) {
                const taskDateTime = new Date(`${dateStr}T${task.time}:00`);
                const timeDiff = taskDateTime - now;
                if (timeDiff > 0 && timeDiff <= 60 * 60 * 1000) {
                    notifiedTasks.push(task.id);
                    localStorage.setItem('notified_tasks', JSON.stringify(notifiedTasks));
                    alert(`⏰ [학습 알람] 1시간 뒤 계획된 공부가 있습니다!\n내용: ${task.text} (${task.time})`);
                }
            }
        });
    }
}

initCalendar();
