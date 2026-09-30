/**
 * ============================================================================
 * VERCEL SERVERLESS FUNCTION HANDLER
 * Este archivo es el punto de entrada para Vercel Serverless Functions
 * ============================================================================
 */

const app = require('../server');

// Exportar la app de Express para Vercel
module.exports = app;
