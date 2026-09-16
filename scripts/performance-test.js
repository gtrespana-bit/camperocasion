#!/usr/bin/env node

// Script para pruebas de rendimiento automatizadas
const { exec } = require('child_process');
const fs = require('fs');

async function runLighthouseTest(url, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = `npx lighthouse ${url} --output=json --output-path=${outputPath} --quiet --chrome-flags="--headless"`;
    
    console.log(`Ejecutando prueba de Lighthouse para: ${url}`);
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al ejecutar Lighthouse: ${error}`);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.warn(`Advertencias de Lighthouse: ${stderr}`);
      }
      
      console.log(`Prueba completada. Resultados guardados en: ${outputPath}`);
      resolve();
    });
  });
}

async function analyzeResults(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const scores = data.categories;
    
    console.log('\n=== RESULTADOS DE RENDIMIENTO ===');
    console.log(`Performance: ${(scores.performance.score * 100).toFixed(0)}/100`);
    console.log(`Accessibility: ${(scores.accessibility.score * 100).toFixed(0)}/100`);
    console.log(`Best Practices: ${(scores['best-practices'].score * 100).toFixed(0)}/100`);
    console.log(`SEO: ${(scores.seo.score * 100).toFixed(0)}/100`);
    
    // Métricas específicas
    const metrics = data.audits;
    console.log('\n=== MÉTRICAS CLAVE ===');
    console.log(`FCP: ${metrics['first-contentful-paint'].numericValue} ms`);
    console.log(`LCP: ${metrics['largest-contentful-paint'].numericValue} ms`);
    console.log(`TBT: ${metrics['total-blocking-time'].numericValue} ms`);
    console.log(`CLS: ${metrics['cumulative-layout-shift'].numericValue}`);
    
    return scores.performance.score;
  } catch (error) {
    console.error('Error al analizar resultados:', error);
    return null;
  }
}

async function main() {
  try {
    // Ejecutar pruebas para la página principal y el catálogo
    await runLighthouseTest('https://vendet.online', 'lighthouse-home.json');
    await runLighthouseTest('https://vendet.online/catalogo', 'lighthouse-catalog.json');
    
    // Analizar resultados
    const homeScore = await analyzeResults('lighthouse-home.json');
    const catalogScore = await analyzeResults('lighthouse-catalog.json');
    
    console.log('\n=== RESUMEN ===');
    console.log(`Puntaje Home: ${(homeScore * 100).toFixed(0)}/100`);
    console.log(`Puntaje Catálogo: ${(catalogScore * 100).toFixed(0)}/100`);
    
    // Verificar si se alcanzó el objetivo
    if (catalogScore >= 0.85) {
      console.log('\n✅ ¡OBJETIVO ALCANZADO! El rendimiento del catálogo supera los 85 puntos.');
    } else {
      console.log('\n⚠️ El rendimiento del catálogo aún necesita mejoras.');
      console.log(`   Objetivo: 85+ puntos, Actual: ${(catalogScore * 100).toFixed(0)} puntos`);
    }
  } catch (error) {
    console.error('Error en las pruebas de rendimiento:', error);
    process.exit(1);
  }
}

// Ejecutar el script si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { runLighthouseTest, analyzeResults };