package migrations

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		jsonData := `{
			"createRule": "@request.auth.id = user.id",
			"deleteRule": "@request.auth.id = user.id",
			"fields": [
				{
					"autogeneratePattern": "[a-z0-9]{15}",
					"help": "",
					"hidden": false,
					"id": "text3208210256",
					"max": 15,
					"min": 15,
					"name": "id",
					"pattern": "^[a-z0-9]+$",
					"presentable": false,
					"primaryKey": true,
					"required": true,
					"system": true,
					"type": "text"
				},
				{
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
				},
				{
					"autogeneratePattern": "",
					"help": "",
					"hidden": false,
					"id": "text724990059",
					"max": 0,
					"min": 0,
					"name": "title",
					"pattern": "",
					"presentable": false,
					"primaryKey": false,
					"required": false,
					"system": false,
					"type": "text"
				},
				{
					"help": "",
					"hidden": false,
					"id": "date3042278353",
					"max": "",
					"min": "",
					"name": "event_date",
					"presentable": false,
					"required": false,
					"system": false,
					"type": "date"
				},
				{
					"help": "",
					"hidden": false,
					"id": "json1917361563",
					"maxSize": 0,
					"name": "astrological_data",
					"presentable": false,
					"required": false,
					"system": false,
					"type": "json"
				},
				{
					"autogeneratePattern": "",
					"help": "",
					"hidden": false,
					"id": "text3957051671",
					"max": 0,
					"min": 0,
					"name": "interpretation",
					"pattern": "",
					"presentable": false,
					"primaryKey": false,
					"required": false,
					"system": false,
					"type": "text"
				},
				{
					"hidden": false,
					"id": "autodate2990389176",
					"name": "created",
					"onCreate": true,
					"onUpdate": false,
					"presentable": false,
					"system": false,
					"type": "autodate"
				},
				{
					"hidden": false,
					"id": "autodate3332085495",
					"name": "updated",
					"onCreate": true,
					"onUpdate": true,
					"presentable": false,
					"system": false,
					"type": "autodate"
				}
			],
			"id": "pbc_2051914341",
			"indexes": [],
			"listRule": "@request.auth.id = user.id",
			"name": "horoscopes",
			"system": false,
			"type": "base",
			"updateRule": "@request.auth.id = user.id",
			"viewRule": "@request.auth.id = user.id"
		}`

		collection := &core.Collection{}
		if err := json.Unmarshal([]byte(jsonData), &collection); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_2051914341")
		if err != nil {
			return err
		}

		return app.Delete(collection)
	})
}
