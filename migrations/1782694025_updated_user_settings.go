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
		if err := collection.Fields.AddMarshaledJSONAt(1, []byte(`{
			"cascadeDelete": false,
			"collectionId": "_pb_users_auth_",
			"help": "",
			"hidden": false,
			"id": "relation2375276105",
			"maxSelect": 0,
			"minSelect": 0,
			"name": "user",
			"presentable": false,
			"required": true,
			"system": false,
			"type": "relation"
		}`)); err != nil {
			return err
		}

		// add field
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
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_3975969204")
		if err != nil {
			return err
		}

		// remove field
		collection.Fields.RemoveById("relation2375276105")

		// remove field
		collection.Fields.RemoveById("select1274211008")

		return app.Save(collection)
	})
}
