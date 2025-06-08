/** @odoo-module */

import { Component, xml, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { SurveyDataService } from "./lib/SurveyDataService";

export class KahootSurveyRunner extends Component {
    static template = xml`
        <div class="survey-runner">
            <t t-if="state.configParamsLoaded">
                <t t-if="!state.tokenValid">
                    <p class="feedback-message incorrect" t-out="state.configParams.invalid_token"/>
                    <a href="/" class="btn-subscribe" t-out="state.configParams.back_to_home"/>
                </t>
                <t t-elif="!state.surveyExists">
                    <p class="feedback-message" t-out="formatText('survey_not_found', state.surveyId)"/>
                    <a href="/" class="btn-subscribe" t-out="state.configParams.back_to_home"/>
                </t>
                <t t-elif="state.questions.length === 0">
                    <p t-if="!state.feedbackMessage" t-out="state.configParams.loading_questions"/>
                    <p t-if="state.feedbackMessage" class="feedback-message">
                        <t t-out="state.feedbackMessage"/>
                        <t t-if="state.feedbackMessage.includes(state.configParams.session_expired)">
                            <br/>
                            <a t-att-href="'/web/login?redirect=/play/' + state.surveyId" t-out="state.configParams.login"/>
                        </t>
                    </p>
                </t>
                <t t-else="">
                    <div class="answer-counter">
                        <span t-out="formatText('answers_count', state.questions.filter(q => q.answered).length)"/>
                    </div>
                    <div class="progress-general">
                        <span t-out="formatText('question_progress', state.currentIndex + 1, state.questions.length)"/>
                        <div class="progress-bar-general">
                            <t t-foreach="state.questions" t-as="question" t-key="question.id">
                                <div t-att-class="'progress-segment ' + getProgressClass(question, state.currentIndex, question_index)">
                                    <span class="answered-icon" t-out="getIndicatorSymbol(question)"/>
                                </div>
                            </t>
                        </div>
                    </div>
                    <div class="progress-timer">
                        <span t-out="formatText('timer_format', state.timeLeft)"/>
                        <div class="progress-bar">
                            <div class="progress-fill" t-att-style="'width:' + (state.timeLeft / 15 * 100) + '%'"/>
                        </div>
                    </div>
                    <h3 class="question-title fade-in" t-key="state.currentIndex" t-out="state.currentQuestion ? state.currentQuestion.title : state.configParams.loading_question"/>
                    <ul class="options-list fade-in" t-key="state.currentIndex">
                        <t t-foreach="state.currentQuestion ? state.currentQuestion.options : []" t-as="option" t-key="option.id">
                            <li t-att-class="'option-' + option_index">
                                <button t-on-click="selectOption" t-att-data-option-id="option.id" t-att-class="'option-button option-' + option_index + ' ' + getOptionClass(option.id)" t-att-disabled="isOptionDisabled()">
                                    <span class="option-shape"></span>
                                    <span class="option-text" t-out="option.text"/>
                                </button>
                            </li>
                        </t>
                    </ul>
                    <t t-if="state.feedbackMessage">
                        <p class="feedback-message" t-att-class="state.feedbackMessage.includes(state.configParams.feedback_correct) ? 'correct' : 'incorrect'">
                            <t t-out="state.feedbackMessage"/>
                        </p>
                        <t t-if="hasExplanation()">
                            <p class="explanation">
                                <t t-out="state.currentQuestion.explanation"/>
                            </p>
                        </t>
                    </t>
                </t>
            </t>
            <t t-else="">
                <p>Cargando configuración...</p>
            </t>
        </div>
    `;

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
            this.state.feedbackMessage = "Error: Placeholder no encontrado.";
            this.state.configParamsLoaded = true;
            return;
        }
        this.state.surveyId = placeholder ? parseInt(placeholder.dataset.surveyId) : null;
        this.state.token = placeholder ? placeholder.dataset.token : null;
        const surveyExistsRaw = placeholder ? placeholder.dataset.surveyExists : 'false';
        this.state.surveyExists = surveyExistsRaw.toLowerCase() === 'true';
        onMounted(async () => {
            try {
                const configParams = await this.dataService.getConfigParams();
                this.state.configParams = configParams;
                this.state.configParamsLoaded = true;

                if (this.state.surveyExists && this.state.token) {
                    const tokenValid = await this.dataService.validateToken(this.state.surveyId, this.state.token);
                    this.state.tokenValid = tokenValid;
                    if (tokenValid) {
                        await this.loadQuestions();
                        if (this.state.questions.length > 0) {
                            this.startQuestionTimer();
                        }
                    } else {
                        this.state.feedbackMessage = this.state.configParams.invalid_token || "Token inválido.";
                    }
                } else {
                    this.state.feedbackMessage = this.state.configParams.invalid_token || "Token inválido.";
                }
            } catch (error) {
                console.error("Error al cargar la configuración o validar el token:", error);
                this.state.feedbackMessage = this.state.configParams.feedback_config_error || "Error al cargar la configuración.";
                this.state.configParamsLoaded = true;
            }
        });
        onWillUnmount(() => { this.clearTimers(); });
    }
    async loadQuestions() {
        try {
            const questions = await this.dataService.getQuestions(this.state.surveyId, this.state.token);
            this.state.questions = questions.map(q => ({ ...q, answered: false, correct: false, skipped: false }));
            if (questions.length > 0) {
                this.state.currentQuestion = this.state.questions[0];
                this.validateOptions();
            } else {
                this.state.feedbackMessage = this.state.configParams.feedback_no_questions || "No hay preguntas disponibles.";
            }
        } catch (error) {
            console.error("Error al cargar las preguntas:", error);
            this.state.feedbackMessage = this.state.configParams.feedback_load_questions_error || "Error al cargar las preguntas.";
        }
    }
    validateOptions() {
        this.state.questions.forEach((q, index) => {
            if (!q.options || q.options.length === 0) {
                console.warn(`La pregunta ${index + 1} no tiene opciones o son inválidas.`);
            } else {
                q.options.forEach(opt => {
                    if (!opt.id || typeof opt.id !== 'number') {
                        console.error(`ID de opción inválido en la pregunta ${index + 1}:`, opt);
                        opt.id = parseInt(opt.id) || 0;
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
                this.state.timeLeft -= 1;
            } else {
                this.state.currentQuestion.skipped = true;
                this.nextQuestion();
            }
        }, 1000);
    }
    clearTimers() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.state.feedbackTimeout) { clearTimeout(this.state.feedbackTimeout); this.state.feedbackTimeout = null; }
        if (this.state.questionTimeout) { clearTimeout(this.state.questionTimeout); this.state.questionTimeout = null; }
    }
    async selectOption(ev) {
        if (this.state.isProcessing || this.state.selectedOption !== null) return;
        const rawOptionId = ev.currentTarget.dataset.optionId;
        const optionId = parseInt(rawOptionId);
        if (isNaN(optionId)) {
            console.error("ID de opción inválido: NaN. Elemento del evento:", ev.currentTarget);
            return;
        }
        this.state.selectedOption = optionId;
        this.state.isProcessing = true;
        this.clearTimers();
        await this.checkAnswer();
    }
    async checkAnswer() {
        if (!this.state.currentQuestion || !this.state.currentQuestion.options || this.state.currentQuestion.options.length === 0) {
            console.error("La pregunta actual o sus opciones están indefinidas o vacías.");
            this.state.isProcessing = false;
            return;
        }
        const selectedOption = this.state.currentQuestion.options.find(opt => opt.id === this.state.selectedOption);
        if (!selectedOption) {
            console.error("Opción seleccionada no encontrada. Opciones:", JSON.stringify(this.state.currentQuestion.options.map(opt => opt.id)));
            this.state.isProcessing = false;
            return;
        }
        try {
            const response = await this.dataService.submitAnswer(this.state.surveyId, this.state.currentQuestion.id, this.state.selectedOption, this.state.token);
            if (response.success) {
                this.state.currentQuestion.answered = true;
                this.state.currentQuestion.correct = response.correct;
                this.state.feedbackMessage = response.correct ? this.state.configParams.feedback_correct : this.state.configParams.feedback_incorrect;
                this.state.feedbackTimeout = setTimeout(() => { this.nextQuestion(); }, 4000);
            } else {
                this.state.feedbackMessage = this.state.configParams.feedback_submit_error || "Error al procesar la respuesta.";
            }
        } catch (error) {
            console.error("Error al enviar la respuesta:", error);
            this.state.feedbackMessage = this.state.configParams.feedback_submit_error || "Error al enviar la respuesta.";
        } finally {
            this.state.isProcessing = false;
        }
    }
    nextQuestion() {
        if (this.state.currentIndex < this.state.questions.length - 1) {
            this.state.currentIndex += 1;
            this.state.currentQuestion = this.state.questions[this.state.currentIndex];
            this.state.selectedOption = null;
            this.state.feedbackMessage = null;
            this.state.timeLeft = 15;
            this.state.isProcessing = false;
            this.startQuestionTimer();
        } else {
            this.state.isExiting = true;
        }
    }
    getIndicatorSymbol(question) {
        if (question.skipped) { return this.state.configParams.icon_skipped || "?"; }
        if (question.answered) { return question.correct ? this.state.configParams.icon_correct || "✓" : this.state.configParams.icon_incorrect || "X"; }
        return "";
    }
    getProgressClass(question, currentIndex, index) {
        if (index < currentIndex) return 'past';
        if (index === currentIndex) return 'current';
        return 'future';
    }
    getOptionClass(optionId) {
        if (this.state.selectedOption === optionId) { return this.state.currentQuestion.correct ? 'correct' : 'incorrect'; }
        return '';
    }
    isOptionDisabled() { return this.state.isProcessing || this.state.selectedOption !== null || this.state.timeLeft <= 0; }
    hasExplanation() { return this.state.currentQuestion && this.state.currentQuestion.explanation; }
    formatText(key, ...args) {
        let text = this.state.configParams[key] || '';
        args.forEach((arg, index) => { text = text.replace('%s', arg); });
        return text;
    }
}