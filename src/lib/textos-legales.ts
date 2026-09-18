/**
 * Textos legales del sitio, en español e inglés y en un único módulo.
 *
 * POR QUÉ AQUÍ Y NO EN `src/i18n/dictionaries/*.json`
 * ==================================================
 * Los diccionarios son planos (`clave: texto`) y los documentos legales son
 * estructuras con secciones, párrafos y listas. Tenerlos como arrays tipados
 * evita numerar claves a mano (`s1_title`, `s1_text`, `s2_li3`…) y, sobre todo,
 * permite **comparar los dos idiomas de un vistazo**: si mañana cambia una
 * cláusula, se ve inmediatamente si falta su traducción.
 *
 * AVISO IMPORTANTE
 * ================
 * Estos textos describen **lo que el sitio hace de verdad** (qué datos se
 * piden, quién los trata, qué se cobra y qué no), que es lo que exige la
 * normativa: RGPD (arts. 13-14), LSSI (art. 10) y TRLGDCU (art. 27, deber de
 * informar de la condición de intermediario). No sustituyen a una revisión
 * profesional: antes de facturar conviene que un abogado les dé el visto bueno,
 * sobre todo a la cláusula de desistimiento del sistema de créditos.
 */

export type IdiomaLegal = 'es' | 'en'

export interface SeccionLegal {
  titulo: string
  parrafos?: string[]
  lista?: string[]
}

export interface DocumentoLegal {
  titulo: string
  actualizado: string
  entradilla: string
  secciones: SeccionLegal[]
}

const ACTUALIZADO: Record<IdiomaLegal, string> = {
  es: 'Última actualización: septiembre de 2026',
  en: 'Last updated: September 2026',
}

const BUZON_PRIVACIDAD = 'privacidad@camperocasion.online'
const BUZON_LEGAL = 'legal@camperocasion.online'

/* ══════════════════════════════════════════════════════════════════════════
   AVISO LEGAL — LSSI art. 10
   La sección 1 la genera la página con los datos del entorno (`datos-legales`).
   ══════════════════════════════════════════════════════════════════════════ */

export const AVISO_LEGAL: Record<IdiomaLegal, DocumentoLegal> = {
  es: {
    titulo: 'Aviso legal',
    actualizado: ACTUALIZADO.es,
    entradilla:
      'Información general sobre el titular de este sitio web, en cumplimiento del artículo 10 de la Ley 34/2002 de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE).',
    secciones: [
      {
        titulo: '1. Datos del titular',
        parrafos: [
          'Los datos identificativos del titular de camperocasion.online se muestran a continuación. Para cualquier comunicación puedes usar el correo indicado o el formulario de contacto.',
        ],
      },
      {
        titulo: '2. Objeto',
        parrafos: [
          'CamperOcasión es un servicio de intermediación en línea: un tablón donde particulares, camperizadores y profesionales publican anuncios de furgonetas camper y autocaravanas de ocasión, y donde los compradores los encuentran y contactan con ellos.',
          'El acceso y uso del sitio atribuye la condición de usuario y supone la aceptación de este aviso legal, de los términos y condiciones y de la política de privacidad.',
        ],
      },
      {
        titulo: '3. Condición de intermediario',
        parrafos: [
          'CamperOcasión no es el vendedor de los vehículos anunciados ni forma parte de la compraventa: no fija los precios, no cobra el importe del vehículo, no lo entrega y no responde de su estado, cargas o documentación. El contrato de compraventa se celebra directamente entre el vendedor y el comprador.',
          'Los servicios de pago que se ofrecen en la web (destacar un anuncio o subirlo al primer puesto) son servicios de visibilidad que contrata el propio vendedor con la plataforma y no tienen relación con el precio del vehículo.',
          'Los vendedores profesionales y camperizadores son los únicos responsables de cumplir las obligaciones que les correspondan como empresarios, incluida la garantía legal frente a consumidores; identificarse como profesionales es obligatorio al publicar.',
        ],
      },
      {
        titulo: '4. Propiedad intelectual e industrial',
        parrafos: [
          'El diseño, el código, los textos, las bases de datos y los elementos gráficos de este sitio pertenecen a su titular o se utilizan con autorización. Las fotografías y descripciones de cada anuncio pertenecen al usuario que los publica; al publicarlos, el usuario concede a CamperOcasión una licencia no exclusiva para mostrarlos en la plataforma y en sus canales de difusión (redes sociales y buscadores) con el fin de dar a conocer el anuncio.',
        ],
      },
      {
        titulo: '5. Contenidos de los usuarios',
        parrafos: [
          'El titular no es autor de los anuncios publicados y actúa como prestador de servicios de intermediación. No obstante, aplica moderación previa o posterior y retira de forma diligente los contenidos ilícitos, engañosos o que incumplen estas condiciones, en cuanto tiene conocimiento efectivo de ellos.',
          'Cualquier persona puede comunicar un contenido ilícito escribiendo a ' + BUZON_LEGAL + '; se revisará y, en su caso, se retirará.',
        ],
      },
      {
        titulo: '6. Enlaces',
        parrafos: [
          'El sitio puede incluir enlaces a páginas de terceros. El titular no controla esos contenidos ni responde de ellos.',
        ],
      },
      {
        titulo: '7. Protección de datos y cookies',
        parrafos: [
          'El tratamiento de datos personales se describe en la política de privacidad, y el uso de cookies y almacenamiento en el navegador, en la política de cookies.',
        ],
      },
      {
        titulo: '8. Legislación aplicable y reclamaciones',
        parrafos: [
          'Este aviso legal se rige por la legislación española. Para cualquier controversia con consumidores son competentes los tribunales que determine la normativa de consumo, sin que esta cláusula prive al consumidor de los derechos que le reconoce la ley de su domicilio.',
          'Puedes dirigir cualquier reclamación a ' + BUZON_LEGAL + ' o a través de la página de contacto; se contestará en el plazo más breve posible y, en todo caso, en los plazos legales. También puedes acudir a los organismos públicos de consumo de tu comunidad autónoma.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Legal notice',
    actualizado: ACTUALIZADO.en,
    entradilla:
      'General information about the owner of this website, as required by article 10 of Spanish Law 34/2002 on Information Society Services and Electronic Commerce (LSSI-CE).',
    secciones: [
      {
        titulo: '1. Owner details',
        parrafos: [
          'The identifying details of the owner of camperocasion.online are shown below. You can reach us at the email address provided or through the contact form.',
        ],
      },
      {
        titulo: '2. Purpose',
        parrafos: [
          'CamperOcasión is an online intermediation service: a noticeboard where private sellers, converters and dealers publish listings for second-hand camper vans and motorhomes, and where buyers find them and contact the sellers.',
          'By accessing or using the site you become a user and accept this legal notice, the terms and conditions and the privacy policy.',
        ],
      },
      {
        titulo: '3. Intermediary status',
        parrafos: [
          'CamperOcasión is not the seller of the advertised vehicles and is not part of the sale: it does not set prices, does not collect the vehicle price, does not deliver the vehicle and is not responsible for its condition, charges or paperwork. The sale contract is entered into directly between the seller and the buyer.',
          'The paid services offered on the site (featuring a listing or moving it to the top) are visibility services that the seller contracts with the platform and have no relation to the price of the vehicle.',
          'Professional sellers and converters are solely responsible for complying with their obligations as businesses, including the legal guarantee owed to consumers; identifying themselves as professionals when publishing is mandatory.',
        ],
      },
      {
        titulo: '4. Intellectual and industrial property',
        parrafos: [
          'The design, code, texts, databases and graphic elements of this site belong to its owner or are used with permission. The photographs and descriptions in each listing belong to the user who publishes them; by publishing, the user grants CamperOcasión a non-exclusive licence to display them on the platform and in its distribution channels (social networks and search engines) in order to promote the listing.',
        ],
      },
      {
        titulo: '5. User content',
        parrafos: [
          'The owner is not the author of the published listings and acts as an intermediary service provider. It does moderate content and diligently removes unlawful or misleading content, or content that breaches these conditions, as soon as it has actual knowledge of it.',
          'Anyone can report unlawful content by writing to ' + BUZON_LEGAL + '; it will be reviewed and, where appropriate, removed.',
        ],
      },
      {
        titulo: '6. Links',
        parrafos: [
          'The site may include links to third-party pages. The owner does not control and is not responsible for their content.',
        ],
      },
      {
        titulo: '7. Data protection and cookies',
        parrafos: [
          'How personal data is processed is described in the privacy policy, and the use of cookies and browser storage in the cookie policy.',
        ],
      },
      {
        titulo: '8. Governing law and complaints',
        parrafos: [
          'This legal notice is governed by Spanish law. For any dispute with consumers, the courts designated by consumer law shall have jurisdiction, without depriving the consumer of the rights granted by the law of their place of residence.',
          'You can send any complaint to ' + BUZON_LEGAL + ' or through the contact page; we will reply as soon as possible and always within the legal deadlines. You may also turn to the public consumer authorities of your region.',
        ],
      },
    ],
  },
}

/* ══════════════════════════════════════════════════════════════════════════
   POLÍTICA DE PRIVACIDAD — RGPD arts. 13-14
   ══════════════════════════════════════════════════════════════════════════ */

export const POLITICA_PRIVACIDAD: Record<IdiomaLegal, DocumentoLegal> = {
  es: {
    titulo: 'Política de privacidad',
    actualizado: ACTUALIZADO.es,
    entradilla:
      'Esta política explica qué datos personales tratamos cuando usas CamperOcasión, para qué los usamos, con quién los compartimos y qué derechos tienes. Resume lo que el sitio hace realmente, servicio por servicio.',
    secciones: [
      {
        titulo: '1. Responsable del tratamiento',
        parrafos: [
          'El responsable del tratamiento es el titular de camperocasion.online, cuyos datos identificativos figuran en el aviso legal. Para cualquier cuestión sobre privacidad puedes escribir a ' + BUZON_PRIVACIDAD + '.',
        ],
      },
      {
        titulo: '2. Qué datos tratamos',
        lista: [
          'Cuenta: nombre, correo electrónico, contraseña (almacenada cifrada, nunca la vemos) y, si lo indicas, teléfono y provincia.',
          'Anuncios: título, descripción, fotos, precio, características del vehículo y ubicación.',
          'Contacto entre usuarios: los mensajes del chat interno, y los datos que compartes al contactar por teléfono, WhatsApp o email con otro usuario.',
          'Verificación de identidad (voluntaria): si la solicitas para obtener el sello de verificado, se piden DNI/NIE, teléfono, entidad bancaria y fotografías del documento, que se conservan en un almacenamiento privado con acceso restringido.',
          'Homologación y trámites (voluntarios): documentación del vehículo que subes para el expediente de homologación o la gestoría.',
          'Reservas e inspecciones: datos necesarios para gestionar una reserva con señal o una inspección precompra.',
          'Créditos: saldo, movimientos y la referencia del pago. No tratamos números de tarjeta: los pagos con tarjeta se realizan en la pasarela del proveedor de pago.',
          'Datos técnicos: dirección IP, tipo de dispositivo y navegador, y páginas visitadas, con la finalidad de seguridad, prevención de abuso y medición agregada del servicio.',
        ],
      },
      {
        titulo: '3. Para qué y con qué base jurídica',
        lista: [
          'Prestar el servicio (cuenta, publicar anuncios, chat, reservas): ejecución del contrato o de las condiciones de uso.',
          'Moderación, seguridad, prevención del fraude y límites de uso: interés legítimo en proteger la plataforma y a sus usuarios.',
          'Verificación de identidad, homologación y gestoría: consentimiento y, cuando exista, ejecución del servicio contratado.',
          'Medición de tráfico y notificaciones push: consentimiento, que puedes retirar cuando quieras (ver la política de cookies).',
          'Facturación y obligaciones fiscales de los servicios de pago: cumplimiento de obligaciones legales.',
          'Avisos por email imprescindibles para el servicio (confirmación de cuenta, avisos de seguridad): ejecución del contrato; no son publicidad.',
        ],
      },
      {
        titulo: '4. Cuánto tiempo los conservamos',
        lista: [
          'Datos de la cuenta y anuncios: mientras la cuenta esté activa. Si la eliminas, se borran y los anuncios dejan de estar visibles.',
          'Verificación de identidad: mientras exista el sello de verificado y, después, el tiempo mínimo necesario para atender posibles responsabilidades.',
          'Mensajes de chat: mientras el anuncio esté activo y el tiempo necesario para gestionar posibles incidencias.',
          'Facturación de servicios de pago: los plazos de conservación contable y fiscal (con carácter general, seis años).',
          'Registros técnicos y de seguridad: un plazo breve y proporcionado, no superior al necesario para investigar abusos.',
        ],
      },
      {
        titulo: '5. Quién más trata tus datos',
        parrafos: [
          'No vendemos tus datos. Para funcionar necesitamos proveedores que tratan datos por cuenta nuestra (encargados del tratamiento):',
        ],
        lista: [
          'Supabase (base de datos, autenticación y almacenamiento de archivos), con servidores en la Unión Europea.',
          'Vercel (alojamiento de la web y medición agregada de tráfico y rendimiento).',
          'Resend (envío de los correos del servicio y avisos).',
          'Servicios de notificaciones push del navegador, solo si activas las notificaciones.',
          'Telegram, únicamente para avisos internos de moderación: si escribes en un chat de la plataforma datos de contacto, el aviso interno puede incluirlos.',
          'Proveedores de pago, si contratas servicios de visibilidad con tarjeta: son responsables independientes del tratamiento del pago.',
          'Autoridades públicas, cuando exista una obligación legal de comunicar información.',
        ],
      },
      {
        titulo: '6. Transferencias internacionales',
        parrafos: [
          'Algunos proveedores pertenecen a grupos con sede en Estados Unidos. Cuando el tratamiento implica una transferencia fuera del Espacio Económico Europeo, se ampara en una decisión de adecuación de la Comisión Europea o en las cláusulas contractuales tipo, junto con medidas adicionales de seguridad.',
        ],
      },
      {
        titulo: '7. Tus derechos',
        parrafos: [
          'Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, así como retirar tu consentimiento en cualquier momento (sin que ello afecte a la licitud del tratamiento previo), escribiendo a '
            + BUZON_PRIVACIDAD + ' desde la dirección con la que te registraste o desde el propio panel, donde puedes editar tus datos y eliminar tu cuenta.',
          'Si consideras que no hemos atendido correctamente tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).',
        ],
      },
      {
        titulo: '8. Menores de edad',
        parrafos: [
          'El servicio está dirigido a personas mayores de 18 años. No se recogen conscientemente datos de menores; si detectas una cuenta de un menor, avísanos y se eliminará.',
        ],
      },
      {
        titulo: '9. Seguridad',
        parrafos: [
          'Aplicamos medidas técnicas y organizativas proporcionadas al riesgo: conexiones cifradas (HTTPS), control de acceso por filas en la base de datos, almacenamiento privado de la documentación sensible y URLs firmadas de validez limitada para revisarla. Ningún sistema es infalible, pero limitamos la recogida a lo necesario y restringimos quién puede ver cada dato.',
        ],
      },
      {
        titulo: '10. Cookies y almacenamiento local',
        parrafos: [
          'Usamos cookies y almacenamiento del navegador imprescindibles para mantener tu sesión y recordar tus preferencias; la medición de tráfico solo se carga si la aceptas. El detalle y la forma de cambiar tu decisión están en la política de cookies.',
        ],
      },
      {
        titulo: '11. Cambios en esta política',
        parrafos: [
          'Si cambiamos la forma de tratar tus datos, actualizaremos esta política y, cuando el cambio sea relevante, te avisaremos por email o dentro de la web antes de aplicarlo.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Privacy policy',
    actualizado: ACTUALIZADO.en,
    entradilla:
      'This policy explains what personal data we process when you use CamperOcasión, what we use it for, who we share it with and what rights you have. It reflects what the site actually does, service by service.',
    secciones: [
      {
        titulo: '1. Data controller',
        parrafos: [
          'The controller is the owner of camperocasion.online, whose identifying details appear in the legal notice. For any privacy question you can write to ' + BUZON_PRIVACIDAD + '.',
        ],
      },
      {
        titulo: '2. What data we process',
        lista: [
          'Account: name, email address, password (stored encrypted — we never see it) and, if you provide them, phone number and region.',
          'Listings: title, description, photos, price, vehicle features and location.',
          'Contact between users: messages in the internal chat, and the details you share when you contact another user by phone, WhatsApp or email.',
          'Identity verification (optional): if you request it to get the verified badge, you are asked for your ID number, phone, bank and photographs of your ID document, kept in private storage with restricted access.',
          'Homologation and paperwork (optional): vehicle documents you upload for the homologation file or the registration service.',
          'Reservations and inspections: data needed to manage a reservation with a deposit or a pre-purchase inspection.',
          'Credits: balance, transactions and the payment reference. We do not process card numbers: card payments are made on the payment provider’s checkout.',
          'Technical data: IP address, device and browser type, and pages visited, for security, abuse prevention and aggregate measurement of the service.',
        ],
      },
      {
        titulo: '3. Why and on what legal basis',
        lista: [
          'Providing the service (account, publishing listings, chat, reservations): performance of the contract or terms of use.',
          'Moderation, security, fraud prevention and usage limits: legitimate interest in protecting the platform and its users.',
          'Identity verification, homologation and paperwork: consent and, where applicable, performance of the contracted service.',
          'Traffic measurement and push notifications: consent, which you can withdraw at any time (see the cookie policy).',
          'Invoicing and tax obligations for paid services: compliance with legal obligations.',
          'Essential service emails (account confirmation, security alerts): performance of the contract; they are not marketing.',
        ],
      },
      {
        titulo: '4. How long we keep it',
        lista: [
          'Account data and listings: while the account is active. If you delete it, the data is erased and the listings are no longer visible.',
          'Identity verification: while the verified badge exists and, afterwards, for the minimum time needed to handle possible liabilities.',
          'Chat messages: while the listing is active and as long as needed to handle incidents.',
          'Invoicing of paid services: accounting and tax retention periods (generally six years).',
          'Technical and security logs: a short, proportionate period, no longer than needed to investigate abuse.',
        ],
      },
      {
        titulo: '5. Who else processes your data',
        parrafos: [
          'We do not sell your data. To operate we need providers that process data on our behalf (processors):',
        ],
        lista: [
          'Supabase (database, authentication and file storage), with servers in the European Union.',
          'Vercel (website hosting and aggregate traffic and performance measurement).',
          'Resend (sending service emails and alerts).',
          'Browser push notification services, only if you enable notifications.',
          'Telegram, only for internal moderation alerts: if you write contact details in a platform chat, the internal alert may include them.',
          'Payment providers, if you buy visibility services by card: they are independent controllers of the payment processing.',
          'Public authorities, where there is a legal obligation to disclose information.',
        ],
      },
      {
        titulo: '6. International transfers',
        parrafos: [
          'Some providers belong to groups headquartered in the United States. Where processing involves a transfer outside the European Economic Area, it relies on a European Commission adequacy decision or on standard contractual clauses, together with additional security measures.',
        ],
      },
      {
        titulo: '7. Your rights',
        parrafos: [
          'You can exercise your rights of access, rectification, erasure, objection, restriction of processing and portability, and withdraw your consent at any time (without affecting the lawfulness of prior processing), by writing to '
            + BUZON_PRIVACIDAD + ' from the address you registered with or from your dashboard, where you can edit your data and delete your account.',
          'If you believe we have not handled your request properly, you can complain to the Spanish Data Protection Agency (www.aepd.es).',
        ],
      },
      {
        titulo: '8. Minors',
        parrafos: [
          'The service is intended for people over 18. We do not knowingly collect data from minors; if you become aware of a minor’s account, let us know and it will be deleted.',
        ],
      },
      {
        titulo: '9. Security',
        parrafos: [
          'We apply technical and organisational measures proportionate to the risk: encrypted connections (HTTPS), row-level access control in the database, private storage for sensitive documentation and short-lived signed URLs for reviewing it. No system is infallible, but we collect only what is needed and restrict who can see each piece of data.',
        ],
      },
      {
        titulo: '10. Cookies and local storage',
        parrafos: [
          'We use cookies and browser storage that are essential to keep your session and remember your preferences; traffic measurement is only loaded if you accept it. Details and how to change your decision are in the cookie policy.',
        ],
      },
      {
        titulo: '11. Changes to this policy',
        parrafos: [
          'If we change how we process your data, we will update this policy and, where the change is significant, we will notify you by email or on the site before applying it.',
        ],
      },
    ],
  },
}

/* ══════════════════════════════════════════════════════════════════════════
   POLÍTICA DE COOKIES — LSSI art. 22.2 y guía de la AEPD
   ══════════════════════════════════════════════════════════════════════════ */

export const POLITICA_COOKIES: Record<IdiomaLegal, DocumentoLegal> = {
  es: {
    titulo: 'Política de cookies',
    actualizado: ACTUALIZADO.es,
    entradilla:
      'Qué guardamos en tu navegador cuando usas CamperOcasión, para qué sirve cada cosa y cómo puedes cambiar tu decisión.',
    secciones: [
      {
        titulo: '1. Qué usamos',
        parrafos: [
          'Además de cookies propias, el sitio utiliza almacenamiento local del navegador (localStorage). A efectos de esta política tratamos ambos igual: no se guarda nada que no sea necesario para el servicio o que no hayas aceptado.',
        ],
        lista: [
          'Sesión (necesaria): cookies de Supabase (prefijo `sb-`) que mantienen tu sesión iniciada. Sin ellas no se puede iniciar sesión ni publicar. Se guardan hasta que cierras sesión o caduca el token.',
          'Preferencias (necesaria): la clave `cookie-consent` en el almacenamiento local recuerda si aceptaste o rechazaste la medición, para no volver a preguntarte en cada visita.',
          'Aviso de instalación de la app (necesaria): recuerda si ya cerraste el aviso para no repetirlo.',
          'Medición de tráfico y rendimiento (opcional): Vercel Analytics y Speed Insights, que miden visitas y tiempos de carga de forma agregada. Se cargan **solo si pulsas «Aceptar»**; si rechazas o no decides, no se descarga su código.',
        ],
      },
      {
        titulo: '2. Qué no usamos',
        lista: [
          'No usamos cookies publicitarias ni de perfilado.',
          'No vendemos ni cedemos datos de navegación a terceros con fines publicitarios.',
          'No hacemos seguimiento entre sitios distintos.',
        ],
      },
      {
        titulo: '3. Cómo cambiar tu decisión',
        parrafos: [
          'Puedes cambiar de opinión en cualquier momento con el botón de abajo: se borrará tu elección y volverás a ver el aviso. Si aceptas medición y después la rechazas, el código de medición se descarga solo tras volver a aceptar.',
        ],
      },
      {
        titulo: '4. Cómo desactivarlas en tu navegador',
        parrafos: [
          'Todos los navegadores permiten bloquear o eliminar cookies desde su configuración (Privacidad y seguridad). Ten en cuenta que bloquear las necesarias impide iniciar sesión o publicar anuncios.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Cookie policy',
    actualizado: ACTUALIZADO.en,
    entradilla:
      'What we store in your browser when you use CamperOcasión, what each item is for and how to change your decision.',
    secciones: [
      {
        titulo: '1. What we use',
        parrafos: [
          'Besides our own cookies, the site uses browser local storage (localStorage). For the purposes of this policy we treat both the same: nothing is stored unless it is needed for the service or you have accepted it.',
        ],
        lista: [
          'Session (essential): Supabase cookies (prefix `sb-`) that keep you signed in. Without them you cannot sign in or publish. They are kept until you sign out or the token expires.',
          'Preferences (essential): the `cookie-consent` key in local storage remembers whether you accepted or rejected measurement, so we do not ask you on every visit.',
          'App install notice (essential): remembers that you already dismissed the notice so it is not shown again.',
          'Traffic and performance measurement (optional): Vercel Analytics and Speed Insights, which measure visits and load times in aggregate. They are loaded **only if you press “Accept”**; if you reject or do not decide, their code is not downloaded.',
        ],
      },
      {
        titulo: '2. What we do not use',
        lista: [
          'We do not use advertising or profiling cookies.',
          'We do not sell or share browsing data with third parties for advertising purposes.',
          'We do not track you across different sites.',
        ],
      },
      {
        titulo: '3. How to change your decision',
        parrafos: [
          'You can change your mind at any time with the button below: your choice will be cleared and the notice will be shown again. If you accept measurement and later reject it, the measurement code only loads again after you accept.',
        ],
      },
      {
        titulo: '4. How to turn them off in your browser',
        parrafos: [
          'All browsers allow you to block or delete cookies in their settings (Privacy and security). Note that blocking the essential ones prevents signing in or publishing listings.',
        ],
      },
    ],
  },
}

/* ══════════════════════════════════════════════════════════════════════════
   TÉRMINOS Y CONDICIONES
   ══════════════════════════════════════════════════════════════════════════ */

export const TERMINOS: Record<IdiomaLegal, DocumentoLegal> = {
  es: {
    titulo: 'Términos y condiciones',
    actualizado: ACTUALIZADO.es,
    entradilla:
      'Estas condiciones regulan el uso de CamperOcasión. Resumen las reglas del tablón, qué puedes esperar de la plataforma y qué servicios de pago existen.',
    secciones: [
      {
        titulo: '1. Quiénes somos y qué es CamperOcasión',
        parrafos: [
          'CamperOcasión es un tablón de anuncios de furgonetas camper y autocaravanas de ocasión en España. Actúa como intermediario: pone en contacto a quien vende con quien compra, pero no vende los vehículos ni participa en la compraventa (ver el aviso legal).',
          'Al crear una cuenta aceptas estas condiciones y la política de privacidad. Debes ser mayor de 18 años.',
        ],
      },
      {
        titulo: '2. Publicar anuncios',
        parrafos: [
          'Publicar es gratuito. Al publicar declaras que:',
        ],
        lista: [
          'El vehículo es tuyo y puedes venderlo legalmente.',
          'Las fotos y la descripción son veraces, actuales y corresponden al vehículo real.',
          'Si eres camperizador o profesional, indicas tu condición de empresario y cumples tus obligaciones (facturación, garantía legal y demás normativa aplicable).',
          'No publicas vehículos robados, siniestrados sin declararlo, con cargas no comunicadas, ni anuncios duplicados o engañosos.',
        ],
      },
      {
        titulo: '3. Moderación y retirada de anuncios',
        parrafos: [
          'Revisamos los anuncios y podemos rechazarlos, ocultarlos o retirarlos si incumplen estas condiciones, si detectamos indicios de fraude o si lo exige una autoridad. Cuando un anuncio se retira, se explica el motivo y se puede solicitar una revisión.',
          'Puedes denunciar un anuncio desde su propia ficha o escribiendo a ' + BUZON_LEGAL + '.',
        ],
      },
      {
        titulo: '4. Verificación, homologación e inspección',
        parrafos: [
          'El sello de verificado indica que hemos comprobado la identidad del vendedor con la documentación aportada, y el sello de homologación, que existe un expediente documental revisado. Son comprobaciones documentales: no equivalen a una tasación ni garantizan el estado mecánico del vehículo.',
          'La inspección precompra la realiza un taller independiente; el informe es suyo y su precio orientativo se muestra antes de solicitarla.',
        ],
      },
      {
        titulo: '5. Reservas con señal',
        parrafos: [
          'Una reserva con señal es un acuerdo entre comprador y vendedor: el comprador ingresa una cantidad para bloquear el vehículo y el vendedor debe confirmarla. CamperOcasión facilita el acuerdo y deja constancia de él, pero no custodia el dinero de la señal ni del vehículo. Si surge un conflicto, se puede cancelar la reserva desde la plataforma y reclamar a la otra parte.',
        ],
      },
      {
        titulo: '6. Servicios de pago (créditos)',
        parrafos: [
          'Los créditos son un saldo que sirve únicamente para contratar servicios de visibilidad dentro de la web:',
        ],
        lista: [
          'Destacar un anuncio 12, 24 o 48 horas.',
          'Subir un anuncio al primer puesto durante 7 días.',
          'Incluye lo que la ley exija en materia de precios, impuestos y facturación. Los precios se muestran en euros antes de contratar.',
        ],
      },
      {
        titulo: '7. Desistimiento y devoluciones de créditos',
        parrafos: [
          'Si contratas como consumidor, tienes derecho de desistimiento en los términos de la ley. Al tratarse de contenido digital de ejecución inmediata, ese derecho se pierde cuando el crédito se consume con tu consentimiento expreso previo.',
          'En la práctica, y como política comercial: **si un crédito comprado no se ha consumido, se devuelve**. Basta con escribir a ' + BUZON_LEGAL + ' en los 14 días siguientes a la compra indicando la referencia del pago. Si un servicio promocionado no llegó a aplicarse por un error nuestro, se repone el crédito.',
        ],
      },
      {
        titulo: '8. Conducta del usuario',
        parrafos: [
          'No se permite el spam, la suplantación de identidad, el acoso, la recogida de datos de otros usuarios, las estafas, ni publicar contenido ilícito, ofensivo o que vulnere derechos de terceros. El uso indebido puede suponer la suspensión de la cuenta, sin perjuicio de las acciones legales que correspondan.',
        ],
      },
      {
        titulo: '9. Responsabilidad',
        parrafos: [
          'CamperOcasión no garantiza la veracidad de los anuncios de los usuarios ni el estado de los vehículos, y no responde de los acuerdos entre usuarios. Como servicio de intermediación, responde de sus propios servicios (por ejemplo, las herramientas de verificación y las promociones de pago) conforme a la ley, y no del contenido ajeno del que no tenga conocimiento efectivo.',
        ],
      },
      {
        titulo: '10. Ley aplicable y reclamaciones',
        parrafos: [
          'Estas condiciones se rigen por la legislación española. Si eres consumidor, conservas todos los derechos que te reconoce la normativa de tu país de residencia y puedes reclamar ante los organismos públicos de consumo o los tribunales que te correspondan.',
          'Reclamaciones y dudas: ' + BUZON_LEGAL + '.',
        ],
      },
      {
        titulo: '11. Cambios',
        parrafos: [
          'Podemos actualizar estas condiciones para adaptarlas a cambios legales o del servicio. Los cambios se publican en esta página y, si son relevantes, se avisan dentro de la web o por email con antelación razonable.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Terms and conditions',
    actualizado: ACTUALIZADO.en,
    entradilla:
      'These terms govern the use of CamperOcasión. They set out the rules of the noticeboard, what you can expect from the platform and what paid services exist.',
    secciones: [
      {
        titulo: '1. Who we are and what CamperOcasión is',
        parrafos: [
          'CamperOcasión is a noticeboard for second-hand camper vans and motorhomes in Spain. It acts as an intermediary: it connects sellers and buyers, but it does not sell the vehicles and takes no part in the sale (see the legal notice).',
          'By creating an account you accept these terms and the privacy policy. You must be over 18.',
        ],
      },
      {
        titulo: '2. Publishing listings',
        parrafos: ['Publishing is free. By publishing you declare that:'],
        lista: [
          'The vehicle is yours and you can legally sell it.',
          'The photos and description are truthful, current and match the real vehicle.',
          'If you are a converter or dealer, you state that you are a business and comply with your obligations (invoicing, legal guarantee and other applicable rules).',
          'You are not publishing stolen vehicles, damaged vehicles without saying so, vehicles with undisclosed charges, or duplicate or misleading listings.',
        ],
      },
      {
        titulo: '3. Moderation and removal of listings',
        parrafos: [
          'We review listings and may reject, hide or remove them if they breach these terms, if we detect signs of fraud or if an authority requires it. When a listing is removed, the reason is given and a review can be requested.',
          'You can report a listing from its own page or by writing to ' + BUZON_LEGAL + '.',
        ],
      },
      {
        titulo: '4. Verification, homologation and inspection',
        parrafos: [
          'The verified badge means we have checked the seller’s identity against the documents provided, and the homologation badge means a documentary file has been reviewed. These are documentary checks: they are not a valuation and do not guarantee the mechanical condition of the vehicle.',
          'The pre-purchase inspection is carried out by an independent garage; the report is theirs and an indicative price is shown before you request it.',
        ],
      },
      {
        titulo: '5. Reservations with a deposit',
        parrafos: [
          'A reservation with a deposit is an agreement between buyer and seller: the buyer pays a deposit to hold the vehicle and the seller must confirm it. CamperOcasión facilitates the agreement and records it, but does not hold the deposit money or the price of the vehicle. If a conflict arises, the reservation can be cancelled from the platform and you can claim against the other party.',
        ],
      },
      {
        titulo: '6. Paid services (credits)',
        parrafos: [
          'Credits are a balance used only to buy visibility services within the site:',
        ],
        lista: [
          'Featuring a listing for 12, 24 or 48 hours.',
          'Moving a listing to the top for 7 days.',
          'Prices are shown in euros before you buy, with the taxes and invoicing required by law.',
        ],
      },
      {
        titulo: '7. Withdrawal and credit refunds',
        parrafos: [
          'If you buy as a consumer, you have a right of withdrawal under the law. As this is digital content supplied immediately, that right is lost once the credit is used with your prior express consent.',
          'In practice, as a commercial policy: **if a purchased credit has not been used, it is refunded**. Just write to ' + BUZON_LEGAL + ' within 14 days of purchase with the payment reference. If a promoted service was never applied due to our mistake, the credit is restored.',
        ],
      },
      {
        titulo: '8. User conduct',
        parrafos: [
          'Spam, impersonation, harassment, scraping other users’ data, scams, and publishing unlawful or offensive content or content that infringes third-party rights are not allowed. Misuse may lead to account suspension, without prejudice to any legal action.',
        ],
      },
      {
        titulo: '9. Liability',
        parrafos: [
          'CamperOcasión does not guarantee the truthfulness of users’ listings or the condition of the vehicles, and is not responsible for agreements between users. As an intermediary service, it is liable for its own services (for example, the verification tools and paid promotions) under the law, and not for third-party content of which it has no actual knowledge.',
        ],
      },
      {
        titulo: '10. Governing law and complaints',
        parrafos: [
          'These terms are governed by Spanish law. If you are a consumer, you keep all rights granted by the law of your country of residence and may complain to public consumer authorities or the competent courts.',
          'Complaints and questions: ' + BUZON_LEGAL + '.',
        ],
      },
      {
        titulo: '11. Changes',
        parrafos: [
          'We may update these terms to adapt them to legal or service changes. Changes are published on this page and, if significant, notified on the site or by email with reasonable notice.',
        ],
      },
    ],
  },
}

/** Textos de los enlaces del pie y títulos de las páginas legales. */
export const ENLACES_LEGALES = {
  es: { avisoLegal: 'Aviso legal', cookies: 'Cookies', privacidad: 'Privacidad', terminos: 'Términos' },
  en: { avisoLegal: 'Legal notice', cookies: 'Cookies', privacidad: 'Privacy', terminos: 'Terms' },
} as const
