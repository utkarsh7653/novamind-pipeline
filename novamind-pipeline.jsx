import React, { useState, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════ */
const PERSONAS = [
  { id:"creative_agency",    label:"Creative Agency Owners",  emoji:"🎨", short:"Agency",    color:"#f0a500", colorDim:"rgba(240,165,0,0.12)",  listId:"list_cre_001", desc:"Decision-makers at boutique agencies (5–50 people)",        tone:"ROI-focused, strategic, time-starved",      count:847  },
  { id:"freelance_designer", label:"Freelance Designers",     emoji:"✏️", short:"Freelance", color:"#7c6fff", colorDim:"rgba(124,111,255,0.12)", listId:"list_frl_001", desc:"Independent creative professionals building their practice", tone:"Practical, tool-obsessed, value-conscious", count:1243 },
  { id:"marketing_manager",  label:"Marketing Managers",      emoji:"📈", short:"Marketing", color:"#00c896", colorDim:"rgba(0,200,150,0.12)",   listId:"list_mkt_001", desc:"Growth-focused SMB marketers at 10–200 person companies",  tone:"Data-driven, conversion-oriented",          count:612  },
];

const MOCK_CONTACTS = [
  { id:"c001", name:"Sarah Chen",    email:"sarah@pixelstudio.co",    company:"Pixel Studio",  persona:"creative_agency",    title:"Founder & CD"     },
  { id:"c002", name:"James Okafor",  email:"james@brightwave.agency", company:"Brightwave",    persona:"creative_agency",    title:"Creative Director" },
  { id:"c003", name:"Marcus Webb",   email:"marcus@mwdesign.io",      company:"Self-Employed", persona:"freelance_designer", title:"Brand Designer"   },
  { id:"c004", name:"Luna Park",     email:"luna@lunavisuals.com",    company:"Luna Visuals",  persona:"freelance_designer", title:"UI/UX Freelancer"  },
  { id:"c005", name:"Priya Sharma",  email:"priya@growthco.com",      company:"GrowthCo",      persona:"marketing_manager",  title:"Head of Marketing" },
  { id:"c006", name:"Daniel Torres", email:"daniel@scalehq.io",       company:"ScaleHQ",       persona:"marketing_manager",  title:"Growth Manager"   },
];

const MOCK_METRICS = {
  creative_agency:    { open:0.42, click:0.18, unsub:0.008, sent:847  },
  freelance_designer: { open:0.38, click:0.21, unsub:0.005, sent:1243 },
  marketing_manager:  { open:0.51, click:0.14, unsub:0.012, sent:612  },
};

const SEED_HISTORY = [
  { id:"nm_wk46_20260406", weekNum:46, sendDate:"2026-04-06", blogTitle:"Automating Client Onboarding: A Creative Agency Guide",   topic:"client onboarding automation for creative agencies",  savedAt:"2026-04-06T14:00:00Z", metrics:{ creative_agency:{open:0.38,click:0.15,unsub:0.009,sent:831}, freelance_designer:{open:0.41,click:0.19,unsub:0.004,sent:1198}, marketing_manager:{open:0.45,click:0.12,unsub:0.010,sent:601} } },
  { id:"nm_wk45_20260330", weekNum:45, sendDate:"2026-03-30", blogTitle:"Why Small Agencies Are Winning with No-Code AI",          topic:"no-code AI tools for small creative agencies",         savedAt:"2026-03-30T14:00:00Z", metrics:{ creative_agency:{open:0.35,click:0.13,unsub:0.011,sent:819}, freelance_designer:{open:0.36,click:0.17,unsub:0.006,sent:1176}, marketing_manager:{open:0.48,click:0.16,unsub:0.008,sent:589} } },
  { id:"nm_wk44_20260323", weekNum:44, sendDate:"2026-03-23", blogTitle:"The Hidden Cost of Manual Workflows in Creative Teams",   topic:"manual workflow costs creative agencies",              savedAt:"2026-03-23T14:00:00Z", metrics:{ creative_agency:{open:0.40,click:0.17,unsub:0.007,sent:810}, freelance_designer:{open:0.33,click:0.14,unsub:0.008,sent:1155}, marketing_manager:{open:0.44,click:0.11,unsub:0.013,sent:577} } },
];

const WEEK_NUM  = 47;
const SEND_DATE = "2026-04-13";
const HS_BASE   = "https://api.hubapi.com";
const BEARER    = "CJTx4...••••••••••[redacted]";

const CRM_PHASES = [
  { id:"auth",     label:"OAuth Token",     icon:"🔐", desc:"Refresh HubSpot OAuth 2.0 access token." },
  { id:"contacts", label:"Upsert Contacts", icon:"👥", desc:"Batch upsert 2,702 contacts with persona tags." },
  { id:"emails",   label:"Create Emails",   icon:"✉️",  desc:"Create one BATCH_EMAIL draft per persona segment." },
  { id:"schedule", label:"Schedule Send",   icon:"📅", desc:"Schedule each draft for 2026-04-13 14:00 UTC." },
  { id:"log",      label:"Log Campaign",    icon:"📋", desc:"Write campaign metadata to CRM custom object." },
];

/* ═══════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════ */
const SK_IDX = "nm:idx"; const sk = id => `nm:c:${id}`;

async function storageInit() {
  try { await window.storage.get(SK_IDX); } catch {
    for (const c of SEED_HISTORY) await window.storage.set(sk(c.id), JSON.stringify(c));
    await window.storage.set(SK_IDX, JSON.stringify(SEED_HISTORY.map(c=>c.id)));
  }
}

async function storageLoad() {
  try {
    const ids = JSON.parse((await window.storage.get(SK_IDX)).value);
    const out = [];
    for (const id of ids) { try { out.push(JSON.parse((await window.storage.get(sk(id))).value)); } catch {} }
    return out.sort((a,b)=>new Date(b.savedAt)-new Date(a.savedAt));
  } catch { return SEED_HISTORY; }
}

async function storageSave(c) {
  try {
    await window.storage.set(sk(c.id), JSON.stringify(c));
    let ids=[]; try { ids=JSON.parse((await window.storage.get(SK_IDX)).value); } catch {}
    if (!ids.includes(c.id)) { ids.unshift(c.id); await window.storage.set(SK_IDX,JSON.stringify(ids)); }
  } catch {}
}

/* ═══════════════════════════════════════════════════
   CRM BUILDERS
═══════════════════════════════════════════════════ */
const eid = pid => `em_${pid.slice(0,3)}_${WEEK_NUM}`;

function buildReq(phaseId, content, pIdx) {
  const p=PERSONAS[pIdx], nl=content?.newsletters?.[p?.id];
  switch(phaseId) {
    case "auth":     return { method:"POST", url:`${HS_BASE}/oauth/v1/token`, headers:{"Content-Type":"application/x-www-form-urlencoded"}, bodyRaw:`grant_type=refresh_token\n&client_id=nm_hs_client_a4f2b8\n&client_secret=•••••••\n&refresh_token=•••••••` };
    case "contacts": return { method:"POST", url:`${HS_BASE}/crm/v3/objects/contacts/batch/upsert`, headers:{"Authorization":`Bearer ${BEARER}`,"Content-Type":"application/json"}, body:{ inputs:[...MOCK_CONTACTS.slice(0,3).map(c=>({ idProperty:"email", id:c.email, properties:{ firstname:c.name.split(" ")[0], lastname:c.name.split(" ")[1]||"", email:c.email, company:c.company, jobtitle:c.title, novamind_persona:c.persona, novamind_list_id:PERSONAS.find(pp=>pp.id===c.persona)?.listId, novamind_subscribed:true } })),{"_note":"+ 2,699 contacts omitted"}] }};
    case "emails":   return { method:"POST", url:`${HS_BASE}/marketing/v3/emails`, headers:{"Authorization":`Bearer ${BEARER}`,"Content-Type":"application/json"}, body:{ name:`NovaMind Wk${WEEK_NUM}—${p?.label}`, type:"BATCH_EMAIL", content:{ from:{name:"NovaMind",email:"hello@novamind.ai"}, subject:nl?.subject||"", previewText:nl?.preview||"", htmlBody:`<h2>${content?.blog?.title||""}</h2><p>${nl?.body||""}</p>` }, filters:{contactLists:{include:[{listId:p?.listId}]}}, metaData:{campaignWeek:WEEK_NUM,personaSegment:p?.id} }};
    case "schedule": return { method:"POST", url:`${HS_BASE}/marketing/v3/emails/${eid(p?.id)}/schedule`, headers:{"Authorization":`Bearer ${BEARER}`,"Content-Type":"application/json"}, body:{publishDate:`${SEND_DATE}T14:00:00.000Z`} };
    case "log":      return { method:"POST", url:`${HS_BASE}/crm/v3/objects/campaign_logs`, headers:{"Authorization":`Bearer ${BEARER}`,"Content-Type":"application/json"}, body:{ properties:{ blog_title:content?.blog?.title||"—", campaign_week:String(WEEK_NUM), send_date:SEND_DATE, emails_created:PERSONAS.map(p=>eid(p.id)).join(", "), total_recipients:PERSONAS.reduce((a,p)=>a+p.count,0), status:"SENT" }}};
    default: return null;
  }
}

function buildResp(phaseId, content, pIdx, sent) {
  if (!sent) return null;
  const p=PERSONAS[pIdx];
  switch(phaseId) {
    case "auth":     return { access_token:"CJTx4...••••[redacted]", token_type:"bearer", expires_in:1800, scope:"crm.objects.contacts.write marketing.email.send" };
    case "contacts": return { status:"COMPLETE", results:MOCK_CONTACTS.slice(0,3).map((c,i)=>({ id:String(12847653+i), properties:{email:c.email,novamind_persona:c.persona}, updatedAt:`${SEND_DATE}T13:58:2${i}Z` })), numErrors:0, completedAt:`${SEND_DATE}T13:58:23Z` };
    case "emails":   return { id:eid(p?.id), state:"DRAFT", type:"BATCH_EMAIL", stats:{recipientCount:p?.count}, createdAt:`${SEND_DATE}T13:58:24Z` };
    case "schedule": return { id:eid(p?.id), state:"SCHEDULED", publishDate:`${SEND_DATE}T14:00:00Z`, stats:{recipientCount:p?.count} };
    case "log":      return { id:`clog_${SEND_DATE.replace(/-/g,"")}_wk${WEEK_NUM}`, properties:{ blog_title:content?.blog?.title||"—", status:"SENT" }, createdAt:`${SEND_DATE}T14:00:12Z` };
    default: return null;
  }
}

/* ═══════════════════════════════════════════════════
   PROMPTS
═══════════════════════════════════════════════════ */
const P = {
  blog: t => `You are a content strategist at NovaMind (AI startup for creative agency automation).
Topic: "${t}"
Return ONLY valid JSON, no markdown fences:
{"title":"compelling title <70 chars","meta_description":"SEO desc <140 chars","outline":["Section 1: point","Section 2: point","Section 3: point","Section 4: CTA"],"draft":"Three paragraphs ~200 words. Plain text, no headers, paragraphs separated by \\n\\n."}`,

  newsletters: t => `You are a content strategist at NovaMind (AI startup for creative agency automation).
Blog: "${t}"
Return ONLY valid JSON, no markdown fences:
{"creative_agency":{"subject":"<60 chars","preview":"<55 chars","body":"~70 words, ROI angle for Agency Owners"},"freelance_designer":{"subject":"<60 chars","preview":"<55 chars","body":"~70 words, practical tip for Freelance Designers"},"marketing_manager":{"subject":"<60 chars","preview":"<55 chars","body":"~70 words, metrics angle for Marketing Managers"}}`,

  singleNL: (t, persona) => `NovaMind content strategist. Blog: "${t}". Audience: ${persona.label} (${persona.tone}).
Return ONLY valid JSON, no fences:
{"subject":"<60 chars","preview":"<55 chars","body":"70-80 words for ${persona.label}: ${persona.tone}"}`,

  variants: (t, persona) => `NovaMind content strategist. Blog: "${t}". Audience: ${persona.label} (${persona.tone}).
Generate 3 newsletter versions, each a DIFFERENT persuasion angle. Return ONLY valid JSON, no fences:
{"variants":[{"angle":"ROI & Urgency","subject":"<60 chars","preview":"<55 chars","body":"~65 words, urgency + ROI framing"},{"angle":"Story & Social Proof","subject":"<60 chars","preview":"<55 chars","body":"~65 words, story + proof framing"},{"angle":"Practical How-To","subject":"<60 chars","preview":"<55 chars","body":"~65 words, actionable steps framing"}]}`,

  revise: (t, persona, current, feedback) => `NovaMind content strategist. Blog: "${t}". Audience: ${persona.label}.
Current newsletter copy:
Subject: ${current.subject}
Body: ${current.body}
Revision feedback: "${feedback}"
Apply the feedback and improve the copy. Return ONLY valid JSON, no fences:
{"subject":"revised subject <60 chars","preview":"revised preview <55 chars","body":"revised body 65-80 words applying the feedback"}`,

  headlines: (title, topic) => `NovaMind content strategist. Current blog title: "${title}". Topic: "${topic}".
Generate 4 alternative headline options with different angles. Return ONLY valid JSON, no fences:
{"headlines":[{"text":"headline option","angle":"SEO-optimized"},{"text":"headline option","angle":"Curiosity-driven"},{"text":"headline option","angle":"Benefit-first"},{"text":"headline option","angle":"Contrarian take"}]}`,

  insights: (blogTitle, metrics) => `Marketing analytics AI for NovaMind.
Campaign: "${blogTitle}"
Metrics: ${metrics}
Write exactly 3 paragraphs (no headers, no bullets, <220 words):
1. Which segment led and why — cite specific numbers
2. One content recommendation per segment based on the signals
3. Two concrete next steps: one content format and one distribution change`,

  topics: (blogTitle, bestSeg, metrics, history) => `NovaMind content strategist suggesting next blog topics.
Current campaign: "${blogTitle}" | Best segment: ${bestSeg}
Recent history: ${history}
Metrics: ${metrics}
Return ONLY valid JSON, no fences:
{"suggestions":[{"topic":"specific topic","headline":"compelling headline for this topic","rationale":"one sentence why this will perform well based on the data"},{"topic":"...","headline":"...","rationale":"..."},{"topic":"...","headline":"...","rationale":"..."}]}`,
};

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
async function ai(msg, retries=1) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{role:"user",content:msg}] }) });
    const d = await r.json();
    if (d.error) throw new Error(d.error.message||JSON.stringify(d.error));
    return d;
  } catch(e) { if (retries>0) return ai(msg,retries-1); throw e; }
}
async function aiJSON(msg) {
  const data = await ai(msg);
  const raw  = data.content.find(b => b.type === "text")?.text || "";
  return JSON.parse(raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").trim());
}
async function aiText(msg) {
  const data = await ai(msg);
  return data.content.find(b => b.type === "text")?.text || "";
}
const wc = s => s?s.trim().split(/\s+/).filter(Boolean).length:0;
const wMet = (key,M) => { const T=PERSONAS.reduce((a,p)=>a+M[p.id].sent,0); return PERSONAS.reduce((a,p)=>a+M[p.id][key]*M[p.id].sent,0)/T; };
const trnd = (c,p) => { const d=c-p; return Math.abs(d)<0.001?"—":d>0?`↑ +${(d*100).toFixed(1)}pp`:`↓ −${(Math.abs(d)*100).toFixed(1)}pp`; };
const hl = o => JSON.stringify(o,null,2).replace(/("[\w_]+")\s*:/g,'<span style="color:#7c6fff">$1</span>:').replace(/: ("[^"]*")/g,': <span style="color:#f0a500">$1</span>').replace(/: (true|false|\d+\.?\d*)/g,': <span style="color:#00c896">$1</span>').replace(/[{}\[\]]/g,m=>`<span style="color:#555580">${m}</span>`);
async function cp(text, cb) { try { await navigator.clipboard.writeText(text); cb(); } catch {} }

/* ═══════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#07070d;--surf:#0e0e1a;--card:#14141f;--b:#22223a;--acc:#f0a500;--a2:#7c6fff;--a3:#00c896;--red:#ff5060;--txt:#ddddf5;--mut:#7070a0;--fh:'Syne',sans-serif;--fb:'DM Sans',sans-serif;--fm:'JetBrains Mono',monospace}
.app{min-height:100vh;background:var(--bg);color:var(--txt);font-family:var(--fb);font-size:14px;line-height:1.5}
/* header */
.hdr{display:flex;align-items:center;justify-content:space-between;padding:13px 28px;background:var(--surf);border-bottom:1px solid var(--b)}
.logo{font-family:var(--fh);font-size:18px;font-weight:800;letter-spacing:-0.5px} .logo em{color:var(--acc);font-style:normal}
.logo-sub{font-family:var(--fm);font-size:10px;color:var(--mut);margin-top:1px}
.live{display:flex;align-items:center;gap:6px;font-family:var(--fm);font-size:11px;color:var(--mut)}
.dot{width:6px;height:6px;border-radius:50%;background:var(--a3);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
/* nav */
.nav{display:flex;align-items:center;background:var(--surf);border-bottom:1px solid var(--b);padding:0 24px;overflow-x:auto;gap:0}
.ns{display:flex;align-items:center;gap:8px;padding:14px 18px;cursor:pointer;font-size:13px;font-weight:500;color:var(--mut);border-bottom:2px solid transparent;transition:.15s;white-space:nowrap;user-select:none}
.ns.active{color:var(--acc);border-bottom-color:var(--acc)} .ns.done{color:var(--txt)} .ns.locked{opacity:.35;cursor:not-allowed}
.sn{width:20px;height:20px;border-radius:50%;border:1.5px solid currentColor;display:flex;align-items:center;justify-content:center;font-family:var(--fm);font-size:10px;flex-shrink:0}
.ns.done .sn{background:var(--a3);border-color:var(--a3);color:#000} .ns.active .sn{background:var(--acc);border-color:var(--acc);color:#000}
.narr{color:var(--b);padding:0 2px;font-size:16px}
/* layout */
.main{max-width:1100px;margin:0 auto;padding:32px 24px}
.stitle{font-family:var(--fh);font-size:24px;font-weight:800;margin-bottom:4px}
.ssub{color:var(--mut);margin-bottom:24px;font-size:13px}
.card{background:var(--card);border:1px solid var(--b);border-radius:12px;padding:20px}
.g2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px}
.g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
/* form */
.inp{width:100%;background:var(--surf);border:1px solid var(--b);border-radius:8px;padding:11px 14px;color:var(--txt);font-family:var(--fb);font-size:14px;outline:none;transition:border-color .15s}
.inp:focus{border-color:var(--acc)} .inp::placeholder{color:var(--mut)}
.ta{resize:vertical;min-height:140px;line-height:1.65;font-size:13px} .ta:focus{border-color:var(--a2)}
/* buttons */
.btn{padding:10px 18px;border-radius:8px;border:none;cursor:pointer;font-family:var(--fb);font-size:13px;font-weight:600;transition:.15s;display:inline-flex;align-items:center;gap:7px}
.btn:disabled{opacity:.45;cursor:not-allowed} .btn-p{background:var(--acc);color:#000} .btn-p:not(:disabled):hover{background:#d49200}
.btn-s{background:transparent;color:var(--txt);border:1px solid var(--b)} .btn-s:not(:disabled):hover{border-color:var(--mut)}
.btn-xs{padding:5px 11px;font-size:11px;border-radius:6px} .btn-a{background:rgba(124,111,255,.15);color:var(--a2);border:1px solid rgba(124,111,255,.3);} .btn-a:not(:disabled):hover{background:rgba(124,111,255,.25)}
.ghost{background:transparent;color:var(--mut);border:1px solid var(--b);padding:5px 10px;font-size:11px;border-radius:6px;cursor:pointer;font-family:var(--fb);transition:.15s}
.ghost:hover{color:var(--txt);border-color:var(--mut)} .ghost.ok{color:var(--a3);border-color:var(--a3)}
/* labels */
.lbl{font-family:var(--fm);font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--mut);margin-bottom:6px}
.sec{font-family:var(--fh);font-size:15px;font-weight:700;margin-bottom:12px} .fhdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:7px}
/* dashboard */
.dash-hero{background:linear-gradient(135deg,rgba(240,165,0,.08),rgba(124,111,255,.06));border:1px solid rgba(240,165,0,.2);border-radius:16px;padding:32px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.dash-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:24px}
.kpi{background:var(--card);border:1px solid var(--b);border-radius:10px;padding:16px}
.kpi-val{font-family:var(--fh);font-size:26px;font-weight:800;margin:5px 0 2px}
.kpi-sub{font-size:11px;color:var(--mut)}
.hist-row{display:flex;align-items:center;gap:0;padding:11px 14px;border-bottom:1px solid var(--b);transition:.1s}
.hist-row:last-child{border-bottom:none} .hist-row:hover{background:rgba(255,255,255,.02)}
.hist-wk{font-family:var(--fm);font-size:10px;color:var(--mut);width:44px;flex-shrink:0}
.hist-title{flex:1;font-size:12px;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hist-met{font-family:var(--fm);font-size:11px;width:48px;text-align:right;flex-shrink:0}
.hist-tr{font-family:var(--fm);font-size:10px;width:56px;text-align:right;flex-shrink:0}
.tup{color:var(--a3)} .tdn{color:var(--red)} .teq{color:var(--mut)}
/* gen progress */
.gp{display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(240,165,0,.07);border:1px solid rgba(240,165,0,.2);border-radius:8px;margin-top:12px}
.gpdots{display:flex;gap:5px} .gpdot{width:6px;height:6px;border-radius:50%;background:var(--b)}
.gpdot.on{background:var(--acc);animation:pulse .8s infinite} .gpdot.dn{background:var(--a3)}
/* persona */
.pc{background:var(--surf);border:1px solid var(--b);border-radius:10px;padding:16px}
.psel{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
.pbtn{padding:6px 13px;border-radius:20px;border:1px solid var(--b);background:transparent;cursor:pointer;font-size:11px;color:var(--mut);transition:.15s;font-family:var(--fb)}
.nl-meta{display:flex;align-items:center;gap:8px;padding:9px 12px;background:var(--surf);border-radius:8px;margin-bottom:12px;flex-wrap:wrap;font-size:11px;font-family:var(--fm);color:var(--mut)}
.regen{margin-left:auto;display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:6px;border:1px solid var(--b);background:transparent;cursor:pointer;font-size:11px;color:var(--mut);font-family:var(--fb);transition:.15s}
.regen:hover{border-color:var(--a2);color:var(--a2)} .regen:disabled{opacity:.4;cursor:not-allowed}
/* variants */
.vgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
.vc{background:var(--surf);border:1px solid var(--b);border-radius:10px;padding:14px;cursor:pointer;transition:.15s}
.vc.sel{border-color:var(--a2);background:rgba(124,111,255,.06)} .vc:hover:not(.sel){border-color:var(--mut)}
.vangle{font-family:var(--fm);font-size:9px;color:var(--a2);margin-bottom:7px;text-transform:uppercase;letter-spacing:1px}
.vsubj{font-weight:600;font-size:11px;margin-bottom:5px;line-height:1.4;color:var(--txt)}
.vbody{font-size:11px;color:var(--mut);line-height:1.55;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.vapply{margin-top:10px;width:100%;padding:5px;background:transparent;border:1px solid var(--b);border-radius:5px;cursor:pointer;font-size:10px;color:var(--mut);font-family:var(--fb);transition:.15s}
.vapply:hover{border-color:var(--a2);color:var(--a2)} .vc.sel .vapply{background:var(--a2);border-color:var(--a2);color:#fff;font-weight:600}
.rev-iter{font-family:var(--fm);font-size:10px;color:var(--mut);padding:2px 7px;border-radius:4px;border:1px solid var(--b)}
/* headline cards */
.hgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
.hcard{background:var(--surf);border:1px solid var(--b);border-radius:9px;padding:13px;cursor:pointer;transition:.15s}
.hcard:hover{border-color:var(--acc)} .hcard.sel{border-color:var(--acc);background:rgba(240,165,0,.05)}
.hangle{font-family:var(--fm);font-size:9px;color:var(--acc);margin-bottom:5px;text-transform:uppercase;letter-spacing:1px}
.htxt{font-size:12px;font-weight:600;line-height:1.4;color:var(--txt)}
/* topic cards */
.tgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
.tcard{background:var(--surf);border:1px solid var(--b);border-radius:10px;padding:14px}
.thead{font-weight:600;font-size:12px;margin-bottom:5px;color:var(--txt);line-height:1.4}
.trat{font-size:11px;color:var(--mut);line-height:1.6;margin-bottom:10px}
.tuse{width:100%;padding:6px;background:transparent;border:1px solid var(--b);border-radius:5px;cursor:pointer;font-size:11px;color:var(--mut);font-family:var(--fb);transition:.15s}
.tuse:hover{border-color:var(--acc);color:var(--acc)}
/* CRM */
.crm-phases{display:flex;border:1px solid var(--b);border-radius:10px;overflow:hidden;margin-bottom:18px}
.crm-ph{flex:1;padding:12px 6px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;background:var(--surf);border-right:1px solid var(--b);transition:.15s;text-align:center}
.crm-ph:last-child{border-right:none} .crm-ph:hover{background:var(--card)}
.crm-ph.sel{background:var(--card);box-shadow:inset 0 -2px 0 var(--acc)}
.phbadge{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--fm);font-size:10px;border:1.5px solid var(--b);color:var(--mut)}
.crm-ph.running .phbadge{border-color:var(--acc);color:var(--acc);animation:pulse .8s infinite}
.crm-ph.done .phbadge{background:var(--a3);border-color:var(--a3);color:#000}
.phlbl{font-size:10px;font-weight:500;color:var(--mut)} .crm-ph.sel .phlbl,.crm-ph.done .phlbl{color:var(--txt)} .crm-ph.running .phlbl{color:var(--acc)}
.http-hdr{display:flex;align-items:center;gap:8px;padding:9px 13px;background:#040408;border:1px solid var(--b);border-bottom:none;border-radius:8px 8px 0 0}
.meth{font-family:var(--fm);font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(124,111,255,.2);color:var(--a2)}
.htabs{display:flex;background:#040408;border-left:1px solid var(--b);border-right:1px solid var(--b)}
.htab{padding:6px 14px;font-family:var(--fm);font-size:11px;cursor:pointer;color:var(--mut);border-bottom:2px solid transparent;transition:.15s}
.htab.active{color:var(--acc);border-bottom-color:var(--acc)}
.code{background:#040408;border:1px solid var(--b);border-top:none;border-radius:0 0 8px 8px;padding:13px;font-family:var(--fm);font-size:10.5px;color:#9090c0;overflow:auto;white-space:pre;line-height:1.8;max-height:260px}
/* terminal */
.log{background:#030308;border:1px solid var(--b);border-radius:8px;padding:12px;font-family:var(--fm);font-size:10.5px;min-height:120px;max-height:200px;overflow-y:auto;line-height:2}
.ll{display:flex;gap:10px} .lt{color:var(--mut);flex-shrink:0} .lv{color:var(--a3)}
.bcur{display:inline-block;width:7px;height:12px;background:var(--a3);animation:blink 1s step-start infinite;vertical-align:middle}
@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}
/* metrics */
.mcard{background:var(--card);border:1px solid var(--b);border-radius:10px;padding:16px}
.mval{font-family:var(--fh);font-size:28px;font-weight:700;margin:5px 0 2px} .msub{font-size:11px;color:var(--mut)}
.brow{display:flex;align-items:center;gap:10px;margin-bottom:9px}
.blbl{font-size:11px;width:150px;flex-shrink:0;color:var(--mut)}
.btrack{flex:1;height:6px;background:var(--surf);border-radius:4px;overflow:hidden}
.bfill{height:100%;border-radius:4px;transition:width 1.2s cubic-bezier(.4,0,.2,1)}
.bval{font-family:var(--fm);font-size:11px;width:40px;text-align:right}
/* table */
.ct{width:100%;border-collapse:collapse} .ct th{text-align:left;padding:7px 13px;font-family:var(--fm);font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--mut);border-bottom:1px solid var(--b)}
.ct td{padding:9px 13px;border-bottom:1px solid rgba(34,34,58,.4);font-size:12px} .ct tr:last-child td{border-bottom:none}
/* misc */
.badge{display:inline-flex;align-items:center;gap:3px;font-size:9px;font-family:var(--fm);padding:2px 7px;border-radius:20px;border:1px solid}
.err{background:rgba(255,80,96,.1);border:1px solid rgba(255,80,96,.25);border-radius:8px;padding:10px 14px;color:var(--red);font-size:11px;margin-top:10px;font-family:var(--fm);word-break:break-all}
.ok-b{background:rgba(0,200,150,.1);border:1px solid rgba(0,200,150,.25);border-radius:8px;padding:12px 16px;color:var(--a3);font-size:13px}
.spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.15);border-top-color:currentColor;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
.loading{display:flex;align-items:center;gap:9px;color:var(--mut);font-size:13px}
.actions{display:flex;gap:10px;justify-content:flex-end;margin-top:24px}
.empty{color:var(--mut);font-size:12px;text-align:center;padding:20px 0}
.ibody{font-size:13px;line-height:1.85;color:var(--txt)} .ibody p{margin-bottom:12px} .ibody p:last-child{margin-bottom:0}
.saved-tag{display:inline-flex;align-items:center;gap:4px;font-family:var(--fm);font-size:10px;padding:3px 9px;border-radius:20px;background:rgba(0,200,150,.12);color:var(--a3);border:1px solid rgba(0,200,150,.25)}
.ph-desc{font-size:12px;color:var(--mut);line-height:1.6;margin-bottom:12px;padding:9px 12px;background:var(--surf);border-radius:7px;border-left:2px solid var(--acc)}
.seg-row{display:flex;gap:8px;margin-bottom:18px}
.seg-c{flex:1;background:var(--surf);border:1px solid var(--b);border-top-width:2px;border-radius:8px;padding:12px}
.outline-i{display:flex;gap:9px;padding:5px 0;border-bottom:1px solid rgba(34,34,58,.4);font-size:12px;color:var(--mut)}
.outline-i:last-child{border-bottom:none} .onum{font-family:var(--fm);color:var(--acc);font-size:10px;margin-top:1px;flex-shrink:0}
.cc{font-family:var(--fm);font-size:10px}
.divider{height:1px;background:var(--b);margin:18px 0}
.panel{background:var(--surf);border:1px solid var(--b);border-radius:12px;padding:18px;margin-top:18px}
.iter-badge{font-family:var(--fm);font-size:10px;padding:2px 8px;border-radius:4px;background:rgba(124,111,255,.15);color:var(--a2);border:1px solid rgba(124,111,255,.3)}
`;

/* ═══════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════ */
// Helper: renders a coloured trend arrow without IIFE
function TrendBadge({ val }) {
  if (!val || val === '—') return React.createElement('span', {className:'teq'}, '—');
  const cls = val.startsWith('↑') ? 'tup' : 'tdn';
  return <span className={cls}>{val}</span>;
}

export default function App() {
  // Navigation: 0=Dashboard, 1=Generate, 2=Review, 3=Distribute, 4=Analyze
  const [stage,        setStage]       = useState(0);
  const [topic,        setTopic]       = useState("AI tools for creative agency workflow automation");
  const [content,      setContent]     = useState(null);
  const [genStep,      setGenStep]     = useState(null);
  const [genError,     setGenError]    = useState(null);
  // Review state
  const [activeNL,     setActiveNL]    = useState("creative_agency");
  const [varP,         setVarP]        = useState("creative_agency");
  const [variants,     setVariants]    = useState({});        // {pid: [{angle,subject,preview,body}]}
  const [selVar,       setSelVar]      = useState({});        // {pid: idx}
  const [genVar,       setGenVar]      = useState(false);
  const [revNote,      setRevNote]     = useState({});        // {pid: string}
  const [revCount,     setRevCount]    = useState({});        // {pid: number}
  const [revisingNL,   setRevisingNL]  = useState(null);
  const [regenNL,      setRegenNL]     = useState(null);
  // Headline optimizer
  const [headlines,    setHeadlines]   = useState(null);
  const [genHL,        setGenHL]       = useState(false);
  const [selHL,        setSelHL]       = useState(null);
  // CRM state
  const [distLog,      setDistLog]     = useState([]);
  const [distributing, setDistrib]     = useState(false);
  const [sent,         setSent]        = useState(false);
  const [crmPhase,     setCrmPhase]    = useState("auth");
  const [crmView,      setCrmView]     = useState("request");
  const [crmSt,        setCrmSt]       = useState({auth:"idle",contacts:"idle",emails:"idle",schedule:"idle",log:"idle"});
  const [ePIdx,        setEPIdx]       = useState(0);
  // Analytics
  const [insights,     setInsights]    = useState(null);
  const [analyzing,    setAnalyzing]   = useState(false);
  const [saved,        setSaved]       = useState(false);
  const [topicSugs,    setTopicSugs]   = useState(null);
  const [genTopics,    setGenTopics]   = useState(false);
  // History
  const [history,      setHistory]     = useState([]);
  const [histLoaded,   setHistLoaded]  = useState(false);
  // Misc
  const [copied,       setCopied]      = useState(null);
  const logRef = useRef(null);

  useEffect(()=>{ storageInit().then(()=>storageLoad().then(h=>{ setHistory(h); setHistLoaded(true); })); },[]);
  useEffect(()=>{ if(logRef.current) logRef.current.scrollTop=logRef.current.scrollHeight; },[distLog]);

  const cpKey = (text,key) => cp(text,()=>{ setCopied(key); setTimeout(()=>setCopied(null),2000); });

  /* ── Dashboard helpers ── */
  const allCampaigns = history; // already sorted newest-first
  const avgOpen  = allCampaigns.length ? allCampaigns.reduce((a,c)=>a+wMet("open",c.metrics),0)/allCampaigns.length : 0;
  const bestSeg  = PERSONAS.reduce((a,b)=>MOCK_METRICS[b.id].open>MOCK_METRICS[a.id].open?b:a);

  /* ── Stage 1: Generate ── */
  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenError(null);
    try {
      setGenStep("blog");
      const blog = await aiJSON(P.blog(topic));
      setGenStep("newsletters");
      const newsletters = await aiJSON(P.newsletters(topic));
      setContent({ blog, newsletters });
      setVariants({}); setSelVar({}); setRevNote({}); setRevCount({}); setHeadlines(null); setSelHL(null);
      setStage(2);
    } catch(e) { setGenError(`Error: ${e.message}`); }
    finally { setGenStep(null); }
  }

  /* ── Stage 2: Regen single newsletter ── */
  async function handleRegen(pid) {
    const persona = PERSONAS.find(p=>p.id===pid);
    setRegenNL(pid);
    try {
      const nl = await aiJSON(P.singleNL(topic, persona));
      setContent(prev=>({...prev, newsletters:{...prev.newsletters,[pid]:nl}}));
      setRevCount(prev=>({...prev,[pid]:(prev[pid]||0)+1}));
    } catch {}
    finally { setRegenNL(null); }
  }

  /* ── Stage 2: Revise with feedback ── */
  async function handleRevise(pid) {
    const persona = PERSONAS.find(p=>p.id===pid);
    const current = content?.newsletters?.[pid];
    const note    = revNote[pid]||"";
    if (!note.trim()) return;
    setRevisingNL(pid);
    try {
      const nl = await aiJSON(P.revise(topic, persona, current, note));
      setContent(prev=>({...prev, newsletters:{...prev.newsletters,[pid]:nl}}));
      setRevCount(prev=>({...prev,[pid]:(prev[pid]||0)+1}));
      setRevNote(prev=>({...prev,[pid]:""}));
    } catch {}
    finally { setRevisingNL(null); }
  }

  /* ── Stage 2: Generate 3 variants ── */
  async function handleVariants() {
    const persona = PERSONAS.find(p=>p.id===varP);
    setGenVar(true);
    try {
      const data = await aiJSON(P.variants(topic, persona));
      setVariants(prev=>({...prev,[varP]:data.variants}));
    } catch {}
    finally { setGenVar(false); }
  }

  function applyVariant(pid, idx) {
    const v = variants[pid]?.[idx];
    if (!v) return;
    setContent(prev=>({...prev, newsletters:{...prev.newsletters,[pid]:{subject:v.subject,preview:v.preview,body:v.body}}}));
    setSelVar(prev=>({...prev,[pid]:idx}));
    setRevCount(prev=>({...prev,[pid]:(prev[pid]||0)+1}));
  }

  /* ── Stage 2: Headline optimizer ── */
  async function handleHeadlines() {
    setGenHL(true);
    try {
      const data = await aiJSON(P.headlines(content?.blog?.title||"", topic));
      setHeadlines(data.headlines);
    } catch {}
    finally { setGenHL(false); }
  }

  function applyHeadline(text) {
    setContent(prev=>({...prev, blog:{...prev.blog,title:text}}));
    setSelHL(text);
  }

  /* ── Stage 3: CRM distribution ── */
  async function handleDistribute() {
    setDistrib(true); setSent(false); setDistLog([]);
    setCrmSt({auth:"idle",contacts:"idle",emails:"idle",schedule:"idle",log:"idle"});
    const log = t => setDistLog(p=>[...p,{t,ts:new Date().toLocaleTimeString("en-US",{hour12:false})}]);
    const S   = (id,s) => setCrmSt(p=>({...p,[id]:s}));
    const w   = ms => new Promise(r=>setTimeout(r,ms));
    S("auth","running"); setCrmPhase("auth"); setCrmView("request");
    await w(600); log("POST /oauth/v1/token → access_token refreshed (expires_in: 1800s)"); S("auth","done"); setCrmView("response");
    await w(350); S("contacts","running"); setCrmPhase("contacts"); setCrmView("request");
    await w(850); log("POST /crm/v3/objects/contacts/batch/upsert → 2,702 contacts upserted (0 errors)");
    await w(300); log("novamind_persona + novamind_list_id applied to all records"); S("contacts","done"); setCrmView("response");
    await w(350); S("emails","running"); setCrmPhase("emails"); setCrmView("request");
    for (let i=0;i<PERSONAS.length;i++) { setEPIdx(i); await w(650); log(`POST /marketing/v3/emails → ${eid(PERSONAS[i].id)} created [${PERSONAS[i].label}]`); }
    S("emails","done"); setCrmView("response");
    await w(350); S("schedule","running"); setCrmPhase("schedule"); setCrmView("request");
    for (let i=0;i<PERSONAS.length;i++) { setEPIdx(i); await w(550); log(`POST /marketing/v3/emails/${eid(PERSONAS[i].id)}/schedule → SCHEDULED`); }
    S("schedule","done"); setCrmView("response");
    await w(350); S("log","running"); setCrmPhase("log"); setCrmView("request");
    await w(650); log(`POST /crm/v3/objects/campaign_logs → clog_${SEND_DATE.replace(/-/g,"")}_wk${WEEK_NUM}`); S("log","done"); setCrmView("response");
    setDistrib(false); setSent(true); log("✔ All 5 CRM phases complete. Campaign live.");
    // Auto-save after distribution
    const campaign = { id:`nm_wk${WEEK_NUM}_${SEND_DATE.replace(/-/g,"")}`, weekNum:WEEK_NUM, sendDate:SEND_DATE, blogTitle:content?.blog?.title||topic, topic, savedAt:new Date().toISOString(), metrics:MOCK_METRICS };
    await storageSave(campaign);
    const refreshed = await storageLoad();
    setHistory(refreshed); setSaved(true);
  }

  /* ── Stage 4: AI insights ── */
  async function handleInsights() {
    setAnalyzing(true);
    const ms = PERSONAS.map(p=>{ const m=MOCK_METRICS[p.id]; return `${p.label}: open=${(m.open*100).toFixed(1)}%, CTR=${(m.click*100).toFixed(1)}%, unsub=${(m.unsub*100).toFixed(2)}%, sent=${m.sent}`; }).join("\n");
    try { setInsights(await aiText(P.insights(content?.blog?.title||topic, ms))); }
    catch { setInsights("Analysis failed — please try again."); }
    finally { setAnalyzing(false); }
  }

  /* ── Stage 4: Topic suggestions ── */
  async function handleTopics() {
    setGenTopics(true);
    const ms  = PERSONAS.map(p=>{ const m=MOCK_METRICS[p.id]; return `${p.label}: open=${(m.open*100).toFixed(1)}%, CTR=${(m.click*100).toFixed(1)}%`; }).join("; ");
    const his = history.slice(0,3).map(h=>`Wk${h.weekNum}: "${h.blogTitle}"`).join(", ")||"(no prior campaigns)";
    try {
      const data = await aiJSON(P.topics(content?.blog?.title||topic, bestSeg.label, ms, his));
      setTopicSugs(data.suggestions);
    } catch { setTopicSugs([]); }
    finally { setGenTopics(false); }
  }

  /* ── Derived ── */
  const canAccess = s => s===0 || !!content;
  const generating = !!genStep;
  const activeP  = PERSONAS.find(p=>p.id===activeNL);
  const nl       = content?.newsletters?.[activeNL];
  const crmPh    = CRM_PHASES.find(ph=>ph.id===crmPhase);
  const req      = buildReq(crmPhase, content, (crmPhase==="emails"||crmPhase==="schedule")?ePIdx:0);
  const resp     = buildResp(crmPhase, content, (crmPhase==="emails"||crmPhase==="schedule")?ePIdx:0, sent);
  const showResp = crmSt[crmPhase]==="done"||sent;
  const totalSent = PERSONAS.reduce((a,p)=>a+MOCK_METRICS[p.id].sent,0);
  const wOpen  = wMet("open",MOCK_METRICS), wClick = wMet("click",MOCK_METRICS);
  const curV   = variants[varP]||[];

  function reqDisp(r) {
    if (!r) return "";
    const hd = Object.entries(r.headers||{}).map(([k,v])=>`<span style="color:#7c6fff">${k}</span>: <span style="color:#f0a500">${v}</span>`).join("\n");
    if (r.bodyRaw) return `${hd}\n\n${r.bodyRaw}`;
    return `${hd}\n\n${hl(r.body)}`;
  }

  const NAV = [
    {id:0,icon:"⊞",label:"Dashboard"},
    {id:1,icon:"⚡",label:"Generate"},
    {id:2,icon:"✎",label:"Review"},
    {id:3,icon:"◈",label:"Distribute"},
    {id:4,icon:"◎",label:"Analyze"},
  ];

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  return (
    <>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>
      <div className="app">

        {/* Header */}
        <header className="hdr">
          <div><div className="logo">Nova<em>Mind</em></div><div className="logo-sub">content_pipeline v2.1 // ai-powered marketing automation</div></div>
          <div className="live"><div className="dot"/>LIVE · {new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
        </header>

        {/* Nav */}
        <nav className="nav">
          {NAV.map((s,i)=>(
            <span key={s.id} style={{display:"flex",alignItems:"center"}}>
              <div className={`ns ${stage===s.id?"active":""} ${stage>s.id&&s.id>0?"done":""} ${!canAccess(s.id)?"locked":""}`}
                onClick={()=>canAccess(s.id)&&setStage(s.id)}>
                <div className="sn">{stage>s.id&&s.id>0?"✓":s.id===0?"⊞":s.id}</div>{s.icon} {s.label}
              </div>
              {i<NAV.length-1&&<div className="narr">›</div>}
            </span>
          ))}
        </nav>

        <main className="main">

          {/* ══ STAGE 0: DASHBOARD ══ */}
          {stage===0&&(
            <div>
              <div className="stitle">⊞ Dashboard</div>
              <div className="ssub">Your marketing pipeline at a glance. Monitor performance, browse history, and launch new campaigns.</div>

              {/* Hero */}
              <div className="dash-hero">
                <div>
                  <div style={{fontFamily:"var(--fh)",fontSize:20,fontWeight:800,marginBottom:8}}>
                    {content ? `Campaign in progress: Wk${WEEK_NUM}` : "Ready to generate your next campaign"}
                  </div>
                  <div style={{fontSize:13,color:"var(--mut)",marginBottom:16}}>
                    {content ? `Blog: "${content.blog.title}"` : "Enter a topic, generate AI content, distribute, and analyze — all from one pipeline."}
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    <button className="btn btn-p" onClick={()=>setStage(1)}>{content?"Continue Campaign →":"Start New Campaign →"}</button>
                    {content&&sent&&<button className="btn btn-s" onClick={()=>setStage(4)}>View Analytics →</button>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontFamily:"var(--fm)",fontSize:11,color:"var(--mut)",marginBottom:4}}>Pipeline status</div>
                  <div style={{display:"flex",gap:6}}>
                    {[{s:1,l:"Gen"},{s:2,l:"Rev"},{s:3,l:"Dist"},{s:4,l:"Ana"}].map(({s:st,l})=>{
                      const done = content&&(st<3||(st===3&&sent)||(st===4&&insights));
                      const active = stage===st;
                      return <div key={st} style={{width:44,height:44,borderRadius:8,background:done?"rgba(0,200,150,.15)":active?"rgba(240,165,0,.15)":"var(--card)",border:"1px solid "+(done?"var(--a3)":active?"var(--acc)":"var(--b)"),display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
                        <div style={{fontFamily:"var(--fm)",fontSize:9,color:done?"var(--a3)":active?"var(--acc)":"var(--mut)"}}>{done?"✓":active?"●":"○"}</div>
                        <div style={{fontFamily:"var(--fm)",fontSize:9,color:"var(--mut)"}}>{l}</div>
                      </div>;
                    })}
                  </div>
                </div>
              </div>

              {/* KPIs */}
              <div className="dash-kpis">
                {[
                  {lbl:"Campaigns Run",     val:allCampaigns.length+1, sub:"including current week",               color:"var(--txt)"   },
                  {lbl:"Avg Open Rate",     val:avgOpen>0?`${(avgOpen*100).toFixed(1)}%`:"—", sub:"across all past campaigns", color:"var(--acc)" },
                  {lbl:"Best Segment",      val:bestSeg.emoji,          sub:bestSeg.label+" leads engagement",      color:"var(--txt)"   },
                  {lbl:"Total Subscribers", val:totalSent.toLocaleString(), sub:"across 3 persona lists",          color:"var(--a3)"   },
                ].map(k=>(
                  <div className="kpi" key={k.lbl}>
                    <div className="lbl">{k.lbl}</div>
                    <div className="kpi-val" style={{color:k.color,fontSize:k.lbl==="Best Segment"?26:26}}>{k.val}</div>
                    <div className="kpi-sub">{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* Campaign history */}
              <div className="card" style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div className="sec" style={{margin:0}}>Campaign History</div>
                  <div style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)"}}>Persisted via window.storage</div>
                </div>
                {/* Column headers */}
                <div style={{display:"flex",padding:"0 14px 8px",borderBottom:"1px solid var(--b)"}}>
                  <div style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)",textTransform:"uppercase",letterSpacing:1,width:44,flexShrink:0}}>Wk</div>
                  <div style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)",textTransform:"uppercase",letterSpacing:1,flex:1}}>Blog Title</div>
                  <div style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)",textTransform:"uppercase",letterSpacing:1,width:56,textAlign:"right"}}>Open</div>
                  <div style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)",textTransform:"uppercase",letterSpacing:1,width:48,textAlign:"right"}}>CTR</div>
                  <div style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)",textTransform:"uppercase",letterSpacing:1,width:64,textAlign:"right"}}>vs Prior</div>
                </div>
                {/* Current */}
                <div className="hist-row" style={{background:"rgba(240,165,0,.04)"}}>
                  <div className="hist-wk" style={{color:"var(--acc)"}}>Wk{WEEK_NUM}</div>
                  <div className="hist-title">{content?.blog?.title||<span style={{color:"var(--mut)",fontStyle:"italic"}}>Not generated yet</span>}</div>
                  <div className="hist-met" style={{color:"var(--acc)"}}>{(wOpen*100).toFixed(1)}%</div>
                  <div className="hist-met" style={{color:"var(--acc)"}}>{(wClick*100).toFixed(1)}%</div>
                  <div className="hist-tr">
                    {allCampaigns.length>0 && <TrendBadge val={trnd(wOpen,wMet("open",allCampaigns[0].metrics))} />}
                  </div>
                </div>
                {allCampaigns.map((c,i)=>{
                  const o=wMet("open",c.metrics), ct=wMet("click",c.metrics);
                  const prev=allCampaigns[i+1]; const t=prev?trnd(o,wMet("open",prev.metrics)):"—";
                  return <div className="hist-row" key={c.id}>
                    <div className="hist-wk">Wk{c.weekNum}</div>
                    <div className="hist-title">{c.blogTitle}</div>
                    <div className="hist-met">{(o*100).toFixed(1)}%</div>
                    <div className="hist-met">{(ct*100).toFixed(1)}%</div>
                    <div className="hist-tr"><span className={t.startsWith("↑")?"tup":t.startsWith("↓")?"tdn":"teq"}>{t}</span></div>
                  </div>;
                })}
                {!histLoaded&&<div className="empty">Loading campaign history…</div>}
              </div>

              {/* Segment overview */}
              <div className="sec">Subscriber Segments</div>
              <div className="g3">
                {PERSONAS.map(p=>(
                  <div className="pc" key={p.id} style={{borderTop:`2px solid ${p.color}`}}>
                    <div style={{fontSize:20,marginBottom:8}}>{p.emoji}</div>
                    <div style={{fontWeight:600,fontSize:13,color:p.color,marginBottom:3}}>{p.label}</div>
                    <div style={{fontSize:11,color:"var(--mut)",marginBottom:8}}>{p.desc}</div>
                    <div style={{fontFamily:"var(--fm)",fontSize:11,color:"var(--mut)"}}>{p.count.toLocaleString()} subscribers · {p.listId}</div>
                    <div style={{marginTop:8,fontSize:10,fontFamily:"var(--fm)",padding:"2px 8px",borderRadius:4,background:p.colorDim,color:p.color,display:"inline-block"}}>{p.tone}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ STAGE 1: GENERATE ══ */}
          {stage===1&&(
            <div>
              <div className="stitle">⚡ Content Generation</div>
              <div className="ssub">Enter a weekly blog topic — Claude generates a blog draft and three persona-targeted newsletters in 2 API calls.</div>
              <div className="card" style={{marginBottom:20}}>
                <div className="lbl">Weekly Blog Topic</div>
                <input className="inp" value={topic} onChange={e=>setTopic(e.target.value)} disabled={generating}
                  placeholder="e.g. AI tools for creative agency workflow automation"
                  onKeyDown={e=>e.key==="Enter"&&!generating&&handleGenerate()}/>
                <div style={{marginTop:14}}>
                  <button className="btn btn-p" onClick={handleGenerate} disabled={generating||!topic.trim()}>
                    {generating?<><span className="spin" style={{borderTopColor:"#000"}}/>Generating…</>:"Generate Content →"}
                  </button>
                </div>
                {generating&&<div className="gp"><div className="gpdots"><div className={`gpdot ${genStep==="blog"?"on":genStep==="newsletters"?"dn":""}`}/><div className={`gpdot ${genStep==="newsletters"?"on":""}`}/></div><div style={{fontFamily:"var(--fm)",fontSize:11,color:"var(--acc)"}}>{genStep==="blog"?"Step 1/2 — Generating blog post…":"Step 2/2 — Generating newsletters…"}</div></div>}
                {genError&&<div className="err">{genError}</div>}
              </div>
              <div className="sec">Target Audience Segments</div>
              <div className="g3">
                {PERSONAS.map(p=>(
                  <div className="pc" key={p.id} style={{borderColor:`${p.color}30`}}>
                    <div style={{fontSize:20,marginBottom:8}}>{p.emoji}</div>
                    <div style={{fontWeight:600,fontSize:12,color:p.color,marginBottom:3}}>{p.label}</div>
                    <div style={{fontSize:11,color:"var(--mut)",marginBottom:8}}>{p.desc}</div>
                    <div style={{fontSize:10,fontFamily:"var(--fm)",padding:"2px 8px",borderRadius:4,background:p.colorDim,color:p.color,display:"inline-block"}}>{p.tone}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ STAGE 2: REVIEW ══ */}
          {stage===2&&content&&(
            <div>
              <div className="stitle">✎ Review & Edit</div>
              <div className="ssub">Edit any field, generate copy variants, revise with feedback, or optimize your headline before scheduling.</div>
              <div className="g2" style={{alignItems:"start"}}>

                {/* Blog column */}
                <div>
                  <div className="sec">Blog Post</div>
                  <div className="card">
                    <div className="fhdr">
                      <div className="lbl" style={{margin:0}}>Title</div>
                      <button className={`ghost ${copied==="bt"?"ok":""}`} onClick={()=>cpKey(content.blog.title,"bt")}>{copied==="bt"?"✓ Copied":"Copy"}</button>
                    </div>
                    <input className="inp" style={{fontSize:14,fontWeight:600,marginBottom:14}} value={content.blog.title}
                      onChange={e=>setContent(p=>({...p,blog:{...p.blog,title:e.target.value}}))}/>
                    <div className="lbl">Outline</div>
                    <div style={{marginBottom:14,background:"var(--surf)",borderRadius:8,padding:"4px 12px"}}>
                      {content.blog.outline.map((o,i)=><div className="outline-i" key={i}><span className="onum">{String(i+1).padStart(2,"0")}</span><span>{o}</span></div>)}
                    </div>
                    <div className="fhdr">
                      <div className="lbl" style={{margin:0}}>Draft · <span style={{color:wc(content.blog.draft)>=150?"var(--a3)":"var(--mut)"}}>{wc(content.blog.draft)}w</span></div>
                      <button className={`ghost ${copied==="bd"?"ok":""}`} onClick={()=>cpKey(content.blog.draft,"bd")}>{copied==="bd"?"✓ Copied":"Copy"}</button>
                    </div>
                    <textarea className="inp ta" style={{minHeight:200}} value={content.blog.draft}
                      onChange={e=>setContent(p=>({...p,blog:{...p.blog,draft:e.target.value}}))}/>
                    <div style={{marginTop:6,fontSize:10,color:"var(--mut)",fontFamily:"var(--fm)"}}>META: {content.blog.meta_description}</div>
                  </div>

                  {/* ── Headline Optimizer ── */}
                  <div className="panel">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div>
                        <div className="sec" style={{margin:0,marginBottom:2}}>Headline Optimizer</div>
                        <div style={{fontSize:11,color:"var(--mut)"}}>AI-generated headline alternatives with different angles. Click one to apply.</div>
                      </div>
                      <button className="btn btn-a btn-xs" onClick={handleHeadlines} disabled={genHL}>
                        {genHL?<><span className="spin"/>Generating…</>:headlines?"↺ Refresh":"Generate Alternatives →"}
                      </button>
                    </div>
                    {genHL&&<div className="loading"><div className="spin"/>Generating 4 headline options…</div>}
                    {headlines&&!genHL&&(
                      <div className="hgrid">
                        {headlines.map((h,i)=>(
                          <div key={i} className={`hcard ${selHL===h.text?"sel":""}`} onClick={()=>applyHeadline(h.text)}>
                            <div className="hangle">{h.angle}</div>
                            <div className="htxt">{h.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {!headlines&&!genHL&&<div className="empty" style={{padding:"12px 0"}}>Click "Generate Alternatives" to see AI headline options.</div>}
                  </div>
                </div>

                {/* Newsletter column */}
                <div>
                  <div className="sec">Newsletter Versions</div>
                  <div className="psel">
                    {PERSONAS.map(p=>(
                      <button key={p.id} className="pbtn" onClick={()=>setActiveNL(p.id)}
                        style={activeNL===p.id?{background:p.color,borderColor:p.color,color:"#000"}:{}}>
                        {p.emoji} {p.short} {revCount[p.id]>0&&<span className="iter-badge">v{(revCount[p.id]||0)+1}</span>}
                      </button>
                    ))}
                  </div>
                  <div className="card">
                    <div className="nl-meta">
                      <span>Audience: <span style={{color:activeP?.color}}>{activeP?.label}</span></span>
                      <span style={{marginLeft:8}}>Tone: {activeP?.tone}</span>
                      <button className="regen" disabled={!!regenNL||!!revisingNL} onClick={()=>handleRegen(activeNL)}>
                        {regenNL===activeNL?<><span className="spin" style={{width:11,height:11,borderTopColor:"var(--a2)"}}/>…</>:"↺ Regenerate"}
                      </button>
                    </div>
                    <div className="fhdr"><div className="lbl" style={{margin:0}}>Subject Line</div><span className="cc" style={{color:(nl?.subject||"").length>55?"var(--red)":"var(--mut)"}}>{(nl?.subject||"").length}/60</span></div>
                    <input className="inp" style={{marginBottom:11,fontSize:13}} value={nl?.subject||""} onChange={e=>setContent(p=>({...p,newsletters:{...p.newsletters,[activeNL]:{...p.newsletters[activeNL],subject:e.target.value}}}))}/>
                    <div className="fhdr"><div className="lbl" style={{margin:0}}>Preview Text</div><span className="cc" style={{color:(nl?.preview||"").length>50?"var(--red)":"var(--mut)"}}>{(nl?.preview||"").length}/55</span></div>
                    <input className="inp" style={{marginBottom:11,fontSize:12}} value={nl?.preview||""} onChange={e=>setContent(p=>({...p,newsletters:{...p.newsletters,[activeNL]:{...p.newsletters[activeNL],preview:e.target.value}}}))}/>
                    <div className="fhdr">
                      <div className="lbl" style={{margin:0}}>Body · <span style={{color:wc(nl?.body)>=60?"var(--a3)":"var(--mut)"}}>{wc(nl?.body)}w</span></div>
                      <button className={`ghost ${copied===`n-${activeNL}`?"ok":""}`} onClick={()=>cpKey(nl?.body||"",`n-${activeNL}`)}>{copied===`n-${activeNL}`?"✓ Copied":"Copy"}</button>
                    </div>
                    <textarea className="inp ta" style={{minHeight:160}} value={nl?.body||""} onChange={e=>setContent(p=>({...p,newsletters:{...p.newsletters,[activeNL]:{...p.newsletters[activeNL],body:e.target.value}}}))}/>

                    {/* Revision with feedback */}
                    <div className="divider"/>
                    <div className="lbl">Revision Notes</div>
                    <div style={{fontSize:11,color:"var(--mut)",marginBottom:7}}>Describe what to change — Claude will revise the copy above based on your feedback.</div>
                    <textarea className="inp ta" style={{minHeight:70,fontSize:12}} placeholder={`e.g. "Make it more urgent", "Focus on time savings", "Add a stat or number"`}
                      value={revNote[activeNL]||""} onChange={e=>setRevNote(prev=>({...prev,[activeNL]:e.target.value}))}/>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                      <button className="btn btn-a btn-xs" disabled={!revNote[activeNL]?.trim()||!!revisingNL||!!regenNL} onClick={()=>handleRevise(activeNL)}>
                        {revisingNL===activeNL?<><span className="spin"/>Revising…</>:"Apply Revision →"}
                      </button>
                      {revCount[activeNL]>0&&<span className="iter-badge">Revision {revCount[activeNL]}</span>}
                    </div>
                  </div>

                  {/* 3-variant picker */}
                  <div className="panel">
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div>
                        <div className="sec" style={{margin:0,marginBottom:2}}>Copy Variants</div>
                        <div style={{fontSize:11,color:"var(--mut)"}}>3 persuasion angles side-by-side. Pick one to apply to the editor above.</div>
                      </div>
                    </div>
                    <div className="psel" style={{marginBottom:8}}>
                      {PERSONAS.map(p=>(
                        <button key={p.id} className="pbtn" onClick={()=>setVarP(p.id)}
                          style={varP===p.id?{background:p.color,borderColor:p.color,color:"#000"}:{}}>
                          {p.emoji} {p.short}
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-s" onClick={handleVariants} disabled={genVar} style={{fontSize:12}}>
                      {genVar?<><span className="spin"/>Generating…</>:curV.length?"↺ New Variants":"Generate 3 Variants →"}
                    </button>
                    {curV.length>0&&(
                      <div className="vgrid">
                        {curV.map((v,i)=>(
                          <div key={i} className={`vc ${selVar[varP]===i?"sel":""}`} onClick={()=>applyVariant(varP,i)}>
                            <div className="vangle">{v.angle}</div>
                            <div className="vsubj">{v.subject}</div>
                            <div className="vbody">{v.body}</div>
                            <button className="vapply" onClick={e=>{e.stopPropagation();applyVariant(varP,i);}}>
                              {selVar[varP]===i?"✓ Applied":"Use This Version"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="actions">
                <button className="btn btn-s" onClick={()=>setStage(1)}>← Back</button>
                <button className="btn btn-p" onClick={()=>setStage(3)}>Approve & Schedule →</button>
              </div>
            </div>
          )}

          {/* ══ STAGE 3: DISTRIBUTE ══ */}
          {stage===3&&content&&(
            <div>
              <div className="stitle">◈ CRM Distribution</div>
              <div className="ssub">5-phase HubSpot integration. Click any phase to inspect the HTTP request/response. Campaign auto-saves to history after execution.</div>
              <div className="seg-row">
                {PERSONAS.map(p=>(
                  <div className="seg-c" key={p.id} style={{borderTopColor:p.color}}>
                    <div style={{fontSize:11,fontWeight:600,color:p.color,marginBottom:2}}>{p.emoji} {p.label}</div>
                    <div style={{fontFamily:"var(--fh)",fontSize:17,fontWeight:700,color:p.color,marginBottom:2}}>{p.count.toLocaleString()}</div>
                    <div style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)"}}>{p.listId} · {eid(p.id)}</div>
                  </div>
                ))}
              </div>
              <div className="crm-phases">
                {CRM_PHASES.map((ph,i)=>{
                  const st=crmSt[ph.id]||"idle";
                  return (
                    <div key={ph.id} className={`crm-ph ${st} ${crmPhase===ph.id?"sel":""}`} onClick={()=>setCrmPhase(ph.id)}>
                      <div className="phbadge">{st==="done"?"✓":st==="running"?<span className="spin" style={{width:10,height:10,borderTopColor:"var(--acc)"}}/>:i+1}</div>
                      <div style={{fontSize:14}}>{ph.icon}</div>
                      <div className="phlbl">{ph.label}</div>
                    </div>
                  );
                })}
              </div>
              <div className="g2" style={{alignItems:"start",marginBottom:18}}>
                <div>
                  <div className="ph-desc">{crmPh?.desc}</div>
                  {(crmPhase==="emails"||crmPhase==="schedule")&&(
                    <div className="psel" style={{marginBottom:9}}>
                      {PERSONAS.map((p,i)=><button key={p.id} className="pbtn" onClick={()=>setEPIdx(i)} style={ePIdx===i?{background:p.color,borderColor:p.color,color:"#000"}:{}}>{p.emoji} {p.short}</button>)}
                    </div>
                  )}
                  {req&&(<>
                    <div className="http-hdr"><span className="meth">{req.method}</span><span style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{req.url}</span></div>
                    <div className="htabs">
                      <div className={`htab ${crmView==="request"?"active":""}`} onClick={()=>setCrmView("request")}>Request</div>
                      <div className={`htab ${crmView==="response"?"active":""}`} style={{opacity:showResp?1:.4,cursor:showResp?"pointer":"not-allowed"}} onClick={()=>showResp&&setCrmView("response")}>Response{!showResp?" (pending)":""}</div>
                    </div>
                    <div className="code" dangerouslySetInnerHTML={{__html:crmView==="request"?reqDisp(req):(resp?hl(resp):'<span style="color:#555580">// Execute to see the response</span>')}}/>
                  </>)}
                </div>
                <div>
                  <div className="sec">Sample Contacts</div>
                  <div style={{background:"var(--card)",border:"1px solid var(--b)",borderRadius:10,overflow:"hidden",marginBottom:14}}>
                    <table className="ct">
                      <thead><tr><th>Contact</th><th>Persona Tag</th><th>Status</th></tr></thead>
                      <tbody>
                        {MOCK_CONTACTS.map(c=>{
                          const p=PERSONAS.find(pp=>pp.id===c.persona); const done=crmSt.contacts==="done"||sent;
                          return <tr key={c.id}>
                            <td><div style={{fontWeight:500,fontSize:12}}>{c.name}</div><div style={{fontSize:10,color:"var(--mut)",fontFamily:"var(--fm)"}}>{c.email}</div></td>
                            <td><span className="badge" style={{color:p?.color,borderColor:`${p?.color}40`,fontSize:9}}>{p?.id}</span></td>
                            <td style={{fontFamily:"var(--fm)",fontSize:10,color:done?"var(--a3)":"var(--mut)"}}>{done?"✓ UPSERTED":"PENDING"}</td>
                          </tr>;
                        })}
                      </tbody>
                    </table>
                    <div style={{padding:"7px 13px",borderTop:"1px solid var(--b)",fontSize:10,color:"var(--mut)",fontFamily:"var(--fm)"}}>+{(totalSent-MOCK_CONTACTS.length).toLocaleString()} additional · Total: {totalSent.toLocaleString()}</div>
                  </div>
                  <div className="sec">Execution Log</div>
                  <div className="log" ref={logRef}>
                    {distLog.length===0&&!distributing&&<span style={{color:"var(--mut)"}}>Awaiting execution…</span>}
                    {distLog.map((l,i)=><div className="ll" key={i}><span className="lt">[{l.ts}]</span><span className="lv">{l.t}</span></div>)}
                    {distributing&&<div className="ll"><span className="lt">[{new Date().toLocaleTimeString("en-US",{hour12:false})}]</span><span className="lv"><span className="bcur"/></span></div>}
                  </div>
                  {sent&&<div style={{marginTop:10}}><div className="ok-b">✓ All 5 CRM phases complete · {totalSent.toLocaleString()} subscribers reached · nm_wk{WEEK_NUM}</div>{saved&&<div style={{marginTop:6,fontSize:11,color:"var(--mut)",fontFamily:"var(--fm)"}}>Campaign auto-saved to history ✓</div>}</div>}
                </div>
              </div>
              <div className="actions">
                <button className="btn btn-s" onClick={()=>setStage(2)}>← Review</button>
                {!sent
                  ?<button className="btn btn-p" onClick={handleDistribute} disabled={distributing}>{distributing?<><span className="spin" style={{borderTopColor:"#000"}}/>Executing…</>:"Execute Campaign →"}</button>
                  :<button className="btn btn-p" onClick={()=>setStage(4)}>View Analytics →</button>
                }
              </div>
            </div>
          )}

          {/* ══ STAGE 4: ANALYZE ══ */}
          {stage===4&&(
            <div>
              <div className="stitle">◎ Performance Analytics</div>
              <div className="ssub">Campaign metrics, AI insights, historical comparison, and optimization recommendations.</div>

              {/* KPI row */}
              <div className="g3" style={{marginBottom:20}}>
                {[
                  {lbl:"Total Sent",     val:totalSent.toLocaleString(),    sub:"across 3 persona segments",      color:"var(--txt)"  },
                  {lbl:"Wtd. Open Rate", val:`${(wOpen*100).toFixed(1)}%`,  sub:"+8.2 pp vs. industry avg",       color:"var(--acc)"  },
                  {lbl:"Wtd. CTR",       val:`${(wClick*100).toFixed(1)}%`, sub:"+3.1 pp vs. prior campaign",     color:"var(--a3)"   },
                ].map(m=>(
                  <div className="mcard" key={m.lbl}>
                    <div className="lbl">{m.lbl}</div>
                    <div className="mval" style={{color:m.color}}>{m.val}</div>
                    <div className="msub">{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Bar charts */}
              <div className="card" style={{marginBottom:20}}>
                <div className="sec">Segment Performance</div>
                {[{label:"Open Rate",key:"open",max:.65,fmt:v=>`${(v*100).toFixed(1)}%`},{label:"Click-Through Rate",key:"click",max:.28,fmt:v=>`${(v*100).toFixed(1)}%`},{label:"Unsubscribe Rate",key:"unsub",max:.015,fmt:v=>`${(v*100).toFixed(2)}%`}].map((ch,ci)=>(
                  <div key={ch.key} style={{marginBottom:ci<2?20:0}}>
                    <div className="lbl" style={{marginBottom:9}}>{ch.label}</div>
                    {PERSONAS.map(p=>{ const v=MOCK_METRICS[p.id][ch.key]; return <div className="brow" key={p.id}><div className="blbl">{p.emoji} {p.label.split(" ").slice(0,2).join(" ")}</div><div className="btrack"><div className="bfill" style={{width:`${Math.round(v/ch.max*100)}%`,background:p.color}}/></div><div className="bval" style={{color:p.color}}>{ch.fmt(v)}</div></div>; })}
                  </div>
                ))}
              </div>

              {/* Per-segment */}
              <div className="g3" style={{marginBottom:20}}>
                {PERSONAS.map(p=>{ const m=MOCK_METRICS[p.id]; return <div className="card" key={p.id} style={{borderColor:`${p.color}30`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontWeight:600,fontSize:12,color:p.color}}>{p.emoji} {p.label}</div>
                    <div style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)"}}>{m.sent.toLocaleString()}</div>
                  </div>
                  {[{lbl:"Opened",val:Math.round(m.sent*m.open),pct:`${(m.open*100).toFixed(1)}%`},{lbl:"Clicked",val:Math.round(m.sent*m.click),pct:`${(m.click*100).toFixed(1)}%`},{lbl:"Unsubscribed",val:Math.round(m.sent*m.unsub),pct:`${(m.unsub*100).toFixed(2)}%`}].map(s=>(
                    <div key={s.lbl} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:"1px solid var(--b)"}}>
                      <span style={{color:"var(--mut)"}}>{s.lbl}</span>
                      <span>{s.val.toLocaleString()} <span style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)"}}>({s.pct})</span></span>
                    </div>
                  ))}
                </div>; })}
              </div>

              {/* AI Insights */}
              <div className="card" style={{marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div><div className="sec" style={{margin:0,marginBottom:2}}>AI Performance Insights</div><div style={{fontSize:11,color:"var(--mut)"}}>Segment analysis, per-persona recommendations, and next steps.</div></div>
                  <div style={{display:"flex",gap:7}}>
                    {insights&&<button className={`ghost ${copied==="ins"?"ok":""}`} onClick={()=>cpKey(insights,"ins")}>{copied==="ins"?"✓ Copied":"Copy"}</button>}
                    <button className="btn btn-p btn-xs" onClick={handleInsights} disabled={analyzing}>{analyzing?<><span className="spin" style={{width:12,height:12,borderTopColor:"#000"}}/>Analyzing…</>:insights?"↺ Regenerate":"Generate Insights →"}</button>
                  </div>
                </div>
                {analyzing&&<div className="loading"><div className="spin"/>Calling Claude API for performance analysis…</div>}
                {insights&&!analyzing&&<div className="ibody">{insights.split("\n\n").filter(Boolean).map((p,i)=><p key={i}>{p.trim()}</p>)}</div>}
                {!insights&&!analyzing&&<div className="empty">Generate insights to get segment-level analysis and specific improvement recommendations.</div>}
              </div>

              {/* AI Content Optimization */}
              <div className="card" style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                  <div>
                    <div className="sec" style={{margin:0,marginBottom:2}}>AI Content Optimization</div>
                    <div style={{fontSize:11,color:"var(--mut)"}}>Next blog topic recommendations based on your engagement trends and campaign history. Click any suggestion to use it as next week's topic.</div>
                  </div>
                  <button className="btn btn-a btn-xs" onClick={handleTopics} disabled={genTopics}>
                    {genTopics?<><span className="spin"/>Analyzing…</>:topicSugs?"↺ Refresh":"Suggest Next Topics →"}
                  </button>
                </div>
                {genTopics&&<div className="loading" style={{marginTop:12}}><div className="spin"/>Analyzing engagement trends and campaign history…</div>}
                {topicSugs&&!genTopics&&(
                  <div className="tgrid">
                    {topicSugs.map((s,i)=>(
                      <div className="tcard" key={i}>
                        <div style={{fontFamily:"var(--fm)",fontSize:9,color:"var(--acc)",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Topic {i+1}</div>
                        <div className="thead">{s.headline}</div>
                        <div className="trat">{s.rationale}</div>
                        <button className="tuse" onClick={()=>{ setTopic(s.topic); setSaved(false); setContent(null); setSent(false); setDistLog([]); setInsights(null); setTopicSugs(null); setCrmSt({auth:"idle",contacts:"idle",emails:"idle",schedule:"idle",log:"idle"}); setStage(1); }}>
                          → Use as next topic
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {!topicSugs&&!genTopics&&<div className="empty">Click "Suggest Next Topics" to get AI-driven content ideas based on what's resonating.</div>}
              </div>

              {/* History */}
              <div className="card" style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div className="sec" style={{margin:0}}>Campaign History</div>
                  <div style={{fontFamily:"var(--fm)",fontSize:10,color:"var(--mut)"}}>Auto-saved after each distribution · window.storage</div>
                </div>
                {[{weekNum:WEEK_NUM,sendDate:SEND_DATE,blogTitle:content?.blog?.title||topic,metrics:MOCK_METRICS,current:true},...history].map((c,i)=>{
                  const o=wMet("open",c.metrics), ct=wMet("click",c.metrics);
                  const prev=i>0?history[i-1]:null; const t=prev?trnd(o,wMet("open",prev.metrics)):"—";
                  return <div key={i} className="hist-row" style={c.current?{background:"rgba(240,165,0,.04)"}:{}}>
                    <div className="hist-wk" style={c.current?{color:"var(--acc)"}:{}}>{c.current?"← now":""} Wk{c.weekNum}</div>
                    <div className="hist-title">{c.blogTitle}</div>
                    <div className="hist-met" style={c.current?{color:"var(--acc)"}:{}}>{(o*100).toFixed(1)}%</div>
                    <div className="hist-met" style={c.current?{color:"var(--acc)"}:{}}>{(ct*100).toFixed(1)}%</div>
                    <div className="hist-tr"><span className={t.startsWith("↑")?"tup":t.startsWith("↓")?"tdn":"teq"}>{t}</span></div>
                  </div>;
                })}
              </div>

              <div className="actions">
                <button className="btn btn-s" onClick={()=>setStage(3)}>← Distribution</button>
                <button className="btn btn-p" onClick={()=>setStage(0)}>→ Dashboard</button>
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}
