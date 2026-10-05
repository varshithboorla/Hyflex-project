/* =====================================================
   SUPABASE CONFIGURATION
   (moved to supabase-config.js, loaded before this file)
===================================================== */


/* =====================================================
   GLOBAL STATE
===================================================== */

let currentUser = null;
let currentRole = null;

let students = [];
let branches = [];
let semesters = [];
let academicYears = [];
let regulations = [];
let batches = [];
let admins = [];

// Admin video-progress data (current semester/enrollment) + permanent history viewer
let videoProgressRecords = [];
let videoProgressStudents = [];
let videoProgressVideos = [];
let videoProgressCourses = [];
let videoProgressAssignments = [];
let videoProgressBranches = [];
let videoProgressBatches = [];
let videoProgressAcademicYears = [];
let videoProgressSemesters = [];
let videoDurationCache = new Map();
let selectedVideoProgressVideoId = null;
let selectedVideoStudentRows = [];
let videoProgressLoaded = false;
let videoProgressHistoryRows = [];



/* =====================================================
   INITIALIZATION
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {

    setupEvents();

    await loadBranches();
    await loadSemesters();
    await loadAcademicYears();
    await loadRegulations();
    await loadBatches();

    restoreSession();

});


/* =====================================================
   EVENT LISTENERS
===================================================== */

function setupEvents() {

    setupStudentSelection();

    /* ---------------- LOGIN ---------------- */

    const loginBtn =
        document.getElementById("loginBtn");

    if (loginBtn) {
        loginBtn.addEventListener(
            "click",
            login
        );
    }


    const loginPassword =
        document.getElementById("loginPassword");

    if (loginPassword) {

        loginPassword.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {
                    login();
                }

            }
        );

    }


    /* ---------------- LOGOUT ---------------- */

    const adminLogout =
        document.getElementById("adminLogout");

    if (adminLogout) {
        adminLogout.addEventListener(
            "click",
            logout
        );
    }


    const studentLogout =
        document.getElementById("studentLogout");

    if (studentLogout) {
        studentLogout.addEventListener(
            "click",
            logout
        );
    }


    /* ---------------- STUDENT MODAL ---------------- */

    const addStudentBtn =
        document.getElementById("addStudentBtn");

    if (addStudentBtn) {

        addStudentBtn.addEventListener(
            "click",
            openAddStudentModal
        );

    }


    const closeModal =
        document.getElementById("closeModal");

    if (closeModal) {

        closeModal.addEventListener(
            "click",
            closeStudentModal
        );

    }


    const cancelModal =
        document.getElementById("cancelModal");

    if (cancelModal) {

        cancelModal.addEventListener(
            "click",
            closeStudentModal
        );

    }


    const saveStudentBtn =
        document.getElementById("saveStudentBtn");

    if (saveStudentBtn) {

        saveStudentBtn.addEventListener(
            "click",
            saveStudent
        );

    }


    /* ---------------- STUDENT FILTERS ---------------- */

    const filterRoll =
        document.getElementById("filterRoll");

    if (filterRoll) {

        filterRoll.addEventListener(
            "input",
            filterStudents
        );

    }


    const filterName =
        document.getElementById("filterName");

    if (filterName) {

        filterName.addEventListener(
            "input",
            filterStudents
        );

    }


    const filterEmail =
        document.getElementById("filterEmail");

    if (filterEmail) {

        filterEmail.addEventListener(
            "input",
            filterStudents
        );

    }


    const filterBranch =
        document.getElementById("filterBranch");

    if (filterBranch) {

        filterBranch.addEventListener(
            "change",
            filterStudents
        );

    }


    const filterSemester =
        document.getElementById("filterSemester");

    if (filterSemester) {

        filterSemester.addEventListener(
            "change",
            filterStudents
        );

    }


    const filterBatch =
        document.getElementById("filterBatch");

    if (filterBatch) {

        filterBatch.addEventListener(
            "change",
            filterStudents
        );

    }


    // Picking a semester pre-selects the matching batch (if none chosen yet)
    const studentSemesterInput =
        document.getElementById("studentSemesterInput");

    if (studentSemesterInput) {

        studentSemesterInput.addEventListener(
            "change",
            () => {

                const batchSelect =
                    document.getElementById(
                        "studentBatchInput"
                    );

                if (
                    batchSelect &&
                    !batchSelect.value
                ) {

                    const batchId =
                        deriveBatchIdForSemester(
                            studentSemesterInput.value
                        );

                    if (batchId) {
                        batchSelect.value = batchId;
                    }

                }

            }
        );

    }


    const clearFilters =
        document.getElementById(
            "clearStudentFilters"
        );

    if (clearFilters) {

        clearFilters.addEventListener(
            "click",
            clearStudentFilters
        );

    }


    /* ---------------- EXCEL ---------------- */

    const uploadExcelBtn =
        document.getElementById(
            "uploadExcelBtn"
        );

    if (uploadExcelBtn) {

        uploadExcelBtn.addEventListener(
            "click",
            () => {

                document
                    .getElementById("excelFileInput")
                    .click();

            }
        );

    }


    const excelFileInput =
        document.getElementById(
            "excelFileInput"
        );

    if (excelFileInput) {

        excelFileInput.addEventListener(
            "change",
            handleExcelUpload
        );

    }


    const downloadTemplateBtn =
        document.getElementById(
            "downloadTemplateBtn"
        );

    if (downloadTemplateBtn) {

        downloadTemplateBtn.addEventListener(
            "click",
            downloadExcelTemplate
        );

    }

    /* ---------------- VIDEO PROGRESS ---------------- */

    const refreshVideoProgressBtn = document.getElementById("refreshVideoProgressBtn");
    if (refreshVideoProgressBtn) refreshVideoProgressBtn.addEventListener("click", loadVideoProgress);

    const openVideoProgressHistoryBtn = document.getElementById("openVideoProgressHistoryBtn");
    if (openVideoProgressHistoryBtn) openVideoProgressHistoryBtn.addEventListener("click", openVideoProgressHistory);

    const closeVideoProgressHistoryBtn = document.getElementById("closeVideoProgressHistoryBtn");
    if (closeVideoProgressHistoryBtn) closeVideoProgressHistoryBtn.addEventListener("click", closeVideoProgressHistory);
    document.querySelectorAll("[data-close-video-progress-history]").forEach(el => el.addEventListener("click", closeVideoProgressHistory));

    const videoHistoryYear = document.getElementById("videoHistoryYear");
    const videoHistorySemester = document.getElementById("videoHistorySemester");
    const videoHistoryStudent = document.getElementById("videoHistoryStudent");
    if (videoHistoryYear) videoHistoryYear.addEventListener("change", renderVideoProgressHistory);
    if (videoHistorySemester) videoHistorySemester.addEventListener("change", renderVideoProgressHistory);
    if (videoHistoryStudent) videoHistoryStudent.addEventListener("input", renderVideoProgressHistory);

    const progressVideoSearch = document.getElementById("progressVideoSearch");
    if (progressVideoSearch) progressVideoSearch.addEventListener("input", filterVideoProgress);

    const progressCourseFilter = document.getElementById("progressCourseFilter");
    if (progressCourseFilter) progressCourseFilter.addEventListener("change", filterVideoProgress);

    const clearVideoProgressFilters = document.getElementById("clearVideoProgressFilters");
    if (clearVideoProgressFilters) clearVideoProgressFilters.addEventListener("click", clearVideoProgressFiltersHandler);

    const closeVideoStudentProgressBtn = document.getElementById("closeVideoStudentProgressBtn");
    if (closeVideoStudentProgressBtn) closeVideoStudentProgressBtn.addEventListener("click", closeVideoStudentProgress);
    document.querySelectorAll("[data-close-video-students]").forEach(el => el.addEventListener("click", closeVideoStudentProgress));

    [
        ["videoStudentSearch", "input"],
        ["videoStudentBranchFilter", "change"],
        ["videoStudentBatchFilter", "change"],
        ["videoStudentAcademicYearFilter", "change"],
        ["videoStudentSemesterFilter", "change"],
        ["videoStudentStatusFilter", "change"]
    ].forEach(([id, eventName]) => {
        const element = document.getElementById(id);
        if (element) element.addEventListener(eventName, filterVideoStudentProgress);
    });

    const clearVideoStudentFilters = document.getElementById("clearVideoStudentFilters");
    if (clearVideoStudentFilters) clearVideoStudentFilters.addEventListener("click", clearVideoStudentFiltersHandler);

    const exportVideoStudentsCsvBtn = document.getElementById("exportVideoStudentsCsvBtn");
    if (exportVideoStudentsCsvBtn) exportVideoStudentsCsvBtn.addEventListener("click", exportVideoStudentsCsv);
    const exportVideoStudentsExcelBtn = document.getElementById("exportVideoStudentsExcelBtn");
    if (exportVideoStudentsExcelBtn) exportVideoStudentsExcelBtn.addEventListener("click", exportVideoStudentsExcel);
    const printVideoStudentsBtn = document.getElementById("printVideoStudentsBtn");
    if (printVideoStudentsBtn) printVideoStudentsBtn.addEventListener("click", printVideoStudents);


    /* ---------------- NAVIGATION ---------------- */

    document
        .querySelectorAll(".nav-btn[data-section]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    switchAdminSection(
                        button.dataset.section
                    );

                }
            );

        });


    /* ---------------- MOVE STUDENTS ---------------- */

    const moveStudentsBtn =
        document.getElementById(
            "moveStudentsBtn"
        );

    if (moveStudentsBtn) {

        moveStudentsBtn.addEventListener(
            "click",
            openMoveStudentsModal
        );

    }


    const closeMoveStudentsModalBtn =
        document.getElementById(
            "closeMoveStudentsModal"
        );

    if (closeMoveStudentsModalBtn) {

        closeMoveStudentsModalBtn.addEventListener(
            "click",
            closeMoveStudentsModal
        );

    }


    const cancelMoveStudents =
        document.getElementById(
            "cancelMoveStudents"
        );

    if (cancelMoveStudents) {

        cancelMoveStudents.addEventListener(
            "click",
            closeMoveStudentsModal
        );

    }


    const confirmMoveStudents =
        document.getElementById(
            "confirmMoveStudents"
        );

    if (confirmMoveStudents) {

        confirmMoveStudents.addEventListener(
            "click",
            moveStudents
        );

    }


    const moveFromSemester =
        document.getElementById(
            "moveFromSemester"
        );

    if (moveFromSemester) {

        moveFromSemester.addEventListener(
            "change",
            updateMoveStudentCount
        );

    }


    const moveBatchSelect = document.getElementById("moveBatch");

    if (moveBatchSelect) {
        moveBatchSelect.addEventListener("change", updateMoveStudentCount);
    }

    const moveBranch =
        document.getElementById(
            "moveBranch"
        );

    if (moveBranch) {

        moveBranch.addEventListener(
            "change",
            updateMoveStudentCount
        );

    }


    const moveToSemester =
        document.getElementById(
            "moveToSemester"
        );

    if (moveToSemester) {

        moveToSemester.addEventListener(
            "change",
            validateMoveTarget
        );

    }


    /* ---------------- ADMIN MANAGEMENT ---------------- */

    const addAdminBtn =
        document.getElementById(
            "addAdminBtn"
        );

    if (addAdminBtn) {

        addAdminBtn.addEventListener(
            "click",
            openAddAdminModal
        );

    }


    const closeAdminModalBtn =
        document.getElementById(
            "closeAdminModal"
        );

    if (closeAdminModalBtn) {

        closeAdminModalBtn.addEventListener(
            "click",
            closeAdminModal
        );

    }


    const cancelAdminModal =
        document.getElementById(
            "cancelAdminModal"
        );

    if (cancelAdminModal) {

        cancelAdminModal.addEventListener(
            "click",
            closeAdminModal
        );

    }


    const saveAdminBtn =
        document.getElementById(
            "saveAdminBtn"
        );

    if (saveAdminBtn) {

        saveAdminBtn.addEventListener(
            "click",
            saveAdmin
        );

    }


    const refreshAdminsBtn =
        document.getElementById(
            "refreshAdminsBtn"
        );

    if (refreshAdminsBtn) {

        refreshAdminsBtn.addEventListener(
            "click",
            loadAdmins
        );

    }


    const adminSearch =
        document.getElementById(
            "adminSearch"
        );

    if (adminSearch) {

        adminSearch.addEventListener(
            "input",
            filterAdmins
        );

    }

}


/* =====================================================
   LOGIN
===================================================== */

async function login() {

    const identifier =
        document
            .getElementById("loginIdentifier")
            .value
            .trim();

    const password =
        document
            .getElementById("loginPassword")
            .value;

    clearLoginMessage();

    if (!identifier || !password) {

        showLoginMessage(
            "Please enter your email/roll number and password.",
            "error"
        );

        return;
    }


    const loginButton =
        document.getElementById("loginBtn");

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";


    try {

        /* =================================================
           TRY ADMIN LOGIN
        ================================================= */

        const adminResult =
            await window.supabaseClient
                .from("admins")
                .select(`
                    id,
                    email,
                    created_at
                `)
                .eq("email", identifier)
                .eq("password_hash", password)
                .maybeSingle();


        if (adminResult.error) {
            throw adminResult.error;
        }


        if (adminResult.data) {

            adminPasswordCache = password;

            currentUser =
                adminResult.data;

            currentRole =
                "admin";

            saveSession();

            await showAdminPage();

            return;
        }


        /* =================================================
           TRY STUDENT LOGIN
        ================================================= */

        const studentResult =
            await window.supabaseClient
                .from("students")
                .select(`
                    id,
                    roll_number,
                    email,
                    first_name,
                    last_name,
                    batch_id,
                    branch_id,
                    semester_id,
                    created_at
                `)
                .eq("roll_number", identifier)
                .eq("password_hash", password)
                .maybeSingle();


        if (studentResult.error) {
            throw studentResult.error;
        }


        if (studentResult.data) {

            currentUser =
                studentResult.data;

            currentRole =
                "student";

            // semester is stored directly on students; enrollment supplies the academic year/history context.
            await attachCurrentEnrollment(currentUser);

            saveSession();

            showStudentPage();

            return;
        }


        showLoginMessage(
            "Invalid email/roll number or password.",
            "error"
        );


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        showLoginMessage(
            error.message ||
            "Login failed.",
            "error"
        );

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Login";

    }

}


/* =====================================================
   SESSION
===================================================== */

function saveSession() {

    localStorage.setItem(
        "edulearn_user",
        JSON.stringify(currentUser)
    );

    localStorage.setItem(
        "edulearn_role",
        currentRole
    );

}


function restoreSession() {

    const savedUser =
        localStorage.getItem(
            "edulearn_user"
        );

    const savedRole =
        localStorage.getItem(
            "edulearn_role"
        );


    if (!savedUser || !savedRole) {
        return;
    }


    try {

        currentUser =
            JSON.parse(savedUser);

        currentRole =
            savedRole;


        if (currentRole === "admin") {

            showAdminPage();

        } else if (currentRole === "student") {

            showStudentPage();

        } else {

            logout();

        }

    } catch (error) {

        console.error(
            "Session restore error:",
            error
        );

        logout();

    }

}


/* =====================================================
   LOGIN MESSAGES
===================================================== */

function showLoginMessage(
    text,
    type
) {

    const element =
        document.getElementById(
            "loginMessage"
        );

    element.textContent = text;
    element.className =
        `message ${type}`;

}


function clearLoginMessage() {

    const element =
        document.getElementById(
            "loginMessage"
        );

    element.textContent = "";
    element.className = "message";

}


/* =====================================================
   ADMIN PAGE
===================================================== */

async function showAdminPage() {

    document
        .getElementById("loginPage")
        .classList.add("hidden");

    document
        .getElementById("studentPage")
        .classList.add("hidden");

    document
        .getElementById("adminPage")
        .classList.remove("hidden");


    document
        .getElementById("adminEmail")
        .textContent =
        currentUser.email;


    await loadDashboardCounts();

    await loadStudents();

    await loadAdmins();

    switchAdminSection(
        "adminDashboard"
    );

}


/* =====================================================
   STUDENT PAGE
===================================================== */

function showStudentPage() {
    // Students now use the dedicated student portal. Keep the same localStorage
    // session used by the login page so no second authentication system is needed.
    window.location.href = "student.html";
}

/* =====================================================
   ADMIN NAVIGATION
===================================================== */

function switchAdminSection(section) {

    const dashboard =
        document.getElementById(
            "adminDashboard"
        );

    const studentsSection =
        document.getElementById(
            "studentsSection"
        );

    const adminsSection =
        document.getElementById(
            "adminsSection"
        );

    const videoProgressSection =
        document.getElementById(
            "videoProgressSection"
        );


    dashboard.classList.add("hidden");
    studentsSection.classList.add("hidden");
    adminsSection.classList.add("hidden");
    if (videoProgressSection) videoProgressSection.classList.add("hidden");


    document
        .querySelectorAll(".nav-btn")
        .forEach(button => {

            button.classList.remove("active");

        });


    const activeButton =
        document.querySelector(
            `[data-section="${section}"]`
        );


    if (activeButton) {
        activeButton.classList.add("active");
    }


    if (section === "adminDashboard") {

        dashboard.classList.remove("hidden");

        document
            .getElementById("adminPageTitle")
            .textContent =
            "Dashboard";

        loadDashboardCounts();

    }


    if (section === "studentsSection") {

        studentsSection.classList.remove(
            "hidden"
        );

        document
            .getElementById("adminPageTitle")
            .textContent =
            "Students";

        loadStudents();

    }

    if (section === "videoProgressSection") {

        if (!videoProgressSection) return;

        videoProgressSection.classList.remove("hidden");

        document
            .getElementById("adminPageTitle")
            .textContent =
            "Video Progress";

        loadVideoProgress();

    }


    if (section === "adminsSection") {

        adminsSection.classList.remove(
            "hidden"
        );

        document
            .getElementById("adminPageTitle")
            .textContent =
            "Admins";

        loadAdmins();

    }

}


/* =====================================================
   DASHBOARD COUNTS
===================================================== */

async function loadDashboardCounts() {

    try {

        const studentsResult =
            await window.supabaseClient
                .from("students")
                .select("id", {
                    count: "exact",
                    head: true
                });


        const branchesResult =
            await window.supabaseClient
                .from("branches")
                .select("id", {
                    count: "exact",
                    head: true
                });


        const semestersResult =
            await window.supabaseClient
                .from("semesters")
                .select("id", {
                    count: "exact",
                    head: true
                });


        const totalStudents =
            document.getElementById(
                "totalStudents"
            );

        const totalBranches =
            document.getElementById(
                "totalBranches"
            );

        const totalSemesters =
            document.getElementById(
                "totalSemesters"
            );


        if (totalStudents) {

            totalStudents.textContent =
                studentsResult.count || 0;

        }


        if (totalBranches) {

            totalBranches.textContent =
                branchesResult.count || 0;

        }


        if (totalSemesters) {

            totalSemesters.textContent =
                semestersResult.count || 0;

        }

    } catch (error) {

        console.error(
            "Dashboard count error:",
            error
        );

    }

}


/* =====================================================
   LOAD ACADEMIC YEARS / REGULATIONS / BATCHES
===================================================== */

async function loadAcademicYears() {

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("academic_years")
            .select("id, label, start_date, end_date, is_current")
            .order("start_date", { ascending: false });


    if (error) {

        console.error(
            "Academic year error:",
            error
        );

        return;
    }


    academicYears =
        data || [];

    populateStudentAcademicYearSelect();

}


async function loadRegulations() {

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("regulations")
            .select("id, code, name")
            .order("code");


    if (error) {

        console.error(
            "Regulation error:",
            error
        );

        return;
    }


    regulations =
        data || [];

}


async function loadBatches() {

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("batches")
            .select("id, label, admission_year, graduation_year, regulation_id")
            .order("admission_year", { ascending: false });


    if (error) {

        console.error(
            "Batch error:",
            error
        );

        return;
    }


    batches =
        data || [];


    populateBatchSelects();

}


function populateBatchSelects() {

    const formSelect =
        document.getElementById(
            "studentBatchInput"
        );

    if (formSelect) {

        formSelect.innerHTML = `
            <option value="">
                Select Batch
            </option>
        `;

        batches.forEach(batch => {

            const option =
                document.createElement("option");

            option.value =
                batch.id;

            option.textContent =
                batch.label;

            formSelect.appendChild(option);

        });

    }


    const filterSelect =
        document.getElementById(
            "filterBatch"
        );

    if (filterSelect) {

        filterSelect.innerHTML = `
            <option value="">
                All Batches
            </option>
        `;

        batches.forEach(batch => {

            const option =
                document.createElement("option");

            option.value =
                batch.id;

            option.textContent =
                batch.label;

            filterSelect.appendChild(option);

        });

    }

}


function populateMoveAcademicYearSelect() {

    const select = document.getElementById("moveAcademicYear");
    if (!select) return;

    const current = getCurrentAcademicYear();
    const sortedYears = [...academicYears].sort((a, b) => {
        const aDate = new Date(a.start_date || 0).getTime();
        const bDate = new Date(b.start_date || 0).getTime();
        return bDate - aDate || Number(b.id) - Number(a.id);
    });

    select.innerHTML = sortedYears.length
        ? sortedYears.map(year =>
            `<option value="${year.id}">${escapeHTML(year.label)}${year.is_current ? " (current)" : ""}</option>`
        ).join("")
        : `<option value="">No academic years available</option>`;

    // Default to the currently active academic year, but allow the admin
    // to deliberately choose another year for a semester movement.
    select.value = current ? String(current.id) : (sortedYears[0] ? String(sortedYears[0].id) : "");
    select.disabled = false;

}


function populateStudentAcademicYearSelect() {

    const select = document.getElementById("studentAcademicYearInput");
    if (!select) return;

    const current = getCurrentAcademicYear();

    select.innerHTML = current
        ? `<option value="${current.id}">${current.label} (current)</option>`
        : `<option value="">No current academic year</option>`;

    select.value = current ? current.id : "";
    select.disabled = true;

}


function getCurrentAcademicYear() {

    return academicYears.find(
        year => year.is_current
    ) || null;

}


/*
  Works out the batch a student most likely belongs to from the
  semester they are in during the current academic year.
  e.g. Semester 3 in 2026-27 -> admitted 2025 -> batch 2025-2029.
*/
function deriveBatchIdForSemester(semesterId) {

    const year =
        getCurrentAcademicYear();

    const semester =
        semesters.find(
            item =>
                item.id === Number(semesterId)
        );

    if (!year || !semester) {
        return null;
    }

    const admissionYear =
        new Date(year.start_date).getFullYear() -
        Math.floor(
            (semester.semester_number - 1) / 2
        );

    const batch =
        batches.find(
            item =>
                item.admission_year === admissionYear
        );

    return batch ? batch.id : null;

}


/* =====================================================
   STUDENT ENROLLMENTS
   (the semester a student is in lives in student_enrollments)
===================================================== */

async function fetchCurrentEnrollment(studentId) {

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("student_enrollments")
            .select("id, academic_year_id, semester_id")
            .eq("student_id", studentId)
            .eq("is_current", true)
            .maybeSingle();


    if (error) {
        throw error;
    }

    return data;

}


async function attachCurrentEnrollment(student) {

    try {

        const enrollment =
            await fetchCurrentEnrollment(
                student.id
            );

        // The student's current semester is the semester_id stored
        // directly on the students row. The current enrollment remains
        // the source for academic-year/enrollment history.
        if (student.semester_id == null && enrollment) {
            student.semester_id = enrollment.semester_id;
        }

        student.academic_year_id =
            enrollment
                ? enrollment.academic_year_id
                : null;

        student.enrollment_id =
            enrollment
                ? enrollment.id
                : null;

    } catch (error) {

        console.error(
            "Enrollment error:",
            error
        );

    }

    return student;

}


/*
  Inserts one student and their first (current) enrollment.
  Returns null on success, or the error.
*/
async function insertStudentWithEnrollment(student) {

    const year =
        getCurrentAcademicYear();

    if (!year) {

        return new Error(
            "No current academic year is set. " +
            "Open Academic Setup and mark one as current."
        );

    }


    const {
        academic_year_id: _ignoredAcademicYearId,
        ...studentRow
    } = student;


    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("students")
            .insert(studentRow)
            .select("id")
            .single();


    if (error) {
        return error;
    }


    const {
        error: enrollmentError
    } =
        await window.supabaseClient
            .from("student_enrollments")
            .insert({
                student_id: data.id,
                // Always use the academic year currently marked is_current.
                academic_year_id: year.id,
                semester_id: Number(student.semester_id),
                is_current: true,
                status: "active"
            });


    if (enrollmentError) {

        // do not leave a student without an enrollment
        await window.supabaseClient
            .from("students")
            .delete()
            .eq("id", data.id);

        return enrollmentError;

    }

    return null;

}


/* =====================================================
   STUDENT PORTAL: ACADEMIC INFO + MY COURSES
===================================================== */

async function loadStudentAcademicInfo() {

    const coursesBox =
        document.getElementById(
            "studentCoursesList"
        );

    try {

        // sessions saved before the batch update do not have batch_id
        if (!currentUser.batch_id) {

            const {
                data: batchRow
            } =
                await window.supabaseClient
                    .from("students")
                    .select("batch_id")
                    .eq("id", currentUser.id)
                    .maybeSingle();

            if (batchRow) {
                currentUser.batch_id = batchRow.batch_id;
            }

        }


        await attachCurrentEnrollment(
            currentUser
        );

        saveSession();


        const semester =
            semesters.find(
                item =>
                    item.id ===
                    currentUser.semester_id
            );

        const batch =
            batches.find(
                item =>
                    item.id ===
                    currentUser.batch_id
            );

        const regulation =
            batch
                ? regulations.find(
                    item =>
                        item.id ===
                        batch.regulation_id
                )
                : null;

        const year =
            academicYears.find(
                item =>
                    item.id ===
                    currentUser.academic_year_id
            );


        document.getElementById("studentSemester").textContent =
            semester ? semester.name : "-";

        document.getElementById("studentBatch").textContent =
            batch ? batch.label : "-";

        document.getElementById("studentRegulation").textContent =
            regulation ? regulation.code : "-";

        document.getElementById("studentAcademicYear").textContent =
            year ? year.label : "-";


        /*
          What the student sees comes from the academic relationships:
          batch -> regulation, branch, enrollment -> year + semester.
          The v_student_courses view does exactly that join.
        */

        const {
            data,
            error
        } =
            await window.supabaseClient
                .from("v_student_courses")
                .select("offering_id, course_name, course_code, semester_type, semester_name, batch_label, academic_year_label")
                .eq("student_id", currentUser.id)
                .order("course_name");


        if (error) {
            throw error;
        }


        const termText =
            data && data.length > 0
                ? `${data[0].academic_year_label} · ${data[0].semester_type === "odd" ? "Odd" : "Even"} term · ${data[0].semester_name} · Batch ${data[0].batch_label}`
                : `${year ? year.label : "-"} · ${semester ? semester.name : "-"} · Batch ${batch ? batch.label : "-"}`;

        if (!data || data.length === 0) {

            coursesBox.innerHTML = `
                <p style="margin: 0 0 6px; color: var(--ink-soft); font-size: 13px;">
                    ${escapeHTML(termText)}
                </p>
                <p style="margin: 0;">
                    No courses have been published for your branch in this
                    semester yet.
                </p>`;

            return;
        }

        coursesBox.innerHTML = `
            <p style="margin: 0 0 8px; color: var(--ink-soft); font-size: 13px;">
                Courses you are learning now — ${escapeHTML(termText)}
            </p>
            ${data.map(course => `
                <div style="padding: 10px 0; border-bottom: 1px solid var(--line);">
                    <strong>${escapeHTML(course.course_name)}</strong>
                    ${
                        course.course_code
                            ? `<small style="margin-left: 8px;">${escapeHTML(course.course_code)}</small>`
                            : ""
                    }
                </div>
            `).join("")}
        `;

    } catch (error) {

        console.error(
            "Student academic info error:",
            error
        );

        if (coursesBox) {

            coursesBox.textContent =
                "Could not load your courses.";

        }

    }

}


/* =====================================================
   LOAD BRANCHES
===================================================== */

async function loadBranches() {

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("branches")
            .select("*")
            .order("name");


    if (error) {

        console.error(
            "Branch error:",
            error
        );

        return;
    }


    branches =
        data || [];


    populateBranchFilter();


    const select =
        document.getElementById(
            "studentBranchInput"
        );


    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select Branch
        </option>
    `;


    branches.forEach(branch => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            branch.id;

        option.textContent =
            `${branch.name} (${branch.code})`;

        select.appendChild(option);

    });

}


/* =====================================================
   LOAD SEMESTERS
===================================================== */

async function loadSemesters() {

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("semesters")
            .select("*")
            .order("semester_number");


    if (error) {

        console.error(
            "Semester error:",
            error
        );

        return;
    }


    semesters =
        data || [];


    populateSemesterFilter();


    const select =
        document.getElementById(
            "studentSemesterInput"
        );


    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select Semester
        </option>
    `;


    semesters.forEach(semester => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            semester.id;

        option.textContent =
            semester.name;

        select.appendChild(option);

    });

}


/* =====================================================
   STUDENT FILTERS
===================================================== */

function populateStudentFilters() {

    populateBranchFilter();
    populateSemesterFilter();

}


function populateBranchFilter() {

    const select =
        document.getElementById(
            "filterBranch"
        );


    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            All Branches
        </option>
    `;


    branches.forEach(branch => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            branch.id;

        option.textContent =
            `${branch.name} (${branch.code})`;

        select.appendChild(option);

    });

}


function populateSemesterFilter() {

    const select =
        document.getElementById(
            "filterSemester"
        );


    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            All Semesters
        </option>
    `;


    semesters.forEach(semester => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            semester.id;

        option.textContent =
            semester.name;

        select.appendChild(option);

    });

}


function filterStudents() {

    const roll =
        document
            .getElementById("filterRoll")
            .value
            .trim()
            .toLowerCase();


    const name =
        document
            .getElementById("filterName")
            .value
            .trim()
            .toLowerCase();


    const email =
        document
            .getElementById("filterEmail")
            .value
            .trim()
            .toLowerCase();


    const branch =
        document
            .getElementById("filterBranch")
            .value;


    const semester =
        document
            .getElementById("filterSemester")
            .value;


    const batch =
        document
            .getElementById("filterBatch")
            .value;


    const filtered =
        students.filter(student => {

            const rollMatch =
                !roll ||
                String(student.roll_number)
                    .toLowerCase()
                    .includes(roll);


            const fullName =
                `${student.first_name || ""} ${student.last_name || ""}`
                    .toLowerCase()
                    .trim();


            const nameMatch =
                !name ||
                fullName.includes(name);


            const emailMatch =
                !email ||
                String(student.email)
                    .toLowerCase()
                    .includes(email);


            const branchMatch =
                !branch ||
                String(student.branch_id) ===
                String(branch);


            const semesterMatch =
                !semester ||
                String(student.semester_id) ===
                String(semester);


            const batchMatch =
                !batch ||
                String(student.batch_id) ===
                String(batch);


            return (
                rollMatch &&
                nameMatch &&
                emailMatch &&
                branchMatch &&
                semesterMatch &&
                batchMatch
            );

        });


    renderStudents(filtered);

    updateStudentFilterCount(
        filtered.length
    );

}


function clearStudentFilters() {

    document.getElementById(
        "filterRoll"
    ).value = "";

    document.getElementById(
        "filterName"
    ).value = "";

    document.getElementById(
        "filterEmail"
    ).value = "";

    document.getElementById(
        "filterBranch"
    ).value = "";

    document.getElementById(
        "filterSemester"
    ).value = "";

    document.getElementById(
        "filterBatch"
    ).value = "";


    renderStudents(students);

    updateStudentFilterCount(
        students.length
    );

}


function updateStudentFilterCount(count) {

    const element =
        document.getElementById(
            "studentFilterCount"
        );


    if (!element) {
        return;
    }


    element.textContent =
        `Showing ${count} student${count === 1 ? "" : "s"}`;

}


/* =====================================================
   LOAD STUDENTS
===================================================== */

async function loadStudents() {

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("students")
            .select(`
                id,
                roll_number,
                email,
                first_name,
                last_name,
                batch_id,
                branch_id,
                semester_id,
                status,
                created_at,
                student_enrollments ( id, academic_year_id, semester_id, is_current )
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Students error:",
            error
        );

        return;
    }


    /*
      The student's current semester is stored directly in students.semester_id.
      The current enrollment supplies enrollment_id and academic_year_id.
    */
    students =
        (data || []).map(student => {

            const current =
                (student.student_enrollments || [])
                    .find(item => item.is_current);

            return {
                ...student,
                enrollment_id:
                    current ? current.id : null,
                academic_year_id:
                    current ? current.academic_year_id : null
            };

        });


    renderStudents(students);

    updateStudentFilterCount(
        students.length
    );

}

/* =====================================================
   RENDER STUDENTS
===================================================== */

function renderStudents(list) {

    const tbody =
        document.getElementById(
            "studentsTable"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";

    const showArchivedBox =
        document.getElementById("showArchived");

    if (!showArchivedBox || !showArchivedBox.checked) {
        list = list.filter(item => item.status !== "archived");
    }

    selectedStudentIds.clear();
    updateBulkButtons();


    if (list.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="empty-table"
                >
                    No students found.
                </td>
            </tr>
        `;

        return;
    }


    list.forEach(student => {

        const branch =
            branches.find(
                item =>
                    item.id ===
                    student.branch_id
            );


        const semester =
            semesters.find(
                item =>
                    item.id ===
                    student.semester_id
            );


        const batch =
            batches.find(
                item =>
                    item.id ===
                    student.batch_id
            );


        const row =
            document.createElement("tr");


        if (student.status === "archived") {
            row.style.opacity = "0.55";
        }

        row.innerHTML = `

            <td>
                <input type="checkbox" class="student-select" data-id="${student.id}">
            </td>

            <td>
                <strong>
                    ${escapeHTML(
                        student.roll_number
                    )}
                </strong>
            </td>

            <td>
                ${escapeHTML(
                    student.first_name
                )}
                ${escapeHTML(
                    student.last_name || ""
                )}
            </td>

            <td>
                ${escapeHTML(
                    student.email
                )}
            </td>

            <td>
                ${
                    batch
                        ? escapeHTML(
                            batch.label
                        )
                        : "-"
                }
            </td>

            <td>
                ${
                    branch
                        ? escapeHTML(
                            branch.code
                        )
                        : "-"
                }
            </td>

            <td>
                ${
                    semester
                        ? escapeHTML(
                            semester.name
                        )
                        : "-"
                }
            </td>

            <td>
                <div class="action-buttons">

                    <button
                        class="action-btn edit-btn"
                        onclick="editStudent(${student.id})"
                    >
                        Edit
                    </button>

                    <button
                        class="action-btn edit-btn"
                        onclick="openStudentHistory(${student.id})"
                    >
                        History
                    </button>

                    <button
                        class="action-btn edit-btn"
                        onclick="archiveStudent(${student.id})"
                    >
                        ${student.status === "archived" ? "Restore" : "Archive"}
                    </button>

                    <button
                        class="action-btn delete-btn"
                        onclick="deleteStudent(${student.id})"
                    >
                        Delete
                    </button>

                </div>
            </td>

        `;


        tbody.appendChild(row);

    });

}


/* =====================================================
   ADD STUDENT
===================================================== */

function openAddStudentModal() {

    clearStudentForm();


    document
        .getElementById("modalTitle")
        .textContent =
        "Add Student";


    document
        .getElementById("studentPasswordInput")
        .placeholder =
        "Enter password";


    document
        .getElementById("studentModal")
        .classList.remove("hidden");

}


/* =====================================================
   EDIT STUDENT
===================================================== */

function editStudent(id) {

    const student =
        students.find(
            item =>
                item.id === id
        );


    if (!student) {
        return;
    }


    document
        .getElementById("modalTitle")
        .textContent =
        "Edit Student";


    document
        .getElementById("editStudentId")
        .value =
        student.id;


    document
        .getElementById("studentRollInput")
        .value =
        student.roll_number;


    document
        .getElementById("studentEmailInput")
        .value =
        student.email;


    document
        .getElementById("studentFirstNameInput")
        .value =
        student.first_name;


    document
        .getElementById("studentLastNameInput")
        .value =
        student.last_name || "";


    document
        .getElementById("studentBranchInput")
        .value =
        student.branch_id;


    document
        .getElementById("studentBatchInput")
        .value =
        student.batch_id;


    document
        .getElementById("studentSemesterInput")
        .value =
        student.semester_id || "";


    const currentAcademicYear = getCurrentAcademicYear();
    document
        .getElementById("studentAcademicYearInput")
        .value = currentAcademicYear ? currentAcademicYear.id : "";
    document
        .getElementById("studentAcademicYearInput")
        .disabled = true;


    document
        .getElementById("studentPasswordInput")
        .value =
        "";


    document
        .getElementById("studentPasswordInput")
        .placeholder =
        "Leave empty to keep existing password";


    document
        .getElementById("modalMessage")
        .textContent = "";


    document
        .getElementById("studentModal")
        .classList.remove("hidden");

}


/* =====================================================
   SAVE STUDENT
===================================================== */

async function saveStudent() {

    const id =
        document
            .getElementById(
                "editStudentId"
            )
            .value;


    const rollNumber =
        document
            .getElementById(
                "studentRollInput"
            )
            .value
            .trim();


    const email =
        document
            .getElementById(
                "studentEmailInput"
            )
            .value
            .trim();


    const firstName =
        document
            .getElementById(
                "studentFirstNameInput"
            )
            .value
            .trim();


    const lastName =
        document
            .getElementById(
                "studentLastNameInput"
            )
            .value
            .trim();


    const branchId =
        document
            .getElementById(
                "studentBranchInput"
            )
            .value;


    const semesterId =
        document
            .getElementById(
                "studentSemesterInput"
            )
            .value;


    const batchId =
        document
            .getElementById(
                "studentBatchInput"
            )
            .value;


    const currentAcademicYear = getCurrentAcademicYear();
    const academicYearId = currentAcademicYear ? currentAcademicYear.id : null;


    const password =
        document
            .getElementById(
                "studentPasswordInput"
            )
            .value;


    const message =
        document.getElementById(
            "modalMessage"
        );


    message.textContent = "";
    message.className = "message";


    if (
        !rollNumber ||
        !email ||
        !firstName ||
        !branchId ||
        !batchId ||
        !semesterId
    ) {

        message.textContent =
            "Please fill all required fields.";

        message.classList.add("error");

        return;
    }


    if (!currentAcademicYear) {

        message.textContent =
            "No current academic year is set. Open Academic Setup and mark one as current.";

        message.classList.add("error");

        return;
    }


    if (!id && !password) {

        message.textContent =
            "Password is required for a new student.";

        message.classList.add("error");

        return;
    }


    const saveButton =
        document.getElementById(
            "saveStudentBtn"
        );


    saveButton.disabled = true;
    saveButton.textContent = "Saving...";


    try {

        /* ---------------- EDIT ---------------- */

        if (id) {

            const updateData = {

                roll_number:
                    rollNumber,

                email:
                    email,

                first_name:
                    firstName,

                last_name:
                    lastName || null,

                batch_id:
                    Number(batchId),

                branch_id:
                    Number(branchId)

            };


            if (password) {

                updateData.password_hash =
                    password;

            }


            const {
                error
            } =
                await window.supabaseClient
                    .from("students")
                    .update(updateData)
                    .eq("id", id);


            if (error) {
                throw error;
            }


            /*
              Semester / academic year changes MUST use the same
              movement workflow as the "Move Students" feature.

              Do not directly UPDATE student_enrollments here.
              move_students() handles:
                - freezing the current semester video/question progress
                - clearing current progress before the next semester
                - reusing an existing target enrollment
                - creating the target enrollment only when needed
                - recording the permanent movement in student_promotions
                - refusing backward semester movement

              Passing one student ID makes the single-student edit
              behave exactly like Move Students.
            */

            const editedStudent =
                students.find(
                    item =>
                        item.id === Number(id)
                );

            if (!editedStudent) {
                throw new Error("Student record could not be found.");
            }

            const semesterChanged =
                Number(editedStudent.semester_id) !== Number(semesterId);

            if (semesterChanged) {

                const result =
                    await callAdminRpc("move_students", {
                        p_student_ids: [Number(id)],
                        p_to_semester_id: Number(semesterId),
                        p_academic_year_id: Number(academicYearId),
                        p_reason: "Semester changed from student edit"
                    });

                if (!result?.success) {
                    throw new Error(
                        result?.message ||
                        "Unable to change the student's semester."
                    );
                }

                const problems = result?.problems || [];

                if (problems.length > 0 || Number(result?.moved_count || 0) !== 1) {
                    const problem =
                        problems[0]?.reason ||
                        "The student could not be moved to the selected semester.";
                    throw new Error(problem);
                }
            }

        }


        /* ---------------- ADD ---------------- */

        else {

            const error =
                await insertStudentWithEnrollment({

                    roll_number:
                        rollNumber,

                    email:
                        email,

                    password_hash:
                        password,

                    first_name:
                        firstName,

                    last_name:
                        lastName || null,

                    batch_id:
                        Number(batchId),

                    branch_id:
                        Number(branchId),

                    semester_id:
                        Number(semesterId),

                    academic_year_id:
                        Number(academicYearId)

                });


            if (error) {
                throw error;
            }

        }


        closeStudentModal();

        await loadStudents();

        await loadDashboardCounts();


    } catch (error) {

        console.error(
            "Save student error:",
            error
        );


        message.textContent =
            error.message ||
            "Failed to save student.";

        message.classList.add("error");

    } finally {

        saveButton.disabled = false;
        saveButton.textContent = "Save Student";

    }

}


/* =====================================================
   DELETE STUDENT
===================================================== */

/* =====================================================
   ADMIN CREDENTIALS FOR RPC CALLS
   (interim: the password is kept in memory only, never in localStorage.
    Replace with a session token when the login RPC / hashing is added.)
===================================================== */

let adminPasswordCache = null;

function getAdminCreds() {

    if (!currentUser || currentRole !== "admin") {
        throw new Error("Admin session required.");
    }

    if (!adminPasswordCache) {

        const typed =
            window.prompt(
                "Enter your admin password to confirm this action:"
            );

        if (!typed) {
            throw new Error("Cancelled.");
        }

        adminPasswordCache = typed;
    }

    return {
        p_admin_email: currentUser.email,
        p_admin_password: adminPasswordCache
    };

}

async function callAdminRpc(name, params) {

    const { data, error } =
        await window.supabaseClient.rpc(
            name,
            { ...params, ...getAdminCreds() }
        );

    if (error) {
        throw error;
    }

    if (data && data.message === "Admin check failed") {
        adminPasswordCache = null;
        throw new Error("Admin password was not accepted.");
    }

    return data;

}


/* =====================================================
   DELETE / BULK DELETE / ARCHIVE
===================================================== */

const selectedStudentIds = new Set();

function updateBulkButtons() {

    const del = document.getElementById("deleteSelectedBtn");
    const arc = document.getElementById("archiveSelectedBtn");
    const n = selectedStudentIds.size;

    if (del) {
        del.hidden = n === 0;
        del.textContent = `Delete Selected (${n})`;
    }

    if (arc) {
        arc.hidden = n === 0;
        arc.textContent = `Archive Selected (${n})`;
    }

}

function setupStudentSelection() {

    const tbody = document.getElementById("studentsTable");
    const all = document.getElementById("selectAllStudents");
    const showArchived = document.getElementById("showArchived");

    if (tbody) {
        tbody.addEventListener("change", event => {

            if (!event.target.classList.contains("student-select")) {
                return;
            }

            const id = Number(event.target.dataset.id);

            if (event.target.checked) {
                selectedStudentIds.add(id);
            } else {
                selectedStudentIds.delete(id);
            }

            updateBulkButtons();

        });
    }

    if (all) {
        all.addEventListener("change", () => {

            document
                .querySelectorAll(".student-select")
                .forEach(box => {
                    box.checked = all.checked;
                    const id = Number(box.dataset.id);
                    all.checked
                        ? selectedStudentIds.add(id)
                        : selectedStudentIds.delete(id);
                });

            updateBulkButtons();

        });
    }

    if (showArchived) {
        showArchived.addEventListener("change", filterStudents);
    }

    const delBtn = document.getElementById("deleteSelectedBtn");
    const arcBtn = document.getElementById("archiveSelectedBtn");

    if (delBtn) {
        delBtn.addEventListener("click", () => deleteStudentsByIds([...selectedStudentIds]));
    }

    if (arcBtn) {
        arcBtn.addEventListener("click", () => archiveStudentsByIds([...selectedStudentIds], true));
    }

}

async function deleteStudent(id) {

    await deleteStudentsByIds([id]);

}

async function deleteStudentsByIds(ids) {

    if (!ids.length) {
        return;
    }

    const label =
        ids.length === 1
            ? (students.find(item => item.id === ids[0])?.roll_number || "this student")
            : `${ids.length} students`;

    const confirmed =
        confirm(
            `Permanently delete ${label}?\n\nThis also removes their enrollments, semester movement history and quiz attempts. Use Archive to keep the data.`
        );

    if (!confirmed) {
        return;
    }

    try {

        const result =
            await callAdminRpc("delete_students", { p_student_ids: ids });

        if (!result.success || result.deleted_count === 0) {
            alert(
                result.message ||
                "Nothing was deleted (permission or already removed)"
            );
        } else if (result.deleted_count < ids.length) {
            alert(`${result.deleted_count} of ${ids.length} deleted; the rest were already removed.`);
        }

        await loadStudents();
        await loadDashboardCounts();

    } catch (error) {

        console.error("Delete student error:", error);

        if (error.message !== "Cancelled.") {
            alert(error.message || "Failed to delete student.");
        }

    }

}

async function archiveStudent(id) {

    const student = students.find(item => item.id === id);

    if (!student) {
        return;
    }

    await archiveStudentsByIds([id], student.status !== "archived");

}

async function archiveStudentsByIds(ids, archived) {

    if (!ids.length) {
        return;
    }

    try {

        const result =
            await callAdminRpc(
                "set_students_archived",
                { p_student_ids: ids, p_archived: archived }
            );

        if (!result.success) {
            alert(result.message || "Could not update students.");
        }

        await loadStudents();
        await loadDashboardCounts();

    } catch (error) {

        if (error.message !== "Cancelled.") {
            alert(error.message || "Could not update students.");
        }

    }

}


/* =====================================================
   STUDENT HISTORY + UNDO
===================================================== */

let historyStudentId = null;

async function openStudentHistory(id) {

    historyStudentId = id;

    const student = students.find(item => item.id === id);

    document.getElementById("historyTitle").textContent =
        `History: ${student ? student.roll_number : id}`;

    document.getElementById("historyMessage").textContent = "";
    document.getElementById("historyMessage").className = "message";
    document.getElementById("historyBody").innerHTML = "Loading...";
    document.getElementById("studentHistoryModal").classList.remove("hidden");

    await renderStudentHistory();

}

async function renderStudentHistory() {

    const body = document.getElementById("historyBody");

    try {

        const result =
            await callAdminRpc("student_history", { p_student_id: historyStudentId });

        if (!result.success) {
            body.textContent = result.message || "Could not load history.";
            return;
        }

        const enrollRows =
            result.enrollments.map(item => `
                <tr>
                    <td>${escapeHTML(item.academic_year)}</td>
                    <td>${escapeHTML(item.semester)}</td>
                    <td>${escapeHTML(item.status)}</td>
                    <td>${item.is_current ? "Yes" : ""}</td>
                </tr>`).join("") ||
            '<tr><td colspan="4">No enrollments.</td></tr>';

        const moveRows =
            result.promotions.map(item => `
                <tr>
                    <td>${escapeHTML(item.from)}</td>
                    <td>${escapeHTML(item.to)}</td>
                    <td>${escapeHTML(item.type)}</td>
                    <td>${new Date(item.moved_at).toLocaleString()}</td>
                    <td>${escapeHTML(item.reason || "")}</td>
                </tr>`).join("") ||
            '<tr><td colspan="5">No movements yet.</td></tr>';

        body.innerHTML = `
            <h3>Enrollments</h3>
            <table class="data-table">
                <thead><tr><th>Academic year</th><th>Semester</th><th>Status</th><th>Current</th></tr></thead>
                <tbody>${enrollRows}</tbody>
            </table>
            <h3 style="margin-top:16px">Movements</h3>
            <table class="data-table">
                <thead><tr><th>From</th><th>To</th><th>Type</th><th>Date</th><th>Reason</th></tr></thead>
                <tbody>${moveRows}</tbody>
            </table>`;

    } catch (error) {

        body.textContent =
            error.message === "Cancelled."
                ? "Enter the admin password to view history."
                : (error.message || "Could not load history.");

    }

}

function closeStudentHistory() {

    document.getElementById("studentHistoryModal").classList.add("hidden");

}

/* =====================================================
   STUDENT FORM
===================================================== */

function clearStudentForm() {

    document.getElementById(
        "editStudentId"
    ).value = "";

    document.getElementById(
        "studentRollInput"
    ).value = "";

    document.getElementById(
        "studentEmailInput"
    ).value = "";

    document.getElementById(
        "studentFirstNameInput"
    ).value = "";

    document.getElementById(
        "studentLastNameInput"
    ).value = "";

    document.getElementById(
        "studentBranchInput"
    ).value = "";

    document.getElementById(
        "studentBatchInput"
    ).value = "";

    document.getElementById(
        "studentSemesterInput"
    ).value = "";

    document.getElementById(
        "studentAcademicYearInput"
    ).value =
        getCurrentAcademicYear()
            ? getCurrentAcademicYear().id
            : "";

    document.getElementById(
        "studentPasswordInput"
    ).value = "";

    document.getElementById(
        "studentPasswordInput"
    ).placeholder =
        "Enter password";

    document.getElementById(
        "modalMessage"
    ).textContent = "";

}


function closeStudentModal() {

    document
        .getElementById("studentModal")
        .classList.add("hidden");

}


/* =====================================================
   MOVE STUDENTS
===================================================== */

function openMoveStudentsModal() {

    populateMoveSemesterSelects();

    populateMoveBranchSelect();

    populateMoveBatchSelect();

    populateMoveAcademicYearSelect();
    populateStudentAcademicYearSelect();


    document
        .getElementById("moveStudentsModal")
        .classList.remove("hidden");


    document
        .getElementById("moveStudentCount")
        .textContent =
        "Select a current semester to see how many students will be moved.";


    document
        .getElementById("moveStudentsWarning")
        .classList.add("hidden");


    document
        .getElementById("moveStudentsMessage")
        .textContent = "";

}


function closeMoveStudentsModal() {

    document
        .getElementById("moveStudentsModal")
        .classList.add("hidden");

}


function populateMoveSemesterSelects() {

    const fromSelect =
        document.getElementById(
            "moveFromSemester"
        );

    const toSelect =
        document.getElementById(
            "moveToSemester"
        );


    fromSelect.innerHTML = `
        <option value="">
            Select current semester
        </option>
    `;


    toSelect.innerHTML = `
        <option value="">
            Select target semester
        </option>
    `;


    semesters.forEach(semester => {

        const fromOption =
            document.createElement(
                "option"
            );

        fromOption.value =
            semester.id;

        fromOption.textContent =
            semester.name;

        fromSelect.appendChild(
            fromOption
        );


        const toOption =
            document.createElement(
                "option"
            );

        toOption.value =
            semester.id;

        toOption.textContent =
            semester.name;

        toSelect.appendChild(
            toOption
        );

    });

}


function populateMoveBatchSelect() {

    const select = document.getElementById("moveBatch");

    if (!select) {
        return;
    }

    select.innerHTML = '<option value="">All Batches</option>';

    batches.forEach(batch => {

        const option = document.createElement("option");
        option.value = batch.id;
        option.textContent = batch.label;
        select.appendChild(option);

    });

}

function moveBatchText() {

    const value = document.getElementById("moveBatch")?.value;

    if (!value) {
        return "all batches";
    }

    const batch = batches.find(item => item.id === Number(value));

    return batch ? `batch ${batch.label}` : "the selected batch";

}

function populateMoveBranchSelect() {

    const select =
        document.getElementById(
            "moveBranch"
        );


    select.innerHTML = `
        <option value="">
            All Branches
        </option>
    `;


    branches.forEach(branch => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            branch.id;

        option.textContent =
            `${branch.name} (${branch.code})`;

        select.appendChild(option);

    });

}


async function updateMoveStudentCount() {

    const fromSemester =
        document.getElementById(
            "moveFromSemester"
        ).value;


    const branch =
        document.getElementById(
            "moveBranch"
        ).value;


    const countBox =
        document.getElementById(
            "moveStudentCount"
        );


    const warning =
        document.getElementById(
            "moveStudentsWarning"
        );


    if (!fromSemester) {

        countBox.textContent =
            "Select a current semester to see how many students will be moved.";

        warning.classList.add("hidden");

        return;
    }


    countBox.textContent =
        "Checking students...";


    // students whose CURRENT enrollment is in the chosen semester
    let query =
        window.supabaseClient
            .from("students")
            .select("id", {
                count: "exact",
                head: true
            })
            .eq(
                "semester_id",
                Number(fromSemester)
            )
            .neq("status", "archived");


    if (branch) {

        query =
            query.eq(
                "students.branch_id",
                Number(branch)
            );

    }

    if (document.getElementById("moveBatch")?.value) {

        query =
            query.eq(
                "students.batch_id",
                Number(document.getElementById("moveBatch").value)
            );

    }



    const {
        count,
        error
    } =
        await query;


    if (error) {

        console.error(
            error
        );

        countBox.textContent =
            "Unable to calculate student count.";

        return;
    }


    const total =
        count || 0;


    const semester =
        semesters.find(
            item =>
                item.id ===
                Number(fromSemester)
        );


    const branchObject =
        branch
            ? branches.find(
                item =>
                    item.id ===
                    Number(branch)
            )
            : null;


    const branchText =
        branchObject
            ? branchObject.name
            : "all branches";


    countBox.innerHTML = `

        <strong>
            ${total} student${total === 1 ? "" : "s"}
        </strong>

        will be moved from

        <strong>
            ${escapeHTML(
                semester?.name || ""
            )}
        </strong>

        for

        <strong>
            ${escapeHTML(
                branchText
            )}
        </strong>,

        <strong>${escapeHTML(moveBatchText())}</strong>.

    `;


    if (total > 0) {

        warning.classList.remove(
            "hidden"
        );

    } else {

        warning.classList.add(
            "hidden"
        );

    }

}


function validateMoveTarget() {

    const fromSemester =
        document.getElementById(
            "moveFromSemester"
        ).value;


    const toSemester =
        document.getElementById(
            "moveToSemester"
        ).value;


    const message =
        document.getElementById(
            "moveStudentsMessage"
        );


    message.textContent = "";
    message.className = "message";


    if (
        fromSemester &&
        toSemester &&
        fromSemester === toSemester
    ) {

        message.textContent =
            "Current semester and target semester cannot be the same.";

        message.classList.add("error");

    }

}


async function moveStudents() {

    const fromSemester =
        document.getElementById(
            "moveFromSemester"
        ).value;


    const toSemester =
        document.getElementById(
            "moveToSemester"
        ).value;


    const branch =
        document.getElementById(
            "moveBranch"
        ).value;


    const academicYear =
        document.getElementById("moveAcademicYear")?.value || "";


    const message =
        document.getElementById(
            "moveStudentsMessage"
        );


    const button =
        document.getElementById(
            "confirmMoveStudents"
        );


    message.textContent = "";
    message.className = "message";


    if (!fromSemester) {

        message.textContent =
            "Please select the current semester.";

        message.classList.add("error");

        return;
    }


    if (!toSemester) {

        message.textContent =
            "Please select the target semester.";

        message.classList.add("error");

        return;
    }


    if (fromSemester === toSemester) {

        message.textContent =
            "Current and target semesters cannot be the same.";

        message.classList.add("error");

        return;
    }


    if (!academicYear) {

        message.textContent =
            "Please select the academic year for the target semester.";

        message.classList.add("error");

        return;
    }


    let countQuery =
        window.supabaseClient
            .from("students")
            .select("id", {
                count: "exact",
                head: true
            })
            .eq(
                "semester_id",
                Number(fromSemester)
            )
            .neq("status", "archived");


    if (branch) {

        countQuery =
            countQuery.eq(
                "branch_id",
                Number(branch)
            );

    }

    if (document.getElementById("moveBatch")?.value) {

        countQuery =
            countQuery.eq(
                "batch_id",
                Number(document.getElementById("moveBatch").value)
            );

    }



    const {
        count,
        error: countError
    } =
        await countQuery;


    if (countError) {

        message.textContent =
            countError.message;

        message.classList.add("error");

        return;
    }


    const studentCount =
        count || 0;


    if (studentCount === 0) {

        message.textContent =
            "No students found for the selected criteria.";

        message.classList.add("error");

        return;
    }


    const fromSemesterObject =
        semesters.find(
            item =>
                item.id ===
                Number(fromSemester)
        );


    const toSemesterObject =
        semesters.find(
            item =>
                item.id ===
                Number(toSemester)
        );


    const branchObject =
        branch
            ? branches.find(
                item =>
                    item.id ===
                    Number(branch)
            )
            : null;


    const branchText =
        branchObject
            ? branchObject.name
            : "all branches";

    if (!academicYear) {
        message.textContent =
            "Please select the academic year for the target semester.";
        message.classList.add("error");
        return;
    }


    const confirmed =
        confirm(
            `You are about to move ${studentCount} student(s) from ${fromSemesterObject?.name} to ${toSemesterObject?.name} for ${branchText}, ${moveBatchText()} into ${academicYears.find(y => String(y.id) === String(academicYear))?.label || "the selected academic year"}.\n\nTheir current enrollment will be closed. An existing target enrollment for the selected semester and academic year will be reused if one already exists; otherwise a new enrollment will be created.\n\nContinue?`
        );


    if (!confirmed) {
        return;
    }


    button.disabled = true;
    button.textContent = "Moving...";


    try {

        /*
          1. read every current enrollment in the chosen semester
             (paged, because Supabase returns at most 1000 rows)
        */

        const enrollments = [];

        for (let from = 0; ; from += 1000) {

            let pageQuery =
                window.supabaseClient
                    .from("students")
                    .select("id, branch_id, batch_id")
                    .eq(
                        "semester_id",
                        Number(fromSemester)
                    )
                    .neq("status", "archived")
                    .order("id")
                    .range(from, from + 999);


            if (branch) {

                pageQuery =
                    pageQuery.eq(
                        "branch_id",
                        Number(branch)
                    );

            }


            if (document.getElementById("moveBatch")?.value) {

                pageQuery =
                    pageQuery.eq(
                        "batch_id",
                        Number(document.getElementById("moveBatch").value)
                    );

            }



            const {
                data: page,
                error: pageError
            } =
                await pageQuery;


            if (pageError) {
                throw pageError;
            }


            enrollments.push(
                ...(page || []).map(student => ({
                    student_id: student.id,
                    id: student.id
                }))
            );


            if (!page || page.length < 1000) {
                break;
            }

        }


        /*
          2. one RPC call per chunk: closes the old enrollment, creates or
             opens the target one and records the permanent promotion in history.
             Lower-semester movement is refused; semester history is permanent.
        */

        const reason =
            (document.getElementById("moveReason")?.value || "").trim() || null;

        const studentIds = enrollments.map(e => e.student_id);

        let movedTotal = 0;
        const problems = [];

        for (let i = 0; i < studentIds.length; i += 200) {

            const result =
                await callAdminRpc("move_students", {
                    p_student_ids: studentIds.slice(i, i + 200),
                    p_to_semester_id: Number(toSemester),
                    p_academic_year_id: Number(academicYear),
                    p_reason: reason
                });

            movedTotal += result.moved_count || 0;
            problems.push(...(result.problems || []));

        }

        if (problems.length) {

            const names =
                problems.slice(0, 10).map(item => {
                    const s = students.find(x => x.id === item.student_id);
                    return `${s ? s.roll_number : item.student_id}: ${item.reason}`;
                }).join("; ");

            message.textContent =
                `${movedTotal} moved, ${problems.length} failed. ${names}${problems.length > 10 ? " ..." : ""}`;

            message.classList.add("error");

            await loadStudents();
            await loadDashboardCounts();
            await updateMoveStudentCount();

            return;
        }

        message.textContent =
            `${movedTotal} student(s) successfully moved to ${toSemesterObject?.name}.`;

        message.classList.add("success");


        await loadStudents();

        await loadDashboardCounts();

        await updateMoveStudentCount();


        setTimeout(
            () => {
                closeMoveStudentsModal();
            },
            1200
        );


    } catch (error) {

        console.error(
            "Move students error:",
            error
        );


        message.textContent =
            error.message ||
            "Failed to move students.";

        message.classList.add("error");

    } finally {

        button.disabled = false;
        button.textContent = "Move Students";

    }

}


/* =====================================================
   ADMIN MANAGEMENT
===================================================== */

async function loadAdmins() {

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("admins")
            .select(`
                id,
                email,
                created_at
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );


    if (error) {

        console.error(
            "Admins error:",
            error
        );

        return;
    }


    admins =
        data || [];


    renderAdmins(admins);

    updateAdminCount(
        admins.length
    );

}


function renderAdmins(list) {

    const tbody =
        document.getElementById(
            "adminsTable"
        );


    if (!tbody) {
        return;
    }


    tbody.innerHTML = "";


    if (list.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="empty-table"
                >
                    No admins found.
                </td>
            </tr>
        `;

        return;
    }


    list.forEach(admin => {

        const row =
            document.createElement("tr");


        const isCurrentAdmin =
            currentUser &&
            Number(currentUser.id) ===
            Number(admin.id);


        const createdDate =
            admin.created_at
                ? new Date(
                    admin.created_at
                ).toLocaleString()
                : "-";


        row.innerHTML = `

            <td>
                <strong>
                    ${admin.id}
                </strong>
            </td>

            <td>
                ${escapeHTML(
                    admin.email
                )}

                ${
                    isCurrentAdmin
                        ? `
                            <span class="current-admin-badge">
                                YOU
                            </span>
                          `
                        : ""
                }
            </td>

            <td>
                ${escapeHTML(
                    createdDate
                )}
            </td>

            <td>

                <div class="admin-action-buttons">

                    <button
                        class="action-btn edit-btn"
                        onclick="editAdmin(${admin.id})"
                    >
                        Edit
                    </button>

                    ${
                        isCurrentAdmin
                            ? ""
                            : `
                                <button
                                    class="action-btn delete-btn"
                                    onclick="deleteAdmin(${admin.id})"
                                >
                                    Delete
                                </button>
                              `
                    }

                </div>

            </td>

        `;


        tbody.appendChild(row);

    });

}


function updateAdminCount(count) {

    const element =
        document.getElementById(
            "totalAdmins"
        );


    if (element) {
        element.textContent = count;
    }

}


function filterAdmins() {

    const search =
        document
            .getElementById(
                "adminSearch"
            )
            .value
            .trim()
            .toLowerCase();


    const filtered =
        admins.filter(
            admin =>
                String(admin.email)
                    .toLowerCase()
                    .includes(search)
        );


    renderAdmins(filtered);

}


function openAddAdminModal() {

    document
        .getElementById("editAdminId")
        .value = "";


    document
        .getElementById("adminEmailInput")
        .value = "";


    document
        .getElementById("adminPasswordInput")
        .value = "";


    document
        .getElementById("adminPasswordInput")
        .placeholder =
        "Enter password";


    document
        .getElementById("adminPasswordHelp")
        .textContent =
        "Password is required when creating a new admin.";


    document
        .getElementById("adminModalMessage")
        .textContent = "";


    document
        .getElementById("adminModal")
        .classList.remove("hidden");

}


function closeAdminModal() {

    document
        .getElementById("adminModal")
        .classList.add("hidden");

}


function editAdmin(id) {

    const admin =
        admins.find(
            item =>
                item.id === id
        );


    if (!admin) {
        return;
    }


    document
        .getElementById("editAdminId")
        .value =
        admin.id;


    document
        .getElementById("adminEmailInput")
        .value =
        admin.email;


    document
        .getElementById("adminPasswordInput")
        .value = "";


    document
        .getElementById("adminPasswordInput")
        .placeholder =
        "Leave empty to keep existing password";


    document
        .getElementById("adminPasswordHelp")
        .textContent =
        "Leave password empty if you do not want to change it.";


    document
        .getElementById("adminModalMessage")
        .textContent = "";


    document
        .getElementById("adminModal")
        .classList.remove("hidden");

}


async function saveAdmin() {

    const id =
        document
            .getElementById(
                "editAdminId"
            )
            .value;


    const email =
        document
            .getElementById(
                "adminEmailInput"
            )
            .value
            .trim();


    const password =
        document
            .getElementById(
                "adminPasswordInput"
            )
            .value;


    const message =
        document.getElementById(
            "adminModalMessage"
        );


    const button =
        document.getElementById(
            "saveAdminBtn"
        );


    message.textContent = "";
    message.className = "message";


    if (!email) {

        message.textContent =
            "Please enter an admin email.";

        message.classList.add("error");

        return;
    }


    if (!id && !password) {

        message.textContent =
            "Password is required for a new admin.";

        message.classList.add("error");

        return;
    }


    button.disabled = true;
    button.textContent = "Saving...";


    try {

        /* ---------------- EDIT ---------------- */

        if (id) {

            const updateData = {
                email: email
            };


            if (password) {

                updateData.password_hash =
                    password;

            }


            const {
                error
            } =
                await window.supabaseClient
                    .from("admins")
                    .update(updateData)
                    .eq(
                        "id",
                        id
                    );


            if (error) {
                throw error;
            }


            /*
             If current admin changed
             their own email, update
             session information.
            */

            if (
                currentUser &&
                Number(currentUser.id) ===
                Number(id)
            ) {

                currentUser.email =
                    email;

                saveSession();


                document
                    .getElementById(
                        "adminEmail"
                    )
                    .textContent =
                    email;

            }

        }


        /* ---------------- ADD ---------------- */

        else {

            const {
                error
            } =
                await window.supabaseClient
                    .from("admins")
                    .insert({

                        email:
                            email,

                        password_hash:
                            password

                    });


            if (error) {
                throw error;
            }

        }


        closeAdminModal();

        await loadAdmins();

    } catch (error) {

        console.error(
            "Save admin error:",
            error
        );


        let errorMessage =
            error.message ||
            "Failed to save admin.";


        if (
            errorMessage
                .toLowerCase()
                .includes("duplicate")
        ) {

            errorMessage =
                "An admin with this email already exists.";

        }


        message.textContent =
            errorMessage;

        message.classList.add("error");

    } finally {

        button.disabled = false;
        button.textContent = "Save Admin";

    }

}


async function deleteAdmin(id) {

    if (
        currentUser &&
        Number(currentUser.id) ===
        Number(id)
    ) {

        alert(
            "You cannot delete the admin account you are currently logged in with."
        );

        return;
    }


    const admin =
        admins.find(
            item =>
                item.id === id
        );


    if (!admin) {
        return;
    }


    const confirmed =
        confirm(
            `Are you sure you want to delete admin "${admin.email}"?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } =
            await window.supabaseClient
                .from("admins")
                .delete()
                .eq(
                    "id",
                    id
                );


        if (error) {
            throw error;
        }


        await loadAdmins();


    } catch (error) {

        console.error(
            "Delete admin error:",
            error
        );


        alert(
            error.message ||
            "Failed to delete admin."
        );

    }

}


/* =====================================================
   EXCEL UPLOAD
===================================================== */

async function handleExcelUpload(event) {

    const file =
        event.target.files[0];


    if (!file) {
        return;
    }


    const resultBox =
        document.getElementById(
            "bulkUploadResult"
        );


    resultBox.classList.remove(
        "hidden"
    );


    resultBox.innerHTML = `
        <div class="upload-loading">
            Reading Excel file...
        </div>
    `;


    try {

        const arrayBuffer =
            await file.arrayBuffer();


        const workbook =
            XLSX.read(
                arrayBuffer,
                {
                    type: "array"
                }
            );


        const sheetName =
            workbook.SheetNames[0];


        if (!sheetName) {

            throw new Error(
                "No worksheet found in the Excel file."
            );

        }


        const worksheet =
            workbook.Sheets[
                sheetName
            ];


        const rows =
            XLSX.utils.sheet_to_json(
                worksheet,
                {
                    defval: ""
                }
            );


        if (rows.length === 0) {

            throw new Error(
                "The Excel file is empty."
            );

        }


        const validStudents = [];
        const errors = [];


        for (
            let i = 0;
            i < rows.length;
            i++
        ) {

            const row =
                rows[i];


            const excelRow =
                i + 2;


            const rollNumber =
                String(
                    row.roll_number || ""
                ).trim();


            const email =
                String(
                    row.email || ""
                ).trim();


            const password =
                String(
                    row.password_hash || ""
                ).trim();


            const firstName =
                String(
                    row.first_name || ""
                ).trim();


            const lastName =
                String(
                    row.last_name || ""
                ).trim();


            const branchValue =
                String(
                    row.branch || ""
                ).trim();


            const semesterValue =
                String(
                    row.semester || ""
                ).trim();


            const batchValue =
                String(
                    row.batch || ""
                ).trim();


            if (!rollNumber) {

                errors.push(
                    `Row ${excelRow}: Roll number is missing.`
                );

                continue;
            }


            if (!email) {

                errors.push(
                    `Row ${excelRow}: Email is missing.`
                );

                continue;
            }


            if (!password) {

                errors.push(
                    `Row ${excelRow}: Password is missing.`
                );

                continue;
            }


            if (!firstName) {

                errors.push(
                    `Row ${excelRow}: First name is missing.`
                );

                continue;
            }


            if (!branchValue) {

                errors.push(
                    `Row ${excelRow}: Branch is missing.`
                );

                continue;
            }


            if (!semesterValue) {

                errors.push(
                    `Row ${excelRow}: Semester is missing.`
                );

                continue;
            }


            const branch =
                findBranch(
                    branchValue
                );


            if (!branch) {

                errors.push(
                    `Row ${excelRow}: Branch "${branchValue}" not found.`
                );

                continue;
            }


            const semester =
                findSemester(
                    semesterValue
                );


            if (!semester) {

                errors.push(
                    `Row ${excelRow}: Semester "${semesterValue}" not found.`
                );

                continue;
            }


            /*
              Batch column is optional. If it is empty the batch is
              worked out from the semester and the current academic year.
            */

            const batchId =
                batchValue
                    ? (findBatch(batchValue) || {}).id
                    : deriveBatchIdForSemester(semester.id);


            if (!batchId) {

                errors.push(
                    batchValue
                        ? `Row ${excelRow}: Batch "${batchValue}" not found.`
                        : `Row ${excelRow}: Could not work out the batch. Add a batch column (e.g. 2025-2029).`
                );

                continue;
            }


            validStudents.push({

                roll_number:
                    rollNumber,

                email:
                    email,

                password_hash:
                    password,

                first_name:
                    firstName,

                last_name:
                    lastName || null,

                semester_id:
                    semester.id,

                batch_id:
                    batchId,

                branch_id:
                    branch.id

            });

        }


        if (
            validStudents.length === 0
        ) {

            displayBulkUploadResult(
                0,
                errors.length,
                errors
            );

            return;
        }


        const currentYear =
            getCurrentAcademicYear();


        if (!currentYear) {

            throw new Error(
                "No current academic year is set. " +
                "Open Academic Setup and mark one as current."
            );

        }


        /*
        First try bulk insert (students, then their enrollments).
        */

        let error = null;

        {

            const {
                data: insertedStudents,
                error: bulkError
            } =
                await window.supabaseClient
                    .from("students")
                    .insert(
                        validStudents.map(
                            student => student
                        )
                    )
                    .select("id, roll_number");


            error = bulkError;


            if (!bulkError) {

                const semesterByRoll =
                    new Map(
                        validStudents.map(
                            student => [
                                student.roll_number,
                                student.semester_id
                            ]
                        )
                    );


                const {
                    error: enrollmentError
                } =
                    await window.supabaseClient
                        .from("student_enrollments")
                        .insert(
                            insertedStudents.map(student => ({
                                student_id: student.id,
                                academic_year_id: currentYear.id,
                                semester_id:
                                    semesterByRoll.get(
                                        student.roll_number
                                    ),
                                is_current: true,
                                status: "active"
                            }))
                        );


                if (enrollmentError) {

                    // undo the students we just added, then retry one by one
                    await window.supabaseClient
                        .from("students")
                        .delete()
                        .in(
                            "id",
                            insertedStudents.map(
                                student => student.id
                            )
                        );

                    error = enrollmentError;

                }

            }

        }


        if (error) {

            console.warn(
                "Bulk insert failed. Trying individually.",
                error
            );


            await insertStudentsIndividually(
                validStudents,
                errors
            );

            return;
        }


        displayBulkUploadResult(
            validStudents.length,
            errors.length,
            errors
        );


        await loadStudents();

        await loadDashboardCounts();


    } catch (error) {

        console.error(
            "Excel error:",
            error
        );


        resultBox.innerHTML = `
            <div class="upload-error">
                ${escapeHTML(
                    error.message ||
                    "Failed to process Excel file."
                )}
            </div>
        `;

    } finally {

        event.target.value = "";

    }

}


/* =====================================================
   INSERT STUDENTS INDIVIDUALLY
===================================================== */

async function insertStudentsIndividually(
    validStudents,
    errors
) {

    let successCount = 0;


    for (
        const student
        of validStudents
    ) {

        const error =
            await insertStudentWithEnrollment(
                student
            );


        if (error) {

            let message =
                error.message;


            if (
                message
                    .toLowerCase()
                    .includes("duplicate")
            ) {

                message =
                    "Roll number or email already exists.";

            }


            errors.push(
                `Roll ${student.roll_number}: ${message}`
            );

        } else {

            successCount++;

        }

    }


    displayBulkUploadResult(
        successCount,
        errors.length,
        errors
    );


    await loadStudents();

    await loadDashboardCounts();

}


/* =====================================================
   FIND BRANCH
===================================================== */

function findBranch(value) {

    const normalized =
        String(value)
            .trim()
            .toLowerCase();


    return branches.find(branch => {

        const name =
            String(
                branch.name
            )
                .trim()
                .toLowerCase();


        const code =
            String(
                branch.code
            )
                .trim()
                .toLowerCase();


        const id =
            String(
                branch.id
            );


        return (
            normalized === name ||
            normalized === code ||
            normalized === id
        );

    });

}


/* =====================================================
   FIND BATCH
===================================================== */

function findBatch(value) {

    const normalized =
        String(value)
            .trim()
            .toLowerCase();


    return batches.find(batch => {

        return (
            normalized === String(batch.label).toLowerCase() ||
            normalized === String(batch.admission_year) ||
            normalized === String(batch.id)
        );

    });

}


/* =====================================================
   FIND SEMESTER
===================================================== */

function findSemester(value) {

    const normalized =
        String(value)
            .trim()
            .toLowerCase();


    return semesters.find(semester => {

        const name =
            String(
                semester.name
            )
                .trim()
                .toLowerCase();


        const number =
            String(
                semester.semester_number
            );


        const id =
            String(
                semester.id
            );


        return (
            normalized === name ||
            normalized === number ||
            normalized === id ||
            normalized ===
                `semester ${number}`
        );

    });

}


/* =====================================================
   BULK UPLOAD RESULT
===================================================== */

function displayBulkUploadResult(
    successCount,
    errorCount,
    errors
) {

    const resultBox =
        document.getElementById(
            "bulkUploadResult"
        );


    resultBox.classList.remove(
        "hidden"
    );


    let html = `

        <div class="upload-success">

            <strong>
                Bulk upload completed
            </strong>

            <div class="upload-stats">

                <span>
                    ${successCount} students added
                </span>

                <span>
                    ${errorCount} rows failed
                </span>

            </div>

        </div>

    `;


    if (errors.length > 0) {

        html += `

            <div class="upload-errors">

                <strong>
                    Errors
                </strong>

                <ul>

        `;


        errors.forEach(error => {

            html += `

                <li>
                    ${escapeHTML(error)}
                </li>

            `;

        });


        html += `

                </ul>

            </div>

        `;

    }


    resultBox.innerHTML =
        html;

}


/* =====================================================
   DOWNLOAD EXCEL TEMPLATE
===================================================== */

function downloadExcelTemplate() {

    const template = [

        {

            roll_number:
                "22A91A0501",

            email:
                "22A91A0501@iare.ac.in",

            password_hash:
                "Student@123",

            first_name:
                "Uday",

            last_name:
                "Kiran",

            branch:
                "CSE",

            semester:
                "Semester 5",

            batch:
                "2023-2027"

        },

        {

            roll_number:
                "22A91A0502",

            email:
                "22A91A0502@iare.ac.in",

            password_hash:
                "Student@123",

            first_name:
                "Rahul",

            last_name:
                "Kumar",

            branch:
                "CSE",

            semester:
                "Semester 5",

            batch:
                "2023-2027"

        }

    ];


    const worksheet =
        XLSX.utils.json_to_sheet(
            template
        );


    const workbook =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Students"
    );


    XLSX.writeFile(
        workbook,
        "EduLearn_Student_Template.xlsx"
    );

}


/* =====================================================
   LOGOUT
===================================================== */

function logout() {

    currentUser = null;
    currentRole = null;
    adminPasswordCache = null;


    localStorage.removeItem(
        "edulearn_user"
    );

    localStorage.removeItem(
        "edulearn_role"
    );


    document
        .getElementById("adminPage")
        .classList.add("hidden");


    document
        .getElementById("studentPage")
        .classList.add("hidden");


    document
        .getElementById("loginPage")
        .classList.remove("hidden");


    document
        .getElementById("loginIdentifier")
        .value = "";


    document
        .getElementById("loginPassword")
        .value = "";


    clearLoginMessage();

}




/* =====================================================
   PERMANENT VIDEO + QUESTION PROGRESS HISTORY
===================================================== */

async function openVideoProgressHistory() {
    const modal = document.getElementById("videoProgressHistoryModal");
    if (!modal) return;
    modal.classList.remove("hidden");

    const year = document.getElementById("videoHistoryYear");
    const semester = document.getElementById("videoHistorySemester");
    const student = document.getElementById("videoHistoryStudent");
    if (year && !year.dataset.ready) {
        year.innerHTML = `<option value="">All Academic Years</option>` +
            [...academicYears].sort((a,b) => String(b.label || "").localeCompare(String(a.label || "")))
                .map(item => `<option value="${item.id}">${escapeHTML(item.label)}</option>`).join("");
        year.dataset.ready = "1";
    }
    if (semester && !semester.dataset.ready) {
        semester.innerHTML = `<option value="">All Semesters</option>` +
            [...semesters].sort((a,b) => (Number(a.semester_number)||0) - (Number(b.semester_number)||0))
                .map(item => `<option value="${item.id}">${escapeHTML(item.name)}</option>`).join("");
        semester.dataset.ready = "1";
    }

    const body = document.getElementById("videoProgressHistoryTable");
    if (body) body.innerHTML = `<tr><td colspan="13" class="empty-table">Loading permanent history...</td></tr>`;

    try {
        const result = await callAdminRpc("video_progress_history_report", {
            p_academic_year_id: null,
            p_semester_id: null,
            p_student_id: null
        });
        if (!result?.success) throw new Error(result?.message || "Could not load progress history.");
        videoProgressHistoryRows = Array.isArray(result.rows) ? result.rows : [];
        renderVideoProgressHistory();
    } catch (error) {
        if (body) body.innerHTML = `<tr><td colspan="13" class="empty-table">${escapeHTML(error.message || "Could not load progress history.")}</td></tr>`;
    }
}

function closeVideoProgressHistory() {
    const modal = document.getElementById("videoProgressHistoryModal");
    if (modal) modal.classList.add("hidden");
}

function renderVideoProgressHistory() {
    const body = document.getElementById("videoProgressHistoryTable");
    const count = document.getElementById("videoProgressHistoryCount");
    if (!body) return;

    const year = document.getElementById("videoHistoryYear")?.value || "";
    const semester = document.getElementById("videoHistorySemester")?.value || "";
    const studentText = (document.getElementById("videoHistoryStudent")?.value || "").trim().toLowerCase();

    const rows = videoProgressHistoryRows.filter(row => {
        if (year && String(row.academic_year_id) !== String(year)) return false;
        if (semester && String(row.semester_id) !== String(semester)) return false;
        if (studentText) {
            const haystack = `${row.roll_number || ""} ${row.first_name || ""} ${row.last_name || ""} ${row.email || ""}`.toLowerCase();
            if (!haystack.includes(studentText)) return false;
        }
        return true;
    });

    if (count) count.textContent = `Showing ${rows.length} historical video records`;
    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="13" class="empty-table">No permanent progress history found.</td></tr>`;
        return;
    }

    body.innerHTML = rows.map((row, index) => {
        const status = row.completed ? "Completed" :
            ((Number(row.max_watched_seconds) || 0) > 0 || (Number(row.questions_solved) || 0) > 0 ? "In Progress" : "Not Started");
        const student = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "—";
        const semester = row.semester || "—";
        const yearLabel = row.academic_year || "—";
        return `<tr>
            <td>${index + 1}</td>
            <td>${escapeHTML(row.roll_number || "—")}</td>
            <td>${escapeHTML(student)}</td>
            <td>${escapeHTML(row.course_name || "—")}</td>
            <td>${escapeHTML(row.video_title || "—")}</td>
            <td>${escapeHTML(yearLabel)}</td>
            <td>${escapeHTML(semester)}</td>
            <td>${escapeHTML(row.branch_name || "—")}</td>
            <td>${escapeHTML(row.batch_label || "—")}</td>
            <td>${formatProgressTime(row.max_watched_seconds)}</td>
            <td>${Number(row.questions_solved) || 0} / ${Number(row.total_questions) || 0}</td>
            <td>${Number(row.question_attempts) || 0} / ${Number(row.question_correct) || 0}</td>
            <td>${status}</td>
        </tr>`;
    }).join("");
}

/* =====================================================
   ADMIN VIDEO PROGRESS
===================================================== */

/* =====================================================
   CUMULATIVE SCORE / WATCHED-PERCENTAGE METRICS
   -----------------------------------------------------
   Topic Score            = % of the topic's questions answered correctly
   Cumulative Score       = average Topic Score over Topic 1 .. current topic
                            (topics not attempted count as 0)
   Watched %              = max watched time / video length of this topic
   Cumulative Watched %   = average Watched % over Topic 1 .. current topic
   Topics Completed       = topics (1..current) whose video is completed
===================================================== */

// "correct": Topic Score = correct_answers / total_questions
// "solved" : Topic Score = questions_solved / total_questions (every answered question counts)
const VIDEO_TOPIC_SCORE_BASIS = "correct";

let videoProgressMapCache = null;

function getVideoProgressMap() {
    if (!videoProgressMapCache) {
        videoProgressMapCache = new Map(
            videoProgressRecords.map(record => [`${record.student_id}:${record.video_id}`, record])
        );
    }
    return videoProgressMapCache;
}

// Supabase returns at most 1000 rows per request, so large tables are read page by page.
async function fetchAllRows(table, columns, orderColumns) {
    const pageSize = 1000;
    const all = [];
    let from = 0;
    while (true) {
        let query = window.supabaseClient.from(table).select(columns);
        (orderColumns || []).forEach(column => { query = query.order(column, { ascending: true }); });
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) return { data: null, error };
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
    }
    return { data: all, error: null };
}

async function fetchStudentsForProgress() {
    const base = "id, roll_number, first_name, last_name, email, status, batch_id, branch_id";
    // "section" (D1/D2/D3...) is optional - see sql/35_cumulative_report_support.sql
    let result = await fetchAllRows("students", `${base}, section`, ["id"]);
    if (result.error) result = await fetchAllRows("students", base, ["id"]);
    return result;
}

function sortTopicVideos(list) {
    return [...list].sort((a, b) =>
        ((Number(a.display_order) || 0) - (Number(b.display_order) || 0)) ||
        (Number(a.video_id) - Number(b.video_id))
    );
}

// Topic 1 .. the selected topic, inside the same course offering.
function getTopicsUpTo(video) {
    if (!video) return [];
    const sameOffering = sortTopicVideos(
        videoProgressVideos.filter(item => String(item.offering_id) === String(video.offering_id))
    );
    const index = sameOffering.findIndex(item => Number(item.video_id) === Number(video.video_id));
    return index >= 0 ? sameOffering.slice(0, index + 1) : [video];
}

function getKnownDurationSeconds(video) {
    const stored = Number(video?.duration_seconds) || 0;
    if (stored > 0) return stored;
    const cached = Number(videoDurationCache.get(extractYouTubeVideoId(video?.youtube_url))) || 0;
    return cached > 0 ? cached : 0;
}

// Reads missing video lengths from YouTube (3 at a time) and saves them to videos.duration_seconds
// when that column exists, so the lookup happens only once per video.
async function ensureTopicDurations(videos, concurrency = 3) {
    const pending = (videos || []).filter(video => !getKnownDurationSeconds(video));
    let next = 0;
    const worker = async () => {
        while (next < pending.length) {
            const video = pending[next++];
            const seconds = await getVideoDurationSeconds(video);
            if (seconds > 0) {
                const hasColumn = Object.prototype.hasOwnProperty.call(video, "duration_seconds");
                video.duration_seconds = Math.round(seconds);
                if (hasColumn) {
                    try {
                        await window.supabaseClient.from("videos")
                            .update({ duration_seconds: video.duration_seconds })
                            .eq("video_id", video.video_id);
                    } catch (_) { /* best effort */ }
                }
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
}

function computeStudentMetrics(studentId, topics, durations, progressMap) {
    let scoreSum = 0, watchSum = 0, completedCount = 0;
    let current = { score: 0, watchedPct: 0 };

    topics.forEach((topic, index) => {
        const progress = progressMap.get(`${studentId}:${topic.video_id}`);
        const total = Number(progress?.total_questions) || 0;
        const numerator = VIDEO_TOPIC_SCORE_BASIS === "solved"
            ? Number(progress?.questions_solved) || 0
            : Number(progress?.correct_answers) || 0;
        const score = total > 0 ? Math.min(100, (numerator / total) * 100) : 0;

        const watched = Number(progress?.max_watched_seconds) || 0;
        const duration = durations[index];
        const watchedPct = duration > 0
            ? Math.min(100, (watched / duration) * 100)
            : (progress?.completed ? 100 : 0);

        scoreSum += score;
        watchSum += watchedPct;
        if (progress?.completed) completedCount++;
        if (index === topics.length - 1) current = { score, watchedPct };
    });

    const count = topics.length || 1;
    return {
        topicScore: current.score,
        watchedPct: current.watchedPct,
        cumulativeScore: scoreSum / count,
        cumulativeWatchedPct: watchSum / count,
        topicsCompleted: completedCount,
        topicsNotCompleted: topics.length - completedCount,
        topicCount: topics.length
    };
}

function refreshVideoStudentMetrics() {
    if (!selectedVideoStudentRows.length) return;
    const topics = getTopicsUpTo(selectedVideoStudentRows[0].video);
    const durations = topics.map(getKnownDurationSeconds);
    const progressMap = getVideoProgressMap();
    selectedVideoStudentRows.forEach(row => {
        row.metrics = computeStudentMetrics(row.student?.id ?? row.assignment?.student_id, topics, durations, progressMap);
    });
}

function formatScore(value) {
    return String(Math.round(Number(value) || 0));
}

function formatPercent(value) {
    const rounded = Math.round((Number(value) || 0) * 10) / 10;
    return `${rounded}%`;
}

function getStudentSectionLabel(row) {
    return String(row.student?.section || "").trim();
}


async function loadVideoProgress() {
    const table = document.getElementById("videoProgressTable");
    if (table) table.innerHTML = `<tr><td colspan="8" class="empty-table">Loading video progress...</td></tr>`;

    try {
        // Large tables are read page by page (Supabase returns max 1000 rows per request).
        const [progressResult, studentsResult, videosResult, offeringsResult, coursesResult, assignmentsResult] = await Promise.all([
            fetchAllRows("student_video_progress",
                "id, student_id, video_id, max_watched_seconds, questions_solved, total_questions, correct_answers, completed, created_at, updated_at",
                ["id"]),
            fetchStudentsForProgress(),
            fetchAllRows("videos", "*", ["video_id"]),
            window.supabaseClient.from("course_offerings")
                .select("id, course_id, academic_year_id, semester_id, batch_id"),
            window.supabaseClient.from("courses")
                .select("course_id, course_name, course_code"),
            fetchAllRows("v_student_courses",
                "student_id, offering_id, course_id, course_name, course_code, batch_id, academic_year_id, semester_id",
                ["student_id", "offering_id"])
        ]);

        const firstError = [progressResult, studentsResult, videosResult, offeringsResult, coursesResult, assignmentsResult]
            .find(result => result.error);
        if (firstError) throw firstError.error;

        videoProgressMapCache = null;
        videoProgressRecords = progressResult.data || [];
        videoProgressStudents = studentsResult.data || [];
        videoProgressVideos = videosResult.data || [];
        videoProgressCourses = coursesResult.data || [];
        videoProgressAssignments = assignmentsResult.data || [];
        videoProgressBranches = Array.isArray(branches) ? branches : [];
        videoProgressBatches = Array.isArray(batches) ? batches : [];
        videoProgressAcademicYears = Array.isArray(academicYears) ? academicYears : [];
        videoProgressSemesters = Array.isArray(semesters) ? semesters : [];

        // Current Video Progress is limited to each student's current course assignment.
        const currentAssignmentKeys = new Set((videoProgressAssignments || []).map(item => `${item.student_id}:${item.offering_id}`));
        const currentOfferingIds = new Set((videoProgressAssignments || []).map(item => String(item.offering_id)));
        videoProgressVideos = videoProgressVideos.filter(video => currentOfferingIds.has(String(video.offering_id)));

        const offeringCourseMap = new Map((offeringsResult.data || []).map(item => [String(item.id), item.course_id]));
        const courseMap = new Map(videoProgressCourses.map(item => [String(item.course_id), item]));

        // Keep only the latest progress row when duplicate student/video records exist.
        const latestProgress = new Map();
        for (const record of videoProgressRecords) {
            const key = `${record.student_id}:${record.video_id}`;
            const existing = latestProgress.get(key);
            if (!existing || new Date(record.updated_at || record.created_at || 0) > new Date(existing.updated_at || existing.created_at || 0)) {
                latestProgress.set(key, record);
            }
        }
        videoProgressRecords = [...latestProgress.values()].filter(record => {
            const video = videoProgressVideos.find(item => Number(item.video_id) === Number(record.video_id));
            return !!video && currentAssignmentKeys.has(`${record.student_id}:${video.offering_id}`);
        });

        videoProgressRecords = videoProgressRecords.map(record => {
            const student = videoProgressStudents.find(item => item.id === record.student_id);
            const video = videoProgressVideos.find(item => item.video_id === record.video_id);
            const courseId = video ? offeringCourseMap.get(String(video.offering_id)) : null;
            const course = courseId != null ? courseMap.get(String(courseId)) : null;
            return { ...record, _student: student || null, _video: video || null, _course: course || null };
        });

        populateVideoProgressFilters();
        updateVideoProgressSummary();
        filterVideoProgress();
        videoProgressLoaded = true;
    } catch (error) {
        console.error("Video progress error:", error);
        if (table) table.innerHTML = `<tr><td colspan="8" class="empty-table">Unable to load video progress. Check the Supabase permissions for the progress tables and v_student_courses view.</td></tr>`;
    }
}

function populateVideoProgressFilters() {
    const courseSelect = document.getElementById("progressCourseFilter");
    if (!courseSelect) return;
    const currentCourse = courseSelect.value;
    const courses = [...videoProgressCourses].sort((a, b) => String(a.course_name || "").localeCompare(String(b.course_name || "")));
    courseSelect.innerHTML = `<option value="">All Courses</option>` + courses.map(course =>
        `<option value="${escapeHTML(String(course.course_id))}">${escapeHTML(course.course_name || "Untitled Course")}${course.course_code ? ` (${escapeHTML(course.course_code)})` : ""}</option>`
    ).join("");
    courseSelect.value = currentCourse;
}

function getVideoProgressStudentStatus(record) {
    if (record && record.completed) return "completed";
    if (record && ((Number(record.max_watched_seconds) || 0) > 0 || (Number(record.questions_solved) || 0) > 0)) return "in_progress";
    return "not_started";
}

function getVideoProgressCourseForVideo(video) {
    if (!video) return null;
    const assignment = videoProgressAssignments.find(item => String(item.offering_id) === String(video.offering_id));
    if (assignment) return { course_id: assignment.course_id, course_name: assignment.course_name, course_code: assignment.course_code };
    return videoProgressCourses.find(course => String(course.course_id) === String(
        videoProgressAssignments.find(item => String(item.offering_id) === String(video.offering_id))?.course_id
    )) || null;
}

function buildVideoProgressSummaryRows() {
    const progressMap = new Map(videoProgressRecords.map(record => [`${record.student_id}:${record.video_id}`, record]));

    return videoProgressVideos.map(video => {
        const assignments = videoProgressAssignments.filter(item => String(item.offering_id) === String(video.offering_id));
        const uniqueStudents = [...new Map(assignments.map(item => [String(item.student_id), item])).values()];
        let completed = 0, inProgress = 0, notStarted = 0;

        uniqueStudents.forEach(assignment => {
            const progress = progressMap.get(`${assignment.student_id}:${video.video_id}`);
            const status = getVideoProgressStudentStatus(progress);
            if (status === "completed") completed++;
            else if (status === "in_progress") inProgress++;
            else notStarted++;
        });

        return {
            video,
            course: getVideoProgressCourseForVideo(video),
            students: uniqueStudents.length,
            completed,
            inProgress,
            notStarted
        };
    }).sort((a, b) => {
        const order = (Number(a.video.display_order) || 0) - (Number(b.video.display_order) || 0);
        return order || String(a.video.video_title || "").localeCompare(String(b.video.video_title || ""));
    });
}

function filterVideoProgress() {
    const search = String(document.getElementById("progressVideoSearch")?.value || "").trim().toLowerCase();
    const courseId = String(document.getElementById("progressCourseFilter")?.value || "");
    let rows = buildVideoProgressSummaryRows();

    rows = rows.filter(row => {
        const haystack = [row.video.video_title, row.course?.course_name, row.course?.course_code].filter(Boolean).join(" ").toLowerCase();
        if (search && !haystack.includes(search)) return false;
        if (courseId && String(row.course?.course_id ?? "") !== courseId) return false;
        return true;
    });

    renderVideoProgress(rows);
}

function renderVideoProgress(list) {
    const tbody = document.getElementById("videoProgressTable");
    const count = document.getElementById("videoProgressFilterCount");
    if (!tbody) return;
    if (count) count.textContent = `Showing ${list.length} video${list.length === 1 ? "" : "s"}`;

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-table">No videos found.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((row, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><div class="progress-course-cell"><strong>${escapeHTML(row.course?.course_name || "—")}</strong>${row.course?.course_code ? `<span>${escapeHTML(row.course.course_code)}</span>` : ""}</div></td>
            <td><div class="progress-video-name-cell"><strong>${escapeHTML(row.video.video_title || "Untitled Video")}</strong></div></td>
            <td><span class="video-progress-status completed">${row.completed}</span></td>
            <td><span class="video-progress-status in-progress">${row.inProgress}</span></td>
            <td><span class="video-progress-status not-started">${row.notStarted}</span></td>
            <td><strong>${row.students}</strong></td>
            <td><button class="primary-btn video-student-list-btn" data-video-id="${escapeHTML(String(row.video.video_id))}"><span class="inline-icon">${window.ELIcon ? window.ELIcon("users", "") : ""}</span>View Students</button></td>
        </tr>
    `).join("");

    tbody.querySelectorAll(".video-student-list-btn").forEach(button => {
        button.addEventListener("click", () => openVideoStudentProgress(Number(button.dataset.videoId)));
    });
}

function updateVideoProgressSummary() {
    const rows = buildVideoProgressSummaryRows();
    setVideoProgressText("progressVideoCount", rows.length);
    setVideoProgressText("progressCompletedCount", rows.reduce((sum, row) => sum + row.completed, 0));
    setVideoProgressText("progressInProgressCount", rows.reduce((sum, row) => sum + row.inProgress, 0));
    setVideoProgressText("progressNotStartedCount", rows.reduce((sum, row) => sum + row.notStarted, 0));
}

function setVideoProgressText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function clearVideoProgressFiltersHandler() {
    const search = document.getElementById("progressVideoSearch");
    const course = document.getElementById("progressCourseFilter");
    if (search) search.value = "";
    if (course) course.value = "";
    filterVideoProgress();
}

function getVideoStudentContext(videoId) {
    const video = videoProgressVideos.find(item => Number(item.video_id) === Number(videoId));
    if (!video) return null;

    const assignments = [...new Map(
        videoProgressAssignments
            .filter(item => String(item.offering_id) === String(video.offering_id))
            .map(item => [String(item.student_id), item])
    ).values()];

    const progressMap = new Map(videoProgressRecords.map(record => [`${record.student_id}:${record.video_id}`, record]));
    const rows = assignments.map(assignment => {
        const student = videoProgressStudents.find(item => Number(item.id) === Number(assignment.student_id));
        const progress = progressMap.get(`${assignment.student_id}:${videoId}`) || null;
        const status = getVideoProgressStudentStatus(progress);
        const branch = videoProgressBranches.find(item => Number(item.id) === Number(student?.branch_id));
        const batch = videoProgressBatches.find(item => Number(item.id) === Number(assignment.batch_id ?? student?.batch_id));
        const academicYear = videoProgressAcademicYears.find(item => Number(item.id) === Number(assignment.academic_year_id));
        const semester = videoProgressSemesters.find(item => Number(item.id) === Number(assignment.semester_id));
        return {
            videoId: Number(videoId),
            video,
            assignment,
            student: student || { id: assignment.student_id },
            progress,
            status,
            branch,
            batch,
            academicYear,
            semester
        };
    });

    return { video, course: getVideoProgressCourseForVideo(video), rows };
}

function populateVideoStudentFilters(rows) {
    const configs = [
        ["videoStudentBranchFilter", rows.map(row => row.branch).filter(Boolean), "id", item => item.name || item.code || "Branch"],
        ["videoStudentBatchFilter", rows.map(row => row.batch).filter(Boolean), "id", item => item.label || "Batch"],
        ["videoStudentAcademicYearFilter", rows.map(row => row.academicYear).filter(Boolean), "id", item => item.label || "Academic Year"],
        ["videoStudentSemesterFilter", rows.map(row => row.semester).filter(Boolean), "id", item => item.name || `Semester ${item.semester_number ?? ""}`]
    ];
    configs.forEach(([id, values, key, labelFn]) => {
        const select = document.getElementById(id);
        if (!select) return;
        const current = select.value;
        const unique = [...new Map(values.map(item => [String(item[key]), item])).values()]
            .sort((a, b) => String(labelFn(a)).localeCompare(String(labelFn(b))));
        select.innerHTML = `<option value="">All</option>` + unique.map(item => `<option value="${escapeHTML(String(item[key]))}">${escapeHTML(labelFn(item))}</option>`).join("");
        select.value = current;
    });
}

function openVideoStudentProgress(videoId) {
    const context = getVideoStudentContext(videoId);
    if (!context) return;
    selectedVideoProgressVideoId = Number(videoId);
    selectedVideoStudentRows = context.rows;

    const title = document.getElementById("videoStudentProgressTitle");
    const subtitle = document.getElementById("videoStudentProgressSubtitle");
    if (title) title.textContent = context.video.video_title || "Video Students";
    if (subtitle) subtitle.textContent = [context.course?.course_name, context.course?.course_code].filter(Boolean).join(" • ") || "Student progress";

    ["videoStudentSearch", "videoStudentBranchFilter", "videoStudentBatchFilter", "videoStudentAcademicYearFilter", "videoStudentSemesterFilter", "videoStudentStatusFilter"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    populateVideoStudentFilters(selectedVideoStudentRows);
    refreshVideoStudentMetrics();
    renderVideoStudentProgress();
    ensureTopicDurations(getTopicsUpTo(context.video)).then(() => {
        refreshVideoStudentMetrics();
        renderVideoStudentProgress();
    });

    const modal = document.getElementById("videoStudentProgressModal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("progress-modal-open");
    }
}

function closeVideoStudentProgress() {
    const modal = document.getElementById("videoStudentProgressModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("progress-modal-open");
    selectedVideoProgressVideoId = null;
    selectedVideoStudentRows = [];
}

function filterVideoStudentProgress() {
    renderVideoStudentProgress();
}

function getFilteredVideoStudentRows() {
    const search = String(document.getElementById("videoStudentSearch")?.value || "").trim().toLowerCase();
    const branchId = String(document.getElementById("videoStudentBranchFilter")?.value || "");
    const batchId = String(document.getElementById("videoStudentBatchFilter")?.value || "");
    const academicYearId = String(document.getElementById("videoStudentAcademicYearFilter")?.value || "");
    const semesterId = String(document.getElementById("videoStudentSemesterFilter")?.value || "");
    const status = String(document.getElementById("videoStudentStatusFilter")?.value || "");

    return selectedVideoStudentRows.filter(row => {
        const student = row.student || {};
        const searchText = [student.roll_number, student.first_name, student.last_name, student.email].filter(Boolean).join(" ").toLowerCase();
        if (search && !searchText.includes(search)) return false;
        if (branchId && String(row.branch?.id ?? student.branch_id ?? "") !== branchId) return false;
        if (batchId && String(row.batch?.id ?? row.assignment?.batch_id ?? student.batch_id ?? "") !== batchId) return false;
        if (academicYearId && String(row.academicYear?.id ?? row.assignment?.academic_year_id ?? "") !== academicYearId) return false;
        if (semesterId && String(row.semester?.id ?? row.assignment?.semester_id ?? "") !== semesterId) return false;
        if (status && row.status !== status) return false;
        return true;
    });
}

function renderVideoStudentProgress() {
    const rows = getFilteredVideoStudentRows();
    const tbody = document.getElementById("videoStudentProgressTable");
    const count = document.getElementById("videoStudentFilterCount");
    if (count) count.textContent = `Showing ${rows.length} student${rows.length === 1 ? "" : "s"}`;

    const totals = {
        total: selectedVideoStudentRows.length,
        completed: selectedVideoStudentRows.filter(row => row.status === "completed").length,
        inProgress: selectedVideoStudentRows.filter(row => row.status === "in_progress").length,
        notStarted: selectedVideoStudentRows.filter(row => row.status === "not_started").length
    };
    const summary = document.getElementById("videoStudentProgressSummary");
    if (summary) summary.innerHTML = `
        <div><span>Total Students</span><strong>${totals.total}</strong></div>
        <div><span>Completed</span><strong>${totals.completed}</strong></div>
        <div><span>In Progress</span><strong>${totals.inProgress}</strong></div>
        <div><span>Not Started</span><strong>${totals.notStarted}</strong></div>
    `;

    if (!tbody) return;
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="13" class="empty-table">No students match the selected filters.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((row, index) => {
        const student = row.student || {};
        const progress = row.progress || {};
        const metrics = row.metrics || {};
        const name = [student.first_name, student.last_name].filter(Boolean).join(" ") || "—";
        const statusLabel = row.status === "completed" ? "Completed" : row.status === "in_progress" ? "In Progress" : "Not Started";
        const statusClass = row.status === "completed" ? "completed" : row.status === "in_progress" ? "in-progress" : "not-started";
        return `<tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHTML(student.roll_number || "—")}</strong></td>
            <td>${escapeHTML(name)}</td>
            <td>${escapeHTML(student.email || "—")}</td>
            <td class="video-max-watched" data-video-id="${escapeHTML(String(row.videoId))}">${formatVideoWatchedTime(progress.max_watched_seconds, row.videoId)}</td>
            <td>${formatPercent(metrics.watchedPct)}</td>
            <td>${formatPercent(metrics.cumulativeWatchedPct)}</td>
            <td><strong>${formatScore(metrics.topicScore)}</strong></td>
            <td><strong>${formatScore(metrics.cumulativeScore)}</strong></td>
            <td>${metrics.topicsCompleted ?? 0}</td>
            <td>${metrics.topicsNotCompleted ?? 0}</td>
            <td><span class="video-progress-status ${statusClass}">${statusLabel}</span></td>
            <td>${escapeHTML(formatProgressDate(progress.updated_at || progress.created_at))}</td>
        </tr>`;
    }).join("");
}

function clearVideoStudentFiltersHandler() {
    ["videoStudentSearch", "videoStudentBranchFilter", "videoStudentBatchFilter", "videoStudentAcademicYearFilter", "videoStudentSemesterFilter", "videoStudentStatusFilter"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    renderVideoStudentProgress();
}

function getVideoStudentExportRows() {
    return getFilteredVideoStudentRows().map((row, index) => {
        const student = row.student || {};
        const progress = row.progress || {};
        const metrics = row.metrics || {};
        return {
            "S.No": index + 1,
            "Roll No": student.roll_number || "",
            "Student": [student.first_name, student.last_name].filter(Boolean).join(" "),
            "Email": student.email || "",
            "Section": getStudentSectionLabel(row),
            "Max Watched": formatVideoWatchedTime(progress.max_watched_seconds, row.videoId),
            "Topic Watched %": Math.round((metrics.watchedPct || 0) * 10) / 10,
            "Cumulative Watched %": Math.round((metrics.cumulativeWatchedPct || 0) * 10) / 10,
            "Topic Score": Math.round(metrics.topicScore || 0),
            "Cumulative Score (out of 100)": Math.round(metrics.cumulativeScore || 0),
            "Topics Completed": metrics.topicsCompleted ?? 0,
            "Topics Not Completed": metrics.topicsNotCompleted ?? 0,
            "Status": row.status === "completed" ? "Completed" : row.status === "in_progress" ? "In Progress" : "Not Started",
            "Last Updated": formatProgressDate(progress.updated_at || progress.created_at)
        };
    });
}

function getSelectedVideoTitle() {
    return selectedVideoStudentRows[0]?.video?.video_title || "Video Students";
}

function exportVideoStudentsExcel() {
    if (!window.XLSX) { alert("Excel export library is not available."); return; }
    const rows = getVideoStudentExportRows();
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Student Progress");
    XLSX.writeFile(wb, `EduLearn_${sanitizeFilename(getSelectedVideoTitle())}_Student_Progress.xlsx`);
}

function exportVideoStudentsCsv() {
    const rows = getVideoStudentExportRows();
    if (!rows.length) { alert("There are no students to export."); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers, ...rows.map(row => headers.map(header => row[header] ?? ""))]
        .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EduLearn_${sanitizeFilename(getSelectedVideoTitle())}_Student_Progress.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function getVideoReportDate() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

function getReportStatusLabel(status) {
    return status === "completed" ? "Completed" : status === "in_progress" ? "In Progress" : "Not Started";
}

function getReportCss() {
    return `
    @page {
        size: A4 portrait;
        margin: 12mm 11mm 14mm 11mm;
        @bottom-left   { content: "HyFlex Learning"; font: 7px Arial, Helvetica, sans-serif; color: #5b6b82; }
        @bottom-right  { content: "Page " counter(page) " of " counter(pages); font: 7px Arial, Helvetica, sans-serif; color: #5b6b82; }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #1b2a41; font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-size: 9px; line-height: 1.25; }
    .report { width: 100%; max-width: 1040px; margin: 0 auto; padding: 20px 26px 30px; }
    @media print { .report { max-width: none; padding: 0; } }

    /* Letterhead */
    .institute-header { text-align: center; padding-bottom: 7px; border-bottom: 2px solid #24477f; margin-bottom: 10px; }
    .institute-logo { display: block; width: 78%; max-width: 540px; height: auto; margin: 0 auto; }

    /* Title block */
    .report-heading { text-align: center; margin: 0 0 10px; }
    .report-heading .main { color: #24477f; font-size: 14px; font-weight: 700; letter-spacing: .2px; margin-bottom: 4px; }
    .report-heading .topic { color: #0070c0; font-size: 11.5px; font-weight: 700; margin-bottom: 3px; }
    .report-heading .meta { color: #5b6b82; font-size: 8.5px; font-weight: 700; }

    /* Key figures */
    .stats { display: flex; gap: 8px; margin: 0 0 14px; }
    .stat { flex: 1; border: 1px solid #a8c7e2; border-top: 3px solid #24477f; background: #f8fbfd; padding: 6px 4px 5px; text-align: center; }
    .stat .value { display: block; color: #24477f; font-size: 15px; font-weight: 700; line-height: 1.1; }
    .stat .label { display: block; color: #5b6b82; font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; margin-top: 2px; }
    .stat.good { border-top-color: #08783f; } .stat.good .value { color: #08783f; }
    .stat.bad  { border-top-color: #c62828; } .stat.bad .value  { color: #c62828; }

    /* Section headings */
    .section-title { color: #24477f; font-size: 11px; font-weight: 700; margin: 14px 0 7px; padding-left: 7px;
        border-left: 4px solid #24477f; page-break-after: avoid; break-after: avoid; }

    /* Branch bar above each student table */
    .group { margin: 0 0 12px; }
    .group-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; background: #dceaf4;
        border: 1px solid #a8c7e2; border-bottom: 0; border-left: 4px solid #24477f; padding: 4px 8px;
        page-break-after: avoid; break-after: avoid; }
    .group-bar .name { color: #24477f; font-size: 9.5px; font-weight: 700; }
    .group-bar .meta { color: #3a4d6b; font-size: 8px; font-weight: 700; white-space: nowrap; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead { display: table-header-group; }
    th, td { border: 1px solid #a8c7e2; padding: 4px 3px; vertical-align: middle; text-align: center; overflow-wrap: anywhere; }
    th { background: #24477f; color: #fff; font-size: 7.8px; line-height: 1.15; font-weight: 700; letter-spacing: .1px; }
    td { font-size: 8.4px; line-height: 1.15; }
    tbody tr:nth-child(even) td { background: #eaf2f9; }
    tbody tr:nth-child(odd) td { background: #ffffff; }
    td.left, th.left { text-align: left; padding-left: 6px; }
    td.strong { font-weight: 700; color: #24477f; }
    td.roll { font-weight: 700; }
    tr.total-row td { background: #24477f !important; color: #fff; font-weight: 700; font-size: 8.6px; }
    tr { page-break-inside: avoid; break-inside: avoid; }

    .status-completed { color: #08783f; font-weight: 700; }
    .status-progress { color: #c46a00; font-weight: 700; }
    .status-not-started { color: #c62828; font-weight: 700; }

    .footer { text-align: right; color: #111; font-size: 8px; font-weight: 700; margin-top: 12px; padding-top: 5px; border-top: 1px solid #a8c7e2; }
    `;
}

function openReportWindow(documentTitle, css, bodyHtml) {
    const w = window.open("", "_blank", "width=1100,height=900");
    if (!w) {
        alert("Please allow pop-ups to print the report.");
        return false;
    }
    w.document.open();
    w.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHTML(documentTitle)}</title>
<style>${css}</style>
</head>
<body>
<div class="report">${bodyHtml}</div>
<script>
    window.addEventListener("load", () => { setTimeout(() => window.print(), 450); });
<\/script>
</body>
</html>`);
    w.document.close();
    return true;
}

// Resolves video lengths for Topic 1..N and recomputes every student's scores before a report is built.
async function prepareVideoReportData() {
    if (!selectedVideoStudentRows.length) return false;
    await ensureTopicDurations(getTopicsUpTo(selectedVideoStudentRows[0].video));
    refreshVideoStudentMetrics();
    return true;
}

function buildReportHeader(selectedVideo, courseName, semesterName, topicCount, stats, academicYear = "") {
    const esc = value => escapeHTML(value);
    const logoUrl = new URL("assets/iare-logo.jpeg", window.location.href).href;
    const title = `HyFlex Learning  |  ${courseName}  |  ${semesterName}${academicYear ? `  |  AY ${academicYear}` : ""}`;
    const topicTitle = `Topic ${selectedVideo?.display_order || ""}: ${selectedVideo?.video_title || "Video"}`.replace("Topic :", "Topic:");
    const rate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
    return `
    <div class="institute-header">
        <img class="institute-logo" src="${logoUrl}" alt="Institute of Aeronautical Engineering">
    </div>
    <div class="report-heading">
        <div class="main">${esc(title)}</div>
        <div class="topic">${esc(topicTitle)}</div>
        <div class="meta">Cumulative Scores: T 1 to T ${topicCount} &nbsp;|&nbsp; Date: ${getVideoReportDate()}</div>
    </div>
    <div class="stats">
        <div class="stat"><span class="value">${stats.total}</span><span class="label">Total Students</span></div>
        <div class="stat good"><span class="value">${stats.completed}</span><span class="label">Completed</span></div>
        <div class="stat bad"><span class="value">${stats.total - stats.completed}</span><span class="label">Not Completed</span></div>
        <div class="stat"><span class="value">${rate}%</span><span class="label">Completion Rate</span></div>
    </div>`;
}

/* Print Report: (1) Department-wise summary of all branches (completed / not completed),
   then (2) branch-wise student lists with Topic/Cumulative score and watched %. */
async function printVideoStudents() {
    if (!getFilteredVideoStudentRows().length) {
        alert("There are no students to print for the selected filters.");
        return;
    }
    await prepareVideoReportData();

    const contextRows = getFilteredVideoStudentRows();
    const first = contextRows[0];
    const selectedVideo = first.video;
    const semesterName = first.semester?.name || "Semester";
    const course = first.assignment ? getVideoProgressCourseForVideo(selectedVideo) : null;
    const courseName = course?.course_name || "Course";
    const topicCount = first.metrics?.topicCount || 1;
    const topicNo = selectedVideo?.display_order || topicCount;
    const esc = value => escapeHTML(value);
    const academicYear = [...new Set(contextRows.map(row => row.academicYear?.label).filter(Boolean))].join(", ");

    // Group: branch -> section (D1/D2/...; blank when sections are not used)
    const branchGroups = new Map();
    contextRows.forEach(row => {
        const branchKey = String(row.branch?.id ?? row.student?.branch_id ?? "0");
        if (!branchGroups.has(branchKey)) {
            branchGroups.set(branchKey, {
                order: Number(row.branch?.id ?? row.student?.branch_id) || 0,
                name: row.branch?.name || row.branch?.code || "—",
                sections: new Map()
            });
        }
        const group = branchGroups.get(branchKey);
        const sectionKey = getStudentSectionLabel(row);
        if (!group.sections.has(sectionKey)) group.sections.set(sectionKey, []);
        group.sections.get(sectionKey).push(row);
    });
    const orderedBranches = [...branchGroups.values()].sort((a, b) => a.order - b.order);
    const sortedSections = group => [...group.sections.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
    const byRoll = (a, b) => String(a.student?.roll_number || "").localeCompare(String(b.student?.roll_number || ""), undefined, { numeric: true });
    const countCompleted = rows => rows.filter(row => row.status === "completed").length;
    const anySections = contextRows.some(row => getStudentSectionLabel(row));

    const totalStudents = contextRows.length;
    const totalCompleted = countCompleted(contextRows);

    // 1. Department-wise summary (all branches)
    let summaryRows = "";
    orderedBranches.forEach((group, branchIndex) => {
        const sections = sortedSections(group);
        const hasSections = sections.some(([label]) => label);
        sections.forEach(([label, rows], sectionIndex) => {
            const done = countCompleted(rows);
            const span = hasSections ? `rowspan="${sections.length}"` : "";
            summaryRows += `<tr>
                ${sectionIndex === 0 ? `<td class="strong" ${span}>${branchIndex + 1}</td>` : ""}
                ${sectionIndex === 0 ? `<td class="left roll" ${span} ${anySections && !hasSections ? 'colspan="2"' : ""}>${esc(group.name)}</td>` : ""}
                ${anySections && hasSections ? `<td class="roll">${esc(label || "—")}</td>` : ""}
                <td>${rows.length}</td>
                <td class="status-completed">${done}</td>
                <td class="status-not-started">${rows.length - done}</td>
            </tr>`;
        });
    });
    summaryRows += `<tr class="total-row"><td colspan="${anySections ? 3 : 2}">TOTAL</td><td>${totalStudents}</td><td>${totalCompleted}</td><td>${totalStudents - totalCompleted}</td></tr>`;

    // 2. Branch-wise student lists
    let listSections = "";
    orderedBranches.forEach(group => {
        sortedSections(group).forEach(([label, rows]) => {
            const heading = label ? `${group.name} — ${label}` : group.name;
            const done = countCompleted(rows);
            const body = [...rows].sort(byRoll).map((row, index) => {
                const student = row.student || {};
                const metrics = row.metrics || {};
                const statusClass = row.status === "completed" ? "status-completed" : row.status === "in_progress" ? "status-progress" : "status-not-started";
                return `<tr>
                    <td>${index + 1}</td>
                    <td class="roll">${esc(student.roll_number || "")}</td>
                    <td class="left">${esc([student.first_name, student.last_name].filter(Boolean).join(" ") || "—")}</td>
                    <td>${formatPercent(metrics.watchedPct)}</td>
                    <td>${formatPercent(metrics.cumulativeWatchedPct)}</td>
                    <td class="strong">${formatScore(metrics.topicScore)}</td>
                    <td class="strong">${formatScore(metrics.cumulativeScore)}</td>
                    <td>${metrics.topicsCompleted ?? 0}</td>
                    <td>${metrics.topicsNotCompleted ?? 0}</td>
                    <td class="${statusClass}">${getReportStatusLabel(row.status)}</td>
                </tr>`;
            }).join("");
            listSections += `
            <div class="group">
                <div class="group-bar">
                    <span class="name">${esc(heading)}</span>
                    <span class="meta">${rows.length} student${rows.length === 1 ? "" : "s"} &nbsp;•&nbsp; ${done} completed &nbsp;•&nbsp; ${rows.length - done} not completed</span>
                </div>
                <table>
                    <colgroup><col style="width:5%"><col style="width:12%"><col style="width:18%"><col style="width:9%"><col style="width:11%"><col style="width:8%"><col style="width:11%"><col style="width:8%"><col style="width:8%"><col style="width:10%"></colgroup>
                    <thead><tr>
                        <th>S.No</th><th>Roll<br>Number</th><th class="left">Student</th>
                        <th>Topic<br>Watched %</th><th>Cumulative<br>Watched %</th>
                        <th>Topic ${esc(topicNo)}<br>Score</th><th>Cumulative Score<br>(out of 100)</th>
                        <th>Topics<br>Completed</th><th>Topics Not<br>Completed</th><th>Status</th>
                    </tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>`;
        });
    });

    const body = `
    ${buildReportHeader(selectedVideo, courseName, semesterName, topicCount, { total: totalStudents, completed: totalCompleted }, academicYear)}
    <div class="section-title">1. Department-wise Summary</div>
    <table>
        <colgroup><col style="width:8%"><col style="width:${anySections ? 38 : 50}%">${anySections ? '<col style="width:12%">' : ""}<col style="width:14%"><col style="width:14%"><col style="width:14%"></colgroup>
        <thead><tr><th>S.No</th><th class="left">Department</th>${anySections ? "<th>Section</th>" : ""}<th>Total<br>Students</th><th>Completed<br>Students</th><th>Not Completed<br>Students</th></tr></thead>
        <tbody>${summaryRows}</tbody>
    </table>
    <div class="section-title">2. Branch-wise Student Progress</div>
    ${listSections}
    <div class="footer">DEAN- TIPS</div>`;

    openReportWindow(`${courseName} - Topic ${topicNo} Student Progress`, getReportCss(), body);
}

async function getVideoDurationSeconds(video) {
    if (!video) return null;
    const storedDuration = Number(video.duration_seconds) || 0;
    if (storedDuration > 0) return storedDuration;
    const videoId = extractYouTubeVideoId(video.youtube_url);
    if (!videoId) return null;
    if (videoDurationCache.has(videoId)) return videoDurationCache.get(videoId);

    try {
        await ensureYouTubeIframeApi();
        const host = document.createElement("div");
        host.style.position = "fixed";
        host.style.left = "-10000px";
        host.style.top = "-10000px";
        host.style.width = "1px";
        host.style.height = "1px";
        host.id = `video-duration-probe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        document.body.appendChild(host);

        const duration = await new Promise(resolve => {
            let settled = false;
            let probe = null;
            const finish = value => {
                if (settled) return;
                settled = true;
                try { probe?.destroy?.(); } catch (_) {}
                host.remove();
                resolve(value || null);
            };
            try {
                probe = new YT.Player(host.id, {
                    width: 1,
                    height: 1,
                    videoId,
                    playerVars: { controls: 0, rel: 0, modestbranding: 1 },
                    events: {
                        onReady: event => {
                            let seconds = 0;
                            try { seconds = Number(event.target.getDuration() || 0); } catch (_) {}
                            finish(seconds > 0 ? seconds : null);
                        },
                        onError: () => finish(null)
                    }
                });
            } catch (_) {
                finish(null);
            }
            setTimeout(() => finish(null), 10000);
        });

        videoDurationCache.set(videoId, duration);
        return duration;
    } catch (error) {
        console.warn("Unable to load YouTube duration:", error);
        return null;
    }
}

function extractYouTubeVideoId(url) {
    const value = String(url || "").trim();
    const match = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    return match ? match[1] : null;
}

function ensureYouTubeIframeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (window.__eduLearnYTApiPromise) return window.__eduLearnYTApiPromise;

    window.__eduLearnYTApiPromise = new Promise((resolve, reject) => {
        const previous = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            try { previous?.(); } catch (_) {}
            resolve();
        };
        const existing = document.getElementById("youtube-iframe-api-admin-progress");
        if (existing) return;
        const script = document.createElement("script");
        script.id = "youtube-iframe-api-admin-progress";
        script.src = "https://www.youtube.com/iframe_api";
        script.onerror = reject;
        document.head.appendChild(script);
        setTimeout(() => {
            if (window.YT && window.YT.Player) resolve();
            else reject(new Error("YouTube IFrame API timeout"));
        }, 10000);
    });
    return window.__eduLearnYTApiPromise;
}

function formatVideoWatchedTime(seconds, videoId, durationSeconds = null) {
    const watched = formatProgressTime(seconds);
    const duration = durationSeconds ?? getKnownDurationSeconds(
        videoProgressVideos.find(video => Number(video.video_id) === Number(videoId))
    );
    return duration ? `${watched} / ${formatProgressTime(duration)}` : `${watched} / —`;
}
function sanitizeFilename(value) {
    return String(value || "Video").replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "Video";
}

function formatProgressTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
    return `${minutes}m ${String(secs).padStart(2, "0")}s`;
}

function formatProgressDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}



/* =====================================================
   HTML ESCAPING
===================================================== */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}