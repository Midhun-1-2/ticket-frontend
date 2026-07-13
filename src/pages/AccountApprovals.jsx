import React, { useState, useEffect, useMemo, useCallback } from "react";
// style.css is already imported once, globally, in App.jsx — no need to
// re-import it here. Only this page's extra styles need importing.
import "/src/account-approval.css";
import api from "../api"; // adjust this path to wherever your axios instance actually lives
import {
  Search, Building2, Mail, Phone, Calendar, FileText,
  ShieldCheck, UserPlus, Users, Tag,
  ChevronDown, AlertCircle, Check, X, ArrowLeft, UserCog,
  ClipboardCheck, ChevronRight, Info, MapPin,
  FileSignature, CircleDot, Loader2, Globe, Hash
} from "lucide-react";

/* ============================== Helpers ============================== */

const STATUS_CHIP = {
  pending: { cls: "open", label: "Pending" },
  approved: { cls: "resolved", label: "Approved" },
  rejected: { cls: "overdue", label: "Rejected" },
};

const STEPS = [
  { id: "A", label: "Customer & Company" },
  { id: "B", label: "Product Verification" },
  { id: "C", label: "Staff Assignment" },
  { id: "D", label: "Final Action" },
];

function initials(name = "") {
  return name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

// Toggles a value (as string) in/out of an array of string ids — used by
// the multi-select staff checkboxes in Step C.
function toggleId(list, id) {
  const idStr = String(id);
  const current = (list || []).map(String);
  return current.includes(idStr)
    ? current.filter((x) => x !== idStr)
    : [...current, idStr];
}

// Maps a Company row from CompanyListSerializer -> what the UI needs
function mapListItem(c) {
  return {
    id: c.id,
    requestCode: c.company_code || `#${c.id}`,
    contact: c.contact_name,
    company: c.company_name,
    email: c.email,
    phone: c.mobile_number,
    city: c.city,
    state: c.state,
    submitted: c.submitted_at,
    status: c.status,
  };
}

// Adds the extra fields only present on CompanyDetailSerializer
function mapDetail(c) {
  return {
    ...mapListItem(c),
    companyType: c.company_type,
    gst: c.gst_number,
    pan: c.pan_number,
    website: c.website,
    phoneAlt: c.phone_number,
    emailAlt: c.alternate_email,
    address: [c.address_line1, c.address_line2, c.city, c.state, c.country, c.pincode]
      .filter(Boolean).join(", "),
    amc: c.amc_status
      ? `${c.amc_status}${c.amc_start_date ? ` — valid ${formatDate(c.amc_start_date)} to ${formatDate(c.amc_end_date)}` : ""}`
      : "Not specified",
    contractRef: c.contract_ref_number || "",
    products: Array.isArray(c.products_in_use) ? c.products_in_use : [],
    productDetails: c.products || [],
    reviewedAt: c.reviewed_at,
    productVerification: c.product_verification || {},
    staffAssignment: c.staff_assignment || null,
  };
}

/* ============================== App shell =============================== */

export default function AccountApprovals() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateSort, setDateSort] = useState("newest");

  const loadPending = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get("onboarding/pending/");
      setRequests(data.map(mapListItem));
    } catch (err) {
      setLoadError(err.response?.data?.detail || "Couldn't load pending registrations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  const filtered = useMemo(() => {
    let list = requests.filter((r) => {
      const matchesSearch =
        !search ||
        [r.contact, r.company, r.email, r.requestCode].join(" ").toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    list.sort((a, b) => {
      const aVal = a.submitted || "";
      const bVal = b.submitted || "";
      return dateSort === "newest" ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    });
    return list;
  }, [requests, search, statusFilter, dateSort]);

  async function openRequest(id) {
    setSelectedId(id);
    setSelectedDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const { data } = await api.get(`onboarding/${id}/`);
      setSelectedDetail(mapDetail(data));
    } catch (err) {
      setDetailError(err.response?.data?.detail || "Couldn't load this registration's details.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeRequest() {
    setSelectedId(null);
    setSelectedDetail(null);
    setDetailError("");
  }

  // Called after a successful approve/reject/revoke — updates the row in
  // place so the chip reflects the new status without needing a full refetch.
  function patchLocalStatus(id, patch) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSelectedDetail((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  }

  return (
    <main className="main">
      <div className="content">
        {!selectedId ? (
          <RequestsList
            loading={loading}
            loadError={loadError}
            onRetry={loadPending}
            requests={filtered}
            total={requests.length}
            pendingCount={pendingCount}
            approvedCount={approvedCount}
            rejectedCount={rejectedCount}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateSort={dateSort}
            setDateSort={setDateSort}
            onOpen={openRequest}
          />
        ) : detailLoading ? (
          <div className="panel">
            <div className="empty-state">
              <Loader2 className="spin" />
              <div>Loading registration details…</div>
            </div>
          </div>
        ) : detailError ? (
          <>
            <button className="back-link" onClick={closeRequest}><ArrowLeft /> Back to all requests</button>
            <div className="panel">
              <div className="banner danger">
                <AlertCircle />
                <div><b>Couldn't load this request</b>{detailError}</div>
              </div>
            </div>
          </>
        ) : (
          <ReviewFlow
            request={selectedDetail}
            onBack={closeRequest}
            onPatch={(patch) => patchLocalStatus(selectedId, patch)}
          />
        )}
      </div>
    </main>
  );
}

/* ============================== Requests list ============================= */

function RequestsList({
  loading, loadError, onRetry,
  requests, total, pendingCount, approvedCount, rejectedCount,
  search, setSearch, statusFilter, setStatusFilter, dateSort, setDateSort, onOpen,
}) {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">
            <ShieldCheck size={13} /> ADMIN · ACCOUNT APPROVALS
          </div>
          <h1 className="page-title">Account Approvals</h1>
          <p className="page-desc">Review self-registered customer accounts before they go live.</p>
        </div>
      </div>

      <div className="ticker">
        <div className="ticker-live"><span className="ticker-dot" /> LIVE QUEUE</div>
        <div className="ticker-item"><b>{total}</b> total requests</div>
        <div className="ticker-item t-amber"><b>{pendingCount}</b> awaiting review</div>
        <div className="ticker-item t-accent"><b>{approvedCount}</b> approved</div>
        <div className="ticker-item"><b>{rejectedCount}</b> rejected</div>
      </div>

      <div className="filters-bar">
        <div className="search-field">
          <Search />
          <input
            placeholder="Search by name, company, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <SelectField value={statusFilter} onChange={setStatusFilter} options={[
          { value: "all", label: "All statuses" },
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
        ]} />
        <SelectField value={dateSort} onChange={setDateSort} options={[
          { value: "newest", label: "Newest first" },
          { value: "oldest", label: "Oldest first" },
        ]} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">Pending Registrations</div>
            <div className="panel-sub">{requests.length} of {total} requests match your filters</div>
          </div>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state">
              <Loader2 className="spin" />
              <div>Loading registrations…</div>
            </div>
          ) : loadError ? (
            <div className="empty-state">
              <AlertCircle />
              <div>{loadError}</div>
              <button className="btn btn-ghost btn-sm" onClick={onRetry} style={{ marginTop: 10 }}>
                Try again
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <UserPlus />
              <div>No requests match your filters.</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="tickets">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Contact &amp; Company</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Submitted</th>
                    <th className="status-col">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const chip = STATUS_CHIP[r.status] || STATUS_CHIP.pending;
                    return (
                      <tr key={r.id}>
                        <td className="tid">{r.requestCode}</td>
                        <td className="subject-cell">
                          <div className="subj">{r.contact}</div>
                          <div className="cust"><Building2 size={12} /> {r.company}</div>
                        </td>
                        <td>{r.email}</td>
                        <td className="mono" style={{ fontSize: 12.5 }}>{r.phone}</td>
                        <td className="mono" style={{ fontSize: 12.5 }}>{formatDate(r.submitted)}</td>
                        <td className="status-col"><span className={`chip ${chip.cls}`}>{chip.label}</span></td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => onOpen(r.id)}>
                            Review <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SelectField({ value, onChange, options }) {
  return (
    <div className="select-wrap">
      <select className="filter-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown />
    </div>
  );
}

/* ================================ Review flow ============================= */

function ReviewFlow({ request, onBack, onPatch }) {
  const [step, setStep] = useState(0); // 0=A 1=B 2=C 3=D
  const [furthestStep, setFurthestStep] = useState(0);

  // Step B state (local only — no backend endpoint persists this yet)
  const [verification, setVerification] = useState(() => {
    const saved = request.productVerification || {};
    return Object.fromEntries(
      (request.products || []).map((p) => [p, saved[p] || "Verified"])
    );
  });
  const [savingVerification, setSavingVerification] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  // Step C state — staff assignment for verified products.
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState("");
  const [assignmentConfirmed, setAssignmentConfirmed] = useState(false);
  // { [productName]: [staffId, staffId, ...] }
  const [perProductStaff, setPerProductStaff] = useState(() => {
    if (request.staffAssignment?.mode === "per-product") {
      return Object.fromEntries(
        Object.entries(request.staffAssignment.per_product).map(([product, entries]) => [
          product,
          (entries || []).map((entry) => String(entry.id)),
        ])
      );
    }
    return {};
  });
  const [assigningStaff, setAssigningStaff] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Products marked "Verified" in Step B — eligible for staff assignment.
  const verifiedProducts = useMemo(
    () => (request.products || []).filter((p) => (request.productVerification || {})[p] === "Verified"),
    [request.products, request.productVerification]
  );

  // Step D state
  const [finalAction, setFinalAction] = useState(null); // approve | reject
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const outcome = request.status !== "pending" ? request.status : null;

  // Revoke state — lives here (not in the parent) because it needs
  // `request` and `onPatch`, both of which only exist within ReviewFlow.
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadStaff() {
      setStaffLoading(true);
      setStaffError("");
      try {
        const { data } = await api.get("staff/");
        if (!cancelled) setStaffList(data.filter((s) => s.status === "active"));
      } catch (err) {
        if (!cancelled) setStaffError(err.response?.data?.detail || "Couldn't load staff.");
      } finally {
        if (!cancelled) setStaffLoading(false);
      }
    }
    loadStaff();
    return () => { cancelled = true; };
  }, []);

  const chip = STATUS_CHIP[request.status] || STATUS_CHIP.pending;
  const isResolved = request.status === "approved" || request.status === "rejected";

  function goToStep(i) {
    if (i <= furthestStep) setStep(i);
  }
  function advance(i) {
    setStep(i);
    setFurthestStep((f) => Math.max(f, i));
  }

  async function confirmAssignment() {
    setAssigningStaff(true);
    setAssignError("");
    try {
      const payload = {
        mode: "per-product",
        per_product: Object.fromEntries(
          verifiedProducts.map((p) => [p, (perProductStaff[p] || []).map(Number)])
        ),
      };
      await api.post(`onboarding/${request.id}/assign-staff/`, payload);
      setAssignmentConfirmed(true);
    } catch (err) {
      setAssignError(err.response?.data?.detail || "Couldn't save staff assignment.");
    } finally {
      setAssigningStaff(false);
    }
  }

  function assignedSummary() {
    const parts = verifiedProducts.map((p) => {
      const names = (perProductStaff[p] || [])
        .map((id) => staffList.find((s) => String(s.id) === String(id))?.name)
        .filter(Boolean);
      return names.length ? `${p} → ${names.join(", ")}` : null;
    }).filter(Boolean);
    return parts.join("  ·  ");
  }

  async function handleApprove() {
    setSubmitting(true);
    setActionError("");
    try {
      await api.post(`onboarding/${request.id}/approve/`);
      onPatch({ status: "approved" });
    } catch (err) {
      setActionError(err.response?.data?.detail || "Couldn't approve this account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    setActionError("");
    try {
      await api.post(`onboarding/${request.id}/reject/`, { reason });
      onPatch({ status: "rejected" });
    } catch (err) {
      setActionError(err.response?.data?.detail || "Couldn't reject this account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    setRevokeError("");
    try {
      await api.post(`onboarding/${request.id}/revoke/`);
      onPatch({ status: "pending" });
      // Send the reviewer back to the start of the flow, since the
      // registration is now unreviewed again.
      setStep(0);
      setFurthestStep(0);
      setFinalAction(null);
    } catch (err) {
      setRevokeError(err.response?.data?.detail || "Couldn't revoke this approval.");
    } finally {
      setRevoking(false);
    }
  }

  async function handleSaveVerification(nextStepIndex) {
    setSavingVerification(true);
    setVerifyError("");
    try {
      const { data } = await api.post(`onboarding/${request.id}/verify-products/`, {
        product_verification: verification,
      });
      onPatch({
        productVerification: data.product_verification,
      });
      advance(nextStepIndex);
    } catch (err) {
      setVerifyError(err.response?.data?.detail || "Couldn't save product verification.");
    } finally {
      setSavingVerification(false);
    }
  }

  function submitFinalAction() {
    if (finalAction === "approve") handleApprove();
    else if (finalAction === "reject") handleReject();
  }

  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft /> Back to all requests
      </button>

      <div className="panel">
        <div className="review-head">
          <div>
            <div className="review-company">{request.company}</div>
            <div className="review-meta">
              <span><Users size={13} />{request.contact}</span>
              <span><Mail size={13} />{request.email}</span>
              <span><Calendar size={13} />Submitted {formatDate(request.submitted)}</span>
            </div>
          </div>
          <span className={`chip ${chip.cls}`}>{chip.label}</span>
        </div>

        <div className="stepper">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                className={`step-pill ${step === i ? "active" : ""} ${furthestStep > i ? "done" : ""}`}
                onClick={() => goToStep(i)}
                disabled={i > furthestStep}
              >
                <span className="num">{furthestStep > i ? <Check size={12} /> : s.id}</span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="step-chevron" />}
            </React.Fragment>
          ))}
        </div>

        <div className="panel-body" style={{ paddingTop: 14 }}>
          {isResolved && (
            <div className={`banner ${request.status === "approved" ? "success" : "danger"}`}>
              {request.status === "approved" ? <ShieldCheck /> : <AlertCircle />}
              <div style={{ flex: 1 }}>
                <b>{request.status === "approved" ? "Account approved" : "Account rejected"}</b>
                {request.status === "approved"
                  ? "The customer can now log in with the password they set at signup."
                  : "The customer was notified by email that their registration was rejected."}
                {revokeError && (
                  <div style={{ marginTop: 8, color: "var(--danger, #d33)" }}>{revokeError}</div>
                )}
              </div>
              {request.status === "approved" && (
                <button className="btn btn-ghost btn-sm" onClick={handleRevoke} disabled={revoking}>
                  {revoking ? <><Loader2 size={14} className="spin" /> Revoking…</> : "Revoke Approval"}
                </button>
              )}
            </div>
          )}

          {step === 0 && <StepA request={request} onNext={() => advance(1)} />}
          {step === 1 && (
              <StepB
                request={request}
                verification={verification}
                setVerification={setVerification}
                saving={savingVerification}
                error={verifyError}
                onBack={() => setStep(0)}
                onNext={() => handleSaveVerification(2)}
              />
            )}
          {step === 2 && (
            <StepC
              request={request}
              staffList={staffList}
              staffLoading={staffLoading}
              staffError={staffError}
              verifiedProducts={verifiedProducts}
              perProductStaff={perProductStaff}
              setPerProductStaff={setPerProductStaff}
              assignmentConfirmed={assignmentConfirmed}
              confirmAssignment={confirmAssignment}
              assigningStaff={assigningStaff}
              assignError={assignError}
              assignedSummary={assignedSummary}
              onBack={() => setStep(1)}
              onNext={() => advance(3)}
            />
          )}
          {step === 3 && (
            <StepD
              request={request}
              assignedSummary={assignedSummary()}
              finalAction={finalAction}
              setFinalAction={setFinalAction}
              reason={reason}
              setReason={setReason}
              outcome={outcome}
              submitting={submitting}
              actionError={actionError}
              onBack={() => setStep(2)}
              onSubmit={submitFinalAction}
            />
          )}
        </div>
      </div>
    </>
  );
}

/* --- Step A: Customer & Company Details Review --- */
function StepA({ request, onNext }) {
  return (
    <>
      <div className="section-label"><Building2 />Company &amp; Contact Details</div>
      <div className="info-grid">
        <div className="info-item">
          <div className="info-label"><Building2 />Company Name</div>
          <div className="info-value">{request.company}</div>
        </div>
        <div className="info-item">
          <div className="info-label"><Users />Contact Person</div>
          <div className="info-value">{request.contact}</div>
        </div>
        <div className="info-item">
          <div className="info-label"><Mail />Email</div>
          <div className="info-value">{request.email}</div>
        </div>
        <div className="info-item">
          <div className="info-label"><Phone />Phone Number</div>
          <div className="info-value mono">{request.phone}</div>
        </div>
        {request.companyType && (
          <div className="info-item">
            <div className="info-label"><Building2 />Company Type</div>
            <div className="info-value">{request.companyType}</div>
          </div>
        )}
        {request.website && (
          <div className="info-item">
            <div className="info-label"><Globe />Website</div>
            <div className="info-value">{request.website}</div>
          </div>
        )}
        {request.gst && (
          <div className="info-item">
            <div className="info-label"><Hash />GST Number</div>
            <div className="info-value mono">{request.gst}</div>
          </div>
        )}
        {request.pan && (
          <div className="info-item">
            <div className="info-label"><Hash />PAN Number</div>
            <div className="info-value mono">{request.pan}</div>
          </div>
        )}
        <div className="info-item full">
          <div className="info-label"><MapPin />Registered Address</div>
          <div className="info-value">{request.address || "Not provided"}</div>
        </div>
      </div>

      <div className="section-label"><FileSignature />AMC &amp; Contract Details</div>
      <div className="info-grid">
        <div className="info-item">
          <div className="info-label"><FileText />AMC Details</div>
          <div className="info-value">{request.amc}</div>
        </div>
        <div className="info-item">
          <div className="info-label"><FileSignature />Contract / Agreement Reference</div>
          <div className="info-value mono">{request.contractRef || "Not provided"}</div>
        </div>
      </div>

      <div className="section-label"><ClipboardCheck />Product(s) / Service(s) in Use</div>
      <div className="product-chip-list">
        {(request.products || []).length === 0 ? (
          <span className="info-value">Not specified</span>
        ) : (
          request.products.map((p) => (
            <span className="product-chip" key={p}><Tag size={13} />{p}</span>
          ))
        )}
      </div>

      <div className="confirm-row">
        <button className="btn btn-primary" onClick={onNext}>
          Continue to Product Verification <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}

/* --- Step B: Product Verification --- */
function StepB({ request, verification, setVerification, saving, error, onBack, onNext }) {
  return (
    <>
      <div className="section-label"><ShieldCheck />Confirm Products the Customer Is Using</div>
      <div className="verify-table">
        {(request.products || []).length === 0 ? (
          <div className="empty-state"><Tag /><div>This company didn't select any products at signup.</div></div>
        ) : (
          request.products.map((p) => (
            <div className="verify-row" key={p}>
              <div className="verify-name"><Tag size={14} />{p}</div>
              <div className="field-select-wrap">
                <select
                  className="field-select"
                  value={verification[p] || "Verified"}
                  onChange={(e) => setVerification((v) => ({ ...v, [p]: e.target.value }))}
                >
                  <option>Verified</option>
                  <option>Not Found in Records</option>
                </select>
                <ChevronDown />
              </div>
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="banner danger" style={{ marginBottom: 14 }}>
          <AlertCircle />
          <div><b>Couldn't save</b>{error}</div>
        </div>
      )}

      <div className="confirm-row">
        <button className="btn btn-ghost" onClick={onBack} disabled={saving}>Back</button>
        <button className="btn btn-primary" onClick={onNext} disabled={saving}>
          {saving ? <><Loader2 size={16} className="spin" /> Saving…</> : <>Continue to Staff Assignment <ChevronRight size={16} /></>}
        </button>
      </div>
    </>
  );
}

/* --- Step C: Staff Assignment for verified products --- */
function StepC({
  request, staffList, staffLoading, staffError,
  verifiedProducts, perProductStaff, setPerProductStaff,
  assignmentConfirmed, confirmAssignment, assigningStaff, assignError,
  assignedSummary, onBack, onNext,
}) {
  const canConfirm =
    verifiedProducts.length > 0 &&
    verifiedProducts.every((p) => (perProductStaff[p] || []).length > 0);

  if (staffLoading) {
    return (
      <div className="empty-state">
        <Loader2 className="spin" />
        <div>Loading staff…</div>
      </div>
    );
  }

  if (staffError) {
    return (
      <div className="banner danger">
        <AlertCircle />
        <div><b>Couldn't load staff</b>{staffError}</div>
      </div>
    );
  }

  return (
    <>
      <div className="section-label"><UserCog />Assign Staff — set once at approval, not per ticket</div>

      {verifiedProducts.length === 0 ? (
        <div className="empty-state">
          <Tag />
          <div>
            No products were marked "Verified" on the previous step. Go back to Product
            Verification and confirm at least one product before assigning staff.
          </div>
        </div>
      ) : (
        <div>
          {verifiedProducts.map((p) => {
            return (
              <div
                key={p}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "14px 16px",
                  marginBottom: 14,
                }}
              >
                <div className="verify-row">
                  <div className="verify-name"><Tag size={14} />{p}</div>
                  <StaffMultiSelect
                    staff={staffList}
                    selectedIds={perProductStaff[p] || []}
                    onToggle={(id) => setPerProductStaff((m) => ({ ...m, [p]: toggleId(m[p] || [], id) }))}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      letterSpacing: 0.3,
                      textTransform: "uppercase",
                      color: "var(--text-muted, #6b7280)",
                      marginBottom: 8,
                    }}
                  >
                    Available Staff for {p}
                  </div>
                  <StaffDetailsTable staff={staffList} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {assignError && (
        <div className="banner danger" style={{ marginTop: 14 }}>
          <AlertCircle />
          <div><b>Couldn't save</b>{assignError}</div>
        </div>
      )}

      {!assignmentConfirmed ? (
        <div className="confirm-row">
          <button className="btn btn-ghost" onClick={onBack} disabled={assigningStaff}>Back</button>
          <button className="btn btn-primary" disabled={!canConfirm || assigningStaff} onClick={confirmAssignment}>
            {assigningStaff ? <><Loader2 size={16} className="spin" /> Saving…</> : <><Check size={16} /> Confirm Assignment</>}
          </button>
        </div>
      ) : (
        <>
          <div className="assign-summary">
            <ShieldCheck /> {assignedSummary()} The assigned staff will be notified.
          </div>
          <div className="confirm-row">
            <button className="btn btn-ghost" onClick={onBack}>Back</button>
            <button className="btn btn-primary" onClick={onNext}>
              Continue to Final Action <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </>
  );
}

/* Multi-select dropdown for assigning one or more staff to a product. */
function StaffMultiSelect({ staff, selectedIds, onToggle }) {
  const [open, setOpen] = useState(false);
  const wrapRef = React.useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = (selectedIds || []).map(String);
  const selectedNames = staff
    .filter((s) => selected.includes(String(s.id)))
    .map((s) => s.name);

  return (
    <div className="field-select-wrap" ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="field-select"
        style={{ textAlign: "left", cursor: "pointer", width: "100%", background: "#fff" }}
        onClick={() => setOpen((o) => !o)}
      >
        {selectedNames.length > 0 ? selectedNames.join(", ") : "Select staff…"}
      </button>
      <ChevronDown style={{ pointerEvents: "none" }} />

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "#fff",
            border: "1px solid #e2e5ea",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(20,20,30,0.12)",
            maxHeight: 260,
            overflowY: "auto",
            padding: 6,
          }}
        >
          {staff.length === 0 ? (
            <div style={{ padding: "10px 8px", fontSize: 13, color: "var(--text-muted, #6b7280)" }}>
              No active staff available.
            </div>
          ) : (
            staff.map((s) => {
              const checked = selected.includes(String(s.id));
              return (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 8px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: checked ? "rgba(20,150,120,0.08)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(s.id)}
                  />
                  <div className="staff-mini-avatar">{initials(s.name)}</div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div className="staff-mini-name">{s.name}</div>
                    <div className="staff-mini-dept" style={{ fontSize: 11.5 }}>
                      {s.department}{s.role ? ` · ${s.role}` : ""}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* Read-only reference table of all active staff for a product. */
function StaffDetailsTable({ staff }) {
  if (!staff || staff.length === 0) {
    return <div className="empty-state"><Users /><div>No active staff available.</div></div>;
  }

  return (
    <table className="staff-pick-table">
      <thead>
        <tr>
          <th>Staff Name</th>
          <th>Department</th>
          <th>Role</th>
          <th>Assigned Customers</th>
          <th>Active Tickets</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {staff.map((s) => (
          <tr key={s.id}>
            <td>
              <div className="staff-name-cell">
                <div className="staff-mini-avatar">{initials(s.name)}</div>
                <div className="staff-mini-name">{s.name}</div>
              </div>
            </td>
            <td className="staff-mini-dept">{s.department}</td>
            <td>{s.role || "—"}</td>
            <td className="mono">{s.assignedCustomers}</td>
            <td className="mono">{s.ticketsAssigned}</td>
            <td>
              <span className={`status-pill ${s.status === "active" ? "avail" : "busy"}`}>
                <CircleDot size={9} />{s.status === "active" ? "Available" : "Inactive"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* --- Step D: Final Approval Action --- */
function StepD({
  request, assignedSummary, finalAction, setFinalAction, reason, setReason,
  outcome, submitting, actionError, onBack, onSubmit,
}) {
  // Nothing to show once resolved — the parent already renders that banner.
  if (outcome) {
    return null;
  }

  return (
    <>
      <div className="section-label"><FileText />Review Summary</div>
      <div className="info-grid" style={{ paddingTop: 0 }}>
        <div className="info-item full">
          <div className="info-label"><UserCog />Staff Assignment</div>
          <div className="info-value">{assignedSummary || "Not yet assigned"}</div>
        </div>
      </div>

      <div className="section-label"><ClipboardCheck />Choose Final Action</div>
      <div className="action-cards">
        <button
          className={`action-card approve ${finalAction === "approve" ? "selected" : ""}`}
          onClick={() => setFinalAction("approve")}
        >
          <div className="a-icon"><Check /></div>
          <div className="a-title">Approve</div>
          <div className="a-desc">Activates the account so the customer can log in.</div>
        </button>
        <button
          className={`action-card reject ${finalAction === "reject" ? "selected" : ""}`}
          onClick={() => setFinalAction("reject")}
        >
          <div className="a-icon"><X /></div>
          <div className="a-title">Reject</div>
          <div className="a-desc">Declines the registration. The customer is notified by email, with an optional reason.</div>
        </button>
      </div>

      {actionError && (
        <div className="banner danger" style={{ marginTop: 14 }}>
          <AlertCircle />
          <div><b>Something went wrong</b>{actionError}</div>
        </div>
      )}

      {finalAction && (
        <div className="action-detail">
          {finalAction === "approve" && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              <Info size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              This will activate <b>{request.company}</b>'s account. They log in with the password they set at signup.
            </p>
          )}
          {finalAction === "reject" && (
            <div className="field-block" style={{ margin: 0 }}>
              <label className="field-label">Reason (optional, included in the notification email)</label>
              <textarea
                className="field-textarea"
                placeholder="e.g. Unable to verify company registration details…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
          <div className="confirm-row">
            <button className="btn btn-ghost" onClick={onBack} disabled={submitting}>Back</button>
            <button
              className={`btn ${finalAction === "approve" ? "btn-primary" : "btn-danger"}`}
              onClick={onSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 size={16} className="spin" /> Processing…</>
              ) : finalAction === "approve" ? (
                <><Check size={16} /> Approve Account</>
              ) : (
                <><X size={16} /> Reject Account</>
              )}
            </button>
          </div>
        </div>
      )}

      {!finalAction && (
        <div className="confirm-row">
          <button className="btn btn-ghost" onClick={onBack}>Back</button>
        </div>
      )}
    </>
  );
}