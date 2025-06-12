/** @odoo-module */

import { Component, xml } from "@odoo/owl";

export class KahootSurveyRunner extends Component {
    static template = xml`<div>Hola Mundo</div>`;
    
    setup() {
        // El setup está vacío. No hacemos nada.
        console.log("Componente 'Hola Mundo' montado.");
    }
}