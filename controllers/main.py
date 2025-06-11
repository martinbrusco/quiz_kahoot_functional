# quiz_kahoot_functional/controllers/main.py
from odoo import http
from odoo.http import request
import logging

_logger = logging.getLogger(__name__)

class NinjaQuizController(http.Controller):

    @http.route('/quiz/validate_pin', type='http', auth='public', methods=['POST'], website=True, csrf=True)
    def validate_pin(self, **kwargs):
        pin = kwargs.get('pin')
        survey = request.env['survey.survey'].sudo().search([('session_code', '=', pin)], limit=1)

        if not survey:
            return request.redirect('/?pin_error=1')

        user_input = request.env['survey.user_input'].sudo().create({
            'survey_id': survey.id,
            'state': 'in_progress',
            'partner_id': request.env.user.partner_id.id if request.env.user != request.env.ref('base.public_user') else False,
        })
        return request.redirect(f'/play/{survey.id}?token={user_input.access_token}')

    @http.route('/play/<int:survey_id>', type='http', auth='public', website=True)
    def play_page(self, survey_id, token=None, **kwargs):
        survey = request.env['survey.survey'].sudo().browse(survey_id).exists()
        token_valid = False
        if survey and token:
            user_input = request.env['survey.user_input'].sudo().search([
                ('survey_id', '=', survey.id),
                ('access_token', '=', token),
                ('state', '=', 'in_progress')
            ], limit=1)
            token_valid = bool(user_input)

        params = {
            'survey_id': survey_id,
            'survey_exists': str(bool(survey)).lower(),
            'token': token,
            'token_valid': token_valid,
        }
        return request.render('quiz_kahoot_functional.play_page_template', params)

class NinjaQuizSurveyController(http.Controller):
    @http.route('/survey/submit', type='json', auth='public', website=True, methods=['POST'])
    def survey_submit(self, survey_id, question_id, answer_id, access_token):
        try:
            user_input = request.env['survey.user_input'].sudo().search([
                ('survey_id', '=', int(survey_id)),
                ('access_token', '=', access_token),
                ('state', '=', 'in_progress')
            ], limit=1)

            if not user_input:
                submit_error = request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.submit_error', 'Error al enviar la respuesta.')
                return {'success': False, 'error': submit_error}

            request.env['survey.user_input.line'].sudo().create({
                'user_input_id': user_input.id,
                'question_id': int(question_id),
                'answer_type': 'suggestion',
                'suggested_answer_id': int(answer_id),
            })

            answer = request.env['survey.question.answer'].sudo().browse(int(answer_id))
            is_correct = answer.is_correct if hasattr(answer, 'is_correct') else False

            return {'success': True, 'correct': is_correct}
        except Exception as e:
            submit_error = request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.submit_error', 'Error al enviar la respuesta.')
            return {'success': False, 'error': submit_error}

    @http.route('/survey/get_data', type='json', auth='public', website=True, methods=['POST'])
    def get_survey_data(self, survey_id=None, access_token=None):
        try:
            user_input = request.env['survey.user_input'].sudo().search([
                ('survey_id', '=', int(survey_id)),
                ('access_token', '=', access_token),
                ('state', '=', 'in_progress')
            ], limit=1)

            if not user_input:
                no_surveys_found = request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.no_surveys_found', 'No se encontraron encuestas.')
                return {'success': False, 'error': no_surveys_found}

            surveys = request.env['survey.survey'].sudo().search_read(
                domain=[('id', '=', int(survey_id))],
                fields=["id", "title", "question_ids"]
            )

            if not surveys:
                no_surveys_found = request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.no_surveys_found', 'No se encontraron encuestas.')
                return {'success': False, 'error': no_surveys_found}

            survey = surveys[0]
            survey_id = survey['id']

            questions = request.env['survey.question'].sudo().search_read(
                domain=[('id', 'in', survey['question_ids'])],
                fields=["title", "suggested_answer_ids", "is_scored_question", "explanation"]
            )

            formatted_questions = []
            for question in questions:
                options = request.env['survey.question.answer'].sudo().search_read(
                    domain=[('id', 'in', question['suggested_answer_ids'])],
                    fields=["value", "is_correct"]
                )

                formatted_question = {
                    'id': question['id'],
                    'title': question['title']['en_US'] if isinstance(question['title'], dict) else question['title'],
                    'options': [{
                        'id': opt['id'],
                        'text': opt['value']['en_US'] if isinstance(opt['value'], dict) else opt['value'],
                        'isCorrect': opt['is_correct'] or False,
                    } for opt in options],
                    'isScored': question['is_scored_question'],
                    'explanation': question['explanation'] or "",
                    'answered': False,
                }
                formatted_questions.append(formatted_question)

            if not formatted_questions:
                no_questions_found = request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.no_questions_found', 'No se encontramos preguntas para esta encuesta.')
                return {'success': False, 'error': no_questions_found}

            return {
                'success': True,
                'surveyId': survey_id,
                'questions': formatted_questions
            }
        except Exception as e:
            submit_error_with_message = request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.submit_error_with_message', 'Error al enviar la respuesta: %s')
            return {'success': False, 'error': submit_error_with_message % str(e)}

    @http.route('/survey/validate_token', type='json', auth='public', website=True, methods=['POST'])
    def validate_token(self, survey_id, access_token):
        try:
            user_input = request.env['survey.user_input'].sudo().search([
                ('survey_id', '=', int(survey_id)),
                ('access_token', '=', access_token),
                ('state', '=', 'in_progress')
            ], limit=1)
            return {'success': bool(user_input)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    @http.route('/survey/get_config_params', type='json', auth='public', website=True)
    def get_config_params(self):
        params = {
            'survey_not_found': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.survey_not_found', '¡Ups! El quiz con ID %s no existe.'),
            'back_to_home': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.back_to_home', 'Volver al inicio'),
            'loading_questions': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.loading_questions', '¡Cargando preguntas...'),
            'session_expired': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.session_expired', 'sesión ha expirado'),
            'login': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.login', 'Iniciar sesión'),
            'answers_count': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.answers_count', '%s Answers'),
            'question_progress': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.question_progress', 'Pregunta %s de %s'),
            'timer_format': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.timer_format', '%ss'),
            'loading_question': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.loading_question', 'Cargando pregunta...'),
            'icon_skipped': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.icon_skipped', '❓'),
            'icon_correct': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.icon_correct', '✅'),
            'icon_incorrect': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.icon_incorrect', '❌'),
            'feedback_correct': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.feedback_correct', '¡Correcto! 🎉'),
            'feedback_incorrect': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.feedback_incorrect', 'Incorrecto ❌'),
            'submit_error': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.submit_error', 'Error al enviar la respuesta.'),
            'submit_error_with_message': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.submit_error_with_message', 'Error al enviar la respuesta: %s'),
            'previous_button': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.previous_button', 'Anterior'),
            'next_button': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.next_button', 'Siguiente'),
            'invalid_token': request.env['ir.config_parameter'].sudo().get_param('theme_ninja_quiz.invalid_token', '¡Token inválido! Por favor, ingresa un PIN válido.'),
        }
        return params