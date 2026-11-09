const crypto = require("crypto");
const schema = require("./schema.json");
const capabilities = [
  "view",
  "create",
  "edit",
  "submit",
  "review",
  "pdf",
  "share",
  "history",
];
const states = ["Draft", "Submitted", "Approved", "Revision Required"];
const fileKinds = [
  "photo",
  "siteMap",
  "attachment",
  "technicianSignature",
  "customerSignature",
];
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REPORT_BYTES = 80 * 1024 * 1024;
class ReportError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
const fail = (status, message, fields) => {
  throw new ReportError(status, message, fields);
};
const canonical = (value) =>
  value instanceof Date
    ? value.toISOString()
    : Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          )
        : value;
const hash = (value) =>
  crypto
    .createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(canonical(value)),
    )
    .digest("hex");
const parse = (value) =>
  typeof value === "string" ? JSON.parse(value) : value;
const actorId = (user) =>
  String(
    user?.serviceReportIdentity?.canonicalId ||
      user?.employeeId ||
      user?.id ||
      "",
  );
const actorIds = (user) =>
  user?.serviceReportIdentity?.aliases || [actorId(user)];
const approvalConflictIds = (user) =>
  user?.serviceReportIdentity?.possibleAliases || actorIds(user);
const text = (value, max = 6000) => {
  if (typeof value !== "string" && typeof value !== "number" && value != null)
    fail(422, "Text fields must contain text");
  const s = String(value ?? "").trim();
  if (s.length > max) fail(422, `Field exceeds ${max} characters`);
  return s;
};
function fields(input = {}, defs = []) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail(422, "Invalid section");
  return Object.fromEntries(
    defs.map(([key, , type, options]) => {
      const value = text(input[key]);
      if (value && options && !options.split("|").includes(value))
        fail(422, `Invalid ${key}`);
      if (
        value &&
        type === "date" &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
            new Date(value).toISOString().slice(0, 10) !== value))
      )
        fail(422, `Invalid ${key}`);
      if (value && type === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
        fail(422, `Invalid ${key}`);
      if (
        value &&
        type === "number" &&
        (!Number.isFinite(Number(value)) || Number(value) < 0)
      )
        fail(422, `${key} must be a non-negative number`);
      if (
        value &&
        type === "email" &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      )
        fail(422, "Invalid email");
      return [key, value];
    }),
  );
}
function normalize(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail(422, "Invalid report");
  const content = {};
  for (const section of schema.sections) {
    if (section.fileKind) continue;
    const raw = input[section.key] || (section.repeatable ? [] : {});
    if (section.repeatable) {
      if (!Array.isArray(raw) || raw.length > 100)
        fail(422, "Maximum 100 entries per section");
      content[section.key] = raw.map((entry, index) => {
        const item = fields(entry, section.fields);
        item.entryId = text(entry.entryId || `${section.key}-${index + 1}`, 80);
        if (section.productFields) {
          if (
            !Array.isArray(entry.products || []) ||
            (entry.products || []).length > 30
          )
            fail(422, "Maximum 30 products per treatment");
          item.products = (entry.products || []).map((product) =>
            fields(product, section.productFields),
          );
        }
        return item;
      });
    } else content[section.key] = fields(raw, section.fields);
    if (section.safetyFields)
      content.safety = fields(input.safety || {}, section.safetyFields);
  }
  content.links = fields(
    input.links || {},
    [
      "customerId",
      "premiseId",
      "jobId",
      "contractReference",
      "contractSource",
      "scheduleReference",
    ].map((k) => [k]),
  );
  for (const [key, value] of Object.entries(content.links))
    content.links[key] = text(
      value,
      key === "scheduleReference"
        ? 255
        : key === "premiseId"
          ? 100
          : key === "contractReference"
            ? 120
            : 80,
    );
  for (const key of [
    "customerName",
    "siteName",
    "contactPerson",
    "email",
    "serviceType",
  ])
    content.header[key] = text(content.header[key], 255);
  content.header.mobile = text(content.header.mobile, 50);
  if (!["", "invoice", "contract"].includes(content.links.contractSource))
    fail(422, "Invalid contract source");
  if (
    !Array.isArray(input.assignees || []) ||
    (input.assignees || []).length > 20
  )
    fail(422, "Maximum 20 assignees");
  content.assignees = [
    ...new Set(
      (input.assignees || []).map((value) => text(value, 120)).filter(Boolean),
    ),
  ];
  if (!content.links.customerId)
    fail(422, "Select a genuine CRM customer", { customerId: "Required" });
  if (!["GST", "NON_GST"].includes(content.header.companyType))
    fail(422, "Select GST or Non-GST company");
  return content;
}
function validateSubmission(content, files) {
  const errors = {};
  for (const key of [
    "reportDate",
    "serviceDate",
    "customerName",
    "siteAddress",
    "serviceType",
  ])
    if (!content.header[key]) errors[key] = "Required";
  for (const key of [
    "visitPurpose",
    "serviceStatus",
    "mainFindings",
    "workCompleted",
  ])
    if (!content.summary[key]) errors[key] = "Required";
  if (!["Yes", "No"].includes(content.followup.required))
    errors.followup = "Record whether follow-up is required";
  if (content.followup.required === "Yes" && !content.followup.reason)
    errors.followupReason = "Required";
  if (
    content.followup.nextVisitDate &&
    content.header.serviceDate &&
    content.followup.nextVisitDate < content.header.serviceDate
  )
    errors.nextVisitDate = "Next visit must not precede the service";
  // Service clocks may span midnight; do not invent a duration or next-day date.
  content.findings.forEach((f, i) => {
    if (!f.pestType || !f.area || !f.activityLevel)
      errors[`finding${i + 1}`] = "Pest, area and activity are required";
    if (
      f.photoIds &&
      f.photoIds
        .split(",")
        .some(
          (id) =>
            !files.some(
              (file) => file.id === id.trim() && file.kind === "photo",
            ),
        )
    )
      errors[`findingPhotos${i + 1}`] = "Select current report photos";
  });
  content.treatments.forEach((t, i) => {
    if (!t.serviceType || !t.area || !t.workPerformed)
      errors[`treatment${i + 1}`] =
        "Service, area and work performed are required";
    t.products.forEach((p, j) => {
      if (!p.name || (p.quantity && !p.unit))
        errors[`product${i + 1}.${j + 1}`] =
          "Product name and quantity unit are required";
    });
  });
  content.recommendations.forEach((r, i) => {
    if (!r.action || !r.area)
      errors[`recommendation${i + 1}`] = "Action and area are required";
  });
  const ack = content.acknowledgement;
  if (
    !ack.technicianName ||
    !files.some((f) => f.kind === "technicianSignature")
  )
    errors.technicianSignature = "Technician name and signature required";
  if (!["Signed", "Unavailable", "Declined"].includes(ack.customerResponse))
    errors.customerResponse = "Record customer response";
  if (
    ack.customerResponse === "Signed" &&
    (!ack.customerName ||
      !ack.acknowledgement ||
      !files.some((f) => f.kind === "customerSignature"))
  )
    errors.customerSignature =
      "Customer name, acknowledgement and signature required";
  if (["Unavailable", "Declined"].includes(ack.customerResponse) && !ack.reason)
    errors.reason = "A reason is required";
  if (Object.keys(errors).length)
    fail(422, "Complete the required report details before submission", errors);
}
function publicContent(content) {
  const cleaned = normalize(content);
  delete cleaned.followup.internalNotes;
  return cleaned;
}
function signatureHash(content, files) {
  return hash({
    content,
    evidence: files
      .filter((f) => !f.kind.endsWith("Signature"))
      .map((f) => ({
        id: f.id,
        sha256: f.sha256,
        preview_sha256: f.preview_sha256,
        category: f.category,
        caption: f.caption,
        area: f.area,
        annotations: f.annotations,
        display_order: f.display_order,
        include_in_pdf: f.include_in_pdf,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}
function fileType(buffer) {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return ["image/png", ".png"];
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return ["image/jpeg", ".jpg"];
  if (buffer.toString("ascii", 0, 5) === "%PDF-")
    return ["application/pdf", ".pdf"];
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return ["image/webp", ".webp"];
  fail(422, "Only valid JPEG, PNG, WebP and PDF files are supported");
}
// Match the existing Renewal Letter's document-type/tax fallback without altering invoices.
function companyTypeForInvoice(invoice) {
  const type = String(invoice.invoiceType || invoice.invoice_type || "")
    .trim()
    .toUpperCase()
    .replace(/[-_]+/g, " ");
  const raw =
    invoice.totalTax ??
    invoice.total_tax ??
    invoice.taxAmount ??
    invoice.tax_amount;
  const tax = Number(
    typeof raw === "string" ? raw.replace(/,/g, "").trim() : raw,
  );
  return type.includes("NON GST") || (!type && Number.isFinite(tax) && tax <= 0)
    ? "NON_GST"
    : "GST";
}
module.exports = {
  companyTypeForInvoice,
  schema,
  capabilities,
  states,
  fileKinds,
  MAX_FILE_BYTES,
  MAX_REPORT_BYTES,
  ReportError,
  fail,
  hash,
  parse,
  actorId,
  actorIds,
  approvalConflictIds,
  text,
  normalize,
  validateSubmission,
  publicContent,
  signatureHash,
  fileType,
};
