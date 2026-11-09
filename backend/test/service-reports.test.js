const test = require("node:test");
const assert = require("node:assert/strict");
const d = require("../serviceReports/domain");
const { fixture } = require("./service-reports-fixtures");

test("all ten sections are represented by a single schema", () => {
  assert.equal(d.schema.sections.length, 10);
  assert.equal(d.schema.sections.filter((s) => s.fileKind).length, 3);
});
test("customer identity and company identity are required", () => {
  for (const change of [
    (c) => (c.links.customerId = ""),
    (c) => (c.header.companyType = "UNKNOWN"),
  ]) {
    const c = fixture();
    change(c);
    assert.throws(() => d.normalize(c), { status: 422 });
  }
});
test("empty findings remain unassessed rather than absent", () => {
  const c = fixture();
  c.findings = [];
  assert.deepEqual(d.normalize(c).findings, []);
});
test("customer-facing content is allowlisted and removes internal notes and secrets", () => {
  const c = fixture();
  c.bankAccount = "BANK-SECRET";
  c.smtpPassword = "TOKEN-SECRET";
  c.summary.password = "HIDDEN";
  const output = JSON.stringify(d.publicContent(c));
  for (const value of [
    "CONFIDENTIAL_INTERNAL_SENTINEL",
    "BANK-SECRET",
    "TOKEN-SECRET",
    "HIDDEN",
  ])
    assert(!output.includes(value));
});
test("invalid dates, negative quantities and arbitrary enum values fail validation", () => {
  for (const edit of [
    (c) => (c.header.serviceDate = "2026-02-30"),
    (c) => (c.header.serviceDate = "invalid"),
    (c) => (c.findings[0].estimatedCount = "-1"),
    (c) => (c.findings[0].activityLevel = "Eliminated"),
    (c) => (c.treatments[0].products[0].quantity = "NaN"),
  ]) {
    const c = fixture();
    edit(c);
    assert.throws(() => d.normalize(c), { status: 422 });
  }
});
test("submission validates technician signature and customer unavailable reason", () => {
  const c = fixture();
  assert.throws(() => d.validateSubmission(c, []), { status: 422 });
  d.validateSubmission(c, [{ kind: "technicianSignature" }]);
  c.acknowledgement.reason = "";
  assert.throws(
    () => d.validateSubmission(c, [{ kind: "technicianSignature" }]),
    { status: 422 },
  );
});
test("signed customer response requires acknowledgement, name and signature", () => {
  const c = fixture();
  c.acknowledgement.customerResponse = "Signed";
  assert.throws(
    () => d.validateSubmission(c, [{ kind: "technicianSignature" }]),
    { status: 422 },
  );
  d.validateSubmission(c, [
    { kind: "technicianSignature" },
    { kind: "customerSignature" },
  ]);
});
test("signature digest changes when report content or evidence metadata changes", () => {
  const c = fixture(),
    files = [{ id: "x", kind: "photo", sha256: "hash", caption: "before" }],
    a = d.signatureHash(c, files);
  c.summary.mainFindings = "Changed";
  assert.notEqual(a, d.signatureHash(c, files));
  files[0].caption = "after";
  assert.notEqual(d.signatureHash(fixture(), files), a);
});
test("file content validation rejects script disguises and unsupported files", () => {
  assert.throws(() => d.fileType(Buffer.from("<script>bad</script>")), {
    status: 422,
  });
  assert.equal(d.fileType(Buffer.from("%PDF-1.7\n"))[0], "application/pdf");
});
test("repeatable sections and oversized text have explicit limits", () => {
  const c = fixture();
  c.findings = Array.from({ length: 101 }, () => ({}));
  assert.throws(() => d.normalize(c), { status: 422 });
  c.findings = [];
  c.summary.remarks = "x".repeat(6001);
  assert.throws(() => d.normalize(c), { status: 422 });
});
test("canonical hashes survive MySQL JSON key reordering", () => {
  assert.equal(
    d.hash({ z: 1, a: { c: 2, b: 3 } }),
    d.hash({ a: { b: 3, c: 2 }, z: 1 }),
  );
  assert.equal(
    d.hash({ date: new Date("2026-11-07T00:00:00Z") }),
    d.hash({ date: "2026-11-07T00:00:00.000Z" }),
  );
});
test("idempotency normalization is stable when entry IDs are omitted", () => {
  const c = fixture();
  delete c.findings[0].entryId;
  assert.equal(d.hash(d.normalize(c)), d.hash(d.normalize(c)));
});
test("storage configuration cannot place evidence beneath a public root", () => {
  const { createServiceReportRouter } = require("../serviceReports/routes");
  assert.throws(
    () =>
      createServiceReportRouter({
        getConnection: () => {},
        privateRoot: "/tmp/public/evidence",
        publicRoots: ["/tmp/public"],
      }),
    /outside public/,
  );
});

test("company selection matches existing explicit document types and legacy zero-tax fallback", () => {
  assert.equal(
    d.companyTypeForInvoice({ invoiceType: "GST", totalTax: 0 }),
    "GST",
  );
  assert.equal(
    d.companyTypeForInvoice({ invoice_type: "NON-GST", totalTax: 100 }),
    "NON_GST",
  );
  assert.equal(d.companyTypeForInvoice({ total_tax: "0.00" }), "NON_GST");
  assert.equal(d.companyTypeForInvoice({ taxAmount: "1,800.00" }), "GST");
  assert.equal(d.companyTypeForInvoice({}), "GST");
});

test("overnight service clock times are retained without assuming a same-day completion", () => {
  const content = fixture();
  content.header.startTime = "23:00";
  content.header.endTime = "01:00";
  const saved = d.normalize(content);
  d.validateSubmission(saved, [{ kind: "technicianSignature" }]);
  assert.equal(saved.header.endTime, "01:00");
});
