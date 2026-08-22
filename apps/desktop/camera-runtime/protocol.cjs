/**
 * Canon Camera Runtime Protocol & Constants
 * Defines message types, state machine constants, and payload validators.
 */

const COMMANDS = {
  INITIALIZE: 'camera.initialize',
  ENUMERATE: 'camera.enumerate',
  OPEN: 'camera.open',
  STATUS: 'camera.status',
  LIVEVIEW_START: 'camera.liveview.start',
  LIVEVIEW_STOP: 'camera.liveview.stop',
  CAPTURE: 'camera.capture',
  AUTOFOCUS: 'camera.autofocus',
  AUTOFOCUS_STOP: 'camera.autofocus.stop',
  RECONNECT: 'camera.reconnect',
  RECOVER_EVF: 'camera.recover.evf',
  RECOVER_SESSION: 'camera.recover.session',
  RECOVER_BRIDGE: 'camera.recover.bridge',
  SHUTDOWN: 'camera.shutdown',
};

const EVENTS = {
  RUNTIME_READY: 'camera.runtime.ready',
  INITIALIZED: 'camera.initialized',
  DISCOVERED: 'camera.discovered',
  SESSION_OPENED: 'camera.session.opened',
  LIVEVIEW_STARTED: 'camera.liveview.started',
  LIVEVIEW_FRAME: 'camera.liveview.frame',
  LIVEVIEW_STOPPED: 'camera.liveview.stopped',
  LIVEVIEW_RESUMED: 'camera.liveview.resumed',
  AUTOFOCUS_STARTED: 'camera.autofocus.started',
  AUTOFOCUS_COMPLETED: 'camera.autofocus.completed',
  CAPTURE_STARTED: 'camera.capture.started',
  SHUTTER: 'camera.shutter',
  OBJECT_CREATED: 'camera.object.created',
  DOWNLOAD_STARTED: 'camera.download.started',
  DOWNLOAD_COMPLETED: 'camera.download.completed',
  DISCONNECTED: 'camera.disconnected',
  RECOVERING: 'camera.recovering',
  ERROR: 'camera.error',
  STATE_CHANGED: 'camera.state.changed',
};

const STATES = {
  DISCONNECTED: 'DISCONNECTED',
  INITIALIZING: 'INITIALIZING',
  ENUMERATING: 'ENUMERATING',
  DISCOVERY_WAIT: 'DISCOVERY_WAIT',
  CAMERA_NOT_FOUND: 'CAMERA_NOT_FOUND',
  OPENING_SESSION: 'OPENING_SESSION',
  CONFIGURING: 'CONFIGURING',
  READY: 'READY',
  STARTING_LIVEVIEW: 'STARTING_LIVEVIEW',
  LIVEVIEW: 'LIVEVIEW',
  CAPTURING: 'CAPTURING',
  DOWNLOADING: 'DOWNLOADING',
  RESUMING_LIVEVIEW: 'RESUMING_LIVEVIEW',
  LIVEVIEW_STALLED: 'LIVEVIEW_STALLED',
  LIVEVIEW_RECOVERING: 'LIVEVIEW_RECOVERING',
  RECOVERING: 'RECOVERING',
  CAMERA_PTP_UNRESPONSIVE: 'CAMERA_PTP_UNRESPONSIVE',
  ERROR: 'ERROR',
};

function createMessage(type, payload = {}) {
  return {
    type,
    provider: 'canon',
    timestamp: new Date().toISOString(),
    ...payload,
  };
}

module.exports = {
  COMMANDS,
  EVENTS,
  STATES,
  createMessage,
};
