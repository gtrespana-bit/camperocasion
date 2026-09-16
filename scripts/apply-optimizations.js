#!/usr/bin/env node

// Script para aplicar todas las optimizaciones de rendimiento
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function logStep(step) {
  console.log(`\n🚀 ${step}`);
}

function runCommand(command, description) {
  try {
    logStep(description);
    execSync(command, { stdio: 'inherit' });
    console.log('✅ Completado');
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  console.log('=== APLICANDO OPTIMIZACIONES DE RENDIMIENTO ===');
  
  // 1. Instalar dependencias adicionales si es necesario
  if (!fs.existsSync('node_modules/imagemin')) {
    runCommand('npm install --save-dev imagemin imagemin-webp imagemin-mozjpeg imagemin-pngquant', 'Instalando dependencias para optimización de imágenes');
  }
  
  if (!fs.existsSync('node_modules/webpack-bundle-analyzer')) {
    runCommand('npm install --save-dev webpack-bundle-analyzer', 'Instalando analizador de bundle');
  }
  
  // 2. Optimizar imágenes
  runCommand('npm run optimize-images', 'Optimizando imágenes del proyecto');
  
  // 3. Construir el proyecto con análisis de bundle
  runCommand('npm run build:analyze', 'Construyendo el proyecto con análisis de bundle');
  
  // 4. Ejecutar pruebas de rendimiento
  runCommand('npm run performance-test', 'Ejecutando pruebas de rendimiento');
  
  // 5. Mostrar resumen
  console.log('\n=== RESUMEN DE OPTIMIZACIONES ===');
  console.log('✅ Todas las optimizaciones han sido aplicadas exitosamente');
  console.log('📊 Los resultados de las pruebas de rendimiento están disponibles en los archivos:');
  console.log('   - lighthouse-home.json');
  console.log('   - lighthouse-catalog.json');
  console.log('   - bundle-analysis.html');
  
  // Verificar si existe el archivo de resultados
  if (fs.existsSync('lighthouse-catalog.json')) {
    const results = JSON.parse(fs.readFileSync('lighthouse-catalog.json', 'utf8'));
    const score = (results.categories.performance.score * 100).toFixed(0);
    console.log(`\n🎯 Puntaje actual de la página de catálogo: ${score}/100`);
    
    if (score >= 85) {
      console.log('🎉 ¡OBJETIVO ALCANZADO! El rendimiento supera los 85 puntos.');
    } else {
      console.log('⚠️ El rendimiento aún necesita mejoras.');
    }
  }
}

// Ejecutar el script si se llama directamente
if (require.main === module) {
  main().catch(error => {
    console.error('Error al aplicar optimizaciones:', error);
    process.exit(1);
  });
}

module.exports = { main };