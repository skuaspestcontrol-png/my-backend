const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const d = require("./domain");
const BRAND_KEYS = [
  "name",
  "address",
  "city",
  "state",
  "pincode",
  "email",
  "phone",
  "alternatePhone",
  "website",
  "gstNumber",
  "accent",
  "companyType",
  "logoBase64",
  "logoHash",
];
function brandingFromSettings(settings, companyType, resolveAsset) {
  const prefix = companyType === "NON_GST" ? "nonGst" : "gst";
  const name = d.text(settings[`${prefix}CompanyName`], 255);
  const logoValue =
    companyType === "GST"
      ? settings.gstCompanyLogo || settings.gstCompanyLogoUrl
      : settings.nonGstCompanyLogoUrl;
  const logoPath = logoValue && resolveAsset(logoValue);
  if (!name || !logoPath || !fs.existsSync(logoPath))
    d.fail(
      422,
      `Configure the official ${companyType === "GST" ? "GST" : "Non-GST"} company name and logo before submitting or generating a PDF`,
    );
  const logo = fs.readFileSync(logoPath);
  const [mime] = d.fileType(logo);
  if (
    !["image/png", "image/jpeg"].includes(mime) ||
    logo.length > 10 * 1024 * 1024
  )
    d.fail(422, "Company logo must be a JPEG or PNG image");
  return {
    name,
    address: d.text(
      settings[`${prefix}BillingAddress`] || settings[`${prefix}Address`],
    ),
    city: d.text(settings[`${prefix}City`]),
    state: d.text(settings[`${prefix}State`]),
    pincode: d.text(settings[`${prefix}Pincode`]),
    email: d.text(settings[`${prefix}Email`]),
    phone: d.text(settings[`${prefix}Phone`]),
    alternatePhone: d.text(settings[`${prefix}AlternatePhone`]),
    website: d.text(settings.companyWebsite),
    gstNumber: companyType === "GST" ? d.text(settings.companyGstNumber) : "",
    accent: /^#[0-9a-f]{6}$/i.test(settings.brandingAccentColor || "")
      ? settings.brandingAccentColor
      : "#9F174D",
    companyType,
    logoBase64: logo.toString("base64"),
    logoHash: d.hash(logo),
  };
}
function safeBranding(input) {
  return Object.fromEntries(BRAND_KEYS.map((k) => [k, input[k] || ""]));
}
async function renderPdf(
  snapshot,
  { readFile = () => null, onFragment, onLayout } = {},
) {
  const content = d.publicContent(snapshot.content),
    brand = safeBranding(snapshot.branding),
    files = (snapshot.files || []).filter((f) => f.include_in_pdf);
  if (!brand.logoBase64 || !brand.name)
    d.fail(422, "Official company branding is required");
  const chunks = [];
  let currentPage = 0;
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 45, bottom: 45, left: 55, right: 55 },
    bufferPages: true,
    info: {
      Title: `Pest Control Service Report ${snapshot.reportNumber}`,
      Author: brand.name,
      Subject: "Recorded pest control service details",
    },
  });
  const finished = new Promise((resolve, reject) => {
    doc.on("data", (b) => chunks.push(b));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  if (onFragment) {
    const original = doc._fragment;
    doc._fragment = function (text, x, y, options) {
      onFragment({
        text,
        x,
        y,
        page: currentPage,
        width: this.widthOfString(text),
        height:
          ((this._font.ascender - this._font.descender) * this._fontSize) /
          1000,
      });
      return original.call(this, text, x, y, options);
    };
  }
  const fonts = { regular: "Helvetica", bold: "Helvetica-Bold" };
  const candidates = (names) => [
    ...names.map((name) => path.join(__dirname, "../assets/fonts", name)),
    ...names.map((name) => path.join(__dirname, "../fonts", name)),
    ...names.map((name) => path.join(process.cwd(), "assets/fonts", name)),
    ...names.map((name) => path.join(process.cwd(), "fonts", name)),
    ...names.map((name) =>
      path.join("/usr/share/fonts/truetype/msttcorefonts", name),
    ),
    ...names.map((name) =>
      path.join("/usr/share/fonts/truetype/microsoft", name),
    ),
    ...names.map((name) => path.join("/Library/Fonts", name)),
    ...names.map((name) =>
      path.join("/System/Library/Fonts/Supplemental", name),
    ),
  ];
  try {
    for (const [key, names, env] of [
      [
        "regular",
        [
          "calibri.ttf",
          "Calibri.ttf",
          "calibri-regular.ttf",
          "Calibri-Regular.ttf",
        ],
        "CALIBRI_FONT_PATH",
      ],
      [
        "bold",
        [
          "calibrib.ttf",
          "Calibri-Bold.ttf",
          "calibri-bold.ttf",
          "Calibri Bold.ttf",
        ],
        "CALIBRI_BOLD_FONT_PATH",
      ],
    ]) {
      const font =
        String(process.env[env] || "").trim() ||
        candidates(names).find((candidate) => fs.existsSync(candidate));
      if (font && fs.existsSync(font)) {
        doc.registerFont(`Report-${key}`, font);
        fonts[key] = `Report-${key}`;
      }
    }
    if (fonts.regular === "Report-regular" && fonts.bold === "Helvetica-Bold")
      fonts.bold = fonts.regular;
  } catch {
    fonts.regular = "Helvetica";
    fonts.bold = "Helvetica-Bold";
  }
  const left = 55,
    right = doc.page.width - 55,
    width = right - left,
    bottom = doc.page.height - 58;
  function watermark() {
    if (snapshot.state === "Approved") return;
    doc
      .save()
      .fillColor("#64748b")
      .fillOpacity(0.1)
      .font(fonts.bold)
      .fontSize(86)
      .rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] })
      .text("DRAFT", left, doc.page.height / 2 - 43, {
        width,
        align: "center",
        lineBreak: false,
      })
      .restore();
  }
  let contentTop = 144;
  function letterhead() {
    // Renewal letter's A4 margins, logo fit, typography, contact arrangement and accent.
    const lines = [
      brand.address,
      [brand.city, brand.state].filter(Boolean).join(",") +
        (brand.pincode ? ` - ${brand.pincode}, India` : ""),
      brand.email ? `Email: ${brand.email}` : "",
      brand.phone
        ? `Mobile: ${[brand.phone, brand.alternatePhone].filter(Boolean).join(", ")}`
        : "",
      brand.website ? `Web: ${brand.website}` : "",
      brand.gstNumber ? `GST Details: ${brand.gstNumber}` : "",
    ].filter(Boolean);
    doc.font(fonts.bold).fontSize(10.2);
    const headerX = Math.max(left, right - doc.widthOfString(brand.name)),
      headerWidth = right - headerX;
    const logoY = 45 + (11.2 + lines.length * 9.1 - 160) / 2;
    doc.image(Buffer.from(brand.logoBase64, "base64"), left, logoY, {
      fit: [400, 160],
    });
    doc
      .fillColor("#111827")
      .text(brand.name, headerX, 45, { width, lineBreak: false });
    doc.font(fonts.regular).fontSize(8.1).fillColor("#475569");
    lines.forEach((line) =>
      doc.text(line, headerX, doc.y + 1, { width: headerWidth, lineGap: 0 }),
    );
    doc.y = Math.max(doc.y + 8, 118) + 26;
    contentTop = doc.y;
  }
  letterhead();
  doc.on("pageAdded", () => {
    currentPage++;
    letterhead();
    doc.font(fonts.regular).fontSize(9).fillColor("#111827");
  });
  const space = (h) => {
    if (doc.y + h > bottom) doc.addPage();
  };
  const usableHeight = () => bottom - contentTop;
  const reserve = (height) =>
    space(
      height <= usableHeight()
        ? height
        : Math.min(3 * lineHeight() + 10, usableHeight()),
    );
  function textLines(value, textWidth = width) {
    doc.font(fonts.regular).fontSize(9);
    const lines = [];
    for (const para of String(value).split(/\r?\n/)) {
      let line = "";
      for (let word of para.split(/\s+/).filter(Boolean)) {
        if (line && doc.widthOfString(`${line} ${word}`) > textWidth) {
          lines.push(line);
          line = "";
        }
        // URLs/unbroken evidence identifiers must not trigger PDFKit auto-pagination.
        while (doc.widthOfString(word) > textWidth) {
          let n = 1;
          while (
            n < word.length &&
            doc.widthOfString(word.slice(0, n + 1)) <= textWidth
          )
            n++;
          lines.push(word.slice(0, n));
          word = word.slice(n);
        }
        line = line ? `${line} ${word}` : word;
      }
      lines.push(line);
    }
    return lines;
  }
  const lineHeight = () => {
    doc.font(fonts.regular).fontSize(9);
    return doc.currentLineHeight(true) + 1;
  };
  const paragraphHeight = (value) =>
    value ? textLines(value).length * lineHeight() + 5 : 0;
  const headingHeight = (value) => {
    doc.font(fonts.bold).fontSize(12);
    return doc.heightOfString(value, { width }) + 7;
  };
  function heading(value, after = 0) {
    reserve(headingHeight(value) + Math.max(after, 3 * lineHeight() + 10));
    doc
      .font(fonts.bold)
      .fontSize(12)
      .fillColor(brand.accent)
      .text(value, left, doc.y, { width });
    doc.y += 7;
  }
  function paragraph(value, after = 0, keepStart = false) {
    if (!value) return;
    const lines = textLines(value),
      h = lineHeight();
    const total = lines.length * h + 5 + after;
    if (!keepStart && total <= usableHeight()) space(total);
    let offset = 0;
    while (offset < lines.length) {
      let count = Math.floor((bottom - doc.y - 5) / h),
        remaining = lines.length - offset;
      if (count < Math.min(2, remaining)) {
        doc.addPage();
        continue;
      }
      count = Math.min(count, remaining);
      if (count === remaining && doc.y + count * h + 5 + after > bottom) {
        if (remaining <= 2 && remaining * h + 5 + after <= usableHeight()) {
          doc.addPage();
          continue;
        }
        count = Math.max(1, remaining - 2);
      } else if (remaining - count === 1 && count > 1) count--;
      doc.font(fonts.regular).fontSize(9).fillColor("#111827");
      for (const line of lines.slice(offset, offset + count)) {
        const y = doc.y;
        doc.text(line, left, y, { width, lineBreak: false });
        doc.y = y + h;
      }
      offset += count;
      if (offset < lines.length) doc.addPage();
    }
    doc.y += 5;
  }
  function mediaLayout(file) {
    const texts = [
      [file.category, file.caption, file.area].filter(Boolean).join(" — "),
      `Evidence ${file.id} | Uploaded: ${file.created_at || "-"}${file.captured_at ? ` | Captured: ${file.captured_at}` : ""}`,
      file.annotations ? `Annotations / markers: ${file.annotations}` : "",
    ].filter(Boolean);
    let image;
    if (file.mime_type.startsWith("image/")) {
      const bytes = readFile(file);
      if (!bytes) d.fail(422, "A referenced evidence image is unavailable");
      const source = doc.openImage(bytes);
      const scale = Math.min(width / source.width, 220 / source.height);
      image = {
        bytes,
        width: source.width * scale,
        height: source.height * scale,
      };
    } else
      texts.push(
        `Attached PDF reference: ${file.original_name}. Download the original through the authorised report.`,
      );
    return {
      texts,
      image,
      height:
        texts.reduce((h, t) => h + paragraphHeight(t), 0) +
        (image ? image.height + 10 : 0),
    };
  }
  function media(file, layout, firstHeadingHeight = 0) {
    const whole = layout.height + firstHeadingHeight <= usableHeight();
    if (whole) reserve(layout.height);
    else space(2 * lineHeight());
    layout.texts.forEach((text, index) => {
      const rest =
        layout.texts
          .slice(index + 1)
          .reduce((h, t) => h + paragraphHeight(t), 0) +
        (layout.image ? layout.image.height + 10 : 0);
      paragraph(
        text,
        rest <= usableHeight() - 2 * lineHeight() - 5
          ? rest
          : Math.min(
              paragraphHeight(layout.texts[index + 1]),
              2 * lineHeight() + 5,
            ),
        !whole && index === 0,
      );
      onLayout?.({
        type: "media-text",
        id: file.id,
        page: currentPage,
        bottom: doc.y,
      });
    });
    if (layout.image) {
      const image = layout.image,
        y = doc.y,
        x = left + (width - image.width) / 2;
      doc.image(image.bytes, x, y, {
        width: image.width,
        height: image.height,
      });
      onLayout?.({
        type: "image",
        id: file.id,
        page: currentPage,
        x,
        y,
        width: image.width,
        height: image.height,
      });
      doc.y = y + image.height + 10;
    }
  }
  function compactFields(value, defs) {
    const present = defs.filter(
      ([key]) => key !== "internalNotes" && value?.[key],
    );
    for (let i = 0; i < present.length; i += 2) {
      const pair = present.slice(i, i + 2),
        texts = pair.map(([key, label]) => `${label}: ${value[key]}`),
        cellWidth = (width - 18) / 2;
      doc.font(fonts.regular).fontSize(9);
      const h =
        Math.max(
          ...texts.map((t) => doc.heightOfString(t, { width: cellWidth })),
        ) + 9;
      space(h);
      const y = doc.y;
      texts.forEach((t, j) =>
        doc
          .fillColor("#111827")
          .text(t, left + j * (cellWidth + 18), y, { width: cellWidth }),
      );
      doc.y = y + h;
    }
  }
  function table(headers, rows, ratios) {
    const widths = ratios.map((r) => width * r),
      fontSize = 8.4;
    const measure = (text, i) =>
      doc
        .font(fonts.regular)
        .fontSize(fontSize)
        .heightOfString(String(text), { width: widths[i] - 10, lineGap: 1 });
    const drawHeader = () => {
      space(32);
      const y = doc.y;
      let x = left;
      headers.forEach((text, i) => {
        doc.rect(x, y, widths[i], 25).fill(brand.accent);
        doc
          .font(fonts.bold)
          .fontSize(fontSize)
          .fillColor("#ffffff")
          .text(text, x + 5, y + 7, {
            width: widths[i] - 10,
            lineBreak: false,
          });
        x += widths[i];
      });
      doc.y = y + 25;
    };
    drawHeader();
    for (const cells of rows) {
      let rest = cells.map((v) => String(v || "—"));
      while (rest.some(Boolean)) {
        if (bottom - doc.y < 32) {
          doc.addPage();
          drawHeader();
        }
        const available = bottom - doc.y - 12;
        const pieces = rest.map((text, i) => {
          if (measure(text, i) <= available) return [text, ""];
          let low = 1,
            high = text.length;
          while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            if (measure(text.slice(0, mid), i) <= available) low = mid;
            else high = mid - 1;
          }
          const prefix = text.slice(0, low),
            boundary = prefix.lastIndexOf(" ");
          const split = boundary > 0 ? boundary : low;
          return [
            text.slice(0, split).trimEnd(),
            text.slice(split).trimStart(),
          ];
        });
        const h = Math.max(
            25,
            ...pieces.map(([text], i) => measure(text, i) + 12),
          ),
          y = doc.y;
        let x = left;
        pieces.forEach(([text], i) => {
          doc
            .rect(x, y, widths[i], h)
            .lineWidth(0.4)
            .strokeColor("#cbd5e1")
            .stroke();
          doc
            .font(fonts.regular)
            .fontSize(fontSize)
            .fillColor("#111827")
            .text(text, x + 5, y + 6, { width: widths[i] - 10, lineGap: 1 });
          x += widths[i];
        });
        doc.y = y + h;
        rest = pieces.map(([, tail]) => tail);
        if (rest.some(Boolean)) {
          doc.addPage();
          drawHeader();
        }
      }
    }
    doc.y += 10;
  }
  function fieldTexts(value, defs) {
    return defs
      .filter(([key]) => key !== "internalNotes" && value?.[key])
      .map(
        ([key, label]) =>
          `${label}: ${
            key === "photoIds"
              ? value[key]
                  .split(",")
                  .map(
                    (id) =>
                      files.find((f) => f.id === id)?.caption ||
                      "Linked photograph",
                  )
                  .join("; ")
              : value[key]
          }`,
      );
  }
  function renderFields(value, defs, after = 0) {
    const texts = fieldTexts(value, defs);
    texts.forEach((text, index) =>
      paragraph(
        text,
        index === texts.length - 1
          ? after
          : Math.min(paragraphHeight(texts[index + 1]), 2 * lineHeight() + 5),
      ),
    );
  }
  const approvalText =
    snapshot.state === "Approved"
      ? `Approved by ${snapshot.recordedBy?.name || "-"} on ${snapshot.recordedAt}. Approved version ${snapshot.revision}.`
      : "";
  const approvalHeight = () =>
    approvalText
      ? headingHeight("Approval") + paragraphHeight(approvalText)
      : 0;
  const acknowledgementNote =
    "Acknowledgement records receipt or the service details shown; it does not certify pest elimination or waive rights.";
  function signatureLayout() {
    return ["technicianSignature", "customerSignature"].map((kind) => {
      const signature = files.find((f) => f.kind === kind);
      let image;
      if (signature) {
        const bytes = readFile(signature);
        if (!bytes) d.fail(422, "A signature file is unavailable");
        const source = doc.openImage(bytes),
          scale = Math.min((width / 2 - 15) / source.width, 78 / source.height);
        image = {
          bytes,
          width: source.width * scale,
          height: source.height * scale,
        };
      }
      return { kind, signature, image };
    });
  }
  const signatures = signatureLayout();
  const signatureHeight = () =>
    18 +
    Math.max(...signatures.map((s) => s.image?.height || lineHeight())) +
    8 +
    lineHeight() +
    10;
  space(48);
  doc
    .font(fonts.bold)
    .fontSize(16)
    .fillColor(brand.accent)
    .text("Pest Control Service Report", left, doc.y, {
      width,
      align: "center",
    });
  doc.y += 6;
  paragraph(
    `Report: ${snapshot.reportNumber}   |   Version: ${snapshot.revision}   |   ${snapshot.state}`,
  );
  if (snapshot.state !== "Approved")
    paragraph("DRAFT / REVIEW COPY — not an approved final report");
  paragraph(
    `Prepared by: ${snapshot.preparedBy || "-"} | ${snapshot.recordedAt || ""}`,
  );
  for (const [index, section] of d.schema.sections.entries()) {
    const title = `${index + 1}. ${section.title}`;
    if (section.key === "followup") {
      reserve(
        headingHeight(title) +
          fieldTexts(content.followup, section.fields).reduce(
            (h, t) => h + paragraphHeight(t),
            0,
          ) +
          approvalHeight(),
      );
    } else if (section.key === "acknowledgement") {
      const acknowledgementHeight =
        headingHeight(title) +
        fieldTexts(content.acknowledgement, section.fields).reduce(
          (h, t) => h + paragraphHeight(t),
          0,
        ) +
        paragraphHeight(acknowledgementNote) +
        signatureHeight();
      const attachments = files
        .filter((f) => f.kind === "attachment")
        .map(mediaLayout);
      const followupSection = d.schema.sections.find(
        (s) => s.key === "followup",
      );
      const closingHeight =
        acknowledgementHeight +
        headingHeight("9. Supporting attachments") +
        (attachments.length
          ? attachments.reduce((h, layout) => h + layout.height, 0)
          : paragraphHeight("No supporting files included.")) +
        headingHeight(`10. ${followupSection.title}`) +
        fieldTexts(content.followup, followupSection.fields).reduce(
          (h, t) => h + paragraphHeight(t),
          0,
        ) +
        approvalHeight();
      // Keep the complete short sign-off together; long evidence/follow-up sections
      // paginate independently while preserving their headings and final approval.
      reserve(
        closingHeight <= usableHeight() ? closingHeight : acknowledgementHeight,
      );
    }

    const selected = section.fileKind
      ? files.filter((f) => f.kind === section.fileKind)
      : [];
    const layouts = selected.map(mediaLayout);
    const first = layouts[0],
      excess = first ? headingHeight(title) + first.height - usableHeight() : 0;
    if (first?.image && excess > 0 && excess < first.image.height / 2) {
      // A small proportional reduction can keep a near-page-sized caption/image
      // with its section heading. Oversized text continues with widow control.
      const scale = (first.image.height - excess) / first.image.height;
      first.image.width *= scale;
      first.image.height *= scale;
      first.height -= excess;
    }
    heading(title, layouts[0]?.height || 0);
    if (section.fileKind) {
      if (!selected.length) paragraph("No supporting files included.");
      selected.forEach((file, i) =>
        media(file, layouts[i], i === 0 ? headingHeight(title) : 0),
      );
    } else if (section.repeatable) {
      const entries = content[section.key];
      if (!entries.length) paragraph("No entries recorded.");
      if (section.key === "findings" && entries.length)
        table(
          ["Pest / species", "Activity", "Area", "Evidence / count"],
          entries.map((e) => [
            [e.pestType, e.species].filter(Boolean).join(" / "),
            e.activityLevel,
            e.area,
            [
              e.evidence,
              e.estimatedCount ? `Measured count: ${e.estimatedCount}` : "",
            ]
              .filter(Boolean)
              .join(" — "),
          ]),
          [0.24, 0.13, 0.23, 0.4],
        );
      entries.forEach((entry, i) => {
        space(38);
        paragraph(`Entry ${i + 1}`);
        renderFields(
          entry,
          section.key === "findings"
            ? section.fields.filter(
                ([k]) =>
                  ![
                    "pestType",
                    "species",
                    "activityLevel",
                    "area",
                    "evidence",
                    "estimatedCount",
                  ].includes(k),
              )
            : section.fields,
        );
        if (section.productFields && entry.products.length)
          table(
            [
              "Product / identification",
              "Concentration / dilution",
              "Quantity / unit",
            ],
            entry.products.map((p) => [
              [p.name, p.registration].filter(Boolean).join(" — "),
              p.dilution,
              [p.quantity, p.unit].filter(Boolean).join(" "),
            ]),
            [0.42, 0.35, 0.23],
          );
      });
      if (section.safetyFields) {
        heading("Safety information recorded");
        renderFields(content.safety, section.safetyFields);
      }
    } else {
      if (section.key === "header") {
        compactFields(content[section.key], section.fields);
        const source = snapshot.content.sourceContext || {},
          links = content.links;
        compactFields(
          {
            customerId: links.customerId,
            siteReference: source.site?.name || links.premiseId,
            jobReference: source.job?.name || links.jobId,
            contractReference: source.contract?.name || links.contractReference,
            scheduleReference: source.schedule
              ? `${source.schedule.date} · Visit ${source.schedule.number}`
              : links.scheduleReference,
            technicians:
              source.assignees
                ?.map((employee) => employee.name)
                .filter(Boolean)
                .join(", ") || content.assignees.join(", "),
          },
          [
            ["customerId", "CRM customer ID"],
            ["siteReference", "Site reference"],
            ["jobReference", "Job reference"],
            ["contractReference", "Contract reference"],
            ["scheduleReference", "Schedule reference"],
            ["technicians", "Assigned technicians"],
          ],
        );
      } else
        renderFields(
          content[section.key],
          section.fields,
          section.key === "followup"
            ? approvalHeight()
            : section.key === "acknowledgement"
              ? paragraphHeight(acknowledgementNote) + signatureHeight()
              : 0,
        );
      if (section.key === "acknowledgement") {
        paragraph(acknowledgementNote, signatureHeight());
        reserve(signatureHeight());
        const y = doc.y;
        const imageHeight = Math.max(
          ...signatures.map((s) => s.image?.height || lineHeight()),
        );
        signatures.forEach(({ kind, signature, image }, i) => {
          const x = left + (i * width) / 2;
          doc
            .font(fonts.bold)
            .fontSize(9)
            .fillColor("#111827")
            .text(
              kind === "technicianSignature"
                ? "Technician signature"
                : "Customer signature",
              x,
              y,
              { width: width / 2 - 12 },
            );
          if (image) {
            doc.image(image.bytes, x, y + 18, {
              width: image.width,
              height: image.height,
            });
            doc
              .font(fonts.regular)
              .fontSize(8)
              .text(
                String(signature.created_at || ""),
                x,
                y + 18 + imageHeight + 8,
                { width: width / 2 - 15 },
              );
          } else
            doc
              .font(fonts.regular)
              .fontSize(8)
              .text("Not recorded", x, y + 18, { width: width / 2 - 15 });
        });
        doc.y = y + signatureHeight();
      }
    }
  }
  if (snapshot.state === "Approved") {
    heading("Approval", paragraphHeight(approvalText));
    paragraph(approvalText);
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    currentPage = i;
    // Light overlay stays identifiable even on photo-heavy pages.
    watermark();
    const margin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font(fonts.regular)
      .fontSize(8)
      .fillColor("#475569")
      .text(
        `${snapshot.reportNumber} | ${snapshot.state} | Page ${i + 1} of ${range.count}`,
        left,
        doc.page.height - 39,
        { width, lineBreak: false, align: "center" },
      );
    doc.page.margins.bottom = margin;
  }
  doc.end();
  return finished;
}
module.exports = { brandingFromSettings, safeBranding, renderPdf };
