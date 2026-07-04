    let currentNatalId = "";
    let cachedHoroscopes = [];
    let editingTodoId = null;
    let editingTodoAttachment = null;

document.addEventListener("DOMContentLoaded", () => {
    const now = new Date();
    const utcString = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                        .toISOString()
                        .substring(0, 16);
    document.getElementById("birth-date").value = utcString;
    if (localStorage.getItem("token")) showApp();

    // Переключатель типа (задача/запись)
    document.querySelectorAll('input[name="todo-type"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const isNote = this.value === 'note';
            const prioritySelect = document.getElementById("new-todo-priority");
            if (isNote) {
                prioritySelect.value = 'note';
            } else {
                if (!editingTodoId) {
                    prioritySelect.value = 'medium';
                }
            }
            updateTodoFormTitle();
        });
    });

    // Фильтры (только статус и приоритет)
    document.getElementById('filter-status').addEventListener('change', applyFilters);
    document.getElementById('filter-priority').addEventListener('change', applyFilters);
});

    function updateTodoFormTitle() {
        const isNote = document.querySelector('input[name="todo-type"]:checked').value === 'note';
        const mode = editingTodoId ? 'edit' : 'add';
        UiService.setTodoFormMode(mode, isNote ? 'note' : 'medium');
    }

    async function onTelegramAuth(user) {
        try {
            const data = await ApiService.login('telegram', user);
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
            window.allTodoItems = items;
            applyFilters();
        } catch (err) { console.error("Ошибка загрузки задач:", err); }
    }

function applyFilters() {
    if (window.allTodoItems) {
        UiService.renderTodoList(window.allTodoItems);
    }
}
async function handleAddTodo() {
    const title = document.getElementById("new-todo-title").value.trim();
    if (!title) return alert("Заголовок обязателен");

    const description = document.getElementById("new-todo-description").value;
    const priority = document.getElementById("new-todo-priority").value;
    const due_date = document.getElementById("new-todo-date").value;
    const status = document.getElementById("new-todo-status").value;
    const fileInput = document.getElementById("new-todo-attachment");
    const file = fileInput.files[0];

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('priority', priority);
    formData.append('due_date', due_date);
    formData.append('status', status);
    if (file) {
        formData.append('attachment', file);
    }

    try {
        if (editingTodoId) {
            await ApiService.updateTodoItem(editingTodoId, formData);
        } else {
            await ApiService.createTodoItem(formData);
        }
        resetTodoForm();
        loadTodoItems();
    } catch (err) {
        alert(err.message);
    }
}
    function editTodoRow(id, title, status, priority, dueDate, description, attachment) {
        editingTodoId = id;
        editingTodoAttachment = attachment || null;

        document.getElementById("new-todo-title").value = title;
        document.getElementById("new-todo-description").value = description || "";
        document.getElementById("new-todo-priority").value = priority;
        document.getElementById("new-todo-date").value = dueDate || "";
        document.getElementById("new-todo-status").value = status;

        const isNote = priority === 'note';
        document.querySelector(`input[name="todo-type"][value="${isNote ? 'note' : 'task'}"]`).checked = true;

        UiService.setTodoFormMode('edit', priority);

        const previewContainer = document.getElementById("todo-attachment-preview");
        if (attachment) {
            const fileUrl = `${ApiService.getUrl()}/api/collections/todo_items/records/${id}/files/${attachment}`;
            previewContainer.innerHTML = `
                <div class="file-preview">
                    <span>📎 <a href="${fileUrl}" target="_blank">${attachment}</a></span>
                    <button onclick="removeAttachment('${id}')" class="btn-danger">Удалить файл</button>
                </div>
            `;
        } else {
            previewContainer.innerHTML = '';
        }
        document.getElementById("todo-form-container").scrollIntoView({ behavior: 'smooth' });
    }

    function cancelEditTodo() {
        resetTodoForm();
        loadTodoItems();
    }

function resetTodoForm() {
    editingTodoId = null;
    editingTodoAttachment = null;
    document.getElementById("new-todo-title").value = "";
    document.getElementById("new-todo-description").value = "";
    document.getElementById("new-todo-date").value = "";
    document.getElementById("new-todo-status").value = "todo";
    document.getElementById("new-todo-attachment").value = "";
    document.getElementById("todo-attachment-preview").innerHTML = "";
    document.querySelector('input[name="todo-type"][value="task"]').checked = true;
    document.getElementById("new-todo-priority").value = "medium";
    UiService.setTodoFormMode('add', 'medium');
}
    async function removeAttachment(id) {
        if (!confirm("Удалить прикреплённый файл?")) return;
        try {
            const formData = new FormData();
            formData.append('attachment', '');
            const title = document.getElementById("new-todo-title").value;
            const description = document.getElementById("new-todo-description").value;
            const priority = document.getElementById("new-todo-priority").value;
            const due_date = document.getElementById("new-todo-date").value;
            const status = document.getElementById("new-todo-status").value;
            formData.append('title', title);
            formData.append('description', description);
            formData.append('priority', priority);
            formData.append('due_date', due_date);
            formData.append('status', status);

            await ApiService.updateTodoItem(id, formData);
            document.getElementById("todo-attachment-preview").innerHTML = '';
            editingTodoAttachment = null;
            loadTodoItems();
        } catch (err) {
            alert(err.message);
        }
    }


    async function deleteTodoItem(id, title) {
        if (!confirm(`Удалить задачу "${title}"?`)) return;
        try {
            await ApiService.deleteTodoItem(id);
            loadTodoItems();
        } catch (err) { alert(err.message); }
    }

    // Астрологические функции (без изменений)
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
