package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_2465793358")
		if err != nil {
			return err
		}

		// update field
		if err := collection.Fields.AddMarshaledJSONAt(5, []byte(`{
			"help": "",
			"hidden": false,
			"id": "select2063623452",
			"maxSelect": 0,
			"name": "status",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "select",
			"values": [
				"todo",
				"in_progress",
				"review",
				"completed"
			]
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_2465793358")
		if err != nil {
			return err
		}

		// update field
		if err := collection.Fields.AddMarshaledJSONAt(5, []byte(`{
			"help": "",
			"hidden": false,
			"id": "select2063623452",
			"maxSelect": 0,
			"name": "status",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "select",
			"values": [
				"To Do (todo)",
				"In Progress (in_progress)",
				"In Review (review)",
				"Completed (completed)"
			]
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	})
}
