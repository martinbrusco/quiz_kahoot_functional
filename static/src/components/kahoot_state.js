/** @odoo-module */

import { useState } from "@odoo/owl";

export function getInitialState() {
    const placeholder = document.getElementById("kahoot-survey-runner-placeholder");
    
    return useState({
        surveyId: parseInt(placeholder.dataset.surveyId, 10),
        token: placeholder.dataset.token,
        surveyExists: placeholder.dataset.surveyExists === 'true',
        tokenValid: false,
        questions: [],
        currentQuestion: null,
        currentIndex: 0,
        selectedOption: null,
        feedbackMessage: null,
        timeLeft: 15,
        isProcessing: false,
        configParams: {},
        configParamsLoaded: false,
        feedbackTimeout: null,
        questionTimeout: null,
    });
}