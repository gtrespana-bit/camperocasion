// Script para generar ~130 publicaciones realistas
// Ejecutar: node scripts/generar-publicaciones.js
// Require: SUPABASE_URL y SUPABASE_SERVICE_KEY en .env.local o como vars de entorno

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const https = require('https')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Falta SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.local')
  console.error('Añade: SUPABASE_SERVICE_KEY=eyJhbGc...')
  process.exit(1)
}

const supabase = require('@supabase/supabase-js').createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Nombres venezolanos comunes
const NOMBRES = [
  'Carlos Méndez', 'María González', 'José Ramírez', 'Ana Rodríguez', 'Pedro Martínez',
  'Luis Hernández', 'Carmen López', 'Miguel Torres', 'Rosa Díaz', 'Francisco Pérez',
  'Lucía Morales', 'Diego Vargas', 'Isabel Castro', 'Andrés Ruiz', 'Patricia Flores',
  'Ricardo Silva', 'Gabriela Herrera', 'Javier Mendoza', 'Daniela Rojas', 'Oscar Jiménez',
  'Alejandra Medina', 'Fernando Navarro', 'Valentina Ortiz', 'Guillermo Reyes', 'Mariana Soto',
  'Manuel Aguilar', 'Sofía Gutiérrez', 'Raúl Campos', 'Andrea Delgado', 'Héctor Molina',
  'Natalia Peña', 'Sergio Guerrero', 'Laura Romero', 'Daniel Acosta', 'Claudia Suárez',
  'Eduardo Ríos', 'Camila Domínguez', 'Alberto León', 'Paula Contreras', 'Roberto Mendoza',
]

const ESTADOS_VE = [
  'Distrito Capital', 'Miranda', 'Carabobo', 'Lara', 'Zulia',
  'Aragua', 'Anzoategui', 'Bolivar', 'Merida', 'Tachira',
]

const CIUDADES = {
  'Distrito Capital': ['Caracas', 'Chacao', 'Baruta', 'El Hatillo'],
  'Miranda': ['Los Teques', 'Guarenas', 'Guatire', 'Cúa'],
  'Carabobo': ['Valencia', 'Guacara', 'San Diego', 'Naguanagua'],
  'Lara': ['Barquisimeto', 'Cabudare', 'Carora'],
  'Zulia': ['Maracaibo', 'Cabimas', 'San Francisco'],
  'Aragua': ['Maracay', 'Turmero', 'La Victoria', 'Palo Negro'],
  'Anzoategui': ['Puerto Ordaz', 'Barcelona', 'Lechería', 'El Tigre'],
  'Bolivar': ['Puerto Ordaz', 'Ciudad Guayana', 'Upata'],
  'Merida': ['Mérida', 'Tovar', 'Ejido', 'El Vigía'],
  'Tachira': ['San Cristóbal', 'Táriba', 'Colon'],
}

// Fotos de ejemplo reales (Unsplash/Pexels URLs — gratuitas, no requieren API)
// Usamos picsum como placeholder, luego reemplazamos con URLs reales
const FOTOS_CATEGORIA = {
  vehiculos: [
    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1542362567-b07e54358753?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd77?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=600&h=600&fit=crop',
  ],
  tecnologia: [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&h=600&fit=crop',
  ],
  moda: [
    'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop',
  ],
  hogar: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=600&fit=crop',
  ],
  herramientas: [
    'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&h=600&fit=crop',
  ],
  otros: [
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=600&fit=crop',
  ],
}

// Definiciones de productos realistas con precios en USD para Venezuela
const PRODUCTOS = {
  vehiculos: [
    { sub: 'Carros', titulo: 'Toyota Corolla 2018 automatico', desc: 'Toyota Corolla 2018, automatico, 65.000 km. Unico dueno, todos los documentos al dia, papeles al corriente. Aire acondicionado, vidrios electricos, direccional hidraulica. Motor excelente, no requiere ningun mantenimiento inmediato.', precio: 8500, estado: 'Usado', img: 0 },
    { sub: 'Carros', titulo: 'Ford Fiesta 2015 buen estado', desc: 'Ford Fiesta 2015 modelo SE, motor 1.6, bien cuidado. Tapiz de cuero, equipo de sonido con bluetooth. Tiene unas marcas leves en la puerta derecha pero nada grave. Neumaticos con 60% de vida.', precio: 4200, estado: 'Usado', img: 1 },
    { sub: 'Carros', titulo: 'Chevrolet Aveo 2020 como nuevo', desc: 'Chevrolet Aveo 2020, 25.000 km reales. Siempre guardado en garage. Frenos y filtros cambiados hace poco. Ideal para el dia a dia, economico en gasolina.', precio: 6800, estado: 'Como nuevo', img: 0 },
    { sub: 'Carros', titulo: 'Kia Picanto 2019 economico', desc: 'Kia Picanto 2019, automatico. Perfecto para la ciudad, super economico de gasolina. Solo 30.000 km. Lo vendo porque me compre uno mas grande.', precio: 5500, estado: 'Bueno', img: 1 },
    { sub: 'Carros', titulo: 'Nissan Sentra B18 2021', desc: 'Nissan Sentra B18 full equipo, camara de reversa, pantalla tactil, sensores de parqueo. 18.000 km. Siempre en garage bajo techo.', precio: 12000, estado: 'Como nuevo', img: 0 },
    { sub: 'Camionetas/SUV', titulo: 'Toyota Fortuner 2017 4x4', desc: 'Toyota Fortuner 2017 diesel 4x4, excelente para terrenos dificiles. 85.000 km. Traccion en las 4 ruedas funcionando perfecto. Aire dual.', precio: 18000, estado: 'Bueno', img: 0 },
    { sub: 'Camionetas/SUV', titulo: 'Ford Explorer 2016 limited', desc: 'Ford Explorer 2016 edition Limited, asientos en cuero tercera fila de asientos. 70.000 km. Mantenimiento siempre en concesionario.', precio: 13000, estado: 'Usado', img: 1 },
    { sub: 'Camionetas/SUV', titulo: 'Chevrolet D-Max 2019 doble cabina', desc: 'Chevrolet D-Max 2019, doble cabina 4x4, caja corta. Perfecta para trabajo o campo. Motor diesel turbody, muy economica.', precio: 15500, estado: 'Bueno', img: 0 },
    { sub: 'Camionetas/SUV', titulo: 'Jeep Wrangler 2015 Sport', desc: 'Jeep Wrangler 2015 Sport, techo removable, puertas desmontables. Motor 3.6 V6. Diferencial trasero bloqueable. Pura diversion.', precio: 16000, estado: 'Usado', img: 1 },
    { sub: 'Motos', titulo: 'Bera S1 250cc 2023', desc: 'Bera S1 250cc, modelo 2023 con solo 3.000 km. Frenos de disco, luces LED. Como salida del concesionario, con caja y manuales.', precio: 950, estado: 'Nuevo', img: 0 },
    { sub: 'Motos', titulo: 'Empire Keeway 150cc negra', desc: 'Keeway RKS 150, modelo 2022. Arranca de una, no consume aceite. Neumaticos nuevos. La vendo porque necesito carro.', precio: 650, estado: 'Bueno', img: 0 },
    { sub: 'Motos', titulo: 'Venom VTR 200 2023 roja', desc: 'Venom VTR 200, 2023, 1.500 km. Deportiva, muy rapida. Escape original. Seguro y placa vigentes.', precio: 850, estado: 'Como nuevo', img: 0 },
    { sub: 'Motos', titulo: 'Yamaha FZ 250 2020', desc: 'Yamaha FZ250 FI, inyectada, super economica de gasolina. 20.000 km. Cambios de aceite a tiempo. Llantas trasera nueva.', precio: 1200, estado: 'Bueno', img: 0 },
    { sub: 'Motos', titulo: 'Honda CB190R 2022 blanca', desc: 'Honda CB190R 2022, ABS, digital. 8.000 km. Siempre en garage, lavada semanalmente. Documentacion al dia.', precio: 1100, estado: 'Como nuevo', img: 0 },
    { sub: 'Motos', titulo: 'Bera BTR 150 seminueva', desc: 'Bera BTR 150cc 2021. Tipo naked, comoda para ciudad. 15.000 km. No necesita nada, lista para rodar.', precio: 450, estado: 'Usado', img: 0 },
    { sub: 'Motos', titulo: 'Suzuki GN 125 clasica', desc: 'Suzuki GN125 clasica, ideal para principiantes. 25.000 km. Motor confiable y sencillo de mantener. Incluye casco.', precio: 400, estado: 'Usado', img: 0 },
    { sub: 'Repuestos y Accesorios', titulo: 'Llantas Michelin 205/55 R16', desc: 'Juego de 4 llantas Michelin Primacy 205/55 R16, rodadas 5.000 km como nuevas. Se cambian por medida de vehiculo nuevo.', precio: 180, estado: 'Como nuevo', img: 0 },
    { sub: 'Repuestos y Accesorios', titulo: 'Radio Android para Toyota Corolla', desc: 'Pantalla Android 10 pulgadas compatible con Toyota Corolla 2014-2019. Camara de reversa incluida. Instalada 2 meses, funciona perfecto.', precio: 120, estado: 'Como nuevo', img: 0 },
    { sub: 'Repuestos y Accesorios', titulo: 'Parachoques Ford Fiesta 2015 delantero', desc: 'Parachoques delantero original Ford para Fiesta 2013-2016. Color blanco, sin golpes. Incluye parrilla y neblineros.', precio: 85, estado: 'Bueno', img: 0 },
  ],
  tecnologia: [
    { sub: 'Celulares', titulo: 'iPhone 14 Pro 128GB negro', desc: 'iPhone 14 Pro 128GB, espacio negro. Battery health 89%. Sin rayones, siempre con funda y protector de pantalla. Liberado de fabrica. Incluye cargador y caja original.', precio: 580, estado: 'Bueno', img: 0 },
    { sub: 'Celulares', titulo: 'Samsung Galaxy A54 128GB', desc: 'Samsung Galaxy A54 128GB, 8GB RAM. Color violeta. Comprado en noviembre 2023, garantia vigente hasta marzo 2025. Pantalla perfecta, no se ha caido.', precio: 220, estado: 'Como nuevo', img: 0 },
    { sub: 'Celulares', titulo: 'Xiaomi Redmi Note 12 Pro', desc: 'Xiaomi Redmi Note 12 Pro 256GB, camara de 200MP. Color negro. Poco uso, viene con funda y vidrio templado. Dual SIM.', precio: 180, estado: 'Bueno', img: 0 },
    { sub: 'Celulares', titulo: 'iPhone 13 128GB azul', desc: 'iPhone 13 azul 128GB, bateria 86%. Face ID funcionando. Sin detalles en pantalla. Viene con cargador original.', precio: 380, estado: 'Bueno', img: 0 },
    { sub: 'Celulares', titulo: 'Samsung Galaxy S23 256GB', desc: 'Samsung S23 256GB, color verde. Procesador Snapdragon 8 Gen 2. Compra en Enero 2024. Todo funciona perfecto.', precio: 450, estado: 'Bueno', img: 0 },
    { sub: 'Celulares', titulo: 'Motorola Edge 40 Neo', desc: 'Motorola Edge 40 Neo 256GB, 128GB RAM. Color negro. Camara excelente, pantalla 144Hz. Con su caja y accesorios.', precio: 250, estado: 'Como nuevo', img: 0 },
    { sub: 'Celulares', titulo: 'OPPO A78 128GB nuevo', desc: 'OPPO A78 128GB, nuevo en caja. No lo abri. Me lo regalaron y ya tengo celular. 128GB almacenamiento, camara de 50MP.', precio: 140, estado: 'Nuevo', img: 0 },
    { sub: 'Laptops', titulo: 'MacBook Air M1 2020 256GB', desc: 'MacBook Air M1 2020, 8GB RAM, 256GB SSD. Ciclo de bateria: 186. Super rapida para trabajo y estudio. Sin detalles esteticos.', precio: 520, estado: 'Bueno', img: 0 },
    { sub: 'Laptops', titulo: 'HP Pavilion 15 Ryzen 5 2022', desc: 'HP Pavilion 15, AMD Ryzen 5 5500U, 8GB RAM, 256GB SSD. Pantalla 15.6 Full HD. Ideal para estudiantes. Incluye cargador.', precio: 320, estado: 'Bueno', img: 0 },
    { sub: 'Laptops', titulo: 'Lenovo ThinkPad T480 i5 8va gen', desc: 'Lenovo ThinkPad T480, Intel Core i5 8va generacion, 16GB RAM, 512GB SSD. Perfecta para programar o trabajar. Bateria dura 6 horas.', precio: 280, estado: 'Bueno', img: 0 },
    { sub: 'Laptops', titulo: 'Asus VivoBook 14 Ryzen 7', desc: 'ASUS VivoBook 14, Ryzen 7 5800H, 16GB RAM, 512GB NVMe. Pantalla OLED. Potente para diseno y edicion de video.', precio: 420, estado: 'Como nuevo', img: 0 },
    { sub: 'Laptops', titulo: 'Dell Inspiron 15 3000 i3', desc: 'Dell Inspiron 15, Intel i3-1115G4, 8GB RAM, 128GB SSD con Windows 11. Básica pero funcional para oficina y estudio.', precio: 180, estado: 'Usado', img: 0 },
    { sub: 'PC Escritorio', titulo: 'PC Gamer RTX 3060 16GB RAM', desc: 'PC de escritorio gaming: Ryzen 5 5600X, RTX 3060 12GB, 16GB RAM DDR4, 500GB NVMe + 1TB HDD. RGB, gabinete con vidrio templado. Corre todo en alto.', precio: 650, estado: 'Como nuevo', img: 0 },
    { sub: 'PC Escritorio', titulo: 'PC oficina i5 10ma 8GB RAM', desc: 'PC de oficina: Intel i5-10400, 8GB RAM, 256GB SSD. Incluye monitor Dell 22 pulgadas, teclado y mouse. Todo funcionando.', precio: 220, estado: 'Usado', img: 0 },
    { sub: 'Consolas', titulo: 'PlayStation 5 Digital Edition', desc: 'PS5 Digital Edition, incluye 2 mandos DualSense. Comprada en diciembre 2023. Poco uso, funciona impecable. Viene con 5 juegos digitales.', precio: 320, estado: 'Como nuevo', img: 0 },
    { sub: 'Consolas', titulo: 'Nintendo Switch OLED blanca', desc: 'Nintendo Switch OLED, modelo blanco. Incluye 3 juegos fisicos (Mario Kart, Zelda, Animal Crossing). Con dock y funda.', precio: 250, estado: 'Bueno', img: 0 },
    { sub: 'Consolas', titulo: 'Xbox Series S 512GB', desc: 'Xbox Series S, 512GB. Con Game Pass Ultimate hasta agosto. Incluye mando extra. Perfecta para jugar en family.', precio: 180, estado: 'Bueno', img: 0 },
    { sub: 'Consolas', titulo: 'PS4 Slim 1TB + 10 juegos', desc: 'PlayStation 4 Slim 1TB con 10 juegos en disco (FIFA 24, GTA, RDR2, God of War, etc.). 2 mandos, todos originales.', precio: 160, estado: 'Usado', img: 0 },
  ],
  moda: [
    { sub: 'Ropa Mujer', titulo: 'Vestido Zara talla M nuevo', desc: 'Vestido de Zara talla M, negro, nuevo con etiquetas. Lo compré pero nunca me lo puse. Tela de buena calidad, ideal para ocasiones especiales.', precio: 35, estado: 'Nuevo', img: 0 },
    { sub: 'Ropa Mujer', titulo: 'Zapatillas Nike Air Max 90 talla 38', desc: 'Nike Air Max 90, talla 38. Color blanco y rosa. Usadas 2 veces, como nuevas. Con caja original.', precio: 55, estado: 'Como nuevo', img: 0 },
    { sub: 'Ropa Mujer', titulo: 'Bolso Michael Kors original', desc: 'Bolso Michael Kors Jet Set mediano, color marron. 100% original, viene con tarjeta de autenticidad y bolsa de marca. Poco uso.', precio: 80, estado: 'Bueno', img: 0 },
    { sub: 'Ropa Hombre', titulo: 'Camisa Polo Ralph Lauren L', desc: 'Polo Ralph Lauren talla L, color azul marino. Original, comprada en USA. Usada pocas veces, en perfecto estado.', precio: 25, estado: 'Como nuevo', img: 0 },
    { sub: 'Ropa Hombre', titulo: 'Jeans Levi\'s 501 talla 32', desc: 'Levi\'s 501 original, talla 32x32. Color azul oscuro clasico. Usados un par de veces, estan como nuevos.', precio: 30, estado: 'Como nuevo', img: 0 },
    { sub: 'Ropa Hombre', titulo: 'Zapatillas Adidas Ultraboost talla 42', desc: 'Adidas Ultraboost 22, talla 42. Negras. Ideales para correr, muy comodas. 6 meses de uso, buen estado.', precio: 45, estado: 'Bueno', img: 0 },
    { sub: 'Relojes', titulo: 'Casio G-Shock GA-2100 negro', desc: 'Casio G-Shock GA-2100 CasioOak, negro. Resistente al agua, solar. Comprado este ano, en perfecto estado con caja.', precio: 55, estado: 'Como nuevo', img: 0 },
    { sub: 'Relojes', titulo: 'Reloj smartwatch Xiaomi Band 8', desc: 'Xiaomi Smart Band 8, nueva en caja. Monitor de sueno, pasos, notificaciones. Resistente al agua. Correa extra incluida.', precio: 25, estado: 'Nuevo', img: 0 },
    { sub: 'Accesorios', titulo: 'Gafas de sol Ray-Ban Aviator', desc: 'Ray-Ban Aviator Classic, cristales polarizados. Originales, con estuche y limpiador. Sin rayones en los cristales.', precio: 60, estado: 'Como nuevo', img: 0 },
    { sub: 'Accesorios', titulo: 'Mochila Nike Heritage 2.0', desc: 'Mochila Nike Heritage 2.0, color gris. Nueva, sin estrenar. Perfecta para laptop de hasta 15 pulgadas. Espacio amplio.', precio: 20, estado: 'Nuevo', img: 0 },
  ],
  hogar: [
    { sub: 'Muebles', titulo: 'Sofa cama 3 puestos gris', desc: 'Sofa cama de 3 puestos, color gris, tela antimanchas. Compra hace 2 anos, en buen estado. Se convierte en cama individual. Retirar en persona.', precio: 250, estado: 'Bueno', img: 0 },
    { sub: 'Muebles', titulo: 'Mesa de comedor 6 puestos madera', desc: 'Mesa de comedor de madera maciza para 6 personas. Color natural. Solidas y duraderas. Incluye 4 sillas (no las 6).', precio: 180, estado: 'Bueno', img: 0 },
    { sub: 'Muebles', titulo: 'Escritorio con cajones blanco', desc: 'Escritorio blanco de 120cm con 3 cajones. Ideal para home office. Estructura de melamina, muy resistente. Facil armado.', precio: 65, estado: 'Como nuevo', img: 0 },
    { sub: 'Electrodomesticos', titulo: 'Nevera Mabe 14 pies blanca', desc: 'Nevera Mabe de 14 pies cubic, color blanco. Funcionando perfecto, enfria muy bien. Frost-free. 3 anos de uso.', precio: 280, estado: 'Bueno', img: 0 },
    { sub: 'Electrodomesticos', titulo: 'Lavadora Samsung 16kg automatica', desc: 'Lavadora Samsung 16kg, automatica, carga superior. Digital inverter, muy silenciosa. 2 anos de uso, mantenimiento al dia.', precio: 320, estado: 'Bueno', img: 0 },
    { sub: 'Electrodomesticos', titulo: 'Aire acondicionado split 12000 BTU', desc: 'A/C split 12000 BTU, marca Carrier. Frio y calor. Instalado hace 1 ano, funcionando excelente. Se retira por mudanza.', precio: 250, estado: 'Bueno', img: 0 },
    { sub: 'Electrodomesticos', titulo: 'Microondas LG 20 litros negro', desc: 'Microondas LG de 20 litros, color negro. Grill incluido. Funcionando perfecto, 1 ano de uso. Con manual.', precio: 45, estado: 'Bueno', img: 0 },
    { sub: 'Electrodomesticos', titulo: 'Cocina Indurama 4 hornillas acero', desc: 'Cocina Indurama de 4 hornillas con horno, acero inoxidable. Encendido electrico. 6 meses de uso, impecable.', precio: 180, estado: 'Como nuevo', img: 0 },
    { sub: 'Cocina', titulo: 'Juego de ollas Tramontina 10 piezas', desc: 'Set Tramontina de 10 piezas, acero inoxidable. Incluye ollas y sartenes. Mango de silicone resistente al calor. Nuevo en caja.', precio: 55, estado: 'Nuevo', img: 0 },
    { sub: 'Decoracion', titulo: 'Cuadro abstracto grande 80x60', desc: 'Cuadro de arte abstracto en lienzo, 80x60cm. Colores vivos, marco de aluminio negro. Perfecto para sala.', precio: 40, estado: 'Nuevo', img: 0 },
    { sub: 'Decoracion', titulo: 'Lampara de pie LED regulable', desc: 'Lampara de pie tipo arco, LED con regulador de intensidad. Color negro mate. Altura ajustable hasta 180cm. Nueva.', precio: 35, estado: 'Nuevo', img: 0 },
  ],
  herramientas: [
    { sub: 'Herramientas Electricas', titulo: 'Taladro DeWalt 20V con 2 baterias', desc: 'Taladro percutor DeWalt 20V MAX, incluye 2 baterias de 2Ah y cargador. Uso domestico, funciona perfecto. Con maletin.', precio: 85, estado: 'Bueno', img: 0 },
    { sub: 'Herramientas Electricas', titulo: 'Amoladora angular Bosch 7 pulgadas', desc: 'Amoladora Bosch GWS 22-230, 2200W, 230mm. Potente, usada en pocas obras. Incluye disco de corte nuevo.', precio: 60, estado: 'Bueno', img: 0 },
    { sub: 'Herramientas Electricas', titulo: 'Sierra circular Makita 185mm', desc: 'Sierra circular Makita 5008MG, 185mm, 1400W. Guia laser integrada. Con disco de 24 dientes. Excelente para cortes rectos.', precio: 75, estado: 'Bueno', img: 0 },
    { sub: 'Herramientas Manuales', titulo: 'Juego de llaves Stanley 40 piezas', desc: 'Set completo de llaves Stanley, combinadas y de estrella. 40 piezas en maletin. Cromo-vanadio, calidad profesional.', precio: 35, estado: 'Como nuevo', img: 0 },
    { sub: 'Herramientas Manuales', titulo: 'Caja de herramientas Stanley 20 pulgadas', desc: 'Caja de herramientas Stanley de 20 pulgadas, 3 bandejas. Resistente, con cerradura. Ideal para organizar todo.', precio: 25, estado: 'Bueno', img: 0 },
    { sub: 'Herramientas Manuales', titulo: 'Nivel laser Bosch Professional', desc: 'Nivel laser lineal Bosch GLL 2-15, auto nivelante. Incluye bracket y bolsa. Precision de +-0.3mm/m.', precio: 50, estado: 'Bueno', img: 0 },
    { sub: 'Herramientas de Jardin', titulo: 'Podadora de cesped a gasolina', desc: 'Podadora Truper de 21 pulgadas, motor a gasolina Briggs & Stratton. 4 tiempos, sin aceite. Corta bien, tiene 2 anos.', precio: 120, estado: 'Bueno', img: 0 },
  ],
  otros: [
    { sub: 'Inmuebles', titulo: 'Apartamento 2 habitaciones en Maracay', desc: 'Apartamento de 2 habitaciones, 1 bano, sala-comedor, cocina pequeña. 65m2 en 3er piso. Sector centro, cerca de todo. Incluye puesto de estacionamiento. Alquiler o venta.', precio: 35000, estado: 'Usado', img: 0 },
    { sub: 'Inmuebles', titulo: 'Terreno 1000m2 en Guatire', desc: 'Terreno plano de 1000 metros cuadrados en Guatire, Miranda. Zona residencial, todos los servicios. Papeles al dia, titulo registrado.', precio: 15000, estado: 'Nuevo', img: 0 },
    { sub: 'Inmuebles', titulo: 'Local comercial 40m2 en Valencia', desc: 'Local de 40m2 en centro comercial de Valencia. Planta baja, buena iluminacion. Banio incluido. Ideal para peluqueria o tienda pequena.', precio: 500, estado: 'Bueno', img: 0 },
    { sub: 'Deportes', titulo: 'Bicicleta MTB rodada 29 Shimano', desc: 'Bicicleta de montana rodada 29, cuadro aluminio, 21 velocidades Shimano. Frenos de disco. 6 meses de uso, en perfecto estado.', precio: 180, estado: 'Bueno', img: 0 },
    { sub: 'Deportes', titulo: 'Cinta de correr elektrica ProForm', desc: 'Cinta de correr ProForm, motor 2.5HP, velocidad hasta 16km/h. Plegable. Display LED con programas. 1 ano de uso.', precio: 200, estado: 'Bueno', img: 0 },
    { sub: 'Deportes', titulo: 'Set de pesas 50kg completo', desc: 'Set de mancuernas y barra con 50kg de discos de hierro. Incluye barra recta de 180cm y discos variados (2.5, 5, 10kg).', precio: 85, estado: 'Usado', img: 0 },
    { sub: 'Mascotas', titulo: 'Jaula para perro grande nueva', desc: 'Jaula plegable para perros grandes, tamano L (90x60x70cm). Con bandeja recolectora y separador. Nueva, aun en caja.', precio: 40, estado: 'Nuevo', img: 0 },
    { sub: 'Mascotas', titulo: 'Alimento Royal Canin para gato 10kg', desc: 'Royal Canin Indoor 10kg para gatos adultos. Bolsa sellada, fecha de vencimiento 2026. Lo compré y mi gato no lo come.', precio: 30, estado: 'Nuevo', img: 0 },
    { sub: 'Mascotas', titulo: 'Pecera de vidrio 60 litros con filtro', desc: 'Pecera de 60 litros con filtro interno, termometro y LED. Incluye piedras decorativas y planta artificial. Todo funcionando.', precio: 45, estado: 'Bueno', img: 0 },
    { sub: 'Musica', titulo: 'Guitarra acustica Yamaha F310', desc: 'Yamaha F310 guitarra acustica, color natural. Cuerdas de nylon nuevas. Incluye estuche blando y afinador. Sonido excelente.', precio: 70, estado: 'Bueno', img: 0 },
    { sub: 'Musica', titulo: 'Teclado Casio CT-X700 61 teclas', desc: 'Casio CT-X700, 61 teclas sensibles al tacto. 600 sonidos, 195 ritmos Incluye. USB MIDI. Perfecto para aprender.', precio: 130, estado: 'Como nuevo', img: 0 },
    { sub: 'Libros', titulo: 'Coleccion Harry Potter 7 libros', desc: 'Coleccion completa de Harry Potter en español, edicion de bolsillo tapa blanda. Todos los 7 tomos en buen estado.', precio: 40, estado: 'Bueno', img: 0 },
    { sub: 'Juguetes', titulo: 'LEGO Star Wars Millennium Falcon', desc: 'LEGO Star Wars Millennium Falcon (set 75257), 1353 piezas. Armado una vez, todas las piezas incluidas con manual.', precio: 95, estado: 'Como nuevo', img: 0 },
    { sub: 'Juguetes', titulo: 'Hot Wheels pista Turbo Rally', desc: 'Pista Hot Wheels Turbo Rally, incluye 2 carritos. Funcionando perfecto, motores activos. Entretenida para ninos de 4+ anos.', precio: 25, estado: 'Bueno', img: 0 },
  ],
}

function randomArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(daysBack) {
  const now = Date.now()
  const past = now - (daysBack * 24 * 60 * 60 * 1000)
  return new Date(past + Math.random() * (now - past)).toISOString()
}

async function main() {
  console.log('🚀 Generando publicaciones para VendeT...\n')

  // Get categoria IDs
  const { data: categorias } = await supabase.from('categorias').select('id, nombre')
  if (!categorias) { console.error('Error getting categorias'); process.exit(1) }
  const catMap = {}
  categorias.forEach(c => { catMap[c.nombre] = c.id })

  // Get Ruben's user ID
  const { data: adminPerfil } = await supabase.from('perfiles').select('*').limit(1)
  if (!adminPerfil || adminPerfil.length === 0) {
    console.error('No profiles found. Make sure at least 1 user is registered.')
    process.exit(1)
  }
  const adminUserId = adminPerfil[0].id
  console.log(`✅ User ID (admin): ${adminUserId}`)

  let total = 0
  let errors = 0

  for (const [catKey, products] of Object.entries(PRODUCTOS)) {
    const categoriaId = catMap[catKey]
    if (!categoriaId) { console.warn(`⚠️  Categoria "${catKey}" no encontrada`); continue }

    console.log(`\n📂 Categoria: ${catKey} (${products.length} productos)`)

    for (const prod of products) {
      // Random fake profile
      const nombre = randomArray(NOMBRES)
      const estado = randomArray(ESTADOS_VE)
      const ciudad = randomArray(CIUDADES[estado])

      // Random date between 1 and 45 days ago
      const creadoEn = randomDate(45)
      const actualizadoEn = new Date(new Date(creadoEn).getTime() + randomInt(0, 86400000)).toISOString()

      const productData = {
        user_id: adminUserId,
        titulo: prod.titulo,
        descripcion: prod.desc,
        categoria_id: categoriaId,
        subcategoria: prod.sub,
        marca: prod.titulo.match(/^(Toyota|Ford|Chevrolet|Nissan|Kia|Jeep|Bera|Empire|Venom|Yamaha|Honda|Suzuki|iPhone|Samsung|Xiaomi|OPPO|Motorola|MacBook|HP|Lenovo|Asus|Dell|PlayStation|Nintendo|Xbox|Zara|Nike|Adidas|Levi|Casio|Michael Kors|Ray-Ban|Mabe|Indurama|Tramontina|Truper|DeWalt|Bosch|Stanley|Makita|Royal Canon|LEGO|Carrier|LG)/)?.[1] || null,
        estado: prod.estado,
        precio_usd: prod.precio,
        ubicacion_estado: estado,
        ubicacion_ciudad: ciudad,
        imagen_url: FOTOS_CATEGORIA[catKey]?.[prod.img % FOTOS_CATEGORIA[catKey].length] || null,
        activo: true,
        destacado: false,
        visitas: randomInt(5, 200),
        creado_en: creadoEn,
        actualizado_en: actualizadoEn,
        // Store seller name in descripcion meta
      }

      const { error } = await supabase.from('productos').insert(productData)
      if (error) {
        console.error(`   ❌ Error inserting "${prod.titulo.substring(0, 40)}":`, error.message)
        errors++
      } else {
        total++
        console.log(`   ✅ ${prod.titulo.substring(0, 60)} - $${prod.precio} - ${nombre} en ${ciudad}`)
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100))
    }
  }

  console.log(`\n🎉 Done! ${total} products inserted, ${errors} errors.`)
  console.log('📝 Nota: Los productos usan fotos de Unsplash (URLs externas).')
  console.log('     Para producción, deberias descargar las fotos y subirlas al storage de Supabase.')
}

main().catch(err => { console.error(err); process.exit(1) })
