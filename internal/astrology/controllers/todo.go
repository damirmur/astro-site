package controllers

import (
	"encoding/json"
	"fmt"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/dbx"
)

// TodoInput — структура для входящих данных задачи
type TodoInput struct {
	Title       *string `json:"title"`       // обязательно при создании
	Description *string `json:"description"` // опционально
	Completed   *bool   `json:"completed"`   // опционально
	Priority    *string `json:"priority"`    // low, medium, high
	Status      *string `json:"status"`      // todo, in_progress, review, completed
	DueDate     *string `json:"due_date"`    // YYYY-MM-DD
}

// HandleCreateTodoItem создаёт новую задачу для текущего пользователя
func HandleCreateTodoItem(re *core.RequestEvent) error {
	authRecord := re.Auth
	if authRecord == nil {
		return apis.NewUnauthorizedError("Неавторизован", nil)
	}

	var input TodoInput
	if err := json.NewDecoder(re.Request.Body).Decode(&input); err != nil {
		return apis.NewBadRequestError("Некорректные данные", err)
	}
    // ДОБАВЬТЕ ЭТУ СТРОКУ ДЛЯ ОТЛАДКИ:
    fmt.Printf("DEBUG: Received data -> Title: %v, Priority: %v, Status: %v\n", 
        input.Title, input.Priority, input.Status)

	if input.Title == nil || *input.Title == "" {
		return apis.NewBadRequestError("Поле title обязательно", nil)
	}

	collection, err := re.App.FindCollectionByNameOrId("todo_items")
	if err != nil {
		return apis.NewNotFoundError("Коллекция задач не найдена", err)
	}

	record := core.NewRecord(collection)
	record.Set("title", *input.Title)
	record.Set("user_id", authRecord.Id)

	if input.Description != nil {
		record.Set("description", *input.Description)
	}
	if input.Priority != nil {
		record.Set("priority", *input.Priority)
	}
	if input.Status != nil {
		record.Set("status", *input.Status)
	}
	if input.DueDate != nil {
		record.Set("due_date", *input.DueDate)
	}
	if input.Completed != nil {
		record.Set("completed", *input.Completed)
	} else {
		record.Set("completed", false)
	}

	if err := re.App.Save(record); err != nil {
		return apis.NewInternalServerError("Ошибка при создании задачи", err)
	}

	return re.JSON(201, record)
}

// HandleUpdateTodoItem обновляет существующую задачу по ID
func HandleUpdateTodoItem(re *core.RequestEvent) error {
	authRecord := re.Auth
	if authRecord == nil {
		return apis.NewUnauthorizedError("Неавторизован", nil)
	}

	// Исправлено: используем PathValue из стандартного http.Request (Go 1.22+)
	todoID := re.Request.PathValue("id")
	if todoID == "" {
		return apis.NewBadRequestError("ID задачи не указан", nil)
	}

	// Исправлено: прямой вызов FindRecordById у app, а не у коллекции
	record, err := re.App.FindRecordById("todo_items", todoID)
	if err != nil {
		return apis.NewNotFoundError("Задача не найдена", err)
	}

	if record.GetString("user_id") != authRecord.Id {
		return apis.NewForbiddenError("Нет прав на редактирование этой задачи", nil)
	}

	var input TodoInput
	if err := json.NewDecoder(re.Request.Body).Decode(&input); err != nil {
		return apis.NewBadRequestError("Некорректные данные", err)
	}

	if input.Title != nil {
		if *input.Title == "" {
			return apis.NewBadRequestError("Заголовок не может быть пустым", nil)
		}
		record.Set("title", *input.Title)
	}
	if input.Description != nil {
		record.Set("description", *input.Description)
	}
	if input.Priority != nil {
		record.Set("priority", *input.Priority)
	}
	if input.Status != nil {
		record.Set("status", *input.Status)
	}
	if input.DueDate != nil {
		record.Set("due_date", *input.DueDate)
	}
	if input.Completed != nil {
		record.Set("completed", *input.Completed)
	}

	if err := re.App.Save(record); err != nil {
		return apis.NewInternalServerError("Ошибка при обновлении задачи", err)
	}

	return re.JSON(200, record)
}
// HandleGetTodoItems получает список задач текущего пользователя
func HandleGetTodoItems(re *core.RequestEvent) error {
	authRecord := re.Auth
	if authRecord == nil {
		return apis.NewUnauthorizedError("Неавторизован", nil)
	}

	// Прямой вызов метода поиска записей у app
	records, err := re.App.FindRecordsByFilter(
		"todo_items",                    // коллекция
		"user_id = {:userId}",           // фильтр
		"",                               // сортировка (по умолчанию)
		0,                                // лимит (0 — без лимита)
		0,                                // смещение
		dbx.Params{"userId": authRecord.Id}, // параметры фильтра
	)
	if err != nil {
		return apis.NewInternalServerError("Ошибка при получении задач", err)
	}

	return re.JSON(200, records)
}

// HandleDeleteTodoItem удаляет задачу по ID с проверкой прав доступа
func HandleDeleteTodoItem(re *core.RequestEvent) error {
	authRecord := re.Auth
	if authRecord == nil {
		return apis.NewUnauthorizedError("Неавторизован", nil)
	}

	// Новый способ получения параметров пути
	todoID := re.Request.PathValue("id")
	if todoID == "" {
		return apis.NewBadRequestError("ID задачи не указан", nil)
	}

	// Поиск записи напрямую через app
	record, err := re.App.FindRecordById("todo_items", todoID)
	if err != nil {
		return apis.NewNotFoundError("Задача не найдена", err)
	}

	// Проверка владельца
	if record.GetString("user_id") != authRecord.Id {
		return apis.NewForbiddenError("У вас нет прав на удаление этой задачи", nil)
	}

	// Удаление записи через app.Delete
	err = re.App.Delete(record)
	if err != nil {
		return apis.NewInternalServerError("Ошибка при удалении записи", err)
	}

	return re.JSON(200, map[string]string{"status": "deleted"})
}
