/** @odoo-module **/

odoo.define('quiz_kahoot_functional.play_pin', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');

    publicWidget.registry.QuizPlayPin = publicWidget.Widget.extend({
        selector: '.quiz-play-pin',
        events: {
            'submit .quiz-form': '_onSubmitPin',
        },

        start: function () {
            return this._super.apply(this, arguments).then(() => {
                console.log("Snippet de PIN cargado");
            });
        },

        _onSubmitPin: function (ev) {
            const $input = this.$el.find('.quiz-input');
            const pin = $input.val().trim();
            if (!pin) {
                ev.preventDefault();
                this.$el.find('.quiz-form').prepend(
                    '<div class="alert alert-danger mt-3">Por favor, ingresa un PIN válido.</div>'
                );
            }
        },
    });

    return publicWidget.registry.QuizPlayPin;
});