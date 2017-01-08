'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _request = require('request'),
    webhook = require('./webhook.js'),
    standardUpdates = require('./updates.js'),
    standardMethods = require('./methods.js');

/* Telegram Bot */

var TeleBot = function () {
  function TeleBot(cfg) {
    var _this = this;

    _classCallCheck(this, TeleBot);

    if ((typeof cfg === 'undefined' ? 'undefined' : _typeof(cfg)) != 'object') cfg = { token: cfg };

    if (!cfg.token || cfg.token.split(':').length != 2) {
      throw Error('[bot.error] invalid bot token');
    }

    this.cfg = cfg;
    this.token = cfg.token;
    this.id = this.token.split(':')[0];
    this.api = 'https://api.telegram.org/bot' + this.token;
    this.fileLink = 'https://api.telegram.org/file/bot' + this.token + '/';

    var poll = cfg.polling;

    // Migration
    if (!poll) {
      if (cfg.pooling) {
        poll = cfg.pooling;
        console.warn('[bot.warning] use "polling" option instead of "pooling"!');
      } else {
        poll = {};
        // Set cfg.polling
        var _arr = ['limit', 'timeout', 'retryTimeout'];
        for (var _i = 0; _i < _arr.length; _i++) {
          var name = _arr[_i];
          poll[name] = cfg[name];
        }
        // cfg.sleep renamed to cfg.polling.interval
        poll.interval = cfg.sleep;
      }
    }

    this.limit = poll.limit > 0 && poll.limit <= 100 ? poll.limit : 100;
    this.interval = poll.interval >= 0 ? poll.interval : 1000;
    this.timeout = poll.timeout >= 0 ? poll.timeout : 0;
    this.retryTimeout = poll.retryTimeout >= 0 ? poll.retryTimeout : 5000;

    this.webhook = cfg.webhook;

    this.updateId = 0;
    this.loopFn = null;

    this.flags = {
      poll: false,
      retry: false,
      looping: false
    };

    this.modList = {};
    this.eventList = {};

    this.updateTypes = standardUpdates;

    this.processUpdate = function (update, props) {
      for (var _name in _this.updateTypes) {
        if (_name in update) {
          update = update[_name];
          return _this.updateTypes[_name].call(_this, update, props);
        }
      }
    };
  }

  /* Modules */

  _createClass(TeleBot, [{
    key: 'use',
    value: function use(fn) {
      return fn.call(this, this, this.cfg.modules);
    }

    /* Connection */

  }, {
    key: 'connect',
    value: function connect() {
      var _this2 = this;

      var f = this.flags;

      // Set webhook
      if (this.webhook) {
        var _ret = function () {
          var _webhook = _this2.webhook,
              url = _webhook.url,
              cert = _webhook.cert;

          if (url) url = url + '/' + _this2.token;
          return {
            v: _this2.setWebhook(url, cert).then(function (x) {
              console.log('[bot.webhook] set to "' + url + '"');
              return webhook.call(_this2, _this2, _this2.webhook);
            }).catch(function (error) {
              console.error('[bot.error.webhook]', error);
              _this2.event('error', { error: error });
              return;
            })
          };
        }();

        if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
      }

      // Delete webhook
      this.setWebhook().then(function (data) {
        f.poll = true;
        if (data.description == 'Webhook was deleted') console.log('[bot.webhook] webhook was deleted');
        console.log('[bot.info] bot started');
      }).catch(function (error) {
        console.error('[bot.error.webhook]', error);
        _this2.event('error', { error: error });
        return;
      });

      f.looping = true;

      this.event('connect');

      // Global loop function
      this.loopFn = setInterval(function (x) {

        // Stop on false looping flag
        if (!f.looping) clearInterval(_this2.loopFn);

        // Skip processing on false poll flag
        if (!f.poll) return;

        f.poll = false;

        // Get updates
        _this2.getUpdates().then(function (x) {

          // Retry connecting
          if (f.retry) {

            var now = Date.now();
            var diff = (now - f.retry) / 1000;

            console.log('[bot.info.update] reconnected after ' + diff + ' seconds');
            _this2.event('reconnected', {
              startTime: f.retry, endTime: now, diffTime: diff
            });

            f.retry = false;
          }

          // Tick
          return _this2.event('tick');
        }).then(function (x) {

          // Seems okay for the next poll
          f.poll = true;
        }).catch(function (error) {

          // Set retry flag as current date (for timeout calculations)
          if (f.retry === false) f.retry = Date.now();

          console.error('[bot.error.update]', error.stack || error);
          _this2.event(['error', 'error.update'], { error: error });

          return Promise.reject();
        }).catch(function (x) {

          var seconds = _this2.retryTimeout / 1000;
          console.log('[bot.info.update] reconnecting in ' + seconds + ' seconds...');
          _this2.event('reconnecting');

          // Set reconnecting timeout
          setTimeout(function (x) {
            return f.poll = true;
          }, _this2.retryTimeout);
        });
      }, this.interval);
    }

    /* Stop looping */

  }, {
    key: 'disconnect',
    value: function disconnect(message) {
      this.flags.looping = false;
      console.log('[bot.info] bot disconnected ' + (message ? ': ' + message : ''));
      this.event('disconnect', message);
    }

    /* Fetch updates */

  }, {
    key: 'getUpdates',
    value: function getUpdates() {
      var offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : this.updateId;

      var _this3 = this;

      var limit = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : this.limit;
      var timeout = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : this.timeout;


      // Request updates from Telegram server
      return this.request('/getUpdates', {
        offset: offset, limit: limit, timeout: timeout
      }).then(function (body) {
        return _this3.receiveUpdates(body.result);
      });
    }

    /* Recive updates */

  }, {
    key: 'receiveUpdates',
    value: function receiveUpdates(updateList) {
      var _this4 = this;

      // Globals
      var mod,
          props = {},
          promise = Promise.resolve();

      // No updates
      if (!updateList.length) return promise;

      // We have updates
      return this.event('update', updateList).then(function (eventProps) {

        // Run update list modifiers
        mod = _this4.modRun('updateList', {
          list: updateList,
          props: extendProps(props, eventProps)
        });

        updateList = mod.list;
        props = mod.props;

        // Every Telegram update
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          var _loop = function _loop() {
            var update = _step.value;


            // Update ID
            var nextId = ++update.update_id;
            if (_this4.updateId < nextId) _this4.updateId = nextId;

            // Run update modifiers
            mod = _this4.modRun('update', { update: update, props: props });

            update = mod.update;
            props = mod.props;

            // Process update
            promise = promise.then(function (x) {
              return _this4.processUpdate(update, props);
            });
          };

          for (var _iterator = updateList[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            _loop();
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        return promise;
      }).catch(function (error) {

        console.log('[bot.error]', error.stack || error);
        _this4.event('error', { error: error });

        // Don't trigger server reconnect
        return Promise.resolve();
      });
    }

    /* Send request to server */

  }, {
    key: 'request',
    value: function request(url, form, data) {
      var options = { url: this.api + url, json: true };
      if (form) {
        options.form = form;
      } else {
        for (var item in data) {
          var type = _typeof(data[item]);
          if (type == 'string' || type == 'object') continue;
          data[item] = JSON.stringify(data[item]);
        }
        options.formData = data;
      };
      return new Promise(function (resolve, reject) {
        _request.post(options, function (error, response, body) {
          if (error || !body.ok || response.statusCode == 404) {
            return reject(error || body || 404);
          }
          return resolve(body);
        });
      });
    }

    /* Modifications */

  }, {
    key: 'mod',
    value: function mod(names, fn) {
      if (typeof names == 'string') names = [names];
      var mods = this.modList;
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = names[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var name = _step2.value;

          if (!mods[name]) mods[name] = [];
          if (mods[name].includes(fn)) return;
          mods[name].push(fn);
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      return fn;
    }
  }, {
    key: 'modRun',
    value: function modRun(name, data) {
      var list = this.modList[name];
      if (!list || !list.length) return data;
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = list[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var fn = _step3.value;
          data = fn.call(this, data);
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }

      return data;
    }
  }, {
    key: 'removeMod',
    value: function removeMod(name, fn) {
      var list = this.modList[name];
      if (!list) return false;
      var index = list.indexOf(fn);
      if (index == -1) return false;
      list.splice(index, 1);
      return true;
    }

    /* Events */

  }, {
    key: 'on',
    value: function on(types, fn, opt) {
      var _this5 = this;

      if (!opt) opt = {};
      if (typeof types == 'string') types = [types];
      var _iteratorNormalCompletion4 = true;
      var _didIteratorError4 = false;
      var _iteratorError4 = undefined;

      try {
        var _loop2 = function _loop2() {
          var type = _step4.value;

          var event = _this5.eventList[type];
          if (!event) {
            _this5.eventList[type] = { fired: null, list: [fn] };
          } else {
            if (event.list.includes(fn)) return 'continue';
            event.list.push(fn);
            if (opt.fired && event.fired) {
              (function () {
                var fired = event.fired;
                new Promise(function (resolve, reject) {
                  var output = fn.call(fired.self, fired.data, fired.self, fired.details);
                  if (output instanceof Promise) output.then(resolve).catch(reject);else resolve(output);
                }).catch(function (error) {
                  eventPromiseError.call(_this5, type, fired, error);
                });
                if (opt.cleanFired) _this5.eventList[type].fired = null;
              })();
            }
          }
        };

        for (var _iterator4 = types[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
          var _ret3 = _loop2();

          if (_ret3 === 'continue') continue;
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion4 && _iterator4.return) {
            _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    }
  }, {
    key: 'event',
    value: function event(types, data, self) {
      var _this6 = this;

      var promises = [];
      if (typeof types == 'string') types = [types];
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        var _loop3 = function _loop3() {
          var type = _step5.value;

          var event = _this6.eventList[type];
          var details = { type: type, time: Date.now() };
          var fired = { self: self, data: data, details: details };
          if (!event) {
            _this6.eventList[type] = { fired: fired, list: [] };
            return 'continue';
          }
          event.fired = fired;
          event = event.list;
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;
          var _iteratorError6 = undefined;

          try {
            var _loop4 = function _loop4() {
              var fn = _step6.value;

              promises.push(new Promise(function (resolve, reject) {
                var that = _this6;
                details.remove = function (fn) {
                  return function (x) {
                    return that.removeEvent(type, fn);
                  };
                }(fn);
                fn = fn.call(self, data, self, details);
                if (fn instanceof Promise) {
                  fn.then(resolve).catch(reject);
                } else {
                  resolve(fn);
                }
              }).catch(function (error) {
                eventPromiseError.call(_this6, type, fired, error);
              }));
            };

            for (var _iterator6 = event[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
              _loop4();
            }
          } catch (err) {
            _didIteratorError6 = true;
            _iteratorError6 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion6 && _iterator6.return) {
                _iterator6.return();
              }
            } finally {
              if (_didIteratorError6) {
                throw _iteratorError6;
              }
            }
          }
        };

        for (var _iterator5 = types[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var _ret5 = _loop3();

          if (_ret5 === 'continue') continue;
        }
      } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion5 && _iterator5.return) {
            _iterator5.return();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }

      return Promise.all(promises);
    }
  }, {
    key: 'cleanEvent',
    value: function cleanEvent(type) {
      var events = this.eventList;
      if (!events.hasOwnProperty(type)) return false;
      events[type].fired = null;
      return true;
    }
  }, {
    key: 'removeEvent',
    value: function removeEvent(type, fn) {
      var events = this.eventList;
      if (!events.hasOwnProperty(type)) return false;
      var event = events[type].list;
      var index = event.indexOf(fn);
      if (index == -1) return false;
      event.splice(index, 1);
      return true;
    }
  }, {
    key: 'destroyEvent',
    value: function destroyEvent(type) {
      var events = this.eventList;
      if (!events.hasOwnProperty(type)) return false;
      delete events[type];
      return true;
    }

    /* Process global properties */

  }, {
    key: 'properties',
    value: function properties() {
      var form = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};


      // Reply to message
      if (opt.reply) form.reply_to_message_id = opt.reply;

      // Markdown/HTML support for message
      if (opt.parse) form.parse_mode = opt.parse;

      // User notification
      if (opt.notify === false) form.disable_notification = true;

      // Web preview
      if (opt.preview === false) form.disable_web_page_preview = true;

      // Markup object
      if (opt.markup !== undefined) {
        if (opt.markup == 'hide' || opt.markup === false) {
          // Hide keyboard
          form.reply_markup = JSON.stringify({ hide_keyboard: true });
        } else if (opt.markup == 'reply') {
          // Fore reply
          form.reply_markup = JSON.stringify({ force_reply: true });
        } else {
          // JSON keyboard
          form.reply_markup = opt.markup;
        }
      }

      return this.modRun('property', { form: form, options: opt }).form;
    }

    /* Method adder */

  }], [{
    key: 'addMethods',
    value: function addMethods(methods) {
      var _this7 = this;

      var _loop5 = function _loop5(id) {

        var method = methods[id];

        // If method is a function
        if (typeof method == 'function') {
          _this7.prototype[id] = method;
          return 'continue';
        }

        // Set method name
        var name = method.short || id;

        // Argument function
        var argFn = method.arguments;
        if (argFn && typeof argFn != 'function') {
          (function () {
            if (typeof argFn == 'string') argFn = [argFn];
            var args = argFn;
            argFn = function argFn() {
              var _arguments = arguments;

              var form = {};
              args.forEach(function (v, i) {
                return form[v] = _arguments[i];
              });
              return form;
            };
          })();
        }

        // Options function
        var optFn = method.options;

        // Create method
        _this7.prototype[name] = function () {
          this.event(name, arguments);
          var form = {},
              args = [].slice.call(arguments);
          var options = args[args.length - 1];
          if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) != 'object') options = {};
          if (argFn) form = argFn.apply(this, args);
          if (optFn) options = optFn.apply(this, [].concat(form, options));
          form = this.properties(form, options);
          var request = this.request('/' + id, form);
          if (method.then) request = request.then(method.then);
          return request;
        };
      };

      for (var id in methods) {
        var _ret7 = _loop5(id);

        if (_ret7 === 'continue') continue;
      }
    }
  }]);

  return TeleBot;
}();

;

/* Add standard methods */

TeleBot.addMethods(standardMethods);

/* Functions */

function eventPromiseError(type, fired, error) {
  var _this8 = this;

  return new Promise(function (resolve, reject) {
    console.error('[bot.error.event]', error.stack || error);
    if (type != 'error' && type != 'error.event') {
      _this8.event(['error', 'error.event'], { error: error, data: fired.data }).then(resolve).catch(reject);
    } else {
      resolve();
    }
  });
}

function extendProps(props, input) {
  var _iteratorNormalCompletion7 = true;
  var _didIteratorError7 = false;
  var _iteratorError7 = undefined;

  try {
    for (var _iterator7 = input[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
      var obj = _step7.value;

      for (var naprops in obj) {
        var key = props[naprops],
            value = obj[naprops];
        if (key !== undefined) {
          if (!Array.isArray(key)) props[naprops] = [key];
          props[naprops].push(value);
          continue;
        }
        props[naprops] = value;
      }
    }
  } catch (err) {
    _didIteratorError7 = true;
    _iteratorError7 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion7 && _iterator7.return) {
        _iterator7.return();
      }
    } finally {
      if (_didIteratorError7) {
        throw _iteratorError7;
      }
    }
  }

  return props;
}

/* Exports */

module.exports = TeleBot;