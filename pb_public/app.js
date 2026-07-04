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
        radio.addEventListener('change', function () {
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

    // Фильтры
    document.getElementById('filter-status').addEventListener('change', applyFilters);
    document.getElementById('filter-priority').addEventListener('change', applyFilters);

    // Обработчик клика по строке для редактирования
    const todoContainer = document.getElementById('todo-list-container');
    todoContainer.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        const tr = e.target.closest('tr');
        if (!tr) return;
        const id = tr.dataset.id;
        if (!id) return;

        const title = decodeURIComponent(tr.dataset.title || '');
        const status = decodeURIComponent(tr.dataset.status || 'todo');
        const priority = decodeURIComponent(tr.dataset.priority || 'medium');
        const due = decodeURIComponent(tr.dataset.due || '');
        const description = decodeURIComponent(tr.dataset.description || '');
        const attachment = decodeURIComponent(tr.dataset.attachment || '');

        editTodoRow(id, title, status, priority, due, description, attachment);
    });
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

// --- Функции для работы с ZIP ---

// Упаковывает выбранные файлы в ZIP и возвращает Blob
async function createZipFromFiles(fileList) {
    const zip = new JSZip();
    for (let file of fileList) {
        zip.file(file.name, file);
    }
    // Добавлены параметры сжатия
    return await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
            level: 6 // Хороший баланс между скоростью и степенью сжатия
        }
    });
}

// Загружает ZIP через наш кастомный эндпоинт /api/todo/attachment/{id}
async function loadAndUnzip(id) {
    const url = `${ApiService.getUrl()}/api/todo/attachment/${id}`;

    const headers = ApiService.getHeaders();
    const response = await fetch(url, { headers });


    if (!response.ok) {
        const text = await response.text();
        console.error('❌ Ответ сервера:', text.substring(0, 200));
        throw new Error(`Не удалось загрузить архив: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Проверяем сигнатуру ZIP
    const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;
    if (!isZip) {
        const textPreview = new TextDecoder().decode(new Uint8Array(arrayBuffer.slice(0, 200)));
        console.error('❌ Файл НЕ является ZIP-архивом! Первые 200 символов:', textPreview);
        throw new Error('Сервер вернул не ZIP-архив. Проверьте авторизацию и URL.');
    }

    try {
        const zip = await JSZip.loadAsync(arrayBuffer);

        const files = [];
        for (let [name, file] of Object.entries(zip.files)) {
            if (!file.dir) {
                const data = await file.async("blob");
                files.push({ name, data });
            }
        }
        return files;
    } catch (zipError) {
        console.error('❌ Ошибка распаковки ZIP:', zipError);
        throw zipError;
    }
}
async function downloadFile(url, filename) {
    try {
        const headers = ApiService.getHeaders();
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
        console.error('Ошибка скачивания:', err);
        alert('Не удалось скачать файл: ' + err.message);
    }
}
// --- Обработчики Todo ---

async function handleAddTodo() {
    const title = document.getElementById("new-todo-title").value.trim();
    if (!title) return alert("Заголовок обязателен");

    const description = document.getElementById("new-todo-description").value;
    const priority = document.getElementById("new-todo-priority").value;
    const due_date = document.getElementById("new-todo-date").value;
    const status = document.getElementById("new-todo-status").value;
    const fileInput = document.getElementById("new-todo-attachment");
    const files = fileInput.files; // это FileList

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('priority', priority);
    formData.append('due_date', due_date);
    formData.append('status', status);

    // Если есть файлы, упаковываем в ZIP
    if (files && files.length > 0) {
        try {
            const zipBlob = await createZipFromFiles(files);
            // Имя файла: files.zip (можно также генерировать уникальное)
            formData.append('attachment', zipBlob, 'files.zip');
        } catch (err) {
            alert('Ошибка упаковки файлов: ' + err.message);
            return;
        }
    } else {
        // Для простоты, пока оставим как есть: если не выбраны файлы, то поле не отправляется.
    }

    try {
        if (editingTodoId) {
            // Поэтому оставим как есть: если файлы не выбраны, то старые остаются.
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

    if (dueDate) {
        let datePart = dueDate.split('T')[0];
        if (datePart === dueDate) {
            datePart = dueDate.split(' ')[0];
        }
        document.getElementById("new-todo-date").value = datePart;
    } else {
        document.getElementById("new-todo-date").value = "";
    }

    document.getElementById("new-todo-status").value = status;

    const isNote = priority === 'note';
    document.querySelector(`input[name="todo-type"][value="${isNote ? 'note' : 'task'}"]`).checked = true;

    UiService.setTodoFormMode('edit', priority);

    const previewContainer = document.getElementById("todo-attachment-preview");
    if (attachment) {
        // 🔥 Используем новый эндпоинт – передаём только id
        loadAndUnzip(id)
            .then(files => {
                if (files.length === 0) {
                    previewContainer.innerHTML = `<div class="file-preview">Архив пуст</div>`;
                    return;
                }
                let html = `<div class="file-preview"><span>📦 Содержимое архива (${files.length} файл(ов)):</span></div>
                    <div class="file-list">`;
                files.forEach((f, index) => {
                    html += `<div class="file-item">
                        <span class="file-name">📄 ${f.name}</span>
                        <button class="download-btn" data-filename="${f.name}" data-fileindex="${index}">Скачать</button>
                    </div>`;
                });
                html += `</div>`;
                previewContainer.innerHTML = html;

                // Обработчики скачивания
                previewContainer.querySelectorAll('.download-btn').forEach(btn => {
                    btn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        const idx = parseInt(this.dataset.fileindex);
                        const file = files[idx];
                        if (file) {
                            const link = document.createElement('a');
                            link.href = URL.createObjectURL(file.data);
                            link.download = file.name;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                        }
                    });
                });

                // Кнопка удаления архива
                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'Удалить архив';
                removeBtn.className = 'btn-danger';
                removeBtn.style.marginTop = '8px';
                removeBtn.onclick = function () { removeAttachment(id); };
                previewContainer.appendChild(removeBtn);
            })
            .catch(err => {
                previewContainer.innerHTML = `<div class="file-preview" style="color:#ef4444;">Ошибка загрузки архива: ${err.message}</div>`;
            });
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
    document.getElementById("new-todo-attachment").value = ""; // очищаем input file
    document.getElementById("todo-attachment-preview").innerHTML = "";
    document.querySelector('input[name="todo-type"][value="task"]').checked = true;
    document.getElementById("new-todo-priority").value = "medium";
    UiService.setTodoFormMode('add', 'medium');
}

async function removeAttachment(id) {
    if (!confirm("Удалить все вложения (архив)?")) return;
    try {
        // Отправляем formData с attachment = '' 
        const formData = new FormData();
        formData.append('title', document.getElementById("new-todo-title").value);
        formData.append('description', document.getElementById("new-todo-description").value);
        formData.append('priority', document.getElementById("new-todo-priority").value);
        formData.append('due_date', document.getElementById("new-todo-date").value);
        formData.append('status', document.getElementById("new-todo-status").value);
        formData.append('attachment', ''); // пустой файл = удаление
        await ApiService.updateTodoItem(id, formData);
        document.getElementById("todo-attachment-preview").innerHTML = '';
        editingTodoAttachment = null;
        loadTodoItems();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteCurrentTodo() {
    if (!editingTodoId) return;
    const title = document.getElementById("new-todo-title").value.trim() || "элемент";
    if (!confirm(`Удалить задачу "${title}"?`)) return;
    try {
        await ApiService.deleteTodoItem(editingTodoId);
        resetTodoForm();
        loadTodoItems();
    } catch (err) {
        alert(err.message);
    }
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

