'use strict';

var _ = require('lodash');
var Pushover = require('pushover-notifications');
var request = require('request');
var levels = require('../levels');
var times = require('../times');

function init (env) {
  // JIMRANDOMH: Expand this to the full set and comment them
  var pushover = {
    PRIORITY_SILENT: -2, // Don't generate a notification/alert
    PRIORITY_QUIET: -1, // Always send as a quiet notification
    PRIORITY_NORMAL: 0, // Normal pririty: Sound except during quiet hours
    PRIORITY_HIGH: 1, // Bypasses quiet hours
    PRIORITY_EMERGENCY: 2 // Bypasses quiet hours and requires confirmation
  };

  var pushoverAPI = setupPushover(env);

  function selectKeys (notify) {
    var keys = null;

    if (notify.isAnnouncement) {
      keys = pushoverAPI.announcementKeys;
    } else if (levels.isAlarm(notify.level)) {
      keys = pushoverAPI.alarmKeys;
    } else {
      keys = pushoverAPI.userKeys;
    }

    return keys;
  }

  pushover.send = function wrapSend (notify, callback) {
    var selectedKeys = selectKeys(notify);

    // JIMRANDOMH: Add this function
    function levelToPushoverPriority(level) {
      switch (level) {
        default:
        case levels.URGENT:
          return pushover.PRIORITY_EMERGENCY;
        case levels.WARN:
          return pushover.PRIORITY_HIGH;
        case levels.INFO:
          return pushover.PRIORITY_NORMAL;
        case levels.LOW:
          return pushover.PRIORITY_QUIET;
        case levels.LOWEST:
        case levels.NONE:
          return pushover.PRIORITY_SILENT;
      }
    }
    
    // JIMRANDOMH: Add this so plugins can override
    var expiryMinutes = 20;
    var retryTime = levels.isAlarm(notify.level) ? ((notify.level === levels.URGENT) ? 3 : 20);
    if ("expiry" in notify)
      expiryMinutes = notify.expiry;
    if ("retryTime" in notify)
      retryTime = notify.retryTime;
    
    function prepareMessage() {
      var msg = {
        expire: times.mins(expiryMinutes).secs
        , title: notify.title
        , message: notify.message
        , sound: notify.pushoverSound || 'gamelan'
        , timestamp: new Date()
        // JIMRANDOMH: Use levelToPushoverPriority
        , priority: levelToPushoverPriority(notify.level)
      };

      if (retryTime) {
        //ADJUST RETRY TIME based on WARN or URGENT
        msg.retry = times.mins(retryTime).secs;
        if (env.settings && env.settings.baseURL) {
          msg.callback = env.settings.baseURL + '/api/v1/notifications/pushovercallback';
        }
      }
      return msg;
    }

    if (selectedKeys.length === 0) {
      if (callback) {
        return callback('no-key-defined');
      }
    }

    var msg = prepareMessage();

    _.each(selectedKeys, function eachKey(key) {
      msg.user = key;
      pushover.sendAPIRequest(msg, callback);
    });

  };

  pushover.sendAPIRequest = function sendAPIRequest (msg, callback) {
    pushoverAPI.send(msg, function response (err, result) {
      if (err) {
        console.error('unable to send pushover notification', msg, err);
      } else {
        console.info('sent pushover notification: ', msg, 'result: ', result);
      }
      callback(err, result);
    });
  };

  pushover.cancelWithReceipt = function cancelWithReceipt (receipt, callback) {
    request
      .get('https://api.pushover.net/1/receipts/' + receipt + '/cancel.json?token=' + pushoverAPI.apiToken)
      .on('response', function (response) {
        callback(null, response);
      })
      .on('error', function (err) {
        callback(err);
      });
  };

  if (pushoverAPI) {
    console.info('Pushover is ready to push');
    return pushover;
  } else {
    console.info('Pushover was NOT configured');
    return null;
  }
}

function setupPushover (env) {
  var apiToken = env.extendedSettings && env.extendedSettings.pushover && env.extendedSettings.pushover.apiToken;

  function keysByType (type, fallback) {
    fallback = fallback || [];

    var key = env.extendedSettings && env.extendedSettings.pushover && env.extendedSettings.pushover[type];

    if (key === false) {
      return [];  //don't consider fallback, this type has been disabled
    } else if (key && key.split) {
      return key.split(' ') || fallback;
    } else {
      return fallback;
    }
  }

  var userKeys = keysByType('userKey', []);

  if (userKeys.length === 0) {
    userKeys = keysByType('groupKey') || [];
  }

  var alarmKeys = keysByType('alarmKey', userKeys);

  var announcementKeys = keysByType('announcementKey', userKeys || alarmKeys);

  if (apiToken && (userKeys.length > 0 || alarmKeys.length > 0 || announcementKeys.length > 0)) {
    var pushoverAPI = new Pushover({
      token: apiToken
    });

    pushoverAPI.apiToken = apiToken;
    pushoverAPI.userKeys = userKeys;
    pushoverAPI.alarmKeys = alarmKeys;
    pushoverAPI.announcementKeys = announcementKeys;

    return pushoverAPI;
  }
}


module.exports = init;