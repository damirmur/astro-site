package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("_pb_users_auth_")
		if err != nil {
			return err
		}

		// add field
		if err := collection.Fields.AddMarshaledJSONAt(8, []byte(`{
			"autogeneratePattern": "",
			"help": "",
			"hidden": false,
			"id": "text1778666140",
			"max": 0,
			"min": 0,
			"name": "telegramId",
			"pattern": "",
			"presentable": false,
			"primaryKey": false,
			"required": false,
			"system": false,
			"type": "text"
		}`)); err != nil {
			return err
		}

		// add field
		if err := collection.Fields.AddMarshaledJSONAt(9, []byte(`{
			"autogeneratePattern": "",
			"help": "",
			"hidden": false,
			"id": "text1089885584",
			"max": 0,
			"min": 0,
			"name": "vkId",
			"pattern": "",
			"presentable": false,
			"primaryKey": false,
			"required": false,
			"system": false,
			"type": "text"
		}`)); err != nil {
			return err
		}

		// add field
		if err := collection.Fields.AddMarshaledJSONAt(10, []byte(`{
			"help": "",
			"hidden": false,
			"id": "json750658832",
			"maxSize": 0,
			"name": "linkedAccounts",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "json"
		}`)); err != nil {
			return err
		}

		// add field
		if err := collection.Fields.AddMarshaledJSONAt(11, []byte(`{
			"help": "",
			"hidden": false,
			"id": "date2697416787",
			"max": "",
			"min": "",
			"name": "lastLogin",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "date"
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("_pb_users_auth_")
		if err != nil {
			return err
		}

		// remove field
		collection.Fields.RemoveById("text1778666140")

		// remove field
		collection.Fields.RemoveById("text1089885584")

		// remove field
		collection.Fields.RemoveById("json750658832")

		// remove field
		collection.Fields.RemoveById("date2697416787")

		return app.Save(collection)
	})
}
