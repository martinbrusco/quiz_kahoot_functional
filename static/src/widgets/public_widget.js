/** @odoo-module **/

import { mount } from "@odoo/owl";
import publicWidget from '@web/legacy/js/public/public_widget';
import { KahootSurveyRunner } from '../components/kahoot_runner';

publicWidget.registry.KahootSurveyRunnerWidget = publicWidget.Widget.extend({
    selector: '#kahoot-survey-runner-placeholder',
    async start() {
        await this._super(...arguments);
        mount(KahootSurveyRunner, this.el);
    },
});

export default publicWidget.registry.KahootSurveyRunnerWidget;