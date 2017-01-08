'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var fs = require('fs'),
    nurl = require('url'),
    path = require('path'),
    stream = require('stream'),
    request = require('request');

var ANSWER_METHODS = {
  addArticle: 'article', addPhoto: 'photo', addVideo: 'video',
  addGif: 'gif', addVideoGif: 'mpeg4_gif', addSticker: 'sticker',
  addVoice: 'voice', addDocument: 'document', addLocation: 'location',
  addVenue: 'venue',
  // Cached methods
  cachedPhoto: 'photo', cachedGif: 'gif', cachedVideoGif: 'mpeg4_gif',
  cachedSticker: 'sticker', cachedDocument: 'document', cachedVideo: 'video',
  cachedVoice: 'voice', cachedAudio: 'audio'
};

var DEFAULT_FILE_EXTS = {
  photo: 'jpg', audio: 'mp3', 'document': 'doc',
  sticker: 'webp', voice: 'm4a', 'video': 'mp4'
};

var reURL = /^https?\:\/\/|www\./;

// Methods
var methods = {
  keyboard: function keyboard(_keyboard) {
    var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var markup = { keyboard: _keyboard };
    if (opt.resize === true) markup['resize_keyboard'] = true;
    if (opt.once === true) markup['one_time_keyboard'] = true;
    if (opt.selective) markup['selective'] = opt.selective;
    return JSON.stringify(markup);
  },
  button: function button(type, text) {
    if (!text && type) return { text: type };
    type = 'request_' + type;
    return _defineProperty({ text: text }, type, true);
  },
  inlineKeyboard: function inlineKeyboard(inline_keyboard) {
    return JSON.stringify({ inline_keyboard: inline_keyboard });
  },
  inlineQueryKeyboard: function inlineQueryKeyboard(inline_keyboard) {
    return { inline_keyboard: inline_keyboard };
  },
  inlineButton: function inlineButton(text) {
    var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var markup = { text: text };
    if (opt.url) markup.url = opt.url;
    if (opt.inline || opt.inline === '') markup.switch_inline_query = opt.inline;
    if (opt.callback) markup.callback_data = String(opt.callback);
    return markup;
  },
  answerList: function answerList(id, opt) {
    return new AnswerList(id, opt);
  },


  getMe: {
    then: function then(data) {
      return data.result;
    }
  },

  sendMessage: {
    arguments: ['chat_id', 'text']
  },

  forwardMessage: {
    arguments: ['chat_id', 'from_chat_id', 'message_id']
  },

  sendPhoto: function sendPhoto(id, photo, opt) {
    return sendFile.call(this, 'photo', id, photo, opt);
  },
  sendAudio: function sendAudio(id, audio, opt) {
    return sendFile.call(this, 'audio', id, audio, opt);
  },
  sendDocument: function sendDocument(id, doc, opt) {
    return sendFile.call(this, 'document', id, doc, opt);
  },
  sendSticker: function sendSticker(id, sticker, opt) {
    return sendFile.call(this, 'sticker', id, sticker, opt);
  },
  sendVideo: function sendVideo(id, video, opt) {
    return sendFile.call(this, 'video', id, video, opt);
  },
  sendVoice: function sendVoice(id, voice, opt) {
    return sendFile.call(this, 'voice', id, voice, opt);
  },


  sendLocation: {
    arguments: function _arguments(chat_id, position) {
      return {
        chat_id: chat_id, latitude: position[0], longitude: position[1]
      };
    }
  },

  sendVenue: {
    arguments: function _arguments(chat_id, position, title, address) {
      return {
        chat_id: chat_id, latitude: position[0], longitude: position[1], title: title, address: address
      };
    },
    options: function options(form, opt) {
      if (opt.foursquare) form.foursquare_id = opt.foursquare;
      return form;
    }
  },

  sendContact: {
    arguments: ['chat_id', 'phone_number', 'first_name', 'last_name']
  },

  sendChatAction: {
    short: 'sendAction',
    arguments: ['chat_id', 'action']
  },

  getUserProfilePhotos: {
    short: 'getUserPhoto',
    arguments: 'chat_id',
    options: function options(form, opt) {
      if (opt.offset) form.offset = opt.offset;
      if (opt.limit) form.limit = opt.limit;
      return form;
    }
  },

  getFile: {
    arguments: 'file_id',
    then: function then(file) {
      var result = file.result;
      result.fileLink = undefined.fileLink + result.file_path;
      return result;
    }
  },

  getChat: {
    arguments: ['chat_id']
  },

  leaveChat: {
    arguments: ['chat_id']
  },

  getChatAdministrators: {
    short: 'getAdmins',
    arguments: ['chat_id']
  },

  getChatMember: {
    short: 'getMember',
    arguments: ['chat_id', 'user_id']
  },

  getChatMembersCount: {
    short: 'countMembers',
    arguments: ['chat_id']
  },

  kickChatMember: {
    short: 'kick',
    arguments: ['chat_id', 'user_id']
  },

  unbanChatMember: {
    short: 'unban',
    arguments: ['chat_id', 'user_id']
  },

  answerInlineQuery: {
    short: 'answerQuery',
    arguments: function _arguments(answers) {
      return {
        inline_query_id: answers.id,
        results: answers.results(),
        next_offset: answers.nextOffset,
        is_personal: answers.personal,
        cache_time: answers.cacheTime
      };
    }
  },

  answerCallbackQuery: {
    short: 'answerCallback',
    arguments: ['callback_query_id', 'text', 'show_alert']
  },

  editMessageText: {
    short: 'editText',
    arguments: function _arguments(obj, text) {
      return editObject(obj, { text: text });
    }
  },

  editMessageCaption: {
    short: 'editCaption',
    arguments: function _arguments(obj, caption) {
      return editObject(obj, { caption: caption });
    }
  },

  editMessageReplyMarkup: {
    short: 'editMarkup',
    arguments: function _arguments(obj, reply_markup) {
      return editObject(obj, { reply_markup: reply_markup });
    }
  },

  setWebhook: function setWebhook(url, certificate) {
    if (certificate) {
      var form = {
        url: url,
        certificate: {
          value: fs.readFileSync(certificate),
          options: { filename: 'cert.pem' }
        }
      };
      return this.request('/setWebhook', null, form);
    }
    return this.request('/setWebhook', { url: url });
  },


  getWebhookInfo: {
    then: function then(data) {
      return data.result;
    }
  }

};

// Functions

function editObject(obj, form) {
  if (obj.chatId && obj.messageId) {
    form.chat_id = obj.chatId;
    form.message_id = obj.messageId;
  } else if (obj.inlineMsgId) {
    form.inline_message_id = obj.inlineMsgId;
  }
  return form;
}

function sendFile(type, chat_id, file) {
  var opt = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};


  var form = this.properties({ chat_id: chat_id }, opt);
  var defName = 'file.' + DEFAULT_FILE_EXTS[type];

  var url = 'send' + type.charAt(0).toUpperCase() + type.slice(1);

  // Send bot action event
  this.event(url, [].slice.call(arguments).splice(0, 1));

  // Set file caption
  if (opt.caption) form.caption = opt.caption;

  if (file instanceof stream.Stream) {
    // File stream object
    if (!opt.fileName) opt.fileName = nurl.parse(path.basename(file.path)).pathname;
    form[type] = {
      value: file,
      options: { filename: opt.fileName }
    };
  } else if (Buffer.isBuffer(file)) {
    // File buffer
    if (!opt.fileName) opt.fileName = defName;
    form[type] = {
      value: file,
      options: { filename: opt.fileName }
    };
  } else if (reURL.test(file)) {
    // File url
    if (!opt.fileName) opt.fileName = path.basename(nurl.parse(file).pathname) || defName;
    form[type] = {
      value: request.get(file),
      options: { filename: opt.fileName }
    };
  } else if (fs.existsSync(file)) {
    // File location
    if (!opt.fileName) opt.fileName = path.basename(file);
    form[type] = {
      value: fs.createReadStream(file),
      options: { filename: opt.fileName }
    };
  } else {
    // File as 'file_id'
    form[type] = file;
  }

  return this.request('/' + url, null, form);
}

/* Answer List */

var AnswerList = function () {
  function AnswerList(id) {
    var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, AnswerList);

    this.id = id;
    this.cacheTime = Number(opt.cacheTime) || 300;
    this.nextOffset = opt.nextOffset === undefined ? null : opt.nextOffset;
    this.personal = opt.personal === undefined ? false : opt.personal;
    this.list = [];
  }

  _createClass(AnswerList, [{
    key: 'add',
    value: function add(type) {
      var set = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      set.type = type;
      this.list.push(set);
      return set;
    }
  }, {
    key: 'results',
    value: function results() {
      return JSON.stringify(this.list);
    }
  }]);

  return AnswerList;
}();

// Add answer methods


{
  for (var prop in ANSWER_METHODS) {
    AnswerList.prototype[prop] = function (name) {
      return function (set) {
        return this.add(name, set);
      };
    }(ANSWER_METHODS[prop]);
  }
}

// Export methods
module.exports = methods;