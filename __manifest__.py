
{
    'name': 'Quiz Kahoot Engine',
    'description': 'Módulo funcional que provee la lógica para un quiz interactivo tipo Kahoot.',
    'category': 'Website/Survey',
    'version': '17.0.1.0',
    'author': 'Martin Brusco',
    'license': 'LGPL-3',
    'depends': ['website', 'survey'],
    'data': [
        'data/quiz_data.xml',
        'views/survey_views.xml',
        'views/play_templates.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'quiz_kahoot_functional/static/src/js/lib/SurveyDataService.js',
            'quiz_kahoot_functional/static/src/js/lib/StateManager.js',
            'quiz_kahoot_functional/static/src/js/kahoot_survey_runner.js',
            'quiz_kahoot_functional/static/src/js/lib/mountComponent.js',
        ],
        'web.assets_backend': [],
    },
    'application': True,
    'installable': True,
}