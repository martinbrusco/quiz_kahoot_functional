/** @odoo-module **/

odoo.define('quiz_kahoot_functional.game_runner', function (require) {
    'use strict';

    var publicWidget = require('web.public.widget');
    var KahootSurveyRunnerWidget = require('quiz_kahoot_functional.widgets.public_widget').KahootSurveyRunnerWidget;

    publicWidget.registry.QuizGameRunner = publicWidget.Widget.extend({
        selector: '.quiz-game-runner',
        start: function () {
            return this._super.apply(this, arguments).then(() => {
                const placeholder = this.$el.find('#kahoot-survey-runner-placeholder')[0];
                if (placeholder) {
                    new KahootSurveyRunnerWidget(this, placeholder).start();
                }
                console.log("Snippet de ejecución del juego cargado");
            });
        },
    });

    return publicWidget.registry.QuizGameRunner;
});