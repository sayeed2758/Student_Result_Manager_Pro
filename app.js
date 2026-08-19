(() => {
"use strict";

const STORAGE_KEY="ezee_student_result_manager_v1";
const CLASSES=["4","5","6","7","8","9","10"];
const $=id=>document.getElementById(id);
const state={db:loadDB(),selectedClass:"4",selectedExamId:null,search:""};

function uid(p){return p+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8)}
function defaultDB(){const classes={};CLASSES.forEach(c=>classes[c]={students:[],exams:[]});return{version:1,classes}}
function normalizeDB(raw){
  const db=raw&&typeof raw==="object"?raw:defaultDB();
  if(!db.classes||typeof db.classes!=="object")db.classes={};
  CLASSES.forEach(c=>{
    if(!db.classes[c])db.classes[c]={students:[],exams:[]};
    if(!Array.isArray(db.classes[c].students))db.classes[c].students=[];
    if(!Array.isArray(db.classes[c].exams))db.classes[c].exams=[];
    db.classes[c].students=db.classes[c].students.filter(s=>s&&s.id&&typeof s.name==="string");
    db.classes[c].exams=db.classes[c].exams.filter(e=>e&&e.id).map(e=>{
      const marks=e.marks&&typeof e.marks==="object"?e.marks:{};
      const statuses=e.statuses&&typeof e.statuses==="object"?e.statuses:{};
      Object.keys(marks).forEach(id=>{
        if(statuses[id]==="absent")return;
        if(marks[id]!=="" && Number.isFinite(Number(marks[id])))statuses[id]="present";
        else if(!statuses[id])statuses[id]="pending";
      });
      return{id:e.id,name:String(e.name||"Exam"),totalMarks:Math.max(1,parseInt(e.totalMarks,10)||100),date:e.date||"",marks,statuses};
    });
  });
  db.version=1;return db;
}
function loadDB(){try{const raw=localStorage.getItem(STORAGE_KEY);return normalizeDB(raw?JSON.parse(raw):null)}catch(e){console.warn(e);return defaultDB()}}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.db));setSaveStatus("Saved locally");return true}catch(e){toast("Could not save data in this browser.");return false}}
function setSaveStatus(t){$("saveStatus").textContent=t}
function classData(){return state.db.classes[state.selectedClass]}
function currentExam(){return classData().exams.find(e=>e.id===state.selectedExamId)||null}
function todayISO(){return new Date().toISOString().slice(0,10)}
function formatDate(iso){if(!iso)return"—";const d=new Date(iso+"T00:00:00");return Number.isNaN(d.getTime())?iso:d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
function escapeHTML(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]))}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),2200)}
function confirmAction(message){return window.confirm(message)}

function ensureStudentInExam(exam,id){if(!(id in exam.marks))exam.marks[id]="";if(!(id in exam.statuses))exam.statuses[id]="pending"}
function ensureCurrentExamStudents(){const e=currentExam();if(!e)return;classData().students.forEach(s=>ensureStudentInExam(e,s.id));}

function renderClassDashboard(){
  $("classDashboard").innerHTML=CLASSES.map(c=>{
    const d=state.db.classes[c],a=c===state.selectedClass?" active":"";
    return `<button class="class-card${a}" type="button" data-class="${c}"><strong>Class ${c}</strong><span>${d.students.length} ${d.students.length===1?"Student":"Students"} · ${d.exams.length} ${d.exams.length===1?"Exam":"Exams"}</span></button>`
  }).join("");
  $("classSelect").value=state.selectedClass;$("newExamClass").value=state.selectedClass;
}
function renderExamSelect(){
  const exams=classData().exams.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  if(!state.selectedExamId||!exams.some(e=>e.id===state.selectedExamId))state.selectedExamId=exams[0]?.id||null;
  $("examSelect").innerHTML=`<option value="">No exam selected</option>`+exams.map(e=>`<option value="${escapeHTML(e.id)}">${escapeHTML(e.name)} — ${formatDate(e.date)}</option>`).join("");
  $("examSelect").value=state.selectedExamId||"";syncExamFields();
}
function syncExamFields(){
  const e=currentExam();$("totalMarks").value=e?e.totalMarks:"";$("examDate").value=e?e.date:"";
  $("examQuickInfo").textContent=e?`${e.name} · Class ${state.selectedClass} · ${formatDate(e.date)}`:"No exam selected";
}
function stats(e){
  const students=classData().students,total=students.length;
  let present=0,absent=0,pending=0,values=[];
  students.forEach(s=>{
    ensureStudentInExam(e||{marks:{},statuses:{}},s.id);
    const st=e?.statuses?.[s.id]||"pending";
    if(st==="absent")absent++;
    else if(st==="present"&&e?.marks?.[s.id]!==""&&e?.marks?.[s.id]!=null){present++;values.push(Number(e.marks[s.id]))}
    else pending++;
  });
  const highest=values.length?Math.max(...values):0,lowest=values.length?Math.min(...values):0,average=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  const completion=total?Math.round(((present+absent)/total)*100):0;
  const percentage=(e&&e.totalMarks&&values.length)?(average/e.totalMarks*100):0;
  return{total,present,absent,pending,highest,lowest,average,completion,percentage};
}
function renderAnalytics(){
  const e=currentExam(),s=stats(e);
  const cards=e?[
    ["Students",s.total,""],["Present",s.present,""],["Absent",s.absent,"absent"],["Pending",s.pending,"pending"],["Highest",s.present?s.highest:"—",""],["Average",s.present?s.average.toFixed(1):"—",""]
  ]:[["Students",s.total,""],["Exams",classData().exams.length,""],["Present","—",""],["Absent","—",""],["Pending","—",""],["Highest","—",""]];
  $("analyticsCard").innerHTML=cards.map(x=>`<div class="stat-card ${x[2]}"><span class="label">${x[0]}</span><div class="value">${x[1]}</div></div>`).join("");
  $("pendingBadge").textContent=`${s.pending} Pending`;
  $("entryHint").classList.toggle("hidden",!e||s.total<2);
}
function renderTable(){
  const data=classData(),e=currentExam(),q=state.search.trim().toLowerCase(),students=data.students.filter(s=>s.name.toLowerCase().includes(q));
  if(e)ensureCurrentExamStudents();
  $("studentCount").textContent=`${data.students.length} ${data.students.length===1?"Student":"Students"}`;
  $("resultBody").innerHTML=students.map((s,i)=>{
    const status=e?(e.statuses[s.id]||"pending"):"none",mark=e?(e.marks[s.id]??""):"";
    let cell="";
    if(e){
      const absent=status==="absent";
      cell=`<div class="mark-row"><input class="mark-input" data-mark-id="${escapeHTML(s.id)}" type="number" min="0" max="${Number(e.totalMarks)}" step="1" inputmode="numeric" value="${absent?"":escapeHTML(mark)}" ${absent?"disabled":""} aria-label="Marks for ${escapeHTML(s.name)}"><button class="status-btn ${absent?"active":""}" type="button" data-status-id="${escapeHTML(s.id)}" aria-label="Toggle absent">${absent?"Absent":"Absent?"}</button></div><div class="status-note ${absent?"absent":""}">${absent?"Student is absent":status==="present"?"Present":"Pending"}</div>`;
    }else cell=`<span style="color:#8997a4">Create/select an exam</span>`;
    return `<tr><td>${i+1}</td><td><div class="student-name">${escapeHTML(s.name)}</div><div class="row-actions"><button class="mini-btn edit-student" type="button" data-id="${escapeHTML(s.id)}">Edit</button><button class="mini-btn delete delete-student" type="button" data-id="${escapeHTML(s.id)}">Delete</button></div></td><td class="mark-cell">${cell}</td></tr>`;
  }).join("");
  const empty=!students.length;$("emptyState").classList.toggle("hidden",!empty);$("resultTable").classList.toggle("hidden",empty);
}
function renderHistory(){
  const exams=classData().exams.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  if(!exams.length){$("examHistory").innerHTML=`<div class="empty-state"><h3>No exams yet</h3><p>Create a new exam for Class ${state.selectedClass}.</p></div>`;return}
  $("examHistory").innerHTML=exams.map(e=>{const s=stats(e);return `<article class="history-item${e.id===state.selectedExamId?" active":""}"><div class="history-top"><span class="history-name">${escapeHTML(e.name)}</span><strong>${e.totalMarks}</strong></div><div class="history-meta">${formatDate(e.date)} · ${s.present} Present · ${s.absent} Absent · ${s.pending} Pending</div><div class="history-actions"><button type="button" data-open-exam="${escapeHTML(e.id)}">Open</button><button type="button" data-edit-exam="${escapeHTML(e.id)}">Edit</button><button type="button" data-duplicate-exam="${escapeHTML(e.id)}">Duplicate</button><button type="button" class="danger" data-delete-exam="${escapeHTML(e.id)}">Delete</button></div></article>`}).join("");
}
function renderAll(){renderClassDashboard();renderExamSelect();renderAnalytics();renderTable();renderHistory()}

function selectClass(c){if(!CLASSES.includes(c))return;state.selectedClass=c;state.selectedExamId=null;state.search="";$("searchInput").value="";renderAll()}
function addStudent(name){
  const clean=name.trim().replace(/\s+/g," ");if(!clean)return;
  if(classData().students.some(s=>s.name.toLowerCase()===clean.toLowerCase())){toast("A student with this name already exists.");return}
  const student={id:uid("stu"),name:clean};classData().students.push(student);classData().exams.forEach(e=>ensureStudentInExam(e,student.id));
  persist();renderAll();toast("Student added.");
}
function editStudent(id,name){
  const s=classData().students.find(x=>x.id===id),clean=name.trim().replace(/\s+/g," ");if(!s||!clean)return;
  if(classData().students.some(x=>x.id!==id&&x.name.toLowerCase()===clean.toLowerCase())){toast("A student with this name already exists.");return}
  s.name=clean;persist();renderAll();toast("Student name updated.");
}
function deleteStudent(id){
  const s=classData().students.find(x=>x.id===id);if(!s)return;
  if(!confirmAction(`Are you sure you want to delete "${s.name}"?\n\nTheir marks/status in all exams of this class will also be removed.`))return;
  classData().students=classData().students.filter(x=>x.id!==id);classData().exams.forEach(e=>{delete e.marks[id];delete e.statuses[id]});
  persist();renderAll();toast("Student deleted.");
}
function createExam(name,total,date,classId){
  const clean=name.trim(),m=Number(total),target=state.db.classes[classId];
  if(!clean||!Number.isInteger(m)||m<1||!date){toast("Please enter valid exam details.");return}
  const e={id:uid("exam"),name:clean,totalMarks:m,date,marks:{},statuses:{}};
  target.students.forEach(s=>{e.marks[s.id]="";e.statuses[s.id]="pending"});
  target.exams.push(e);state.selectedClass=classId;state.selectedExamId=e.id;persist();renderAll();toast("Exam created.");
}
function updateExam(e,name,total,date){
  const clean=name.trim(),m=Number(total);if(!clean||!Number.isInteger(m)||m<1||!date){toast("Please enter valid exam details.");return}
  ensureCurrentExamStudents();e.name=clean;e.totalMarks=m;e.date=date;
  Object.keys(e.marks).forEach(id=>{if(e.statuses[id]==="absent"){e.marks[id]="";return}const v=e.marks[id];if(v!==""&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>m)){e.marks[id]="";e.statuses[id]="pending"}});
  persist();renderAll();toast("Exam updated.");
}
function deleteExam(id){
  const e=classData().exams.find(x=>x.id===id);if(!e)return;
  if(!confirmAction(`Delete "${e.name}"?\n\nAll marks and attendance status stored in this exam will be permanently removed.`))return;
  classData().exams=classData().exams.filter(x=>x.id!==id);state.selectedExamId=classData().exams[0]?.id||null;persist();renderAll();toast("Exam deleted.");
}
function duplicateExam(id){
  const source=classData().exams.find(x=>x.id===id);if(!source)return;
  const name=prompt("New exam name:",source.name+" — Copy");if(name===null)return;
  const date=prompt("Date (YYYY-MM-DD):",todayISO());if(date===null)return;
  const e={id:uid("exam"),name:name.trim()||"Copied Exam",totalMarks:source.totalMarks,date,marks:{},statuses:{}};
  classData().students.forEach(s=>{e.marks[s.id]="";e.statuses[s.id]="pending"});
  classData().exams.push(e);state.selectedExamId=e.id;persist();renderAll();toast("Exam duplicated with fresh marks.");
}
function saveCurrentExam(){const e=currentExam();if(!e){toast("Create or select an exam first.");return}updateExam(e,e.name,$("totalMarks").value,$("examDate").value)}
function toggleAbsent(id){
  const e=currentExam();if(!e)return;ensureStudentInExam(e,id);
  if(e.statuses[id]==="absent"){e.statuses[id]=e.marks[id]!==""?"present":"pending"}
  else{e.statuses[id]="absent";e.marks[id]=""}
  persist();renderAnalytics();renderTable();renderHistory();toast(e.statuses[id]==="absent"?"Marked absent.":"Student returned to marks entry.");
}
function saveMark(id,raw,input){
  const e=currentExam();if(!e)return;ensureStudentInExam(e,id);
  if(e.statuses[id]==="absent"){toast("Student is marked absent.");return}
  if(raw===""){e.marks[id]="";e.statuses[id]="pending";input.classList.remove("invalid","saved");persist();renderAnalytics();renderHistory();return}
  const v=Number(raw),valid=Number.isInteger(v)&&v>=0&&v<=Number(e.totalMarks);
  input.classList.toggle("invalid",!valid);if(!valid){toast(`Marks must be between 0 and ${e.totalMarks}.`);return}
  e.marks[id]=v;e.statuses[id]="present";persist();input.classList.add("saved");setTimeout(()=>input.classList.remove("saved"),300);renderAnalytics();renderHistory();
}
function markAllPendingAbsent(){
  const e=currentExam();if(!e){toast("Select an exam first.");return}
  const pending=classData().students.filter(s=>(e.statuses[s.id]||"pending")==="pending");if(!pending.length){toast("No pending students.");return}
  if(!confirmAction(`Mark all ${pending.length} pending students as Absent?`))return;
  pending.forEach(s=>{e.statuses[s.id]="absent";e.marks[s.id]=""});persist();renderAll();toast(`${pending.length} students marked absent.`);
}

function openStudentDialog(id=""){
  $("editingStudentId").value=id;$("studentName").value="";$("studentDialogTitle").textContent=id?"Edit Student":"Add Student";$("studentSubmit").textContent=id?"Save Changes":"Add Student";
  if(id){const s=classData().students.find(x=>x.id===id);if(!s)return;$("studentName").value=s.name}
  $("studentDialog").showModal();setTimeout(()=>$("studentName").focus(),40);
}
function openNewExamDialog(){ $("newExamClass").value=state.selectedClass;$("newExamName").value="";$("newExamMarks").value="100";$("newExamDate").value=todayISO();$("examDialog").showModal();setTimeout(()=>$("newExamName").focus(),40)}
function openEditExamDialog(id){const e=classData().exams.find(x=>x.id===id);if(!e)return;$("editingExamId").value=id;$("editExamName").value=e.name;$("editExamMarks").value=e.totalMarks;$("editExamDate").value=e.date;$("editExamDialog").showModal();setTimeout(()=>$("editExamName").focus(),40)}

function printResult(){
  const e=currentExam();if(!e){toast("Create or select an exam first.");return}ensureCurrentExamStudents();const s=stats(e);
  const rows=classData().students.map((x,i)=>{const st=e.statuses[x.id]||"pending";const value=st==="absent"?"ABSENT":(e.marks[x.id]??"");return `<tr><td>${i+1}</td><td>${escapeHTML(x.name)}</td><td>${escapeHTML(value)}</td></tr>`}).join("");
  $("printArea").innerHTML=`<div class="print-sheet"><div class="print-header"><img src="assets/icon.svg" alt=""><div><div class="print-title">EZEE VISION CHAMPUA</div><div class="print-subtitle">Student Result Manager Pro</div></div></div>
  <div class="print-info"><div><small>Exam</small><strong>${escapeHTML(e.name)}</strong></div><div><small>Total Marks</small><strong>${e.totalMarks}</strong></div><div><small>Class · Date</small><strong>Class ${state.selectedClass} · ${formatDate(e.date)}</strong></div></div>
  <div class="print-summary"><div><small>Students</small><strong>${s.total}</strong></div><div><small>Present</small><strong>${s.present}</strong></div><div><small>Absent</small><strong>${s.absent}</strong></div><div><small>Highest</small><strong>${s.present?s.highest:"—"}</strong></div><div><small>Average</small><strong>${s.present?s.average.toFixed(1):"—"}</strong></div></div>
  <table class="print-table"><thead><tr><th>Sl. No.</th><th>Name of the Students</th><th>Marks</th></tr></thead><tbody>${rows||`<tr><td colspan="3">No students</td></tr>`}</tbody></table>
  <div class="print-footer"><span>EZEE VISION CHAMPUA</span><span>Teacher's Signature: ____________________</span></div></div>`;
  window.print();
}
function exportCSV(){
  const e=currentExam();if(!e){toast("Select an exam first.");return}ensureCurrentExamStudents();
  const lines=[["Sl. No.","Name of the Students","Marks / Status"]];
  classData().students.forEach((s,i)=>{const st=e.statuses[s.id]||"pending";lines.push([i+1,s.name,st==="absent"?"ABSENT":(e.marks[s.id]??"")])});
  const csv=lines.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n"),blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a"),url=URL.createObjectURL(blob);a.href=url;a.download=`Class-${state.selectedClass}-${e.name.replace(/[^\w]+/g,"-")}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast("CSV exported.");
}
function exportBackup(){
  const payload={app:"EZEE VISION CHAMPUA — Student Result Manager Pro",backupVersion:2,createdAt:new Date().toISOString(),data:state.db};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`ezee-result-backup-${todayISO()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast("Backup downloaded.");
}
function importBackup(file){
  if(!file)return;const reader=new FileReader();
  reader.onload=()=>{try{const parsed=JSON.parse(reader.result),db=normalizeDB(parsed?.data||parsed),students=CLASSES.reduce((n,c)=>n+db.classes[c].students.length,0),exams=CLASSES.reduce((n,c)=>n+db.classes[c].exams.length,0);
    if(!confirmAction(`Restore this backup?\n\nStudents: ${students}\nExams: ${exams}\n\nCurrent browser data will be replaced.`))return;
    state.db=db;state.selectedClass="4";state.selectedExamId=null;state.search="";$("searchInput").value="";persist();renderAll();toast("Backup restored successfully.");
  }catch(e){toast("Invalid backup file.")}};reader.readAsText(file);
}

$("classDashboard").addEventListener("click",e=>{const b=e.target.closest("[data-class]");if(b)selectClass(b.dataset.class)});
$("classSelect").addEventListener("change",e=>selectClass(e.target.value));
$("examSelect").addEventListener("change",e=>{state.selectedExamId=e.target.value||null;renderAll()});
$("searchInput").addEventListener("input",e=>{state.search=e.target.value;renderTable()});
$("newExamBtn").addEventListener("click",openNewExamDialog);
$("addStudentBtn").addEventListener("click",()=>openStudentDialog());
$("emptyState").addEventListener("click",e=>{if(e.target.closest("[data-empty-add]"))openStudentDialog()});
$("saveExamBtn").addEventListener("click",saveCurrentExam);
$("printBtn").addEventListener("click",printResult);
$("bulkAbsentBtn").addEventListener("click",markAllPendingAbsent);
$("csvBtn").addEventListener("click",exportCSV);
$("backupBtn").addEventListener("click",exportBackup);
$("restoreBtn").addEventListener("click",()=>$("restoreInput").click());
$("restoreInput").addEventListener("change",e=>{importBackup(e.target.files[0]);e.target.value=""});
$("menuBtn").addEventListener("click",()=>$("menuDialog").showModal());
$("menuBackup").addEventListener("click",()=>{exportBackup();$("menuDialog").close()});
$("menuRestore").addEventListener("click",()=>{$("menuDialog").close();$("restoreInput").click()});
$("menuCsv").addEventListener("click",()=>{exportCSV();$("menuDialog").close()});
$("menuInstall").addEventListener("click",()=>{$("installBtn").click();$("menuDialog").close()});

$("resultBody").addEventListener("click",e=>{
  const edit=e.target.closest(".edit-student"),del=e.target.closest(".delete-student"),status=e.target.closest("[data-status-id]");
  if(edit)openStudentDialog(edit.dataset.id);if(del)deleteStudent(del.dataset.id);if(status)toggleAbsent(st
