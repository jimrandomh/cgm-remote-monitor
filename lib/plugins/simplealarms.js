'use strict';

var levels = require('../levels');
var times = require('../times');

function init() {

  var simplealarms = {
    name: 'simplealarms'
    , label: 'Simple Alarms'
    , pluginType: 'notification'
  };

  simplealarms.checkNotifications = function checkNotifications(sbx) {
    var lastSGVEntry = sbx.lastSGVEntry()
      , scaledSGV = sbx.scaleEntry(lastSGVEntry)
      ;


    if (scaledSGV && lastSGVEntry && lastSGVEntry.mgdl > 39 && sbx.time - lastSGVEntry.mills < times.mins(10).msecs) {
      var result = simplealarms.compareBGToTresholds(scaledSGV, sbx);
      if (result && result.level && result.level !== levels.NONE) {
        console.log("In simplealarms, sending notification");
        sbx.notifications.requestNotify({
          level: result.level
          , title: result.title
          , message: sbx.buildDefaultMessage()
          , eventName: result.eventName
          , plugin: simplealarms
          , pushoverSound: result.pushoverSound
          , expiry: result.expiry
          , retryTime: result.retryTime
          , debug: {
            lastSGV: scaledSGV, thresholds: sbx.settings.thresholds
          }
        });
      }
    }
  };

  simplealarms.compareBGToTresholds = function compareBGToTresholds(scaledSGV, sbx) {
    console.log("simplealarms checking whether to alarm at: "+scaledSGV);
    var result = { level: levels.NONE };
    
    // JIMRANDOMH: Mostly rewrote this function, with the thresholds and
    // priority levels I want hardcoded.

    if (scaledSGV > 350) {
      return {
        level: levels.URGENT,
        title: 'Urgent, HIGH: '+scaledSGV,
        pushoverSound: 'persistent',
        eventName: 'high',
        expiry: 30,
        retryTime: 5,
      }
    } else if (scaledSGV > 270) {
      return {
        level: levels.WARN,
        title: 'Warning, HIGH: '+scaledSGV,
        pushoverSound: 'persistent',
        eventName: 'high',
        expiry: 30,
        retryTime: 5,
      }
    } else if (scaledSGV > 180) {
      return {
        level: levels.INFO,
        title: 'Warning, HIGH: '+scaledSGV,
        pushoverSound: 'climb',
        eventName: 'high',
        expiry: 30,
        retryTime: 15,
      }
    } else if (scaledSGV < 80) {
      return {
        level: levels.WARN,
        title: 'Warning, LOW: '+scaledSGV,
        pushoverSound: 'persistent',
        eventName: 'low',
        expiry: 30,
        retryTime: 15,
      }
    } else if (scaledSGV < 65) {
      return {
        level: levels.URGENT,
        title: 'Urgent, LOW: '+scaledSGV,
        pushoverSound: 'falling',
        eventName: 'low',
        retryTime: 2,
      }
    }
    return result;
  };

  return simplealarms;

}

module.exports = init;
