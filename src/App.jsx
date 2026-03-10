import { useState, useEffect, useMemo } from "react";

const SUPABASE_URL = "https://pxrqrmyvmbzxbxhuxqtx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cnFybXl2bWJ6eGJ4aHV4cXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODE3MzIsImV4cCI6MjA4ODc1NzczMn0.fdWm-2QhZAbBHlSQPFi5rUCd1SxXYAlr-UFIukPFtsY";

const INDUSTRIES = [
  "Finance & Insurance",
  "Tourism & Hospitality",
  "Legal Services",
  "Government & Public Sector",
  "Technology & IT",
  "Healthcare",
  "Reinsurance",
  "Construction & Real Estate",
  "Education",
  "Retail & Trade",
  "Marine & Shipping",
  "Accounting & Consulting",
  "Media & Communications",
  "Other",
];

const EXPERIENCE_LEVELS = [
  "0–2 years",
  "3–5 years",
  "6–10 years",
  "11–15 years",
  "15+ years",
];

async function fetchSalaries() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/salaries?select=*&order=created_at.desc`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function insertSalary(entry) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/salaries`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error("Failed to insert");
  return res.json();
}

function fmtSalary(n) {
  return "$" + Math.round(n).toLocaleString();
}

function Stats({ entries }) {
  if (!entries.length) return null;
  const salaries = entries.map((e) => e.salary);
  const avg = salaries.reduce((a, b) => a + b, 0) / salaries.length;
  const min = Math.min(...salaries);
  const max = Math.max(...salaries);
  return (
    <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
      {[
        { label: "Submissions", val: entries.length, accent: false },
        { label: "Average", val: fmtSalary(avg), accent: true },
        { label: "Lowest", val: fmtSalary(min), accent: false },
        { label: "Highest", val: fmtSalary(max), accent: false },
      ].map(({ label, val, accent }) => (
        <div key={label} style={{
          background: accent ? "#C9A84C" : "rgba(255,255,255,0.04)",
          border: accent ? "none" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "1rem 1.4rem",
          minWidth: "120px",
          flex: "1",
        }}>
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

  useEffect(() => {
    fetchSalaries()
      .then(setEntries)
      .catch(() => setLoadError("Could not load data. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterIndustry && e.industry !== filterIndustry) return false;
      if (filterExp && e.experience !== filterExp) return false;
      if (filterMinSal && e.salary < Number(filterMinSal)) return false;
      if (filterMaxSal && e.salary > Number(filterMaxSal)) return false;
      return true;
    });
  }, [entries, search, filterIndustry, filterExp, filterMinSal, filterMaxSal]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      const key = e.title.toLowerCase().trim();
      if (!map[key]) map[key] = { title: e.title, entries: [] };
      map[key].entries.push(e);
    });
    return Object.values(map).sort((a, b) => b.entries.length - a.entries.length);
  }, [filtered]);

  async function handleSubmit() {
    const errs = {};
    if (!form.title.trim()) errs.title = "Required";
    if (!form.salary || isNaN(form.salary) || Number(form.salary) < 1000) errs.salary = "Enter a valid annual salary";
    if (!form.industry) errs.industry = "Required";
    if (!form.experience) errs.experience = "Required";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const [inserted] = await insertSalary({
        title: form.title.trim(),
        salary: Number(form.salary),
        industry: form.industry,
        experience: form.experience,
      });
      setEntries((prev) => [inserted, ...prev]);
      setForm({ title: "", salary: "", industry: "", experience: "" });
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); setView("browse"); }, 2500);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inp = (field) => ({
    value: form[field],
    onChange: (e) => { setForm({ ...form, [field]: e.target.value }); setErrors({ ...errors, [field]: undefined }); },
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0F0C07", color: "#F5EDD6", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0F0C07; } ::-webkit-scrollbar-thumb { background: #3A3020; border-radius: 3px; }
        input, select { outline: none; }
        input::placeholder { color: #555; }
        select option { background: #1A1610; }
        .tab { cursor: pointer; padding: 0.5rem 1.2rem; border-radius: 6px; font-size: 0.85rem; letter-spacing: 0.05em; border: 1px solid transparent; transition: all 0.2s; }
        .tab.active { background: #C9A84C; color: #1A1200; font-weight: 600; border-color: #C9A84C; }
        .tab:not(.active) { color: #888; border-color: rgba(255,255,255,0.08); }
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
        .btn-gold:hover { background: #DDB95A; }
        .btn-gold:active { transform: scale(0.98); }
        .btn-gold:disabled { opacity: 0.5; cursor: not-allowed; }
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
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className={`tab${view === "browse" ? " active" : ""}`} onClick={() => { setView("browse"); setSubmitted(false); }}>Browse Data</button>
          <button className={`tab${view === "submit" ? " active" : ""}`} onClick={() => { setView("submit"); setSubmitted(false); }}>+ Submit Salary</button>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1.5rem" }}>

        {/* BROWSE VIEW */}
        {view === "browse" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
              <div>
                <div style={{ fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", fontFamily: "'DM Mono', monospace", marginBottom: "0.35rem" }}>Job Title</div>
                <input className="filter-input" placeholder="e.g. Accountant" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", fontFamily: "'DM Mono', monospace", marginBottom: "0.35rem" }}>Industry</div>
                <select className="filter-input" value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}>
                  <option value="">All Industries</option>
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", fontFamily: "'DM Mono', monospace", marginBottom: "0.35rem" }}>Experience</div>
                <select className="filter-input" value={filterExp} onChange={e => setFilterExp(e.target.value)}>
                  <option value="">All Levels</option>
                  {EXPERIENCE_LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", fontFamily: "'DM Mono', monospace", marginBottom: "0.35rem" }}>Min Salary ($)</div>
                <input className="filter-input" placeholder="e.g. 50000" type="number" value={filterMinSal} onChange={e => setFilterMinSal(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", fontFamily: "'DM Mono', monospace", marginBottom: "0.35rem" }}>Max Salary ($)</div>
                <input className="filter-input" placeholder="e.g. 120000" type="number" value={filterMaxSal} onChange={e => setFilterMaxSal(e.target.value)} />
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "4rem" }}><div className="spinner" /></div>
            ) : loadError ? (
              <div style={{ textAlign: "center", color: "#E07070", padding: "3rem", fontFamily: "'DM Mono', monospace", fontSize: "0.85rem" }}>{loadError}</div>
            ) : (
              <>
                <Stats entries={filtered} />
                {grouped.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#555", padding: "3rem", fontFamily: "'DM Mono', monospace", fontSize: "0.85rem" }}>
                    {entries.length === 0 ? "No submissions yet. Be the first to share your salary!" : "No matching entries. Try adjusting your filters."}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {grouped.map(({ title, entries: grpEntries }) => {
                      const salaries = grpEntries.map(e => e.salary);
                      const avg = salaries.reduce((a, b) => a + b, 0) / salaries.length;
                      const min = Math.min(...salaries);
                      const max = Math.max(...salaries);
                      const industries = [...new Set(grpEntries.map(e => e.industry))];
                      const expLevels = [...new Set(grpEntries.map(e => e.experience))];
                      const globalMax = Math.max(...entries.map(e => e.salary));
                      const barPct = (avg / globalMax) * 100;

                      return (
                        <div key={title} className="card">
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: "700", marginBottom: "0.4rem" }}>{title}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                                {industries.map(i => <span key={i} className="tag">{i}</span>)}
                                {expLevels.map(l => <span key={l} className="tag" style={{ background: "rgba(255,255,255,0.05)", color: "#888" }}>{l}</span>)}
                                <span className="tag" style={{ background: "rgba(255,255,255,0.05)", color: "#666" }}>{grpEntries.length} {grpEntries.length === 1 ? "report" : "reports"}</span>
                              </div>
                              <div className="bar" style={{ maxWidth: "260px", marginTop: "0.75rem" }}>
                                <div className="bar-fill" style={{ width: `${barPct}%` }} />
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: "700", color: "#C9A84C" }}>{fmtSalary(avg)}</div>
                              <div style={{ fontSize: "0.72rem", color: "#666", fontFamily: "'DM Mono', monospace", marginTop: "0.2rem" }}>
                                {fmtSalary(min)} – {fmtSalary(max)}
                              </div>
                              <div style={{ fontSize: "0.65rem", color: "#555", fontFamily: "'DM Mono', monospace" }}>avg · range</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* SUBMIT VIEW */}
        {view === "submit" && (
          <div style={{ maxWidth: "500px", margin: "0 auto" }}>
            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: "700", marginBottom: "0.4rem" }}>Share Your Salary</h2>
              <p style={{ color: "#666", fontSize: "0.85rem", lineHeight: 1.6 }}>All submissions are completely anonymous. No account, no tracking — just helping your fellow Bermudians get paid fairly.</p>
            </div>

            {submitted ? (
              <div style={{ textAlign: "center", padding: "3rem", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: "12px" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✓</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.2rem", color: "#C9A84C", fontWeight: "700" }}>Thank you!</div>
                <div style={{ fontSize: "0.82rem", color: "#888", marginTop: "0.4rem" }}>Your submission has been added to the database.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                <div className="field">
                  <label>Job Title</label>
                  <input {...inp("title")} className={errors.title ? "has-err" : ""} placeholder="e.g. Software Engineer" />
                  {errors.title && <span className="err">{errors.title}</span>}
                </div>
                <div className="field">
                  <label>Annual Salary (BMD / USD)</label>
                  <input {...inp("salary")} className={errors.salary ? "has-err" : ""} type="number" placeholder="e.g. 85000" />
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
                {submitError && <div style={{ fontSize: "0.8rem", color: "#E07070", textAlign: "center" }}>{submitError}</div>}
                <button className="btn-gold" onClick={handleSubmit} disabled={submitting} style={{ marginTop: "0.5rem", width: "100%" }}>
                  {submitting ? "Submitting…" : "Submit Anonymously"}
                </button>
                <p style={{ fontSize: "0.72rem", color: "#555", textAlign: "center", fontFamily: "'DM Mono', monospace" }}>No personal data is collected. Ever.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
