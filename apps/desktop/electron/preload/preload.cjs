const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('momentai', {
  guest: {
    session: {
      getReadiness: () => invoke('cameraos:guest:readiness:get'),
      create: (eventId) => invoke('cameraos:guest:session:start', eventId),
      get: (sessionId) => invoke('cameraos:guest:session:get', sessionId),
      dispatch: (event) => Promise.resolve({ ok: false, error: 'DISPATCH_NOT_BOUND', event }),
      listCaptureFormats: () => invoke('cameraos:guest:capture-formats:list'),
      selectFormat: (sessionId, formatId) => invoke('cameraos:guest:format:select', sessionId, formatId),
      addPhoto: (sessionId, photo) => invoke('cameraos:guest:photo:add', sessionId, photo),
      listTemplates: (eventId, captureFormatId) => invoke('cameraos:guest:templates:list', eventId, captureFormatId),
      selectTemplate: (sessionId, templateId) => invoke('cameraos:guest:template:select', sessionId, templateId),
      saveCustomization: (sessionId, customization) => invoke('cameraos:guest:customization:save', sessionId, customization),
      compose: (sessionId) => invoke('cameraos:guest:compose', sessionId),
      requestPrint: (sessionId, copies) => invoke('cameraos:guest:print:request', sessionId, copies),
      complete: (sessionId) => invoke('cameraos:guest:complete', sessionId),
    },
    camera: {
      status: () => invoke('cameraos:camera:status'),
      capture: (context) => invoke('cameraos:camera:capture', context),
      autofocus: (context) => invoke('cameraos:camera:autofocus', context),
      startLiveView: (context) => invoke('cameraos:camera:liveview:start', context),
      stopLiveView: (context) => invoke('cameraos:camera:liveview:stop', context),
      startRecording: (context) => invoke('cameraos:camera:recording:start', context),
      stopRecording: (context) => invoke('cameraos:camera:recording:stop', context),
      onEvfFrame: (callback) => {
        const handler = (_event, frame) => callback(frame);
        ipcRenderer.on('cameraos:camera:evf:frame', handler);
        return () => ipcRenderer.removeListener('cameraos:camera:evf:frame', handler);
      },
    },
    storage: {
      health: () => invoke('cameraos:storage:health'),
      createSession: (sessionId) => invoke('cameraos:storage:session:create', sessionId),
      saveOriginal: (sessionId, shotIndex, photo) => invoke('cameraos:storage:original:save', sessionId, shotIndex, photo),
      saveOutput: (sessionId, type, file) => invoke('cameraos:storage:output:save', sessionId, type, file),
    },
    printer: {
      status: (printerId) => invoke('cameraos:printer:status', printerId),
    },
    
  },
  admin: {
    auth: {
      unlock: (passcode) => invoke('cameraos:admin:auth:unlock', passcode),
      lock: (token) => invoke('cameraos:admin:auth:lock', token),
      verify: (token) => invoke('cameraos:admin:auth:verify', token),
    },
    events: {
      list: () => invoke('cameraos:admin:events:list'),
      create: (name) => invoke('cameraos:admin:events:create', name),
    },
    templates: {
      list: (eventId) => invoke('cameraos:admin:templates:list', eventId),
      publish: (templateId, eventId) => invoke('cameraos:admin:templates:publish', templateId, eventId),
      archive: (templateId, eventId) => invoke('cameraos:admin:templates:archive', templateId, eventId),
      save: (eventId, frame) => invoke('cameraos:admin:templates:save', eventId, frame),
      remove: (eventId, templateId) => invoke('cameraos:admin:templates:remove', eventId, templateId),
      clear: (eventId) => invoke('cameraos:admin:templates:clear', eventId),
    },
    health: {
      snapshot: () => invoke('cameraos:admin:health:snapshot'),
    },
    cleanup: {
      summary: () => invoke('cameraos:admin:cleanup:summary'),
      runNow: () => invoke('cameraos:admin:cleanup:run-now'),
    },
    logs: {
      tail: (limit) => invoke('cameraos:admin:logs:tail', limit),
    },
  },
});
