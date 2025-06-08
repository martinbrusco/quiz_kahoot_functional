/** @odoo-module **/

import { useState } from "@odoo/owl";

export class StateManager {
  static initState() {
    return useState({
      surveyId: null,
      questions: [],
      currentQuestion: null,
      currentIndex: 0,
      selectedOption: null,
      feedbackMessage: null,
      timeLeft: 15,
      isProcessing: false,
      isExiting: false,
    });
  }
}