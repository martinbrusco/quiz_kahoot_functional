/** @odoo-module */

import { jsonrpc } from "@web/core/network/rpc_service";

export class SurveyDataService {
    async getQuestions(surveyId, token) {
        try {
            const response = await jsonrpc("/survey/get_data", {
                survey_id: surveyId,
                access_token: token
            });
            if (!response.success) {
                throw new Error(response.error || "No se encontraron encuestas.");
            }
            return response.questions.map(question => ({
                id: question.id,
                title: question.title['en_US'] || question.title,
                options: question.options.map(opt => ({
                    id: opt.id,
                    text: opt.text['en_US'] || opt.text,
                    isCorrect: opt.isCorrect
                })),
                explanation: question.explanation,
                answered: false,
                correct: false,
                skipped: false
            }));
        } catch (error) {
            console.error("Error loading questions:", error);
            throw error;
        }
    }

    async submitAnswer(surveyId, questionId, answerId, token) {
        try {
            const response = await jsonrpc("/survey/submit", {
                survey_id: surveyId,
                question_id: questionId,
                answer_id: answerId,
                access_token: token
            });
            return response;
        } catch (error) {
            console.error("Error submitting answer:", error);
            throw error;
        }
    }

    async validateToken(surveyId, token) {
        try {
            const response = await jsonrpc("/survey/validate_token", {
                survey_id: surveyId,
                access_token: token
            });
            return response.success;
        } catch (error) {
            console.error("Error validating token:", error);
            return false;
        }
    }

    async getConfigParams() {
        try {
            return await jsonrpc("/survey/get_config_params");
        } catch (error) {
            console.error("Error loading config params:", error);
            return {};
        }
    }
}