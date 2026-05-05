const express = require('express');
const { query: dbQuery, getConnection } = require('../lib/db');
const { generateQuotationPdfBuffer } = require('../quotationPdf');

const router = express.Router();

const toNumber = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const clean = (v) => String(v ?? '').trim();

const ensureTables = async () => {
  await dbQuery(`CREATE TABLE IF NOT EXISTS quotation_template_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    logo_url TEXT NULL,
    logo_width INT DEFAULT 90,
    logo_height INT DEFAULT 70,
    header_alignment VARCHAR(20) DEFAULT 'left',
    company_name VARCHAR(255) DEFAULT '',
    company_address TEXT NULL,
    phone VARCHAR(50) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    website VARCHAR(255) DEFAULT '',
    gstin VARCHAR(64) DEFAULT '',
    header_line_color VARCHAR(20) DEFAULT '#9F174D',
    primary_color VARCHAR(20) DEFAULT '#9F174D',
    border_color VARCHAR(20) DEFAULT '#cbd5e1',
    font_family VARCHAR(80) DEFAULT 'Helvetica',
    font_size INT DEFAULT 10,
    heading_font_size INT DEFAULT 14,
    body_font_size INT DEFAULT 10,
    table_font_size INT DEFAULT 9,
    footer_text TEXT NULL,
    signature_image_url TEXT NULL,
    default_sales_person VARCHAR(255) DEFAULT '',
    default_designation VARCHAR(255) DEFAULT '',
    default_mobile VARCHAR(50) DEFAULT '',
    show_logo TINYINT(1) DEFAULT 1,
    show_gstin TINYINT(1) DEFAULT 1,
    show_signature TINYINT(1) DEFAULT 1,
    show_page_number TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS quotation_prefix_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    prefix VARCHAR(50) DEFAULT 'SPC/',
    financial_year VARCHAR(20) DEFAULT '',
    enable_service_code TINYINT(1) DEFAULT 1,
    next_number INT DEFAULT 1,
    padding_digits INT DEFAULT 4,
    format_template VARCHAR(255) DEFAULT '{{prefix}}{{year}}/{{service_code}}/{{number}}',
    service_code_map_json JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS quotation_service_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    service_name VARCHAR(255) NOT NULL,
    service_code VARCHAR(30) DEFAULT '',
    pest_name VARCHAR(255) DEFAULT '',
    quotation_title VARCHAR(255) DEFAULT '',
    about_pest TEXT NULL,
    what_we_do TEXT NULL,
    treatment_points TEXT NULL,
    default_infestation_level VARCHAR(100) DEFAULT '',
    default_frequency VARCHAR(120) DEFAULT '',
    default_recommendation TEXT NULL,
    default_gst_percentage DECIMAL(10,2) DEFAULT 18,
    default_rate_without_gst DECIMAL(12,2) DEFAULT 0,
    default_rate_with_gst DECIMAL(12,2) DEFAULT 0,
    warranty_note TEXT NULL,
    service_terms TEXT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS quotation_common_paragraphs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    opening_paragraph TEXT NULL,
    closing_paragraph TEXT NULL,
    payment_terms TEXT NULL,
    general_terms TEXT NULL,
    warranty_paragraph TEXT NULL,
    disclaimer_paragraph TEXT NULL,
    relationship_closing_paragraph TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS infestation_levels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    level_name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    recommendation_text TEXT NULL,
    image_url TEXT NULL,
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS quotations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_number VARCHAR(120) NOT NULL,
    source_type VARCHAR(40) DEFAULT 'Manual',
    lead_id VARCHAR(80) NULL,
    customer_id VARCHAR(80) NULL,
    customer_name VARCHAR(255) DEFAULT '',
    company_name VARCHAR(255) DEFAULT '',
    address TEXT NULL,
    phone VARCHAR(50) DEFAULT '',
    whatsapp VARCHAR(50) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    gstin VARCHAR(64) DEFAULT '',
    quotation_date DATE NULL,
    validity_days INT DEFAULT 15,
    prepared_by VARCHAR(255) DEFAULT '',
    sales_person VARCHAR(255) DEFAULT '',
    designation VARCHAR(255) DEFAULT '',
    mobile VARCHAR(50) DEFAULT '',
    contract_start_date DATE NULL,
    contract_end_date DATE NULL,
    subtotal_without_gst DECIMAL(12,2) DEFAULT 0,
    gst_total DECIMAL(12,2) DEFAULT 0,
    round_off DECIMAL(12,2) DEFAULT 0,
    grand_total DECIMAL(12,2) DEFAULT 0,
    amount_in_words TEXT NULL,
    rate_type VARCHAR(40) DEFAULT 'With GST',
    status VARCHAR(40) DEFAULT 'Draft',
    opening_paragraph TEXT NULL,
    payment_terms TEXT NULL,
    warranty_note TEXT NULL,
    disclaimer TEXT NULL,
    closing_paragraph TEXT NULL,
    internal_note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_quotation_number (quotation_number)
  )`);

  await dbQuery(`CREATE TABLE IF NOT EXISTS quotation_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_id INT NOT NULL,
    service_template_id INT NULL,
    service_name VARCHAR(255) DEFAULT '',
    service_code VARCHAR(30) DEFAULT '',
    pest_name VARCHAR(255) DEFAULT '',
    service_title VARCHAR(255) DEFAULT '',
    about_pest TEXT NULL,
    what_we_do TEXT NULL,
    treatment_points TEXT NULL,
    infestation_level VARCHAR(100) DEFAULT '',
    infestation_image_url TEXT NULL,
    frequency VARCHAR(120) DEFAULT '',
    recommendation TEXT NULL,
    area_covered VARCHAR(255) DEFAULT '',
    quantity DECIMAL(12,2) DEFAULT 1,
    rate_without_gst DECIMAL(12,2) DEFAULT 0,
    gst_percentage DECIMAL(10,2) DEFAULT 18,
    gst_amount DECIMAL(12,2) DEFAULT 0,
    rate_with_gst DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    contract_start_date DATE NULL,
    contract_end_date DATE NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_quotation_items_quotation_id (quotation_id),
    CONSTRAINT fk_quotation_items_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
  )`);

  const [templateCount] = await dbQuery('SELECT COUNT(*) AS c FROM quotation_template_settings');
  if (!toNumber(templateCount?.c, 0)) {
    await dbQuery(`INSERT INTO quotation_template_settings (company_name, company_address, phone, email, website, gstin, default_sales_person, default_designation, default_mobile)
      VALUES ('SKUAS Pest Control Private Limited', '', '', '', '', '', '', '', '')`);
  }

  const [prefixCount] = await dbQuery('SELECT COUNT(*) AS c FROM quotation_prefix_settings');
  if (!toNumber(prefixCount?.c, 0)) {
    await dbQuery(`INSERT INTO quotation_prefix_settings (prefix, financial_year, enable_service_code, next_number, padding_digits, format_template, service_code_map_json)
      VALUES ('SPC/', YEAR(CURDATE()), 1, 20, 4, '{{prefix}}{{year}}/{{service_code}}/{{number}}', ?)` , [JSON.stringify({
      'Cockroach Control': 'CC',
      'Termite Control': 'TC',
      'Rodent Control': 'RC',
      'General Pest Control': 'GPC',
      'Bed Bug Control': 'BBC',
      'Mosquito Control': 'MC',
      'AMC Pest Control': 'AMC'
    })]);
  }

  const [commonCount] = await dbQuery('SELECT COUNT(*) AS c FROM quotation_common_paragraphs');
  if (!toNumber(commonCount?.c, 0)) {
    await dbQuery(`INSERT INTO quotation_common_paragraphs (
      opening_paragraph, closing_paragraph, payment_terms, general_terms, warranty_paragraph, disclaimer_paragraph, relationship_closing_paragraph
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      'Thank you for the kind courtesy extended to us. We are pleased to submit our offer for your pest control requirement.',
      'We look forward to working with you and delivering consistent, safe, and effective pest management services.',
      '50% advance and remaining on completion unless otherwise agreed in writing.',
      'Service scheduling is subject to site readiness and safety compliance.',
      'Warranty is applicable as per selected service plan and infestation profile.',
      'This proposal is based on current visible infestation and may vary if site conditions change significantly.',
      'We value a long-term relationship and assure responsive service support.'
    ]);
  }

  const [serviceCount] = await dbQuery('SELECT COUNT(*) AS c FROM quotation_service_templates');
  if (!toNumber(serviceCount?.c, 0)) {
    await dbQuery(`INSERT INTO quotation_service_templates (service_name, service_code, pest_name, quotation_title, about_pest, what_we_do, default_infestation_level, default_frequency, default_recommendation, default_gst_percentage, default_rate_without_gst, default_rate_with_gst, warranty_note, is_active)
      VALUES 
      ('Cockroach Control','CC','Cockroach','Quotation for Cockroach Control','Cockroaches are resilient pests that contaminate food and surfaces.','Targeted gel baiting and spray treatment in critical hotspots.','Medium','Single treatment with follow-up','Maintain kitchen hygiene and close drain entries.',18,2000,2360,'Warranty as per plan.',1),
      ('Termite Control','TC','Termite','Quotation for Termite Control','Termites damage wood structures silently over time.','Drill-fill and trenching treatment with anti-termite chemicals.','High','One-time intensive + periodic checks','Avoid moisture accumulation near wood contact areas.',18,5000,5900,'Warranty as per contract.',1),
      ('Rodent Control','RC','Rodent','Quotation for Rodent Control','Rodents spread disease and damage wiring/material.','Baiting, trapping, and proofing recommendations.','Medium','Monthly','Seal entry points and maintain waste control.',18,2500,2950,'Warranty as per plan.',1),
      ('General Pest Control','GPC','General Pest','Quotation for General Pest Control','General pests include ants, flies, and crawling insects.','Integrated spray and gel treatment in affected zones.','Low','Quarterly','Keep food sealed and reduce standing water.',18,1800,2124,'Warranty as per plan.',1),
      ('Bed Bug Control','BBC','Bed Bug','Quotation for Bed Bug Control','Bed bugs hide in cracks and upholstery and spread quickly.','Detailed inspection with focused chemical and non-chemical treatment.','High','Two visits','Hot wash linens and isolate infested items.',18,3500,4130,'Warranty as per plan.',1)`);
  }

  const [levelCount] = await dbQuery('SELECT COUNT(*) AS c FROM infestation_levels');
  if (!toNumber(levelCount?.c, 0)) {
    await dbQuery(`INSERT INTO infestation_levels (level_name, description, recommendation_text, sort_order, is_active)
      VALUES 
      ('Low','Limited signs in isolated zones','Preventive treatment and monitoring recommended.',1,1),
      ('Medium','Visible activity in multiple points','Corrective treatment with follow-up recommended.',2,1),
      ('High','Frequent activity across critical areas','Intensive treatment and strict sanitation required.',3,1),
      ('Severe','Heavy and recurring activity','Immediate multi-stage treatment and close monitoring needed.',4,1)`);
  }
};

const boolToTiny = (v, fallback = 1) => {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === 0 || v === 1) return v;
  if (String(v || '').toLowerCase() === 'yes' || String(v || '').toLowerCase() === 'true') return 1;
  if (String(v || '').toLowerCase() === 'no' || String(v || '').toLowerCase() === 'false') return 0;
  return fallback;
};

const getPrefixSettings = async () => {
  await ensureTables();
  const rows = await dbQuery('SELECT * FROM quotation_prefix_settings ORDER BY id ASC LIMIT 1');
  return rows[0] || null;
};

const resolveServiceCode = (prefixSettings, firstItem) => {
  const enableCode = boolToTiny(prefixSettings.enable_service_code, 1) === 1;
  if (!enableCode) return '';
  const codeFromItem = clean(firstItem?.service_code);
  if (codeFromItem) return codeFromItem;
  let map = {};
  try { map = JSON.parse(prefixSettings.service_code_map_json || '{}'); } catch (_e) {}
  return clean(map[clean(firstItem?.service_name)] || 'GEN');
};

const generateQuotationNumber = async (conn, firstItem) => {
  const [rows] = await conn.execute('SELECT * FROM quotation_prefix_settings ORDER BY id ASC LIMIT 1 FOR UPDATE');
  const settings = rows[0];
  if (!settings) {
    const year = String(new Date().getFullYear());
    return { quotationNumber: `SPC/${year}/GEN/0001`, prefixRow: null, nextNumber: 2 };
  }
  const serviceCode = resolveServiceCode(settings, firstItem) || 'GEN';
  const next = Math.max(1, toNumber(settings.next_number, 1));
  const digits = Math.max(1, toNumber(settings.padding_digits, 4));
  const seq = String(next).padStart(digits, '0');
  const prefix = clean(settings.prefix || 'SPC/');
  const year = clean(settings.financial_year || String(new Date().getFullYear()));
  const tpl = clean(settings.format_template || '{{prefix}}{{year}}/{{service_code}}/{{number}}');
  const quotationNumber = tpl
    .replaceAll('{{prefix}}', prefix)
    .replaceAll('{{year}}', year)
    .replaceAll('{{service_code}}', serviceCode)
    .replaceAll('{{number}}', seq);

  return { quotationNumber, prefixRow: settings, nextNumber: next + 1 };
};

router.use(async (_req, _res, next) => {
  try {
    await ensureTables();
    next();
  } catch (error) {
    next(error);
  }
});

router.get('/settings/quotation-template', async (_req, res) => {
  const rows = await dbQuery('SELECT * FROM quotation_template_settings ORDER BY id ASC LIMIT 1');
  res.json(rows[0] || {});
});

router.put('/settings/quotation-template', async (req, res) => {
  const rows = await dbQuery('SELECT id FROM quotation_template_settings ORDER BY id ASC LIMIT 1');
  const id = rows[0]?.id;
  const payload = req.body || {};
  const values = [
    clean(payload.logo_url), toNumber(payload.logo_width, 90), toNumber(payload.logo_height, 70), clean(payload.header_alignment || 'left'),
    clean(payload.company_name), clean(payload.company_address), clean(payload.phone), clean(payload.email), clean(payload.website), clean(payload.gstin),
    clean(payload.header_line_color || '#9F174D'), clean(payload.primary_color || '#9F174D'), clean(payload.border_color || '#cbd5e1'), clean(payload.font_family || 'Helvetica'),
    toNumber(payload.font_size, 10), toNumber(payload.heading_font_size, 14), toNumber(payload.body_font_size, 10), toNumber(payload.table_font_size, 9),
    clean(payload.footer_text), clean(payload.signature_image_url), clean(payload.default_sales_person), clean(payload.default_designation), clean(payload.default_mobile),
    boolToTiny(payload.show_logo, 1), boolToTiny(payload.show_gstin, 1), boolToTiny(payload.show_signature, 1), boolToTiny(payload.show_page_number, 1)
  ];
  if (id) {
    await dbQuery(`UPDATE quotation_template_settings SET
      logo_url=?,logo_width=?,logo_height=?,header_alignment=?,company_name=?,company_address=?,phone=?,email=?,website=?,gstin=?,
      header_line_color=?,primary_color=?,border_color=?,font_family=?,font_size=?,heading_font_size=?,body_font_size=?,table_font_size=?,
      footer_text=?,signature_image_url=?,default_sales_person=?,default_designation=?,default_mobile=?,show_logo=?,show_gstin=?,show_signature=?,show_page_number=?
      WHERE id=?`, [...values, id]);
  } else {
    await dbQuery(`INSERT INTO quotation_template_settings (
      logo_url,logo_width,logo_height,header_alignment,company_name,company_address,phone,email,website,gstin,
      header_line_color,primary_color,border_color,font_family,font_size,heading_font_size,body_font_size,table_font_size,
      footer_text,signature_image_url,default_sales_person,default_designation,default_mobile,show_logo,show_gstin,show_signature,show_page_number
    ) VALUES (${new Array(27).fill('?').join(',')})`, values);
  }
  const out = await dbQuery('SELECT * FROM quotation_template_settings ORDER BY id ASC LIMIT 1');
  res.json(out[0] || {});
});

router.get('/settings/quotation-prefixes', async (_req, res) => {
  const row = await getPrefixSettings();
  res.json(row || {});
});

router.put('/settings/quotation-prefixes', async (req, res) => {
  const row = await getPrefixSettings();
  const payload = req.body || {};
  const serviceMapRaw = payload.service_code_map_json || payload.serviceCodeMap || row?.service_code_map_json || '{}';
  let serviceMap = {};
  try {
    serviceMap = typeof serviceMapRaw === 'string' ? JSON.parse(serviceMapRaw || '{}') : (serviceMapRaw || {});
  } catch (_error) {
    return res.status(400).json({ error: 'Invalid service code map JSON' });
  }
  if (!serviceMap || typeof serviceMap !== 'object' || Array.isArray(serviceMap)) {
    return res.status(400).json({ error: 'Service code map must be a JSON object' });
  }
  if (row?.id) {
    await dbQuery('UPDATE quotation_prefix_settings SET prefix=?,financial_year=?,enable_service_code=?,next_number=?,padding_digits=?,format_template=?,service_code_map_json=? WHERE id=?', [
      clean(payload.prefix || row.prefix || 'SPC/'),
      clean(payload.financial_year || row.financial_year || String(new Date().getFullYear())),
      boolToTiny(payload.enable_service_code, 1),
      Math.max(1, toNumber(payload.next_number, row.next_number || 1)),
      Math.max(1, toNumber(payload.padding_digits, row.padding_digits || 4)),
      clean(payload.format_template || row.format_template || '{{prefix}}{{year}}/{{service_code}}/{{number}}'),
      JSON.stringify(serviceMap),
      row.id
    ]);
  }
  const out = await getPrefixSettings();
  res.json(out || {});
});

router.get('/settings/quotation-services', async (_req, res) => {
  const rows = await dbQuery('SELECT * FROM quotation_service_templates ORDER BY is_active DESC, service_name ASC');
  res.json(rows);
});

router.post('/settings/quotation-services', async (req, res) => {
  const b = req.body || {};
  const result = await dbQuery(`INSERT INTO quotation_service_templates (
    service_name,service_code,pest_name,quotation_title,about_pest,what_we_do,treatment_points,default_infestation_level,
    default_frequency,default_recommendation,default_gst_percentage,default_rate_without_gst,default_rate_with_gst,
    warranty_note,service_terms,is_active
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    clean(b.service_name), clean(b.service_code), clean(b.pest_name), clean(b.quotation_title), clean(b.about_pest), clean(b.what_we_do),
    clean(b.treatment_points), clean(b.default_infestation_level), clean(b.default_frequency), clean(b.default_recommendation),
    toNumber(b.default_gst_percentage, 18), toNumber(b.default_rate_without_gst, 0), toNumber(b.default_rate_with_gst, 0),
    clean(b.warranty_note), clean(b.service_terms), boolToTiny(b.is_active, 1)
  ]);
  const created = await dbQuery('SELECT * FROM quotation_service_templates WHERE id=? LIMIT 1', [result.insertId]);
  res.status(201).json(created[0] || {});
});

router.put('/settings/quotation-services/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const b = req.body || {};
  await dbQuery(`UPDATE quotation_service_templates SET
    service_name=?,service_code=?,pest_name=?,quotation_title=?,about_pest=?,what_we_do=?,treatment_points=?,default_infestation_level=?,
    default_frequency=?,default_recommendation=?,default_gst_percentage=?,default_rate_without_gst=?,default_rate_with_gst=?,warranty_note=?,service_terms=?,is_active=?
    WHERE id=?`, [
    clean(b.service_name), clean(b.service_code), clean(b.pest_name), clean(b.quotation_title), clean(b.about_pest), clean(b.what_we_do),
    clean(b.treatment_points), clean(b.default_infestation_level), clean(b.default_frequency), clean(b.default_recommendation),
    toNumber(b.default_gst_percentage, 18), toNumber(b.default_rate_without_gst, 0), toNumber(b.default_rate_with_gst, 0),
    clean(b.warranty_note), clean(b.service_terms), boolToTiny(b.is_active, 1), id
  ]);
  const out = await dbQuery('SELECT * FROM quotation_service_templates WHERE id=? LIMIT 1', [id]);
  res.json(out[0] || {});
});

router.delete('/settings/quotation-services/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  await dbQuery('DELETE FROM quotation_service_templates WHERE id=?', [id]);
  res.json({ success: true });
});

router.get('/settings/quotation-common-paragraphs', async (_req, res) => {
  const rows = await dbQuery('SELECT * FROM quotation_common_paragraphs ORDER BY id ASC LIMIT 1');
  res.json(rows[0] || {});
});

router.put('/settings/quotation-common-paragraphs', async (req, res) => {
  const rows = await dbQuery('SELECT id FROM quotation_common_paragraphs ORDER BY id ASC LIMIT 1');
  const id = rows[0]?.id;
  const b = req.body || {};
  const values = [clean(b.opening_paragraph), clean(b.closing_paragraph), clean(b.payment_terms), clean(b.general_terms), clean(b.warranty_paragraph), clean(b.disclaimer_paragraph), clean(b.relationship_closing_paragraph)];
  if (id) {
    await dbQuery('UPDATE quotation_common_paragraphs SET opening_paragraph=?,closing_paragraph=?,payment_terms=?,general_terms=?,warranty_paragraph=?,disclaimer_paragraph=?,relationship_closing_paragraph=? WHERE id=?', [...values, id]);
  } else {
    await dbQuery('INSERT INTO quotation_common_paragraphs (opening_paragraph,closing_paragraph,payment_terms,general_terms,warranty_paragraph,disclaimer_paragraph,relationship_closing_paragraph) VALUES (?,?,?,?,?,?,?)', values);
  }
  const out = await dbQuery('SELECT * FROM quotation_common_paragraphs ORDER BY id ASC LIMIT 1');
  res.json(out[0] || {});
});

router.get('/settings/infestation-levels', async (_req, res) => {
  const rows = await dbQuery('SELECT * FROM infestation_levels ORDER BY sort_order ASC, level_name ASC');
  res.json(rows);
});

router.post('/settings/infestation-levels', async (req, res) => {
  const b = req.body || {};
  const result = await dbQuery('INSERT INTO infestation_levels (level_name,description,recommendation_text,image_url,sort_order,is_active) VALUES (?,?,?,?,?,?)', [
    clean(b.level_name), clean(b.description), clean(b.recommendation_text), clean(b.image_url), toNumber(b.sort_order, 0), boolToTiny(b.is_active, 1)
  ]);
  const out = await dbQuery('SELECT * FROM infestation_levels WHERE id=? LIMIT 1', [result.insertId]);
  res.status(201).json(out[0] || {});
});

router.put('/settings/infestation-levels/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const b = req.body || {};
  await dbQuery('UPDATE infestation_levels SET level_name=?,description=?,recommendation_text=?,image_url=?,sort_order=?,is_active=? WHERE id=?', [
    clean(b.level_name), clean(b.description), clean(b.recommendation_text), clean(b.image_url), toNumber(b.sort_order, 0), boolToTiny(b.is_active, 1), id
  ]);
  const out = await dbQuery('SELECT * FROM infestation_levels WHERE id=? LIMIT 1', [id]);
  res.json(out[0] || {});
});

router.delete('/settings/infestation-levels/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  await dbQuery('DELETE FROM infestation_levels WHERE id=?', [id]);
  res.json({ success: true });
});

router.get('/quotations', async (_req, res) => {
  const rows = await dbQuery('SELECT * FROM quotations ORDER BY id DESC LIMIT 300');
  res.json(rows);
});

router.get('/quotations/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const [q] = await dbQuery('SELECT * FROM quotations WHERE id=? LIMIT 1', [id]);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const items = await dbQuery('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY sort_order ASC, id ASC', [id]);
  res.json({ ...q, items });
});

router.post('/quotations', async (req, res) => {
  const b = req.body || {};
  const inputItems = Array.isArray(b.items) ? b.items : [];
  if (!inputItems.length) return res.status(400).json({ error: 'At least one service item is required' });

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const generated = await generateQuotationNumber(conn, inputItems[0]);
    const quotationNumber = clean(b.quotation_number) || generated.quotationNumber;

    const [insertResult] = await conn.execute(`INSERT INTO quotations (
      quotation_number,source_type,lead_id,customer_id,customer_name,company_name,address,phone,whatsapp,email,gstin,
      quotation_date,validity_days,prepared_by,sales_person,designation,mobile,contract_start_date,contract_end_date,
      subtotal_without_gst,gst_total,round_off,grand_total,amount_in_words,rate_type,status,
      opening_paragraph,payment_terms,warranty_note,disclaimer,closing_paragraph,internal_note
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      quotationNumber,
      clean(b.source_type || 'Manual'),
      clean(b.lead_id), clean(b.customer_id), clean(b.customer_name), clean(b.company_name), clean(b.address), clean(b.phone), clean(b.whatsapp), clean(b.email), clean(b.gstin),
      clean(b.quotation_date) || null, toNumber(b.validity_days, 15), clean(b.prepared_by), clean(b.sales_person), clean(b.designation), clean(b.mobile),
      clean(b.contract_start_date) || null, clean(b.contract_end_date) || null,
      toNumber(b.subtotal_without_gst, 0), toNumber(b.gst_total, 0), toNumber(b.round_off, 0), toNumber(b.grand_total, 0), clean(b.amount_in_words), clean(b.rate_type || 'With GST'), clean(b.status || 'Draft'),
      clean(b.opening_paragraph), clean(b.payment_terms), clean(b.warranty_note), clean(b.disclaimer), clean(b.closing_paragraph), clean(b.internal_note)
    ]);

    const quotationId = insertResult.insertId;
    for (let i = 0; i < inputItems.length; i += 1) {
      const item = inputItems[i] || {};
      await conn.execute(`INSERT INTO quotation_items (
        quotation_id,service_template_id,service_name,service_code,pest_name,service_title,about_pest,what_we_do,treatment_points,
        infestation_level,infestation_image_url,frequency,recommendation,area_covered,quantity,rate_without_gst,gst_percentage,
        gst_amount,rate_with_gst,total_amount,contract_start_date,contract_end_date,sort_order
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        quotationId,
        toNumber(item.service_template_id, null), clean(item.service_name), clean(item.service_code), clean(item.pest_name), clean(item.service_title),
        clean(item.about_pest), clean(item.what_we_do), clean(item.treatment_points), clean(item.infestation_level), clean(item.infestation_image_url),
        clean(item.frequency), clean(item.recommendation), clean(item.area_covered), toNumber(item.quantity, 1), toNumber(item.rate_without_gst, 0),
        toNumber(item.gst_percentage, 18), toNumber(item.gst_amount, 0), toNumber(item.rate_with_gst, 0), toNumber(item.total_amount, 0),
        clean(item.contract_start_date || b.contract_start_date) || null, clean(item.contract_end_date || b.contract_end_date) || null, i + 1
      ]);
    }

    if (generated.prefixRow?.id && !clean(b.quotation_number)) {
      await conn.execute('UPDATE quotation_prefix_settings SET next_number=? WHERE id=?', [generated.nextNumber, generated.prefixRow.id]);
    }

    await conn.commit();
    const [q] = await dbQuery('SELECT * FROM quotations WHERE id=? LIMIT 1', [quotationId]);
    const items = await dbQuery('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY sort_order ASC,id ASC', [quotationId]);
    res.status(201).json({ ...q, items });
  } catch (error) {
    await conn.rollback();
    console.error('Failed to create quotation:', error.message);
    res.status(500).json({ error: error.message || 'Failed to create quotation' });
  } finally {
    conn.release();
  }
});

router.put('/quotations/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];

  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`UPDATE quotations SET
      source_type=?,lead_id=?,customer_id=?,customer_name=?,company_name=?,address=?,phone=?,whatsapp=?,email=?,gstin=?,
      quotation_date=?,validity_days=?,prepared_by=?,sales_person=?,designation=?,mobile=?,contract_start_date=?,contract_end_date=?,
      subtotal_without_gst=?,gst_total=?,round_off=?,grand_total=?,amount_in_words=?,rate_type=?,status=?,
      opening_paragraph=?,payment_terms=?,warranty_note=?,disclaimer=?,closing_paragraph=?,internal_note=? WHERE id=?`, [
      clean(b.source_type || 'Manual'), clean(b.lead_id), clean(b.customer_id), clean(b.customer_name), clean(b.company_name), clean(b.address),
      clean(b.phone), clean(b.whatsapp), clean(b.email), clean(b.gstin), clean(b.quotation_date) || null, toNumber(b.validity_days, 15),
      clean(b.prepared_by), clean(b.sales_person), clean(b.designation), clean(b.mobile), clean(b.contract_start_date) || null, clean(b.contract_end_date) || null,
      toNumber(b.subtotal_without_gst, 0), toNumber(b.gst_total, 0), toNumber(b.round_off, 0), toNumber(b.grand_total, 0), clean(b.amount_in_words),
      clean(b.rate_type || 'With GST'), clean(b.status || 'Draft'), clean(b.opening_paragraph), clean(b.payment_terms), clean(b.warranty_note), clean(b.disclaimer), clean(b.closing_paragraph), clean(b.internal_note), id
    ]);

    await conn.execute('DELETE FROM quotation_items WHERE quotation_id=?', [id]);
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i] || {};
      await conn.execute(`INSERT INTO quotation_items (
        quotation_id,service_template_id,service_name,service_code,pest_name,service_title,about_pest,what_we_do,treatment_points,
        infestation_level,infestation_image_url,frequency,recommendation,area_covered,quantity,rate_without_gst,gst_percentage,
        gst_amount,rate_with_gst,total_amount,contract_start_date,contract_end_date,sort_order
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
        id,
        toNumber(item.service_template_id, null), clean(item.service_name), clean(item.service_code), clean(item.pest_name), clean(item.service_title),
        clean(item.about_pest), clean(item.what_we_do), clean(item.treatment_points), clean(item.infestation_level), clean(item.infestation_image_url),
        clean(item.frequency), clean(item.recommendation), clean(item.area_covered), toNumber(item.quantity, 1), toNumber(item.rate_without_gst, 0),
        toNumber(item.gst_percentage, 18), toNumber(item.gst_amount, 0), toNumber(item.rate_with_gst, 0), toNumber(item.total_amount, 0),
        clean(item.contract_start_date || b.contract_start_date) || null, clean(item.contract_end_date || b.contract_end_date) || null, i + 1
      ]);
    }

    await conn.commit();
    const [q] = await dbQuery('SELECT * FROM quotations WHERE id=? LIMIT 1', [id]);
    const outItems = await dbQuery('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY sort_order ASC,id ASC', [id]);
    res.json({ ...q, items: outItems });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message || 'Failed to update quotation' });
  } finally {
    conn.release();
  }
});

router.delete('/quotations/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  await dbQuery('DELETE FROM quotations WHERE id=?', [id]);
  res.json({ success: true });
});

router.get('/quotations/:id/pdf', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const [quotation] = await dbQuery('SELECT * FROM quotations WHERE id=? LIMIT 1', [id]);
  if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

  const items = await dbQuery('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY sort_order ASC,id ASC', [id]);
  const [templateSettings] = await dbQuery('SELECT * FROM quotation_template_settings ORDER BY id ASC LIMIT 1');
  const [commonParagraphs] = await dbQuery('SELECT * FROM quotation_common_paragraphs ORDER BY id ASC LIMIT 1');

  const pdf = await generateQuotationPdfBuffer({ quotation, items, templateSettings: templateSettings || {}, commonParagraphs: commonParagraphs || {} });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=${clean(quotation.quotation_number || `quotation-${id}`)}.pdf`);
  res.send(pdf);
});

module.exports = { quotationRouter: router };
