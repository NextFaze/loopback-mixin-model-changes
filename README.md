# Loopback Model Change Mixin

Inspired by [Loopback Auditz](https://github.com/jouke/loopback-auditz). Offers less functionality but more customization.

## Usage

*Note*: This mixin attempts to make not assumption about how you have setup your models and will not setup any models or properties for you

### Installation

`npm install loopback-ds-model-changes-mixin`

mode-config.json:

```json
{
  "_meta": {
    "mixins": [
      "../node_modules/loopback-ds-model-changes-mixin"
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
      "changeModel": "myModelChanges",
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
      "changeModel": "myModelChanges",
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
      "changeModel": "myModelChanges",
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
      "changeModel": "myModelChanges",
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
      "changeModel": "myModelChanges",
      "idKeyName": "myModelId",
      "actionKey": "model_action"
    }
  }
}
```


### Tracking user id

To track user id you will need to install [Loopback Component Remote Context](https://github.com/snowyu/loopback-component-remote-ctx.js) (requires Loopback 2.37+) and ensure that it is configured for any models you wish to track:

component-config.json

```json
  "loopback-component-remote-ctx": {
    "enabled": true,
    "whiteList": ["myModel"],
    "argName": "remoteCtx",
    "argName": "remoteCtx" // optional
  }
```

my-model.json

```json
  "mixins": {
    "ModelChanges": {
      // ...
      "trackUsersAs": "userId",
      "trackUsersFrom": "userId", //optional
      "remoteCtx": "remoteCtx" // optional
    }
  }
```

Where `trackUsersAs` signifies the property that you wish to use to store the `userId` on the tracking model, `trackUsersFrom` is the property on `accessToken` that stores the user id (default is `userId`) and `remoteCtx` is the custom
`argName` you specified for `loopback-component-remote-ctx` in `component-config.json` (defaults to `remoteCtx`).

# Dev

### Tests

`npm install && npm test`