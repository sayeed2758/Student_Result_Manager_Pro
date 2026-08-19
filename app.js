(() => {
  'use strict';

  const STORAGE_KEY = 'ezee_student_result_manager_v1';
  const CLASSES = ['4','5','6','7','8','9','10'];
  const $ = (id) => document.getElementById(id);
  const state = {
    db: loadDB(),
    selectedClass: '4',
    selectedExamId: null,
    search: '',
    modalCleanup: null,
    deferredPrompt: null
  };

  function uid(prefix='id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
  }

  function blankDB() {
    const classes = {};
    CLASSES.forEach(c => classes[c] = { students: [], exams: [] });
    return { version: 1, classes };
  }

  function normalizeDB(raw) {
    const db = raw && typeof raw === 'object' ? raw : blankDB();
    if (!db.classes || typeof db.classes !== 'object') db.classes = {};

    CLASSES.forEach(c => {
      const d = db.classes[c] && typeof db.classes[c] === 'object' ? db.classes[c] : {};
      d.students = Array.isArray(d.students) ? d.students : [];
      d.exams = Array.isArray(d.exams) ? d.exams : [];
      d.students = d.students
        .filter(s => s && s.id && typeof s.name === 'string' && s.name.trim())
        .map(s => ({ id: String(s.id), name: s.name.trim() }));

      d.exams = d.exams.filter(e => e && e.id).map(e => {
        const marks = e.marks && typeof e.marks === 'object' ? {...e.marks} : {};
        const statuses = e.statuses && typeof e.statuses === 'object' ? {...e.statuses} : {};
        d.students.forEach(s => {
          if (!(s.id in marks)) marks[s.id] = '';
          if (!statuses[s.id]) statuses[s.id] = marks[s.id] === '' ? 'pending' : 'present';
          if (statuses[s.id] !== 'absent' && statuses[s.id] !== 'present' && statuses[s.id] !== 'pending') {
            statuses[s.id] = marks[s.id] === '' ? 'pending' : 'present';
          }
        });
        return {
          id: String(e.id),
          name: String(e.name || e.title || 'Exam').trim() || 'Exam',
          totalMarks: Math.max(1, Number.parseInt(e.totalMarks, 10) || 100),
          date: String(e.date || ''),
          marks,
          statuses
        };
      });
      db.classes[c] = d;
    });
    db.version = 1;
    return db;
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return normalizeDB(raw ? JSON.parse(raw) : null);
    } catch (err) {
      console.warn('Storage load failed:', err);
      return blankDB();
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db));
      const badge = $('saveBadge');
      if (badge) badge.textContent = 'Saved locally';
      return true;
    } catch (err) {
      console.error('Storage save failed:', err);
      toast('Could not save data in this browser.');
      return false;
    }
  }

  function classData() { return state.db.classes[state.selectedClass]; }
  function currentExam() { return classData().exams.find(e => e.id === state.selectedExamId) || null; }
  function todayISO() { return new Date().toISOString().slice(0,10); }
  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
  }
  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function ensureExamStudents(exam) {
    if (!exam) return;
    classData().students.forEach(student => {
      if (!(student.id in exam.marks)) exam.marks[student.id] = '';
      if (!exam.statuses[student.id]) exam.statuses[student.id] = exam.marks[student.id] === '' ? 'pending' : 'present';
    });
  }

  function stats(exam) {
    if (!exam) return {total:0,present:0,absent:0,pending:0,highest:null,average:0};
    ensureExamStudents(exam);
    const students = classData().students;
    let present=0, absent=0, pending=0, total=0, highest=null, sum=0;
    students.forEach(s => {
      const st = exam.statuses[s.id] || 'pending';
      if (st === 'absent') absent++;
      else if (st === 'present') {
        present++; total++;
        const n = Number(exam.marks[s.id]);
        if (Number.isFinite(n)) { sum += n; highest = highest === null ? n : Math.max(highest,n); }
      } else pending++;
    });
    return {total:students.length,present,absent,pending,highest,average:present ? sum/present : 0};
  }

  function renderAll() {
    renderClassGrid();
    renderExamSelect();
    renderExamInfo();
    renderAnalytics();
    renderTable();
    renderHistory();
  }

  function renderClassGrid() {
    $('classGrid').innerHTML = CLASSES.map(c => {
      const d = state.db.classes[c];
      return `<button class="class-card${c===state.selectedClass?' active':''}" type="button" data-class="${c}">
        <b>Class ${c}</b><span>${d.students.length} ${d.students.length===1?'Student':'Students'} · ${d.exams.length} ${d.exams.length===1?'Exam':'Exams'}</span>
      </button>`;
    }).join('');
    $('classSelect').value = state.selectedClass;
  }

  function renderExamSelect() {
    const exams = classData().exams.slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    if (!state.selectedExamId || !exams.some(e => e.id === state.selectedExamId)) state.selectedExamId = exams[0]?.id || null;
    $('examSelect').innerHTML = `<option value="">No exam selected</option>` + exams.map(e =>
      `<option value="${escapeHTML(e.id)}">${escapeHTML(e.name)} — ${formatDate(e.date)}</option>`
    ).join('');
    $('examSelect').value = state.selectedExamId || '';
  }

  function renderExamInfo() {
    const e = currentExam();
    $('totalMarks').value = e ? e.totalMarks : '';
    $('examDate').value = e ? e.date : '';
    $('examCaption').textContent = e ? `${e.name} · ${formatDate(e.date)} · Maximum ${e.totalMarks}` : 'No exam selected';
    $('printBtn').disabled = !e;
    $('saveExamBtn').disabled = !e;
    $('printBtn').style.opacity = e ? '1' : '.65';
    $('saveExamBtn').style.opacity = e ? '1' : '.65';
  }

  function renderAnalytics() {
    const s = stats(currentExam());
    $('analytics').innerHTML = [
      ['Students',s.total,''],['Present',s.present,''],['Absent',s.absent,'absent'],
      ['Pending',s.pending,'pending'],['Highest',s.highest ?? '—',''],['Average',s.present ? s.average.toFixed(1) : '—','']
    ].map(x => `<div class="stat ${x[2]}"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('');
  }

  function renderTable() {
    const students = classData().students;
    const exam = currentExam();
    if (exam) ensureExamStudents(exam);
    const query = state.search.trim().toLowerCase();
    const filtered = students.filter(s => s.name.toLowerCase().includes(query));
    $('studentCount').textContent = `${students.length} ${students.length===1?'Student':'Students'}`;
    $('pendingCount').textContent = `${exam ? stats(exam).pending : 0} Pending`;
    $('markPendingAbsentBtn').disabled = !exam || !stats(exam).pending;
    $('exportCsvBtn').disabled = !exam;
    $('entryTip').classList.toggle('hidden', !exam || !students.length);
    $('emptyState').classList.toggle('hidden', filtered.length > 0);

    if (!filtered.length) {
      $('resultBody').innerHTML = '';
      return;
    }

    $('resultBody').innerHTML = filtered.map((student, index) => {
      const status = exam ? (exam.statuses[student.id] || 'pending') : 'pending';
      const marks = exam ? (exam.marks[student.id] ?? '') : '';
      const absent = status === 'absent';
      const disabled = !exam || absent;
      const value = absent ? '' : escapeHTML(marks);
      return `<tr>
        <td>${students.indexOf(student)+1}</td>
        <td><div class="student-name">${escapeHTML(student.name)}</div>
          <div class="row-actions"><button class="mini edit-student" type="button" data-id="${escapeHTML(student.id)}">Edit</button>
          <button class="mini delete delete-student" type="button" data-id="${escapeHTML(student.id)}">Delete</button></div></td>
        <td><div class="mark-row">
          <input class="mark-input" data-mark-id="${escapeHTML(student.id)}" type="number" min="0" max="${exam ? exam.totalMarks : 100}" step="1" inputmode="numeric" value="${value}" ${disabled?'disabled':''} placeholder="${exam?'Marks':'—'}" aria-label="Marks for ${escapeHTML(student.name)}">
          ${exam ? `<button class="status-btn ${absent?'active':''}" type="button" data-status-id="${escapeHTML(student.id)}">${absent?'Present':'Absent'}</button>` : ''}
        </div>${absent?'<div class="status-note absent">ABSENT</div>':status==='pending'?'<div class="status-note">Pending</div>':''}</td>
      </tr>`;
    }).join('');
  }

  function renderHistory() {
    const exams = classData().exams.slice().sort((a,b) => (b.date||'').localeCompare(a.date||''));
    if (!exams.length) {
      $('examHistory').innerHTML = `<div class="empty"><div class="empty-icon">◷</div><h3>No exams yet</h3><p>Create a new exam to start saving marks.</p><button id="historyNewExam" class="btn primary" type="button">Create First Exam</button></div>`;
      return;
    }
    $('examHistory').innerHTML = exams.map(e => {
      const s = stats(e);
      return `<article class="history ${e.id===state.selectedExamId?'current':''}">
        <div class="history-top"><div class="history-name">${escapeHTML(e.name)}</div><span class="pill pending">${s.pending} pending</span></div>
        <div class="history-meta">${formatDate(e.date)} · Class ${state.selectedClass} · Total ${e.totalMarks}<br>${s.present} present · ${s.absent} absent</div>
        <div class="history-actions"><button type="button" data-open-exam="${escapeHTML(e.id)}">Open</button><button type="button" data-edit-exam="${escapeHTML(e.id)}">Edit</button><button type="button" data-duplicate-exam="${escapeHTML(e.id)}">Duplicate</button><button class="danger" type="button" data-delete-exam="${escapeHTML(e.id)}">Delete</button></div>
      </article>`;
    }).join('');
  }

  function selectClass(c) {
    if (!CLASSES.includes(String(c))) return;
    state.selectedClass = String(c);
    state.selectedExamId = classData().exams[0]?.id || null;
    state.search = '';
    $('searchInput').value = '';
    renderAll();
  }

  function createExam(name, totalMarks, date, cls) {
    name = String(name||'').trim();
    const total = Number(totalMarks);
    if (!name) { toast('Enter an exam name.'); return false; }
    if (!Number.isInteger(total) || total < 1) { toast('Total Marks must be a positive whole number.'); return false; }
    if (!CLASSES.includes(String(cls))) { toast('Invalid class.'); return false; }
    const d = state.db.classes[String(cls)];
    if (d.exams.some(e => e.name.toLowerCase() === name.toLowerCase() && e.date === date)) { toast('An exam with this name and date already exists.'); return false; }
    const exam = {id:uid('exam'), name, totalMarks:total, date:date||todayISO(), marks:{}, statuses:{}};
    d.students.forEach(s => {exam.marks[s.id]='';exam.statuses[s.id]='pending';});
    d.exams.push(exam);
    state.selectedClass = String(cls); state.selectedExamId = exam.id; state.search=''; $('searchInput').value='';
    persist(); renderAll(); toast('New exam created successfully.'); return true;
  }

  function saveCurrentExam() {
    const e = currentExam();
    if (!e) { toast('Create or select an exam first.'); return; }
    const total = Number($('totalMarks').value);
    const date = $('examDate').value;
    if (!Number.isInteger(total) || total < 1) { toast('Enter valid Total Marks.'); return; }
    e.totalMarks = total; e.date = date || e.date || todayISO();
    ensureExamStudents(e);
    Object.keys(e.marks).forEach(id => {
      const st = e.statuses[id];
      if (st !== 'absent' && e.marks[id] !== '') {
        const n = Number(e.marks[id]);
        if (!Number.isInteger(n) || n < 0 || n > total) { e.marks[id]=''; e.statuses[id]='pending'; }
      }
    });
    persist(); renderAll(); toast('Exam saved successfully.');
  }

  function addStudent(name) {
    name = String(name||'').trim().replace(/\s+/g,' ');
    if (!name) { toast('Enter student name.'); return false; }
    const d = classData();
    if (d.students.some(s => s.name.toLowerCase() === name.toLowerCase())) { toast('That student already exists in this class.'); return false; }
    const student = {id:uid('student'),name};
    d.students.push(student);
    d.exams.forEach(e => {e.marks[student.id]='';e.statuses[student.id]='pending';});
    persist(); renderAll(); toast('Student added successfully.'); return true;
  }

  async function editStudent(id, name) {
    const student = classData().students.find(s => s.id === id);
    if (!student) return;
    name = String(name||'').trim().replace(/\s+/g,' ');
    if (!name) { toast('Enter student name.'); return; }
    if (classData().students.some(s => s.id !== id && s.name.toLowerCase() === name.toLowerCase())) { toast('That student name already exists in this class.'); return; }
    student.name = name; persist(); renderAll(); toast('Student updated.');
  }

  async function deleteStudent(id) {
    const s = classData().students.find(x => x.id === id);
    if (!s) return;
    if (!await confirmAction('Delete student?', `Are you sure you want to delete ${s.name}? Their records will be removed from this class's exams.`, 'Delete', true)) return;
    classData().students = classData().students.filter(x => x.id !== id);
    classData().exams.forEach(e => {delete e.marks[id];delete e.statuses[id];});
    persist(); renderAll(); toast('Student deleted.');
  }

  function updateExam(exam, name, totalMarks, date) {
    name = String(name||'').trim(); const total = Number(totalMarks);
    if (!name || !Number.isInteger(total) || total < 1) { toast('Enter valid exam details.'); return false; }
    const duplicate = classData().exams.some(e => e.id !== exam.id && e.name.toLowerCase() === name.toLowerCase() && e.date === date);
    if (duplicate) { toast('Another exam has the same name and date.'); return false; }
    exam.name=name; exam.totalMarks=total; exam.date=date||exam.date||todayISO();
    ensureExamStudents(exam); persist(); renderAll(); toast('Exam updated.'); return true;
  }

  async function deleteExam(id) {
    const exam = classData().exams.find(e => e.id === id); if (!exam) return;
    if (!await confirmAction('Delete exam?', `Delete “${exam.name}” and all marks saved in it?`, 'Delete', true)) return;
    classData().exams = classData().exams.filter(e => e.id !== id);
    if (state.selectedExamId === id) state.selectedExamId = classData().exams[0]?.id || null;
    persist(); renderAll(); toast('Exam deleted.');
  }

  function duplicateExam(id) {
    const source = classData().exams.find(e => e.id === id); if (!source) return;
    const copy = {id:uid('exam'),name:`${source.name} — Copy`,totalMarks:source.totalMarks,date:todayISO(),marks:{},statuses:{}};
    classData().students.forEach(s => {copy.marks[s.id]='';copy.statuses[s.id]='pending';});
    classData().exams.push(copy);state.selectedExamId=copy.id;persist();renderAll();toast('Exam duplicated with fresh marks.');
  }

  function saveMark(id, raw, input) {
    const e=currentExam(); if (!e) {toast('Select an exam first.');return;}
    ensureExamStudents(e);
    if (e.statuses[id] === 'absent') {toast('Student is marked absent.');return;}
    raw=String(raw).trim();
    if (raw==='') {e.marks[id]='';e.statuses[id]='pending';input.classList.remove('invalid','saved');persist();renderAnalytics();renderHistory();renderTable();return;}
    const value=Number(raw), valid=Number.isInteger(value)&&value>=0&&value<=e.totalMarks;
    input.classList.toggle('invalid',!valid);
    if (!valid) {toast(`Marks must be between 0 and ${e.totalMarks}.`);return;}
    e.marks[id]=value;e.statuses[id]='present';persist();input.classList.add('saved');setTimeout(()=>input.classList.remove('saved'),350);renderAnalytics();renderHistory();
  }

  async function toggleAbsent(id) {
    const e=currentExam(); if (!e) {toast('Create or select an exam first.');return;}
    ensureExamStudents(e);
    if (e.statuses[id] === 'absent') {
      e.statuses[id]='pending';e.marks[id]='';persist();renderAll();toast('Student returned to Pending.');return;
    }
    const student=classData().students.find(s=>s.id===id);
    if (!await confirmAction('Mark student absent?', `${student?.name||'This student'} will print as ABSENT.`, 'Mark Absent')) return;
    e.statuses[id]='absent';e.marks[id]='';persist();renderAll();toast('Student marked absent.');
  }

  async function markAllPendingAbsent() {
    const e=currentExam(); if (!e) {toast('Select an exam first.');return;}
    const pending=classData().students.filter(s=>(e.statuses[s.id]||'pending')==='pending');
    if (!pending.length) {toast('No pending students.');return;}
    if (!await confirmAction('Mark all pending as Absent?', `${pending.length} students will be marked ABSENT.`, 'Mark Absent')) return;
    pending.forEach(s=>{e.statuses[s.id]='absent';e.marks[s.id]='';});persist();renderAll();toast(`${pending.length} students marked absent.`);
  }

  function openModal(html, afterOpen) {
    closeModal(false);
    $('modalCard').innerHTML=html;
    $('modalRoot').classList.remove('hidden');
    $('modalRoot').setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    const backdrop=$('modalRoot').querySelector('[data-close-modal]'); if(backdrop) backdrop.onclick=()=>closeModal();
    const close=$('modalRoot').querySelector('[data-modal-close]'); if(close) close.onclick=()=>closeModal();
    if (typeof afterOpen==='function') afterOpen($('modalCard'));
  }

  function closeModal(clear=true) {
    if (state.modalCleanup) { try { state.modalCleanup(); } catch(_) {} state.modalCleanup=null; }
    $('modalRoot').classList.add('hidden');$('modalRoot').setAttribute('aria-hidden','true');$('modalCard').innerHTML='';document.body.style.overflow='';
  }

  function confirmAction(title,message,okText='Confirm',danger=false) {
    return new Promise(resolve=>{
      openModal(`<div class="modal-head"><div><span class="eyebrow">CONFIRMATION</span><h3>${escapeHTML(title)}</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><p class="confirm-copy">${escapeHTML(message).replace(/\n/g,'<br>')}</p><div class="modal-actions"><button class="btn outline" type="button" data-cancel>Cancel</button><button class="btn ${danger?'dark':'primary'}" type="button" data-ok>${escapeHTML(okText)}</button></div>`, card=>{
        card.querySelector('[data-cancel]').onclick=()=>{closeModal();resolve(false)};
        card.querySelector('[data-ok]').onclick=()=>{closeModal();resolve(true)};
      });
    });
  }

  function openStudentModal(editId='') {
    const student=editId ? classData().students.find(s=>s.id===editId) : null;
    openModal(`<div class="modal-head"><div><span class="eyebrow">STUDENT MANAGEMENT</span><h3>${editId?'Edit Student':'Add Student'}</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div>
      <form id="studentModalForm" class="modal-form"><label class="field"><span>Student Name</span><input id="modalStudentName" required maxlength="80" autocomplete="off" placeholder="Enter student name" value="${escapeHTML(student?.name||'')}"></label><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button class="btn primary" type="submit">${editId?'Save Changes':'Add Student'}</button></div></form>`, card=>{
      const form=card.querySelector('#studentModalForm');
      form.onsubmit=e=>{e.preventDefault();const ok=editId?editStudentSync(editId,card.querySelector('#modalStudentName').value):addStudent(card.querySelector('#modalStudentName').value);if(ok)closeModal();};
      setTimeout(()=>card.querySelector('#modalStudentName').focus(),30);
    });
  }

  function editStudentSync(id,name) {
    name=String(name||'').trim().replace(/\s+/g,' ');if(!name){toast('Enter student name.');return false;}
    if(classData().students.some(s=>s.id!==id&&s.name.toLowerCase()===name.toLowerCase())){toast('That student name already exists in this class.');return false;}
    const s=classData().students.find(x=>x.id===id);if(!s)return false;s.name=name;persist();renderAll();toast('Student updated.');return true;
  }

  function openNewExamModal() {
    openModal(`<div class="modal-head"><div><span class="eyebrow">EXAM MANAGEMENT</span><h3>Create New Exam</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div>
      <form id="newExamForm" class="modal-form"><label class="field"><span>Class</span><select id="modalExamClass">${CLASSES.map(c=>`<option value="${c}" ${c===state.selectedClass?'selected':''}>Class ${c}</option>`).join('')}</select></label><label class="field"><span>Exam Name</span><input id="modalExamName" required maxlength="80" placeholder="e.g. Unit Test 1"></label><label class="field"><span>Total Marks</span><input id="modalExamMarks" type="number" min="1" step="1" inputmode="numeric" value="100" required></label><label class="field"><span>Date of Exam</span><input id="modalExamDate" type="date" value="${todayISO()}" required></label><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button class="btn primary" type="submit">Create Exam</button></div></form>`,card=>{
      card.querySelector('#newExamForm').onsubmit=e=>{e.preventDefault();const ok=createExam(card.querySelector('#modalExamName').value,card.querySelector('#modalExamMarks').value,card.querySelector('#modalExamDate').value,card.querySelector('#modalExamClass').value);if(ok)closeModal();};
      setTimeout(()=>card.querySelector('#modalExamName').focus(),30);
    });
  }
  function openEditExamModal(id) {
    const e=classData().exams.find(x=>x.id===id);if(!e)return;
    openModal(`<div class="modal-head"><div><span class="eyebrow">EXAM MANAGEMENT</span><h3>Edit Exam</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div>
      <form id="editExamModalForm" class="modal-form"><label class="field"><span>Exam Name</span><input id="modalEditExamName" required maxlength="80" value="${escapeHTML(e.name)}"></label><label class="field"><span>Total Marks</span><input id="modalEditExamMarks" type="number" min="1" step="1" value="${e.totalMarks}" required></label><label class="field"><span>Date of Exam</span><input id="modalEditExamDate" type="date" value="${escapeHTML(e.date)}" required></label><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button class="btn primary" type="submit">Save Changes</button></div></form>`,card=>{
      card.querySelector('#editExamModalForm').onsubmit=ev=>{ev.preventDefault();const ok=updateExam(e,card.querySelector('#modalEditExamName').value,card.querySelector('#modalEditExamMarks').value,card.querySelector('#modalEditExamDate').value);if(ok)closeModal();};
    });
  }

  function openToolsModal() {
    openModal(`<div class="modal-head"><div><span class="eyebrow">TOOLS</span><h3>Result Manager Tools</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="tool-grid">
      <button class="tool-card" type="button" id="toolBackup"><strong>Backup Data</strong><span>Download all classes, students and exams.</span></button>
      <button class="tool-card" type="button" id="toolRestore"><strong>Restore Data</strong><span>Restore a previous JSON backup.</span></button>
      <button class="tool-card" type="button" id="toolCSV"><strong>Export CSV</strong><span>Export the selected exam table.</span></button>
      <button class="tool-card" type="button" id="toolPrint"><strong>Print Result</strong><span>Open the professional A4 report.</span></button>
      <button class="tool-card" type="button" id="toolInstall"><strong>Install App</strong><span>Install the offline PWA when supported.</span></button>
    </div>`,card=>{
      card.querySelector('#toolBackup').onclick=()=>{exportBackup();closeModal();};
      card.querySelector('#toolRestore').onclick=()=>{closeModal();$('restoreFile').click();};
      card.querySelector('#toolCSV').onclick=()=>{exportCSV();closeModal();};
      card.querySelector('#toolPrint').onclick=()=>{printResult();closeModal();};
      card.querySelector('#toolInstall').onclick=()=>{installApp();closeModal();};
    });
  }

  function printResult() {
    const e=currentExam();if(!e){toast('Create or select an exam first.');return;}
    ensureExamStudents(e);const s=stats(e);
    const rows=classData().students.map((student,i)=>{const st=e.statuses[student.id]||'pending';const value=st==='absent'?'ABSENT':(e.marks[student.id] ?? '');return `<tr><td>${i+1}</td><td>${escapeHTML(student.name)}</td><td>${escapeHTML(value)}</td></tr>`}).join('');
    $('printArea').innerHTML=`<div class="print-sheet"><div class="print-header"><img src="assets/logo.png" alt="EZEE VISION CHAMPUA"><div><div class="print-title">EZEE VISION CHAMPUA</div><div class="print-subtitle">STUDENT RESULT MANAGER PRO</div></div></div><div class="print-heading">EXAM RESULT SHEET</div><div class="print-info"><div><small>EXAM</small><strong>${escapeHTML(e.name)}</strong></div><div><small>CLASS</small><strong>Class ${state.selectedClass}</strong></div><div><small>DATE OF EXAM</small><strong>${formatDate(e.date)}</strong></div><div><small>TOTAL MARKS</small><strong>${e.totalMarks}</strong></div></div><div class="print-summary"><div><small>STUDENTS</small><strong>${s.total}</strong></div><div><small>PRESENT</small><strong>${s.present}</strong></div><div><small>ABSENT</small><strong>${s.absent}</strong></div><div><small>HIGHEST</small><strong>${s.highest??'—'}</strong></div><div><small>AVERAGE</small><strong>${s.present?s.average.toFixed(1):'—'}</strong></div></div><table class="print-table"><thead><tr><th>Sl. No.</th><th>Name of the Students</th><th>Marks</th></tr></thead><tbody>${rows||'<tr><td colspan="3">No students</td></tr>'}</tbody></table><div class="print-note">ABSENT = Student was absent in this examination.</div><div class="print-footer"><span>EZEE VISION CHAMPUA</span><span>Teacher’s Signature: ____________________</span></div></div>`;
    window.print();
  }

  function exportCSV() {
    const e=currentExam();if(!e){toast('Select an exam first.');return;}ensureExamStudents(e);
    const lines=[['Sl. No.','Name of the Students','Marks / Status']];
    classData().students.forEach((s,i)=>{const st=e.statuses[s.id]||'pending';lines.push([i+1,s.name,st==='absent'?'ABSENT':(e.marks[s.id]??'')]);});
    const csv=lines.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`Class-${state.selectedClass}-${e.name.replace(/[^\w]+/g,'-')}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('CSV exported.');
  }
  function exportBackup() {
    const payload={app:'EZEE VISION CHAMPUA — Student Result Manager Pro',backupVersion:3,createdAt:new Date().toISOString(),data:state.db};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`ezee-result-backup-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Backup downloaded.');
  }

  function importBackup(file) {
    if(!file)return;const reader=new FileReader();reader.onload=async()=>{try{const parsed=JSON.parse(reader.result);const db=normalizeDB(parsed?.data||parsed);const students=CLASSES.reduce((n,c)=>n+db.classes[c].students.length,0);const exams=CLASSES.reduce((n,c)=>n+db.classes[c].exams.length,0);if(!await confirmAction('Restore backup?',`Students: ${students}\nExams: ${exams}\n\nCurrent browser data will be replaced.`,'Restore',true))return;state.db=db;state.selectedClass='4';state.selectedExamId=null;state.search='';$('searchInput').value='';persist();renderAll();toast('Backup restored successfully.');}catch(err){console.error(err);toast('Invalid backup file.');}};reader.readAsText(file);
  }

  async function installApp() {
    if(!state.deferredPrompt){toast('Install is not available in this browser yet.');return;}
    state.deferredPrompt.prompt();await state.deferredPrompt.userChoice;state.deferredPrompt=null;$('installBtn').classList.add('hidden');toast('Install prompt completed.');
  }

  function bindEvents() {
    $('classGrid').addEventListener('click',e=>{const b=e.target.closest('[data-class]');if(b)selectClass(b.dataset.class);});
    $('classSelect').addEventListener('change',e=>selectClass(e.target.value));
    $('examSelect').addEventListener('change',e=>{state.selectedExamId=e.target.value||null;renderAll();});
    $('searchInput').addEventListener('input',e=>{state.search=e.target.value;renderTable();});
    $('newExamBtn').addEventListener('click',openNewExamModal);
    $('addStudentBtn').addEventListener('click',()=>openStudentModal());
    $('emptyState').addEventListener('click',e=>{if(e.target.closest('#emptyAddBtn'))openStudentModal();if(e.target.closest('#historyNewExam'))openNewExamModal();});
    $('saveExamBtn').addEventListener('click',saveCurrentExam);
    $('printBtn').addEventListener('click',printResult);
    $('markPendingAbsentBtn').addEventListener('click',markAllPendingAbsent);
    $('exportCsvBtn').addEventListener('click',exportCSV);
    $('backupBtn').addEventListener('click',exportBackup);
    $('restoreBtn').addEventListener('click',()=>$('restoreFile').click());
    $('toolsBtn').addEventListener('click',openToolsModal);
    $('restoreFile').addEventListener('change',e=>{importBackup(e.target.files[0]);e.target.value='';});

    $('resultBody').addEventListener('click',e=>{
      const edit=e.target.closest('.edit-student');const del=e.target.closest('.delete-student');const status=e.target.closest('[data-status-id]');
      if(edit)openStudentModal(edit.dataset.id);
      else if(del)deleteStudent(del.dataset.id);
      else if(status)toggleAbsent(status.dataset.statusId);
    });
    $('resultBody').addEventListener('change',e=>{const input=e.target.closest('[data-mark-id]');if(input)saveMark(input.dataset.markId,input.value,input);});
    $('resultBody').addEventListener('keydown',e=>{const input=e.target.closest('[data-mark-id]');if(!input||e.key!=='Enter')return;e.preventDefault();saveMark(input.dataset.markId,input.value,input);const inputs=[...document.querySelectorAll('[data-mark-id]:not(:disabled)')];const i=inputs.indexOf(input);if(i>=0&&inputs[i+1]){inputs[i+1].focus();inputs[i+1].select();}});
    $('examHistory').addEventListener('click',e=>{const open=e.target.closest('[data-open-exam]'),edit=e.target.closest('[data-edit-exam]'),dup=e.target.closest('[data-duplicate-exam]'),del=e.target.closest('[data-delete-exam]');if(open){state.selectedExamId=open.dataset.openExam;renderAll();}else if(edit)openEditExamModal(edit.dataset.editExam);else if(dup)duplicateExam(dup.dataset.duplicateExam);else if(del)deleteExam(del.dataset.deleteExam);else if(e.target.closest('#historyNewExam'))openNewExamModal();});
    $('modalRoot').addEventListener('click',e=>{if(e.target=== $('modalRoot'))closeModal();});

    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modalRoot').classList.contains('hidden'))closeModal();});
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredPrompt=e;$('installBtn').classList.remove('hidden');});
    $('installBtn').addEventListener('click',installApp);
    if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(err=>console.warn('Service worker:',err)));
  }

  bindEvents();
  renderAll();
})();

