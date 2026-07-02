let currentNatalId = "";
let cachedHoroscopes = [];

document.addEventListener("DOMContentLoaded", () => {
    // Автоматическая подстановка текущей даты и времени в формате UTC+0 при первом открытии
    const now = new Date();
    const utcString = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                        .toISOString()
                        .substring(0, 16);
    document.getElementById("birth-date").value = utcString;

    if (localStorage.getItem("token")) showApp();
});

async function onTelegramAuth(user) {
    try {
        const data = await ApiService.login('telegram',user);
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.record));
        showApp();
    } catch (err) { alert(err.message); }
}

function showApp() {
    const user = JSON.parse(localStorage.getItem("user"));
    UiService.renderUserPanel(user);
    loadSettings();
    loadHoroscopes();
    loadTodoItems();
}

async function loadHoroscopes() {
    try {
        cachedHoroscopes = await ApiService.getHoroscopesList();
        
        if (cachedHoroscopes.length > 0 && !currentNatalId) {
            const latest = cachedHoroscopes[0];
            currentNatalId = latest.id;
            const formattedDate = latest.event_date ? latest.event_date.replace("T", " ").substring(0, 19) : "—";
            document.getElementById("selected-natal-name").innerText = `"${latest.title}" от ${formattedDate}`;
        } else if (cachedHoroscopes.length === 0) {
            document.getElementById("selected-natal-name").innerText = "База карт пуста";
        }
        
        UiService.renderHoroscopesList(cachedHoroscopes, currentNatalId);
    } catch (err) { console.error("Ошибка архива:", err); }
}

async function loadTodoItems() {
    try {
        const items = await ApiService.getTodoItems();
        UiService.renderTodoList(items);
    } catch (err) { console.error("Ошибка загрузки задач:", err); }
}
// Добавление задачи
async function handleAddTodo() {
    const title = document.getElementById("new-todo-title").value;
    const description = document.getElementById("new-todo-description").value; // Добавлено
    const priority = document.getElementById("new-todo-priority").value;
    const due_date = document.getElementById("new-todo-date").value;

    if (!title) return alert("Заголовок обязателен");

    try {
        await ApiService.createTodoItem({
            title: title,
            description: description, // Передаем описание
            priority: priority,        // Теперь будет "low", "medium" или "high"
            due_date: due_date,       // Будет дата в формате YYYY-MM-DD
            status: "todo",            // Значение по умолчанию из вашего списка select
            completed: false
        });
        
        // Очистка полей после успеха
        document.getElementById("new-todo-title").value = "";
        document.getElementById("new-todo-description").value = "";
        document.getElementById("new-todo-date").value = "";
        
        loadTodoItems();
    } catch (err) { alert(err.message); }
}

// Функция редактирования (добавляем описание в prompt)
async function editTodoRow(id, title, status, priority, dueDate, description) { // Добавили параметр description
    const newTitle = prompt("Редактировать заголовок:", title);
    if (newTitle === null) return;
    
    const newDescription = prompt("Редактировать описание:", description || "");
    if (newDescription === null) return;

    const newStatus = prompt("Статус (todo, in_progress, review, completed):", status);
    if (newStatus === null) return;

    const newPriority = prompt("Приоритет (low, medium, high):", priority);
    if (newPriority === null) return;

    const newDueDate = prompt("Дата (YYYY-MM-DD):", dueDate);
    if (newDueDate === null) return;

    try {
        await ApiService.updateTodoItem(id, {
            title: newTitle,
            description: newDescription,
            status: newStatus,
            priority: newPriority,
            due_date: newDueDate
        });
        loadTodoItems();
    } catch (err) { alert(err.message); }
}

// Переключение статуса завершенности
async function toggleTodoStatus(id, currentStatus) {
    try {
        await ApiService.updateTodoItem(id, { completed: !currentStatus });
        loadTodoItems();
    } catch (err) { alert(err.message); }
}

// Удаление задачи 
async function deleteTodoItem(id, title) {
    if (!confirm(`Удалить задачу "${title}"?`)) return;
    try {
        await ApiService.deleteTodoItem(id);
        loadTodoItems();
    } catch (err) { alert(err.message); }
}
function selectNatalCard(id, title, dateStr) {
    currentNatalId = id;
    document.getElementById("selected-natal-name").innerText = `"${title}" от ${dateStr}`;
    UiService.renderHoroscopesList(cachedHoroscopes, currentNatalId);
}

async function deleteNatalCard(id, title) {
    if (!confirm(`Удалить гороскоп "${title}" из базы?`)) return;
    try {
        await ApiService.deleteHoroscope(id);
        if (currentNatalId === id) {
            currentNatalId = "";
            document.getElementById("selected-natal-name").innerText = "Последний расчет";
        }
        loadHoroscopes();
    } catch (err) { alert(err.message); }
}

async function loadSettings() {
    try {
        const data = await ApiService.getSettings();
        let jsonRemainder = { ...data };
        ['city', 'latitude', 'longitude', 'tz', 'houses'].forEach(k => delete jsonRemainder[k]);
        UiService.renderSettingsForm(data, jsonRemainder);
    } catch (err) { console.error(err); }
}

async function saveSettings() {
    let remainderData = {};
    const rawJsonText = document.getElementById("settings-raw").value.trim();
    if (rawJsonText) {
        try { remainderData = JSON.parse(rawJsonText); } 
        catch (e) { return alert("Ошибка синтаксиса в поле JSON!"); }
    }
    const finalSettings = {
        city: document.getElementById("set-city").value,
        latitude: parseFloat(document.getElementById("set-lat").value) || 0,
        longitude: parseFloat(document.getElementById("set-lon").value) || 0,
        tz: document.getElementById("set-tz").value,
        houses: document.getElementById("set-houses").value,
        ...remainderData
    };
    try {
        await ApiService.saveSettings(finalSettings);
        alert("Настройки сохранены!");
        loadSettings();
    } catch (err) { alert(err.message); }
}

async function calculateNatal() {
    const dateInput = document.getElementById("birth-date").value;
    if (!dateInput) return alert("Укажите дату");

    const date = new Date(dateInput + ":00.000Z").toISOString();
    const lat = document.getElementById("geo-lat").value;
    const lon = document.getElementById("geo-lon").value;

    let title = document.getElementById("calc-title").value.trim();
    if (!title) title = `Расчет от ${dateInput.replace("T", " ")}`;

    document.getElementById("text-output").innerText = "Вычисления...";

    try {
        const data = await ApiService.getNatalChart(date, lat, lon, title);
        UiService.renderRawJson(data);

        const planets = data.pl || (data.chart && data.chart.pl);
        const aspects = data.as || (data.chart && data.chart.as);

        if (planets && planets.length > 0) {
            const normalizedData = data.chart ? data : { chart: { pl: planets, as: aspects }, saved_id: data.saved_id };
            const scores = ElementsService.calculateScores(planets, aspects);
            UiService.renderNatalReport(title, normalizedData, scores);
            loadHoroscopes();
        } else {
            document.getElementById("text-output").innerText = "Бэкенд вернул пустую карту";
        }
    } catch (err) { 
        document.getElementById("text-output").innerHTML = `<span style="color:#f87171;"><b>Ошибка вычислений:</b> ${err.message}</span>`;
    }
}

async function calculateTransit() {
    document.getElementById("text-output").innerText = "Вычисления транзитов...";
    try {
        const data = await ApiService.getTransitChart(currentNatalId);
        UiService.renderRawJson(data);
        const serverTime = data.ts ? new Date(data.ts).toLocaleString("ru-RU") : new Date().toLocaleString("ru-RU");
        
        let title = document.getElementById("calc-title").value.trim();
        if (!title) {
            const activeCard = cachedHoroscopes.find(h => h.id === currentNatalId);
            const activeTitle = activeCard ? activeCard.title : "Натал";
            title = `Транзит неба к карте "${activeTitle}"`;
        }
        UiService.renderTransitReport(title, data, serverTime);
    } catch (err) { 
        document.getElementById("text-output").innerHTML = `<span style="color:#f87171;"><b>Ошибка транзита:</b> ${err.message}</span>`;
    }
}

async function interpretAi(type) {
    if (!currentNatalId) {
        return alert("Сначала выберите активную карту в архиве!");
    }

    const outputDiv = document.getElementById("text-output");
    outputDiv.innerHTML = `<div style="color:#b45309; font-weight:bold;">🤖 Астропсихолог-ИИ анализирует JSON-данные эфемерид... Пожалуйста, подождите...</div>`;

    try {
        const data = await ApiService.getAiInterpretation(type, currentNatalId);
        const formattedText = data.interpretation.replace(/\n/g, "<br>");
        
        outputDiv.innerHTML = `<div class="text-report">
            <h4 class="report-title">🧠 Интерпретация от астропсихолога-ИИ</h4>
            <div style="font-size:15px; line-height:1.7; color:#292524;">${formattedText}</div>
        </div>`;
    } catch (err) {
        outputDiv.innerHTML = `<span style="color:#ef4444;"><b>Ошибка ИИ-интерпретатора:</b> ${err.message}. Проверьте LM Studio.</span>`;
    }
}

function logout() { localStorage.clear(); window.location.reload(); }
