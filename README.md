# Model Change Mixin

## Usage

*Note*: This mixin attempts to make not assumption about how you have setup your models and will not setup any models or properties for you

### Installation

`npm install loopback-mixin-model-changes`

mode-config.json:

```json
{
  "_meta": {
    "mixins": [
      "../node_modules/loopback-mixin-model-changes"
    ]
  },
}
```

### Basic

Minimum configuration in mymodel.json

```json
{
  ...
  "mixins": {
    "ModelChanges": {
      "changeStreamModel": "myModelChanges",
      "idKeyName": "myModelId"
    }
  }
}
```

This will log all CUD operations to the model `myModelChanges` using the foreign key `myModelId` e.g.

### Default Behaviour

The default behavior is as follows:

1. Every model key will be recorded for every action
2. Updates will record the full new state of the model (not just the changes)
3. The property for the action name is called `'action'`

All of this can be customised (see below)

### Whitelist and Blacklist Properties

If you only wish to log changes to specific properties, put the property names in the `whitelist` array option:

```json
{
  "properties": {
    "name": "string",
    "description": "string"
  },
  "mixins": {
    "ModelChanges": {
      "changeStreamModel": "myModelChanges",
      "idKeyName": "myModelId",
      "whitelist": ["name"]
    }
  }
}
```

The above will only log modifications to the `"name"` property on `MyModel`

You can also blacklist if you prefer

```json
{
  "properties": {
    "name": "string",
    "secret": "string"
  },
  "mixins": {
    "ModelChanges": {
      "changeStreamModel": "myModelChanges",
      "idKeyName": "myModelId",
      "blacklist": ["secret"]
    }
  }
}
```

### Only Log Changes

The default behaviour logs the full model state for every update. If you would like to only store what changed, enable `deltas`:

```json
{
  ...
  "mixins": {
    "ModelChanges": {
      "changeStreamModel": "myModelChanges",
      "idKeyName": "myModelId",
      "deltas": true
    }
  }
}
```

In the above config, if you only change the `name` property in an `update`, no value for `description` would be stored in `myModelChanges`.

### Changing the Action Property

By default, the column used for the name of the logged action (`'create'`, `'update'` or `'delete'`) is `'action'`. Change this by passing `actionKey` to the config:

```json
{
  ...
  "mixins": {
    "ModelChanges": {
      "changeStreamModel": "myModelChanges",
      "idKeyName": "myModelId",
      "actionKey": "model_action"
    }
  }
}
```


# Dev

### Tests

`npm install && npm test`