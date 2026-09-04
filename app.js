// 📡 1단계에서 구글 콘솔에 뜬 본인의 config 정보를 복사해서 여기에 정확히 붙여넣으세요!
const firebaseConfig = {
    apiKey: "AIzaSyAlklkIM7C086jhIHpnumxceayb-PIvPVg",
    authDomain: "pllll-429ed.firebaseapp.com",
    projectId: "pllll-429ed",
    storageBucket: "pllll-429ed.firebasestorage.app",
    messagingSenderId: "299339940502",
    appId: "1:299339940502:web:c4f514eebc4dfc859a78b7"
  };


// 파이어베이스 및 실시간 Firestore DB 초기화
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentDate = new Date();
let selectedDateStr = "";
let currentUserId = sessionStorage.getItem('planner_user_id') || "";
let todoData = {}; // 구글 클라우드에서 실시간 동기화됨

let configData = JSON.parse(localStorage.getItem('planner_config_data')) || {
    mainTitle: "🗓️ 달력 플래너",
    primaryColor: "#2ecc71",
    fontStyle: "'Malgun Gothic', sans-serif",
    ddayText: "🔥 필기 시험까지",
    ddayTargetDate: "2027-03-02"
};

let timerInterval = null;
let elapsedSeconds = 0; 

// DOM 캐싱
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

const loginContainer = document.getElementById('login-container');
const mainAppContainer = document.getElementById('main-app-container');
const loginIdInput = document.getElementById('login-id');
const loginPwInput = document.getElementById('login-pw');
const loginErrorMsg = document.getElementById('login-error');

function initCalendar() {
    if (currentUserId) {
        listenUserData(currentUserId);
        showApp();
    }

    document.getElementById('login-btn').addEventListener('click', handleLogin);
    loginPwInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') handleLogin(); });
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

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
}

// 🌐 구글 클라우드 실시간 감시 소켓 라이브러리 엔진
function listenUserData(userId) {
    db.collection("users").doc(userId).onSnapshot((doc) => {
        if (doc.exists) {
            todoData = doc.data().plannerData || {};
        } else {
            todoData = {};
        }
        if (selectedDateStr) {
            const data = todoData[selectedDateStr] || { tasks: [], studySeconds: 0, quotaHours: 3 };
            elapsedSeconds = data.studySeconds || 0;
            updateStopwatchDisplay();
            updateProgressBar();
            renderTodoList();
        }
        renderCalendar();
    });
}

function handleLogin() {
    const id = loginIdInput.value.trim();
    const pw = loginPwInput.value.trim();

    if (!id || !pw) {
        alert("아이디와 비밀번호를 입력해주세요.");
        return;
    }

    const userRef = db.collection("account_rules").doc(id);
    userRef.get().then((doc) => {
        if (!doc.exists) {
            userRef.set({ password: pw }).then(() => {
                alert(`🎉 [클라우드 계정 등록] 새 아이디(${id})가 전 세계 서버에 저장되었습니다.`);
                proceedLogin(id);
            });
        } else {
            if (doc.data().password === pw) {
                proceedLogin(id);
            } else {
                loginErrorMsg.classList.remove('hidden');
                loginPwInput.value = '';
            }
        }
    });
}

function proceedLogin(id) {
    currentUserId = id;
    sessionStorage.setItem('planner_user_id', id);
    loginErrorMsg.classList.add('hidden');
    listenUserData(id);
    showApp();
}

function handleLogout() {
    stopStopwatch();
    sessionStorage.removeItem('planner_user_id');
    currentUserId = "";
    todoData = {};
    loginIdInput.value = '';
    loginPwInput.value = '';
    plannerContainer.classList.add('hidden');
    mainAppContainer.classList.add('hidden');
    loginContainer.classList.remove('hidden');
}

function applyConfig() {
    document.getElementById('main-title').innerText = configData.mainTitle || "🗓️ 달력 플래너";
    document.documentElement.style.setProperty('--primary', configData.primaryColor);
    document.body.style.fontFamily = configData.fontStyle;
    document.getElementById('dday-custom-text').innerText = configData.ddayText;
}

function initSettingsUI() {
    const titleInput = document.getElementById('setting-main-title');
    const colorInput = document.getElementById('setting-color');
    const fontSelect = document.getElementById('setting-font');
    const ddayTextInput = document.getElementById('setting-dday-text');
    const ddayDateInput = document.getElementById('setting-dday-date');

    titleInput.value = configData.mainTitle || "🗓️ 달력 플래너";
    colorInput.value = configData.primaryColor;
    fontSelect.value = configData.fontStyle;
    ddayTextInput.value = configData.ddayText;
    ddayDateInput.value = configData.ddayTargetDate || "2027-03-02";

    titleInput.addEventListener('input', (e) => { configData.mainTitle = e.target.value; saveConfig(); });
    colorInput.addEventListener('input', (e) => { configData.primaryColor = e.target.value; saveConfig(); });
    fontSelect.addEventListener('change', (e) => { configData.fontStyle = e.target.value; saveConfig(); });
    ddayTextInput.addEventListener('input', (e) => { configData.ddayText = e.target.value; saveConfig(); });
    ddayDateInput.addEventListener('change', (e) => { configData.ddayTargetDate = e.target.value; saveConfig(); });
}

function saveConfig() { localStorage.setItem('planner_config_data', JSON.stringify(configData)); applyConfig(); }

function updateDDay() {
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(configData.ddayTargetDate || "2027-03-02"); target.setHours(0,0,0,0);
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    const ddayElement = document.getElementById('dday-count');
    ddayElement.innerText = diffDays > 0 ? `D-${diffDays}` : (diffDays === 0 ? `D-Day` : `종료`);
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
    
    if (!todoData[selectedDateStr]) {
        todoData[selectedDateStr] = { tasks: [], studySeconds: 0, quotaHours: 3 };
    }

    elapsedSeconds = todoData[selectedDateStr].studySeconds || 0;
    quotaSelect.value = todoData[selectedDateStr].quotaHours || 3;

    updateStopwatchDisplay();
    updateProgressBar();
    renderTodoList();
}

function renderTodoList() {
    todoListContainer.innerHTML = '';
    const tasks = todoData[selectedDateStr]?.tasks || [];

    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = `todo-item ${task.completed ? 'completed' : ''}`;
        const leftZone = document.createElement('label');
        leftZone.style.display = 'flex'; leftZone.style.alignItems = 'center';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.checked = task.completed;
        checkbox.style.marginRight = '8px';
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
    saveData(); taskInput.value = ''; timeInput.value = '';
}

function toggleTask(id) {
    todoData[selectedDateStr].tasks = todoData[selectedDateStr].tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveData();
}

function deleteTask(id) {
    todoData[selectedDateStr].tasks = todoData[selectedDateStr].tasks.filter(t => t.id !== id);
    saveData();
}

// ☁️ 구글 원격 클라우드 업데이트 코어
function saveData() { 
    todoData[selectedDateStr].quotaHours = parseInt(quotaSelect.value);
    db.collection("users").doc(currentUserId).set({ plannerData: todoData });
}

initCalendar();
