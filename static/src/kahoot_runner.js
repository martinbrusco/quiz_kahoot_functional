/** @odoo-module */

import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { SurveyDataService } from "./SurveyDataService"; // Ruta de importación corregida

export class KahootSurveyRunner extends Component {
    static template = "quiz_kahoot_functional.KahootSurveyRunnerTemplate";
    
    // El resto del código de la clase (setup, etc.) permanece exactamente igual
    setup() {
        this.state = useState({
            surveyId: null,
            questions: [],
            currentQuestion: null,
            currentIndex: 0,
            selectedOption: null,
            feedbackMessage: null,
            timeLeft: 15,
            isProcessing: false,
            isExiting: false,
            surveyExists: false,
            token: null,
            tokenValid: false,
            configParams: {},
            configParamsLoaded: false,
            feedbackTimeout: null,
            questionTimeout: null,
        });

        this.dataService = new SurveyDataService();
        this.timer = null;

        const placeholder = document.getElementById("kahoot-survey-runner-placeholder");
        if (!placeholder) {
            console.warn('Placeholder #kahoot-survey-runner-placeholder not found!');
            this.state.feedbackMessage = "Error: No se encontró el elemento de inicio de la encuesta.";
            this.state.configParamsLoaded = true;
            return;
        }

        this.state.surveyId = parseInt(placeholder.dataset.surveyId);
        this.state.token = placeholder.dataset.token;
        const surveyExistsRaw = placeholder.dataset.surveyExists || 'false';
        this.state.surveyExists = surveyExistsRaw.toLowerCase() === 'true';

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
                    } else {
                        this.state.feedbackMessage = this.state.configParams.invalid_token || "El token de acceso no es válido.";
                    }
                } else {
                     this.state.feedbackMessage = this.state.configParams.invalid_token || "El token de acceso no es válido.";
                }
            } catch (error) {
                console.error("Error en la inicialización:", error);
                this.state.feedbackMessage = this.state.configParams.feedback_config_error || "Ocurrió un error al cargar la configuración.";
                this.state.configParamsLoaded = true;
            }
        });
        
        onWillUnmount(() => {
            this.clearTimers();
        });
    }

    // ... (todos los demás métodos: loadQuestions, selectOption, etc. van aquí sin cambios)
    async loadQuestions() {
        try {
            const questionsData = await this.dataService.getQuestions(this.state.surveyId, this.state.token);
            this.state.questions = questionsData.map(q => {
                return { ...q, answered: false, correct: false, skipped: false };
            });

            if (this.state.questions.length > 0) {
                this.state.currentQuestion = this.state.questions[0];
                this.validateOptions();
            } else {
                this.state.feedbackMessage = this.state.configParams.feedback_no_questions || "Esta encuesta no tiene preguntas.";
            }
        } catch (error) {
            console.error("Error al cargar las preguntas:", error);
            this.state.feedbackMessage = this.state.configParams.feedback_load_questions_error || "No se pudieron cargar las preguntas.";
        }
    }

    validateOptions() {
        this.state.questions.forEach((question, index) => {
            if (!question.options || question.options.length === 0) {
                console.warn(`La pregunta ${index + 1} ('${question.title}') no tiene opciones.`);
            } else {
                question.options.forEach(option => {
                    if (!option.id || typeof option.id !== 'number') {
                        console.error(`ID de opción inválido en la pregunta ${index + 1}.`, option);
                        option.id = parseInt(option.id) || 0;
                    }
                });
            }
        });
    }

    startQuestionTimer() {
        this.clearTimers(); 
        this.state.timeLeft = 15; 

        this.timer = setInterval(() => {
            if (this.state.timeLeft > 0) {
                this.state.timeLeft = this.state.timeLeft - 1;
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
        this.timer = null;
        this.state.feedbackTimeout = null;
        this.state.questionTimeout = null;
    }

    async selectOption(ev) {
        if (this.state.isProcessing || this.state.selectedOption !== null) return;

        const optionId = parseInt(ev.currentTarget.dataset.optionId);
        if (isNaN(optionId)) {
            console.error("El ID de la opción no es un número:", ev.currentTarget.dataset.optionId);
            return;
        }

        this.state.selectedOption = optionId;
        this.state.isProcessing = true;
        this.clearTimers();
        await this.checkAnswer();
    }

    async checkAnswer() {
        if (!this.state.currentQuestion || !this.state.currentQuestion.options) {
            console.error("No se puede verificar la respuesta: pregunta u opciones no definidas.");
            this.state.isProcessing = false;
            return;
        }

        try {
            const response = await this.dataService.submitAnswer(this.state.surveyId, this.state.currentQuestion.id, this.state.selectedOption, this.state.token);
            if (response.success) {
                this.state.currentQuestion.answered = true;
                this.state.currentQuestion.correct = response.correct;
                this.state.feedbackMessage = response.correct ? this.state.configParams.feedback_correct : this.state.configParams.feedback_incorrect;
                this.state.feedbackTimeout = setTimeout(() => this.nextQuestion(), 4000);
            } else {
                this.state.feedbackMessage = this.state.configParams.feedback_submit_error || "Error al procesar la respuesta.";
            }
        } catch (error) {
            console.error("Error al enviar la respuesta:", error);
            this.state.feedbackMessage = this.state.configParams.feedback_submit_error || "Error al conectar con el servidor.";
        } finally {
            this.state.isProcessing = false;
        }
    }

    nextQuestion() {
        if (this.state.currentIndex >= this.state.questions.length - 1) {
            this.state.isExiting = true;
        } else {
            this.state.currentIndex++;
            this.state.currentQuestion = this.state.questions[this.state.currentIndex];            
            this.state.selectedOption = null;
            this.state.feedbackMessage = null;
            this.state.timeLeft = 15;
            this.state.isProcessing = false;
            this.startQuestionTimer();
        }
    }

    getIndicatorSymbol(question) {
        if (question.skipped) return this.state.configParams.icon_skipped || "?";
        if (question.answered) return question.correct ? this.state.configParams.icon_correct || "✓" : this.state.configParams.icon_incorrect || "X";
        return "";
    }

    getProgressClass(question, currentIndex, index) {
        if (index < currentIndex) return 'past';
        if (index === currentIndex) return 'current';
        return 'future';
    }

    getOptionClass(optionId) {
        if (this.state.selectedOption === optionId) {
            return this.state.currentQuestion.correct ? 'correct' : 'incorrect';
        }
        return '';
    }

    isOptionDisabled() {
        return this.state.isProcessing || this.state.selectedOption !== null || this.state.timeLeft <= 0;
    }

    hasExplanation() {
        return this.state.currentQuestion && this.state.currentQuestion.explanation;
    }
    
    formatText(key, ...args) {
        let text = this.state.configParams[key] || '';
        args.forEach(arg => {
            text = text.replace('%s', arg);
        });
        return text;
    }
}