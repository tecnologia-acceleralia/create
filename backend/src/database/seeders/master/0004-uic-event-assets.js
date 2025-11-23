// Seeder generado automáticamente el 2025-11-23T16:25:53.440Z
// Este seeder inserta los assets de eventos de UIC en la tabla event_assets
// Los assets ya existen en el bucket S3, este seeder solo los registra en la BD
// Generado desde la base de datos de producción con 47 assets

export async function up(queryInterface) {
  // Obtener tenant y evento
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    throw new Error('No se encontró el tenant UIC');
  }

  // Verificar si la columna name es JSON (multiidioma) o STRING
  const eventsTableDesc = await queryInterface.describeTable('events').catch(() => ({}));
  const isEventsNameJSON = eventsTableDesc.name && (eventsTableDesc.name.type === 'json' || eventsTableDesc.name.type?.includes('json') || eventsTableDesc.name.type === 'JSON');

  // Buscar el evento según el tipo de columna
  const eventQuery = isEventsNameJSON
    ? `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND JSON_EXTRACT(name, '$.es') = 'SPP 2026' LIMIT 1`
    : `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND name = 'SPP 2026' LIMIT 1`;
  
  const [[event]] = await queryInterface.sequelize.query(eventQuery);

  if (!event) {
    throw new Error('No se encontró el evento SPP 2026 del tenant UIC');
  }

  // Obtener usuario admin para uploaded_by
  const [[adminUser]] = await queryInterface.sequelize.query(
    "SELECT id FROM users WHERE email = 'admin@uic.es' LIMIT 1"
  );

  if (!adminUser) {
    throw new Error('No se encontró el usuario admin@uic.es');
  }

  const now = new Date();

  // Assets a insertar
  const assetsToInsert = [
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Analisis-Pestel.pptx",
      original_filename: "Analisis-Pestel.pptx",
      s3_key: "tenants/1/events/1/assets/1763230898274-05cbb699-6c07-46a6-af41-8094135fb4d0-Analisis-Pestel.pptx",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230898274-05cbb699-6c07-46a6-af41-8094135fb4d0-Analisis-Pestel.pptx",
      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      file_size: 405343,
      description: "Analisis Pestel",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:38.000Z'),
      updated_at: new Date('2025-11-15T18:21:38.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "bienvenidos-imagen1",
      original_filename: "Bienvenidos-Imagen1.jpg",
      s3_key: "tenants/1/events/1/assets/1763640177422-1ca30e83-9b37-4b0d-b300-735ea5d9b4e2-Bienvenidos-Imagen1.jpg",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763640177422-1ca30e83-9b37-4b0d-b300-735ea5d9b4e2-Bienvenidos-Imagen1.jpg",
      mime_type: "image/jpeg",
      file_size: 119132,
      description: "Bienvenidos Imagen1",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-20T12:02:57.000Z'),
      updated_at: new Date('2025-11-20T12:02:57.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Como-definir-la-misio-vision-y-valores-de-una-empresa-ejemplos.pdf",
      original_filename: "Como-definir-la-misio-vision-y-valores-de-una-empresa-ejemplos.pdf",
      s3_key: "tenants/1/events/1/assets/1763234978175-ece16949-66f6-4dda-a6cf-56ee2c6beba9-Como-definir-la-misio-vision-y-valores-de-una-empresa-ejemplos.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763234978175-ece16949-66f6-4dda-a6cf-56ee2c6beba9-Como-definir-la-misio-vision-y-valores-de-una-empresa-ejemplos.pdf",
      mime_type: "application/pdf",
      file_size: 6933046,
      description: "Como Definir La Misio Vision Y Valores De Una Empresa Ejemplos",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T22:11:28.000Z'),
      updated_at: new Date('2025-11-15T22:11:28.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Como-formular-la-propuesta-de-valor-de-una-empresa.pdf",
      original_filename: "Como-formular-la-propuesta-de-valor-de-una-empresa.pdf",
      s3_key: "tenants/1/events/1/assets/1763234970121-c435c19a-97fe-479b-8b46-7ab17842087f-Como-formular-la-propuesta-de-valor-de-una-empresa.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763234970121-c435c19a-97fe-479b-8b46-7ab17842087f-Como-formular-la-propuesta-de-valor-de-una-empresa.pdf",
      mime_type: "application/pdf",
      file_size: 6048201,
      description: "Como Formular La Propuesta De Valor De Una Empresa",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T19:29:32.000Z'),
      updated_at: new Date('2025-11-15T19:29:32.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Como-hacer-un-analisis-pestal.pdf",
      original_filename: "Como-hacer-un-analisis-pestal.pdf",
      s3_key: "tenants/1/events/1/assets/1763616311702-d8f71883-a5b7-4288-a9fc-9b12e7417fd1-Como-hacer-un-analisis-pestal.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763616311702-d8f71883-a5b7-4288-a9fc-9b12e7417fd1-Como-hacer-un-analisis-pestal.pdf",
      mime_type: "application/pdf",
      file_size: 486188,
      description: "Como Hacer Un Analisis Pestal",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-20T05:25:11.000Z'),
      updated_at: new Date('2025-11-20T05:25:11.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Como-realizar-un-analisis-de-mercado-para-su-producto.pdf",
      original_filename: "Como-realizar-un-analisis-de-mercado-para-su-producto.pdf",
      s3_key: "tenants/1/events/1/assets/1763234968270-84cd34f3-2b2e-4b12-929f-81b0ceba6a0f-Como-realizar-un-analisis-de-mercado-para-su-producto.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763234968270-84cd34f3-2b2e-4b12-929f-81b0ceba6a0f-Como-realizar-un-analisis-de-mercado-para-su-producto.pdf",
      mime_type: "application/pdf",
      file_size: 354439,
      description: "Como Realizar Un Analisis De Mercado Para Su Producto",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T22:11:28.000Z'),
      updated_at: new Date('2025-11-15T22:11:28.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "competitive-analysis-file-pdf.pdf",
      original_filename: "competitive-analysis-file-pdf.pdf",
      s3_key: "tenants/1/events/1/assets/1763230901383-34bba857-7be1-4f5b-99b1-43ccfaaf0bea-competitive-analysis-file-pdf.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230901383-34bba857-7be1-4f5b-99b1-43ccfaaf0bea-competitive-analysis-file-pdf.pdf",
      mime_type: "application/pdf",
      file_size: 78510,
      description: "Competitive Analysis File Pdf",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:41.000Z'),
      updated_at: new Date('2025-11-15T18:21:41.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Crea-un-diagrama-de-Gantt-con-Canva.pdf",
      original_filename: "Crea-un-diagrama-de-Gantt-con-Canva.pdf",
      s3_key: "tenants/1/events/1/assets/1763230926828-278f054e-0c15-44a7-a1af-d72b3f1a06a0-Crea-un-diagrama-de-Gantt-con-Canva.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230926828-278f054e-0c15-44a7-a1af-d72b3f1a06a0-Crea-un-diagrama-de-Gantt-con-Canva.pdf",
      mime_type: "application/pdf",
      file_size: 6194700,
      description: "Crea Un Diagrama De Gantt Con Canva",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:22:14.000Z'),
      updated_at: new Date('2025-11-15T18:22:14.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Crea-una-plantilla-para-tus-cronogramas-con-Excel.pdf",
      original_filename: "Crea-una-plantilla-para-tus-cronogramas-con-Excel.pdf",
      s3_key: "tenants/1/events/1/assets/1763230918061-69377cab-fec1-4401-b2de-639a11a49074-Crea-una-plantilla-para-tus-cronogramas-con-Excel.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230918061-69377cab-fec1-4401-b2de-639a11a49074-Crea-una-plantilla-para-tus-cronogramas-con-Excel.pdf",
      mime_type: "application/pdf",
      file_size: 6154701,
      description: "Crea Una Plantilla Para Tus Cronogramas Con Excel",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:22:05.000Z'),
      updated_at: new Date('2025-11-15T18:22:05.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Encuestas-de-investigacion-de-mercado-1.pdf",
      original_filename: "Encuestas-de-investigacion-de-mercado-1.pdf",
      s3_key: "tenants/1/events/1/assets/1763234986398-23499667-ab44-44fe-9946-779444e44b3b-Encuestas-de-investigacion-de-mercado-1.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763234986398-23499667-ab44-44fe-9946-779444e44b3b-Encuestas-de-investigacion-de-mercado-1.pdf",
      mime_type: "application/pdf",
      file_size: 6498956,
      description: "Encuestas De Investigacion De Mercado 1",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T22:11:28.000Z'),
      updated_at: new Date('2025-11-15T22:11:28.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F1_S1_AnalisisDeMercado_1",
      original_filename: "1-AnalisisDeMercado.jpg",
      s3_key: "tenants/1/events/1/assets/1763741848926-0968bb14-3893-4c12-9817-e381fe2cfb6a-1-AnalisisDeMercado.jpg",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763741848926-0968bb14-3893-4c12-9817-e381fe2cfb6a-1-AnalisisDeMercado.jpg",
      mime_type: "image/jpeg",
      file_size: 52467,
      description: "Análisis de mercado",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:17:28.000Z'),
      updated_at: new Date('2025-11-21T16:32:11.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F1_S1_FuerzasDePorter_2",
      original_filename: "2-CincoFuerzasDePorter.png",
      s3_key: "tenants/1/events/1/assets/1763741883461-034b1a3a-c94e-4181-a327-894b09466132-2-CincoFuerzasDePorter.png",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763741883461-034b1a3a-c94e-4181-a327-894b09466132-2-CincoFuerzasDePorter.png",
      mime_type: "image/png",
      file_size: 45812,
      description: "Análisis Porter",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:18:03.000Z'),
      updated_at: new Date('2025-11-21T16:32:16.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F1_S2_PESTEL",
      original_filename: "1-AnalisisPestel.webp",
      s3_key: "tenants/1/events/1/assets/1763741954465-737a1588-96a9-4ae7-af57-7901d1dd1cd6-1-AnalisisPestel.webp",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763741954465-737a1588-96a9-4ae7-af57-7901d1dd1cd6-1-AnalisisPestel.webp",
      mime_type: "image/webp",
      file_size: 23270,
      description: "AnalisisPestel",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:19:14.000Z'),
      updated_at: new Date('2025-11-21T16:19:14.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F1_S3_DAFO",
      original_filename: "1-Dafo.png",
      s3_key: "tenants/1/events/1/assets/1763741983348-8b53e98d-51b5-48d3-8f31-b6d44787fb6d-1-Dafo.png",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763741983348-8b53e98d-51b5-48d3-8f31-b6d44787fb6d-1-Dafo.png",
      mime_type: "image/png",
      file_size: 33567,
      description: "AnálisisDafo",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:19:43.000Z'),
      updated_at: new Date('2025-11-21T16:19:43.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F1_S4_ElMercado_FotoIman_1",
      original_filename: "1-FotoIman.jpg",
      s3_key: "tenants/1/events/1/assets/1763742053742-1bd0d0bb-f023-44e3-9ed9-95e39850e9b8-1-FotoIman.jpg",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742053742-1bd0d0bb-f023-44e3-9ed9-95e39850e9b8-1-FotoIman.jpg",
      mime_type: "image/jpeg",
      file_size: 27249,
      description: "Imagen sobre el mercado",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:20:53.000Z'),
      updated_at: new Date('2025-11-21T16:32:37.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F1_S4_TiposDeClientesEnElMercado_2",
      original_filename: "2-TiposDeClientesEnElMercado.png",
      s3_key: "tenants/1/events/1/assets/1763742097957-2b5d90ac-a0ec-45b0-a191-175e1e311dc0-2-TiposDeClientesEnElMercado.png",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742097957-2b5d90ac-a0ec-45b0-a191-175e1e311dc0-2-TiposDeClientesEnElMercado.png",
      mime_type: "image/png",
      file_size: 28220,
      description: "Imagen de personas relacionandose (clientes y empresas)",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:21:38.000Z'),
      updated_at: new Date('2025-11-21T16:32:41.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F1_S5_AnalisisDeCompetidores",
      original_filename: "1-Analisis-de-la-competencia.webp",
      s3_key: "tenants/1/events/1/assets/1763742145195-43043693-1d9c-4086-a143-9c24c24efa9a-1-Analisis-de-la-competencia.webp",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742145195-43043693-1d9c-4086-a143-9c24c24efa9a-1-Analisis-de-la-competencia.webp",
      mime_type: "image/webp",
      file_size: 178928,
      description: "Análisis de la competencia",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:22:25.000Z'),
      updated_at: new Date('2025-11-21T16:22:25.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F2_S1_CuantificacionDeMercado_1",
      original_filename: "1-CuantificacionDeMercado.jpg",
      s3_key: "tenants/1/events/1/assets/1763742196833-41ef9306-f530-4ea3-bd99-9dd49ba069e0-1-CuantificacionDeMercado.jpg",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742196833-41ef9306-f530-4ea3-bd99-9dd49ba069e0-1-CuantificacionDeMercado.jpg",
      mime_type: "image/jpeg",
      file_size: 41080,
      description: "Imagen de estadísticas sobre el mercado",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:23:16.000Z'),
      updated_at: new Date('2025-11-21T16:23:16.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F2_S1_FormulaParaFiltrarElSam_2",
      original_filename: "2-FormulaFiltrarSam.png",
      s3_key: "tenants/1/events/1/assets/1763742243436-f86deec2-36a0-4fa8-9ae8-dc735d71e2eb-2-FormulaFiltrarSam.png",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742243436-f86deec2-36a0-4fa8-9ae8-dc735d71e2eb-2-FormulaFiltrarSam.png",
      mime_type: "image/png",
      file_size: 49250,
      description: "Fórmula para filtrar el SAM a partir de la demanda",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:24:03.000Z'),
      updated_at: new Date('2025-11-21T16:24:03.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F2_S2_VentanaDeOportunidad",
      original_filename: "1-VentanaDeOportunidad.png",
      s3_key: "tenants/1/events/1/assets/1763742294397-f585cf34-2852-4aa2-ae90-4d451ca29c26-1-VentanaDeOportunidad.png",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742294397-f585cf34-2852-4aa2-ae90-4d451ca29c26-1-VentanaDeOportunidad.png",
      mime_type: "image/png",
      file_size: 25347,
      description: "Ventana de Oportunidad",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:24:54.000Z'),
      updated_at: new Date('2025-11-21T16:24:54.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F3_S1_PropuestaDeValor",
      original_filename: "1-PropuestaDeValor.png",
      s3_key: "tenants/1/events/1/assets/1763742339444-28e277da-1593-4627-90e7-ce1dd6ec65ef-1-PropuestaDeValor.png",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742339444-28e277da-1593-4627-90e7-ce1dd6ec65ef-1-PropuestaDeValor.png",
      mime_type: "image/png",
      file_size: 4316,
      description: "Propuesta de valor",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:25:39.000Z'),
      updated_at: new Date('2025-11-21T16:25:39.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F3_S2_CurvaDeValor",
      original_filename: "1-CurvaDeValor.png",
      s3_key: "tenants/1/events/1/assets/1763742375474-a35dc2ab-79ce-4485-90ba-4e8387c65ac3-1-CurvaDeValor.png",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742375474-a35dc2ab-79ce-4485-90ba-4e8387c65ac3-1-CurvaDeValor.png",
      mime_type: "image/png",
      file_size: 13090,
      description: "Curva de valor",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:26:15.000Z'),
      updated_at: new Date('2025-11-21T16:26:15.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F4_S1_ModeloDeNegocioCanvas",
      original_filename: "1-BusinessModelCanvas.png",
      s3_key: "tenants/1/events/1/assets/1763742416181-963e3f9e-c752-4cc9-bd16-98fe744e4158-1-BusinessModelCanvas.png",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742416181-963e3f9e-c752-4cc9-bd16-98fe744e4158-1-BusinessModelCanvas.png",
      mime_type: "image/png",
      file_size: 101480,
      description: "Modelo de negocio Canvas",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:26:56.000Z'),
      updated_at: new Date('2025-11-21T16:26:56.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F4_S2_AnalizandoLaVentajaCompetitiva",
      original_filename: "1-AnalizandoLaVentajaCompetitiva.png",
      s3_key: "tenants/1/events/1/assets/1763742456391-f654a912-d4f5-4652-b4b1-b171e380c36a-1-AnalizandoLaVentajaCompetitiva.png",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742456391-f654a912-d4f5-4652-b4b1-b171e380c36a-1-AnalizandoLaVentajaCompetitiva.png",
      mime_type: "image/png",
      file_size: 109042,
      description: "Ventaja competitiva",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:27:36.000Z'),
      updated_at: new Date('2025-11-21T16:27:36.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F5_S1_Pitch",
      original_filename: "1-Pitch.webp",
      s3_key: "tenants/1/events/1/assets/1763742499149-3667644d-523b-4a54-ba82-9937e3acfdcc-1-Pitch.webp",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742499149-3667644d-523b-4a54-ba82-9937e3acfdcc-1-Pitch.webp",
      mime_type: "image/webp",
      file_size: 32188,
      description: "Pitch de ascensor",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:28:19.000Z'),
      updated_at: new Date('2025-11-21T16:28:19.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F6_S1_ValidacionDeModeloDeNegocio",
      original_filename: "1-ValidaciA_nDeModeloDeNegocio.webp",
      s3_key: "tenants/1/events/1/assets/1763742555183-4ca9a484-7c84-4a11-99c7-71d6c5b915d6-1-ValidaciA-nDeModeloDeNegocio.webp",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742555183-4ca9a484-7c84-4a11-99c7-71d6c5b915d6-1-ValidaciA-nDeModeloDeNegocio.webp",
      mime_type: "image/webp",
      file_size: 23340,
      description: "Validación de modelo de negocio",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:29:15.000Z'),
      updated_at: new Date('2025-11-21T16:29:15.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F6_S2_ConstruyeTuMVP",
      original_filename: "1-ConstruyeTuMVP.jpg",
      s3_key: "tenants/1/events/1/assets/1763742578467-a2033e99-8552-4a49-8854-e95b040dc384-1-ConstruyeTuMVP.jpg",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742578467-a2033e99-8552-4a49-8854-e95b040dc384-1-ConstruyeTuMVP.jpg",
      mime_type: "image/jpeg",
      file_size: 76829,
      description: "MVP",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:29:38.000Z'),
      updated_at: new Date('2025-11-21T17:14:23.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F6_S3_CronogramaDeGrantt_2",
      original_filename: "2-CronogramaDeGantt.webp",
      s3_key: "tenants/1/events/1/assets/1763742635634-7e64c722-8fb7-45fc-a01d-33459bc2f736-2-CronogramaDeGantt.webp",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742635634-7e64c722-8fb7-45fc-a01d-33459bc2f736-2-CronogramaDeGantt.webp",
      mime_type: "image/webp",
      file_size: 28486,
      description: "Cronograma de Gantt",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:30:35.000Z'),
      updated_at: new Date('2025-11-21T16:30:46.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "F6_S3_DiagramaDeGantt_1",
      original_filename: "1-DiagramaDeGantt.webp",
      s3_key: "tenants/1/events/1/assets/1763742608973-09c9cd9f-81ee-4ea3-b9f4-9d1d33c3e411-1-DiagramaDeGantt.webp",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763742608973-09c9cd9f-81ee-4ea3-b9f4-9d1d33c3e411-1-DiagramaDeGantt.webp",
      mime_type: "image/webp",
      file_size: 46288,
      description: "Diagrama de Gantt",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-21T16:30:08.000Z'),
      updated_at: new Date('2025-11-21T16:30:08.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Guia-practica-para-entender-el-mercado-los-clientes-y-consumidores.pdf",
      original_filename: "Guia-practica-para-entender-el-mercado-los-clientes-y-consumidores.pdf",
      s3_key: "tenants/1/events/1/assets/1763234957316-575201fa-f2aa-4045-a14f-661da9266a2a-Guia-practica-para-entender-el-mercado-los-clientes-y-consumidores.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763234957316-575201fa-f2aa-4045-a14f-661da9266a2a-Guia-practica-para-entender-el-mercado-los-clientes-y-consumidores.pdf",
      mime_type: "application/pdf",
      file_size: 400339,
      description: "Guia Practica Para Entender El Mercado Los Clientes Y Consumidores",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T22:11:27.000Z'),
      updated_at: new Date('2025-11-15T22:11:27.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "investigacion-de-mercado-para-Pymes.pdf",
      original_filename: "investigacion-de-mercado-para-Pymes.pdf",
      s3_key: "tenants/1/events/1/assets/1763234958060-73d9dfa4-6376-4543-af7d-6aac0189b10f-investigacion-de-mercado-para-Pymes.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763234958060-73d9dfa4-6376-4543-af7d-6aac0189b10f-investigacion-de-mercado-para-Pymes.pdf",
      mime_type: "application/pdf",
      file_size: 8460237,
      description: "Investigacion De Mercado Para Pymes",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T22:11:28.000Z'),
      updated_at: new Date('2025-11-15T22:11:28.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "La-propuesta-de-valor-modelos-de-negocio-a-fondo.pdf",
      original_filename: "La-propuesta-de-valor-modelos-de-negocio-a-fondo.pdf",
      s3_key: "tenants/1/events/1/assets/1763234973436-5c03aa3f-17aa-47b0-9194-de476748157e-La-propuesta-de-valor-modelos-de-negocio-a-fondo.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763234973436-5c03aa3f-17aa-47b0-9194-de476748157e-La-propuesta-de-valor-modelos-de-negocio-a-fondo.pdf",
      mime_type: "application/pdf",
      file_size: 6448389,
      description: "La Propuesta De Valor Modelos De Negocio A Fondo",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T19:29:36.000Z'),
      updated_at: new Date('2025-11-15T19:29:36.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Modelo-Canvas.doc",
      original_filename: "Modelo-Canvas.doc",
      s3_key: "tenants/1/events/1/assets/1763230903947-0b4be4a0-4d2f-4c6c-942b-ea5d418b4e3a-Modelo-Canvas.doc",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230903947-0b4be4a0-4d2f-4c6c-942b-ea5d418b4e3a-Modelo-Canvas.doc",
      mime_type: "application/msword",
      file_size: 55296,
      description: "Modelo Canvas",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:43.000Z'),
      updated_at: new Date('2025-11-15T18:21:43.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "pasos-para-hacer-un-analisis-de-sector.pdf",
      original_filename: "pasos-para-hacer-un-analisis-de-sector.pdf",
      s3_key: "tenants/1/events/1/assets/1763234956455-637d6a6c-fbdb-4b20-a0d1-6232a7dee7b0-10-pasos-para-hacer-un-analisis-de-sector.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763234956455-637d6a6c-fbdb-4b20-a0d1-6232a7dee7b0-10-pasos-para-hacer-un-analisis-de-sector.pdf",
      mime_type: "application/pdf",
      file_size: 373713,
      description: "Pasos Para Hacer Un Analisis De Sector",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T22:11:27.000Z'),
      updated_at: new Date('2025-11-15T22:11:27.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Pitch-deck.pptx",
      original_filename: "Pitch-deck.pptx",
      s3_key: "tenants/1/events/1/assets/1763230910260-755df31d-7ee6-451b-bec0-d3e061951300-Pitch-deck.pptx",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230910260-755df31d-7ee6-451b-bec0-d3e061951300-Pitch-deck.pptx",
      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      file_size: 4269522,
      description: "Pitch Deck",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:55.000Z'),
      updated_at: new Date('2025-11-15T18:21:55.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Plantilla-de-Diagrama-de-Gantt.xlsx",
      original_filename: "Plantilla-de-Diagrama-de-Gantt.xlsx",
      s3_key: "tenants/1/events/1/assets/1763230935248-c35cec39-5b39-4d27-819b-02d8923fbcd5-Plantilla-de-Diagrama-de-Gantt.xlsx",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230935248-c35cec39-5b39-4d27-819b-02d8923fbcd5-Plantilla-de-Diagrama-de-Gantt.xlsx",
      mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      file_size: 208457,
      description: "Plantilla De Diagrama De Gantt",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:22:15.000Z'),
      updated_at: new Date('2025-11-15T18:22:15.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Plantilla-de-las-5-Fuerzas-de-Porter.pptx",
      original_filename: "Plantilla-de-las-5-Fuerzas-de-Porter.pptx",
      s3_key: "tenants/1/events/1/assets/1763230897332-1c38f023-5195-4251-ae74-840cd947a6c8-Plantilla-de-las-5-Fuerzas-de-Porter.pptx",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230897332-1c38f023-5195-4251-ae74-840cd947a6c8-Plantilla-de-las-5-Fuerzas-de-Porter.pptx",
      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      file_size: 3246672,
      description: "Plantilla De Las 5 Fuerzas De Porter",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:37.000Z'),
      updated_at: new Date('2025-11-15T18:21:37.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Plantilla-de-tipos-de-cliente-1.pptx",
      original_filename: "Plantilla-de-tipos-de-cliente-1.pptx",
      s3_key: "tenants/1/events/1/assets/1763230901145-e3430bca-3aef-40b6-91df-4e6a5b18727b-Plantilla-de-tipos-de-cliente-1.pptx",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230901145-e3430bca-3aef-40b6-91df-4e6a5b18727b-Plantilla-de-tipos-de-cliente-1.pptx",
      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      file_size: 811711,
      description: "Plantilla De Tipos De Cliente 1",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:41.000Z'),
      updated_at: new Date('2025-11-15T18:21:41.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Plantilla-de-ventaja-comparativa-1.pptx",
      original_filename: "Plantilla-de-ventaja-comparativa-1.pptx",
      s3_key: "tenants/1/events/1/assets/1763230904999-407f59b3-c33a-4ca1-be1a-c3897c3e45b3-Plantilla-de-ventaja-comparativa-1.pptx",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230904999-407f59b3-c33a-4ca1-be1a-c3897c3e45b3-Plantilla-de-ventaja-comparativa-1.pptx",
      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      file_size: 3365517,
      description: "Plantilla De Ventaja Comparativa 1",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:48.000Z'),
      updated_at: new Date('2025-11-15T18:21:48.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Plantilla-para-hacer-segmentacion-de-mercado-1.pptx",
      original_filename: "Plantilla-para-hacer-segmentacion-de-mercado-1.pptx",
      s3_key: "tenants/1/events/1/assets/1763230902164-ecc5344a-ded5-4b02-b970-72c56e281cc6-Plantilla-para-hacer-segmentacion-de-mercado-1.pptx",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230902164-ecc5344a-ded5-4b02-b970-72c56e281cc6-Plantilla-para-hacer-segmentacion-de-mercado-1.pptx",
      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      file_size: 4618903,
      description: "Plantilla Para Hacer Segmentacion De Mercado 1",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:42.000Z'),
      updated_at: new Date('2025-11-15T18:21:42.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Plantilla-para-implementar-la-estrategia-oceanos-azules.pptx",
      original_filename: "Plantilla-para-implementar-la-estrategia-oceanos-azules.pptx",
      s3_key: "tenants/1/events/1/assets/1763230903673-a388dbc3-22d1-4189-89d4-990d7050cf71-Plantilla-para-implementar-la-estrategia-oceanos-azules.pptx",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230903673-a388dbc3-22d1-4189-89d4-990d7050cf71-Plantilla-para-implementar-la-estrategia-oceanos-azules.pptx",
      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      file_size: 1174473,
      description: "Plantilla Para Implementar La Estrategia Oceanos Azules",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:43.000Z'),
      updated_at: new Date('2025-11-15T18:21:43.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "plantilla-propuesta-de-valor.pdf",
      original_filename: "plantilla-propuesta-de-valor.pdf",
      s3_key: "tenants/1/events/1/assets/1763230903347-f448671d-fe40-46b3-8e3f-061b29e5834d-plantilla-propuesta-de-valor.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230903347-f448671d-fe40-46b3-8e3f-061b29e5834d-plantilla-propuesta-de-valor.pdf",
      mime_type: "application/pdf",
      file_size: 548933,
      description: "Plantilla Propuesta De Valor",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:43.000Z'),
      updated_at: new Date('2025-11-15T18:21:43.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "PLANTILLA-TAM-SAM-SOM-1.pptx",
      original_filename: "PLANTILLA-TAM-SAM-SOM-1.pptx",
      s3_key: "tenants/1/events/1/assets/1763230901566-9d05bae6-d1a3-4639-84bd-f8bb059efedc-PLANTILLA-TAM-SAM-SOM-1.pptx",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230901566-9d05bae6-d1a3-4639-84bd-f8bb059efedc-PLANTILLA-TAM-SAM-SOM-1.pptx",
      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      file_size: 339375,
      description: "Plantilla Tam Sam Som 1",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:41.000Z'),
      updated_at: new Date('2025-11-15T18:21:41.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Plantillas-para-realizar-un-analisis-FODA.pptx",
      original_filename: "Plantillas-para-realizar-un-analisis-FODA.pptx",
      s3_key: "tenants/1/events/1/assets/1763230898984-3e04ba2f-f922-4450-a0e3-dfa5f6911b59-Plantillas-para-realizar-un-analisis-FODA.pptx",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230898984-3e04ba2f-f922-4450-a0e3-dfa5f6911b59-Plantillas-para-realizar-un-analisis-FODA.pptx",      mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      file_size: 2247763,
      description: "Plantillas Para Realizar Un Analisis Foda",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T18:21:40.000Z'),
      updated_at: new Date('2025-11-15T18:21:40.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Que-es-y-para-que-sirve-un-diagrama-de-Gantt.pdf",
      original_filename: "Que-es-y-para-que-sirve-un-diagrama-de-Gantt.pdf",
      s3_key: "tenants/1/events/1/assets/1763230916139-864f8663-99c8-4036-bb62-000c02492aa9-Que-es-y-para-que-sirve-un-diagrama-de-Gantt.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763230916139-864f8663-99c8-4036-bb62-000c02492aa9-Que-es-y-para-que-sirve-un-diagrama-de-Gantt.pdf",
      mime_type: "application/pdf",
      file_size: 9307250,
      description: "Que Es Y Para Que Sirve Un Diagrama De Gantt",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T22:11:27.000Z'),
      updated_at: new Date('2025-11-15T22:11:27.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Segmentacion-de-mercado-Que-es-y-como-segmentarlo-paso-a-paso.pdf",
      original_filename: "Segmentacion-de-mercado-Que-es-y-como-segmentarlo-paso-a-paso.pdf",
      s3_key: "tenants/1/events/1/assets/1763234968713-931a682a-fef8-4f7c-b2c2-3257f1ec3d9b-Segmentacion-de-mercado-Que-es-y-como-segmentarlo-paso-a-paso.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763234968713-931a682a-fef8-4f7c-b2c2-3257f1ec3d9b-Segmentacion-de-mercado-Que-es-y-como-segmentarlo-paso-a-paso.pdf",
      mime_type: "application/pdf",
      file_size: 562471,
      description: "Segmentacion De Mercado Que Es Y Como Segmentarlo Paso A Paso",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T22:11:28.000Z'),
      updated_at: new Date('2025-11-15T22:11:28.000Z')
    },
    {
      tenant_id: tenant.id,
      event_id: event.id,
      name: "Valores-corporativos-que-son-y-10-ejemplos.pdf",
      original_filename: "Valores-corporativos-que-son-y-10-ejemplos.pdf",
      s3_key: "tenants/1/events/1/assets/1763234982856-5526e34e-be19-448b-bf1a-b468fab2a9b0-Valores-corporativos-que-son-y-10-ejemplos.pdf",
      url: "https://acc-create-test.fra1.digitaloceanspaces.com/tenants/1/events/1/assets/1763234982856-5526e34e-be19-448b-bf1a-b468fab2a9b0-Valores-corporativos-que-son-y-10-ejemplos.pdf",      mime_type: "application/pdf",
      file_size: 3879753,
      description: "Valores Corporativos Que Son Y 10 Ejemplos",
      uploaded_by: adminUser.id,
      created_at: new Date('2025-11-15T22:11:28.000Z'),
      updated_at: new Date('2025-11-15T22:11:28.000Z')
    }
  ];

  // Insertar assets (solo si no existen ya)
  for (const asset of assetsToInsert) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM event_assets WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND name = :assetName LIMIT 1`,
      {
        replacements: {
          assetName: asset.name
        }
      }
    );

    if (existing.length === 0) {
      await queryInterface.bulkInsert('event_assets', [asset]);
    }
  }
}

export async function down(queryInterface) {
  const [[tenant]] = await queryInterface.sequelize.query(
    "SELECT id FROM tenants WHERE slug = 'uic' LIMIT 1"
  );

  if (!tenant) {
    return;
  }

  // Verificar si la columna name es JSON (multiidioma) o STRING
  const eventsTableDesc = await queryInterface.describeTable('events').catch(() => ({}));
  const isEventsNameJSON = eventsTableDesc.name && (eventsTableDesc.name.type === 'json' || eventsTableDesc.name.type?.includes('json') || eventsTableDesc.name.type === 'JSON');

  // Buscar el evento según el tipo de columna
  const eventQuery = isEventsNameJSON
    ? `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND JSON_EXTRACT(name, '$.es') = 'SPP 2026' LIMIT 1`
    : `SELECT id FROM events WHERE tenant_id = ${tenant.id} AND name = 'SPP 2026' LIMIT 1`;
  
  const [[event]] = await queryInterface.sequelize.query(eventQuery);

  if (event) {
    // Eliminar solo los assets insertados por este seeder
    // (identificados por los nombres normalizados)
    const assetNames = [
      "Analisis-Pestel.pptx",
      "bienvenidos-imagen1",
      "Como-definir-la-misio-vision-y-valores-de-una-empresa-ejemplos.pdf",
      "Como-formular-la-propuesta-de-valor-de-una-empresa.pdf",
      "Como-hacer-un-analisis-pestal.pdf",
      "Como-realizar-un-analisis-de-mercado-para-su-producto.pdf",
      "competitive-analysis-file-pdf.pdf",
      "Crea-un-diagrama-de-Gantt-con-Canva.pdf",
      "Crea-una-plantilla-para-tus-cronogramas-con-Excel.pdf",
      "Encuestas-de-investigacion-de-mercado-1.pdf",
      "F1_S1_AnalisisDeMercado_1",
      "F1_S1_FuerzasDePorter_2",
      "F1_S2_PESTEL",
      "F1_S3_DAFO",
      "F1_S4_ElMercado_FotoIman_1",
      "F1_S4_TiposDeClientesEnElMercado_2",
      "F1_S5_AnalisisDeCompetidores",
      "F2_S1_CuantificacionDeMercado_1",
      "F2_S1_FormulaParaFiltrarElSam_2",
      "F2_S2_VentanaDeOportunidad",
      "F3_S1_PropuestaDeValor",
      "F3_S2_CurvaDeValor",
      "F4_S1_ModeloDeNegocioCanvas",
      "F4_S2_AnalizandoLaVentajaCompetitiva",
      "F5_S1_Pitch",
      "F6_S1_ValidacionDeModeloDeNegocio",
      "F6_S2_ConstruyeTuMVP",
      "F6_S3_CronogramaDeGrantt_2",
      "F6_S3_DiagramaDeGantt_1",
      "Guia-practica-para-entender-el-mercado-los-clientes-y-consumidores.pdf",
      "investigacion-de-mercado-para-Pymes.pdf",
      "La-propuesta-de-valor-modelos-de-negocio-a-fondo.pdf",
      "Modelo-Canvas.doc",
      "pasos-para-hacer-un-analisis-de-sector.pdf",
      "Pitch-deck.pptx",
      "Plantilla-de-Diagrama-de-Gantt.xlsx",
      "Plantilla-de-las-5-Fuerzas-de-Porter.pptx",
      "Plantilla-de-tipos-de-cliente-1.pptx",
      "Plantilla-de-ventaja-comparativa-1.pptx",
      "Plantilla-para-hacer-segmentacion-de-mercado-1.pptx",
      "Plantilla-para-implementar-la-estrategia-oceanos-azules.pptx",
      "plantilla-propuesta-de-valor.pdf",
      "PLANTILLA-TAM-SAM-SOM-1.pptx",
      "Plantillas-para-realizar-un-analisis-FODA.pptx",
      "Que-es-y-para-que-sirve-un-diagrama-de-Gantt.pdf",
      "Segmentacion-de-mercado-Que-es-y-como-segmentarlo-paso-a-paso.pdf",
      "Valores-corporativos-que-son-y-10-ejemplos.pdf"
    ];

    for (const assetName of assetNames) {
      await queryInterface.sequelize.query(
        `DELETE FROM event_assets WHERE tenant_id = ${tenant.id} AND event_id = ${event.id} AND name = :assetName`,
        {
          replacements: {
            assetName
          }
        }
      );
    }
  }
}