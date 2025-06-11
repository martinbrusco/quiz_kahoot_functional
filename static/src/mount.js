/** @odoo-module **/

import { mount } from "@odoo/owl";
import { KahootSurveyRunner } from "./kahoot_runner"; // Ruta de importación corregida

function mountKahootSurveyRunner() {
  const mountInterval = setInterval(() => {
    const placeholder = document.getElementById("kahoot-survey-runner-placeholder");
    if (placeholder) {
      mount(KahootSurveyRunner, placeholder);
      clearInterval(mountInterval);
    } else if (document.readyState === "complete") {
      clearInterval(mountInterval);
    }
  }, 100);
}

mountKahootSurveyRunner();