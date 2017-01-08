'use strict';

// Command regexp

var reCMD = /^\/([0-9а-я\w\d\_\-]+)/;

// Message types
var MESSAGE_TYPES = ['edit_date', 'text', 'audio', 'voice', 'document', 'photo', 'sticker', 'video', 'contact', 'location', 'venue', 'new_chat_member', 'left_chat_member', 'new_chat_title', 'new_chat_photo', 'delete_chat_photo', 'group_chat_created', 'supergroup_chat_created', 'channel_chat_created', 'migrate_to_chat_id', 'migrate_from_chat_id', 'pinned_message'];

var SHORTCUTS = {
  edit_date: 'edited',
  new_chat_member: 'userJoined',
  left_chat_member: 'userLeft',
  new_chat_title: 'newTitle',
  new_chat_photo: 'newPhoto',
  delete_chat_photo: 'deletePhoto',
  pinned_message: 'pinnedMessage',
  group_chat_created: 'groupCreated',
  channel_chat_created: 'channelCreated',
  supergroup_chat_created: 'supergroupCreated',
  migrate_to_chat_id: 'migrateTo',
  migrate_from_chat_id: 'migrateFrom'
};

// Update type functions
var updateFunctions = {

  // Message
  message: function message(update, props) {
    var _this = this;

    // Set promise
    var promise = Promise.resolve();

    // Run global message mod
    var mod = this.modRun('message', { msg: update, props: props });

    update = mod.msg;
    props = mod.props;

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = MESSAGE_TYPES[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var type = _step.value;


        // Check for Telegram API documented types
        if (!(type in update)) continue;

        // Shortcut
        if (SHORTCUTS[type]) type = SHORTCUTS[type];

        // Set message type
        props.type = type;

        // Run message type mod
        mod = this.modRun(type, { msg: update, props: props });

        update = mod.msg;
        props = mod.props;

        // Send type event
        promise = this.event(['*', type], update, props);

        // Check for command
        if (type == 'text') {
          var _ret = function () {

            var match = reCMD.exec(update.text);
            if (!match) return 'continue';

            // Command found
            props.type = 'command';
            promise = promise.then(function (x) {
              return _this.event(['/*', '/' + match[1]], update, props);
            });
          }();

          if (_ret === 'continue') continue;
        }

        return promise;
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
  },


  // Edited message
  edited_message: function edited_message(update, props) {
    return updateFunctions.message.call(this, update, props);
  },


  // Inline query
  inline_query: function inline_query(update, props) {
    props.type = 'inlineQuery';
    return this.event('inlineQuery', update, props);
  },


  // Inline choice
  chosen_inline_result: function chosen_inline_result(update, props) {
    props.type = 'inlineChoice';
    return this.event('inlineChoice', update, props);
  },


  // Callback query
  callback_query: function callback_query(update, props) {
    props.type = 'callbackQuery';
    return this.event('callbackQuery', update, props);
  }
};

module.exports = updateFunctions;