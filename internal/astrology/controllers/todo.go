package controllers

import (
    "github.com/pocketbase/dbx"
    "github.com/pocketbase/pocketbase/apis"
    "github.com/pocketbase/pocketbase/core"
    "github.com/pocketbase/pocketbase/tools/filesystem"
)

// HandleGetTodoItems – возвращает список задач текущего пользователя
func HandleGetTodoItems(e *core.RequestEvent) error {
    app := e.App
    authRecord := e.Auth // ✅ получаем через поле Auth
    if authRecord == nil {
        return apis.NewUnauthorizedError("Требуется авторизация", nil)
    }

    records := []*core.Record{}
    err := app.RecordQuery("todo_items").
        AndWhere(dbx.HashExp{"user_id": authRecord.Id}).
        OrderBy("created DESC").
        All(&records)
    if err != nil {
        return apis.NewInternalServerError("Ошибка получения задач", err)
    }

    return e.JSON(200, records)
}

// HandleCreateTodoItem – создание задачи с возможностью загрузки файла
func HandleCreateTodoItem(e *core.RequestEvent) error {
    app := e.App
    authRecord := e.Auth // ✅
    if authRecord == nil {
        return apis.NewUnauthorizedError("Требуется авторизация", nil)
    }

    // Парсим multipart‑форму (макс. 32 МБ)
    if err := e.Request.ParseMultipartForm(32 << 20); err != nil {
        return apis.NewBadRequestError("Ошибка парсинга формы", err)
    }

    collection, err := app.FindCollectionByNameOrId("todo_items")
    if err != nil {
        return apis.NewInternalServerError("Коллекция не найдена", err)
    }

    record := core.NewRecord(collection)
    record.Set("user_id", authRecord.Id)
    record.Set("title", e.Request.FormValue("title"))
    record.Set("description", e.Request.FormValue("description"))
    record.Set("status", e.Request.FormValue("status"))
    record.Set("priority", e.Request.FormValue("priority"))
    record.Set("due_date", e.Request.FormValue("due_date"))

    // Обработка файла (если передан)
    file, fileHeader, err := e.Request.FormFile("attachment")
    if err == nil {
        defer file.Close()
        fsFile, err := filesystem.NewFileFromMultipart(fileHeader)
        if err != nil {
            return apis.NewBadRequestError("Ошибка обработки файла", err)
        }
        record.Set("attachment", []*filesystem.File{fsFile})
    }

    // Сохраняем запись (файл загружается автоматически)
    if err := app.Save(record); err != nil {
        return apis.NewBadRequestError("Ошибка создания записи", err)
    }

    return e.JSON(200, map[string]interface{}{
        "success": true,
        "id":      record.Id,
    })
}

// HandleUpdateTodoItem – обновление задачи (замена/удаление файла)
func HandleUpdateTodoItem(e *core.RequestEvent) error {
    app := e.App
    authRecord := e.Auth // ✅
    if authRecord == nil {
        return apis.NewUnauthorizedError("Требуется авторизация", nil)
    }

    id := e.Request.PathValue("id")
    if id == "" {
        return apis.NewBadRequestError("ID не указан", nil)
    }

    record, err := app.FindRecordById("todo_items", id)
    if err != nil {
        return apis.NewNotFoundError("Запись не найдена", err)
    }

    if record.GetString("user_id") != authRecord.Id {
        return apis.NewForbiddenError("Нет прав", nil)
    }

    if err := e.Request.ParseMultipartForm(32 << 20); err != nil {
        return apis.NewBadRequestError("Ошибка парсинга формы", err)
    }

    // Обновляем текстовые поля
    if v := e.Request.FormValue("title"); v != "" {
        record.Set("title", v)
    }
    if v := e.Request.FormValue("description"); v != "" {
        record.Set("description", v)
    }
    if v := e.Request.FormValue("status"); v != "" {
        record.Set("status", v)
    }
    if v := e.Request.FormValue("priority"); v != "" {
        record.Set("priority", v)
    }
    if v := e.Request.FormValue("due_date"); v != "" {
        record.Set("due_date", v)
    }
    if v := e.Request.FormValue("completed"); v != "" {
        record.Set("completed", v == "true" || v == "1")
    }

    // === Работа с файлом ===
    // 1. Если передан новый файл – заменяем старый
    file, fileHeader, err := e.Request.FormFile("attachment")
    if err == nil {
        defer file.Close()
        // Удаляем старый файл (если был)
        oldFile := record.GetString("attachment")
        if oldFile != "" {
            record.Set("attachment-", []string{oldFile})
        }
        // Добавляем новый
        fsFile, err := filesystem.NewFileFromMultipart(fileHeader)
        if err != nil {
            return apis.NewBadRequestError("Ошибка обработки файла", err)
        }
        record.Set("attachment", []*filesystem.File{fsFile})
    } else if e.Request.FormValue("attachment") == "" {
        // 2. Если поле attachment передано пустой строкой – удаляем файл
        oldFile := record.GetString("attachment")
        if oldFile != "" {
            record.Set("attachment-", []string{oldFile})
        }
    }

    // Сохраняем изменения
    if err := app.Save(record); err != nil {
        return apis.NewBadRequestError("Ошибка обновления записи", err)
    }

    return e.JSON(200, map[string]interface{}{
        "success": true,
        "id":      record.Id,
    })
}

// HandleDeleteTodoItem – удаление задачи (файл удаляется автоматически)
func HandleDeleteTodoItem(e *core.RequestEvent) error {
    app := e.App
    authRecord := e.Auth // ✅
    if authRecord == nil {
        return apis.NewUnauthorizedError("Требуется авторизация", nil)
    }

    id := e.Request.PathValue("id")
    if id == "" {
        return apis.NewBadRequestError("ID не указан", nil)
    }

    record, err := app.FindRecordById("todo_items", id)
    if err != nil {
        return apis.NewNotFoundError("Запись не найдена", err)
    }

    if record.GetString("user_id") != authRecord.Id {
        return apis.NewForbiddenError("Нет прав", nil)
    }

    if err := app.Delete(record); err != nil {
        return apis.NewInternalServerError("Ошибка удаления", err)
    }

    return e.JSON(200, map[string]interface{}{
        "success": true,
    })
}
