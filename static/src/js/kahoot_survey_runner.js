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
            isProcessing: false, // Para evitar doble clic en las respuestas
            isExiting: false,
            surveyExists: false,
            token: null,
            tokenValid: false,
            configParams: {},
            configParamsLoaded: false,
            feedbackTimeout: null, // Guardamos el ID del temporizador para poder cancelarlo
            questionTimeout: null, // ID del temporizador para la siguiente pregunta
        });

        this.dataService = new SurveyDataService();
        this.timer = null; // Guardamos el ID del intervalo del temporizador

        // Obtenemos los datos iniciales del HTML
        const placeholder = document.getElementById("kahoot-survey-runner-placeholder");
        if (!placeholder) {
            console.warn('Placeholder #kahoot-survey-runner-placeholder not found!');
            this.state.feedbackMessage = "Error: No se encontró el elemento de inicio de la encuesta.";
            this.state.configParamsLoaded = true; // Marcamos como cargado para mostrar el error
            return;
        }

        // Asignamos los valores del placeholder al estado inicial
        this.state.surveyId = parseInt(placeholder.dataset.surveyId);
        this.state.token = placeholder.dataset.token;
        const surveyExistsRaw = placeholder.dataset.surveyExists || 'false';
        this.state.surveyExists = surveyExistsRaw.toLowerCase() === 'true';

        // 'onMounted' se ejecuta después de que el componente se ha renderizado en el DOM
        onMounted(async () => {
            try {
                // 1. Cargar parámetros de configuración (textos, iconos, etc.)
                const configParams = await this.dataService.getConfigParams();
                this.state.configParams = configParams;
                this.state.configParamsLoaded = true; // La configuración ya está lista

                // 2. Si la encuesta existe y tenemos un token, lo validamos
                if (this.state.surveyExists && this.state.token) {
                    const isTokenValid = await this.dataService.validateToken(this.state.surveyId, this.state.token);
                    this.state.tokenValid = isTokenValid;

                    if (isTokenValid) {
                        // 3. Si el token es válido, cargamos las preguntas
                        await this.loadQuestions();
                        if (this.state.questions.length > 0) {
                            // 4. Si hay preguntas, iniciamos el temporizador para la primera
                            this.startQuestionTimer();
                        }
                    } else {
                        // Si el token no es válido, mostramos un mensaje de error
                        this.state.feedbackMessage = this.state.configParams.invalid_token || "El token de acceso no es válido.";
                    }
                } else {
                    // Si no hay token o la encuesta no existe, también es un error de token
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

    // Carga las preguntas de la encuesta desde el servidor
    async loadQuestions() {
        try {
            const questionsData = await this.dataService.getQuestions(this.state.surveyId, this.state.token);
            this.state.questions = questionsData.map(q => {
                return { ...q, answered: false, correct: false, skipped: false };
            });

            if (this.state.questions.length > 0) {
                this.state.currentQuestion = this.state.questions[0];
                this.validateOptions(); // Verificamos que las opciones son correctas
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
                        option.id = parseInt(option.id) || 0; // Si falla, se asigna 0
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
        }, 1000); // Se ejecuta cada segundo
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
        if (this.state.isProcessing || this.state.selectedOption !== null) {
            return;
        }

        const optionIdString = ev.currentTarget.dataset.optionId;
        const optionId = parseInt(optionIdString);

        if (isNaN(optionId)) {
            console.error("El ID de la opción no es un número:", optionIdString);
            return;
        }

        this.state.selectedOption = optionId;
        this.state.isProcessing = true; // Bloqueamos para evitar más clics
        this.clearTimers(); // Detenemos el temporizador de la pregunta

        // Esperamos a que la respuesta sea verificada
        await this.checkAnswer();
    }

    // Envía la respuesta al servidor y procesa el resultado
    async checkAnswer() {
        if (!this.state.currentQuestion || !this.state.currentQuestion.options) {
            console.error("No se puede verificar la respuesta: la pregunta actual o sus opciones no están definidas.");
            this.state.isProcessing = false;
            return;
        }

        try {
            // Enviamos los datos al servidor
            const response = await this.dataService.submitAnswer(
                this.state.surveyId,
                this.state.currentQuestion.id,
                this.state.selectedOption,
                this.state.token
            );
            
            if (response.success) {
                // Actualizamos el estado de la pregunta (respondida y si fue correcta)
                this.state.currentQuestion.answered = true;
                this.state.currentQuestion.correct = response.correct;

                // Mostramos un mensaje de feedback (ej: "¡Correcto!" o "Incorrecto")
                if (response.correct) {
                    this.state.feedbackMessage = this.state.configParams.feedback_correct;
                } else {
                    this.state.feedbackMessage = this.state.configParams.feedback_incorrect;
                }

                // Esperamos 4 segundos antes de pasar a la siguiente pregunta
                this.state.feedbackTimeout = setTimeout(() => {
                    this.nextQuestion();
                }, 4000);
            } else {
                this.state.feedbackMessage = this.state.configParams.feedback_submit_error || "Error al procesar la respuesta.";
            }
        } catch (error) {
            console.error("Error al enviar la respuesta:", error);
            this.state.feedbackMessage = this.state.configParams.feedback_submit_error || "Error al conectar con el servidor.";
        } finally {
            // Haya funcionado o no, desbloqueamos el procesamiento
            this.state.isProcessing = false;
        }
    }

    // Pasa a la siguiente pregunta o finaliza la encuesta
    nextQuestion() {
        const isLastQuestion = this.state.currentIndex >= this.state.questions.length - 1;

        if (isLastQuestion) {
            // Si es la última pregunta, marcamos que vamos a salir
            this.state.isExiting = true;
            // Aquí se podría redirigir a una página de resultados
            // window.location.href = '/survey/results/' + this.state.surveyId;
        } else {

            this.state.currentIndex += 1;
            this.state.currentQuestion = this.state.questions[this.state.currentIndex];            
            this.state.selectedOption = null;
            this.state.feedbackMessage = null;
            this.state.timeLeft = 15;
            this.state.isProcessing = false;

            this.startQuestionTimer();
        }
    }

    getIndicatorSymbol(question) {
        if (question.skipped) {
            return this.state.configParams.icon_skipped || "?";
        }
        if (question.answered) {
            if (question.correct) {
                return this.state.configParams.icon_correct || "✓";
            } else {
                return this.state.configParams.icon_incorrect || "X";
            }
        }
        return ""; 
    }

    getProgressClass(question, currentIndex, index) {
        if (index < currentIndex) {
            return 'past'; // Pregunta ya pasada
        }
        if (index === currentIndex) {
            return 'current'; // Pregunta actual
        }
        return 'future'; // Pregunta futura
    }

    getOptionClass(optionId) {
        if (this.state.selectedOption === optionId) {
            if (this.state.currentQuestion.correct) {
                return 'correct';
            } else {
                return 'incorrect';
            }
        }
        return ''; // Clase por defecto
    }

    isOptionDisabled() {
        const disabled = this.state.isProcessing || this.state.selectedOption !== null || this.state.timeLeft <= 0;
        return disabled;
    }

    hasExplanation() {
        if (this.state.currentQuestion && this.state.currentQuestion.explanation) {
            return true;
        }
        return false;
    }
    
    // Formatea un texto reemplazando '%s' con los argumentos proporcionados
    formatText(key, ...args) {
        let text = this.state.configParams[key] || '';
        args.forEach((arg, index) => {
            text = text.replace('%s', arg);
        });
        return text;
    }
}