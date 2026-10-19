package main

type FieldDef struct {
	Title       string
	Placeholder string
}

type Operation struct {
	Name        string
	Description string
	Fields      []FieldDef
	Category    string
}

func getOperations() []Operation {
	return []Operation{
		// Basic
		{
			Name:        "Get",
			Description: "Get value by key",
			Category:    "Basic",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. user:123"},
			},
		},
		{
			Name:        "Set",
			Description: "Set key-value pair",
			Category:    "Basic",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. user:123"},
				{Title: "Value", Placeholder: "e.g. John Doe"},
			},
		},
		{
			Name:        "Delete",
			Description: "Delete a key",
			Category:    "Basic",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. user:123"},
			},
		},
		{
			Name:        "Exists",
			Description: "Check if a key exists",
			Category:    "Basic",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. user:123"},
			},
		},
		// TTL
		{
			Name:        "SetTTL",
			Description: "Set time-to-live for a key",
			Category:    "TTL",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. user:123"},
				{Title: "TTL (seconds)", Placeholder: "e.g. 3600"},
			},
		},
		{
			Name:        "GetTTL",
			Description: "Get remaining TTL for a key",
			Category:    "TTL",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. user:123"},
			},
		},
		// Lists
		{
			Name:        "Push",
			Description: "Push value to end of list",
			Category:    "Lists",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. chat:room1"},
				{Title: "Value", Placeholder: "e.g. Hello everyone!"},
			},
		},
		{
			Name:        "PushBatch",
			Description: "Push multiple values to list with TTL",
			Category:    "Lists",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. chat:room1"},
				{Title: "Values (comma-separated)", Placeholder: "e.g. msg1,msg2,msg3"},
				{Title: "TTL (seconds)", Placeholder: "e.g. 259200"},
			},
		},
		{
			Name:        "Range",
			Description: "Get range of values from list",
			Category:    "Lists",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. chat:room1"},
				{Title: "Start", Placeholder: "e.g. 0"},
				{Title: "Stop", Placeholder: "e.g. -1 (all)"},
			},
		},
		// Hashes
		{
			Name:        "HSet",
			Description: "Set field in a hash",
			Category:    "Hashes",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. user:123"},
				{Title: "Field", Placeholder: "e.g. name"},
				{Title: "Value", Placeholder: "e.g. Alice"},
			},
		},
		{
			Name:        "HGet",
			Description: "Get field from a hash",
			Category:    "Hashes",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. user:123"},
				{Title: "Field", Placeholder: "e.g. name"},
			},
		},
		{
			Name:        "HGetAll",
			Description: "Get all fields from a hash",
			Category:    "Hashes",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. user:123"},
			},
		},
		{
			Name:        "HDel",
			Description: "Delete field from a hash",
			Category:    "Hashes",
			Fields: []FieldDef{
				{Title: "Key", Placeholder: "e.g. user:123"},
				{Title: "Field", Placeholder: "e.g. name"},
			},
		},
		// Pub/Sub
		{
			Name:        "Publish",
			Description: "Publish message to a channel",
			Category:    "Pub/Sub",
			Fields: []FieldDef{
				{Title: "Channel", Placeholder: "e.g. updates"},
				{Title: "Message", Placeholder: "e.g. New user signed up"},
			},
		},
		{
			Name:        "Subscribe",
			Description: "Subscribe to a channel (streaming)",
			Category:    "Pub/Sub",
			Fields: []FieldDef{
				{Title: "Channel", Placeholder: "e.g. updates"},
			},
		},
		// Health
		{
			Name:        "Health",
			Description: "Check server and Redis status",
			Category:    "Health",
			Fields:      nil,
		},
	}
}
