package migrations

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		jsonData := `{
			"createRule": null,
			"deleteRule": null,
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
				"id": "text3208210257",
				"name": "user_id",
				"onCreate": true,
				"onUpdate": false,
				"presentable": false,
				"required": true,
				"system": false,
				"type": "relation",
				"validateRelation": {
					"cascadeDelete": true,
					"minSelect": null,
					"maxSelect": 1,
					"selectInTransaction": false
			},
			"collectionId": "users"
		},
			{
				"hidden": false,
				"id": "text3208210258",
				"name": "title",
				"onCreate": true,
				"onUpdate": true,
				"presentable": false,
				"required": true,
				"system": false,
				"type": "text"
		},
			{
				"hidden": false,
				"id": "text3208210259",
				"name": "description",
				"onCreate": true,
				"onUpdate": true,
				"presentable": false,
				"required": false,
				"system": false,
				"type": "text"
		},
			{
				"hidden": false,
				"id": "bool3208210260",
				"name": "completed",
				"onCreate": true,
				"onUpdate": true,
				"presentable": false,
				"required": false,
				"system": false,
				"type": "bool"
		},
			{
				"hidden": false,
				"id": "text3208210261",
				"name": "status",
				"onCreate": true,
				"onUpdate": true,
				"presentable": false,
				"required": false,
				"system": false,
				"type": "select",
				"options": {
					"values": [
						{
							"label": "To Do",
							"value": "todo"
					},
						{
							"label": "In Progress",
							"value": "in_progress"
					},
						{
							"label": "In Review",
							"value": "review"
					},
						{
							"label": "Completed",
							"value": "completed"
					}
				]
			},
			"validateSelect": {
				"values": []
			}
		},
			{
				"hidden": false,
				"id": "text3208210262",
				"name": "due_date",
				"onCreate": true,
				"onUpdate": true,
				"presentable": false,
				"required": false,
				"system": false,
				"type": "date"
		},
			{
				"hidden": false,
				"id": "text3208210263",
				"name": "priority",
				"onCreate": true,
				"onUpdate": true,
				"presentable": false,
				"required": false,
				"system": false,
				"type": "select",
				"options": {
					"values": [
						{
							"label": "Low",
							"value": "low"
					},
						{
							"label": "Medium",
							"value": "medium"
					},
						{
							"label": "High",
							"value": "high"
					}
				]
			},
			"validateSelect": {
				"values": []
			}
		}
		],
		"id": "pbc_3208210264",
		"indexes": [],
		"listRule": null,
		"name": "todo_items",
		"system": false,
		"type": "base",
		"updateRule": null,
		"viewRule": null
	}`

		collection := &core.Collection{}
		if err := json.Unmarshal([]byte(jsonData), &collection); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_3208210264")
		if err != nil {
			return err
		}

		return app.Delete(collection)
	})
}