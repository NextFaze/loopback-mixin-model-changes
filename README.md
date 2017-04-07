# Loopback Model Change Mixin

Inspired by [Loopback Auditz](https://github.com/jouke/loopback-auditz). Offers less functionality but more customization.

## Usage

*Note*: This mixin attempts to make not assumption about how you have setup your models and will not setup any models or properties for you. You must setup your tracking models yourself, either by extending the model they track or creating a new model with the properties you with to track on them.

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

Minimum configuration in mymodel.json (note the `myModelChanges` model must be configured and attached to your app manually)

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

### Tracking Date

The mixin does not track the timestamp of actions by default. This can be done easily by applying the `[https://www.npmjs.com/package/loopback-ds-timestamp-mixin](Loopback Timestamp Mixin) to your change tracking model or by adding a date property to your change model with `defaultFn: "now"`.

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


### Tracking User ID

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

### Tracking Remote Method

To track remote method names you will need to install [Loopback Component Remote Context](https://github.com/snowyu/loopback-component-remote-ctx.js) (requires Loopback 2.37+) and ensure that it is configured for any models you wish to track (See Tracking User Id for setup).

If you wish to track the remote method name used for actions, specify the `remoteMethod` property in your model config:

```json
  "mixins": {
    "ModelChanges": {
      // ...
      "remoteMethod": "remoteMethod"
    }
  }
```

This will store the remote method name in the `remoteMethod` property of your tracking model. You can also specify if you _only_ watch to track actions that come from remote methods:

```json
  "mixins": {
    "ModelChanges": {
      // ...
      "remoteMethod": "remoteMethod",
      "remoteOnly": true"
    }
  }
```

### Custom Action Names

By default, the actions are stored as 'create', 'update' and 'delete. These can be customised with the mixin properties `createActionName`, `updateActionName` and `deleteActionName`

# Dev

### Tests

`npm install && npm test`