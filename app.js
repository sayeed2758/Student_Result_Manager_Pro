(() => {
  'use strict';

  const STORAGE_KEY = 'ezee_student_result_manager_v1';
  const CLASSES = ['4','5','6','7','8','9','10'];
  const TEACHERS = [
    'Shahid Sir',
    'Enam Sir',
    'Zeeshan Sir',
    'Abdur Rahman Sir',
    'Takmil Sir'
  ];

  const $ = (id) => document.getElementById(id);

  const state = {
    db: loadDB(),
    selectedClass: '4',
    selectedExamId: null,
    search: '',
    modalCleanup: null,
    deferredPrompt: null
  };

  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }

  function blankDB() {
    const classes = {};

    CLASSES.forEach(c => {
      classes[c] = {
        students: [],
        exams: []
      };
    });

    return {
      version: 1,
      classes
    };
  }

  function normalizeDB(raw) {
    const db = raw && typeof raw === 'object'
      ? raw
      : blankDB();

    if (!db.classes || typeof db.classes !== 'object') {
      db.classes = {};
    }

    CLASSES.forEach(c => {
      const d = db.classes[c] && typeof db.classes[c] === 'object'
        ? db.classes[c]
        : {};

      d.students = Array.isArray(d.students)
        ? d.students
        : [];

      d.exams = Array.isArray(d.exams)
        ? d.exams
        : [];

      d.students = d.students
        .filter(
          s =>
            s &&
            s.id &&
            typeof s.name === 'string' &&
            s.name.trim()
        )
        .map(s => ({
          id: String(s.id),
          name: s.name.trim()
        }));

      d.exams = d.exams
        .filter(e => e && e.id)
        .map(e => {
          const marks =
            e.marks && typeof e.marks === 'object'
              ? { ...e.marks }
              : {};

          const statuses =
            e.statuses && typeof e.statuses === 'object'
              ? { ...e.statuses }
              : {};

          d.students.forEach(s => {
            if (!(s.id in marks)) {
              marks[s.id] = '';
            }

            if (!statuses[s.id]) {
              statuses[s.id] =
                marks[s.id] === ''
                  ? 'pending'
                  : 'present';
            }

            if (
              statuses[s.id] !== 'absent' &&
              statuses[s.id] !== 'present' &&
              statuses[s.id] !== 'pending'
            ) {
              statuses[s.id] =
                marks[s.id] === ''
                  ? 'pending'
                  : 'present';
            }
          });

          return {
            id: String(e.id),
            name: String(
              e.name || e.title || 'Exam'
            ).trim() || 'Exam',

            totalMarks: Math.max(
              1,
              Number.parseInt(e.totalMarks, 10) || 100
            ),

            date: String(e.date || ''),

            teacherSignature:
              TEACHERS.includes(
                String(e.teacherSignature || '')
              )
                ? String(e.teacherSignature)
                : '',

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

      return normalizeDB(
        raw ? JSON.parse(raw) : null
      );
    } catch (err) {
      console.warn(
        'Storage load failed:',
        err
      );

      return blankDB();
    }
  }

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.db)
      );

      const badge = $('saveBadge');

      if (badge) {
        badge.textContent = 'Saved locally';
      }

      return true;
    } catch (err) {
      console.error(
        'Storage save failed:',
        err
      );

      toast(
        'Could not save data in this browser.'
      );

      return false;
    }
  }

  function classData() {
    return state.db.classes[
      state.selectedClass
    ];
  }

  function currentExam() {
    return classData().exams.find(
      e => e.id === state.selectedExamId
    ) || null;
  }

  function todayISO() {
    return new Date()
      .toISOString()
      .slice(0, 10);
  }

  function formatDate(iso) {
    if (!iso) return '—';

    const d = new Date(
      `${iso}T00:00:00`
    );

    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(
          'en-GB',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }
        );
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(
        /[&<>"']/g,
        c =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
          }[c])
      );
  }

  function toast(message) {
    const el = $('toast');

    if (!el) return;

    el.textContent = message;

    el.classList.add('show');

    clearTimeout(toast.timer);

    toast.timer = setTimeout(
      () => el.classList.remove('show'),
      2200
    );
  }
    function ensureExamStudents(exam) {
    if (!exam) return;

    classData().students.forEach(student => {
      if (!(student.id in exam.marks)) {
        exam.marks[student.id] = '';
      }

      if (!exam.statuses[student.id]) {
        exam.statuses[student.id] =
          exam.marks[student.id] === ''
            ? 'pending'
            : 'present';
      }
    });
  }

  function stats(exam) {
    if (!exam) {
      return {
        total: 0,
        present: 0,
        absent: 0,
        pending: 0,
        highest: null,
        average: 0
      };
    }

    ensureExamStudents(exam);

    const students = classData().students;

    let present = 0;
    let absent = 0;
    let pending = 0;
    let total = 0;
    let highest = null;
    let sum = 0;

    students.forEach(s => {
      const st =
        exam.statuses[s.id] || 'pending';

      if (st === 'absent') {
        absent++;
      } else if (st === 'present') {
        present++;
        total++;

        const n = Number(
          exam.marks[s.id]
        );

        if (Number.isFinite(n)) {
          sum += n;

          highest =
            highest === null
              ? n
              : Math.max(highest, n);
        }
      } else {
        pending++;
      }
    });

    return {
      total: students.length,
      present,
      absent,
      pending,
      highest,
      average: present
        ? sum / present
        : 0
    };
  }


  function renderDashboardOverview(){
    const host=$('dashboardOverview');
    if(!host)return;
    host.innerHTML=CLASSES.map(c=>{
      const d=state.db.classes[c];
      const latest=d.exams.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
      const st=latest?statsForClassExtended(c,latest):null;
      const pct=st&&st.present&&latest?st.average/latest.totalMarks*100:0;
      return `<button class="dashboard-card ${c===state.selectedClass?'active':''}" type="button" data-dashboard-class="${c}"><div class="dashboard-card-head"><strong>Class ${c}</strong><span>${latest?escapeHTML(latest.name):'No exam'}</span></div><div class="dashboard-card-stats"><span><b>${d.students.length}</b>Students</span><span><b>${d.exams.length}</b>Exams</span><span><b>${latest?st.present+'/'+st.total:'—'}</b>Present</span></div><div class="dashboard-card-foot"><span>${latest&&st.present?`Avg ${pct.toFixed(1)}%`:'Ready to start'}</span><span>Open →</span></div></button>`;
    }).join('');
  }
  function statsForClassExtended(cls,exam){
    const d=state.db.classes[String(cls)];if(!exam)return{total:d.students.length,present:0,absent:0,pending:d.students.length,average:0};
    const vals=[];let present=0,absent=0,pending=0;d.students.forEach(st=>{const status=exam.statuses?.[st.id]||'pending';if(status==='absent'){absent++;return}const pct=percentageFor(exam,st.id);if(status==='present'&&pct!=null){present++;const n=Number(exam.subjects?.length?calculateOverallFromSubjects(exam,st.id):exam.marks[st.id]);if(Number.isFinite(n))vals.push(n)}else pending++});return{total:d.students.length,present,absent,pending,average:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0};
  }

  function renderAll() {
    renderClassGrid();
    renderExamSelect();
    renderExamInfo();
    renderAnalytics();
    renderTable();
    renderHistory();
    renderDashboardOverview();
  }

  function renderClassGrid() {
    $('classGrid').innerHTML =
      CLASSES.map(c => {
        const d = state.db.classes[c];

        return `
          <button
            class="class-card${c === state.selectedClass ? ' active' : ''}"
            type="button"
            data-class="${c}"
          >
            <b>Class ${c}</b>
            <span>
              ${d.students.length}
              ${d.students.length === 1 ? 'Student' : 'Students'}
              ·
              ${d.exams.length}
              ${d.exams.length === 1 ? 'Exam' : 'Exams'}
            </span>
          </button>
        `;
      }).join('');

    $('classSelect').value =
      state.selectedClass;
  }

  function renderExamSelect() {
    const exams =
      classData()
        .exams
        .slice()
        .sort(
          (a, b) =>
            (b.date || '')
              .localeCompare(a.date || '')
        );

    if (
      !state.selectedExamId ||
      !exams.some(
        e => e.id === state.selectedExamId
      )
    ) {
      state.selectedExamId =
        exams[0]?.id || null;
    }

    $('examSelect').innerHTML =
      `<option value="">No exam selected</option>` +
      exams
        .map(
          e =>
            `<option value="${escapeHTML(e.id)}">
              ${escapeHTML(e.name)}
              — ${formatDate(e.date)}
            </option>`
        )
        .join('');

    $('examSelect').value =
      state.selectedExamId || '';
  }

  function renderExamInfo() {
    const e = currentExam();

    $('totalMarks').value =
      e ? e.totalMarks : '';

    $('examDate').value =
      e ? e.date : '';

    $('examCaption').textContent =
      e
        ? `${e.name} · ${formatDate(e.date)} · Maximum ${e.totalMarks}`
        : 'No exam selected';

    $('printBtn').disabled = !e;
    $('saveExamBtn').disabled = !e;

    $('printBtn').style.opacity =
      e ? '1' : '.65';

    $('saveExamBtn').style.opacity =
      e ? '1' : '.65';
  }

  function renderAnalytics() {
    const s = stats(currentExam());

    $('analytics').innerHTML = [
      [
        'Students',
        s.total,
        ''
      ],
      [
        'Present',
        s.present,
        ''
      ],
      [
        'Absent',
        s.absent,
        'absent'
      ],
      [
        'Pending',
        s.pending,
        'pending'
      ],
      [
        'Highest',
        s.highest ?? '—',
        ''
      ],
      [
        'Average',
        s.present
          ? s.average.toFixed(1)
          : '—',
        ''
      ]
    ]
      .map(
        x =>
          `<div class="stat ${x[2]}">
            <small>${x[0]}</small>
            <strong>${x[1]}</strong>
          </div>`
      )
      .join('');
  }

  function renderTable() {
    const students =
      classData().students;

    const exam =
      currentExam();

    if (exam) {
      ensureExamStudents(exam);
    }

    const query =
      state.search
        .trim()
        .toLowerCase();

    const filtered =
      students.filter(
        s =>
          s.name
            .toLowerCase()
            .includes(query)
      );

    $('studentCount').textContent =
      `${students.length} ${
        students.length === 1
          ? 'Student'
          : 'Students'
      }`;

    $('pendingCount').textContent =
      `${exam ? stats(exam).pending : 0} Pending`;

    $('markPendingAbsentBtn').disabled =
      !exam || !stats(exam).pending;

    $('exportCsvBtn').disabled =
      !exam;

    $('entryTip').classList.toggle(
      'hidden',
      !exam || !students.length
    );

    $('emptyState').classList.toggle(
      'hidden',
      filtered.length > 0
    );

    if (!filtered.length) {
      $('resultBody').innerHTML = '';
      return;
    }

    $('resultBody').innerHTML =
      filtered
        .map((student, index) => {
          const status =
            exam
              ? (
                  exam.statuses[
                    student.id
                  ] || 'pending'
                )
              : 'pending';

          const marks =
            exam
              ? (
                  exam.marks[
                    student.id
                  ] ?? ''
                )
              : '';

          const absent =
            status === 'absent';

          const disabled =
            !exam || absent;

          const value =
            absent
              ? ''
              : escapeHTML(marks);

          return `
            <tr>
              <td>
                ${students.indexOf(student) + 1}
              </td>

              <td>
                <button
                  class="student-name student-profile-btn"
                  type="button"
                  data-profile-id="${escapeHTML(student.id)}"
                  title="Open result profile"
                >
                  ${escapeHTML(student.name)}
                </button>

                <div class="row-actions">
                  <button
                    class="mini edit-student"
                    type="button"
                    data-id="${escapeHTML(student.id)}"
                  >
                    Edit
                  </button>

                  <button
                    class="mini delete delete-student"
                    type="button"
                    data-id="${escapeHTML(student.id)}"
                  >
                    Delete
                  </button>
                </div>
              </td>

              <td>
                <div class="mark-row">
                  <input
                    class="mark-input"
                    data-mark-id="${escapeHTML(student.id)}"
                    type="number"
                    min="0"
                    max="${exam ? exam.totalMarks : 100}"
                    step="any"
                    inputmode="decimal"
                    value="${value}"
                    ${disabled ? 'disabled' : ''}
                    placeholder="${exam ? 'Marks' : '—'}"
                    aria-label="Marks for ${escapeHTML(student.name)}"
                  >

                  ${
                    exam
                      ? `
                        <button
                          class="status-btn ${absent ? 'active' : ''}"
                          type="button"
                          data-status-id="${escapeHTML(student.id)}"
                        >
                          ${absent ? 'Present' : 'Absent'}
                        </button>
                      `
                      : ''
                  }
                </div>

                ${
                  absent
                    ? '<div class="status-note absent">ABSENT</div>'
                    : status === 'pending'
                      ? '<div class="status-note">Pending</div>'
                      : ''
                }
              </td>
            </tr>
          `;
        })
        .join('');
  }

  function renderHistory() {
    const exams =
      classData()
        .exams
        .slice()
        .sort(
          (a, b) =>
            (b.date || '')
              .localeCompare(a.date || '')
        );

    if (!exams.length) {
      $('examHistory').innerHTML = `
        <div class="empty">
          <div class="empty-icon">◷</div>

          <h3>No exams yet</h3>

          <p>
            Create a new exam to start saving marks.
          </p>

          <button
            id="historyNewExam"
            class="btn primary"
            type="button"
          >
            Create First Exam
          </button>
        </div>
      `;

      return;
    }

    $('examHistory').innerHTML =
      exams
        .map(e => {
          const s = stats(e);

          return `
            <article
              class="history ${
                e.id === state.selectedExamId
                  ? 'current'
                  : ''
              }"
            >
              <div class="history-top">
                <div class="history-name">
                  ${escapeHTML(e.name)}
                </div>

                <span class="pill pending">
                  ${s.pending} pending
                </span>
              </div>

              <div class="history-meta">
                ${formatDate(e.date)}
                · Class ${state.selectedClass}
                · Total ${e.totalMarks}
                <br>
                ${s.present} present
                · ${s.absent} absent
              </div>

              <div class="history-actions">
                <button
                  type="button"
                  data-open-exam="${escapeHTML(e.id)}"
                >
                  Open
                </button>

                <button
                  type="button"
                  data-edit-exam="${escapeHTML(e.id)}"
                >
                  Edit
                </button>

                <button
                  type="button"
                  data-duplicate-exam="${escapeHTML(e.id)}"
                >
                  Duplicate
                </button>

                <button
                  class="danger"
                  type="button"
                  data-delete-exam="${escapeHTML(e.id)}"
                >
                  Delete
                </button>
              </div>
            </article>
          `;
        })
        .join('');
                      }
    function selectClass(c) {
    if (!CLASSES.includes(String(c))) return;

    state.selectedClass = String(c);
    state.selectedExamId =
      classData().exams[0]?.id || null;

    state.search = '';

    $('searchInput').value = '';

    renderAll();
  }

  function createExam(
    name,
    totalMarks,
    date,
    cls
  ) {
    name = String(name || '').trim();

    const total = Number(totalMarks);

    if (!name) {
      toast('Enter an exam name.');
      return false;
    }

    if (
      !Number.isInteger(total) ||
      total < 1
    ) {
      toast(
        'Total Marks must be a positive whole number.'
      );
      return false;
    }

    if (
      !CLASSES.includes(String(cls))
    ) {
      toast('Invalid class.');
      return false;
    }

    const d =
      state.db.classes[String(cls)];

    if (
      d.exams.some(
        e =>
          e.name.toLowerCase() ===
            name.toLowerCase() &&
          e.date === date
      )
    ) {
      toast(
        'An exam with this name and date already exists.'
      );
      return false;
    }

    const exam = {
      id: uid('exam'),
      name,
      totalMarks: total,
      date: date || todayISO(),
      teacherSignature: '',
      marks: {},
      statuses: {}
    };

    d.students.forEach(s => {
      exam.marks[s.id] = '';
      exam.statuses[s.id] = 'pending';
    });

    d.exams.push(exam);

    state.selectedClass = String(cls);
    state.selectedExamId = exam.id;
    state.search = '';

    $('searchInput').value = '';

    persist();
    renderAll();

    toast(
      'New exam created successfully.'
    );

    return true;
  }

  function saveCurrentExam() {
    const e = currentExam();

    if (!e) {
      toast(
        'Create or select an exam first.'
      );
      return;
    }

    const total =
      Number($('totalMarks').value);

    const date =
      $('examDate').value;

    if (
      !Number.isInteger(total) ||
      total < 1
    ) {
      toast(
        'Enter valid Total Marks.'
      );
      return;
    }

    e.totalMarks = total;
    e.date =
      date ||
      e.date ||
      todayISO();

    ensureExamStudents(e);

    Object.keys(e.marks).forEach(id => {
      const st =
        e.statuses[id];

      if (
        st !== 'absent' &&
        e.marks[id] !== ''
      ) {
        const n =
          Number(e.marks[id]);

        if (
          !Number.isFinite(n) ||
          n < 0 ||
          n > total
        ) {
          e.marks[id] = '';
          e.statuses[id] = 'pending';
        }
      }
    });

    persist();
    renderAll();

    toast(
      'Exam saved successfully.'
    );
  }

  function addStudent(name) {
    name = String(name || '')
      .trim()
      .replace(/\s+/g, ' ');

    if (!name) {
      toast('Enter student name.');
      return false;
    }

    const d = classData();

    if (
      d.students.some(
        s =>
          s.name.toLowerCase() ===
          name.toLowerCase()
      )
    ) {
      toast(
        'That student already exists in this class.'
      );
      return false;
    }

    const student = {
      id: uid('student'),
      name
    };

    d.students.push(student);

    d.exams.forEach(e => {
      e.marks[student.id] = '';
      e.statuses[student.id] =
        'pending';
    });

    persist();
    renderAll();

    toast(
      'Student added successfully.'
    );

    return true;
  }

  async function editStudent(
    id,
    name
  ) {
    const student =
      classData().students.find(
        s => s.id === id
      );

    if (!student) return;

    name = String(name || '')
      .trim()
      .replace(/\s+/g, ' ');

    if (!name) {
      toast('Enter student name.');
      return;
    }

    if (
      classData().students.some(
        s =>
          s.id !== id &&
          s.name.toLowerCase() ===
          name.toLowerCase()
      )
    ) {
      toast(
        'That student name already exists in this class.'
      );
      return;
    }

    student.name = name;

    persist();
    renderAll();

    toast('Student updated.');
  }

  async function deleteStudent(id) {
    const s =
      classData().students.find(
        x => x.id === id
      );

    if (!s) return;

    if (
      !await confirmAction(
        'Delete student?',
        `Are you sure you want to delete ${s.name}? Their records will be removed from this class's exams.`,
        'Delete',
        true
      )
    ) {
      return;
    }

    classData().students =
      classData().students.filter(
        x => x.id !== id
      );

    classData().exams.forEach(e => {
      delete e.marks[id];
      delete e.statuses[id];
    });

    persist();
    renderAll();

    toast('Student deleted.');
  }

  function updateExam(
    exam,
    name,
    totalMarks,
    date
  ) {
    name = String(name || '').trim();

    const total =
      Number(totalMarks);

    if (
      !name ||
      !Number.isInteger(total) ||
      total < 1
    ) {
      toast(
        'Enter valid exam details.'
      );
      return false;
    }

    const duplicate =
      classData().exams.some(
        e =>
          e.id !== exam.id &&
          e.name.toLowerCase() ===
            name.toLowerCase() &&
          e.date === date
      );

    if (duplicate) {
      toast(
        'Another exam has the same name and date.'
      );
      return false;
    }

    exam.name = name;
    exam.totalMarks = total;
    exam.date =
      date ||
      exam.date ||
      todayISO();

    ensureExamStudents(exam);

    persist();
    renderAll();

    toast('Exam updated.');

    return true;
  }

  async function deleteExam(id) {
    const exam =
      classData().exams.find(
        e => e.id === id
      );

    if (!exam) return;

    if (
      !await confirmAction(
        'Delete exam?',
        `Delete “${exam.name}” and all marks saved in it?`,
        'Delete',
        true
      )
    ) {
      return;
    }

    classData().exams =
      classData().exams.filter(
        e => e.id !== id
      );

    if (
      state.selectedExamId === id
    ) {
      state.selectedExamId =
        classData().exams[0]?.id ||
        null;
    }

    persist();
    renderAll();

    toast('Exam deleted.');
  }
    function duplicateExam(id) {
    const source =
      classData().exams.find(
        e => e.id === id
      );

    if (!source) return;

    const copy = {
      id: uid('exam'),
      name: `${source.name} — Copy`,
      totalMarks: source.totalMarks,
      date: todayISO(),
      teacherSignature: '',
      marks: {},
      statuses: {}
    };

    classData().students.forEach(s => {
      copy.marks[s.id] = '';
      copy.statuses[s.id] = 'pending';
    });

    classData().exams.push(copy);

    state.selectedExamId = copy.id;

    persist();
    renderAll();

    toast(
      'Exam duplicated with fresh marks.'
    );
  }

  function saveMark(id, raw, input) {
    const e = currentExam();

    if (!e) {
      toast(
        'Select an exam first.'
      );
      return;
    }

    ensureExamStudents(e);

    if (
      e.statuses[id] === 'absent'
    ) {
      toast(
        'Student is marked absent.'
      );
      return;
    }

    raw = String(raw).trim();

    if (raw === '') {
      e.marks[id] = '';
      e.statuses[id] = 'pending';

      input.classList.remove(
        'invalid',
        'saved'
      );

      persist();
      renderAnalytics();
      renderHistory();
      renderTable();

      return;
    }

    const value = Number(raw);
const valid = Number.isFinite(value) && value >= 0 && value <= e.totalMarks;

    input.classList.toggle(
      'invalid',
      !valid
    );

    if (!valid) {
      toast(
        `Marks must be between 0 and ${e.totalMarks}.`
      );
      return;
    }

    e.marks[id] = value;
    e.statuses[id] = 'present';

    persist();

    input.classList.add('saved');

    setTimeout(
      () =>
        input.classList.remove(
          'saved'
        ),
      350
    );

    renderAnalytics();
    renderHistory();
  }

  async function toggleAbsent(id) {
    const e = currentExam();

    if (!e) {
      toast(
        'Create or select an exam first.'
      );
      return;
    }

    ensureExamStudents(e);

    if (
      e.statuses[id] === 'absent'
    ) {
      e.statuses[id] = 'pending';
      e.marks[id] = '';

      persist();
      renderAll();

      toast(
        'Student returned to Pending.'
      );

      return;
    }

    const student =
      classData().students.find(
        s => s.id === id
      );

    if (
      !await confirmAction(
        'Mark student absent?',
        `${student?.name || 'This student'} will print as ABSENT.`,
        'Mark Absent'
      )
    ) {
      return;
    }

    e.statuses[id] = 'absent';
    e.marks[id] = '';

    persist();
    renderAll();

    toast(
      'Student marked absent.'
    );
  }

  async function markAllPendingAbsent() {
    const e = currentExam();

    if (!e) {
      toast(
        'Select an exam first.'
      );
      return;
    }

    const pending =
      classData().students.filter(
        s =>
          (
            e.statuses[s.id] ||
            'pending'
          ) === 'pending'
      );

    if (!pending.length) {
      toast(
        'No pending students.'
      );
      return;
    }

    if (
      !await confirmAction(
        'Mark all pending as Absent?',
        `${pending.length} students will be marked ABSENT.`,
        'Mark Absent'
      )
    ) {
      return;
    }

    pending.forEach(s => {
      e.statuses[s.id] = 'absent';
      e.marks[s.id] = '';
    });

    persist();
    renderAll();

    toast(
      `${pending.length} students marked absent.`
    );
  }

  function openModal(
    html,
    afterOpen
  ) {
    closeModal(false);

    $('modalCard').innerHTML = html;

    $('modalRoot').classList.remove(
      'hidden'
    );

    $('modalRoot').setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow =
      'hidden';

    const backdrop =
      $('modalRoot').querySelector(
        '[data-close-modal]'
      );

    if (backdrop) {
      backdrop.onclick = () =>
        closeModal();
    }

    const close =
      $('modalRoot').querySelector(
        '[data-modal-close]'
      );

    if (close) {
      close.onclick = () =>
        closeModal();
    }

    if (
      typeof afterOpen === 'function'
    ) {
      afterOpen(
        $('modalCard')
      );
    }
  }

  function closeModal(
    clear = true
  ) {
    if (state.modalCleanup) {
      try {
        state.modalCleanup();
      } catch (_) {}

      state.modalCleanup = null;
    }

    $('modalRoot').classList.add(
      'hidden'
    );

    $('modalRoot').setAttribute(
      'aria-hidden',
      'true'
    );

    $('modalCard').innerHTML = '';

    document.body.style.overflow =
      '';
  }

  function confirmAction(
    title,
    message,
    okText = 'Confirm',
    danger = false
  ) {
    return new Promise(resolve => {
      openModal(
        `
          <div class="modal-head">
            <div>
              <span class="eyebrow">
                CONFIRMATION
              </span>

              <h3>
                ${escapeHTML(title)}
              </h3>
            </div>

            <button
              class="close-modal"
              type="button"
              data-modal-close
            >
              ×
            </button>
          </div>

          <p class="confirm-copy">
            ${escapeHTML(message)
              .replace(/\n/g, '<br>')}
          </p>

          <div class="modal-actions">
            <button
              class="btn outline"
              type="button"
              data-cancel
            >
              Cancel
            </button>

            <button
              class="btn ${danger ? 'dark' : 'primary'}"
              type="button"
              data-ok
            >
              ${escapeHTML(okText)}
            </button>
          </div>
        `,
        card => {
          card.querySelector(
            '[data-cancel]'
          ).onclick = () => {
            closeModal();
            resolve(false);
          };

          card.querySelector(
            '[data-ok]'
          ).onclick = () => {
            closeModal();
            resolve(true);
          };
        }
      );
    });
  }
    function openStudentProfileModal(id) {
    const student =
      classData().students.find(
        s => s.id === id
      );

    if (!student) return;

    const exams =
      classData()
        .exams
        .slice()
        .sort(
          (a, b) =>
            (b.date || '')
              .localeCompare(a.date || '')
        );

    let appeared = 0;
    let absent = 0;
    let pending = 0;
    let sumPct = 0;
    let highestPct = null;

    const rows =
      exams
        .map((e, i) => {
          ensureExamStudents(e);

          const st =
            e.statuses[student.id] ||
            'pending';

          const raw =
            e.marks[student.id];

          let result = 'Pending';
          let pct = null;

          if (st === 'absent') {
            absent++;
            result = 'ABSENT';
          } else if (
            st === 'present' &&
            raw !== '' &&
            Number.isFinite(Number(raw))
          ) {
            appeared++;

            const mark = Number(raw);

            pct = e.totalMarks
              ? (mark / e.totalMarks) * 100
              : 0;

            sumPct += pct;

            highestPct =
              highestPct === null
                ? pct
                : Math.max(
                    highestPct,
                    pct
                  );

            result =
              `${mark} / ${e.totalMarks}`;
          } else {
            pending++;
          }

          return `
            <tr>
              <td>${i + 1}</td>

              <td>
                <b>
                  ${escapeHTML(e.name)}
                </b>
                <small>
                  ${formatDate(e.date)}
                </small>
              </td>

              <td>
                ${escapeHTML(result)}
              </td>

              <td>
                ${
                  pct === null
                    ? '—'
                    : pct.toFixed(1) + '%'
                }
              </td>
            </tr>
          `;
        })
        .join('');

    const average =
      appeared
        ? (sumPct / appeared)
            .toFixed(1) + '%'
        : '—';

    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              STUDENT RESULT PROFILE
            </span>

            <h3>
              ${escapeHTML(student.name)}
            </h3>

            <p class="profile-subtitle">
              Class ${state.selectedClass}
              · Complete exam history
            </p>
          </div>

          <button
            class="close-modal"
            type="button"
            data-modal-close
          >
            ×
          </button>
        </div>

        <div class="profile-stats">
          <div>
            <small>EXAMS</small>
            <strong>
              ${exams.length}
            </strong>
          </div>

          <div>
            <small>APPEARED</small>
            <strong>
              ${appeared}
            </strong>
          </div>

          <div>
            <small>ABSENT</small>
            <strong>
              ${absent}
            </strong>
          </div>

          <div>
            <small>PENDING</small>
            <strong>
              ${pending}
            </strong>
          </div>

          <div>
            <small>AVERAGE</small>
            <strong>
              ${average}
            </strong>
          </div>

          <div>
            <small>BEST</small>
            <strong>
              ${
                highestPct === null
                  ? '—'
                  : highestPct.toFixed(1) + '%'
              }
            </strong>
          </div>
        </div>

        <div class="profile-table-wrap">
          ${
            exams.length
              ? `
                <table class="profile-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Exam</th>
                      <th>Marks</th>
                      <th>%</th>
                    </tr>
                  </thead>

                  <tbody>
                    ${rows}
                  </tbody>
                </table>
              `
              : `
                <div class="empty">
                  <h3>No exam history</h3>

                  <p>
                    This student has no saved
                    exams yet.
                  </p>
                </div>
              `
          }
        </div>
      `,
      card => {
        const first =
          card.querySelector(
            '[data-modal-close]'
          );

        if (first) {
          first.focus();
        }
      }
    );
  }

  function openStudentModal(
    editId = ''
  ) {
    const student =
      editId
        ? classData().students.find(
            s => s.id === editId
          )
        : null;

    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              STUDENT MANAGEMENT
            </span>

            <h3>
              ${
                editId
                  ? 'Edit Student'
                  : 'Add Student'
              }
            </h3>
          </div>

          <button
            class="close-modal"
            type="button"
            data-modal-close
          >
            ×
          </button>
        </div>

        <form
          id="studentModalForm"
          class="modal-form"
        >
          <label class="field">
            <span>
              Student Name
            </span>

            <input
              id="modalStudentName"
              required
              maxlength="80"
              autocomplete="off"
              placeholder="Enter student name"
              value="${escapeHTML(
                student?.name || ''
              )}"
            >
          </label>

          <div class="modal-actions">
            <button
              class="btn outline"
              type="button"
              data-modal-close
            >
              Cancel
            </button>

            <button
              class="btn primary"
              type="submit"
            >
              ${
                editId
                  ? 'Save Changes'
                  : 'Add Student'
              }
            </button>
          </div>
        </form>
      `,
      card => {
        const form =
          card.querySelector(
            '#studentModalForm'
          );

        form.onsubmit = e => {
          e.preventDefault();

          const ok = editId
            ? editStudentSync(
                editId,
                card.querySelector(
                  '#modalStudentName'
                ).value
              )
            : addStudent(
                card.querySelector(
                  '#modalStudentName'
                ).value
              );

          if (ok) {
            closeModal();
          }
        };

        setTimeout(
          () =>
            card.querySelector(
              '#modalStudentName'
            ).focus(),
          30
        );
      }
    );
  }

  function editStudentSync(
    id,
    name
  ) {
    name = String(name || '')
      .trim()
      .replace(/\s+/g, ' ');

    if (!name) {
      toast(
        'Enter student name.'
      );
      return false;
    }

    if (
      classData().students.some(
        s =>
          s.id !== id &&
          s.name.toLowerCase() ===
            name.toLowerCase()
      )
    ) {
      toast(
        'That student name already exists in this class.'
      );
      return false;
    }

    const s =
      classData().students.find(
        x => x.id === id
      );

    if (!s) return false;

    s.name = name;

    persist();
    renderAll();

    toast(
      'Student updated.'
    );

    return true;
  }

  function openNewExamModal() {
    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              EXAM MANAGEMENT
            </span>

            <h3>
              Create New Exam
            </h3>
          </div>

          <button
            class="close-modal"
            type="button"
            data-modal-close
          >
            ×
          </button>
        </div>

        <form
          id="newExamForm"
          class="modal-form"
        >
          <label class="field">
            <span>Class</span>

            <select id="modalExamClass">
              ${CLASSES.map(
                c =>
                  `<option
                    value="${c}"
                    ${
                      c === state.selectedClass
                        ? 'selected'
                        : ''
                    }
                  >
                    Class ${c}
                  </option>`
              ).join('')}
            </select>
          </label>

          <label class="field">
            <span>Exam Name</span>

            <input
              id="modalExamName"
              required
              maxlength="80"
              placeholder="e.g. Unit Test 1"
            >
          </label>

          <label class="field">
            <span>Total Marks</span>

            <input
              id="modalExamMarks"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              value="100"
              required
            >
          </label>

          <label class="field">
            <span>Date of Exam</span>

            <input
              id="modalExamDate"
              type="date"
              value="${todayISO()}"
              required
            >
          </label>

          <div class="modal-actions">
            <button
              class="btn outline"
              type="button"
              data-modal-close
            >
              Cancel
            </button>

            <button
              class="btn primary"
              type="submit"
            >
              Create Exam
            </button>
          </div>
        </form>
      `,
      card => {
        card.querySelector(
          '#newExamForm'
        ).onsubmit = e => {
          e.preventDefault();

          const ok =
            createExam(
              card.querySelector(
                '#modalExamName'
              ).value,

              card.querySelector(
                '#modalExamMarks'
              ).value,

              card.querySelector(
                '#modalExamDate'
              ).value,

              card.querySelector(
                '#modalExamClass'
              ).value
            );

          if (ok) {
            closeModal();
          }
        };

        setTimeout(
          () =>
            card.querySelector(
              '#modalExamName'
            ).focus(),
          30
        );
      }
    );
  }

  function openEditExamModal(id) {
    const e =
      classData().exams.find(
        x => x.id === id
      );

    if (!e) return;

    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              EXAM MANAGEMENT
            </span>

            <h3>
              Edit Exam
            </h3>
          </div>

          <button
            class="close-modal"
            type="button"
            data-modal-close
          >
            ×
          </button>
        </div>

        <form
          id="editExamModalForm"
          class="modal-form"
        >
          <label class="field">
            <span>
              Exam Name
            </span>

            <input
              id="modalEditExamName"
              required
              maxlength="80"
              value="${escapeHTML(e.name)}"
            >
          </label>

          <label class="field">
            <span>
              Total Marks
            </span>

            <input
              id="modalEditExamMarks"
              type="number"
              min="1"
              step="1"
              value="${e.totalMarks}"
              required
            >
          </label>

          <label class="field">
            <span>
              Date of Exam
            </span>

            <input
              id="modalEditExamDate"
              type="date"
              value="${escapeHTML(e.date)}"
              required
            >
          </label>

          <div class="modal-actions">
            <button
              class="btn outline"
              type="button"
              data-modal-close
            >
              Cancel
            </button>

            <button
              class="btn primary"
              type="submit"
            >
              Save Changes
            </button>
          </div>
        </form>
      `,
      card => {
        card.querySelector(
          '#editExamModalForm'
        ).onsubmit = ev => {
          ev.preventDefault();

          const ok =
            updateExam(
              e,

              card.querySelector(
                '#modalEditExamName'
              ).value,

              card.querySelector(
                '#modalEditExamMarks'
              ).value,

              card.querySelector(
                '#modalEditExamDate'
              ).value
            );

          if (ok) {
            closeModal();
          }
        };
      }
    );
  }

  function openToolsModal() {
    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              TOOLS
            </span>

            <h3>
              Result Manager Tools
            </h3>
          </div>

          <button
            class="close-modal"
            type="button"
            data-modal-close
          >
            ×
          </button>
        </div>

        <div class="tool-grid">
          <button
            class="tool-card"
            type="button"
            id="toolInsights"
          >
            <strong>
              Result Intelligence
            </strong>

            <span>
              Class-wise performance overview
              and exam insights.
            </span>
          </button>

          <button
            class="tool-card"
            type="button"
            id="toolBackup"
          >
            <strong>
              Backup Data
            </strong>

            <span>
              Download all classes,
              students and exams.
            </span>
          </button>

          <button
            class="tool-card"
            type="button"
            id="toolShareBackup"
          >
            <strong>
              Transfer Data
            </strong>

            <span>
              Share a complete backup to another mobile.
            </span>
          </button>

          <button
            class="tool-card"
            type="button"
            id="toolRestore"
          >
            <strong>
              Restore Data
            </strong>

            <span>
              Restore safely with an
              automatic safety backup.
            </span>
          </button>

          <button
            class="tool-card"
            type="button"
            id="toolHealth"
          >
            <strong>
              Data Health
            </strong>

            <span>
              Check records, storage
              and data integrity.
            </span>
          </button>

          <button
            class="tool-card"
            type="button"
            id="toolCSV"
          >
            <strong>
              Export CSV
            </strong>

            <span>
              Export the selected
              exam table.
            </span>
          </button>

          <button
            class="tool-card"
            type="button"
            id="toolPrint"
          >
            <strong>
              Print Result
            </strong>

            <span>
              Choose the teacher signature
              and open the A4 report.
            </span>
          </button>

          <button
            class="tool-card"
            type="button"
            id="toolInstall"
          >
            <strong>
              Install App
            </strong>

            <span>
              Install the offline PWA
              when supported.
            </span>
          </button>
        </div>
      `,
      card => {
        card.querySelector(
          '#toolInsights'
        ).onclick = () => {
          closeModal();
          openResultIntelligenceModal();
        };

        card.querySelector(
          '#toolBackup'
        ).onclick = () => {
          exportBackup('manual');
          closeModal();
        };

        card.querySelector(
          '#toolShareBackup'
        ).onclick = async () => {
          closeModal();
          await shareBackup();
        };

        card.querySelector(
          '#toolRestore'
        ).onclick = () => {
          closeModal();
          $('restoreFile').click();
        };

        card.querySelector(
          '#toolHealth'
        ).onclick = () => {
          closeModal();
          openDataHealthModal();
        };

        card.querySelector(
          '#toolCSV'
        ).onclick = () => {
          exportCSV();
          closeModal();
        };

        card.querySelector(
          '#toolPrint'
        ).onclick = () => {
          closeModal();
          openPrintOptionsModal();
        };

        card.querySelector(
          '#toolInstall'
        ).onclick = () => {
          installApp();
          closeModal();
        };
      }
    );
  }

  function openPrintOptionsModal() {
    const e = currentExam();

    if (!e) {
      toast(
        'Create or select an exam first.'
      );
      return;
    }

    const selected =
      TEACHERS.includes(
        e.teacherSignature
      )
        ? e.teacherSignature
        : TEACHERS[0];

    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              PRINT SETTINGS
            </span>

            <h3>
              Teacher Signature
            </h3>

            <p class="profile-subtitle">
              Select the teacher whose
              signature will appear on
              this exam report.
            </p>
          </div>

          <button
            class="close-modal"
            type="button"
            data-modal-close
          >
            ×
          </button>
        </div>

        <form
          id="signatureForm"
          class="signature-form"
        >
          <div class="signature-options">
            ${TEACHERS.map(
              (t, i) =>
                `
                  <label
                    class="signature-option"
                  >
                    <input
                      type="radio"
                      name="teacherSignature"
                      value="${escapeHTML(t)}"
                      ${
                        t === selected
                          ? 'checked'
                          : ''
                      }
                    >

                    <span>
                      <strong>
                        ${i + 1}.
                        ${escapeHTML(t)}
                      </strong>

                      <small>
                        Teacher Signature
                      </small>
                    </span>
                  </label>
                `
            ).join('')}
          </div>

          <div class="modal-actions">
            <button
              class="btn outline"
              type="button"
              data-modal-close
            >
              Cancel
            </button>

            <button
              class="btn dark"
              type="submit"
            >
              Print Result
            </button>
          </div>
        </form>
      `,
      card => {
        card.querySelector(
          '#signatureForm'
        ).onsubmit = ev => {
          ev.preventDefault();

          const chosen =
            card.querySelector(
              'input[name="teacherSignature"]:checked'
            )?.value ||
            TEACHERS[0];

          e.teacherSignature =
            chosen;

          persist();
          renderAll();
          closeModal();

          setTimeout(
            () => printResult(e),
            40
          );
        };
      }
    );
              }
  function printResult(exam) {
    if (!exam) {
      toast('Select an exam first.');
      return;
    }

    ensureExamStudents(exam);

    const students = classData().students.slice();
    const teacher = TEACHERS.includes(exam.teacherSignature)
      ? exam.teacherSignature
      : TEACHERS[0];
    const s = stats(exam);

    const rows = students.map((student, index) => {
      const status = exam.statuses[student.id] || 'pending';
      const raw = exam.marks[student.id];
      const absent = status === 'absent';
      const hasMark = !absent && raw !== '' && Number.isFinite(Number(raw));
      const mark = hasMark ? Number(raw) : null;
      const percentage = hasMark
        ? ((mark / exam.totalMarks) * 100).toFixed(1) + '%'
        : absent
          ? 'ABSENT'
          : '—';

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHTML(student.name)}</td>
          <td class="${absent ? 'print-absent' : ''}">${absent ? 'ABSENT' : hasMark ? escapeHTML(mark) : '—'}</td>
          <td class="${absent ? 'print-absent' : ''}">${percentage}</td>
        </tr>`;
    }).join('');

    const win = window.open('', '_blank', 'width=1000,height=800');
    if (!win) {
      toast('Popup blocked. Please allow popups to print.');
      return;
    }

    win.document.open();
    win.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(exam.name)} — Class ${escapeHTML(state.selectedClass)}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:#111}
  body{font-family:Arial,Helvetica,sans-serif;padding:18px}
  .report{max-width:960px;margin:0 auto}
  .header{text-align:center;border-bottom:2px solid #0e446e;padding-bottom:10px;margin-bottom:12px}
  .header img{width:58px;height:58px;object-fit:contain;display:block;margin:0 auto 5px}
  .header h1{margin:0;font-size:22px;letter-spacing:.2px}
  .header h2{margin:4px 0 0;font-size:14px;font-weight:600;color:#333}
  .heading{margin:8px 0 11px;text-align:center;font-size:14px;font-weight:800;letter-spacing:1px;color:#0e446e}
  .meta{display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid #999;margin-bottom:10px}
  .meta>div{padding:7px 8px;border-right:1px solid #999;font-size:10px}
  .meta>div:last-child{border-right:0}
  .meta small{display:block;font-size:7px;color:#666;text-transform:uppercase;margin-bottom:3px}
  .meta strong{font-size:10px}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #999;margin-bottom:11px}
  .summary-box{padding:7px;text-align:center;border-right:1px solid #999}
  .summary-box:last-child{border-right:0}
  .summary-box small{display:block;font-size:7px;color:#666;text-transform:uppercase;margin-bottom:3px}
  .summary-box strong{font-size:13px}
  .completion{text-align:right;font-size:7.5px;color:#666;margin:-3px 0 7px}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  th,td{border:1px solid #777;padding:6px 7px;font-size:9.5px;vertical-align:middle}
  th{background:#eef3f7;font-weight:800}
  th:first-child,td:first-child{width:45px;text-align:center}
  th:nth-child(2),td:nth-child(2){width:auto}
  th:nth-child(3),td:nth-child(3){width:75px;text-align:center}
  th:nth-child(4),td:nth-child(4){width:85px;text-align:center}
  .print-absent{font-weight:800}
  .note{font-size:7.5px;color:#666;margin-top:7px}
  .signature-area{display:flex;justify-content:flex-end;margin-top:16px;page-break-inside:avoid}
  .signature-box{width:205px;border:1px solid #444;padding:9px 12px 7px;text-align:center;background:#fff}
  .signature-name{font-family:"Segoe Script","Brush Script MT","URW Chancery L",cursive;font-size:18px;font-style:italic;font-weight:600;line-height:1.05;margin:0 0 3px;color:#111}
  .signature-line{border-top:1px solid #222;width:100%;margin:0 0 3px}
  .signature-label{font-size:7.5px;color:#555;margin:0}
  .footer{display:flex;justify-content:space-between;border-top:1px solid #bbb;padding-top:7px;margin-top:12px;font-size:7.5px;color:#666}
  @media(max-width:600px){body{padding:8px}.meta{grid-template-columns:1fr}.meta>div{border-right:0;border-bottom:1px solid #999}.meta>div:last-child{border-bottom:0}.summary{grid-template-columns:repeat(2,1fr)}.summary-box:nth-child(2){border-right:0}.summary-box:nth-child(-n+2){border-bottom:1px solid #999}.signature-area{margin-top:12px}.signature-box{width:190px}}
  @media print{body{padding:0}.report{max-width:none}@page{size:A4 portrait;margin:10mm}}
</style>
</head>
<body>
<div class="report">
  <div class="header">
    <img src="assets/image.svg.png" alt="EZEE VISION CHAMPUA">
    <h1>EZEE VISION CHAMPUA</h1>
    <h2>STUDENT RESULT MANAGER PRO</h2>
  </div>
  <div class="heading">EXAM RESULT SHEET</div>
  <div class="meta">
    <div><small>Exam</small><strong>${escapeHTML(exam.name)}</strong></div>
    <div><small>Class</small><strong>Class ${escapeHTML(state.selectedClass)}</strong></div>
    <div><small>Date of Exam</small><strong>${escapeHTML(formatDate(exam.date))}</strong></div>
  </div>
  <div class="summary">
    <div class="summary-box"><small>Students</small><strong>${s.total}</strong></div>
    <div class="summary-box"><small>Present</small><strong>${s.present}</strong></div>
    <div class="summary-box"><small>Absent</small><strong>${s.absent}</strong></div>
    <div class="summary-box"><small>Total Marks</small><strong>${exam.totalMarks}</strong></div>
  </div>
  <div class="completion">Result Entry Completion: <b>${s.total ? Math.round(((s.present + s.absent) / s.total) * 100) : 0}%</b></div>
  <table>
    <thead><tr><th>Sl. No.</th><th>Name of the Students</th><th>Marks</th><th>Percentage</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No students</td></tr>'}</tbody>
  </table>
  <div class="note">ABSENT = Student was absent in this examination. Pending entries are left blank.</div>
  <div class="signature-area">
    <div class="signature-box">
      <div class="signature-name">${escapeHTML(teacher)}</div>
      <div class="signature-line"></div>
      <div class="signature-label">Teacher’s Signature</div>
    </div>
  </div>
  <div class="footer"><span>EZEE VISION CHAMPUA · Class ${escapeHTML(state.selectedClass)}</span><span>Generated ${escapeHTML(formatDate(todayISO()))}</span></div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script>
</body>
</html>`);
    win.document.close();
  }


  function exportCSV() {
    const e = currentExam();

    if (!e) {
      toast(
        'Select an exam first.'
      );
      return;
    }

    ensureExamStudents(e);

    const rows = [
      [
        'Roll No.',
        'Student Name',
        'Status',
        'Marks',
        'Total Marks',
        'Percentage'
      ]
    ];

    classData().students.forEach(
      (student, index) => {
        const status =
          e.statuses[student.id] ||
          'pending';

        const raw =
          e.marks[student.id];

        const marks =
          status === 'absent'
            ? ''
            : raw;

        const percentage =
          status === 'absent' ||
          raw === ''
            ? ''
            : (
                (Number(raw) /
                  e.totalMarks) *
                100
              ).toFixed(1);

        rows.push([
          index + 1,
          student.name,
          status,
          marks,
          e.totalMarks,
          percentage
        ]);
      }
    );

    const csv =
      rows
        .map(
          row =>
            row
              .map(value => {
                const text =
                  String(
                    value ?? ''
                  );

                return `"${text.replace(
                  /"/g,
                  '""'
                )}"`;
              })
              .join(',')
        )
        .join('\r\n');

    const blob =
      new Blob(
        [csv],
        {
          type:
            'text/csv;charset=utf-8;'
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;

    a.download =
      `${state.selectedClass}_${e.name
        .replace(/[^\w\-]+/g, '_')}.csv`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    URL.revokeObjectURL(url);

    toast(
      'CSV exported successfully.'
    );
  }


  function exportBackup(
    source = 'manual'
  ) {
    try {
      const backup = {
        app:
          'EZEE VISION CHAMPUA',
        version: 1,
        exportedAt:
          new Date().toISOString(),
        data: state.db
      };

      const blob =
        new Blob(
          [
            JSON.stringify(
              backup,
              null,
              2
            )
          ],
          {
            type:
              'application/json'
          }
        );

      const url =
        URL.createObjectURL(blob);

      const a =
        document.createElement('a');

      a.href = url;

      a.download =
        `ezee-result-backup-${
          new Date()
            .toISOString()
            .slice(0, 10)
        }.json`;

      document.body.appendChild(a);

      a.click();

      a.remove();

      URL.revokeObjectURL(url);

      if (source === 'manual') {
        toast(
          'Backup downloaded.'
        );
      }

    } catch (err) {
      console.error(err);

      toast(
        'Backup failed.'
      );
    }
  }


  async function shareBackup() {
    try {
      const backup = {
        app: 'EZEE VISION CHAMPUA',
        version: 1,
        exportedAt: new Date().toISOString(),
        data: state.db
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json'
      });

      const filename = `ezee-result-transfer-${todayISO()}.json`;

      if (navigator.share && typeof File !== 'undefined') {
        const file = new File([blob], filename, { type: 'application/json' });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'EZEE VISION CHAMPUA — Result Data',
            text: 'Student Result Manager data backup. Restore this file on the other device.',
            files: [file]
          });
          toast('Backup shared successfully.');
          return;
        }
      }

      downloadBlob(blob, filename);
      toast('Transfer backup downloaded. Send this file to the other mobile.');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error('Share backup failed:', err);
      exportBackup('manual');
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function restoreBackup(
    file
  ) {
    if (!file) return;

    try {
      const text =
        await file.text();

      const parsed =
        JSON.parse(text);

      const incoming =
        parsed?.data || parsed;

      const normalized =
        normalizeDB(incoming);

      if (
        !normalized.classes ||
        typeof normalized.classes !==
          'object'
      ) {
        throw new Error(
          'Invalid backup.'
        );
      }

      const ok =
        await confirmAction(
          'Restore backup?',
          'Current data will be replaced by the selected backup. A safety backup will be downloaded first.',
          'Restore',
          true
        );

      if (!ok) {
        $('restoreFile').value = '';
        return;
      }

      exportBackup(
        'safety'
      );

      state.db =
        normalized;

      state.selectedClass =
        '4';

      state.selectedExamId =
        state.db.classes['4']
          .exams[0]?.id || null;

      state.search = '';

      $('searchInput').value =
        '';

      persist();

      renderAll();

      toast(
        'Backup restored successfully.'
      );

    } catch (err) {
      console.error(err);

      toast(
        'Could not restore this backup file.'
      );

    } finally {
      $('restoreFile').value = '';
    }
  }


  function openDataHealthModal() {
    const report = [];

    let totalStudents = 0;
    let totalExams = 0;
    let totalMarks = 0;
    let invalidMarks = 0;

    CLASSES.forEach(c => {
      const d =
        state.db.classes[c];

      totalStudents +=
        d.students.length;

      totalExams +=
        d.exams.length;

      d.exams.forEach(e => {
        totalMarks +=
          Object.values(
            e.marks || {}
          ).filter(
            value =>
              value !== ''
          ).length;

        d.students.forEach(s => {
          const raw =
            e.marks[s.id];

          if (
            raw !== '' &&
            (
              !Number.isFinite(
                Number(raw)
              ) ||
              Number(raw) < 0 ||
              Number(raw) >
                e.totalMarks
            )
          ) {
            invalidMarks++;
          }
        });
      });
    });

    report.push(
      `Classes configured: ${CLASSES.length}`
    );

    report.push(
      `Students stored: ${totalStudents}`
    );

    report.push(
      `Exams stored: ${totalExams}`
    );

    report.push(
      `Marks entered: ${totalMarks}`
    );

    report.push(
      `Invalid marks found: ${invalidMarks}`
    );

    const healthy =
      invalidMarks === 0;

    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              DATA HEALTH
            </span>

            <h3>
              ${
                healthy
                  ? 'Everything looks healthy'
                  : 'Attention required'
              }
            </h3>
          </div>

          <button
            class="close-modal"
            type="button"
            data-modal-close
          >
            ×
          </button>
        </div>

        <div class="health-list">
          ${report
            .map(
              item =>
                `
                  <div>
                    <span>
                      ${escapeHTML(item)}
                    </span>
                  </div>
                `
            )
            .join('')}
        </div>

        <div class="modal-actions">
          <button
            class="btn outline"
            type="button"
            data-modal-close
          >
            Close
          </button>
        </div>
      `
    );
  }


  function openResultIntelligenceModal() {
    const exams =
      classData().exams;

    const students =
      classData().students;

    if (!exams.length) {
      openModal(`
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              RESULT INTELLIGENCE
            </span>

            <h3>
              No data yet
            </h3>
          </div>

          <button
            class="close-modal"
            type="button"
            data-modal-close
          >
            ×
          </button>
        </div>

        <div class="empty">
          <p>
            Create an exam and enter marks
            to see performance insights.
          </p>
        </div>
      `);

      return;
    }

    let bestStudent = null;
    let bestAverage = -1;

    students.forEach(student => {
      let sum = 0;
      let count = 0;

      exams.forEach(e => {
        ensureExamStudents(e);

        if (
          e.statuses[student.id] ===
            'present' &&
          e.marks[student.id] !== ''
        ) {
          const pct =
            (
              Number(
                e.marks[student.id]
              ) /
              e.totalMarks
            ) * 100;

          if (
            Number.isFinite(pct)
          ) {
            sum += pct;
            count++;
          }
        }
      });

      if (count) {
        const avg =
          sum / count;

        if (
          avg > bestAverage
        ) {
          bestAverage = avg;

          bestStudent = {
            name: student.name,
            average: avg
          };
        }
      }
    });

    const examInsights =
      exams.map(e => {
        const s = stats(e);

        return {
          name: e.name,
          average: s.average,
          present: s.present,
          absent: s.absent,
          pending: s.pending
        };
      });

    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              RESULT INTELLIGENCE
            </span>

            <h3>
              Class ${state.selectedClass}
              Performance
            </h3>
          </div>

          <button
            class="close-modal"
            type="button"
            data-modal-close
          >
            ×
          </button>
        </div>

        <div class="insight-grid">

          <div class="insight-card">
            <small>
              TOP STUDENT
            </small>

            <strong>
              ${
                bestStudent
                  ? escapeHTML(
                      bestStudent.name
                    )
                  : '—'
              }
            </strong>

            <span>
              ${
                bestStudent
                  ? bestStudent.average
                      .toFixed(1) +
                    '% average'
                  : 'No marks yet'
              }
            </span>
          </div>

          <div class="insight-card">
            <small>
              TOTAL STUDENTS
            </small>

            <strong>
              ${students.length}
            </strong>

            <span>
              Class ${state.selectedClass}
            </span>
          </div>

          <div class="insight-card">
            <small>
              TOTAL EXAMS
            </small>

            <strong>
              ${exams.length}
            </strong>

            <span>
              Saved examinations
            </span>
          </div>

        </div>

        <div class="insight-list">
          ${examInsights
            .map(
              x =>
                `
                  <div class="insight-row">

                    <div>
                      <strong>
                        ${escapeHTML(
                          x.name
                        )}
                      </strong>

                      <small>
                        Present:
                        ${x.present}
                        · Absent:
                        ${x.absent}
                        · Pending:
                        ${x.pending}
                      </small>
                    </div>

                    <b>
                      ${
                        x.present
                          ? x.average.toFixed(
                              1
                            ) + '%'
                          : '—'
                      }
                    </b>

                  </div>
                `
            )
            .join('')}
        </div>

        <div class="modal-actions">
          <button
            class="btn outline"
            type="button"
            data-modal-close
          >
            Close
          </button>
        </div>
      `
    );
  }


  async function installApp() {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      toast('App is already installed.');
      return;
    }

    if (!state.deferredPrompt) {
      toast('Install is not ready yet. In Chrome, use ⋮ → Install app / Add to Home screen.');
      return;
    }

    try {
      state.deferredPrompt.prompt();
      const result = await state.deferredPrompt.userChoice;
      if (result?.outcome === 'accepted') {
        toast('Installing EZEE Result Manager…');
      }
    } catch (err) {
      console.warn('Install prompt failed:', err);
      toast('Could not open the install prompt. Use Chrome menu → Install app.');
    } finally {
      state.deferredPrompt = null;
      $('installBtn')?.classList.add('hidden');
    }
  }



  /* ================================================================
     RESULT MANAGER 1–30 FEATURE PACK
     Backward-compatible additions. Existing local records are kept.
     ================================================================ */

  const RESULT_GRADE_BANDS = [
    {min:90, grade:'A+', point:10},
    {min:80, grade:'A', point:9},
    {min:70, grade:'B+', point:8},
    {min:60, grade:'B', point:7},
    {min:50, grade:'C+', point:6},
    {min:40, grade:'C', point:5},
    {min:33, grade:'D', point:4},
    {min:0, grade:'F', point:0}
  ];

  function normalizeSubjectList(subjects){
    if(!Array.isArray(subjects)) return [];
    return subjects.map((x,i)=>{
      const name=String(x?.name||x?.title||`Subject ${i+1}`).trim();
      const max=Math.max(0.01,Number(x?.maxMarks)||0);
      return {id:String(x?.id||uid('sub')),name:name||`Subject ${i+1}`,maxMarks:max};
    }).filter(x=>x.name&&x.maxMarks>0);
  }

  function normalizeExamExtended(e, students){
    const marks=e.marks&&typeof e.marks==='object'?{...e.marks}:{};
    const statuses=e.statuses&&typeof e.statuses==='object'?{...e.statuses}:{};
    const subjects=normalizeSubjectList(e.subjects);
    const subjectMarks={};
    const source=e.subjectMarks&&typeof e.subjectMarks==='object'?e.subjectMarks:{};
    students.forEach(st=>{
      if(!(st.id in marks)) marks[st.id]='';
      if(!statuses[st.id]) statuses[st.id]=marks[st.id]===''?'pending':'present';
      if(!['absent','present','pending'].includes(statuses[st.id])) statuses[st.id]=marks[st.id]===''?'pending':'present';
      subjectMarks[st.id]={};
      const row=source[st.id]&&typeof source[st.id]==='object'?source[st.id]:{};
      subjects.forEach(sub=>{subjectMarks[st.id][sub.id]=(row[sub.id]??'')});
    });
    const subjectTotal=subjects.reduce((a,b)=>a+Number(b.maxMarks),0);
    const total=subjects.length?subjectTotal:Math.max(1,Number(e.totalMarks)||100);
    return {
      ...e,
      id:String(e.id),
      name:String(e.name||e.title||'Exam').trim()||'Exam',
      totalMarks:total,
      date:String(e.date||''),
      teacherSignature:TEACHERS.includes(String(e.teacherSignature||''))?String(e.teacherSignature):'',
      passPercent:Math.min(100,Math.max(0,Number(e.passPercent??33)||33)),
      gradeSystem:e.gradeSystem==='custom'?'custom':'standard',
      subjects,
      subjectMarks,
      marks,
      statuses,
      locked:e.locked===true
    };
  }

  /* Replace normalization while retaining the original database shape. */
  function normalizeDB(raw){
    const source=raw&&typeof raw==='object'?raw:blankDB();
    const db={...source,classes:{}};
    CLASSES.forEach(c=>{
      const d=source.classes?.[c]&&typeof source.classes[c]==='object'?source.classes[c]:{};
      const students=Array.isArray(d.students)?d.students.filter(x=>x&&x.id&&String(x.name||'').trim()).map(x=>({id:String(x.id),name:String(x.name).trim()})):[];
      const exams=Array.isArray(d.exams)?d.exams.filter(x=>x&&x.id).map(x=>normalizeExamExtended(x,students)):[];
      db.classes[c]={...d,students,exams};
    });
    db.version=2;
    return db;
  }

  function ensureExamStudents(exam){
    if(!exam)return;
    if(!exam.marks||typeof exam.marks!=='object')exam.marks={};
    if(!exam.statuses||typeof exam.statuses!=='object')exam.statuses={};
    if(!exam.subjectMarks||typeof exam.subjectMarks!=='object')exam.subjectMarks={};
    if(!Array.isArray(exam.subjects))exam.subjects=[];
    classData().students.forEach(st=>{
      if(!(st.id in exam.marks))exam.marks[st.id]='';
      if(!exam.statuses[st.id])exam.statuses[st.id]=exam.marks[st.id]===''?'pending':'present';
      if(!exam.subjectMarks[st.id]||typeof exam.subjectMarks[st.id]!=='object')exam.subjectMarks[st.id]={};
      exam.subjects.forEach(sub=>{if(!(sub.id in exam.subjectMarks[st.id]))exam.subjectMarks[st.id][sub.id]=''});
    });
    if(exam.subjects.length){exam.totalMarks=exam.subjects.reduce((a,b)=>a+Number(b.maxMarks),0)}
  }

  function calculateOverallFromSubjects(exam,studentId){
    if(!exam?.subjects?.length)return exam?.marks?.[studentId]??'';
    const row=exam.subjectMarks?.[studentId]||{};
    let total=0,complete=true;
    exam.subjects.forEach(sub=>{
      const raw=row[sub.id];
      if(raw===''||raw==null){complete=false;return;}
      const n=Number(raw);
      if(!Number.isFinite(n)||n<0||n>Number(sub.maxMarks)){complete=false;return}
      total+=n;
    });
    return complete?Number(total.toFixed(4)):'';
  }

  function percentageFor(exam,studentId){
    ensureExamStudents(exam);
    const st=exam.statuses[studentId]||'pending';
    if(st!=='present')return null;
    const n=Number(exam.subjects?.length?calculateOverallFromSubjects(exam,studentId):exam.marks[studentId]);
    return Number.isFinite(n)&&exam.totalMarks>0?n/exam.totalMarks*100:null;
  }

  function gradeForPercent(pct){
    if(!Number.isFinite(Number(pct)))return '—';
    const band=RESULT_GRADE_BANDS.find(x=>Number(pct)>=x.min);
    return band?band.grade:'F';
  }
  function gradePointForPercent(pct){
    if(!Number.isFinite(Number(pct)))return '—';
    const band=RESULT_GRADE_BANDS.find(x=>Number(pct)>=x.min);
    return band?band.point:'0';
  }
  function isPass(exam,pct){return Number.isFinite(Number(pct))&&Number(pct)>=Number(exam.passPercent??33)}

  function stats(exam){
    if(!exam)return{total:classData().students.length,present:0,absent:0,pending:classData().students.length,highest:null,lowest:null,average:0,pass:0,fail:0};
    ensureExamStudents(exam);let present=0,absent=0,pending=0,pass=0,fail=0,vals=[];
    classData().students.forEach(st=>{
      const status=exam.statuses[st.id]||'pending';
      if(status==='absent'){absent++;return}
      const pct=percentageFor(exam,st.id);
      if(status==='present'&&pct!=null){present++;vals.push(Number(exam.subjects?.length?calculateOverallFromSubjects(exam,st.id):exam.marks[st.id]));if(isPass(exam,pct))pass++;else fail++;}
      else pending++;
    });
    return{total:classData().students.length,present,absent,pending,highest:vals.length?Math.max(...vals):null,lowest:vals.length?Math.min(...vals):null,average:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0,pass,fail};
  }

  function renderExamInfo(){
    const e=currentExam();
    const total=$('totalMarks');
    if(total){total.value=e?e.totalMarks:'';total.readOnly=!!e?.subjects?.length;total.title=e?.subjects?.length?'Total is calculated from subjects':'Total marks'}
    $('examDate').value=e?e.date:'';
    $('examCaption').textContent=e?`${e.name} · ${formatDate(e.date)} · Maximum ${e.totalMarks}${e.subjects?.length?' · '+e.subjects.length+' subjects':''}${e.locked?' · LOCKED':''}`:'No exam selected';
    $('printBtn').disabled=!e;$('saveExamBtn').disabled=!e||!!e?.locked;
    renderFeatureState(e);
  }

  function renderFeatureState(e){
    const subjectBtn=$('subjectSetupBtn'),lockBtn=$('lockExamBtn');
    if(subjectBtn)subjectBtn.disabled=!e;
    if(lockBtn){lockBtn.disabled=!e;lockBtn.textContent=e?.locked?'Unlock Exam':'Lock Exam';lockBtn.classList.toggle('danger',!!e?.locked)}
  }

  function renderAnalytics(){
    const s=stats(currentExam());
    $('analytics').innerHTML=[['Students',s.total,''],['Present',s.present,''],['Absent',s.absent,'absent'],['Pending',s.pending,'pending'],['Pass',s.pass,''],['Fail',s.fail,'absent'],['Highest',s.highest??'—',''],['Lowest',s.lowest??'—',''],['Average',s.present?s.average.toFixed(1):'—','']].map(x=>`<div class="stat ${x[2]}"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('');
  }

  function renderTable(){
    const students=classData().students,exam=currentExam();
    if(exam)ensureExamStudents(exam);
    const q=state.search.trim().toLowerCase();
    const filtered=students.filter(s=>s.name.toLowerCase().includes(q));
    $('studentCount').textContent=`${students.length} ${students.length===1?'Student':'Students'}`;
    $('pendingCount').textContent=`${exam?stats(exam).pending:0} Pending`;
    $('markPendingAbsentBtn').disabled=!exam||!stats(exam).pending||!!exam?.locked;
    $('exportCsvBtn').disabled=!exam;$('entryTip').classList.toggle('hidden',!exam||!students.length);$('emptyState').classList.toggle('hidden',filtered.length>0);
    const table=document.getElementById('resultTable');
    if(table){const thead=table.querySelector('thead');if(exam?.subjects?.length){thead.innerHTML='<tr><th>Sl. No.</th><th>Name of the Students</th>'+exam.subjects.map(s=>`<th>${escapeHTML(s.name)}<small class="th-sub">/${escapeHTML(s.maxMarks)}</small></th>`).join('')+'<th>Total</th><th>%</th><th>Grade</th></tr>'}else{thead.innerHTML='<tr><th>Sl. No.</th><th>Name of the Students</th><th>Marks / Status</th></tr>'}}
    if(!filtered.length){$('resultBody').innerHTML='';return}
    $('resultBody').innerHTML=filtered.map(student=>{
      const status=exam?(exam.statuses[student.id]||'pending'):'pending',absent=status==='absent',locked=!!exam?.locked;
      const actions=`<div class="row-actions"><button class="mini edit-student" type="button" data-id="${escapeHTML(student.id)}" ${locked?'disabled':''}>Edit</button><button class="mini delete delete-student" type="button" data-id="${escapeHTML(student.id)}" ${locked?'disabled':''}>Delete</button></div>`;
      if(exam?.subjects?.length){
        const row=exam.subjectMarks[student.id]||{};
        const cells=exam.subjects.map(sub=>{const v=absent?'':(row[sub.id]??'');return `<td><input class="mark-input subject-mark-input" data-subject-mark-id="${escapeHTML(student.id)}" data-subject-id="${escapeHTML(sub.id)}" type="number" min="0" max="${escapeHTML(sub.maxMarks)}" step="any" inputmode="decimal" value="${escapeHTML(v)}" ${!exam||absent||locked?'disabled':''} placeholder="—"></td>`}).join('');
        const overall=calculateOverallFromSubjects(exam,student.id),pct=percentageFor(exam,student.id),grade=gradeForPercent(pct),result=pct==null?'—':(isPass(exam,pct)?'PASS':'FAIL');
        return `<tr><td>${students.indexOf(student)+1}</td><td><button class="student-name student-profile-btn" type="button" data-profile-id="${escapeHTML(student.id)}">${escapeHTML(student.name)}</button>${actions}<div class="result-mini ${result==='FAIL'?'fail':''}">${result}</div></td>${cells}<td>${overall===''?'—':escapeHTML(overall)}</td><td>${pct==null?'—':pct.toFixed(1)+'%'}</td><td>${grade}</td></tr>`;
      }
      const raw=exam?(exam.marks[student.id]??''):'';const value=absent?'':escapeHTML(raw);const pct=percentageFor(exam,student.id);const result=pct==null?'—':(isPass(exam,pct)?'PASS':'FAIL');
      return `<tr><td>${students.indexOf(student)+1}</td><td><button class="student-name student-profile-btn" type="button" data-profile-id="${escapeHTML(student.id)}">${escapeHTML(student.name)}</button>${actions}</td><td><div class="mark-row"><input class="mark-input" data-mark-id="${escapeHTML(student.id)}" type="number" min="0" max="${exam?exam.totalMarks:100}" step="any" inputmode="decimal" value="${value}" ${!exam||absent||locked?'disabled':''} placeholder="${exam?'Marks':'—'}" aria-label="Marks for ${escapeHTML(student.name)}">${exam?`<button class="status-btn ${absent?'active':''}" type="button" data-status-id="${escapeHTML(student.id)}" ${locked?'disabled':''}>${absent?'Present':'Absent'}</button>`:''}</div>${absent?'<div class="status-note absent">ABSENT</div>':status==='pending'?'<div class="status-note">Pending</div>':''}${exam&&pct!=null?`<div class="status-note">${result} · ${gradeForPercent(pct)}</div>`:''}</td></tr>`;
    }).join('');
  }

  function createExam(name,totalMarks,date,cls){
    const clean=String(name||'').trim(),total=Number(totalMarks),target=state.db.classes[String(cls)];
    if(!clean){toast('Enter an exam name.');return false}
    if(!Number.isFinite(total)||total<1){toast('Total Marks must be a positive number.');return false}
    if(!CLASSES.includes(String(cls))||!target){toast('Invalid class.');return false}
    if(target.exams.some(e=>e.name.toLowerCase()===clean.toLowerCase()&&e.date===date)){toast('An exam with this name and date already exists.');return false}
    const exam={id:uid('exam'),name:clean,totalMarks:total,date:date||todayISO(),teacherSignature:'',marks:{},statuses:{},subjects:[],subjectMarks:{},passPercent:33,gradeSystem:'standard',locked:false};
    target.students.forEach(st=>{exam.marks[st.id]='';exam.statuses[st.id]='pending';exam.subjectMarks[st.id]={}});
    target.exams.push(exam);state.selectedClass=String(cls);state.selectedExamId=exam.id;state.search='';$('searchInput').value='';persist();renderAll();toast('New exam created successfully.');return true;
  }

  function saveCurrentExam(){
    const e=currentExam();if(!e){toast('Create or select an exam first.');return}if(e.locked){toast('Exam is locked. Unlock it before editing.');return}
    const date=$('examDate').value;
    if(e.subjects?.length){e.totalMarks=e.subjects.reduce((a,b)=>a+Number(b.maxMarks),0)}else{const total=Number($('totalMarks').value);if(!Number.isFinite(total)||total<1){toast('Enter valid Total Marks.');return}e.totalMarks=total}
    e.date=date||e.date||todayISO();ensureExamStudents(e);
    classData().students.forEach(st=>{if(e.statuses[st.id]==='absent')return;if(e.subjects?.length){const overall=calculateOverallFromSubjects(e,st.id);e.marks[st.id]=overall;e.statuses[st.id]=overall===''?'pending':'present'}else if(e.marks[st.id]!==''){const n=Number(e.marks[st.id]);if(!Number.isFinite(n)||n<0||n>e.totalMarks){e.marks[st.id]='';e.statuses[st.id]='pending'}}});
    persist();renderAll();toast('Exam saved successfully.');
  }

  function saveMark(id,raw,input){
    const e=currentExam();if(!e)return;if(e.locked){toast('Exam is locked. Unlock it to edit marks.');return}ensureExamStudents(e);if(e.statuses[id]==='absent'){toast('Student is marked absent.');return}
    const value=String(raw??'').trim();if(value===''){e.marks[id]='';e.statuses[id]='pending';input?.classList.remove('invalid','saved');persist();renderAnalytics();renderHistory();return}
    if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)){input?.classList.add('invalid');toast('Enter a valid number.');return}
    const n=Number(value);if(!Number.isFinite(n)||n<0||n>e.totalMarks){input?.classList.add('invalid');toast(`Marks must be between 0 and ${e.totalMarks}.`);return}
    e.marks[id]=n;e.statuses[id]='present';persist();input?.classList.remove('invalid');input?.classList.add('saved');setTimeout(()=>input?.classList.remove('saved'),350);renderAnalytics();renderHistory();
  }

  function saveSubjectMark(studentId,subjectId,raw,input){
    const e=currentExam();if(!e||e.locked)return;ensureExamStudents(e);if(e.statuses[studentId]==='absent')return;
    const value=String(raw??'').trim();const sub=e.subjects.find(x=>x.id===subjectId);if(!sub)return;
    if(value===''){e.subjectMarks[studentId][subjectId]='';e.marks[studentId]='';e.statuses[studentId]='pending';persist();renderTable();renderAnalytics();return}
    if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)){input?.classList.add('invalid');toast('Enter a valid decimal mark.');return}
    const n=Number(value);if(!Number.isFinite(n)||n<0||n>Number(sub.maxMarks)){input?.classList.add('invalid');toast(`Marks must be between 0 and ${sub.maxMarks}.`);return}
    e.subjectMarks[studentId][subjectId]=n;const overall=calculateOverallFromSubjects(e,studentId);e.marks[studentId]=overall;e.statuses[studentId]=overall===''?'pending':'present';persist();input?.classList.remove('invalid');input?.classList.add('saved');setTimeout(()=>input?.classList.remove('saved'),350);renderTable();renderAnalytics();renderHistory();
  }

  function openSubjectSetupModal(){
    const e=currentExam();if(!e){toast('Create or select an exam first.');return}if(e.locked){toast('Unlock the exam first.');return}
    const rows=e.subjects.map((s,i)=>`<div class="subject-edit-row"><input class="subject-name" value="${escapeHTML(s.name)}" data-old-id="${escapeHTML(s.id)}"><input class="subject-max" type="number" min="0.01" step="any" value="${escapeHTML(s.maxMarks)}" data-old-id="${escapeHTML(s.id)}"><button class="mini delete subject-remove" type="button" data-subject-remove="${escapeHTML(s.id)}">Remove</button></div>`).join('');
    openModal(`<div class="modal-head"><div><span class="eyebrow">SUBJECT-WISE MARKS</span><h3>Subject Setup</h3><p class="profile-subtitle">Add subjects and maximum marks. Total marks will be calculated automatically.</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><div id="subjectRows" class="subject-rows">${rows||'<div class="empty"><p>No subjects yet. Add your first subject below.</p></div>'}</div><div class="subject-add-row"><input id="newSubjectName" placeholder="Subject name"><input id="newSubjectMax" type="number" min="0.01" step="any" placeholder="Max marks"><button id="addSubjectNow" class="btn outline" type="button">+ Add Subject</button></div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button id="saveSubjects" class="btn dark" type="button">Save Subjects</button></div>`,card=>{
      const renderRows=()=>{card.querySelector('#subjectRows').innerHTML=e.subjects.length?e.subjects.map(s=>`<div class="subject-edit-row"><input class="subject-name" value="${escapeHTML(s.name)}" data-old-id="${escapeHTML(s.id)}"><input class="subject-max" type="number" min="0.01" step="any" value="${escapeHTML(s.maxMarks)}" data-old-id="${escapeHTML(s.id)}"><button class="mini delete subject-remove" type="button" data-subject-remove="${escapeHTML(s.id)}">Remove</button></div>`).join(''):'<div class="empty"><p>No subjects yet. Add your first subject below.</p></div>'};
      card.querySelector('#addSubjectNow').onclick=()=>{const n=card.querySelector('#newSubjectName').value.trim(),m=Number(card.querySelector('#newSubjectMax').value);if(!n||!Number.isFinite(m)||m<=0){toast('Enter subject name and maximum marks.');return}e.subjects.push({id:uid('sub'),name:n,maxMarks:m});ensureExamStudents(e);card.querySelector('#newSubjectName').value='';card.querySelector('#newSubjectMax').value='';renderRows()};
      card.querySelector('#subjectRows').addEventListener('click',ev=>{const b=ev.target.closest('[data-subject-remove]');if(!b)return;e.subjects=e.subjects.filter(s=>s.id!==b.dataset.subjectRemove);Object.values(e.subjectMarks||{}).forEach(r=>delete r[b.dataset.subjectRemove]);renderRows()});
      card.querySelector('#saveSubjects').onclick=()=>{const names=[...card.querySelectorAll('.subject-name')],maxs=[...card.querySelectorAll('.subject-max')];const updated=[];for(let i=0;i<names.length;i++){const name=names[i].value.trim(),max=Number(maxs[i].value),id=names[i].dataset.oldId;if(!name||!Number.isFinite(max)||max<=0){toast('Every subject needs a valid name and maximum marks.');return}updated.push({id,name,maxMarks:max})}e.subjects=updated;ensureExamStudents(e);e.totalMarks=e.subjects.length?e.subjects.reduce((a,b)=>a+Number(b.maxMarks),0):Math.max(1,Number($('totalMarks').value)||100);classData().students.forEach(st=>{const overall=calculateOverallFromSubjects(e,st.id);e.marks[st.id]=overall;e.statuses[st.id]=overall===''?'pending':'present'});persist();closeModal();renderAll();toast(e.subjects.length?'Subjects saved.':'Subject mode cleared.');};
    });
  }

  function openGradeSettingsModal(){
    const e=currentExam();if(!e){toast('Create or select an exam first.');return}if(e.locked){toast('Unlock the exam first.');return}
    openModal(`<div class="modal-head"><div><span class="eyebrow">GRADING & PASS RULE</span><h3>Result Rules</h3><p class="profile-subtitle">Set the minimum percentage required to pass.</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><label class="field"><span>Passing Percentage</span><input id="passPercentInput" type="number" min="0" max="100" step="0.1" value="${escapeHTML(e.passPercent??33)}"></label><div class="grade-preview">${RESULT_GRADE_BANDS.map(x=>`<span><b>${x.grade}</b> ${x.min}%+</span>`).join('')}</div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button id="saveGradeRules" class="btn dark" type="button">Save Rules</button></div>`,card=>card.querySelector('#saveGradeRules').onclick=()=>{const p=Number(card.querySelector('#passPercentInput').value);if(!Number.isFinite(p)||p<0||p>100){toast('Passing percentage must be 0–100.');return}e.passPercent=p;persist();closeModal();renderAll();toast('Grade and pass rules saved.');});
  }

  function toggleExamLock(){const e=currentExam();if(!e){toast('Select an exam first.');return}e.locked=!e.locked;persist();renderAll();toast(e.locked?'Exam locked. Marks are protected.':'Exam unlocked. Editing is enabled.')}

  function rankingRows(exam){
    if(!exam)return[];ensureExamStudents(exam);
    const rows=classData().students.map(st=>{const pct=percentageFor(exam,st.id);const mark=exam.subjects?.length?calculateOverallFromSubjects(exam,st.id):Number(exam.marks[st.id]);return{name:st.name,id:st.id,status:exam.statuses[st.id]||'pending',mark:Number.isFinite(mark)?mark:null,pct,grade:gradeForPercent(pct),result:pct==null?'—':(isPass(exam,pct)?'PASS':'FAIL')}}).filter(x=>x.status==='present'&&x.pct!=null).sort((a,b)=>b.pct-a.pct||b.mark-a.mark||a.name.localeCompare(b.name));let last=null,rank=0;return rows.map((x,i)=>{if(last===null||Math.abs(x.pct-last)>1e-9)rank=i+1;last=x.pct;return {...x,rank}});
  }

  function openEnhancedRankingModal(){
    const e=currentExam();if(!e){toast('Select an exam first.');return}const rows=rankingRows(e);
    openModal(`<div class="modal-head"><div><span class="eyebrow">CLASS RANKING</span><h3>Class ${escapeHTML(state.selectedClass)} · ${escapeHTML(e.name)}</h3><p class="profile-subtitle">Equal percentages share the same rank. Pending and absent are excluded.</p></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="profile-table-wrap"><table class="profile-table"><thead><tr><th>Rank</th><th>Student</th><th>Marks</th><th>%</th><th>Grade</th><th>GP</th><th>Result</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.rank}</td><td>${escapeHTML(x.name)}</td><td>${x.mark}</td><td>${x.pct.toFixed(1)}%</td><td>${x.grade}</td><td>${gradePointForPercent(x.pct)}</td><td>${x.result}</td></tr>`).join('')||'<tr><td colspan="7">No completed results yet.</td></tr>'}</tbody></table></div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Close</button></div>`);
  }

  function openSubjectTopperModal(){
    const e=currentExam();if(!e?.subjects?.length){toast('Add subjects to this exam first.');return}const blocks=e.subjects.map(sub=>{const rows=classData().students.map(st=>{const stt=e.statuses[st.id]||'pending',n=Number(e.subjectMarks?.[st.id]?.[sub.id]);return{st,n,pct:Number.isFinite(n)?n/sub.maxMarks*100:null,stt}}).filter(x=>x.stt==='present'&&x.pct!=null).sort((a,b)=>b.pct-a.pct);const top=rows[0],avg=rows.length?rows.reduce((a,x)=>a+x.pct,0)/rows.length:0;return `<div class="topper-block"><strong>${escapeHTML(sub.name)}</strong><span>${top?`${escapeHTML(top.st.name)} — ${top.n}/${sub.maxMarks} (${top.pct.toFixed(1)}%) · Class Avg ${avg.toFixed(1)}%`:'No completed marks'}</span></div>`}).join('');openModal(`<div class="modal-head"><div><span class="eyebrow">SUBJECT TOPPERS</span><h3>Subject Performance</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="topper-list">${blocks}</div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Close</button></div>`);
  }

  function openProgressModal(){
    const d=classData();if(!d.exams.length){toast('Create exams first.');return}
    const studentOptions=d.students.map(s=>`<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');
    openModal(`<div class="modal-head"><div><span class="eyebrow">PROGRESS REPORT</span><h3>Student Progress</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><label class="field"><span>Student</span><select id="progressStudent">${studentOptions}</select></label><div id="progressOutput" class="progress-output"></div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Close</button></div>`,card=>{const select=card.querySelector('#progressStudent'),out=card.querySelector('#progressOutput');const draw=()=>{const st=d.students.find(x=>x.id===select.value);const rows=d.exams.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(e=>{const p=st?percentageFor(e,st.id):null;return `<tr><td>${escapeHTML(e.name)}</td><td>${p==null?'—':p.toFixed(1)+'%'}</td><td>${gradeForPercent(p)}</td><td>${p==null?'—':(isPass(e,p)?'PASS':'FAIL')}</td></tr>`}).join('');const vals=d.exams.map(e=>percentageFor(e,st.id)).filter(x=>x!=null);const first=vals[0],last=vals[vals.length-1],delta=first!=null&&last!=null?last-first:null;out.innerHTML=`<div class="profile-stats"><div><small>EXAMS</small><strong>${vals.length}</strong></div><div><small>BEST</small><strong>${vals.length?Math.max(...vals).toFixed(1)+'%':'—'}</strong></div><div><small>CHANGE</small><strong>${delta==null?'—':(delta>=0?'+':'')+delta.toFixed(1)+'%'}</strong></div></div><div class="profile-table-wrap"><table class="profile-table"><thead><tr><th>Exam</th><th>%</th><th>Grade</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></div>`};select.onchange=draw;draw()});
  }

  function openCompareModal(){
    const exams=classData().exams;if(exams.length<2){toast('Create at least two exams to compare.');return}
    const opts=exams.map(e=>`<option value="${escapeHTML(e.id)}">${escapeHTML(e.name)} — ${formatDate(e.date)}</option>`).join('');
    openModal(`<div class="modal-head"><div><span class="eyebrow">EXAM COMPARISON</span><h3>Compare Two Exams</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><div class="compare-grid"><label class="field"><span>First Exam</span><select id="compareA">${opts}</select></label><label class="field"><span>Second Exam</span><select id="compareB">${opts}</select></label></div><div id="compareOutput" class="progress-output"></div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Close</button></div>`,card=>{const a=card.querySelector('#compareA'),b=card.querySelector('#compareB');if(exams[1])b.value=exams[1].id;const out=card.querySelector('#compareOutput');const draw=()=>{const ea=exams.find(e=>e.id===a.value),eb=exams.find(e=>e.id===b.value);const sa=stats(ea),sb=stats(eb);const pa=sa.present?sa.average/ea.totalMarks*100:null,pb=sb.present?sb.average/eb.totalMarks*100:null;out.innerHTML=`<div class="profile-stats"><div><small>${escapeHTML(ea.name)}</small><strong>${pa==null?'—':pa.toFixed(1)+'%'}</strong></div><div><small>${escapeHTML(eb.name)}</small><strong>${pb==null?'—':pb.toFixed(1)+'%'}</strong></div><div><small>CHANGE</small><strong>${pa!=null&&pb!=null?(pb-pa>=0?'+':'')+(pb-pa).toFixed(1)+'%':'—'}</strong></div></div>`};a.onchange=draw;b.onchange=draw;draw()});
  }

  function openStudentReportChooser(){
    const d=classData();if(!d.students.length){toast('Add students first.');return}const opts=d.students.map(s=>`<option value="${escapeHTML(s.id)}">${escapeHTML(s.name)}</option>`).join('');openModal(`<div class="modal-head"><div><span class="eyebrow">REPORT CARD</span><h3>Student Result Card</h3></div><button class="close-modal" type="button" data-modal-close>×</button></div><label class="field"><span>Student</span><select id="reportStudent">${opts}</select></label><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button id="printStudentCard" class="btn dark" type="button">Print Report Card</button></div>`,card=>card.querySelector('#printStudentCard').onclick=()=>{const id=card.querySelector('#reportStudent').value;closeModal();setTimeout(()=>printIndividualResultCard(id),60)});
  }

  function printIndividualResultCard(studentId){
    const d=classData(),st=d.students.find(x=>x.id===studentId);if(!st){toast('Student not found.');return}
    const exams=d.exams.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));const teacher=TEACHERS[0];const rows=exams.map((e,i)=>{const p=percentageFor(e,studentId);const mark=e.statuses[studentId]==='absent'?'ABSENT':(e.marks[studentId]??'');return `<tr><td>${i+1}</td><td>${escapeHTML(e.name)}</td><td>${formatDate(e.date)}</td><td>${escapeHTML(mark===''?'—':mark)}</td><td>${p==null?'—':p.toFixed(1)+'%'}</td><td>${gradeForPercent(p)}</td><td>${p==null?'—':isPass(e,p)?'PASS':'FAIL'}</td></tr>`}).join('');
    const vals=exams.map(e=>percentageFor(e,studentId)).filter(x=>x!=null),avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
    const win=window.open('','_blank','width=1000,height=800');if(!win){toast('Popup blocked. Please allow popups to print.');return}
    win.document.open();win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(st.name)} — Result Card</title><style>@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font-family:Arial;margin:0;color:#111}.report{border:1px solid #aeb7c0;padding:9mm;min-height:277mm}.header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #0e446e;padding-bottom:8px}.header img{width:54px;height:54px;object-fit:contain}.title{font-size:20px;font-weight:800}.sub{font-size:10px;color:#666}.heading{text-align:center;color:#0e446e;font-weight:800;letter-spacing:1px;margin:12px 0}.meta{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;border:1px solid #999}.meta div{padding:7px;border-right:1px solid #999}.meta div:last-child{border:0}.meta small{display:block;font-size:7px;color:#666}.meta strong{font-size:11px}.summary{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #999;margin:10px 0}.summary div{text-align:center;padding:7px;border-right:1px solid #999}.summary div:last-child{border:0}.summary small{display:block;font-size:7px;color:#666}.summary strong{font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:6px;font-size:9px}th{background:#eef3f7}.signature{display:flex;justify-content:flex-end;margin-top:18px}.sigbox{width:205px;border:1px solid #444;padding:9px;text-align:center}.signame{font-family:"Segoe Script","Brush Script MT",cursive;font-size:18px;font-style:italic}.sigline{border-top:1px solid #222;margin-top:4px}.siglabel{font-size:7px;color:#666;margin-top:3px}.watermark{text-align:center;color:#888;font-size:7px;margin-top:8px}.footer{border-top:1px solid #bbb;margin-top:12px;padding-top:7px;font-size:7px;color:#666;display:flex;justify-content:space-between}</style></head><body><div class="report"><div class="header"><img src="assets/image.svg.png"><div><div class="title">EZEE VISION CHAMPUA</div><div class="sub">STUDENT RESULT MANAGER PRO</div></div></div><div class="heading">STUDENT RESULT CARD</div><div class="meta"><div><small>STUDENT</small><strong>${escapeHTML(st.name)}</strong></div><div><small>CLASS</small><strong>Class ${state.selectedClass}</strong></div><div><small>EXAMS</small><strong>${exams.length}</strong></div><div><small>AVERAGE</small><strong>${vals.length?avg.toFixed(1)+'%':'—'}</strong></div></div><div class="summary"><div><small>BEST %</small><strong>${vals.length?Math.max(...vals).toFixed(1)+'%':'—'}</strong></div><div><small>PASS</small><strong>${exams.filter(e=>{const p=percentageFor(e,studentId);return p!=null&&isPass(e,p)}).length}</strong></div><div><small>FAIL</small><strong>${exams.filter(e=>{const p=percentageFor(e,studentId);return p!=null&&!isPass(e,p)}).length}</strong></div></div><table><thead><tr><th>#</th><th>Exam</th><th>Date</th><th>Marks</th><th>%</th><th>Grade</th><th>Result</th></tr></thead><tbody>${rows||'<tr><td colspan="7">No exam records</td></tr>'}</tbody></table><div class="signature"><div class="sigbox"><div class="signame">${escapeHTML(teacher)}</div><div class="sigline"></div><div class="siglabel">Teacher’s Signature</div></div></div><div class="watermark">This is Fully Auto-generated Print &amp; Made By Shahid Sir ❤️</div><div class="footer"><span>EZEE VISION CHAMPUA · Class ${state.selectedClass}</span><span>Generated ${formatDate(todayISO())}</span></div></div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);win.document.close();
  }

  function validatePrintReady(exam){
    const issues=[];if(!exam)issues.push('No exam selected.');else{ensureExamStudents(exam);if(!exam.name)issues.push('Exam name is missing.');if(!exam.date)issues.push('Exam date is missing.');if(!Number.isFinite(Number(exam.totalMarks))||Number(exam.totalMarks)<=0)issues.push('Total marks are invalid.');if(!classData().students.length)issues.push('No students are added.');const s=stats(exam);if(s.pending)issues.push(`${s.pending} student(s) still have pending marks.`);if(!TEACHERS.includes(exam.teacherSignature))issues.push('Teacher signature will be selected before printing.')}return issues;
  }

  function openPrintOptionsModal(){
    const e=currentExam();if(!e){toast('Create or select an exam first.');return}
    const issues=validatePrintReady(e),selected=TEACHERS.includes(e.teacherSignature)?e.teacherSignature:TEACHERS[0];
    openModal(`<div class="modal-head"><div><span class="eyebrow">PRINT PREVIEW & SIGNATURE</span><h3>Final Print Check</h3><p class="profile-subtitle">Select the teacher whose handwritten-style signature will appear in the report.</p></div><button class="close-modal" type="button" data-modal-close>×</button></div>${issues.length?`<div class="print-check warning"><strong>Before printing</strong><p>${issues.map(escapeHTML).join('<br>')}</p></div>`:'<div class="print-check good"><strong>Print check passed</strong><p>All required result information is available.</p></div>'}<form id="signatureForm" class="signature-form"><div class="signature-options">${TEACHERS.map((t,i)=>`<label class="signature-option"><input type="radio" name="teacherSignature" value="${escapeHTML(t)}" ${t===selected?'checked':''}><span><strong>${i+1}. ${escapeHTML(t)}</strong><small>Handwritten-style signature</small></span></label>`).join('')}</div><div class="modal-actions"><button class="btn outline" type="button" data-modal-close>Cancel</button><button class="btn dark" type="submit">Print Result</button></div></form>`,card=>{card.querySelector('#signatureForm').onsubmit=ev=>{ev.preventDefault();const chosen=card.querySelector('input[name="teacherSignature"]:checked')?.value||TEACHERS[0];e.teacherSignature=chosen;persist();closeModal();setTimeout(()=>printResult(e),60)}});
  }

  function printResult(exam){
    if(!exam){toast('Select an exam first.');return}ensureExamStudents(exam);const students=classData().students.slice(),teacher=TEACHERS.includes(exam.teacherSignature)?exam.teacherSignature:TEACHERS[0],s=stats(exam),ranked=rankingRows(exam),rankMap=new Map(ranked.map(x=>[x.id,x.rank]));
    const subjectMode=exam.subjects?.length;
    const head=subjectMode?`<tr><th>Sl.</th><th>Student Name</th>${exam.subjects.map(x=>`<th>${escapeHTML(x.name)}<br><small>/${escapeHTML(x.maxMarks)}</small></th>`).join('')}<th>Total</th><th>%</th><th>Grade</th><th>Rank</th></tr>`:'<tr><th>Sl.</th><th>Student Name</th><th>Marks</th><th>%</th><th>Grade</th><th>Rank</th></tr>';
    const rows=students.map((st,i)=>{const status=exam.statuses[st.id]||'pending',pct=percentageFor(exam,st.id),grade=gradeForPercent(pct),rank=rankMap.get(st.id)??'—';if(subjectMode){const cells=exam.subjects.map(sub=>{const v=exam.subjectMarks?.[st.id]?.[sub.id];return `<td>${status==='absent'?'ABSENT':v===''||v==null?'—':escapeHTML(v)}</td>`}).join('');return `<tr><td>${i+1}</td><td>${escapeHTML(st.name)}</td>${cells}<td>${status==='absent'?'ABSENT':calculateOverallFromSubjects(exam,st.id)===''?'—':calculateOverallFromSubjects(exam,st.id)}</td><td>${pct==null?'—':pct.toFixed(1)+'%'}</td><td>${status==='absent'?'ABSENT':grade}</td><td>${rank}</td></tr>`}const raw=exam.marks[st.id];return `<tr><td>${i+1}</td><td>${escapeHTML(st.name)}</td><td>${status==='absent'?'ABSENT':raw===''||raw==null?'—':escapeHTML(raw)}</td><td>${pct==null?'—':pct.toFixed(1)+'%'}</td><td>${status==='absent'?'ABSENT':grade}</td><td>${rank}</td></tr>`}).join('');
    const win=window.open('','_blank','width=1100,height=850');if(!win){toast('Popup blocked. Please allow popups to print.');return}
    win.document.open();win.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(exam.name)} — Class ${escapeHTML(state.selectedClass)}</title><style>@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}.report{border:1px solid #aeb7c0;padding:8mm;min-height:277mm}.header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #0e446e;padding-bottom:9px}.header img{width:54px;height:54px;object-fit:contain}.title{font-size:20px;font-weight:800}.sub{font-size:9px;color:#666}.heading{text-align:center;color:#0e446e;font-size:14px;font-weight:800;letter-spacing:1px;margin:10px 0}.meta{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;border:1px solid #999}.meta div{padding:7px;border-right:1px solid #999}.meta div:last-child{border-right:0}.meta small,.summary small{display:block;font-size:7px;color:#666;text-transform:uppercase}.meta strong{font-size:10px}.summary{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid #999;margin:9px 0}.summary div{padding:7px;text-align:center;border-right:1px solid #999}.summary div:last-child{border:0}.summary strong{font-size:11px}table{width:100%;border-collapse:collapse;table-layout:auto}th,td{border:1px solid #777;padding:5px 6px;font-size:8.5px;text-align:center}th{background:#eef3f7;font-weight:800}th:nth-child(2),td:nth-child(2){text-align:left;min-width:110px}.note{font-size:7px;color:#666;margin-top:6px}.signature{display:flex;justify-content:flex-end;margin-top:16px;page-break-inside:avoid}.sigbox{width:205px;border:1px solid #444;padding:8px 10px 6px;text-align:center;background:#fff}.signame{font-family:"Segoe Script","Brush Script MT","URW Chancery L",cursive;font-size:18px;font-style:italic;font-weight:600;line-height:1.05;margin:0 0 3px}.sigline{border-top:1px solid #222;width:100%;margin:0 0 3px}.siglabel{font-size:7px;color:#555}.watermark{text-align:center;font-size:7px;color:#888;margin-top:7px}.footer{display:flex;justify-content:space-between;border-top:1px solid #bbb;padding-top:7px;margin-top:10px;font-size:7px;color:#666}@media print{.report{min-height:277mm}} </style></head><body><div class="report"><div class="header"><img src="assets/image.svg.png" alt="EZEE VISION CHAMPUA"><div><div class="title">EZEE VISION CHAMPUA</div><div class="sub">STUDENT RESULT MANAGER PRO</div></div></div><div class="heading">EXAM RESULT SHEET</div><div class="meta"><div><small>Exam</small><strong>${escapeHTML(exam.name)}</strong></div><div><small>Class</small><strong>Class ${escapeHTML(state.selectedClass)}</strong></div><div><small>Date</small><strong>${escapeHTML(formatDate(exam.date))}</strong></div><div><small>Total Marks</small><strong>${escapeHTML(exam.totalMarks)}</strong></div></div><div class="summary"><div><small>Students</small><strong>${s.total}</strong></div><div><small>Present</small><strong>${s.present}</strong></div><div><small>Absent</small><strong>${s.absent}</strong></div><div><small>Pass</small><strong>${s.pass}</strong></div><div><small>Average</small><strong>${s.present?(s.average/exam.totalMarks*100).toFixed(1)+'%':'—'}</strong></div></div><table><thead>${head}</thead><tbody>${rows||'<tr><td colspan="8">No students</td></tr>'}</tbody></table><div class="note">ABSENT = Student was absent. Pending entries are shown as —. Grade scale: A+ 90+, A 80+, B+ 70+, B 60+, C+ 50+, C 40+, D 33+, F below pass rule.</div><div class="signature"><div class="sigbox"><div class="signame">${escapeHTML(teacher)}</div><div class="sigline"></div><div class="siglabel">Teacher’s Signature</div></div></div><div class="watermark">This is Fully Auto-generated Print &amp; Made By Shahid Sir ❤️</div><div class="footer"><span>EZEE VISION CHAMPUA · Class ${escapeHTML(state.selectedClass)}</span><span>Generated ${escapeHTML(formatDate(todayISO()))}</span></div></div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);win.document.close();
  }

  function exportCSV(){
    const e=currentExam();if(!e){toast('Select an exam first.');return}ensureExamStudents(e);const rows=[];if(e.subjects?.length){rows.push(['Roll No.','Student Name',...e.subjects.map(s=>`${s.name} / ${s.maxMarks}`),'Total Marks','Percentage','Grade','Result','Rank'])}else rows.push(['Roll No.','Student Name','Status','Marks','Total Marks','Percentage','Grade','Result','Rank']);const ranks=new Map(rankingRows(e).map(x=>[x.id,x.rank]));classData().students.forEach((st,i)=>{const status=e.statuses[st.id]||'pending',pct=percentageFor(e,st.id),grade=gradeForPercent(pct),result=pct==null?'':isPass(e,pct)?'PASS':'FAIL';if(e.subjects?.length)rows.push([i+1,st.name,...e.subjects.map(sub=>e.subjectMarks?.[st.id]?.[sub.id]??''),e.marks[st.id]??'',pct==null?'':pct.toFixed(1),grade,result,ranks.get(st.id)??'']);else rows.push([i+1,st.name,status,status==='absent'?'':e.marks[st.id]??'',e.totalMarks,pct==null?'':pct.toFixed(1),grade,result,ranks.get(st.id)??''])});const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8;'}),`${state.selectedClass}_${e.name.replace(/[^\w\-]+/g,'_')}.csv`);toast('CSV exported successfully.');
  }

  function openClassResultPrint(){const e=currentExam();if(!e){toast('Select an exam first.');return}openPrintOptionsModal()}



  async function toggleAbsent(id){
    const e=currentExam();
    if(!e)return;
    if(e.locked){toast('Exam is locked. Unlock it to change attendance.');return}
    ensureExamStudents(e);
    if(e.statuses[id]==='absent'){
      e.statuses[id]=e.marks[id]===''?'pending':'present';
      persist();renderAll();toast('Student returned to marks entry.');return;
    }
    const student=classData().students.find(x=>x.id===id);
    if(!await confirmAction('Mark student absent?',`${student?.name||'This student'} will print as ABSENT.`,'Mark Absent'))return;
    e.statuses[id]='absent';e.marks[id]='';
    if(e.subjectMarks?.[id])Object.keys(e.subjectMarks[id]).forEach(k=>e.subjectMarks[id][k]='');
    persist();renderAll();toast('Student marked absent.');
  }

  async function markAllPendingAbsent(){
    const e=currentExam();if(!e){toast('Select an exam first.');return}if(e.locked){toast('Exam is locked. Unlock it first.');return}
    ensureExamStudents(e);const pending=classData().students.filter(st=>(e.statuses[st.id]||'pending')==='pending');if(!pending.length){toast('No pending students.');return}
    if(!await confirmAction('Mark all pending as Absent?',`${pending.length} students will be marked ABSENT.`,'Mark Absent'))return;
    pending.forEach(st=>{e.statuses[st.id]='absent';e.marks[st.id]='';if(e.subjectMarks?.[st.id])Object.keys(e.subjectMarks[st.id]).forEach(k=>e.subjectMarks[st.id][k]='')});persist();renderAll();toast(`${pending.length} students marked absent.`);
  }

  function bindEvents() {
    $('subjectSetupBtn')?.addEventListener('click', openSubjectSetupModal);
    $('gradeRulesBtn')?.addEventListener('click', openGradeSettingsModal);
    $('lockExamBtn')?.addEventListener('click', toggleExamLock);
    $('studentReportBtn')?.addEventListener('click', openStudentReportChooser);
    $('progressBtn')?.addEventListener('click', openProgressModal);
    $('compareBtn')?.addEventListener('click', openCompareModal);
    $('subjectTopperBtn')?.addEventListener('click', openSubjectTopperModal);
    $('classResultBtn')?.addEventListener('click', openClassResultPrint);
    $('printPreviewBtn')?.addEventListener('click', openPrintOptionsModal);
    $('dataHealthBtn')?.addEventListener('click', openDataHealthModal);
    $('transferBtn')?.addEventListener('click', shareBackup);



    $('dashboardOverview')?.addEventListener('click', event => { const b=event.target.closest('[data-dashboard-class]'); if(b) selectClass(b.dataset.dashboardClass); });

    $('classGrid').addEventListener(
      'click',
      event => {
        const button =
          event.target.closest(
            '[data-class]'
          );

        if (!button) return;

        selectClass(
          button.dataset.class
        );
      }
    );


    $('classSelect').addEventListener(
      'change',
      event => {
        selectClass(
          event.target.value
        );
      }
    );


    $('examSelect').addEventListener(
      'change',
      event => {
        state.selectedExamId =
          event.target.value || null;

        renderAll();
      }
    );


    $('searchInput').addEventListener(
      'input',
      event => {
        state.search =
          event.target.value;

        renderTable();
      }
    );


    $('resultBody').addEventListener(
      'click',
      async event => {

        const profile =
          event.target.closest(
            '[data-profile-id]'
          );

        if (profile) {
          openStudentProfileModal(
            profile.dataset.profileId
          );

          return;
        }


        const edit =
          event.target.closest(
            '.edit-student'
          );

        if (edit) {
          openStudentModal(
            edit.dataset.id
          );

          return;
        }


        const del =
          event.target.closest(
            '.delete-student'
          );

        if (del) {
          await deleteStudent(
            del.dataset.id
          );

          return;
        }


        const absent =
          event.target.closest(
            '[data-status-id]'
          );

        if (absent) {
          await toggleAbsent(
            absent.dataset.statusId
          );
        }
      }
    );


    $('resultBody').addEventListener('change', event => {
      const subjectInput = event.target.closest('[data-subject-mark-id]');
      if (subjectInput) {
        saveSubjectMark(subjectInput.dataset.subjectMarkId, subjectInput.dataset.subjectId, subjectInput.value, subjectInput);
        return;
      }
      const input = event.target.closest('[data-mark-id]');
      if (input) saveMark(input.dataset.markId, input.value, input);
    });


    $('resultBody').addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      const subjectInput = event.target.closest('[data-subject-mark-id]');
      if (subjectInput) {
        event.preventDefault();
        saveSubjectMark(subjectInput.dataset.subjectMarkId, subjectInput.dataset.subjectId, subjectInput.value, subjectInput);
        const inputs=[...document.querySelectorAll('[data-subject-mark-id]:not(:disabled)')];
        const i=inputs.indexOf(subjectInput);
        if(i>=0&&inputs[i+1]){inputs[i+1].focus();inputs[i+1].select();}
        return;
      }
      const input = event.target.closest('[data-mark-id]');
      if (!input) return;
      event.preventDefault();
      input.blur();
    });


    $('addStudentBtn').onclick =
      () =>
        openStudentModal();

    $('emptyAddBtn').onclick =
      () =>
        openStudentModal();

    $('newExamBtn').onclick =
      () =>
        openNewExamModal();


    $('saveExamBtn').onclick =
      () =>
        saveCurrentExam();


    $('markPendingAbsentBtn').onclick =
      () =>
        markAllPendingAbsent();


    $('printBtn').onclick =
      () =>
        openPrintOptionsModal();


    $('exportCsvBtn').onclick =
      () =>
        exportCSV();


    $('backupBtn').onclick =
      () =>
        exportBackup('manual');

    $('restoreBtn').onclick =
      () =>
        $('restoreFile').click();

    $('classInsightsBtn').onclick =
      () =>
        openResultIntelligenceModal();

    $('toolsBtn').onclick =
      () =>
        openToolsModal();


    $('examHistory').addEventListener(
      'click',
      event => {

        const firstExam = event.target.closest('#historyNewExam');
        if (firstExam) {
          openNewExamModal();
          return;
        }

        const open =
          event.target.closest(
            '[data-open-exam]'
          );

        if (open) {
          state.selectedExamId =
            open.dataset.openExam;

          renderAll();

          return;
        }


        const edit =
          event.target.closest(
            '[data-edit-exam]'
          );

        if (edit) {
          openEditExamModal(
            edit.dataset.editExam
          );

          return;
        }


        const duplicate =
          event.target.closest(
            '[data-duplicate-exam]'
          );

        if (duplicate) {
          duplicateExam(
            duplicate.dataset
              .duplicateExam
          );

          return;
        }


        const del =
          event.target.closest(
            '[data-delete-exam]'
          );

        if (del) {
          deleteExam(
            del.dataset.deleteExam
          );
        }
      }
    );


    $('restoreFile').addEventListener(
      'change',
      event => {
        restoreBackup(
          event.target.files?.[0]
        );
      }
    );


    $('modalRoot').addEventListener(
      'click',
      event => {
        if (
          event.target ===
          $('modalRoot')
        ) {
          closeModal();
        }
      }
    );


    document.addEventListener(
      'keydown',
      event => {
        if (
          event.key === 'Escape' &&
          !$('modalRoot').classList.contains(
            'hidden'
          )
        ) {
          closeModal();
        }
      }
    );

  }
    function init() {
    bindEvents();

    renderAll();

    window.addEventListener(
      'beforeinstallprompt',
      event => {
        event.preventDefault();

        state.deferredPrompt = event;

        $('installBtn')
          ?.classList.remove('hidden');
      }
    );

    $('installBtn')
      ?.addEventListener(
        'click',
        installApp
      );

    window.addEventListener(
      'appinstalled',
      () => {
        state.deferredPrompt = null;

        $('installBtn')
          ?.classList.add('hidden');

        toast(
          'App installed successfully.'
        );
      }
    );

    if (
      'serviceWorker' in navigator
    ) {
      window.addEventListener(
        'load',
        () => {
          navigator.serviceWorker
            .register('./sw.js')
            .then(registration => {
              registration.update().catch(() => {});
            })
            .catch(error => {
              console.warn(
                'Service worker registration failed:',
                error
              );
            });
        }
      );
    }
  }


  init();

})();
        
  
