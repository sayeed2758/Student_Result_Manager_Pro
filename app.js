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
                    step="1"
                    inputmode="numeric"
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
          !Number.isInteger(n) ||
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
      Number.isInteger(value) &&
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

    const rows =
      students
        .map((student, index) => {
          const status =
            exam.statuses[student.id] ||
            'pending';

          const raw =
            exam.marks[student.id];

          const absent =
            status === 'absent';

          const marks =
            absent || raw === ''
              ? ''
              : Number(raw);

          const percentage =
            !absent &&
            raw !== '' &&
            Number.isFinite(Number(raw))
              ? (
                  (Number(raw) /
                    exam.totalMarks) *
                  100
                ).toFixed(1) + '%'
              : absent
                ? 'ABSENT'
                : '—';

          return `
            <tr>
              <td>${index + 1}</td>

              <td>
                ${escapeHTML(student.name)}
              </td>

              <td class="${
                absent
                  ? 'print-absent'
                  : ''
              }">
                ${
                  absent
                    ? 'ABSENT'
                    : marks === ''
                      ? '—'
                      : marks
                }
              </td>

              <td>
                ${percentage}
              </td>
            </tr>
          `;
        })
        .join('');

    const s = stats(exam);

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

    win.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">

        <title>
          ${escapeHTML(exam.name)}
          - Class ${state.selectedClass}
        </title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 24px;
            font-family:
              Arial,
              Helvetica,
              sans-serif;
            color: #111;
            background: #fff;
          }

          .report {
            max-width: 1000px;
            margin: 0 auto;
          }

          .header {
            text-align: center;
            border-bottom: 2px solid #111;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }

          .header h1 {
            margin: 0 0 6px;
            font-size: 25px;
          }

          .header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }

          .meta {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin: 12px 0 20px;
            font-size: 13px;
          }

          .summary {
            display: grid;
            grid-template-columns:
              repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }

          .summary-box {
            border: 1px solid #bbb;
            padding: 10px;
            text-align: center;
          }

          .summary-box small {
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            margin-bottom: 4px;
          }

          .summary-box strong {
            font-size: 18px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th,
          td {
            border: 1px solid #999;
            padding: 8px 9px;
            font-size: 12px;
          }

          th {
            background: #eee;
            font-weight: 700;
          }

          .print-absent {
            font-weight: 700;
          }

          .signature-area {
            margin-top: 55px;
            display: flex;
            justify-content: flex-end;
          }

          .signature {
            width: 230px;
            text-align: center;
          }

          .signature-line {
            border-top: 1px solid #111;
            margin-top: 45px;
            padding-top: 7px;
            font-weight: 700;
          }

          .signature small {
            display: block;
            margin-top: 4px;
          }

          .footer {
            margin-top: 25px;
            text-align: center;
            font-size: 10px;
            color: #555;
          }

          @media print {
            body {
              padding: 0;
            }

            .report {
              max-width: none;
            }

            @page {
              size: A4 portrait;
              margin: 12mm;
            }
          }
        </style>
      </head>

      <body>
        <div class="report">

          <div class="header">
            <h1>
              EZEE VISION CHAMPUA
            </h1>

            <h2>
              ${escapeHTML(exam.name)}
            </h2>
          </div>

          <div class="meta">
            <div>
              <strong>
                Class:
              </strong>
              ${escapeHTML(
                state.selectedClass
              )}
            </div>

            <div>
              <strong>
                Date:
              </strong>
              ${formatDate(exam.date)}
            </div>

            <div>
              <strong>
                Total Marks:
              </strong>
              ${exam.totalMarks}
            </div>
          </div>

          <div class="summary">

            <div class="summary-box">
              <small>
                Students
              </small>

              <strong>
                ${s.total}
              </strong>
            </div>

            <div class="summary-box">
              <small>
                Present
              </small>

              <strong>
                ${s.present}
              </strong>
            </div>

            <div class="summary-box">
              <small>
                Absent
              </small>

              <strong>
                ${s.absent}
              </strong>
            </div>

            <div class="summary-box">
              <small>
                Average
              </small>

              <strong>
                ${
                  s.present
                    ? s.average.toFixed(1)
                    : '—'
                }
              </strong>
            </div>

          </div>

          <table>
            <thead>
              <tr>
                <th>
                  #
                </th>

                <th>
                  Student Name
                </th>

                <th>
                  Marks
                </th>

                <th>
                  Percentage
                </th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>
          </table>

          <div class="signature-box">
  <strong>${escapeHTML(teacher||'Teacher')}</strong>
  <div class="signature-line"></div>
  <small>Teacher’s Signature</small>
          </div>
          </div>

          <div class="footer">
            Generated from
            EZEE VISION CHAMPUA
          </div>

        </div>

        <script>
          window.onload = function () {
            setTimeout(
              function () {
                window.print();
              },
              250
            );
          };
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
              !Number.isInteger(
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
    if (
      !state.deferredPrompt
    ) {
      toast(
        'Install prompt is not available yet.'
      );

      return;
    }

    state.deferredPrompt.prompt();

    try {
      await state.deferredPrompt.userChoice;
    } catch (_) {}

    state.deferredPrompt = null;
  }

  function bindEvents() {

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


    $('resultBody').addEventListener(
      'change',
      event => {
        const input =
          event.target.closest(
            '[data-mark-id]'
          );

        if (!input) return;

        saveMark(
          input.dataset.markId,
          input.value,
          input
        );
      }
    );


    $('resultBody').addEventListener(
      'keydown',
      event => {
        if (
          event.key !== 'Enter'
        ) {
          return;
        }

        const input =
          event.target.closest(
            '[data-mark-id]'
          );

        if (!input) return;

        event.preventDefault();

        input.blur();
      }
    );


    $('addStudentBtn').onclick =
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


    $('toolsBtn').onclick =
      () =>
        openToolsModal();


    $('historyNewExam')
      ?.addEventListener(
        'click',
        openNewExamModal
      );


    $('examHistory').addEventListener(
      'click',
      event => {

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
        
  
