#!/usr/bin/env node

// Script para optimizar imágenes del proyecto
const fs = require('fs');
const path = require('path');
const imagemin = require('imagemin');
const imageminWebp = require('imagemin-webp');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');

async function optimizeImages() {
  console.log('Optimizando imágenes...');
  
  try {
    // Optimizar imágenes JPG/JPEG
    await imagemin(['public/**/*.jpg', 'public/**/*.jpeg'], {
      destination: 'public',
      plugins: [
        imageminMozjpeg({ quality: 70 }),
      ]
    });
    
    // Optimizar imágenes PNG
    await imagemin(['public/**/*.png'], {
      destination: 'public',
      plugins: [
        imageminPngquant({ quality: [0.6, 0.8] }),
      ]
    });
    
    // Convertir imágenes a WebP
    await imagemin(['public/**/*.{jpg,jpeg,png}'], {
      destination: 'public',
      plugins: [
        imageminWebp({ quality: 75 })
      ]
    });
    
    console.log('Optimización de imágenes completada exitosamente.');
  } catch (error) {
    console.error('Error al optimizar imágenes:', error);
    process.exit(1);
  }
}

// Ejecutar el script si se llama directamente
if (require.main === module) {
  optimizeImages();
}

module.exports = { optimizeImages };