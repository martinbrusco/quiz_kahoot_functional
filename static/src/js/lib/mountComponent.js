/** @odoo-module **/

import { mount } from "@odoo/owl";
import { KahootSurveyRunner } from "../kahoot_survey_runner";

function mountKahootSurveyRunner() {
  const mountInterval = setInterval(() => {
    const placeholder = document.getElementById("kahoot-survey-runner-placeholder");
    if (placeholder) {
      mount(KahootSurveyRunner, placeholder);
      clearInterval(mountInterval);
    } else if (document.readyState === "complete") {
      // Si el DOM está listo pero no encontramos el elemento, paramos de buscar.
      clearInterval(mountInterval);
    }
  }, 100);
}

// Llama a la función para empezar el proceso de montaje.
mountKahootSurveyRunner();