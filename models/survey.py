# quiz_kahoot_functional/models/survey.py
from odoo import models, fields

class SurveyQuestion(models.Model):
    _inherit = "survey.question"

    explanation = fields.Text("Explicación", help="Explicación que se muestra después de responder la pregunta.")