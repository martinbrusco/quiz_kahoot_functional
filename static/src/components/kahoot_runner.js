/** @odoo-module */

import { Component, onMounted, onWillUnmount } from "@odoo/owl";
import { SurveyDataService } from "../services/SurveyDataService"; 
import { TEMPLATE } from "./kahoot_template";
import { getInitialState } from "./kahoot_state";

export class KahootSurveyRunner extends Component {
    static template = TEMPLATE;
    
    setup() {
        this.state = getInitialState();
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
                            this.renderInitialState();
                            this.startQuestionTimer();
                        } else {
                            this.state.feedbackMessage = this.state.configParams.feedback_no_questions || "No hay preguntas disponibles.";
                        }
                    }
                }
            } catch (error) {
                console.error("Error en la inicialización:", error);
                this.state.feedbackMessage = this.state.configParams.feedback_load_questions_error || "Error al cargar las preguntas.";
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
                this.state.currentIndex = 0;
                this.state.feedbackMessage = null; // Eliminar mensaje de carga
            }
        } catch (error) {
            console.error("Error al cargar las preguntas:", error);
            this.state.feedbackMessage = this.state.configParams.feedback_load_questions_error || "Error al cargar las preguntas.";
        }
    }

    renderInitialState() {
        // Forzar renderizado inicial para reflejar el estado actual
        this.state.questions.forEach((q, index) => {
            if (index < this.state.currentIndex && q.answered) {
                q.skipped = false; // Asegurar que el estado se refleje
            }
        });
        this.render();
    }

    startQuestionTimer() {
        this.clearTimers();
        this.state.timeLeft = 15;
        this.timer = setInterval(() => {
            if (this.state.timeLeft > 0) {
                this.state.timeLeft--;
                this.updateTimerBar();
            } else {
                this.state.currentQuestion.skipped = true;
                this.nextQuestion();
            }
        }, 1000);
    }

    updateTimerBar() {
        if (this.$el) {
            const progressFill = this.$el.querySelector('.progress-fill');
            if (progressFill) {
                const progress = (this.state.timeLeft / 15) * 100;
                progressFill.style.width = `${progress}%`;
            }
        }
    }

    clearTimers() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.state.feedbackTimeout) {
            clearTimeout(this.state.feedbackTimeout);
            this.state.feedbackTimeout = null;
        }
        if (this.state.questionTimeout) {
            clearTimeout(this.state.questionTimeout);
            this.state.questionTimeout = null;
        }
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
                this.state.feedbackMessage = response.correct ? this.state.configParams.feedback_correct || "¡Correcto!" : this.state.configParams.feedback_incorrect || "Incorrecto";
                this.updateProgressBar(); // Actualizar la barra de progreso inmediatamente
                this.state.feedbackTimeout = setTimeout(() => this.nextQuestion(), 2000);
            }
        } catch (error) {
            console.error("Error al enviar la respuesta:", error);
        }
    }

    updateProgressBar() {
        this.state.questions.forEach((q, index) => {
            if (index < this.state.currentIndex && q.answered) {
                q.skipped = false; // Asegurar que el estado se refleje
            }
        });
        this.render();
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
            this.updateProgressBar(); // Actualizar la barra antes de iniciar el temporizador
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

    getIndicatorSymbol(question) {
        if (question.answered) {
            return question.correct ? '✅' : '❌';
        }
        return '❓';
    }

    getOptionClass(optionId) {
        if (this.state.selectedOption === optionId) {
            return 'selected';
        }
        return '';
    }

    isOptionDisabled() {
        return this.state.selectedOption !== null;
    }
}