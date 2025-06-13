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
                this.state.timerDuration = parseInt(configParams.timer_duration || 15);
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
                this.state.feedbackMessage = null;
            }
        } catch (error) {
            console.error("Error al cargar las preguntas:", error);
            this.state.feedbackMessage = this.state.configParams.feedback_load_questions_error || "Error al cargar las preguntas.";
        }
    }

    renderInitialState() {
        this.state.questions.forEach((q, index) => {
            if (index < this.state.currentIndex && q.answered) {
                q.skipped = false;
            }
        });
        this.render();
    }

    startQuestionTimer() {
        this.clearTimers();
        this.state.timeLeft = this.state.timerDuration;
        this.updateTimerBar();
        this.timer = setInterval(() => {
            if (this.state.timeLeft > 0) {
                this.state.timeLeft--;
                this.updateTimerBar();
            } else {
                this.state.currentQuestion.skipped = true;
                this.state.feedbackMessage = this.state.configParams.feedback_skipped || "¡Tiempo agotado!";
                this.state.feedbackTimeout = setTimeout(() => this.nextQuestion(), 1000);
            }
        }, 1000);
    }

    updateTimerBar() {
        if (this.$el) {
            const progressFill = this.$el.querySelector('.progress-fill');
            if (progressFill) {
                const progress = (this.state.timeLeft / this.state.timerDuration) * 100;
                progressFill.style.width = `${progress}%`;
                if (this.state.timeLeft <= this.state.timerDuration / 3) {
                    progressFill.style.backgroundColor = '#ff4d4d'; // Rojo
                } else if (this.state.timeLeft <= this.state.timerDuration * 2 / 3) {
                    progressFill.style.backgroundColor = '#ffcc00'; // Amarillo
                } else {
                    progressFill.style.backgroundColor = '#28a745'; // Verde
                }
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
        if (this.state.selectedOption !== null || this.state.isProcessing) return;
        this.state.isProcessing = true;
        this.clearTimers();
        const optionId = parseInt(ev.currentTarget.dataset.optionId, 10);
        this.state.selectedOption = optionId;
        try {
            const response = await this.dataService.submitAnswer(this.state.surveyId, this.state.currentQuestion.id, optionId, this.state.token);
            if (response.success) {
                this.state.currentQuestion.answered = true;
                this.state.currentQuestion.correct = response.correct;
                this.state.feedbackMessage = response.correct ? this.state.configParams.feedback_correct || "¡Correcto!" : this.state.configParams.feedback_incorrect || "Incorrecto";
                this.updateProgressBar();
                this.state.feedbackTimeout = setTimeout(() => {
                    this.nextQuestion();
                    this.state.isProcessing = false;
                }, 2000);
            } else {
                this.state.feedbackMessage = this.state.configParams.feedback_submit_error || "Error al enviar la respuesta.";
                this.state.isProcessing = false;
            }
        } catch (error) {
            console.error("Error al enviar la respuesta:", error);
            this.state.feedbackMessage = this.state.configParams.feedback_submit_error || "Error al enviar la respuesta.";
            this.state.isProcessing = false;
        }
    }

    updateProgressBar() {
        this.state.questions.forEach((q, index) => {
            if (index < this.state.currentIndex && q.answered) {
                q.skipped = false;
            }
        });
        this.render();
    }

    nextQuestion() {
        if (this.state.currentIndex >= this.state.questions.length - 1) {
            this.state.feedbackMessage = this.state.configParams.quiz_finished || "Fin del Quiz";
            this.clearTimers();
        } else {
            this.state.currentIndex++;
            this.state.currentQuestion = this.state.questions[this.state.currentIndex];
            this.state.selectedOption = null;
            this.state.feedbackMessage = null;
            this.state.isProcessing = false;
            this.updateProgressBar();
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
            return question.correct ? this.state.configParams.icon_correct || '✅' : this.state.configParams.icon_incorrect || '❌';
        }
        return this.state.configParams.icon_skipped || '❓';
    }

    getOptionClass(optionId) {
        if (this.state.selectedOption === optionId) {
            return 'selected';
        }
        return '';
    }

    isOptionDisabled() {
        return this.state.selectedOption !== null || this.state.isProcessing;
    }
}