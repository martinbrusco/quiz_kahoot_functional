/** @odoo-module */

// Ya no necesitamos 'xml' aquí
import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { SurveyDataService } from "./SurveyDataService";

export class KahootSurveyRunner extends Component {
    // Apuntamos de nuevo al template externo
    static template = "quiz_kahoot_functional.KahootSurveyRunnerTemplate";
    
    // El resto del código (setup, loadQuestions, etc.) no cambia en absoluto.
    // Pega aquí el resto del código funcional del paso anterior.
    setup() {
        // El componente vuelve a leer los datos desde el DOM, como al principio.
        const placeholder = document.getElementById("kahoot-survey-runner-placeholder");
        
        this.state = useState({
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

        this.dataService = new SurveyDataService();
        this.timer = null;

        onMounted(async () => {
            try {
                const configParams = await this.dataService.getConfigParams();
                this.state.configParams = configParams;
                this.state.configParamsLoaded = true;
                if (this.state.surveyExists && this.state.token) {
                    const isTokenValid = await this.dataService.validateToken(this.state.surveyId, this.state.token);
                    this.state.tokenValid = isTokenValid;
                    if (isTokenValid) {
                        await this.loadQuestions();
                        if (this.state.questions.length > 0) {
                            this.startQuestionTimer();
                        }
                    }
                }
            } catch (error) {
                console.error("Error en la inicialización:", error);
            }
        });

        onWillUnmount(() => {
            this.clearTimers();
        });
    }

    async loadQuestions() {
        try {
            const questionsData = await this.dataService.getQuestions(this.state.surveyId, this.state.token);
            this.state.questions = questionsData.map(q => ({ ...q, answered: false, correct: false, skipped: false }));
            if (this.state.questions.length > 0) {
                this.state.currentQuestion = this.state.questions[0];
            }
        } catch (error) {
            console.error("Error al cargar las preguntas:", error);
        }
    }

    startQuestionTimer() {
        this.clearTimers();
        this.state.timeLeft = 15;
        this.timer = setInterval(() => {
            if (this.state.timeLeft > 0) {
                this.state.timeLeft--;
            } else {
                this.state.currentQuestion.skipped = true;
                this.nextQuestion();
            }
        }, 1000);
    }

    clearTimers() {
        if (this.timer) clearInterval(this.timer);
        if (this.state.feedbackTimeout) clearTimeout(this.state.feedbackTimeout);
        if (this.state.questionTimeout) clearTimeout(this.state.questionTimeout);
    }

    async selectOption(ev) {
        if (this.state.selectedOption !== null) return;
        this.clearTimers();
        const optionId = parseInt(ev.currentTarget.dataset.optionId, 10);
        this.state.selectedOption = optionId;
        try {
            const response = await this.dataService.submitAnswer(this.state.surveyId, this.state.currentQuestion.id, optionId, this.state.token);
            if (response.success) {
                this.state.currentQuestion.answered = true;
                this.state.currentQuestion.correct = response.correct;
                this.state.feedbackMessage = response.correct ? (this.state.configParams.feedback_correct || "¡Correcto!") : (this.state.configParams.feedback_incorrect || "Incorrecto");
                this.state.feedbackTimeout = setTimeout(() => this.nextQuestion(), 2000);
            }
        } catch (error) {
            console.error("Error al enviar la respuesta:", error);
        }
    }

    nextQuestion() {
        if (this.state.currentIndex >= this.state.questions.length - 1) {
            this.state.feedbackMessage = "Fin del Quiz";
            this.clearTimers();
        } else {
            this.state.currentIndex++;
            this.state.currentQuestion = this.state.questions[this.state.currentIndex];
            this.state.selectedOption = null;
            this.state.feedbackMessage = null;
            this.startQuestionTimer();
        }
    }

    getProgressClass(question, currentIndex, index) {
        if (index < currentIndex) return 'past';
        if (index === currentIndex) return 'current';
        return 'future';
    }

    hasExplanation() {
        return this.state.currentQuestion && this.state.currentQuestion.explanation;
    }
    
    formatText(key, ...args) {
        let text = (this.state.configParams && this.state.configParams[key]) || '';
        args.forEach(arg => text = text.replace('%s', arg));
        return text;
    }
}