(() => {
'use strict';

const STORAGE_KEY='ezee_student_result_manager_v1';
const BACKUP_VERSION=6;
const CLASSES=['4','5','6','7','8','9','10'];
const TEACHERS=['Shahid Sir','Enam Sir','Zeeshan Sir','Abdur Rahman Sir','Takmil Sir'];
const $=id=>document.getElementById(id);
const state={db:null,selectedClass:'4',selectedExamId:null,search:'',historySearch:'',deferredPrompt:null,modalCleanup:null};

function uid(prefix='id'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`}
function blankDB(){const classes={};CLASSES.forEach(c=>classes[c]={students:[],exams:[]});return{version:1,classes}}
function normalizeDB(raw){
  const db=raw&&typeof raw==='object'?raw:blankDB();
  if(!db.classes||typeof db.classes!=='object')db.classes={};
  CLASSES.forEach(c=>{
    const d=db.classes[c]&&typeof db.classes[c]==='object'?db.classes[c]:{};
    d.students=Array.isArray(d.students)?d.students:[];
    d.exams=Array.isArray(d.exams)?d.exams:[];
    d.students=d.students.filter(s=>s&&s.id&&typeof s.name==='string'&&s.name.trim()).map(s=>({id:String(s.id),name:s.name.trim()}));
    d.exams=d.exams.filter(e=>e&&e.id).map(e=>{
      const marks=e.marks&&typeof e.marks==='object'?{...e.marks}:{};
      const statuses=e.statuses&&typeof e.statuses==='object'?{...e.statuses}:{};
      d.students.forEach(s=>{
        if(!(s.id in marks)) marks[s.id]='';
        if(!statuses[s.id]) statuses[s.id]=(marks[s.id]===''?'pending':'present');
        if(!['pending','present','absent'].includes(statuses[s.id])) statuses[s.id]=(marks[s.id]===''?'pending':'present');
        if(statuses[s.id]==='absent') marks[s.id]='';
      });
      return{id:String(e.id),name:String(e.name||e.title||'Exam').trim()||'Exam',totalMarks:Math.max(1,Number(e.totalMarks)||100),date:String(e.date||''),teacherSignature:TEACHERS.includes(String(e.teacherSignature||''))?String(e.teacherSignature):'',marks,statuses};
    });
    db.classes[c]=d;
  });
  db.version=1;return db;
}
function loadDB(){try{const raw=localStorage.getItem(STORAGE_KEY);return normalizeDB(raw?JSON.parse(raw):null)}catch(e){console.warn('Storage load failed',e);return blankDB()}}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.db));if($('saveBadge'))$('saveBadge').textContent='Saved locally';return true}catch(e){toast('Could not save data in this browser.');return false}}
function classData(){return state.db.classes[state.selectedClass]}
function currentExam(){return classData().exams.find(e=>e.id===state.selectedExamId)||null}
function todayISO(){return new Date().toISOString().slice(0,10)}
function formatDate(iso){if(!iso)return'—';const d=new Date(`${iso}T00:00:00`);return Number.isNaN(d.getTime())?iso:d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2200)}
function ensureExamStudents(exam){if(!exam)return;classData().students.forEach(s=>{if(!(s.id in exam.marks))exam.marks[s.id]='';if(!exam.statuses[s.id])exam.statuses[s.id]=(exam.marks[s.id]===''?'pending':'present')})}
function stats(exam){if(!exam)return{total:classData().students.length,present:0,absent:0,pending:classData().students.length,highest:null,average:0};ensureExamStudents(exam);let present=0,absent=0,pending=0,vals=[];classData().students.forEach(s=>{const st=exam.statuses[s.id]||'pending';if(st==='absent')absent++;else if(st==='present'&&exam.marks[s.id]!==''){present++;const n=Number(exam.marks[s.id]);if(Number.isFinite(n))vals.push(n)}else pending++});return{total:classData().students.length,present,absent,pending,highest:vals.length?Math.max(...vals):null,average:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}}

function renderAll(){renderClassGrid();renderExamSelect();renderExamInfo();renderAnalytics();renderTable();renderHistory();renderDashboardOverview()}
function renderClassGrid(){$('classGrid').innerHTML=CLASSES.map(c=>{const d=state.db.classes[c];return`<button class="class-card${c===state.selectedClass?' active':''}" type="button" data-class="${c}"><b>Class ${c}</b><span>${d.students.length} ${d.students.length===1?'Student':'Students'} · ${d.exams.length} ${d.exams.length===1?'Exam':'Exams'}</span></button>`}).join('');$('classSelect').value=state.selectedClass}
function renderExamSelect(){const exams=classData().exams.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));if(!state.selectedExamId||!exams.some(e=>e.id===state.selectedExamId))state.selectedExamId=exams[0]?.id||null;$('examSelect').innerHTML='<option value="">No exam selected</option>'+exams.map(e=>`<option value="${escapeHTML(e.id)}">${escapeHTML(e.name)} — ${formatDate(e.date)}</option>`).join('');$('examSelect').value=state.selectedExamId||''}
function renderExamInfo(){const e=currentExam();$('totalMarks').value=e?e.totalMarks:'';$('examDate').value=e?e.date:'';$('examCaption').textContent=e?`${e.name} · ${formatDate(e.date)} · Maximum ${e.totalMarks}`:'No exam selected';$('printBtn').disabled=!e;$('saveExamBtn').disabled=!e}
function renderAnalytics(){const s=stats(currentExam());const cards=[['Students',s.total,''],['Present',s.present,''],['Absent',s.absent,'absent'],['Pending',s.pending,'pending'],['Highest',s.highest??'—',''],['Average',s.present?s.average.toFixed(1):'—','']];$('analytics').innerHTML=cards.map(x=>`<div class="stat ${x[2]}"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('')}
function renderTable(){const students=classData().students,e=currentExam();if(e)ensureExamStudents(e);const q=state.search.trim().toLowerCase(),filtered=students.filter(s=>s.name.toLowerCase().includes(q));$('studentCount').textContent=`${students.length} ${students.length===1?'Student':'Students'}`;$('pendingCount').textContent=`${e?stats(e).pending:0} Pending`;$('markPendingAbsentBtn').disabled=!e||!stats(e).pending;$('exportCsvBtn').disabled=!e;$('entryTip').classList.toggle('hidden',!e||!students.length);$('emptyState').classList.toggle('hidden',filtered.length>0);if(!filtered.length){$('resultBody').innerHTML='';return}$('resultBody').innerHTML=filtered.map(student=>{const status=e?(e.statuses[student.id]||'pending'):'pending';const absent=status==='absent';const raw=e?(e.marks[student.id]??''):'';const value=absent?'':escapeHTML(raw);return`<tr><td>${students.indexOf(student)+1}</td><td><button class="student-name student-profile-btn" type="button" data-profile-id="${escapeHTML(student.id)}">${escapeHTML(student.name)}</button><div class="row-actions"><button class="mini edit-student" type="button" data-id="${escapeHTML(student.id)}">Edit</button><button class="mini delete delete-student" type="button" data-id="${escapeHTML(student.id)}">Delete</button></div></td><td><div class="mark-row"><input class="mark-input" data-mark-id="${escapeHTML(student.id)}" type="text" inputmode="decimal" autocomplete="off" value="${value}" ${!e||absent?'disabled':''} placeholder="${e?'Marks':'—'}" aria-label="Marks for ${escapeHTML(student.name)}">${e?`<button class="status-btn ${absent?'active':''}" type="button" data-status-id="${escapeHTML(student.id)}" aria-label="${absent?'Mark student present':'Mark student absent'}" title="${absent?'Return to marks entry':'Mark as absent'}">${absent?'Present':'Absent'}</button>`:''}</div>${absent?'<div class="status-note absent">ABSENT</div>':status==='pending'?'<div class="status-note">Pending</div>':''}</td></tr>`}).join('')}
function renderHistory(){
  const query=String(state.historySearch||'').trim().toLowerCase();
  const exams=classData().exams.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).filter(e=>!query||`${e.name} ${e.date}`.toLowerCase().includes(query));
  if(!exams.length){
    const hasAny=classData().exams.length>0;
    $('examHistory').innerHTML=hasAny?`<div class="empty"><div class="empty-icon">⌕</div><h3>No matching exams</h3><p>Try another exam name or clear the search.</p></div>`:`<div class="empty"><div class="empty-icon">◷</div><h3>No exams yet</h3><p>Create a new exam to start saving marks.</p><button id="historyNewExam" class="btn primary" type="button">Create First Exam</button></div>`;
    return;
  }
  $('examHistory').innerHTML=exams.map(e=>{
    const st=stats(e);
    const status=st.pending===0&&st.total>0?'Completed':'Draft';
    return `<article class="history${e.id===state.selectedExamId?' current':''}">
      <div class="history-top"><div class="history-name">${escapeHTML(e.name)}</div><span class="pill ${status==='Completed'?'complete':'pending'}">${status}</span></div>
      <div class="history-meta">${formatDate(e.date)} · Class ${state.selectedClass} · Total ${e.totalMarks}<br>${st.present} present · ${st.absent} absent · ${st.pending} pending · Avg ${st.present?st.average.toFixed(1):'—'}</div>
      <div class="history-actions"><button type="button" data-open-exam="${escapeHTML(e.id)}">Open</button><button type="button" data-edit-exam="${escapeHTML(e.id)}">Edit</button><button type="button" data-duplicate-exam="${escapeHTML(e.id)}">Duplicate</button><button class="danger" type="button" data-delete-exam="${escapeHTML(e.id)}">Delete</button></div>
    </article>`;
  }).join('');
}
function renderDashboardOverview(){
  const latestByClass=CLASSES.map(c=>{
    const d=state.db.classes[c];
    const exams=d.exams.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const latest=exams[0];
    const st=latest?statsForClass(c,latest):{total:d.students.length,present:0,absent:0,pending:d.students.length,average:0,highest:null};
    const pct=latest&&st.present&&latest.totalMarks?((st.average/latest.totalMarks)*100):0;
    return {c,d,latest,st,pct};
  });
  $('dashboardOverview').innerHTML=latestByClass.map(x=>`<button class="dashboard-card ${x.c===state.selectedClass?'active':''}" type="button" data-dashboard-class="${x.c}">
    <div class="dashboard-card-head"><strong>Class ${x.c}</strong><span>${x.latest?escapeHTML(x.latest.name):'No exam'}</span></div>
    <div class="dashboard-card-stats"><span><b>${x.d.students.length}</b>Students</span><span><b>${x.d.exams.length}</b>Exams</span><span><b>${x.latest?(x.st.present+'/'+x.st.total):'—'}</b>Present</span></div>
    <div class="dashboard-card-foot"><span>${x.latest?`Avg ${x.pct.toFixed(1)}%`:'Ready to start'}</span><span>Open →</span></div>
  </button>`).join('');
}
function statsForClass(cls,exam){
  const d=state.db.classes[String(cls)];
  if(!exam)return{total:d.students.length,present:0,absent:0,pending:d.students.length,highest:null,average:0};
  d.students.forEach(st=>{if(!(st.id in exam.marks))exam.marks[st.id]='';if(!exam.statuses[st.id])exam.statuses[st.id]=exam.marks[st.id]===''?'pending':'present'});
  let present=0,absent=0,pending=0,vals=[];
  d.students.forEach(st=>{const status=exam.statuses[st.id]||'pending';if(status==='absent')absent++;else if(status==='present'&&exam.marks[st.id]!==''){present++;const n=Number(exam.marks[st.id]);if(Number.isFinite(n))vals.push(n)}else pending++});
  return{total:d.students.length,present,absent,pending,highest:vals.length?Math.max(...vals):null,average:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0};
}

function selectClass(c){if(!CLASSES.includes(String(c)))return;state.selectedClass=String(c);state.selectedExamId=classData().exams[0]?.id||null;state.search='';state.historySearch='';$('searchInput').value='';$('historySearch').value='';renderAll()}
function createExam(name,totalMarks,date,cls){const clean=String(name||'').trim(),total=Number(totalMarks),target=state.db.classes[String(cls)];if(!clean){toast('Enter an exam name.');return false}if(!Number.isInteger(total)||total<1){toast('Total Marks must be a positive whole number.');return false}if(!CLASSES.includes(String(cls))||!target){toast('Invalid class.');return false}if(target.exams.some(e=>e.name.toLowerCase()===clean.toLowerCase()&&e.date===date)){toast('An exam with this name and date already exists.');return false}const exam={id:uid('exam'),name:clean,totalMarks:total,date:date||todayISO(),teacherSignature:'',marks:{},statuses:{}};target.students.forEach(s=>{exam.marks[s.id]='';exam.statuses[s.id]='pending'});target.exams.push(exam);state.selectedClass=String(cls);state.selectedExamId=exam.id;state.search='';$('searchInput').value='';persist();renderAll();toast('New exam created successfully.');return true}
function saveCurrentExam(){const e=currentExam();if(!e){toast('Create or select an exam first.');return}const total=Number($('totalMarks').value),date=$('examDate').value;if(!Number.isInteger(total)||total<1){toast('Enter valid Total Marks.');return}ensureExamStudents(e);for(const id of Object.keys(e.marks)){if(e.statuses[id]==='absent')continue;if(e.marks[id]!==''&&e.marks[id]!=null){const n=Number(e.marks[id]);if(!Number.isFinite(n)||n<0||n>total){toast(`Invalid marks found. Each mark must be between 0 and ${total}.`);return}}}e.totalMarks=total;e.date=date||e.date||todayISO();persist();renderAll();toast('Exam saved successfully.')}
function addStudent(name){const clean=String(name||'').trim().replace(/\s+/g,' ');if(!clean){toast('Enter student name.');return false}const d=classData();if(d.students.some(s=>s.name.toLowerCase()===clean.toLowerCase())){toast('That student already exists in this class.');return false}const student={id:uid('student'),name:clean};d.students.push(student);d.exams.forEach(e=>{e.marks[student.id]='';e.statuses[student.id]='pending'});persist();renderAll();toast('Student added successfully.');return true}
async function editStudent(id,name){const student=classData().students.find(s=>s.id===id);if(!student)return;const clean=String(name||'').trim().replace(/\s+/g,' ');if(!clean){toast('Enter student name.');return}if(classData().students.some(s=>s.id!==id&&s.name.toLowerCase()===clean.toLowerCase())){toast('That student name already exists in this class.');return}student.name=clean;persist();renderAll();toast('Student updated.')}
async function deleteStudent(id){const s=classData().students.find(x=>x.id===id);if(!s)return;if(!await confirmAction('Delete student?',`Are you sure you want to delete ${s.name}? Their records will be removed from this class's exams.`,'Delete',true))return;classData().students=classData().students.filter(x=>x.id!==id);classData().exams.forEach(e=>{delete e.marks[id];delete e.statuses[id]});persist();renderAll();toast('Student deleted.')}
function updateExam(exam,name,totalMarks,date){const clean=String(name||'').trim(),total=Number(totalMarks);if(!clean||!Number.isInteger(total)||total<1){toast('Enter valid exam details.');return false}if(classData().exams.some(e=>e.id!==exam.id&&e.name.toLowerCase()===clean.toLowerCase()&&e.date===date)){toast('Another exam has the same name and date.');return false}ensureExamStudents(exam);for(const id of Object.keys(exam.marks)){if(exam.statuses[id]==='absent')continue;if(exam.marks[id]!==''&&exam.marks[id]!=null){const n=Number(exam.marks[id]);if(!Number.isFinite(n)||n<0||n>total){toast(`Invalid marks found. Each mark must be between 0 and ${total}.`);return false}}}exam.name=clean;exam.totalMarks=total;exam.date=date||exam.date||todayISO();persist();renderAll();toast('Exam updated.');return true}
async function deleteExam(id){const exam=classData().exams.find(e=>e.id===id);if(!exam)return;if(!await confirmAction('Delete exam?',`Delete “${exam.name}” and all marks/status saved in it?`,'Delete',true))return;classData().exams=classData().exams.filter(e=>e.id!==id);if(state.selectedExamId===id)state.selectedExamId=classData().exams[0]?.id||null;persist();renderAll();toast('Exam deleted.')}
function duplicateExam(id){const source=classData().exams.find(e=>e.id===id);if(!source)return;const copy={id:uid('exam'),name:`${source.name} — Copy`,totalMarks:source.totalMarks,date:todayISO(),teacherSignature:'',marks:{},statuses:{}};classData().students.forEach(s=>{copy.marks[s.id]='';copy.statuses[s.id]='pending'});classData().exams.push(copy);state.selectedExamId=copy.id;persist();renderAll();toast('Exam duplicated with fresh marks.')}
function saveMark(id,raw,input){const e=currentExam();if(!e)return;ensureExamStudents(e);if(e.statuses[id]==='absent'){toast('Student is marked absent.');return}const value=String(raw??'').trim();if(value===''){e.marks[id]='';e.statuses[id]='pending';input.classList.remove('invalid','saved');persist();renderAnalytics();renderHistory();return}if(!/^(?:\d+\.?\d*|\.\d+)$/.test(value)){input.classList.add('invalid');toast('Enter a valid number.');return}const n=Number(value);const valid=Number.isFinite(n)&&n>=0&&n<=e.totalMarks;if(!valid){input.classList.add('invalid');toast(`Marks must be between 0 and ${e.totalMarks}.`);return}e.marks[id]=n;e.statuses[id]='present';input.classList.remove('invalid');persist();input.classList.add('saved');setTimeout(()=>input.classList.remove('saved'),350);renderAnalytics();renderHistory()}
// Status toggle is intentionally handled by delegated click so it works for
// dynamically rendered rows. Mark-entry blur never rebuilds the table.
async function toggleAbsent(id){const e=currentExam();if(!e)return;ensureExamStudents(e);if(e.statuses[id]==='absent'){e.statuses[id]=e.marks[id]===''?'pending':'present';persist();renderAll();toast('Student returned to marks entry.');return}const student=classData().students.find(s=>s.id===id);if(!await confirmAction('Mark student absent?',`${student?.name||'This student'} will print as ABSENT.`,'Mark Absent'))return;e.statuses[id]='absent';e.marks[id]='';persist();renderAll();toast('Student marked absent.')}
async function markAllPendingAbsent(){const e=currentExam();if(!e){toast('Select an exam first.');return}ensureExamStudents(e);const pending=classData().students.filter(s=>(e.statuses[s.id]||'pending')==='pending');if(!pending.length){toast('No pending students.');return}if(!await confirmAction('Mark all pending as Absent?',`${pending.length} students will be marked ABSENT.`,'Mark Absent'))return;pending.forEach(s=>{e.statuses[s.id]='absent';e.marks[s.id]=''});persist();renderAll();toast(`${pending.length} students marked absent.`)}

function openModal(html,afterOpen){closeModal(false);$('modalCard').innerHTML=html;$('modalRoot').classList.remove('hidden');$('modalRoot').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';const close=$('modalCard').querySelector('[data-modal-close]');if(close)close.onclick=()=>closeModal();if(typeof afterOpen==='function')afterOpen($('modalCard'))}
function closeModal(){if(state.modalCleanup)try{state.modalCleanup()}catch(_){ }state.modalCleanup=null;$('modalRoot').classList.add('hidden');$('modalRoot').setAttribute('aria-hidden','true');$('modalCard').innerHTML='';document.body.style.overflow=''}
function confirmAction(title,message,okText='Confirm',danger=false){return new Promise(resolve=>{openModal(`<div class="modal-head"><div><span class="eyebrow">CONFIRMATION</span><h3>${escapeHTML(title)}</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><p class="confirm-copy">${escapeHTML(message)}</p><div class="modal-actions"><button class="btn outline" id="confirmCancel" type="button">Cancel</button><button class="btn ${danger?'dark':'primary'}" id="confirmOk" type="button">${escapeHTML(okText)}</button></div>`,card=>{card.querySelector('#confirmCancel').onclick=()=>{closeModal();resolve(false)};card.querySelector('#confirmOk').onclick=()=>{closeModal();resolve(true)};state.modalCleanup=()=>resolve(false)})})}
function openStudentModal(id=''){const existing=id?classData().students.find(s=>s.id===id):null;openModal(`<div class="modal-head"><div><span class="eyebrow">STUDENT</span><h3>${id?'Edit Student':'Add Student'}</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><form id="studentForm" class="modal-form"><label class="field"><span>Student Name</span><input id="modalStudentName" type="text" maxlength="100" autocomplete="off" value="${escapeHTML(existing?.name||'')}" required></label><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button class="btn primary" type="submit">${id?'Save Changes':'Add Student'}</button></div></form>`,card=>{card.querySelector('#studentForm').onsubmit=async e=>{e.preventDefault();const ok=id?await editStudent(id,card.querySelector('#modalStudentName').value):addStudent(card.querySelector('#modalStudentName').value);if(ok!==false)closeModal()};setTimeout(()=>card.querySelector('#modalStudentName').focus(),30)})}
function openNewExamModal(){openModal(`<div class="modal-head"><div><span class="eyebrow">EXAM SETUP</span><h3>Create New Exam</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><form id="examForm" class="modal-form"><label class="field"><span>Class</span><select id="modalExamClass">${CLASSES.map(c=>`<option value="${c}" ${c===state.selectedClass?'selected':''}>Class ${c}</option>`).join('')}</select></label><label class="field"><span>Exam Name</span><input id="modalExamName" maxlength="100" placeholder="e.g. August Test" required></label><label class="field"><span>Total Marks</span><input id="modalExamMarks" type="number" min="1" step="1" inputmode="numeric" value="100" required></label><label class="field"><span>Date of Exam</span><input id="modalExamDate" type="date" value="${todayISO()}" required></label><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button class="btn primary" type="submit">Create Exam</button></div></form>`,card=>{card.querySelector('#examForm').onsubmit=e=>{e.preventDefault();if(createExam(card.querySelector('#modalExamName').value,card.querySelector('#modalExamMarks').value,card.querySelector('#modalExamDate').value,card.querySelector('#modalExamClass').value))closeModal()};setTimeout(()=>card.querySelector('#modalExamName').focus(),30)})}
function openEditExamModal(id){const e=classData().exams.find(x=>x.id===id);if(!e)return;openModal(`<div class="modal-head"><div><span class="eyebrow">EXAM MANAGEMENT</span><h3>Edit Exam</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><form id="editExamForm" class="modal-form"><label class="field"><span>Exam Name</span><input id="modalEditExamName" maxlength="100" value="${escapeHTML(e.name)}" required></label><label class="field"><span>Total Marks</span><input id="modalEditExamMarks" type="number" min="1" step="1" value="${e.totalMarks}" required></label><label class="field"><span>Date of Exam</span><input id="modalEditExamDate" type="date" value="${escapeHTML(e.date)}" required></label><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button class="btn primary" type="submit">Save Changes</button></div></form>`,card=>{card.querySelector('#editExamForm').onsubmit=eve=>{eve.preventDefault();if(updateExam(e,card.querySelector('#modalEditExamName').value,card.querySelector('#modalEditExamMarks').value,card.querySelector('#modalEditExamDate').value))closeModal()}})}
function openToolsModal(){openModal(`<div class="modal-head"><div><span class="eyebrow">TOOLS</span><h3>Result Manager Tools</h3><p class="muted">Advanced result-management controls.</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="tool-grid"><button class="tool-card" type="button" id="toolInsights"><strong>Result Intelligence</strong><span>Exam-wise performance and top performers.</span></button><button class="tool-card" type="button" id="toolPerformance"><strong>Class Performance</strong><span>Compare all exams for the selected class.</span></button><button class="tool-card" type="button" id="toolRanking"><strong>Class Ranking</strong><span>Percentage-based ranking with tied ranks.</span></button><button class="tool-card" type="button" id="toolSnapshot"><strong>Class Snapshot</strong><span>Latest exam summary and top performers.</span></button><button class="tool-card" type="button" id="toolSearch"><strong>Global Student Search</strong><span>Find a student across all seven classes.</span></button><button class="tool-card" type="button" id="toolBackup"><strong>Backup Data</strong><span>Download all classes, students and exams.</span></button><button class="tool-card" type="button" id="toolTransfer"><strong>Transfer Data</strong><span>Share the backup directly to another mobile.</span></button><button class="tool-card" type="button" id="toolRestore"><strong>Restore Data</strong><span>Import a JSON backup safely.</span></button><button class="tool-card" type="button" id="toolHealth"><strong>Data Health</strong><span>Check records and mark validity.</span></button><button class="tool-card" type="button" id="toolCSV"><strong>Export CSV</strong><span>Export the selected exam table.</span></button><button class="tool-card" type="button" id="toolPrint"><strong>Print Result</strong><span>Choose the teacher and print the A4 report.</span></button><button class="tool-card" type="button" id="toolInstall"><strong>Install App</strong><span>Use the native PWA install prompt when available.</span></button></div>`,card=>{card.querySelector('#toolInsights').onclick=()=>{closeModal();openResultIntelligenceModal()};card.querySelector('#toolPerformance').onclick=()=>{closeModal();openClassPerformanceModal()};card.querySelector('#toolRanking').onclick=()=>{closeModal();openRankingModal()};card.querySelector('#toolSnapshot').onclick=()=>{closeModal();openClassSnapshotModal()};card.querySelector('#toolSearch').onclick=()=>{closeModal();openGlobalSearchModal()};card.querySelector('#toolBackup').onclick=()=>{exportBackup();closeModal()};card.querySelector('#toolTransfer').onclick=()=>{shareBackup();closeModal()};card.querySelector('#toolRestore').onclick=()=>{closeModal();$('restoreFile').click()};card.querySelector('#toolHealth').onclick=()=>{closeModal();openDataHealthModal()};card.querySelector('#toolCSV').onclick=()=>{exportCSV();closeModal()};card.querySelector('#toolPrint').onclick=()=>{closeModal();openPrintOptionsModal()};card.querySelector('#toolInstall').onclick=()=>{closeModal();installApp()}})}

function openPrintOptionsModal(){const e=currentExam();if(!e){toast('Create or select an exam first.');return}const selected=TEACHERS.includes(e.teacherSignature)?e.teacherSignature:TEACHERS[0];openModal(`<div class="modal-head"><div><span class="eyebrow">PRINT SETTINGS</span><h3>Teacher Signature</h3><p class="muted">Choose the teacher whose signature name will appear on this exam report.</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><form id="signatureForm" class="modal-form"><div class="signature-options">${TEACHERS.map((t,i)=>`<label class="signature-option"><input type="radio" name="teacherSignature" value="${escapeHTML(t)}" ${t===selected?'checked':''}><span><strong>${i+1}. ${escapeHTML(t)}</strong><small>Teacher Signature</small></span></label>`).join('')}</div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button class="btn dark" type="submit">Print Result</button></div></form>`,card=>{card.querySelector('#signatureForm').onsubmit=eve=>{eve.preventDefault();const chosen=card.querySelector('input[name="teacherSignature"]:checked')?.value||TEACHERS[0];e.teacherSignature=chosen;persist();closeModal();setTimeout(()=>printResult(e),50)}})}
async function printResult(exam=currentExam()){
  if(!exam){toast('Select an exam first.');return}
  ensureExamStudents(exam);
  const s=stats(exam);
  const teacher=TEACHERS.includes(exam.teacherSignature)?exam.teacherSignature:TEACHERS[0];
  const rows=classData().students.map((st,i)=>{
    const status=exam.statuses[st.id]||'pending';
    const raw=exam.marks[st.id];
    const value=status==='absent'?'ABSENT':raw===''||raw==null?'—':raw;
    return `<tr><td>${i+1}</td><td>${escapeHTML(st.name)}</td><td class="${status==='absent'?'print-absent':''}">${escapeHTML(value)}</td></tr>`;
  }).join('');
  const completion=s.total?Math.round(((s.present+s.absent)/s.total)*100):0;
  $('printArea').innerHTML=`<div class="print-sheet"><div class="print-border"><div class="print-header"><img src="assets/image.svg.png" alt="EZEE VISION CHAMPUA" decoding="sync"><div><div class="print-title">EZEE VISION CHAMPUA</div><div class="print-subtitle">STUDENT RESULT MANAGER PRO</div></div></div><div class="print-heading">EXAM RESULT SHEET</div><div class="print-info"><div><small>Exam</small><strong>${escapeHTML(exam.name)}</strong></div><div><small>Class</small><strong>Class ${state.selectedClass}</strong></div><div><small>Date</small><strong>${formatDate(exam.date)}</strong></div><div><small>Total Marks</small><strong>${exam.totalMarks}</strong></div></div><div class="print-summary"><div><small>Students</small><strong>${s.total}</strong></div><div><small>Present</small><strong>${s.present}</strong></div><div><small>Absent</small><strong>${s.absent}</strong></div><div><small>Highest</small><strong>${s.highest??'—'}</strong></div><div><small>Average</small><strong>${s.present?s.average.toFixed(1):'—'}</strong></div></div><div class="print-completion">Result Entry Completion: <b>${completion}%</b></div><table class="print-table"><thead><tr><th>Sl. No.</th><th>Name of the Students</th><th>Marks</th></tr></thead><tbody>${rows||'<tr><td colspan="3">No students</td></tr>'}</tbody></table><div class="print-note">ABSENT = Student was absent in this examination. Pending entries are left blank.</div><div class="print-signature-row"><div class="signature-box"><strong>${escapeHTML(teacher)}</strong><div class="signature-line"></div><small>Teacher’s Signature</small></div></div><div class="print-footer"><span>Class ${state.selectedClass} · ${escapeHTML(exam.name)}</span><span>Generated on ${formatDate(todayISO())}</span></div></div></div>`;
  const logo=$('printArea').querySelector('.print-header img');
  if(logo){
    try{if(logo.decode) await logo.decode();}catch(_){ }
    if(!logo.complete){await new Promise(resolve=>{logo.addEventListener('load',resolve,{once:true});logo.addEventListener('error',resolve,{once:true});setTimeout(resolve,1800);});}
  }
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  window.print();
}
function exportCSV(){const e=currentExam();if(!e){toast('Select an exam first.');return}ensureExamStudents(e);const rows=[['Sl. No.','Name of the Students','Marks / Status']];classData().students.forEach((s,i)=>rows.push([i+1,s.name,e.statuses[s.id]==='absent'?'ABSENT':e.marks[s.id]??'']));const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`Class-${state.selectedClass}-${e.name.replace(/[^\w]+/g,'-')}.csv`);toast('CSV exported.')}
function buildBackupPayload(){return{app:'EZEE VISION CHAMPUA — Student Result Manager Pro',backupVersion:BACKUP_VERSION,createdAt:new Date().toISOString(),data:state.db}}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
function backupBlob(){return new Blob([JSON.stringify(buildBackupPayload(),null,2)],{type:'application/json'})}
function exportBackup(){downloadBlob(backupBlob(),`ezee-result-backup-${todayISO()}.json`);toast('Backup downloaded.')}
async function shareBackup(){const blob=backupBlob(),file=new File([blob],`ezee-result-backup-${todayISO()}.json`,{type:'application/json'});try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'EZEE VISION CHAMPUA Result Backup',text:'Student Result Manager backup',files:[file]});toast('Backup shared successfully.')}else{exportBackup();toast('Sharing is not supported here. Backup downloaded instead.')}}catch(e){if(e?.name!=='AbortError')exportBackup()}}
async function restoreBackup(file){if(!file)return;try{const raw=JSON.parse(await file.text()),normalized=normalizeDB(raw?.data||raw);const students=CLASSES.reduce((n,c)=>n+normalized.classes[c].students.length,0),exams=CLASSES.reduce((n,c)=>n+normalized.classes[c].exams.length,0);if(!await confirmAction('Restore backup?',`This will replace the current browser data. Backup contains ${students} students and ${exams} exams.`,'Restore',true))return;exportBackup();state.db=normalized;state.selectedClass='4';state.selectedExamId=state.db.classes['4'].exams[0]?.id||null;state.search='';state.historySearch='';$('searchInput').value='';$('historySearch').value='';persist();renderAll();toast('Backup restored successfully.')}catch(e){console.error(e);toast('Invalid backup file.')}finally{$('restoreFile').value=''}}
function openDataHealthModal(){
  let totalStudents=0,totalExams=0,totalMarks=0,invalid=0,duplicates=0,orphanMarks=0,orphanStatuses=0,invalidStatus=0;
  CLASSES.forEach(c=>{const d=state.db.classes[c];totalStudents+=d.students.length;totalExams+=d.exams.length;const names=new Set();d.students.forEach(st=>{const key=st.name.trim().toLowerCase();if(names.has(key))duplicates++;names.add(key)});d.exams.forEach(e=>{totalMarks+=Object.values(e.marks||{}).filter(v=>v!=='').length;const studentIds=new Set(d.students.map(st=>st.id));Object.keys(e.marks||{}).forEach(id=>{if(!studentIds.has(id))orphanMarks++;const raw=e.marks[id];if(raw!==''&&raw!=null){const n=Number(raw);if(!Number.isFinite(n)||n<0||n>e.totalMarks)invalid++}});Object.keys(e.statuses||{}).forEach(id=>{if(!studentIds.has(id))orphanStatuses++;if(!['pending','present','absent'].includes(e.statuses[id]))invalidStatus++})})});
  const problems=invalid+duplicates+orphanMarks+orphanStatuses+invalidStatus,ok=problems===0;
  openModal(`<div class="modal-head"><div><span class="eyebrow">DATA HEALTH</span><h3>${ok?'Everything looks healthy':'Attention required'}</h3><p class="muted">A complete consistency check of stored result data.</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="health-box ${ok?'ok':'bad'}"><strong>${ok?'No data problems found':'Problems detected: '+problems}</strong><p>${ok?'Classes, students, exams, statuses and marks are consistent.':'Review the details below before relying on a backup.'}</p></div><div class="health-grid"><div class="health-box"><strong>Invalid marks</strong><p>${invalid}</p></div><div class="health-box"><strong>Duplicate students</strong><p>${duplicates}</p></div><div class="health-box"><strong>Orphan marks</strong><p>${orphanMarks}</p></div><div class="health-box"><strong>Orphan statuses</strong><p>${orphanStatuses}</p></div><div class="health-box"><strong>Invalid statuses</strong><p>${invalidStatus}</p></div><div class="health-box"><strong>Storage summary</strong><p>7 classes · ${totalStudents} students · ${totalExams} exams · ${totalMarks} marks</p></div></div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Close</button></div>`);
}

function openResultIntelligenceModal(){
  const d=classData(),exams=d.exams.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(!exams.length){
    openModal(`<div class="modal-head"><div><span class="eyebrow">RESULT INTELLIGENCE</span><h3>No exams yet</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><p class="confirm-copy">Create an exam to see class performance insights.</p><div class="modal-actions"><button class="btn primary" type="button" id="insightCreate">Create Exam</button></div>`,card=>card.querySelector('#insightCreate').onclick=()=>{closeModal();openNewExamModal()});
    return;
  }
  const cards=exams.map(e=>{
    const s=stats(e),pct=s.present&&e.totalMarks?(s.average/e.totalMarks*100):0;
    const ranked=d.students.map(st=>{const stt=e.statuses[st.id]||'pending';const n=Number(e.marks[st.id]);return{...st,status:stt,mark:Number.isFinite(n)?n:null,pct:Number.isFinite(n)&&e.totalMarks?n/e.totalMarks*100:null}}).filter(x=>x.status==='present'&&x.mark!==null).sort((a,b)=>b.pct-a.pct);
    const top=ranked.slice(0,3).map((x,i)=>`${i+1}. ${escapeHTML(x.name)} — ${x.mark} (${x.pct.toFixed(1)}%)`).join('<br>')||'No completed marks yet';
    return `<div class="health-box"><strong>${escapeHTML(e.name)}</strong><p>${formatDate(e.date)} · ${s.present}/${s.total} present · ${s.absent} absent · ${s.pending} pending<br>Average: ${s.present?pct.toFixed(1)+'%':'—'} · Highest: ${s.highest??'—'}</p><div class="insight-top">${top}</div></div>`;
  }).join('');
  openModal(`<div class="modal-head"><div><span class="eyebrow">RESULT INTELLIGENCE</span><h3>Class ${state.selectedClass}</h3><p class="muted">Exam-wise performance and top performers.</p></div><button class="close-modal" type="button" data-modal-close>×</button></div>${cards}<div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Close</button></div>`);
}
function openStudentProfileModal(id){
  const student=classData().students.find(s=>s.id===id);if(!student)return;
  const exams=classData().exams.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  let appeared=0,absent=0,pending=0,percentages=[];
  const rows=exams.map((e,i)=>{const st=e.statuses[id]||'pending';if(st==='absent')absent++;else if(st==='present'&&e.marks[id]!==''){appeared++;const n=Number(e.marks[id]);if(Number.isFinite(n))percentages.push(n/e.totalMarks*100)}else pending++;const mark=st==='absent'?'ABSENT':e.marks[id]===''?'—':e.marks[id];return`<tr><td>${i+1}</td><td>${escapeHTML(e.name)}<small>${formatDate(e.date)}</small></td><td>${escapeHTML(mark)}</td></tr>`}).join('');
  const avg=percentages.length?percentages.reduce((a,b)=>a+b,0)/percentages.length:0;
  openModal(`<div class="modal-head"><div><span class="eyebrow">STUDENT RESULT PROFILE</span><h3>${escapeHTML(student.name)}</h3><p class="profile-subtitle">Class ${state.selectedClass}</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="profile-stats"><div><small>EXAMS</small><strong>${exams.length}</strong></div><div><small>APPEARED</small><strong>${appeared}</strong></div><div><small>ABSENT</small><strong>${absent}</strong></div><div><small>PENDING</small><strong>${pending}</strong></div><div><small>AVERAGE %</small><strong>${percentages.length?avg.toFixed(1):'—'}</strong></div><div><small>BEST %</small><strong>${percentages.length?Math.max(...percentages).toFixed(1):'—'}</strong></div></div><div class="profile-table-wrap"><table class="profile-table"><thead><tr><th>#</th><th>Exam</th><th>Marks</th></tr></thead><tbody>${rows||'<tr><td colspan="3">No exams</td></tr>'}</tbody></table></div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Close</button><button class="btn dark" type="button" id="printStudentReportBtn">Print Report</button></div>`,card=>{card.querySelector('#printStudentReportBtn').onclick=()=>{closeModal();setTimeout(()=>printStudentReport(id),60)}});
}

function openRankingModal(){
  const d=classData(),e=currentExam();
  if(!e){toast('Create or select an exam first.');return}
  const ranked=d.students.map(st=>{const status=e.statuses[st.id]||'pending';const n=Number(e.marks[st.id]);return{name:st.name,mark:Number.isFinite(n)?n:null,pct:Number.isFinite(n)&&e.totalMarks?n/e.totalMarks*100:null,status}}).filter(x=>x.status==='present'&&x.mark!==null).sort((a,b)=>b.pct-a.pct||b.mark-a.mark||a.name.localeCompare(b.name));
  let rank=0,lastPct=null,rows='';
  ranked.forEach((x,i)=>{if(lastPct===null||Math.abs(x.pct-lastPct)>1e-9)rank=i+1;lastPct=x.pct;rows+=`<tr><td>${rank}</td><td>${escapeHTML(x.name)}</td><td>${x.mark}</td><td>${x.pct.toFixed(1)}%</td></tr>`});
  openModal(`<div class="modal-head"><div><span class="eyebrow">CLASS RANKING</span><h3>Class ${state.selectedClass}</h3><p class="muted">${escapeHTML(e.name)} · ${formatDate(e.date)}</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="ranking-note">Ranking uses percentage. Absent and pending students are excluded. Equal percentages share the same rank.</div><div class="profile-table-wrap"><table class="profile-table ranking-table"><thead><tr><th>Rank</th><th>Student</th><th>Marks</th><th>%</th></tr></thead><tbody>${rows||'<tr><td colspan="4">No completed marks yet.</td></tr>'}</tbody></table></div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Close</button></div>`);
}
function openClassPerformanceModal(){
  const d=classData(),exams=d.exams.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if(!exams.length){openNewExamModal();return}
  const rows=exams.map(e=>{const s=stats(e);const pct=s.present&&e.totalMarks?(s.average/e.totalMarks*100):0;const completion=s.total?Math.round(((s.present+s.absent)/s.total)*100):0;return`<tr><td>${escapeHTML(e.name)}<small>${formatDate(e.date)}</small></td><td>${s.present}/${s.total}</td><td>${s.absent}</td><td>${s.pending}</td><td>${s.present?pct.toFixed(1)+'%':'—'}</td><td>${completion}%</td></tr>`}).join('');
  openModal(`<div class="modal-head"><div><span class="eyebrow">CLASS PERFORMANCE</span><h3>Class ${state.selectedClass}</h3><p class="muted">Compare all saved exams at a glance.</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="profile-table-wrap"><table class="profile-table performance-table"><thead><tr><th>Exam</th><th>Present</th><th>Absent</th><th>Pending</th><th>Avg %</th><th>Done</th></tr></thead><tbody>${rows}</tbody></table></div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Close</button></div>`);
}
function openGlobalSearchModal(){
  openModal(`<div class="modal-head"><div><span class="eyebrow">GLOBAL SEARCH</span><h3>Find a Student</h3><p class="muted">Search across Class 4 to Class 10.</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><label class="search global-search"><span>⌕</span><input id="globalSearchInput" type="search" placeholder="Student name" autocomplete="off"></label><div id="globalSearchResults" class="global-results"><div class="empty"><p>Type a student name to search.</p></div></div>`,card=>{
    const input=card.querySelector('#globalSearchInput'),out=card.querySelector('#globalSearchResults');
    const draw=()=>{const q=input.value.trim().toLowerCase();if(!q){out.innerHTML='<div class="empty"><p>Type a student name to search.</p></div>';return}const hits=[];CLASSES.forEach(c=>state.db.classes[c].students.forEach(st=>{if(st.name.toLowerCase().includes(q))hits.push({c,st})}));out.innerHTML=hits.length?hits.map(h=>`<button class="global-result" type="button" data-global-class="${h.c}" data-global-student="${escapeHTML(h.st.id)}"><strong>${escapeHTML(h.st.name)}</strong><span>Class ${h.c} · ${state.db.classes[h.c].exams.length} exams</span></button>`).join(''):'<div class="empty"><p>No matching student found.</p></div>'};
    input.oninput=draw;out.onclick=e=>{const b=e.target.closest('[data-global-class]');if(!b)return;selectClass(b.dataset.globalClass);closeModal();setTimeout(()=>openStudentProfileModal(b.dataset.globalStudent),30)};setTimeout(()=>input.focus(),30);
  });
}
function openInstallInfo(){installApp()}
function openClassSnapshotModal(){
  const d=classData(),latest=d.exams.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0],s=latest?stats(latest):null;
  const avgPct=s&&s.present&&latest.totalMarks?(s.average/latest.totalMarks*100):0;
  const top=latest?d.students.map(st=>{const n=Number(latest.marks[st.id]);const status=latest.statuses[st.id]||'pending';return{st,n,status,pct:Number.isFinite(n)&&latest.totalMarks?n/latest.totalMarks*100:0}}).filter(x=>x.status==='present'&&Number.isFinite(x.n)).sort((a,b)=>b.pct-a.pct).slice(0,5):[];
  openModal(`<div class="modal-head"><div><span class="eyebrow">CLASS SNAPSHOT</span><h3>Class ${state.selectedClass}</h3><p class="muted">${latest?escapeHTML(latest.name):'No exam yet'}</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="profile-stats"><div><small>STUDENTS</small><strong>${d.students.length}</strong></div><div><small>EXAMS</small><strong>${d.exams.length}</strong></div><div><small>PRESENT</small><strong>${s?s.present:'—'}</strong></div><div><small>ABSENT</small><strong>${s?s.absent:'—'}</strong></div><div><small>AVG %</small><strong>${s&&s.present?avgPct.toFixed(1):'—'}</strong></div><div><small>HIGHEST</small><strong>${s?.highest??'—'}</strong></div></div><div class="health-box"><strong>Top performers</strong><p>${top.length?top.map((x,i)=>`${i+1}. ${escapeHTML(x.st.name)} — ${x.n} (${x.pct.toFixed(1)}%)`).join('<br>'):'No completed marks yet'}</p></div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Close</button></div>`);
}
function printStudentReport(studentId){
  const d=classData(),st=d.students.find(x=>x.id===studentId);if(!st){toast('Student not found.');return}
  const exams=d.exams.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const rows=exams.map((e,i)=>{const status=e.statuses[studentId]||'pending';const raw=e.marks[studentId];const mark=status==='absent'?'ABSENT':raw===''||raw==null?'—':raw;const pct=status==='present'&&raw!==''&&e.totalMarks?(Number(raw)/e.totalMarks*100).toFixed(1)+'%':'—';return`<tr><td>${i+1}</td><td>${escapeHTML(e.name)}</td><td>${formatDate(e.date)}</td><td>${escapeHTML(mark)}</td><td>${pct}</td></tr>`}).join('');
  const vals=exams.filter(e=>e.statuses[studentId]==='present'&&e.marks[studentId]!=='').map(e=>Number(e.marks[studentId])/e.totalMarks*100).filter(Number.isFinite);const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
  $('printArea').innerHTML=`<div class="print-sheet"><div class="print-border student-report-print"><div class="print-header"><img src="assets/image.svg.png" alt="EZEE VISION CHAMPUA"><div><div class="print-title">EZEE VISION CHAMPUA</div><div class="print-subtitle">STUDENT PERFORMANCE REPORT</div></div></div><div class="print-heading">STUDENT RESULT CARD</div><div class="print-info"><div><small>Student</small><strong>${escapeHTML(st.name)}</strong></div><div><small>Class</small><strong>Class ${state.selectedClass}</strong></div><div><small>Exams</small><strong>${exams.length}</strong></div><div><small>Average %</small><strong>${vals.length?avg.toFixed(1)+'%':'—'}</strong></div></div><table class="print-table student-report-table"><thead><tr><th>Sl. No.</th><th>Exam</th><th>Date</th><th>Marks</th><th>%</th></tr></thead><tbody>${rows||'<tr><td colspan="5">No exam records</td></tr>'}</tbody></table><div class="print-note">ABSENT = Student was absent. Pending entries are shown as —.</div><div class="print-footer"><span>Class ${state.selectedClass} · ${escapeHTML(st.name)}</span><span>Generated on ${formatDate(todayISO())}</span></div></div></div>`;
  const logo=$('printArea').querySelector('.print-header img');
  const go=()=>window.print();
  const waitForPrint=async()=>{try{if(logo?.decode)await logo.decode()}catch(_){ }await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));go()};
  if(logo&&!logo.complete){logo.addEventListener('load',waitForPrint,{once:true});logo.addEventListener('error',waitForPrint,{once:true});setTimeout(waitForPrint,1800)}else waitForPrint();
}
function isStandalone(){return (window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true}
function installApp(){
  if(isStandalone()){toast('App is already installed.');return}
  if(state.deferredPrompt){
    const promptEvent=state.deferredPrompt;
    state.deferredPrompt=null;
    promptEvent.prompt();
    promptEvent.userChoice.then(choice=>{
      if(choice?.outcome==='accepted')toast('Installation started.');
      else toast('Installation cancelled.');
    }).catch(()=>toast('Could not open the install prompt.'));
    return;
  }
  openModal(`<div class="modal-head"><div><span class="eyebrow">PWA INSTALL</span><h3>Install Student Result Manager</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="install-status"><strong>Native install prompt is not available right now.</strong><p>First open this website directly in Chrome over HTTPS. Then use the browser menu <b>⋮ → Install app</b> when Chrome shows it. Do not choose only “Create shortcut”.</p><p class="muted">If Chrome has already cached an older version, refresh the site once after the latest GitHub Pages deployment.</p></div><div class="modal-actions"><button class="btn primary" type="button" data-modal-close>Close</button></div>`);
}
function bindEvents(){
  $('classGrid').addEventListener('click',e=>{const b=e.target.closest('[data-class]');if(b)selectClass(b.dataset.class)});
  $('classSelect').addEventListener('change',e=>selectClass(e.target.value));
  $('examSelect').addEventListener('change',e=>{state.selectedExamId=e.target.value||null;renderAll()});
  $('searchInput').addEventListener('input',e=>{state.search=e.target.value;renderTable()});$('historySearch').addEventListener('input',e=>{state.historySearch=e.target.value;renderHistory()});
  $('resultBody').addEventListener('click',async e=>{const p=e.target.closest('[data-profile-id]');if(p)return openStudentProfileModal(p.dataset.profileId);const edit=e.target.closest('.edit-student');if(edit)return openStudentModal(edit.dataset.id);const del=e.target.closest('.delete-student');if(del)return deleteStudent(del.dataset.id);const ab=e.target.closest('[data-status-id]');if(ab)return toggleAbsent(ab.dataset.statusId)});
  $('resultBody').addEventListener('change',e=>{const input=e.target.closest('[data-mark-id]');if(input)saveMark(input.dataset.markId,input.value,input)});
  $('resultBody').addEventListener('keydown',e=>{if(e.key!=='Enter')return;const input=e.target.closest('[data-mark-id]');if(!input)return;e.preventDefault();saveMark(input.dataset.markId,input.value,input);const inputs=[...document.querySelectorAll('[data-mark-id]:not(:disabled)')],i=inputs.indexOf(input);if(i>=0&&inputs[i+1]){inputs[i+1].focus();inputs[i+1].select()}});
  // Save marks on blur without rebuilding the table.
  // Re-rendering here used to remove the clicked Absent button before its
  // click event reached the delegated resultBody handler.
  $('resultBody').addEventListener('blur',e=>{
    const input=e.target.closest('[data-mark-id]');
    if(input && document.activeElement!==input) saveMark(input.dataset.markId,input.value,input);
  },true);
  $('addStudentBtn').onclick=()=>openStudentModal();$('emptyAddBtn').onclick=()=>openStudentModal();$('newExamBtn').onclick=()=>openNewExamModal();$('rankingBtn').onclick=()=>openRankingModal();$('globalSearchBtn').onclick=()=>openGlobalSearchModal();$('saveExamBtn').onclick=()=>saveCurrentExam();$('markPendingAbsentBtn').onclick=()=>markAllPendingAbsent();$('printBtn').onclick=()=>openPrintOptionsModal();$('exportCsvBtn').onclick=()=>exportCSV();$('toolsBtn').onclick=()=>openToolsModal();$('classInsightsBtn').onclick=()=>openResultIntelligenceModal();$('backupBtn').onclick=()=>exportBackup();$('restoreBtn').onclick=()=>$('restoreFile').click();$('installBtn').onclick=()=>installApp();
  $('dashboardOverview').addEventListener('click',e=>{const b=e.target.closest('[data-dashboard-class]');if(b)selectClass(b.dataset.dashboardClass)});
  $('examHistory').addEventListener('click',e=>{if(e.target.closest('#historyNewExam'))return openNewExamModal();const open=e.target.closest('[data-open-exam]');if(open){state.selectedExamId=open.dataset.openExam;renderAll();return}const edit=e.target.closest('[data-edit-exam]');if(edit){openEditExamModal(edit.dataset.editExam);return}const dup=e.target.closest('[data-duplicate-exam]');if(dup){duplicateExam(dup.dataset.duplicateExam);return}const del=e.target.closest('[data-delete-exam]');if(del)deleteExam(del.dataset.deleteExam)});
  $('restoreFile').addEventListener('change',e=>restoreBackup(e.target.files?.[0]));$('modalRoot').addEventListener('click',e=>{if(e.target===e.currentTarget||e.target.matches('[data-close-modal]'))closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modalRoot').classList.contains('hidden'))closeModal()});
}
function init(){
  state.db=loadDB();
  bindEvents();
  renderAll();
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    state.deferredPrompt=e;
    $('installBtn').classList.remove('hidden');
    $('installBtn').textContent='Install App';
  });
  window.addEventListener('appinstalled',()=>{
    state.deferredPrompt=null;
    $('installBtn').classList.add('hidden');
    toast('App installed successfully.');
  });
  if(isStandalone())$('installBtn').classList.add('hidden');
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>reg.update()).catch(err=>console.warn('SW registration failed',err));
    });
  }
}
init();
})();
