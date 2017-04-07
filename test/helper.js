module.exports = {
  defineWidgetModel: defineWidgetModel,
  defineTrackerModel: defineTrackerModel,
  cleanup: cleanup
};

function defineWidgetModel(app) {
  return app.model('widget', {
    strict: true,
    properties: {
      id: {
        type: 'string',
        id: true,
        defaultFn: 'guid'
      },
      name: 'string',
      secret: 'string',
      description: 'string'
    },
    dataSource: 'mem'
  });
}

function defineTrackerModel(app) {
  return app.model('widgetAudit', {
    strict: true,
    properties: {
      id: {
        type: 'string',
        id: true,
        defaultFn: 'guid'
      },
      action: 'string',
      model_action: 'string',
      name: 'string',
      description: 'string',
      secret: 'string',
      modelId: 'string'
    },
    dataSource: 'mem'
  });
}

function cleanup(app) {
  return Promise.all([
    app.models.User.destroyAll(),
    app.models.AccessToken.destroyAll(),
    app.models.widget ? app.models.widget.destroyAll() : Promise.resolve(),
    app.models.remotable.destroyAll(),
  ])
  .then(function() {
    // needs to be separate to clean up the delete trackers
    return Promise.all([
      app.models.remotableHistory.destroyAll(),
      app.models.widgetAudit ? app.models.widgetAudit.destroyAll() : Promise.resolve()
    ]);
  });
}