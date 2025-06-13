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
        'views/snippets.xml', 
    ],
    'assets': {
        'web.assets_frontend': [
            'quiz_kahoot_functional/static/src/services/SurveyDataService.js',
            'quiz_kahoot_functional/static/src/components/kahoot_template.js',
            'quiz_kahoot_functional/static/src/components/kahoot_state.js',
            'quiz_kahoot_functional/static/src/components/kahoot_runner.js',
            'quiz_kahoot_functional/static/src/widgets/public_widget.js', 
        ],
    },
    'application': True,
    'installable': True,
}