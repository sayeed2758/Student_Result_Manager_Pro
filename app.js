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
        /[&<>"]/g,
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

  function renderAll() {
    renderClassGrid();
    renderExamSelect();
    renderExamInfo();
    renderAnalytics();
    renderTable();
    renderHistory();
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
    const valid =
      Number.isFinite(value) &&
      value >= 0 &&
      value <= e.totalMarks;

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
                    </label>

          <label class="field">
            <span>Date</span>

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
        const form =
          card.querySelector(
            '#newExamForm'
          );

        form.onsubmit = e => {
          e.preventDefault();

          const ok = createExam(
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

  function openEditExamModal(
    id
  ) {
    const exam =
      classData().exams.find(
        e => e.id === id
      );

    if (!exam) return;

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
          id="editExamForm"
          class="modal-form"
        >
          <label class="field">
            <span>Exam Name</span>

            <input
              id="editExamName"
              required
              maxlength="80"
              value="${escapeHTML(
                exam.name
              )}"
            >
          </label>

          <label class="field">
            <span>Total Marks</span>

            <input
              id="editExamMarks"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              value="${exam.totalMarks}"
              required
            >
          </label>

          <label class="field">
            <span>Date</span>

            <input
              id="editExamDate"
              type="date"
              value="${escapeHTML(
                exam.date
              )}"
              required
            >
          </label>

          <label class="field">
            <span>
              Teacher Signature
            </span>

            <select
              id="editExamTeacher"
            >
              <option value="">
                Select Teacher
              </option>

              ${TEACHERS.map(
                teacher =>
                  `<option
                    value="${escapeHTML(
                      teacher
                    )}"
                    ${
                      exam.teacherSignature ===
                      teacher
                        ? 'selected'
                        : ''
                    }
                  >
                    ${escapeHTML(
                      teacher
                    )}
                  </option>`
              ).join('')}
            </select>
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
        const form =
          card.querySelector(
            '#editExamForm'
          );

        form.onsubmit = e => {
          e.preventDefault();

          const ok = updateExam(
            exam,

            card.querySelector(
              '#editExamName'
            ).value,

            card.querySelector(
              '#editExamMarks'
            ).value,

            card.querySelector(
              '#editExamDate'
            ).value
          );

          const teacher =
            card.querySelector(
              '#editExamTeacher'
            ).value;

          if (ok) {
            exam.teacherSignature =
              TEACHERS.includes(
                teacher
              )
                ? teacher
                : '';

            persist();
            renderAll();
            closeModal();

            toast(
              'Exam updated.'
            );
          }
        };

        setTimeout(
          () =>
            card.querySelector(
              '#editExamName'
            ).focus(),
          30
        );
      }
    );
  }

  function openBulkStudentModal() {
    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              STUDENT MANAGEMENT
            </span>

            <h3>
              Add Multiple Students
            </h3>

            <p class="profile-subtitle">
              Enter one student name per line.
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
          id="bulkStudentForm"
          class="modal-form"
        >
          <label class="field">
            <span>
              Student Names
            </span>

            <textarea
              id="bulkStudentNames"
              rows="9"
              maxlength="3000"
              placeholder="Rahul Kumar
Aman Singh
Priya Das"
              required
            ></textarea>
          </label>

          <div class="bulk-help">
            Duplicate names will be skipped.
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
              class="btn primary"
              type="submit"
            >
              Add Students
            </button>
          </div>
        </form>
      `,
      card => {
        const form =
          card.querySelector(
            '#bulkStudentForm'
          );

        form.onsubmit = e => {
          e.preventDefault();

          const raw =
            card.querySelector(
              '#bulkStudentNames'
            ).value;

          const names =
            raw
              .split(/\r?\n/)
              .map(
                name =>
                  name
                    .trim()
                    .replace(/\s+/g, ' ')
              )
              .filter(Boolean);

          if (!names.length) {
            toast(
              'Enter at least one student name.'
            );
            return;
          }

          let added = 0;
          let skipped = 0;

          const d = classData();

          names.forEach(name => {
            const exists =
              d.students.some(
                s =>
                  s.name.toLowerCase() ===
                  name.toLowerCase()
              );

            if (exists) {
              skipped++;
              return;
            }

            const student = {
              id: uid('student'),
              name
            };

            d.students.push(student);

            d.exams.forEach(exam => {
              exam.marks[
                student.id
              ] = '';

              exam.statuses[
                student.id
              ] = 'pending';
            });

            added++;
          });

          if (added) {
            persist();
            renderAll();
          }

          closeModal();

          toast(
            `${added} student${
              added === 1 ? '' : 's'
            } added${
              skipped
                ? ` · ${skipped} skipped`
                : ''
            }.`
          );
        };

        setTimeout(
          () =>
            card.querySelector(
              '#bulkStudentNames'
            ).focus(),
          30
        );
      }
    );
  }

  function openImportModal() {
    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              DATA IMPORT
            </span>

            <h3>
              Import Students
            </h3>

            <p class="profile-subtitle">
              Paste CSV or one-name-per-line data.
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
          id="importForm"
          class="modal-form"
        >
          <label class="field">
            <span>
              Student Data
            </span>

            <textarea
              id="importData"
              rows="10"
              placeholder="Name
Rahul Kumar
Aman Singh
Priya Das"
              required
            ></textarea>
          </label>

          <div class="bulk-help">
            First column is treated as the student name.
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
              class="btn primary"
              type="submit"
            >
              Import
            </button>
          </div>
        </form>
      `,
      card => {
        const form =
          card.querySelector(
            '#importForm'
          );

        form.onsubmit = e => {
          e.preventDefault();

          const raw =
            card.querySelector(
              '#importData'
            ).value;

          const lines =
            raw
              .split(/\r?\n/)
              .map(
                line => line.trim()
              )
              .filter(Boolean);

          if (!lines.length) {
            toast(
              'No student data found.'
            );
            return;
          }

          let added = 0;
          let skipped = 0;

          const d = classData();

          lines.forEach(
            (line, index) => {
              const columns =
                line.split(',');

              let name =
                columns[0]
                  ?.trim()
                  .replace(/^["']|["']$/g, '');

              if (
                index === 0 &&
                name?.toLowerCase() ===
                  'name'
              ) {
                return;
              }

              if (!name) {
                skipped++;
                return;
              }

              const exists =
                d.students.some(
                  s =>
                    s.name.toLowerCase() ===
                    name.toLowerCase()
                );

              if (exists) {
                skipped++;
                return;
              }

              const student = {
                id: uid('student'),
                name
              };

              d.students.push(student);

              d.exams.forEach(
                exam => {
                  exam.marks[
                    student.id
                  ] = '';

                  exam.statuses[
                    student.id
                  ] = 'pending';
                }
              );

              added++;
            }
          );

          if (added) {
            persist();
            renderAll();
          }

          closeModal();

          toast(
            `${added} student${
              added === 1 ? '' : 's'
            } imported${
              skipped
                ? ` · ${skipped} skipped`
                : ''
            }.`
          );
        };

        setTimeout(
          () =>
            card.querySelector(
              '#importData'
            ).focus(),
          30
        );
      }
    );
  }
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

    const students =
      classData().students.slice();

    const teacher =
      TEACHERS.includes(
        exam.teacherSignature
      )
        ? exam.teacherSignature
        : TEACHERS[0];

    const s = stats(exam);

    const rows =
      students
        .map(
          (student, index) => {
            const status =
              exam.statuses[
                student.id
              ] || 'pending';

            const raw =
              exam.marks[
                student.id
              ];

            const absent =
              status === 'absent';

            const hasMark =
              !absent &&
              raw !== '' &&
              Number.isFinite(
                Number(raw)
              );

            const mark =
              hasMark
                ? Number(raw)
                : null;

            const percentage =
              hasMark
                ? (
                    (mark /
                      exam.totalMarks) *
                    100
                  ).toFixed(1) + '%'
                : absent
                  ? 'ABSENT'
                  : '—';

            return `
              <tr>
                <td>
                  ${index + 1}
                </td>

                <td>
                  ${escapeHTML(
                    student.name
                  )}
                </td>

                <td
                  class="${
                    absent
                      ? 'print-absent'
                      : ''
                  }"
                >
                  ${
                    absent
                      ? 'ABSENT'
                      : hasMark
                        ? escapeHTML(
                            mark
                          )
                        : '—'
                  }
                </td>

                <td
                  class="${
                    absent
                      ? 'print-absent'
                      : ''
                  }"
                >
                  ${percentage}
                </td>
              </tr>
            `;
          }
        )
        .join('');

    const win =
      window.open(
        '',
        '_blank',
        'width=1000,height=800'
      );

    if (!win) {
      toast(
        'Popup blocked. Please allow popups to print.'
      );
      return;
    }

    win.document.open();

    win.document.write(`
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>
<title>
  ${escapeHTML(exam.name)}
  —
  Class ${escapeHTML(
    state.selectedClass
  )}
</title>

<style>
  *{
    box-sizing:border-box
  }

  html,body{
    margin:0;
    padding:0;
    background:#fff;
    color:#111
  }

  body{
    font-family:
      Arial,
      Helvetica,
      sans-serif;
    padding:18px
  }

  .report{
    max-width:960px;
    margin:0 auto
  }

  .header{
    text-align:center;
    border-bottom:
      2px solid #0e446e;
    padding-bottom:10px;
    margin-bottom:12px
  }

  .header img{
    width:58px;
    height:58px;
    object-fit:contain;
    display:block;
    margin:0 auto 5px
  }

  .header h1{
    margin:0;
    font-size:22px;
    letter-spacing:.2px
  }

  .header h2{
    margin:4px 0 0;
    font-size:14px;
    font-weight:600;
    color:#333
  }

  .heading{
    margin:8px 0 11px;
    text-align:center;
    font-size:14px;
    font-weight:800;
    letter-spacing:1px;
    color:#0e446e
  }

  .meta{
    display:grid;
    grid-template-columns:
      1fr 1fr 1fr;
    border:1px solid #999;
    margin-bottom:10px
  }

  .meta>div{
    padding:7px 8px;
    border-right:1px solid #999;
    font-size:10px
  }

  .meta>div:last-child{
    border-right:0
  }

  .meta small{
    display:block;
    font-size:7px;
    color:#666;
    text-transform:uppercase;
    margin-bottom:3px
  }

  .meta strong{
    font-size:10px
  }

  .summary{
    display:grid;
    grid-template-columns:
      repeat(4,1fr);
    border:1px solid #999;
    margin-bottom:11px
  }

  .summary-box{
    padding:7px;
    text-align:center;
    border-right:1px solid #999
  }

  .summary-box:last-child{
    border-right:0
  }

  .summary-box small{
    display:block;
    font-size:7px;
    color:#666;
    text-transform:uppercase;
    margin-bottom:3px
  }

  .summary-box strong{
    font-size:13px
  }

  .completion{
    text-align:right;
    font-size:7.5px;
    color:#666;
    margin:-3px 0 7px
  }

  table{
    width:100%;
    border-collapse:collapse;
    table-layout:fixed
  }

  th,td{
    border:1px solid #777;
    padding:6px 7px;
    font-size:9.5px;
    vertical-align:middle
  }

  th{
    background:#eef3f7;
    font-weight:800
  }

  th:first-child,
  td:first-child{
    width:45px;
    text-align:center
  }

  th:nth-child(2),
  td:nth-child(2){
    width:auto
  }

  th:nth-child(3),
  td:nth-child(3){
    width:75px;
    text-align:center
  }

  th:nth-child(4),
  td:nth-child(4){
    width:85px;
    text-align:center
  }

  .print-absent{
    font-weight:800
  }

  .note{
    font-size:7.5px;
    color:#666;
    margin-top:7px
  }

  .signature-area{
    display:flex;
    justify-content:flex-end;
    margin-top:16px;
    page-break-inside:avoid
  }

  .signature-box{
    width:205px;
    border:1px solid #444;
    padding:9px 12px 7px;
    text-align:center;
    background:#fff
  }

  .signature-name{
    font-family:
      "Segoe Script",
      "Brush Script MT",
      "URW Chancery L",
      cursive;
    font-size:18px;
    font-style:italic;
    font-weight:600;
    line-height:1.05;
    margin:0 0 3px;
    color:#111
  }

  .signature-line{
    border-top:1px solid #222;
    width:100%;
    margin:0 0 3px
  }

  .signature-label{
    font-size:7.5px;
    color:#555;
    margin:0
  }

  .footer{
    display:flex;
    justify-content:space-between;
    border-top:1px solid #bbb;
    padding-top:7px;
    margin-top:12px;
    font-size:7.5px;
    color:#666
  }

  @media(max-width:600px){
    body{
      padding:8px
    }

    .meta{
      grid-template-columns:1fr
    }

    .meta>div{
      border-right:0;
      border-bottom:1px solid #999
    }

    .meta>div:last-child{
      border-bottom:0
    }

    .summary{
      grid-template-columns:
        repeat(2,1fr)
    }

    .summary-box:nth-child(2){
      border-right:0
    }

    .summary-box:nth-child(-n+2){
      border-bottom:1px solid #999
    }

    .signature-area{
      margin-top:12px
    }

    .signature-box{
      width:190px
    }
  }

  @media print{
    body{
      padding:0
    }

    .report{
      max-width:none
    }

    @page{
      size:A4 portrait;
      margin:10mm
    }
  }
</style>
</head>

<body>

<div class="report">

  <div class="header">
    <img
      src="assets/logo.png"
      alt="EZEE VISION CHAMPUA"
    >

    <h1>
      EZEE VISION CHAMPUA
    </h1>

    <h2>
      STUDENT RESULT MANAGER PRO
    </h2>
  </div>

  <div class="heading">
    EXAM RESULT SHEET
  </div>

  <div class="meta">
    <div>
      <small>Exam</small>
      <strong>
        ${escapeHTML(exam.name)}
      </strong>
    </div>

    <div>
      <small>Class</small>
      <strong>
        Class ${escapeHTML(
          state.selectedClass
        )}
      </strong>
    </div>

    <div>
      <small>Date of Exam</small>
      <strong>
        ${escapeHTML(
          formatDate(exam.date)
        )}
      </strong>
    </div>
  </div>

  <div class="summary">
    <div class="summary-box">
      <small>Students</small>
      <strong>${s.total}</strong>
    </div>

    <div class="summary-box">
      <small>Present</small>
      <strong>${s.present}</strong>
    </div>

    <div class="summary-box">
      <small>Absent</small>
      <strong>${s.absent}</strong>
    </div>

    <div class="summary-box">
      <small>Total Marks</small>
      <strong>
        ${exam.totalMarks}
      </strong>
    </div>
  </div>

  <div class="completion">
    Result Entry Completion:
    <b>
      ${
        s.total
          ? Math.round(
              (
                (s.present +
                  s.absent) /
                s.total
              ) * 100
            )
          : 0
      }%
    </b>
  </div>

  <table>
    <thead>
      <tr>
        <th>Sl. No.</th>
        <th>Name of the Students</th>
        <th>Marks</th>
        <th>Percentage</th>
      </tr>
    </thead>

    <tbody>
      ${
        rows ||
        '<tr><td colspan="4">No students</td></tr>'
      }
    </tbody>
  </table>

  <div class="note">
    ABSENT = Student was absent in this examination.
    Pending entries are left blank.
  </div>

  <div class="signature-area">
    <div class="signature-box">

      <div class="signature-name">
        ${escapeHTML(teacher)}
      </div>

      <div class="signature-line"></div>

      <div class="signature-label">
        Teacher’s Signature
      </div>

    </div>
  </div>

  <div class="footer">
    <span>
      EZEE VISION CHAMPUA ·
      Class ${escapeHTML(
        state.selectedClass
      )}
    </span>

    <span>
      Generated
      ${escapeHTML(
        formatDate(todayISO())
      )}
    </span>
  </div>

</div>

<script>
  window.addEventListener(
    'load',
    () =>
      setTimeout(
        () => window.print(),
        250
      )
  );
<\/script>

</body>
</html>
`);

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
          e.statuses[
            student.id
          ] || 'pending';

        const raw =
          e.marks[
            student.id
          ];

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
        `ezee-result-backup-${
          new Date()
            .toISOString()
            .slice(0, 10)
        }.json`;

      document.body.appendChild(a);

      a.click();

      a.remove();

      URL.revokeObjectURL(url);

      toast(
        source === 'auto'
          ? 'Safety backup created.'
          : 'Backup downloaded successfully.'
      );
    } catch (err) {
      console.error(
        'Backup export failed:',
        err
      );

      toast(
        'Could not create backup.'
      );
    }
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
        .replace(
          /[^\w\-]+/g,
          '_'
        )}.csv`;

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

      toast(
        source === 'auto'
          ? 'Safety backup created.'
          : 'Backup downloaded successfully.'
      );
    } catch (err) {
      console.error(
        'Backup export failed:',
        err
      );

      toast(
        'Could not create backup.'
      );
    }
  }

  async function shareBackup() {
    try {
      const backup = {
        app:
          'EZEE VISION CHAMPUA',

        version: 1,

        exportedAt:
          new Date().toISOString(),

        data: state.db
      };

      const file =
        new File(
          [
            JSON.stringify(
              backup,
              null,
              2
            )
          ],
          'ezee-result-backup.json',
          {
            type:
              'application/json'
          }
        );

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [file]
        })
      ) {
        await navigator.share({
          title:
            'EZEE VISION CHAMPUA Backup',

          text:
            'Result Manager data backup.',

          files: [file]
        });

        toast(
          'Backup shared successfully.'
        );

        return;
      }

      exportBackup('manual');

      toast(
        'Sharing is not supported here. Backup downloaded instead.'
      );
    } catch (err) {
      if (
        err?.name ===
        'AbortError'
      ) {
        return;
      }

      console.error(
        'Backup sharing failed:',
        err
      );

      toast(
        'Could not share backup.'
      );
    }
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

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.data ||
        typeof parsed.data !== 'object'
      ) {
        throw new Error(
          'Invalid backup structure.'
        );
      }

      const cleaned =
        normalizeDB(
          parsed.data
        );

      const classes =
        Object.values(
          cleaned.classes || {}
        );

      const studentCount =
        classes.reduce(
          (sum, cls) =>
            sum +
            (
              Array.isArray(
                cls.students
              )
                ? cls.students.length
                : 0
            ),
          0
        );

      const examCount =
        classes.reduce(
          (sum, cls) =>
            sum +
            (
              Array.isArray(
                cls.exams
              )
                ? cls.exams.length
                : 0
            ),
          0
        );

      const ok =
        await confirmAction(
          'Restore backup?',
          `This backup contains ${studentCount} students and ${examCount} exams. Your current data will be replaced. A safety backup will be downloaded first.`,
          'Restore',
          true
        );

      if (!ok) return;

      exportBackup('auto');

      state.db = cleaned;

      state.selectedClass =
        CLASSES.includes(
          state.selectedClass
        )
          ? state.selectedClass
          : CLASSES[0];

      state.selectedExamId =
        classData().exams[0]?.id ||
        null;

      state.search = '';

      persist();
      renderAll();

      toast(
        'Backup restored successfully.'
      );
    } catch (err) {
      console.error(
        'Restore failed:',
        err
      );

      toast(
        'Invalid or unreadable backup file.'
      );
    }
  }

  function openDataHealthModal() {
    const health =
      getDataHealth();

    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              DATA HEALTH
            </span>

            <h3>
              Storage & Integrity
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

        <div class="health-grid">
          <div class="health-card">
            <small>CLASSES</small>
            <strong>
              ${health.classes}
            </strong>
          </div>

          <div class="health-card">
            <small>STUDENTS</small>
            <strong>
              ${health.students}
            </strong>
          </div>

          <div class="health-card">
            <small>EXAMS</small>
            <strong>
              ${health.exams}
            </strong>
          </div>

          <div class="health-card">
            <small>MARKS</small>
            <strong>
              ${health.marks}
            </strong>
          </div>

          <div class="health-card">
            <small>STORAGE</small>
            <strong>
              ${health.storage}
            </strong>
          </div>

          <div class="health-card">
            <small>STATUS</small>
            <strong>
              ${health.valid ? 'Healthy' : 'Needs Review'}
            </strong>
          </div>
        </div>

        <div class="health-note">
          ${
            health.valid
              ? 'Your local result data structure is valid.'
              : 'Some records need attention. Consider creating a backup before making changes.'
          }
        </div>
      `
    );
  }

  function getDataHealth() {
    let students = 0;
    let exams = 0;
    let marks = 0;
    let valid = true;

    Object.values(
      state.db.classes || {}
    ).forEach(cls => {
      if (
        !Array.isArray(
          cls.students
        ) ||
        !Array.isArray(
          cls.exams
        )
      ) {
        valid = false;
        return;
      }

      students +=
        cls.students.length;

      exams +=
        cls.exams.length;

      cls.exams.forEach(
        exam => {
          if (
            !exam ||
            !exam.id ||
            !exam.name
          ) {
            valid = false;
            return;
          }

          ensureExamStudents(exam);

          Object.values(
            exam.marks || {}
          ).forEach(value => {
            if (
              value !== '' &&
              Number.isFinite(
                Number(value)
              )
            ) {
              marks++;
            }
          });
        }
      );
    });

    let storage = '0 KB';

    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        ) || '';

      const kb =
        new Blob([raw]).size /
        1024;

      storage =
        kb < 1024
          ? `${kb.toFixed(1)} KB`
          : `${(
              kb / 1024
            ).toFixed(2)} MB`;
    } catch (_) {}

    return {
      classes:
        Object.keys(
          state.db.classes || {}
        ).length,

      students,

      exams,

      marks,

      storage,

      valid
    };
  }
  function openResultIntelligenceModal() {
    const e = currentExam();

    if (!e) {
      toast(
        'Create or select an exam first.'
      );
      return;
    }

    const s = stats(e);

    const topStudents =
      classData().students
        .map(student => {
          const status =
            e.statuses[
              student.id
            ] || 'pending';

          const raw =
            e.marks[
              student.id
            ];

          if (
            status !== 'present' ||
            raw === ''
          ) {
            return null;
          }

          const pct =
            e.totalMarks
              ? (
                  Number(raw) /
                  e.totalMarks
                ) * 100
              : 0;

          return {
            name:
              student.name,
            marks:
              Number(raw),
            pct
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            b.pct - a.pct
        )
        .slice(0, 5);

    openModal(
      `
        <div class="modal-head">
          <div>
            <span class="eyebrow">
              RESULT INTELLIGENCE
            </span>

            <h3>
              ${escapeHTML(e.name)}
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
          <div>
            <small>AVERAGE</small>
            <strong>
              ${s.average}%
            </strong>
          </div>

          <div>
            <small>HIGHEST</small>
            <strong>
              ${s.highest}%
            </strong>
          </div>

          <div>
            <small>LOWEST</small>
            <strong>
              ${s.lowest}%
            </strong>
          </div>

          <div>
            <small>PRESENT</small>
            <strong>
              ${s.present}
            </strong>
          </div>
        </div>

        <div class="insight-section">
          <h4>
            Top Performers
          </h4>

          ${
            topStudents.length
              ? `
                <ol class="top-students">
                  ${topStudents
                    .map(
                      student =>
                        `
                          <li>
                            <span>
                              ${escapeHTML(
                                student.name
                              )}
                            </span>

                            <b>
                              ${student.marks}
                              /
                              ${e.totalMarks}
                              ·
                              ${student.pct.toFixed(1)}%
                            </b>
                          </li>
                        `
                    )
                    .join('')}
                </ol>
              `
              : `
                <div class="empty">
                  No completed marks yet.
                </div>
              `
          }
        </div>
      `
    );
  }

  function installApp() {
    if (
      state.deferredInstallPrompt
    ) {
      state.deferredInstallPrompt
        .prompt();

      state.deferredInstallPrompt
        .userChoice
        .then(choice => {
          if (
            choice.outcome ===
            'accepted'
          ) {
            toast(
              'App installation started.'
            );
          }

          state.deferredInstallPrompt =
            null;
        });

      return;
    }

    toast(
      'Install prompt is not available. Use your browser menu and choose “Install app” or “Add to Home screen”.'
    );
  }

  function bindEvents() {
    $('classTabs')
      ?.addEventListener(
        'click',
        e => {
          const button =
            e.target.closest(
              '[data-class]'
            );

          if (!button) return;

          selectClass(
            button.dataset.class
          );
        }
      );

    $('searchInput')
      ?.addEventListener(
        'input',
        e => {
          state.search =
            e.target.value || '';

          renderTable();
        }
      );

    $('addStudentBtn')
      ?.addEventListener(
        'click',
        () =>
          openStudentModal()
      );

    $('bulkStudentBtn')
      ?.addEventListener(
        'click',
        () =>
          openBulkStudentModal()
      );

    $('importBtn')
      ?.addEventListener(
        'click',
        () =>
          openImportModal()
      );

    $('newExamBtn')
      ?.addEventListener(
        'click',
        () =>
          openNewExamModal()
      );

    $('toolsBtn')
      ?.addEventListener(
        'click',
        () =>
          openToolsModal()
      );

    $('printBtn')
      ?.addEventListener(
        'click',
        () =>
          openPrintOptionsModal()
      );

    $('exportBtn')
      ?.addEventListener(
        'click',
        exportCSV
      );

    $('saveBtn')
      ?.addEventListener(
        'click',
        saveCurrentExam
      );

    $('markAllAbsentBtn')
      ?.addEventListener(
        'click',
        markAllPendingAbsent
      );

    $('restoreFile')
      ?.addEventListener(
        'change',
        e => {
          const file =
            e.target.files?.[0];

          if (file) {
            restoreBackup(file);
          }

          e.target.value = '';
        }
      );

    $('modalRoot')
      ?.addEventListener(
        'click',
        e => {
          if (
            e.target ===
            $('modalRoot')
          ) {
            closeModal();
          }
        }
      );

    document.addEventListener(
      'keydown',
      e => {
        if (
          e.key === 'Escape' &&
          !$('modalRoot').classList.contains(
            'hidden'
          )
        ) {
          closeModal();
        }
      }
    );

    window.addEventListener(
      'beforeunload',
      () => {
        try {
          persist();
        } catch (_) {}
      }
    );

    window.addEventListener(
      'beforeinstallprompt',
      e => {
        e.preventDefault();

        state.deferredInstallPrompt =
          e;
      }
    );

    window.addEventListener(
      'appinstalled',
      () => {
        state.deferredInstallPrompt =
          null;

        toast(
          'App installed successfully.'
        );
      }
    );
  }

  function init() {
    try {
      loadDB();

      normalizeState();

      bindEvents();

      renderAll();

      registerServiceWorker();

      updateClock();

      setInterval(
        updateClock,
        1000
      );

      console.log(
        'EZEE Result Manager initialized.'
      );
    } catch (err) {
      console.error(
        'Application initialization failed:',
        err
      );

      toast(
        'Application could not initialize.'
      );
    }
  }

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }

})();
