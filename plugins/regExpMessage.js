'use strict';

/*
    Adds RegExp support to text event messages.
*/

module.exports = {

    id: 'regExpMessage',

    plugin: function plugin(bot) {

        bot.mod('text', data => {
            const message = data.message,
                  props = data.props;

            const text = message.text;

            let promise = Promise.resolve();

            for (let eventType of bot.eventList.keys()) {
                if (eventType instanceof RegExp) {
                    const match = text.match(eventType);
                    if (match) {
                        props.match = match;
                        promise = promise.then(() => bot.event(eventType, message, props));
                    }
                }
            }

            data.promise = promise;

            return data;
        });
    }
};