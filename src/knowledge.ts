// Everything in this file must already be public on jordipatuel.com or in the published CV.
// Assume any visitor can extract this text word for word.
export const KNOWLEDGE = `
## Quién es
Jordi Patuel es desarrollador de software en Barcelona. Terminó el ciclo superior de Desarrollo de Aplicaciones Multiplataforma (DAM) en 2026 y busca su primer puesto como desarrollador, orientado a backend. Programa sobre todo en Java con Spring Boot, y su proyecto final de ciclo le llevó también a Flutter y AWS.
Le gusta que las cosas queden bien documentadas: cada proyecto que publica lleva su propio registro de decisiones técnicas, no solo un README de instalación. Quiere seguir formándose de forma constante, en especial en seguridad y cloud.
Idiomas: valenciano/catalán y castellano nativos; inglés intermedio. Tiene carnet B y vehículo propio, y disponibilidad de incorporación inmediata.

## Tecnologías
- Lenguajes: Java, Dart, C#, SQL, Python, Kotlin.
- Backend: Spring Boot, Spring Security, API REST, JWT.
- Móvil y frontend: Flutter, Flutter Web, Android Studio, HTML, CSS.
- Datos: PostgreSQL, SQL Server, MySQL, MariaDB.
- Cloud e infraestructura: AWS (EC2, RDS, S3, IAM), Terraform, Docker.
- Prácticas: Git y GitHub, CI/CD con GitHub Actions, seguridad de aplicaciones.
- ERP: Ahora 5, FlexyGO, .NET.

## Proyectos
GrowTogether (Trabajo Final de Grado de DAM, 2025/2026). App de hábitos con componente social, inspirada en el libro Atomic Habits: rachas, mapa de calor de actividad y desafíos entre amigos. Jordi hizo todo el proyecto en solitario. Son cuatro repositorios públicos en GitHub: una API REST en Java 17 y Spring Boot con PostgreSQL y autenticación JWT (con revocación de tokens y límite de peticiones propio), una app móvil en Flutter en tres idiomas que sigue funcionando sin conexión gracias a una caché local, un panel de administración en Flutter Web con auditoría de acciones, y un paquete Dart compartido entre la app y el panel. El proyecto ya no está desplegado: no hay demo en línea, pero el código y la memoria de 59 páginas están publicados.

Portal de empleados (encargo profesional, de junio a julio de 2026, justo después de terminar el ciclo). Portal interno para la gestión diaria de una empresa: autenticación, permisos por rol y los paneles que usa el equipo cada día. Jordi lo diseñó y desplegó de punta a punta él solo: backend en Java y Spring Boot, frontend en React e infraestructura en AWS definida con Terraform (CloudFront con WAF, S3, un servidor EC2 con Docker, base de datos PostgreSQL en una red privada, administración sin SSH abierto, backups automáticos y alertas de coste). El despliegue es automático con GitHub Actions, sin claves de AWS guardadas en GitHub. No se puede compartir el código, las capturas ni el nombre de la empresa por un acuerdo de confidencialidad.

Tría (proyecto personal, 2026). App de escritorio para macOS y Windows, hecha con Flutter y Dart, para clasificar miles de archivos en carpetas con una sola pulsación de tecla por archivo y poder deshacer cualquier decisión, incluso días después. Cada operación se anota en un diario antes de tocar el disco, y de ahí salen deshacer, reanudar tras un cierre inesperado y revertir una sesión entera. Funciona sin red y sin telemetría, y tiene 138 pruebas automáticas que se ejecutan en macOS y Windows. El código es público en GitHub.

Chatbot del portfolio (proyecto personal, 2026). Es este asistente, Patu. Jordi lo construyó para aprender a hacer un chatbot seguro, por capas: un bot ingenuo, catorce ataques reales contra él, una defensa y otra vez los ataques. Funciona con coste cero en Cloudflare Workers, con captcha, límites de mensajes y un filtro de salida. Ahora mismo Jordi sigue con proyectos personales como este y Tría.

## Formación, experiencia y certificaciones
- Ciclo superior de Desarrollo de Aplicaciones Multiplataforma (DAM), IES María Enríquez, Gandía, 2024-2026.
- Ciclo superior de Marketing y Publicidad, IES Severo Ochoa, Elche, 2019-2021.
- En 2023 emprendió su propio negocio.
- Prácticas en Autis Ingenieros (Gandía), de mayo a junio de 2025: una página web que mostraba datos del OpenProject de la empresa y primeros pasos con Docker.
- Prácticas en DASS (Ondara), de febrero a junio de 2026: implantación de ERP y CRM sobre Ahora 5 y desarrollo de aplicaciones con Flexygo, con formación oficial de ambas herramientas; vistas de datos internas con SQL Server y .NET.
- Certificación Introduction to Cybersecurity, de Cisco Networking Academy, en septiembre de 2026.

## Contacto
Para contactar con Jordi, usa la sección "Contacto" de jordipatuel.com o escribe a chatbot.info@jordipatuel.com, el correo de este asistente. Allí están también su GitHub (devPatuel), su LinkedIn y su CV para descargar.
`;
