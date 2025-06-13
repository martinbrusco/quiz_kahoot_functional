/** @odoo-module */

import { xml } from "@odoo/owl";

export const TEMPLATE = xml`
    <div class="survey-runner">
        <t t-if="state.configParamsLoaded">
            <t t-if="!state.tokenValid">
                <p class="feedback-message incorrect" t-out="state.configParams.invalid_token || 'Token inválido o expirado.'"/>
                <a href="/" class="btn-subscribe" t-out="state.configParams.back_to_home || 'Volver al inicio'"/>
            </t>
            <t t-elif="!state.surveyExists">
                <p class="feedback-message" t-out="formatText('survey_not_found', state.surveyId)"/>
                <a href="/" class="btn-subscribe" t-out="state.configParams.back_to_home || 'Volver al inicio'"/>
            </t>
            <t t-elif="state.questions.length === 0 and !state.currentQuestion">
                <p t-if="!state.feedbackMessage" t-out="state.configParams.loading_questions || 'Cargando preguntas...'"/>
                <p t-if="state.feedbackMessage" class="feedback-message">
                    <t t-out="state.feedbackMessage"/>
                    <t t-if="state.feedbackMessage.includes(state.configParams.session_expired)">
                        <br/>
                        <a t-att-href="'/web/login?redirect=/play/' + state.surveyId" t-out="state.configParams.login || 'Iniciar sesión'"/>
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
                <h3 class="question-title fade-in" t-key="state.currentIndex" t-out="state.currentQuestion ? state.currentQuestion.title : state.configParams.loading_question || 'Cargando pregunta...'"/>
                <ul class="options-list fade-in" t-key="state.currentIndex">
                    <t t-foreach="state.currentQuestion ? state.currentQuestion.options : []" t-as="option" t-key="option.id">
                        <li t-att-class="'option-' + option_index">
                            <button t-on-click="selectOption" t-att-data-option-id="option.id" t-att-class="'option-button option-' + option_index + ' ' + getOptionClass(option.id)" t-att-disabled="isOptionDisabled()">
                                <span class="option-shape"/>
                                <span class="option-text" t-out="option.text"/>
                            </button>
                        </li>
                    </t>
                </ul>
                <t t-if="state.feedbackMessage">

                    <t t-if="hasExplanation()">
                        <p class="explanation">
                            <t t-out="state.currentQuestion.explanation"/>
                        </p>
                    </t>




                    <p class="feedback-message" t-att-class="state.feedbackMessage.includes(state.configParams.feedback_correct) ? 'correct' : 'incorrect'">
                        <t t-out="state.feedbackMessage"/>
                    </p>



                </t>
            </t>
        </t>
        <t t-else="">
            <p t-out="state.configParams.loading_question || 'Cargando configuración...'"/>
        </t>
    </div>
`;