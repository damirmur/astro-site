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
		if err := collection.Fields.AddMarshaledJSONAt(7, []byte(`{
			"help": "",
			"hidden": false,
			"id": "select1655102503",
			"maxSelect": 0,
			"name": "priority",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "select",
			"values": [
				"low",
				"medium",
				"high"
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
		if err := collection.Fields.AddMarshaledJSONAt(7, []byte(`{
			"help": "",
			"hidden": false,
			"id": "select1655102503",
			"maxSelect": 0,
			"name": "priority",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "select",
			"values": [
				"Low (low)",
				"Medium (medium)",
				"High (high)"
			]
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	})
}
