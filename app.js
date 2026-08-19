(() => {
  "use strict";

  const STORAGE_KEY = "ezee_student_result_manager_v1";
  const CLASSES = ["4","5","6","7","8","9","10"];
  const $ = id => document.getElementById(id);

  const state = {
    db: loadDB(),
    selectedClass: "4",
    selectedExamId: null,
    search: ""
  };

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
  }

  function defaultDB() {
    const classes = {};
    CLASSES.forEach(c => { classes[c] = { students: [], exams: [] }; });
    return { version: 1, classes };
  }

  function normalizeDB(raw) {
    const db = raw && typeof raw === "object" ? raw : defaultDB();
    if (!db.classes || typeof db.classes !== "object") db.classes = {};
    CLASSES.forEach(c => {
      if (!db.classes[c]) db.classes[c] = { students: [], exams: [] };
      if (!Array.isArray(db.classes[c].students)) db.classes[c].students = [];
      if (!Array.isArray(db.classes[c].exams)) db.classes[c].exams = [];
    });
    db.version = 1;
    return db;
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return normalizeDB(raw ? JSON.parse(raw) : null);
    } catch (err) {
      console.error("Storage load failed:", err);
      return defaultDB();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db));
      return true;
    } catch (err) {
      console.error("Storage save failed:", err);
      toast("Could not save data in this browser.");
      return false;
    }
  }

  function classData() {
    return state.db.classes[state.selectedClass];
  }

  function currentExam() {
    return classData().exams.find(e => e.id === state.selectedExamId) || null;
  }

  function todayISO() {
    return new Date().toISOString().slice(0,10);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[ch]));
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function renderClassDashboard() {
    $("classDashboard").innerHTML = CLASSES.map(c => {
      const d = state.db.classes[c];
      const active = c === state.selectedClass ? " active" : "";
      return `<button class="class-card${active}" type="button" data-class="${c}">
        <strong>Class ${c}</strong>
        <span>${d.students.length} Students · ${d.exams.length} Exams</span>
      </button>`;
    }).join("");
  }

  function renderExamSelect() {
    const exams = classData().exams.slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    if (!state.selectedExamId || !exams.some(e => e.id === state.selectedExamId)) {
      state.selectedExamId = exams[0]?.id || null;
    }
    $("examSelect").innerHTML = `<option value="">No exam selected</option>` + exams.map(e =>
      `<option value="${escapeHTML(e.id)}">${escapeHTML(e.name)} — ${formatDate(e.date)}</option>`
    ).join("");
    $("examSelect").value = state.selectedExamId || "";
    syncExamFields();
  }

  function syncExamFields() {
    const exam = currentExam();
    $("totalMarks").value = exam ? exam.totalMarks : "";
    $("examDate").value = exam ? exam.date : "";
  }

  function renderTable() {
    const data = classData();
    const exam = currentExam();
    const query = state.search.trim().toLowerCase();
    const students = data.students.filter(s => s.name.toLowerCase().includes(query));
    $("studentCount").textContent = `${data.students.length} ${data.students.length === 1 ? "Student" : "Students"}`;

    $("resultBody").innerHTML = students.map((student, index) => {
      const mark = exam ? (exam.marks[student.id] ?? "") : "";
      return `<tr data-student="${escapeHTML(student.id)}">
        <td>${index + 1}</td>
        <td>
          <div class="student-name">${escapeHTML(student.name)}</div>
          <div class="row-actions">
            <button class="mini-btn edit-student" type="button" data-id="${escapeHTML(student.id)}">Edit</button>
            <button class="mini-btn delete delete-student" type="button" data-id="${escapeHTML(student.id)}">Delete</button>
          </div>
        </td>
        <td>${exam
          ? `<input class="mark-input" data-mark-id="${escapeHTML(student.id)}" type="number" min="0" max="${Number(exam.totalMarks)}" step="1" inputmode="numeric" value="${escapeHTML(mark)}" aria-label="Marks for ${escapeHTML(student.name)}">`
          : `<span style="color:#8997a4">Create/select an exam</span>`
        }</td>
      </tr>`;
    }).join("");

    const empty = students.length === 0;
    $("emptyState").classList.toggle("hidden", !empty);
    $("resultTable").classList.toggle("hidden", empty);
  }

  function renderHistory() {
    const exams = classData().exams.slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    if (!exams.length) {
      $("examHistory").innerHTML = `<div class="empty-state"><h3>No exams yet</h3><p>Create a new exam for Class ${state.selectedClass}.</p></div>`;
      return;
    }
    $("examHistory").innerHTML = exams.map(e => `
      <article class="history-item${e.id === state.selectedExamId ? " active" : ""}">
        <div class="history-top"><span class="history-name">${escapeHTML(e.name)}</span><strong>${escapeHTML(e.totalMarks)}</strong></div>
        <div class="history-meta">${formatDate(e.date)}</div>
        <div class="history-actions">
          <button type="button" data-open-exam="${escapeHTML(e.id)}">Open</button>
          <button type="button" data-edit-exam="${escapeHTML(e.id)}">Edit</button>
          <button type="button" class="danger" data-delete-exam="${escapeHTML(e.id)}">Delete</button>
        </div>
      </article>
    `).join("");
  }


  function getExamStats(exam) {
    const students=classData().students;
    const values=students.map(s=>exam ? exam.marks[s.id] : "").filter(v=>v!=="" && Number.isFinite(Number(v))).map(Number);
    return {total:students.length, entered:values.length, pending:students.length-values.length,
      highest:values.length?Math.max(...values):0, lowest:values.length?Math.min(...values):0,
      average:values.length?values.reduce((a,b)=>a+b,0)/values.length:0};
  }
  function renderAnalytics() {
    const e=currentExam(), s=getExamStats(e);
    $("analyticsCard").innerHTML = e ? [
      ["Students",s.total,""],["Entered",s.entered,""],["Pending",s.pending,"pending"],
      ["Highest",s.entered?s.highest:"—",""],["Lowest",s.entered?s.lowest:"—",""],["Average",s.entered?s.average.toFixed(1):"—",""]
    ].map(x=>`<div class="stat-card ${x[2]}"><span class="label">${x[0]}</span><div class="value">${x[1]}</div></div>`).join("") :
      `<div class="stat-card"><span class="label">Students</span><div class="value">${s.total}</div></div><div class="stat-card"><span class="label">Exams</span><div class="value">${classData().exams.length}</div></div>`;
    $("pendingBadge").textContent=`${s.pending} Pending`;
  }
  function renderAll() {
    renderClassDashboard();
    $("classSelect").value=state.selectedClass;
    $("newExamClass").value=state.selectedClass;
    renderExamSelect();
    renderTable();
    renderHistory();
  }

  function selectClass(c) {
    if (!CLASSES.includes(c)) return;
    state.selectedClass = c;
    state.selectedExamId = null;
    state.search = "";
    $("searchInput").value = "";
    renderAll();
  }

  function addStudent(name) {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return;
    const duplicate = classData().students.some(s => s.name.toLowerCase() === clean.toLowerCase());
    if (duplicate) {
      toast("A student with this name already exists.");
      return;
    }
    classData().students.push({ id: uid("stu"), name: clean });
    persist();
    renderAll();
    toast("Student added.");
  }

  function editStudent(id, name) {
    const student = classData().students.find(s => s.id === id);
    if (!student) return;
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return;
    student.name = clean;
    persist();
    renderAll();
    toast("Student name updated.");
  }

  function deleteStudent(id) {
    const student = classData().students.find(s => s.id === id);
    if (!student) return;
    if (!confirm("Are you sure you want to delete this student?")) return;
    classData().students = classData().students.filter(s => s.id !== id);
    classData().exams.forEach(exam => { delete exam.marks[id]; });
    persist();
    renderAll();
    toast("Student deleted.");
  }

  function createExam(name, totalMarks, date, classId) {
    const target = state.db.classes[classId];
    const total = Number(totalMarks);
    if (!name.trim() || !Number.isInteger(total) || total < 1 || !date) {
      toast("Please enter valid exam details.");
      return;
    }
    const exam = {
      id: uid("exam"),
      name: name.trim(),
      totalMarks: total,
      date,
      marks: {}
    };
    target.students.forEach(s => { exam.marks[s.id] = ""; });
    target.exams.push(exam);
    state.selectedClass = classId;
    state.selectedExamId = exam.id;
    persist();
    renderAll();
    toast("Exam created.");
  }

  function updateExam(exam, name, totalMarks, date) {
    const total = Number(totalMarks);
    if (!name.trim() || !Number.isInteger(total) || total < 1 || !date) {
      toast("Please enter valid exam details.");
      return;
    }
    exam.name = name.trim();
    exam.totalMarks = total;
    exam.date = date;
    Object.keys(exam.marks).forEach(id => {
      const value = exam.marks[id];
      if (value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > total)) {
        exam.marks[id] = "";
      }
    });
    persist();
    renderAll();
    toast("Exam updated.");
  }

  function deleteExam(id) {
    const exam = classData().exams.find(e => e.id === id);
    if (!exam) return;
    if (!confirm(`Delete "${exam.name}"? This exam's marks will also be deleted.`)) return;
    classData().exams = classData().exams.filter(e => e.id !== id);
    state.selectedExamId = classData().exams[0]?.id || null;
    persist();
    renderAll();
    toast("Exam deleted.");
  }

  function saveCurrentExamFields() {
    const exam = currentExam();
    if (!exam) {
      toast("Create or select an exam first.");
      return;
    }
    updateExam(exam, exam.name, $("totalMarks").value, $("examDate").value);
  }

  function saveMark(studentId, rawValue, input) {
    const exam = currentExam();
    if (!exam) return;
    if (rawValue === "") {
      exam.marks[studentId] = "";
      input.classList.remove("invalid");
      persist();
      return;
    }
    const value = Number(rawValue);
    const valid = Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= Number(exam.totalMarks);
    input.classList.toggle("invalid", !valid);
    if (!valid) {
      toast(`Marks must be between 0 and ${exam.totalMarks}.`);
      return;
    }
    exam.marks[studentId] = value;
    persist();
    input.classList.add("saved");
    setTimeout(() => input.classList.remove("saved"), 350);
    renderAnalytics();
  }

  function openStudentDialog(studentId = "") {
    $("editingStudentId").value = studentId;
    $("studentName").value = "";
    $("studentDialogTitle").textContent = studentId ? "Edit Student" : "Add Student";
    $("studentSubmit").textContent = studentId ? "Save Changes" : "Add Student";
    if (studentId) {
      const student = classData().students.find(s => s.id === studentId);
      if (!student) return;
      $("studentName").value = student.name;
    }
    $("studentDialog").showModal();
    setTimeout(() => $("studentName").focus(), 50);
  }

  function openNewExamDialog() {
    $("newExamClass").value = state.selectedClass;
    $("newExamName").value = "";
    $("newExamMarks").value = "100";
    $("newExamDate").value = todayISO();
    $("examDialog").showModal();
    setTimeout(() => $("newExamName").focus(), 50);
  }

  function editExam(id) {
    const exam=classData().exams.find(e=>e.id===id);
    if(!exam)return;
    $("editingExamId").value=id;
    $("editExamName").value=exam.name;
    $("editExamMarks").value=exam.totalMarks;
    $("editExamDate").value=exam.date;
    $("editExamDialog").showModal();
    setTimeout(()=>$('editExamName').focus(),50);
  }

  function printResult() {
    const exam = currentExam();
    if (!exam) { toast("Create or select an exam first."); return; }
    const students = classData().students.slice();
    const rows = students.map((s, i) => `
      <tr><td>${i + 1}</td><td>${escapeHTML(s.name)}</td><td>${escapeHTML(exam.marks[s.id] ?? "")}</td></tr>
    `).join("");
    $("printArea").innerHTML = `
      <div class="print-sheet">
        <div class="print-header">
          <img src="assets/icon.svg" alt="">
          <div><div class="print-title">EZEE VISION CHAMPUA</div><div class="print-subtitle">Student Result Manager Pro</div></div>
        </div>
        <div class="print-info">
          <div><small>Exam</small><strong>${escapeHTML(exam.name)}</strong></div>
          <div><small>Total Marks</small><strong>${escapeHTML(exam.totalMarks)}</strong></div>
          <div><small>Class · Date</small><strong>Class ${escapeHTML(state.selectedClass)} · ${formatDate(exam.date)}</strong></div>
        </div>
        <div class="print-summary"><div><small>Students</small><strong>${students.length}</strong></div><div><small>Entered</small><strong>${Object.values(exam.marks).filter(v => v !== "").length}</strong></div><div><small>Highest</small><strong>${(() => { const v=Object.values(exam.marks).filter(x=>x!=="").map(Number); return v.length?Math.max(...v):"—"; })()}</strong></div><div><small>Average</small><strong>${(() => { const v=Object.values(exam.marks).filter(x=>x!=="").map(Number); return v.length?(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1):"—"; })()}</strong></div></div>
        <table class="print-table">
          <thead><tr><th>Sl. No.</th><th>Name of the Students</th><th>Marks</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="3">No students</td></tr>`}</tbody>
        </table>
        <div class="print-footer"><span>EZEE VISION CHAMPUA</span><span>Student Result Manager Pro</span></div>
      </div>`;
    window.print();
  }


  function exportBackup() {
    const payload={app:"EZEE VISION CHAMPUA — Student Result Manager Pro",backupVersion:1,createdAt:new Date().toISOString(),data:state.db};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`ezee-result-backup-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast("Backup downloaded.");
  }
  function importBackup(file) {
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{try{
      const parsed=JSON.parse(reader.result),candidate=parsed?.data||parsed,normalized=normalizeDB(candidate);
      const students=CLASSES.reduce((n,c)=>n+normalized.classes[c].students.length,0),exams=CLASSES.reduce((n,c)=>n+normalized.classes[c].exams.length,0);
      if(!confirm(`Restore this backup?\\n\\nStudents: ${students}\\nExams: ${exams}\\n\\nCurrent browser data will be replaced by this backup.`))return;
      state.db=normalized;state.selectedClass="4";state.selectedExamId=null;state.search="";$("searchInput").value="";persist();renderAll();toast("Backup restored successfully.");
    }catch(e){toast("Invalid backup file.")}};reader.readAsText(file);
  }
  $("classDashboard").addEventListener("click", e => {
    const btn = e.target.closest("[data-class]");
    if (btn) selectClass(btn.dataset.class);
  });

  $("classSelect").addEventListener("change", e => selectClass(e.target.value));

  $("examSelect").addEventListener("change", e => {
    state.selectedExamId = e.target.value || null;
    renderAnalytics();
    renderTable();
    renderHistory();
    syncExamFields();
  });

  $("searchInput").addEventListener("input", e => {
    state.search = e.target.value;
    renderTable();
  });

  $("addStudentBtn").addEventListener("click", () => openStudentDialog());
  $("emptyState").addEventListener("click", e => { if (e.target.closest("[data-empty-add]")) openStudentDialog(); });
  $("newExamBtn").addEventListener("click", openNewExamDialog);
  $("printBtn").addEventListener("click", printResult);
  $("saveExamBtn").addEventListener("click", saveCurrentExamFields);

  $("resultBody").addEventListener("click", e => {
    const edit = e.target.closest(".edit-student");
    const del = e.target.closest(".delete-student");
    if (edit) openStudentDialog(edit.dataset.id);
    if (del) deleteStudent(del.dataset.id);
  });

  $("resultBody").addEventListener("change", e => {
    const input = e.target.closest("[data-mark-id]");
    if (input) saveMark(input.dataset.markId, input.value, input);
  });

  $("examHistory").addEventListener("click", e => {
    const open = e.target.closest("[data-open-exam]");
    const edit = e.target.closest("[data-edit-exam]");
    const del = e.target.closest("[data-delete-exam]");
    if (open) { state.selectedExamId = open.dataset.openExam; renderAll(); }
    if (edit) editExam(edit.dataset.editExam);
    if (del) deleteExam(del.dataset.deleteExam);
  });


  $("backupBtn").addEventListener("click",exportBackup);
  $("restoreBtn").addEventListener("click",()=>$('restoreInput').click());
  $("restoreInput").addEventListener("change",e=>{importBackup(e.target.files[0]);e.target.value=""});
  $("resultBody").addEventListener("keydown",e=>{
    const input=e.target.closest("[data-mark-id]");
    if(!input||e.key!=="Enter")return;
    e.preventDefault();
    saveMark(input.dataset.markId,input.value,input);
    const inputs=[...document.querySelectorAll("[data-mark-id]")],i=inputs.indexOf(input);
    if(i>=0&&inputs[i+1]){inputs[i+1].focus();inputs[i+1].select()}
  });
  $("editExamForm").addEventListener("submit",e=>{
    if(e.submitter?.value==="cancel")return;e.preventDefault();
    const id=$("editingExamId").value,exam=classData().exams.find(x=>x.id===id);
    if(exam)updateExam(exam,$("editExamName").value,$("editExamMarks").value,$("editExamDate").value);
    $("editExamDialog").close();
  });
  $("studentForm").addEventListener("submit", e => {
    if (e.submitter?.value === "cancel") return;
    e.preventDefault();
    const id = $("editingStudentId").value;
    const name = $("studentName").value;
    if (id) editStudent(id, name); else addStudent(name);
    $("studentDialog").close();
  });

  $("examForm").addEventListener("submit", e => {
    if (e.submitter?.value === "cancel") return;
    e.preventDefault();
    createExam($("newExamName").value, $("newExamMarks").value, $("newExamDate").value, $("newExamClass").value);
    $("examDialog").close();
  });

  window.addEventListener("beforeprint", () => $("printArea").setAttribute("aria-hidden","false"));
  window.addEventListener("afterprint", () => $("printArea").setAttribute("aria-hidden","true"));

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    $("installBtn").classList.remove("hidden");
  });
  $("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("installBtn").classList.add("hidden");
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(err => console.warn("SW:", err)));
  }

  renderAll();
})();
