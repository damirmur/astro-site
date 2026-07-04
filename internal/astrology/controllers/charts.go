// controllers/astrology.go
package controllers

import (
	"net/http"

    "github.com/pocketbase/pocketbase/apis"
    "github.com/pocketbase/pocketbase/core"
)

//---------------------------------------------------------
// КОНТРОЛЛЕРЫ ПАПОК (charts_fld)
//---------------------------------------------------------

// CreateFolder отвечает за создание новой папки
func CreateFolder(re *core.RequestEvent) error {
	// Извлекаем текущего авторизованного пользователя
	user := re.Auth

	// Структура для парсинга входящего JSON
	var body struct {
		Txt string `json:"txt"`
		Pid string `json:"pid"`
	}
	if err := re.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Неверный формат JSON", err)
	}
	if body.Txt == "" {
		return apis.NewBadRequestError("Название папки (txt) обязательно", nil)
	}

	// Находим коллекцию через встроенное API v0.39.x
	collection, err := re.App.FindCollectionByNameOrId("charts_fld")
	if err != nil {
		return apis.NewNotFoundError("Коллекция папок не найдена", err)
	}

	// Создаем новую запись
	record := core.NewRecord(collection)
	record.Set("u", user.Id)
	record.Set("txt", body.Txt)
	
	// Если указана родительская папка, проверяем, что она принадлежит этому же пользователю
	if body.Pid != "" {
		parent, err := re.App.FindRecordById("charts_fld", body.Pid)
		if err != nil || parent.GetString("u") != user.Id {
			return apis.NewBadRequestError("Родительская папка не найдена или недоступна", nil)
		}
		record.Set("pid", body.Pid)
	}

	// Сохраняем в базу данных
	if err := re.App.Save(record); err != nil {
		return apis.NewBadRequestError("Не удалось создать папку", err)
	}

	return re.JSON(http.StatusCreated, record)
}

// UpdateFolder отвечает за переименование или перемещение папки
func UpdateFolder(re *core.RequestEvent) error {
	id := re.Request.PathValue("id")
	user := re.Auth

	record, err := re.App.FindRecordById("charts_fld", id)
	if err != nil || record.GetString("u") != user.Id {
		return apis.NewNotFoundError("Папка не найдена", err)
	}

	var body struct {
		Txt *string `json:"txt"` // Используем указатели, чтобы понимать, передано ли поле
		Pid *string `json:"pid"`
	}
	if err := re.BindBody(&body); err != nil {
		return apis.NewBadRequestError("Неверный формат JSON", err)
	}

	if body.Txt != nil {
		record.Set("txt", *body.Txt)
	}
	
	if body.Pid != nil {
		if *body.Pid != "" {
			// Защита от зацикливания (папка не может быть родителем самой себе)
			if *body.Pid == id {
				return apis.NewBadRequestError("Папка не может содержать саму себя", nil)
			}
			parent, err := re.App.FindRecordById("charts_fld", *body.Pid)
			if err != nil || parent.GetString("u") != user.Id {
				return apis.NewBadRequestError("Родительская папка недоступна", nil)
			}
			record.Set("pid", *body.Pid)
		} else {
			record.Set("pid", nil) // Перенос в корень
		}
	}

	if err := re.App.Save(record); err != nil {
		return apis.NewBadRequestError("Ошибка обновления папки", err)
	}

	return re.JSON(http.StatusOK, record)
}

// DeleteFolder удаляет папку и каскадно очищает её содержимое (подпапки и карты)
func DeleteFolder(re *core.RequestEvent) error {
	id := re.Request.PathValue("id")
	user := re.Auth

	folder, err := re.App.FindRecordById("charts_fld", id)
	if err != nil || folder.GetString("u") != user.Id {
		return apis.NewNotFoundError("Папка не найдена", err)
	}

	// Транзакционное удаление, чтобы не оставить "сирот" при сбое
	err = re.App.RunInTransaction(func(txApp core.App) error {
		// 1. Находим и удаляем карты, привязанные к этой папке
		charts, _ := txApp.FindRecordsByFilter("charts", "fid = {:fid}", "", 0, 0, map[string]any{"fid": id})
		for _, c := range charts {
			if err := txApp.Delete(c); err != nil {
				return err
			}
		}

		// 2. Находим и удаляем подпапки (рекурсивно первого уровня)
		subfolders, _ := txApp.FindRecordsByFilter("charts_fld", "pid = {:pid}", "", 0, 0, map[string]any{"pid": id})
		for _, sf := range subfolders {
			if err := txApp.Delete(sf); err != nil {
				return err
			}
		}

		// 3. Удаляем саму папку
		return txApp.Delete(folder)
	})

	if err != nil {
		return apis.NewBadRequestError("Не удалось выполнить каскадное удаление", err)
	}

	return re.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}

//---------------------------------------------------------
// КОНТРОЛЛЕРЫ КАРТ (charts)
//---------------------------------------------------------

// CreateChart создает новую астрологическую карту
func CreateChart(re *core.RequestEvent) error {
	user := re.Auth

	collection, err := re.App.FindCollectionByNameOrId("charts")
	if err != nil {
		return apis.NewNotFoundError("Коллекция карт не найдена", err)
	}

	record := core.NewRecord(collection)
	record.Set("u", user.Id)

	// Передаем управление парсингу данных напрямую в запись PocketBase
	if err := re.BindBody(record); err != nil {
		return apis.NewBadRequestError("Неверный формат данных карты", err)
	}

	// Проверяем валидность fid (папки), если она передана
	fid := record.GetString("fid")
	if fid != "" {
		folder, err := re.App.FindRecordById("charts_fld", fid)
		if err != nil || folder.GetString("u") != user.Id {
			return apis.NewBadRequestError("Указанная папка не существует или недоступна", nil)
		}
	}

	if err := re.App.Save(record); err != nil {
		return apis.NewBadRequestError("Не удалось сохранить карту", err)
	}

	return re.JSON(http.StatusCreated, record)
}

// UpdateChart обновляет любые поля астрологической карты
func UpdateChart(re *core.RequestEvent) error {
	id := re.Request.PathValue("id")
	user := re.Auth

	record, err := re.App.FindRecordById("charts", id)
	if err != nil || record.GetString("u") != user.Id {
		return apis.NewNotFoundError("Карта не найдена", err)
	}

	// Читаем только измененные поля из JSON запроса в модель записи
	if err := re.BindBody(record); err != nil {
		return apis.NewBadRequestError("Неверный формат данных", err)
	}

	// Дополнительно проверяем безопасность fid, если его изменили
	fid := record.GetString("fid")
	if fid != "" {
		folder, err := re.App.FindRecordById("charts_fld", fid)
		if err != nil || folder.GetString("u") != user.Id {
			return apis.NewBadRequestError("Целевая папка недоступна", nil)
		}
	}

	if err := re.App.Save(record); err != nil {
		return apis.NewBadRequestError("Ошибка обновления карты", err)
	}

	return re.JSON(http.StatusOK, record)
}

// DeleteChart удаляет одну астрологическую карту
func DeleteChart(re *core.RequestEvent) error {
	id := re.Request.PathValue("id")
	user := re.Auth

	record, err := re.App.FindRecordById("charts", id)
	if err != nil || record.GetString("u") != user.Id {
		return apis.NewNotFoundError("Карта не найдена", err)
	}

	if err := re.App.Delete(record); err != nil {
		return apis.NewBadRequestError("Не удалось удалить карту", err)
	}

	return re.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}
