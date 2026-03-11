import { useState, useEffect, useMemo } from "react";

const SUPABASE_URL = "https://pxrqrmyvmbzxbxhuxqtx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cnFybXl2bWJ6eGJ4aHV4cXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODE3MzIsImV4cCI6MjA4ODc1NzczMn0.fdWm-2QhZAbBHlSQPFi5rUCd1SxXYAlr-UFIukPFtsY";
const ADMIN_PASSWORD = "capriq-kUssi0-ransij2";
const MIN_SUBMISSIONS = 3;
const MIN_SALARY = 20000;
const MAX_SALARY = 500000;
const RATE_LIMIT_KEY = "salarylens_last_submit";
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

const INDUSTRIES = [
  "Finance & Insurance","Tourism & Hospitality","Legal Services",
  "Government & Public Sector","Technology & IT","Healthcare","Reinsurance",
  "Construction & Real Estate","Education","Retail & Trade","Marine & Shipping",
  "Accounting & Consulting","Media & Communications","Other",
];

const EXPERIENCE_LEVELS = ["0–2 years","3–5 years","6–10 years","11–15 years","15+ years"];

async function apiFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error("API error");
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function fmtSalary(n) { return "$" + Math.round(n).toLocaleString(); }

function Stats({ entries }) {
  if (!entries.length) return null;
  const salaries = entries.map(e => e.salary);
  const avg = salaries.reduce((a, b) => a + b, 0) / salaries.length;
  return (
    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
      {[
        { label: "Submissions", val: entries.length, accent: false },
        { label: "Average", val: fmtSalary(avg), accent: true },
        { label: "Lowest", val: fmtSalary(Math.min(...salaries)), accent: false },
        { label: "Highest", val: fmtSalary(Math.max(...salaries)), accent: false },
      ].map(({ label, val, accent }) => (
        <div key={label} style={{ background: accent ? "#C9A84C" : "rgba(255,255,255,0.04)", border: accent ? "none" : "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "1rem 1.4rem", minWidth: "120px", flex: "1" }}>
          <div style={{ fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", color: accent ? "#3D2B00" : "#888", marginBottom: "0.3rem", fontFamily: "'DM Mono', monospace" }}>{label}</div>
          <div style={{ fontSize: "1.4rem", fontWeight: "700", color: accent ? "#1A1200" : "#F5EDD6", fontFamily: "'Playfair Display', serif" }}>{val}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState("browse");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterExp, setFilterExp] = useState("");
  const [filterMinSal, setFilterMinSal] = useState("");
  const [filterMaxSal, setFilterMaxSal] = useState("");
  const [form, setForm] = useState({ title: "", salary: "", industry: "", experience: "" });
  const [errors, setErrors] = useState({});
  const [flagging, setFlagging] = useState(null);
  const [flagged, setFlagged] = useState({});
  const [adminMode, setAdminMode] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    apiFetch("salaries?select=*&order=created_at.desc")
      .then(setEntries)
      .catch(() => setLoadError("Could not load data. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => entries.filter(e => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterIndustry && e.industry !== filterIndustry) return false;
    if (filterExp && e.experience !== filterExp) return false;
    if (filterMinSal && e.salary < Number(filterMinSal)) return false;
    if (filterMaxSal && e.salary > Number(filterMaxSal)) return false;
    return true;
  }), [entries, search, filterIndustry, filterExp, filterMinSal, filterMaxSal]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(e => {
      const key = e.title.toLowerCase().trim();
      if (!map[key]) map[key] = { title: e.title, entries: [] };
      map[key].entries.push(e);
    });
    return Object.values(map)
      .filter(g => g.entries.length >= MIN_SUBMISSIONS)
      .sort((a, b) => b.entries.length - a.entries.length);
  }, [filtered]);

  const pendingCount = useMemo(() => {
    const map = {};
    filtered.forEach(e => {
      const key = e.title.toLowerCase().trim();
      if (!map[key]) map[key] = 0;
      map[key]++;
    });
    return Object.values(map).filter(c => c < MIN_SUBMISSIONS).reduce((a, b) => a + b, 0);
  }, [filtered]);

  function checkRateLimit() {
    try {
      const last = localStorage.getItem(RATE_LIMIT_KEY);
      if (last && Date.now() - Number(last) < RATE_LIMIT_MS) return false;
    } catch {}
    return true;
  }

  function setRateLimit() {
    try { localStorage.setItem(RATE_LIMIT_KEY, String(Date.now())); } catch {}
  }

  async function handleSubmit() {
    const errs = {};
    if (!form.title.trim() || form.title.trim().length < 3) errs.title = "Must be at least 3 characters";
    const sal = Number(form.salary);
    if (!form.salary || isNaN(sal) || sal < MIN_SALARY || sal > MAX_SALARY)
      errs.salary = `Enter a salary between ${fmtSalary(MIN_SALARY)} and ${fmtSalary(MAX_SALARY)}`;
    if (!form.industry) errs.industry = "Required";
    if (!form.experience) errs.experience = "Required";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (!checkRateLimit()) {
      setSubmitError("You can only submit once every 24 hours. Thank you for contributing!");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await apiFetch("salaries", {
        method: "POST",
        body: JSON.stringify({ title: form.title.trim(), salary: sal, industry: form.industry, experience: form.experience, flagged: false }),
      });
      const inserted = Array.isArray(result) ? result[0] : result;
      setEntries(prev => [inserted, ...prev]);
      setForm({ title: "", salary: "", industry: "", experience: "" });
      setRateLimit();
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); setView("browse"); }, 2500);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFlag(entryId) {
    setFlagging(entryId);
    try {
      await apiFetch(`salaries?id=eq.${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ flagged: true }),
      });
      setFlagged(prev => ({ ...prev, [entryId]: true }));
    } catch {}
    setFlagging(null);
  }

  async function handleDelete(entryId) {
    setDeleting(entryId);
    try {
      await apiFetch(`salaries?id=eq.${entryId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      setEntries(prev => prev.filter(e => e.id !== entryId));
    } catch {}
    setDeleting(null);
  }

  function handleAdminLogin() {
    if (adminInput === ADMIN_PASSWORD) { setAdminMode(true); setAdminError(""); setView("admin"); }
    else setAdminError("Incorrect password.");
  }

  const inp = (field) => ({
    value: form[field],
    onChange: (e) => { setForm({ ...form, [field]: e.target.value }); setErrors({ ...errors, [field]: undefined }); },
  });

  const flaggedEntries = entries.filter(e => e.flagged);

  return (
    <div style={{ minHeight: "100vh", background: "#0F0C07", color: "#F5EDD6", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0F0C07; } ::-webkit-scrollbar-thumb { background: #3A3020; border-radius: 3px; }
        input, select { outline: none; } input::placeholder { color: #555; } select option { background: #1A1610; }
        .tab { cursor: pointer; padding: 0.5rem 1.2rem; border-radius: 6px; font-size: 0.85rem; letter-spacing: 0.05em; border: 1px solid transparent; transition: all 0.2s; background: none; color: #888; }
        .tab.active { background: #C9A84C; color: #1A1200; font-weight: 600; border-color: #C9A84C; }
        .tab:not(.active) { border-color: rgba(255,255,255,0.08); }
        .tab:not(.active):hover { color: #F5EDD6; border-color: rgba(255,255,255,0.15); }
        .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 1.2rem 1.4rem; transition: border-color 0.2s; }
        .card:hover { border-color: rgba(201,168,76,0.3); }
        .field { display: flex; flex-direction: column; gap: 0.4rem; }
        .field label { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: #888; font-family: 'DM Mono', monospace; }
        .field input, .field select { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.65rem 0.9rem; color: #F5EDD6; font-size: 0.9rem; font-family: 'DM Sans', sans-serif; transition: border-color 0.2s; }
        .field input:focus, .field select:focus { border-color: #C9A84C; }
        .field .err { font-size: 0.75rem; color: #E07070; margin-top: 0.1rem; }
        .field input.has-err, .field select.has-err { border-color: #E07070; }
        .btn-gold { background: #C9A84C; color: #1A1200; border: none; border-radius: 8px; padding: 0.75rem 2rem; font-weight: 700; font-size: 0.9rem; cursor: pointer; letter-spacing: 0.04em; transition: background 0.2s, transform 0.1s; font-family: 'DM Sans', sans-serif; }
        .btn-gold:hover { background: #DDB95A; } .btn-gold:active { transform: scale(0.98); } .btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-red { background: rgba(220,60,60,0.15); color: #E07070; border: 1px solid rgba(220,60,60,0.3); border-radius: 6px; padding: 0.35rem 0.8rem; font-size: 0.75rem; cursor: pointer; font-family: 'DM Mono', monospace; transition: all 0.2s; }
        .btn-red:hover { background: rgba(220,60,60,0.3); }
        .btn-flag { background: rgba(255,255,255,0.04); color: #666; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 0.3rem 0.7rem; font-size: 0.7rem; cursor: pointer; font-family: 'DM Mono', monospace; transition: all 0.2s; }
        .btn-flag:hover { color: #E09050; border-color: rgba(220,140,60,0.3); }
        .bar { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; margin-top: 0.5rem; }
        .bar-fill { height: 100%; background: linear-gradient(90deg, #C9A84C, #E8C96A); border-radius: 3px; }
        .filter-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.55rem 0.85rem; color: #F5EDD6; font-size: 0.85rem; font-family: 'DM Sans', sans-serif; transition: border-color 0.2s; width: 100%; }
        .filter-input:focus { border-color: #C9A84C; outline: none; }
        .tag { display: inline-block; background: rgba(201,168,76,0.12); color: #C9A84C; border-radius: 4px; padding: 0.15rem 0.5rem; font-size: 0.72rem; font-family: 'DM Mono', monospace; letter-spacing: 0.05em; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #C9A84C; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "1.5rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.2rem" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#C9A84C" }} />
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#C9A84C", fontFamily: "'DM Mono', monospace" }}>Bermuda</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.7rem", fontWeight: "900", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
            Salary<span style={{ color: "#C9A84C" }}>Lens</span>
          </h1>
          <p style={{ fontSize: "0.78rem", color: "#666", marginTop: "0.2rem" }}>Anonymous salary data for Bermuda professionals</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className={`tab${view === "browse" ? " active" : ""}`} onClick={() => setView("browse")}>Browse Data</button>
          <button className={`tab${view === "submit" ? " active" : ""}`} onClick={() => { setView("submit"); setSubmitted(false); }}>+ Submit Salary</button>
          <button className={`tab${view === "admin" || view === "adminlogin" ? " active" : ""}`} onClick={() => setView(adminMode ? "admin" : "adminlogin")} style={{ fontSize: "0.75rem", opacity: 0.4 }}>⚙</button>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* BROWSE */}
        {view === "browse" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {[
                { label: "Job Title", el: <input className="filter-input" placeholder="e.g. Accountant" value={search} onChange={e => setSearch(e.target.value)} /> },
                { label: "Industry", el: <select className="filter-input" value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}><option value="">All Industries</option>{INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select> },
                { label: "Experience", el: <select className="filter-input" value={filterExp} onChange={e => setFilterExp(e.target.value)}><option value="">All Levels</option>{EXPERIENCE_LEVELS.map(l => <option key={l}>{l}</option>)}</select> },
                { label: "Min Salary ($)", el: <input className="filter-input" placeholder="e.g. 50000" type="number" value={filterMinSal} onChange={e => setFilterMinSal(e.target.value)} /> },
                { label: "Max Salary ($)", el: <input className="filter-input" placeholder="e.g. 120000" type="number" value={filterMaxSal} onChange={e => setFilterMaxSal(e.target.value)} /> },
              ].map(({ label, el }) => (
                <div key={label}>
                  <div style={{ fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", fontFamily: "'DM Mono', monospace", marginBottom: "0.35rem" }}>{label}</div>
                  {el}
                </div>
              ))}
            </div>

            {loading ? <div style={{ textAlign: "center", padding: "4rem" }}><div className="spinner" /></div>
              : loadError ? <div style={{ textAlign: "center", color: "#E07070", padding: "3rem", fontFamily: "'DM Mono', monospace", fontSize: "0.85rem" }}>{loadError}</div>
              : <>
                <Stats entries={filtered} />
                {pendingCount > 0 && (
                  <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: "8px", padding: "0.7rem 1rem", marginBottom: "1rem", fontSize: "0.78rem", color: "#888", fontFamily: "'DM Mono', monospace" }}>
                    {pendingCount} submission{pendingCount !== 1 ? "s" : ""} waiting — roles need {MIN_SUBMISSIONS}+ reports to appear publicly.
                  </div>
                )}
                {grouped.length === 0
                  ? <div style={{ textAlign: "center", color: "#555", padding: "3rem", fontFamily: "'DM Mono', monospace", fontSize: "0.85rem" }}>
                      {entries.length === 0 ? "No submissions yet. Be the first to share your salary!" : "No roles have enough submissions yet. Each role needs 3+ reports to appear."}
                    </div>
                  : <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {grouped.map(({ title, entries: grp }) => {
                        const sals = grp.map(e => e.salary);
                        const avg = sals.reduce((a, b) => a + b, 0) / sals.length;
                        const globalMax = Math.max(...entries.map(e => e.salary));
                        return (
                          <div key={title} className="card">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: "700", marginBottom: "0.4rem" }}>{title}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                                  {[...new Set(grp.map(e => e.industry))].map(i => <span key={i} className="tag">{i}</span>)}
                                  {[...new Set(grp.map(e => e.experience))].map(l => <span key={l} className="tag" style={{ background: "rgba(255,255,255,0.05)", color: "#888" }}>{l}</span>)}
                                  <span className="tag" style={{ background: "rgba(255,255,255,0.05)", color: "#666" }}>{grp.length} reports</span>
                                  <button className="btn-flag" onClick={() => setFlagging(title === flagging ? null : title)}>⚑ flag</button>
                                </div>
                                {flagging === title && (
                                  <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                    <div style={{ fontSize: "0.75rem", color: "#888", fontFamily: "'DM Mono', monospace" }}>Flag a specific entry as suspicious:</div>
                                    {grp.map(e => (
                                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8rem", color: "#aaa" }}>
                                        <span style={{ fontFamily: "'DM Mono', monospace" }}>{fmtSalary(e.salary)} · {e.experience}</span>
                                        {flagged[e.id]
                                          ? <span style={{ color: "#C9A84C", fontSize: "0.72rem" }}>✓ flagged</span>
                                          : <button className="btn-flag" onClick={() => handleFlag(e.id)} disabled={flagging === e.id}>
                                              {flagging === e.id ? "…" : "flag this"}
                                            </button>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="bar" style={{ maxWidth: "260px", marginTop: "0.75rem" }}>
                                  <div className="bar-fill" style={{ width: `${(avg / globalMax) * 100}%` }} />
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: "700", color: "#C9A84C" }}>{fmtSalary(avg)}</div>
                                <div style={{ fontSize: "0.72rem", color: "#666", fontFamily: "'DM Mono', monospace", marginTop: "0.2rem" }}>{fmtSalary(Math.min(...sals))} – {fmtSalary(Math.max(...sals))}</div>
                                <div style={{ fontSize: "0.65rem", color: "#555", fontFamily: "'DM Mono', monospace" }}>avg · range</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                }
              </>
            }
          </>
        )}

        {/* SUBMIT */}
        {view === "submit" && (
          <div style={{ maxWidth: "500px", margin: "0 auto" }}>
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: "700", marginBottom: "0.4rem" }}>Share Your Salary</h2>
              <p style={{ color: "#666", fontSize: "0.85rem", lineHeight: 1.6 }}>All submissions are completely anonymous. No account, no tracking — just helping your fellow Bermudians get paid fairly.</p>
            </div>
            {submitted
              ? <div style={{ textAlign: "center", padding: "3rem", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: "12px" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", color: "#C9A84C", fontWeight: "700" }}>Thank you!</div>
                  <div style={{ fontSize: "0.82rem", color: "#888", marginTop: "0.4rem" }}>Your submission has been added.</div>
                </div>
              : <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                  <div className="field">
                    <label>Job Title</label>
                    <input {...inp("title")} className={errors.title ? "has-err" : ""} placeholder="e.g. Software Engineer" />
                    {errors.title && <span className="err">{errors.title}</span>}
                  </div>
                  <div className="field">
                    <label>Annual Salary (BMD / USD)</label>
                    <input {...inp("salary")} className={errors.salary ? "has-err" : ""} type="number" placeholder={`${MIN_SALARY.toLocaleString()} – ${MAX_SALARY.toLocaleString()}`} />
                    {errors.salary && <span className="err">{errors.salary}</span>}
                  </div>
                  <div className="field">
                    <label>Industry / Sector</label>
                    <select {...inp("industry")} className={errors.industry ? "has-err" : ""}>
                      <option value="">Select an industry…</option>
                      {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                    </select>
                    {errors.industry && <span className="err">{errors.industry}</span>}
                  </div>
                  <div className="field">
                    <label>Years of Experience</label>
                    <select {...inp("experience")} className={errors.experience ? "has-err" : ""}>
                      <option value="">Select experience level…</option>
                      {EXPERIENCE_LEVELS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    {errors.experience && <span className="err">{errors.experience}</span>}
                  </div>
                  {submitError && <div style={{ fontSize: "0.8rem", color: "#E07070", textAlign: "center", background: "rgba(220,80,80,0.08)", border: "1px solid rgba(220,80,80,0.2)", borderRadius: "8px", padding: "0.75rem" }}>{submitError}</div>}
                  <button className="btn-gold" onClick={handleSubmit} disabled={submitting} style={{ marginTop: "0.5rem", width: "100%" }}>
                    {submitting ? "Submitting…" : "Submit Anonymously"}
                  </button>
                  <p style={{ fontSize: "0.72rem", color: "#555", textAlign: "center", fontFamily: "'DM Mono', monospace" }}>No personal data is collected. Ever.</p>
                </div>
            }
          </div>
        )}

        {/* ADMIN LOGIN */}
        {view === "adminlogin" && (
          <div style={{ maxWidth: "360px", margin: "0 auto" }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: "700", marginBottom: "1.5rem" }}>Admin Access</h2>
            <div className="field" style={{ marginBottom: "1rem" }}>
              <label>Password</label>
              <input type="password" value={adminInput} onChange={e => setAdminInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "0.65rem 0.9rem", color: "#F5EDD6", fontSize: "0.9rem", fontFamily: "'DM Sans', sans-serif" }} />
              {adminError && <span style={{ fontSize: "0.75rem", color: "#E07070" }}>{adminError}</span>}
            </div>
            <button className="btn-gold" onClick={handleAdminLogin} style={{ width: "100%" }}>Sign In</button>
          </div>
        )}

        {/* ADMIN DASHBOARD */}
        {view === "admin" && adminMode && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: "700" }}>Admin Dashboard</h2>
              <button className="tab" onClick={() => { setAdminMode(false); setView("browse"); }} style={{ fontSize: "0.75rem" }}>Sign Out</button>
            </div>

            {/* Flagged entries */}
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#C9A84C", fontFamily: "'DM Mono', monospace", marginBottom: "0.75rem" }}>
                Flagged Entries ({flaggedEntries.length})
              </div>
              {flaggedEntries.length === 0
                ? <div style={{ color: "#555", fontSize: "0.85rem", fontFamily: "'DM Mono', monospace" }}>No flagged entries.</div>
                : flaggedEntries.map(e => (
                    <div key={e.id} className="card" style={{ marginBottom: "0.5rem", borderColor: "rgba(220,100,60,0.3)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                        <div>
                          <div style={{ fontWeight: "600", marginBottom: "0.2rem" }}>{e.title}</div>
                          <div style={{ fontSize: "0.78rem", color: "#888", fontFamily: "'DM Mono', monospace" }}>{fmtSalary(e.salary)} · {e.industry} · {e.experience}</div>
                        </div>
                        <button className="btn-red" onClick={() => handleDelete(e.id)} disabled={deleting === e.id}>
                          {deleting === e.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))
              }
            </div>

            {/* All entries */}
            <div>
              <div style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#888", fontFamily: "'DM Mono', monospace", marginBottom: "0.75rem" }}>
                All Entries ({entries.length})
              </div>
              {entries.map(e => (
                <div key={e.id} className="card" style={{ marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <div style={{ fontWeight: "600", marginBottom: "0.2rem" }}>{e.title} {e.flagged && <span style={{ color: "#E09050", fontSize: "0.72rem", fontFamily: "'DM Mono', monospace" }}>⚑ flagged</span>}</div>
                      <div style={{ fontSize: "0.78rem", color: "#888", fontFamily: "'DM Mono', monospace" }}>{fmtSalary(e.salary)} · {e.industry} · {e.experience}</div>
                    </div>
                    <button className="btn-red" onClick={() => handleDelete(e.id)} disabled={deleting === e.id}>
                      {deleting === e.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
