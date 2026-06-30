package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_3975969204")
		if err != nil {
			return err
		}

		// add field
		if err := collection.Fields.AddMarshaledJSONAt(3, []byte(`{
			"help": "",
			"hidden": false,
			"id": "select4211221526",
			"maxSelect": 0,
			"name": "coordinates_format",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "select",
			"values": [
				"DMS",
				"Decimal"
			]
		}`)); err != nil {
			return err
		}

		// update field
		if err := collection.Fields.AddMarshaledJSONAt(2, []byte(`{
			"help": "",
			"hidden": false,
			"id": "select1274211008",
			"maxSelect": 0,
			"name": "house_system",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "select",
			"values": [
				"Placidus",
				"Koch",
				"Regiomontanus",
				"Equal"
			]
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_3975969204")
		if err != nil {
			return err
		}

		// remove field
		collection.Fields.RemoveById("select4211221526")

		// update field
		if err := collection.Fields.AddMarshaledJSONAt(2, []byte(`{
			"help": "",
			"hidden": false,
			"id": "select1274211008",
			"maxSelect": 0,
			"name": "select",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "select",
			"values": [
				"Placidus",
				"Koch",
				"Regiomontanus",
				"Equal"
			]
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	})
}
