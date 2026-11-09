import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import SignatureCanvas from "react-signature-canvas";
import {
  ClipboardCheck,
  Plus,
  Search,
  Save,
  FileText,
  Camera,
  ShieldCheck,
  X,
  ArrowLeft,
  Download,
  History,
} from "lucide-react";
import PageHeader from "../ui/PageHeader";
import ActionMenu from "../ui/ActionMenu";
import { CRMFormModal, CRMFormStep } from "../ui/CRMFormWizard";
import { CRMFormField, CRMFormGrid, CRMFormSection } from "../ui/CRMForm";
import schema from "../../../../backend/serviceReports/schema.json";
import "./serviceReports.css";

const base = `${import.meta.env.VITE_API_BASE_URL || ""}/api/service-reports`;
const api = axios.create({
  baseURL: base,
  withCredentials: true,
  timeout: 30000,
});
const empty = () => ({
  ...Object.fromEntries(
    schema.sections
      .filter((s) => !s.fileKind)
      .map((s) => [s.key, s.repeatable ? [] : {}]),
  ),
  header: {
    reportDate: new Date().toLocaleDateString("en-CA"),
    companyType: "GST",
  },
  acknowledgement: {
    customerResponse: "Pending",
    acknowledgement:
      "I acknowledge receipt of this report and the service details recorded. This does not certify pest elimination or waive any rights.",
  },
  safety: {},
  links: {},
  assignees: [],
});
const message = (e) =>
  [
    e.response?.data?.error || e.message,
    ...Object.entries(e.response?.data?.fields || {}).map(
      ([k, v]) => `${k}: ${v}`,
    ),
  ].join(" · ");
const labels = {
  total: "Total reports",
  drafts: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  revisions: "Revision required",
  findings: "Pest findings",
  followups: "Follow-up required",
};
const date = (value) => (value ? String(value).slice(0, 10) : "—");
const fileUrl = (id, file) =>
  `${base}/${encodeURIComponent(id)}/files/${encodeURIComponent(file.id)}`;
function Status({ value }) {
  return (
    <span
      className={`sr-status sr-status-${String(value).toLowerCase().replaceAll(" ", "-")}`}
    >
      {value}
    </span>
  );
}
function Fields({
  defs,
  value = {},
  onChange,
  readOnly = false,
  photoOptions = [],
}) {
  return (
    <CRMFormGrid>
      {defs.map(([key, label, type, options]) => (
        <CRMFormField
          key={key}
          label={label}
          className={type === "textarea" ? "sr-wide" : ""}
        >
          {readOnly ? (
            <div className="sr-field-value">
              {key === "photoIds"
                ? value[key]
                    ?.split(",")
                    .map(
                      (id) =>
                        photoOptions.find((f) => f.id === id)?.caption ||
                        "Linked photograph",
                    )
                    .join("; ") || "None linked"
                : value[key] || "Not recorded"}
            </div>
          ) : key === "photoIds" ? (
            <select
              multiple
              size={3}
              value={(value[key] || "").split(",").filter(Boolean)}
              onChange={(e) =>
                onChange({
                  ...value,
                  [key]: [...e.target.selectedOptions]
                    .map((o) => o.value)
                    .join(","),
                })
              }
            >
              {photoOptions.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.category} · {file.caption || file.original_name}
                </option>
              ))}
            </select>
          ) : type === "textarea" ? (
            <textarea
              value={value[key] || ""}
              rows={3}
              maxLength={6000}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          ) : type === "select" ? (
            <select
              value={value[key] || ""}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            >
              <option value="">Select…</option>
              {options.split("|").map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              list={
                key === "pestType"
                  ? "sr-pest-master"
                  : key === "serviceType"
                    ? "sr-service-master"
                    : undefined
              }
              type={type || "text"}
              min={type === "number" ? 0 : undefined}
              step={type === "number" ? "any" : undefined}
              maxLength={6000}
              value={value[key] || ""}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          )}
        </CRMFormField>
      ))}
    </CRMFormGrid>
  );
}
function Evidence({
  section,
  report,
  files,
  onUpload,
  onRemove,
  readOnly,
  busy,
}) {
  const [meta, setMeta] = useState({
    category: section.categories?.[0] || "",
    includeInPdf: true,
  });
  return (
    <div>
      {!readOnly && (
        <div className="sr-evidence-editor">
          <Fields
            defs={[
              ["category", "Category", "select", section.categories.join("|")],
              ["caption", "Caption"],
              ["area", "Associated treatment area"],
              ["capturedAt", "Capture timestamp (if known)"],
              ["displayOrder", "Display order", "number"],
              ...(section.fileKind === "siteMap"
                ? [
                    [
                      "annotations",
                      "Annotations / monitoring markers",
                      "textarea",
                    ],
                  ]
                : []),
            ]}
            value={meta}
            onChange={setMeta}
          />
          <label className="sr-check">
            <input
              type="checkbox"
              checked={meta.includeInPdf}
              onChange={(e) =>
                setMeta({ ...meta, includeInPdf: e.target.checked })
              }
            />{" "}
            Include in customer PDF
          </label>
          <label className="sr-upload">
            <Camera size={18} /> Choose original file{" "}
            <input
              aria-label={`Upload ${section.title}`}
              type="file"
              accept={
                section.fileKind === "photo"
                  ? "image/jpeg,image/png,image/webp"
                  : "image/jpeg,image/png,image/webp,application/pdf"
              }
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files[0];
                if (file) await onUpload(file, section.fileKind, meta);
                e.target.value = "";
              }}
            />
          </label>
          {section.fileKind === "photo" && (
            <label className="sr-upload sr-camera">
              Capture photograph
              <input
                aria-label="Capture treatment photograph"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (file) await onUpload(file, section.fileKind, meta);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <p className="sr-muted">
            JPEG / PNG / WebP{section.fileKind !== "photo" ? " / PDF" : ""} · 8
            MB per file · 50 files / 80 MB per report. Originals are retained
            privately; previews and PDF images are compressed separately. Adding
            evidence requires fresh signatures.
          </p>
        </div>
      )}
      <div className="sr-evidence-grid">
        {files
          .filter((f) => f.kind === section.fileKind)
          .map((file) => (
            <article className="sr-evidence-card" key={file.id}>
              {file.mime_type.startsWith("image/") ? (
                <a
                  href={fileUrl(report.external_id, file)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    loading="lazy"
                    src={`${fileUrl(report.external_id, file)}?preview=1`}
                    alt={file.caption || file.category}
                  />
                </a>
              ) : (
                <a
                  className="sr-document"
                  href={fileUrl(report.external_id, file)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText />
                  {file.original_name}
                </a>
              )}
              <strong>{file.category}</strong>
              <p>{file.caption || "No caption"}</p>
              <small>
                {file.area} ·{" "}
                {file.include_in_pdf
                  ? "Included in PDF"
                  : "Staff evidence only"}
              </small>
              <small>
                Uploaded {date(file.created_at)} · {file.uploaded_by}
              </small>

              {file.annotations && <p>{file.annotations}</p>}
              {!readOnly && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(file)}
                >
                  Remove / replace
                </button>
              )}
            </article>
          ))}
      </div>
      {!files.some((f) => f.kind === section.fileKind) && (
        <p className="sr-muted">No files recorded in this section.</p>
      )}
    </div>
  );
}
function SignaturePad({ kind, report, files, onUpload, busy }) {
  const pad = useRef(null),
    file = files.find((f) => f.kind === kind);
  return (
    <div className="sr-signature">
      <h4>
        {kind === "technicianSignature"
          ? "Technician signature"
          : "Customer signature"}
      </h4>
      {file ? (
        <>
          <img
            src={`${fileUrl(report.external_id, file)}?preview=1`}
            alt={kind}
          />
          <p>
            Captured {String(file.created_at)} · Evidence retained privately
          </p>
        </>
      ) : (
        <p className="sr-muted">No current signature recorded.</p>
      )}
      <SignatureCanvas
        ref={pad}
        penColor="#172554"
        backgroundColor="#ffffff"
        canvasProps={{
          width: 440,
          height: 150,
          className: "sr-signature-canvas",
          "aria-label":
            kind === "technicianSignature"
              ? "Draw technician signature"
              : "Draw customer signature",
        }}
      />
      <div className="sr-actions">
        <button type="button" onClick={() => pad.current.clear()}>
          Clear
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (pad.current.isEmpty()) return;
            const blob = await (
              await fetch(pad.current.toDataURL("image/png"))
            ).blob();
            await onUpload(
              new File([blob], `${kind}.png`, { type: "image/png" }),
              kind,
              { category: kind, includeInPdf: true },
            );
          }}
        >
          Save signature
        </button>
      </div>
    </div>
  );
}
export default function ServiceReports({
  createNew = false,
  editRequested = false,
}) {
  const navigate = useNavigate(),
    { id } = useParams();
  const [data, setData] = useState({ items: [], summary: {}, total: 0 }),
    [filter, setFilter] = useState({}),
    [page, setPage] = useState(1),
    [caps, setCaps] = useState([]),
    [manage, setManage] = useState(false),
    [lookups, setLookups] = useState(null);
  const [report, setReport] = useState(null),
    [content, setContent] = useState(empty),
    [files, setFiles] = useState([]),
    [editing, setEditing] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [history, setHistory] = useState(null),
    [action, setAction] = useState(null),
    [reason, setReason] = useState(""),
    [permissions, setPermissions] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const contentKey = JSON.stringify(content),
    dirty = !report || contentKey !== JSON.stringify(report.content);
  useEffect(() => {
    if (!action && !history) return;
    const previous = document.activeElement;
    const dialog = [...document.querySelectorAll(".sr-dialog")].at(-1);
    const controls = () => [
      ...(dialog?.querySelectorAll(
        'button:not(:disabled),input,select,textarea,[tabindex="0"]',
      ) || []),
    ];
    controls()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape" && !busy) {
        setAction(null);
        setHistory(null);
      }
      if (e.key === "Tab") {
        const nodes = controls(),
          first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    dialog?.addEventListener("keydown", key);
    return () => {
      dialog?.removeEventListener("keydown", key);
      previous?.focus?.();
    };
  }, [action, history, busy]);
  useEffect(() => {
    if (createNew && caps.includes("create")) setEditing(true);
  }, [createNew, caps]);
  useEffect(() => {
    if (editRequested && report && report.actions?.edit) setEditing(true);
  }, [editRequested, report?.external_id, caps]);
  useEffect(() => {
    if (!editing || !dirty) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing, dirty]);
  useEffect(() => {
    if (!editing) return;
    const nav = document.querySelector(".sr-wizard .crm-wizard-nav");
    const align = () => {
      if (!window.matchMedia("(max-width:700px)").matches) return;
      const current = nav?.querySelector('[aria-current="step"]');
      if (current) {
        const target = current.getBoundingClientRect(),
          bounds = nav.getBoundingClientRect();
        nav.scrollLeft +=
          target.left - bounds.left - (nav.clientWidth - target.width) / 2;
      }
    };
    const observer = new MutationObserver(align);
    if (nav)
      observer.observe(nav, {
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-current"],
      });
    align();
    return () => observer.disconnect();
  }, [editing]);
  const requestKey = useRef(crypto.randomUUID()),
    latest = useRef(null);
  latest.current = { report, content };
  const loadList = useCallback(async () => {
    const r = await api.get("/", { params: { ...filter, page } });
    setData(r.data);
  }, [filter, page]);
  const loadDetail = useCallback(async () => {
    if (!id) return;
    const r = await api.get(`/${id}`);
    setReport(r.data);
    setContent(r.data.content);
    setFiles(r.data.files);
    setEditing(false);
  }, [id]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    Promise.all([api.get("/capabilities"), api.get("/lookups")])
      .then(([p, l]) => {
        if (live) {
          setCaps(p.data.capabilities);
          setManage(!!p.data.manage);
          setLookups(l.data);
        }
      })
      .catch((e) => live && setError(message(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!caps.includes("view")) return;
    setLoading(true);
    (id ? loadDetail() : loadList())
      .catch((e) => setError(message(e)))
      .finally(() => setLoading(false));
  }, [id, caps, loadDetail, loadList]);
  async function run(fn) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      return await fn();
    } catch (e) {
      setError(message(e));
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    const current = latest.current;
    const response = current.report
      ? await api.put(`/${current.report.external_id}`, {
          revision: current.report.revision,
          content: current.content,
        })
      : await api.post("/", {
          content: current.content,
          requestKey: requestKey.current,
        });
    const detail = await api.get(`/${response.data.external_id}`);
    setReport(detail.data);
    setContent(detail.data.content);
    setFiles(detail.data.files);
    latest.current = { report: detail.data, content: detail.data.content };
    setNotice("Draft saved.");
    return detail.data;
  }
  async function upload(file, kind, meta) {
    return run(async () => {
      if (file.size > 8 * 1024 * 1024)
        throw new Error("Maximum file size is 8 MB");
      const saved = await save(),
        body = new FormData();
      body.append("file", file);
      body.append("revision", saved.revision);
      body.append("kind", kind);
      Object.entries(meta).forEach(([k, v]) => body.append(k, String(v)));
      await api.post(`/${saved.external_id}/files`, body);
      const r = await api.get(`/${saved.external_id}`);
      setReport(r.data);
      setFiles(r.data.files);
      latest.current = { report: r.data, content: r.data.content };
      setNotice("Evidence saved privately.");
    });
  }
  async function remove(file) {
    return run(async () => {
      await api.delete(`/${report.external_id}/files/${file.id}`, {
        data: { revision: report.revision },
      });
      const r = await api.get(`/${report.external_id}`);
      setReport(r.data);
      setFiles(r.data.files);
    });
  }
  async function transition(name) {
    return run(async () => {
      const r = await api.post(`/${report.external_id}/${name}`, {
        revision: report.revision,
        reason,
      });
      setReport(r.data);
      setContent(r.data.content);
      setAction(null);
      setReason("");
      await loadDetail();
      setNotice("Report workflow updated.");
    });
  }
  async function pdf(version, share = false) {
    return run(async () => {
      const r = await api
        .get(`/${report.external_id}/pdf`, {
          params: version ? { version } : undefined,
          responseType: "blob",
        })
        .catch(async (e) => {
          if (e.response?.data instanceof Blob) {
            e.response.data = JSON.parse(await e.response.data.text());
          }
          throw e;
        });
      if (
        share &&
        navigator.canShare?.({
          files: [
            new File([r.data], `${report.report_number}.pdf`, {
              type: "application/pdf",
            }),
          ],
        })
      ) {
        await navigator.share({
          files: [
            new File([r.data], `${report.report_number}.pdf`, {
              type: "application/pdf",
            }),
          ],
          title: report.report_number,
        });
        return;
      }
      const url = URL.createObjectURL(r.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${report.report_number}${version ? `-v${version}` : ""}.pdf`;
      link.click();
      if (share)
        setNotice("PDF downloaded. Share the file using your preferred app.");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }
  const setSection = (key, value) =>
    setContent((c) => ({ ...c, [key]: value }));
  function chooseCustomer(customerId) {
    const customer = lookups.customers.find((c) => c.id === customerId);
    setContent((c) => ({
      ...c,
      links: { customerId },
      header: {
        ...c.header,
        customerName: customer?.name || "",
        siteAddress: customer?.siteAddress || "",
        contactPerson: customer?.contactPerson || "",
        mobile: customer?.mobile || "",
        email: customer?.email || "",
      },
    }));
  }
  function linkedSelectors() {
    return (
      <CRMFormSection title="Existing CRM records">
        <CRMFormGrid>
          <CRMFormField label="Search CRM customers">
            <input
              type="search"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Name or CRM customer ID"
            />
          </CRMFormField>
          <CRMFormField label="CRM customer *">
            <select
              value={content.links.customerId || ""}
              onChange={(e) => chooseCustomer(e.target.value)}
            >
              <option value="">Select genuine CRM customer…</option>
              {lookups?.customers
                .filter((c) =>
                  `${c.name} ${c.id}`
                    .toLowerCase()
                    .includes(customerSearch.toLowerCase()),
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.id}
                  </option>
                ))}
            </select>
          </CRMFormField>
          <CRMFormField label="Property / site record">
            <select
              value={content.links.premiseId || ""}
              onChange={(e) => {
                const p = lookups.premises.find((p) => p.id === e.target.value);
                setContent((c) => ({
                  ...c,
                  links: { ...c.links, premiseId: p?.id || "" },
                  header: {
                    ...c.header,
                    siteName: p?.name || "",
                    siteAddress: p?.address || c.header.siteAddress,
                    contactPerson: p?.contactPerson || c.header.contactPerson,
                    mobile: p?.mobile || c.header.mobile,
                    email: p?.email || c.header.email,
                  },
                }));
              }}
            >
              <option value="">Report-specific site</option>
              {lookups?.premises
                .filter((p) => p.customerId === content.links.customerId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </CRMFormField>
          <CRMFormField label="Linked job">
            <select
              value={content.links.jobId || ""}
              onChange={(e) => {
                const j = lookups.jobs.find((j) => j.id === e.target.value);
                setContent((c) => ({
                  ...c,
                  links: { ...c.links, jobId: j?.id || "" },
                  header: {
                    ...c.header,
                    serviceType: j?.serviceType || c.header.serviceType,
                  },
                }));
              }}
            >
              <option value="">No linked job</option>
              {lookups?.jobs
                .filter((j) => j.customerId === content.links.customerId)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
            </select>
          </CRMFormField>
          <CRMFormField label="Contract reference">
            <select
              value={
                content.links.contractReference
                  ? `${content.links.contractSource}:${content.links.contractReference}`
                  : ""
              }
              onChange={(e) => {
                const [source, ...rest] = e.target.value.split(":");
                const contract = lookups.contracts.find(
                  (c) => c.source === source && c.id === rest.join(":"),
                );
                setContent((c) => ({
                  ...c,
                  links: {
                    ...c.links,
                    contractSource: source || "",
                    contractReference: rest.join(":"),
                    scheduleReference: "",
                  },
                  header: {
                    ...c.header,
                    companyType: contract?.companyType || c.header.companyType,
                  },
                }));
              }}
            >
              <option value="">No linked contract</option>
              {lookups?.contracts
                .filter((c) => c.customerId === content.links.customerId)
                .map((c) => (
                  <option
                    key={`${c.source}:${c.id}`}
                    value={`${c.source}:${c.id}`}
                  >
                    {c.name} ({c.source})
                  </option>
                ))}
            </select>
          </CRMFormField>
          <CRMFormField label="Service schedule">
            <select
              value={content.links.scheduleReference || ""}
              onChange={(e) =>
                setContent((c) => ({
                  ...c,
                  links: { ...c.links, scheduleReference: e.target.value },
                }))
              }
            >
              <option value="">No linked schedule</option>
              {lookups?.contracts
                .find(
                  (c) =>
                    c.id === content.links.contractReference &&
                    c.source === content.links.contractSource,
                )
                ?.schedules?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} · Visit {s.number} · {s.serviceType}
                  </option>
                ))}
            </select>
          </CRMFormField>
          <CRMFormField label="Assigned technicians">
            <select
              multiple
              value={content.assignees}
              onChange={(e) =>
                setContent((c) => ({
                  ...c,
                  assignees: [...e.target.selectedOptions].map((o) => o.value),
                }))
              }
            >
              {lookups?.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.code} · {e.id}
                </option>
              ))}
            </select>
          </CRMFormField>
          <CRMFormField label="Service / pest master">
            <select
              value=""
              onChange={(e) =>
                setContent((c) => ({
                  ...c,
                  header: { ...c.header, serviceType: e.target.value },
                }))
              }
            >
              <option value="">Choose existing service…</option>
              {lookups?.services.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </CRMFormField>
        </CRMFormGrid>
        <p className="sr-muted">
          Customer ID: {content.links.customerId || "Not selected"} · Report:{" "}
          {report?.report_number || "Assigned by server on save"} · Prepared by:{" "}
          {report?.prepared_by || "Current authenticated employee"}
        </p>
      </CRMFormSection>
    );
  }
  function sectionBody(section, readOnly = false) {
    if (section.fileKind)
      return (
        <Evidence
          section={section}
          report={report}
          files={files}
          onUpload={upload}
          onRemove={remove}
          busy={busy}
          readOnly={readOnly}
        />
      );
    if (section.repeatable)
      return (
        <>
          {(content[section.key] || []).map((entry, index) => (
            <CRMFormSection
              key={entry.entryId || index}
              title={`Entry ${index + 1}`}
            >
              <Fields
                defs={section.fields}
                photoOptions={files.filter((f) => f.kind === "photo")}
                value={entry}
                readOnly={readOnly}
                onChange={(value) =>
                  setSection(
                    section.key,
                    content[section.key].map((e, i) =>
                      i === index ? value : e,
                    ),
                  )
                }
              />
              {section.productFields && (
                <div className="sr-products">
                  <h4>Products / chemicals</h4>
                  {(entry.products || []).map((p, j) => (
                    <div className="sr-product" key={j}>
                      <Fields
                        defs={section.productFields}
                        value={p}
                        readOnly={readOnly}
                        onChange={(value) =>
                          setSection(
                            section.key,
                            content[section.key].map((e, i) =>
                              i === index
                                ? {
                                    ...e,
                                    products: e.products.map((v, k) =>
                                      k === j ? value : v,
                                    ),
                                  }
                                : e,
                            ),
                          )
                        }
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setSection(
                              section.key,
                              content[section.key].map((e, i) =>
                                i === index
                                  ? {
                                      ...e,
                                      products: e.products.filter(
                                        (_, k) => k !== j,
                                      ),
                                    }
                                  : e,
                              ),
                            )
                          }
                        >
                          Remove product
                        </button>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() =>
                        setSection(
                          section.key,
                          content[section.key].map((e, i) =>
                            i === index
                              ? { ...e, products: [...(e.products || []), {}] }
                              : e,
                          ),
                        )
                      }
                    >
                      <Plus size={15} /> Add product
                    </button>
                  )}
                </div>
              )}
              {!readOnly && (
                <button
                  type="button"
                  className="sr-danger"
                  onClick={() =>
                    setSection(
                      section.key,
                      content[section.key].filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove entry
                </button>
              )}
            </CRMFormSection>
          ))}
          {!readOnly && (
            <button
              type="button"
              onClick={() =>
                setSection(section.key, [
                  ...(content[section.key] || []),
                  {
                    entryId: crypto.randomUUID(),
                    ...(section.productFields ? { products: [] } : {}),
                  },
                ])
              }
            >
              <Plus size={16} /> Add{" "}
              {section.key === "findings"
                ? "finding"
                : section.key === "treatments"
                  ? "treatment"
                  : "recommendation"}
            </button>
          )}
          {!(content[section.key] || []).length && (
            <p className="sr-muted">
              No entries recorded
              {section.key === "findings"
                ? " — this does not indicate pests were absent"
                : ""}
              .
            </p>
          )}
          {section.safetyFields && (
            <CRMFormSection title="Safety information — actual labels and procedures only">
              <Fields
                defs={section.safetyFields}
                value={content.safety}
                onChange={(v) => setSection("safety", v)}
                readOnly={readOnly}
              />
            </CRMFormSection>
          )}
        </>
      );
    return (
      <>
        {section.key === "header" && !readOnly && linkedSelectors()}
        {section.key === "header" && readOnly && (
          <CRMFormSection title="Linked CRM records">
            <Fields
              readOnly
              defs={[
                ["customerId", "CRM customer ID"],
                ["siteReference", "Site reference"],
                ["jobReference", "Job reference"],
                ["contractReference", "Contract reference"],
                ["scheduleReference", "Schedule reference"],
                ["technicians", "Assigned technicians"],
              ]}
              value={{
                customerId: content.links.customerId,
                siteReference:
                  content.sourceContext?.site?.name || content.links.premiseId,
                jobReference:
                  content.sourceContext?.job?.name || content.links.jobId,
                contractReference:
                  content.sourceContext?.contract?.name ||
                  content.links.contractReference,
                scheduleReference: content.sourceContext?.schedule
                  ? `${content.sourceContext.schedule.date} · Visit ${content.sourceContext.schedule.number}`
                  : content.links.scheduleReference,
                technicians:
                  content.sourceContext?.assignees
                    ?.map((employee) => employee.name)
                    .filter(Boolean)
                    .join(", ") || content.assignees.join(", "),
              }}
            />
          </CRMFormSection>
        )}

        <Fields
          defs={section.fields}
          value={content[section.key]}
          onChange={(v) => setSection(section.key, v)}
          readOnly={readOnly}
        />
        {section.key === "acknowledgement" && (
          <>
            <p className="sr-muted">
              Signatures acknowledge receipt and the recorded service details.
              They do not certify pest elimination or waive rights. Save names
              and all report details before signing. Editing the report
              invalidates signatures.
            </p>
            {readOnly ? (
              <div className="sr-evidence-grid">
                {files
                  .filter((f) => f.kind.endsWith("Signature"))
                  .map((f) => (
                    <img
                      key={f.id}
                      className="sr-saved-signature"
                      src={fileUrl(report.external_id, f)}
                      alt={f.kind}
                    />
                  ))}
              </div>
            ) : (
              <div className="sr-signatures">
                {["technicianSignature", "customerSignature"].map((kind) => (
                  <SignaturePad
                    key={kind}
                    kind={kind}
                    report={report}
                    files={files}
                    onUpload={upload}
                    busy={busy}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {section.key === "followup" && (
          <p className="sr-muted">
            Internal notes are staff-only and excluded from PDFs. Follow-up
            details do not create a job or change an existing schedule.
          </p>
        )}
      </>
    );
  }
  const editable = !!report?.actions?.edit;
  return (
    <div className="sr-page glass-content">
      <datalist id="sr-pest-master">
        {lookups?.pests?.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="sr-service-master">
        {lookups?.services.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      <PageHeader
        title={id ? "Service Report" : "Service Reports"}
        subtitle="Service & Operations · Recorded findings, evidence and approvals"
        icon={ClipboardCheck}
        variant="glass"
        action={
          <div className="sr-actions">
            {manage && (
              <button onClick={() => setPermissions(true)}>
                <ShieldCheck size={16} /> Access
              </button>
            )}
            {!id && caps.includes("create") && (
              <button
                className="sr-primary"
                onClick={() => {
                  setReport(null);
                  setContent(empty());
                  setFiles([]);
                  requestKey.current = crypto.randomUUID();
                  navigate("/operations/service-reports/new");
                }}
              >
                <Plus size={17} /> New report
              </button>
            )}
            {id && (
              <button onClick={() => navigate("/operations/service-reports")}>
                <ArrowLeft size={16} /> Reports
              </button>
            )}
          </div>
        }
      />
      {error && (
        <div className="sr-error" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="sr-notice" role="status">
          {notice}
        </div>
      )}
      {loading ? (
        <div className="sr-panel" role="status">
          Loading Service Reports…
        </div>
      ) : !caps.includes("view") ? (
        <section className="sr-panel">
          Service Report access is required. Ask an authorised administrator to
          grant the appropriate capabilities.
        </section>
      ) : !id ? (
        <>
          <div className="sr-metrics">
            {Object.entries(labels).map(([key, label]) => (
              <article className="sr-panel sr-metric" key={key}>
                <span>{label}</span>
                <strong>{data.summary[key] || 0}</strong>
                <small>Within your permitted records</small>
              </article>
            ))}
          </div>
          <section className="sr-panel">
            <h3>
              <Search size={18} /> Find reports
            </h3>
            <div className="sr-filter-grid">
              {[
                ["number", "Report number"],
                ["customer", "Customer"],
                ["site", "Property / site"],
                ["service", "Service type"],
                ["reference", "Contract reference"],
                ["job", "Job reference"],
              ].map(([k, l]) => (
                <label key={k}>
                  {l}
                  <input
                    value={filter[k] || ""}
                    onChange={(e) => {
                      setFilter({ ...filter, [k]: e.target.value });
                      setPage(1);
                    }}
                  />
                </label>
              ))}
              <label>
                Assigned employee
                <select
                  value={filter.employee || ""}
                  onChange={(e) => {
                    setFilter({ ...filter, employee: e.target.value });
                    setPage(1);
                  }}
                >
                  <option value="">All permitted employees</option>
                  {lookups?.employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Report status
                <select
                  value={filter.status || ""}
                  onChange={(e) => {
                    setFilter({ ...filter, status: e.target.value });
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {["Draft", "Submitted", "Approved", "Revision Required"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
              {[
                ["from", "Service date from"],
                ["to", "Service date to"],
              ].map(([k, l]) => (
                <label key={k}>
                  {l}
                  <input
                    type="date"
                    value={filter[k] || ""}
                    onChange={(e) => {
                      setFilter({ ...filter, [k]: e.target.value });
                      setPage(1);
                    }}
                  />
                </label>
              ))}
            </div>
          </section>
          <section className="sr-panel">
            <div className="sr-section-head">
              <h3>Service records</h3>
              <span>{data.total} reports</span>
            </div>
            <div className="sr-table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Report number",
                      "Service date",
                      "Customer",
                      "Property / site",
                      "Service type",
                      "Linked job / contract",
                      "Created by",
                      "Status",
                      "Follow-up date",
                      "Actions",
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.external_id}>
                      <td>
                        <Link
                          to={`/operations/service-reports/${r.external_id}`}
                        >
                          {r.report_number}
                        </Link>
                      </td>
                      <td>{date(r.service_date)}</td>
                      <td>{r.customer_name}</td>
                      <td>{r.site_name || "—"}</td>
                      <td>{r.service_type || "—"}</td>
                      <td>
                        {[r.job_external_id, r.contract_reference]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </td>
                      <td>{r.prepared_by}</td>
                      <td>
                        <Status value={r.status} />
                      </td>
                      <td>{date(r.followup_date)}</td>
                      <td>
                        <ActionMenu
                          items={[
                            {
                              label: "View report",
                              onClick: () =>
                                navigate(
                                  `/operations/service-reports/${r.external_id}`,
                                ),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.items.length && (
              <div className="sr-empty">
                <ClipboardCheck size={30} />
                <h3>No matching service reports</h3>
                <p>Create a draft to record a service visit.</p>
              </div>
            )}
            <div className="sr-pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                disabled={page * data.limit >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      ) : (
        report && (
          <>
            <section className="sr-panel sr-detail-head">
              <div>
                <Status value={report.status} />
                <h2>{report.report_number}</h2>
                <p>
                  {report.customer_name} ·{" "}
                  {report.site_name || "Site details in report"} · Version{" "}
                  {report.revision}
                </p>
                <small>
                  Prepared by {report.prepared_by} · {date(report.created_at)}
                </small>
              </div>
              <div className="sr-actions">
                {editable && (
                  <button
                    className="sr-primary"
                    disabled={busy}
                    onClick={() => setEditing(true)}
                  >
                    Edit report
                  </button>
                )}
                {report.actions?.submit && (
                  <button disabled={busy} onClick={() => setAction("submit")}>
                    Submit for review
                  </button>
                )}
                {report.status === "Submitted" && caps.includes("review") && (
                  <>
                    <button
                      disabled={!report.actions?.approve}
                      className="sr-primary"
                      onClick={() => setAction("approve")}
                    >
                      Approve
                    </button>
                    <button onClick={() => setAction("request-revision")}>
                      Request revision
                    </button>
                  </>
                )}
                {report.status === "Approved" && caps.includes("review") && (
                  <button onClick={() => setAction("revisions")}>
                    Create correction
                  </button>
                )}
                {caps.includes("pdf") && (
                  <button disabled={busy} onClick={() => pdf()}>
                    <Download size={16} />{" "}
                    {report.status === "Approved" ? "Final PDF" : "Draft PDF"}
                  </button>
                )}
                {report.status === "Approved" &&
                  caps.includes("share") &&
                  caps.includes("pdf") && (
                    <button
                      disabled={busy}
                      onClick={() => pdf(undefined, true)}
                    >
                      Share PDF
                    </button>
                  )}
                {caps.includes("history") && (
                  <button
                    onClick={() =>
                      run(async () =>
                        setHistory(
                          (await api.get(`/${report.external_id}/history`))
                            .data,
                        ),
                      )
                    }
                  >
                    <History size={16} /> History
                  </button>
                )}
              </div>
            </section>
            {schema.sections.map((section, i) => (
              <section className="sr-panel" key={section.key}>
                <h3>
                  {i + 1}. {section.title}
                </h3>
                {sectionBody(section, true)}
              </section>
            ))}
          </>
        )
      )}
      {editing && (
        <div className="sr-modal-overlay">
          <CRMFormModal
            title={
              report ? `Edit ${report.report_number}` : "New Service Report"
            }
            subtitle="10 sections · Save a draft at any time · Submit from the report detail screen"
            icon={ClipboardCheck}
            className="sr-wizard"
            onClose={() => {
              setEditing(false);
              if (report)
                navigate(`/operations/service-reports/${report.external_id}`);
              else navigate("/operations/service-reports");
            }}
            onSubmit={() =>
              run(async () => {
                const r = await save();
                setEditing(false);
                navigate(`/operations/service-reports/${r.external_id}`);
              })
            }
            busy={busy}
            error={error}
            notice={notice}
            dirtyKey={dirty ? contentKey : undefined}
            cancelAction={<button type="button">Close</button>}
            submitAction={
              <button type="submit" className="sr-primary">
                Save report draft
              </button>
            }
          >
            {schema.sections.map((section, i) => (
              <CRMFormStep
                key={section.key}
                title={section.title}
                description={`Section ${i + 1} of 10`}
              >
                <div className="sr-wizard-tools">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(save)}
                  >
                    <Save size={15} /> Save draft
                  </button>
                  <small>
                    {report?.report_number || "Number assigned on save"}
                  </small>
                </div>
                {sectionBody(section)}
              </CRMFormStep>
            ))}
            <CRMFormStep
              title="Review & save"
              description="Check all sections before saving your draft"
            >
              <div className="sr-review">
                {schema.sections.map((s, i) => (
                  <div key={s.key}>
                    <strong>
                      {i + 1}. {s.title}
                    </strong>
                    <span>
                      {s.repeatable
                        ? `${content[s.key].length} entries`
                        : s.fileKind
                          ? `${files.filter((f) => f.kind === s.fileKind).length} files`
                          : "Recorded details below"}
                    </span>
                    {!s.repeatable && !s.fileKind && (
                      <Fields defs={s.fields} value={content[s.key]} readOnly />
                    )}
                  </div>
                ))}
              </div>
              <CRMFormSection title="Final signatures">
                <p className="sr-muted">
                  Capture final signatures after all sections and files are
                  complete. Saving further changes invalidates signatures.
                </p>
                {dirty &&
                  files.some((file) => file.kind.endsWith("Signature")) && (
                    <p className="sr-error">
                      There are unsaved changes. Save the draft and capture
                      fresh signatures before submitting.
                    </p>
                  )}
                <button type="button" disabled={busy} onClick={() => run(save)}>
                  <Save size={15} /> Save draft
                </button>
                <div className="sr-signatures">
                  {["technicianSignature", "customerSignature"].map((kind) => (
                    <SignaturePad
                      key={kind}
                      kind={kind}
                      report={report}
                      files={files}
                      onUpload={upload}
                      busy={busy}
                    />
                  ))}
                </div>
              </CRMFormSection>
              <p>
                Saving preserves a draft. Submission requires server validation
                and is a separate action.
              </p>
            </CRMFormStep>
          </CRMFormModal>
        </div>
      )}
      {action && (
        <div className="sr-modal-overlay">
          <div
            className="sr-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sr-action-title"
          >
            <h2 id="sr-action-title">
              {
                {
                  submit: "Submit for review",
                  approve: "Approve report",
                  "request-revision": "Request revision",
                  revisions: "Create approved-report correction",
                }[action]
              }
            </h2>
            <p>
              {action === "approve"
                ? "Approval freezes this version. A different authorised employee must approve it."
                : action === "submit"
                  ? "The server validates all required details, evidence and signatures."
                  : "The previous report versions and evidence will remain in the history."}
            </p>
            {["request-revision", "revisions"].includes(action) && (
              <label>
                Reason
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                />
              </label>
            )}
            <div className="sr-actions">
              <button disabled={busy} onClick={() => setAction(null)}>
                Cancel
              </button>
              <button
                className="sr-primary"
                disabled={busy}
                onClick={() => transition(action)}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {history && (
        <div className="sr-modal-overlay">
          <div
            className="sr-dialog sr-history"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sr-history-title"
          >
            <h2 id="sr-history-title">Version & audit history</h2>
            {history.versions.map((v) => (
              <div className="sr-audit-row" key={v.id}>
                <strong>
                  Version {v.revision} · {v.state}
                </strong>
                <small>
                  {String(v.created_at)} · {v.created_by}
                </small>
                {caps.includes("pdf") && (
                  <button onClick={() => pdf(v.revision)}>
                    Download preserved PDF
                  </button>
                )}
              </div>
            ))}
            {history.events.map((e, i) => (
              <div className="sr-audit-row" key={i}>
                <strong>
                  {e.action} · v{e.revision}
                </strong>
                <span>
                  {e.actor_name} · {String(e.created_at)}
                </span>
                {JSON.parse(
                  typeof e.details === "string"
                    ? e.details
                    : JSON.stringify(e.details),
                ).reason && (
                  <p>
                    {
                      JSON.parse(
                        typeof e.details === "string"
                          ? e.details
                          : JSON.stringify(e.details),
                      ).reason
                    }
                  </p>
                )}
              </div>
            ))}
            <button onClick={() => setHistory(null)}>Close history</button>
          </div>
        </div>
      )}
      {permissions && (
        <Permissions
          employees={lookups?.employees || []}
          onClose={() => setPermissions(false)}
        />
      )}
    </div>
  );
}
function Permissions({ employees, onClose }) {
  const [employee, setEmployee] = useState(""),
    [caps, setCaps] = useState([]),
    [scope, setScope] = useState("assigned"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [grants, setGrants] = useState([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement,
      dialog = document.querySelector(".sr-dialog:last-child");
    const nodes = () => [
      ...(dialog?.querySelectorAll(
        "button:not(:disabled),select,input,textarea",
      ) || []),
    ];
    nodes()[0]?.focus();
    const handle = (event) => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key === "Tab") {
        const controls = nodes(),
          first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    dialog?.addEventListener("keydown", handle);
    return () => {
      dialog?.removeEventListener("keydown", handle);
      previous?.focus?.();
    };
  }, [onClose, busy]);
  useEffect(() => {
    api
      .get("/permissions")
      .then((r) => setGrants(r.data))
      .catch((e) => setError(message(e)));
  }, []);
  function select(id) {
    setEmployee(id);
    const grant =
      grants.find((g) => g.employee_id === id) ||
      grants.find((g) => g.canonical_employee_id === id);
    setCaps(grant?.capabilities || []);
    setScope(grant?.access_scope || "assigned");
  }
  return (
    <div className="sr-modal-overlay">
      <div
        className="sr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sr-permissions-title"
      >
        <h2 id="sr-permissions-title">Service Report access</h2>
        <p>
          Capabilities apply to authenticated employee identities. Existing
          administrators retain management access.
        </p>
        <label>
          Employee
          <select value={employee} onChange={(e) => select(e.target.value)}>
            <option value="">Choose employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.code} · {e.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Access scope
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="assigned">Own and assigned records</option>
            <option value="all">All report records</option>
          </select>
        </label>
        <div className="sr-permission-grid">
          {[
            "view",
            "create",
            "edit",
            "submit",
            "review",
            "pdf",
            "share",
            "history",
          ].map((cap) => (
            <label key={cap}>
              <input
                type="checkbox"
                checked={caps.includes(cap)}
                onChange={(e) =>
                  setCaps(
                    e.target.checked
                      ? [...caps, cap]
                      : caps.filter((v) => v !== cap),
                  )
                }
              />
              {cap}
            </label>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="sr-actions">
          <button onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            className="sr-primary"
            disabled={!employee || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.put(`/permissions/${encodeURIComponent(employee)}`, {
                  capabilities: caps,
                  scope,
                });
                setGrants((await api.get("/permissions")).data);
                setNotice("Permissions saved.");
                setError("");
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save permissions
          </button>
        </div>
      </div>
    </div>
  );
}
