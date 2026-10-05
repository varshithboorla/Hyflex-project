// courses.js
// Folders (automatic: one ODD + one EVEN folder per academic year)  →  Course offerings  →  Videos
//
// RULES
//   * An academic year has two folders. Odd  = semesters 1,3,5,7   Even = 2,4,6,8
//   * A folder only takes courses of its own type.
//   * A course offering = course + BATCH (+ branches) inside a folder.
//     The batch gives the regulation; batch + folder give the semester.
//   * Students see courses through year + semester + regulation + branch, NOT through folders.

let folders = [];
let courses = [];          // course OFFERINGS (see loadCourses)
let branches = [];
let semesters = [];
let academicYears = [];
let regulations = [];
let batches = [];

let currentFolderId = null;   // null = folders view
let editingFolderId = null;
let editingOfferingId = null;


/* =========================================
   INITIALIZATION
========================================= */

document.addEventListener("DOMContentLoaded", async () => {

    restoreAdminSession();
    setupEvents();

    await loadBranches();
    await loadSemesters();
    await loadAcademicYears();
    await loadRegulations();
    await loadBatches();
    await loadFolders();
    await loadCourses();

    // Reopen a folder if the URL says so: courses.html?folder_id=3
    const urlFolderId =
        Number(new URLSearchParams(window.location.search).get("folder_id"));

    if (urlFolderId && folders.some(f => f.id === urlFolderId)) {
        openFolder(urlFolderId);
    } else {
        showFoldersView();
    }
});


/* =========================================
   EVENTS
========================================= */

function setupEvents() {

    // ----- Folders (created automatically; only the description can be edited) -----
    document
        .getElementById("syncFoldersBtn")
        .addEventListener("click", syncFolders);

    document
        .getElementById("closeFolderModal")
        .addEventListener("click", closeFolderModal);

    document
        .getElementById("cancelFolderModal")
        .addEventListener("click", closeFolderModal);

    document
        .getElementById("saveFolderBtn")
        .addEventListener("click", saveFolder);

    document
        .getElementById("folderModal")
        .addEventListener("click", function (event) {
            if (event.target === this) {
                closeFolderModal();
            }
        });

    document
        .getElementById("backToFolders")
        .addEventListener("click", showFoldersView);

    // ----- Courses -----
    document
        .getElementById("addCourseBtn")
        .addEventListener("click", openAddCourseModal);

    document
        .getElementById("closeCourseModal")
        .addEventListener("click", closeCourseModal);

    document
        .getElementById("cancelCourseModal")
        .addEventListener("click", closeCourseModal);

    document
        .getElementById("saveCourseBtn")
        .addEventListener("click", saveCourse);

    document
        .getElementById("courseSearch")
        .addEventListener("input", filterCourses);

    document
        .getElementById("courseBranchFilter")
        .addEventListener("change", filterCourses);

    document
        .getElementById("courseSemesterFilter")
        .addEventListener("change", filterCourses);

    document
        .getElementById("courseBatchFilter")
        .addEventListener("change", filterCourses);

    document
        .getElementById("courseSemesterInput")
        .addEventListener("change", () => {
            const folder = folders.find(f => f.id === currentFolderId);
            if (folder) {
                renderBatchOptions(folder, [], !!editingOfferingId, selectedSemesterNumber());
            }
        });

    document
        .getElementById("clearCourseFilters")
        .addEventListener("click", clearCourseFilters);

    document
        .getElementById("allBranchesCheckbox")
        .addEventListener("change", toggleAllBranches);

    document
        .getElementById("courseModal")
        .addEventListener("click", function (event) {
            if (event.target === this) {
                closeCourseModal();
            }
        });

    // ----- Logout -----
    document
        .getElementById("adminLogout")
        .addEventListener("click", logoutAdmin);
}


/* =========================================
   ADMIN SESSION
========================================= */

function restoreAdminSession() {

    const storedUser =
        localStorage.getItem("edulearn_user");

    const storedRole =
        localStorage.getItem("edulearn_role");

    if (!storedUser || storedRole !== "admin") {
        window.location.href = "index.html";
        return;
    }

    try {
        const user =
            JSON.parse(storedUser);

        document
            .getElementById("adminEmail")
            .textContent =
            user.email || "";

    } catch (error) {
        localStorage.removeItem("edulearn_user");
        localStorage.removeItem("edulearn_role");
        window.location.href = "index.html";
    }
}


/* =========================================
   LOGOUT
========================================= */

function logoutAdmin() {
    localStorage.removeItem("edulearn_user");
    localStorage.removeItem("edulearn_role");
    window.location.href = "index.html";
}


/* =========================================
   VIEW SWITCHING
========================================= */

function showFoldersView() {

    currentFolderId = null;

    document.getElementById("foldersView").classList.remove("fx-hidden");
    document.getElementById("coursesView").classList.add("fx-hidden");

    document.querySelector(".topbar p").textContent =
        "Every academic year has an Odd and an Even semester folder, created automatically";

    // keep the address bar in sync (no page reload)
    history.replaceState(null, "", "courses.html");

    renderFolders();
}

function openFolder(folderId) {

    const folder =
        folders.find(f => f.id === folderId);

    if (!folder) {
        showFoldersView();
        return;
    }

    currentFolderId = folderId;

    document.getElementById("foldersView").classList.add("fx-hidden");
    document.getElementById("coursesView").classList.remove("fx-hidden");

    document.getElementById("currentFolderTitle").textContent = folder.name;
    document.getElementById("currentFolderCrumb").textContent = folder.name;
    document.getElementById("currentFolderDesc").textContent =
        `Only semesters ${termSemesters(folder.semester_type).join(", ")} ` +
        `can be added here.` +
        (folder.description ? ` ${folder.description}` : "");

    document.querySelector(".topbar p").textContent =
        `Manage courses in ${folder.name}`;

    history.replaceState(null, "", `courses.html?folder_id=${folderId}`);

    // fresh filters every time a folder is opened
    document.getElementById("courseSearch").value = "";
    document.getElementById("courseBranchFilter").value = "";
    document.getElementById("courseBatchFilter").value = "";
    populateSemesterFilter(folder.semester_type);
    populateBatchFilter(folder);

    renderCourses();
}


/* =========================================
   TERM HELPERS  (odd / even)
========================================= */

function yearOf(id) {
    return academicYears.find(y => y.id === id) || null;
}

function startYearOf(year) {
    return year ? Number(String(year.start_date).slice(0, 4)) : null;
}

function monthName(dateString, offsetFallback) {
    if (!dateString) {
        return offsetFallback;
    }
    return new Date(dateString + "T00:00:00")
        .toLocaleString("en-US", { month: "short" });
}

function termMonths(folder) {
    const year = yearOf(folder.academic_year_id);

    return folder.semester_type === "odd"
        ? `${monthName(year && year.start_date, "Jun")} – Dec`
        : `Jan – ${monthName(year && year.end_date, "May")}`;
}

function termSemesters(type) {
    return semesters
        .filter(s => (s.semester_number % 2 === 1) === (type === "odd"))
        .map(s => s.semester_number);
}

function termTitle(type) {
    return type === "odd" ? "Odd Semesters" : "Even Semesters";
}

// Is today inside this folder's term?  (odd = from the year's start month to Dec)
function isRunningNow(folder) {
    const year = yearOf(folder.academic_year_id);

    if (!year || !year.is_current) {
        return false;
    }

    const startMonth = new Date(year.start_date + "T00:00:00").getMonth() + 1;
    const month = new Date().getMonth() + 1;
    const oddNow = month >= startMonth;

    return (folder.semester_type === "odd") === oddNow;
}

// Semester number a batch is in, during a folder (null = not studying then)
function semesterNumberFor(batch, folder) {

    const startYear = startYearOf(yearOf(folder.academic_year_id));

    if (startYear === null) {
        return null;
    }

    const number =
        (startYear - batch.admission_year) * 2 +
        (folder.semester_type === "odd" ? 1 : 2);

    const last = (batch.graduation_year - batch.admission_year) * 2;

    return number >= 1 && number <= last ? number : null;
}

function eligibleBatches(folder) {
    return batches
        .map(batch => ({ batch, number: semesterNumberFor(batch, folder) }))
        .filter(item =>
            item.number !== null &&
            semesters.some(s => s.semester_number === item.number)
        )
        .sort((a, b) => a.number - b.number);
}

function semesterIdByNumber(number) {
    const semester = semesters.find(s => s.semester_number === number);
    return semester ? semester.id : null;
}


/* =========================================
   LOAD FOLDERS
========================================= */

async function loadFolders() {

    const { data, error } = await supabaseClient
        .from("folders")
        .select("id, name, description, academic_year_id, semester_type")
        .order("id");

    if (error) {
        console.error("Error loading folders:", error);

        document.getElementById("foldersGrid").innerHTML = `
            <div class="fx-empty">
                <strong>Could not load folders</strong>
                <p>
                    Make sure you ran sql/20_semester_folders_and_batches.sql in Supabase.
                    (${escapeHtml(error.message || "")})
                </p>
            </div>
        `;
        return;
    }

    folders = data || [];
}

// Safety net: (re)creates the Odd + Even folder of every academic year.
async function syncFolders() {

    const button = document.getElementById("syncFoldersBtn");

    button.disabled = true;

    const { error } = await supabaseClient.rpc("ensure_all_year_folders");

    button.disabled = false;

    if (error) {
        alert(error.message || "Could not sync folders.");
        return;
    }

    await loadFolders();
    renderFolders();
}


/* =========================================
   RENDER FOLDERS  (grouped by academic year)
========================================= */

function courseCountForFolder(folderId) {
    return courses.filter(c => c.folder_id === folderId).length;
}

function renderFolders() {

    const grid =
        document.getElementById("foldersGrid");

    if (folders.length === 0) {
        grid.innerHTML = `
            <div class="fx-empty">
                <strong>No folders yet</strong>
                <p>
                    Folders appear automatically when you add an academic year
                    in Academic Setup (an Odd and an Even folder for each year).
                </p>
            </div>
        `;
        return;
    }

    const yearGroups = academicYears
        .map(year => ({
            year,
            items: folders
                .filter(f => f.academic_year_id === year.id)
                .sort((a, b) => a.semester_type === "odd" ? -1 : 1)
        }))
        .filter(group => group.items.length > 0);

    grid.innerHTML = yearGroups.map(group => `
        <div class="fx-year-title">
            ${escapeHtml(group.year.label)}
            ${group.year.is_current ? `<span class="fx-pill now">current year</span>` : ""}
        </div>
        ${group.items.map(folderCardHtml).join("")}
    `).join("");
}

function folderCardHtml(folder) {

    const count = courseCountForFolder(folder.id);
    const sems  = termSemesters(folder.semester_type).join(", ");

    return `
        <div class="folder-card"
             onclick="openFolder(${folder.id})">

            <div class="folder-card-top">
                <div class="folder-icon ${folder.semester_type === "odd" ? "folder-icon-odd" : "folder-icon-even"}">${window.ELIcon("folder")}</div>
                <div>
                    <h3 class="folder-name">
                        ${termTitle(folder.semester_type)}
                    </h3>
                    <p class="folder-count">
                        ${escapeHtml(termMonths(folder))} ·
                        Sem ${escapeHtml(sems)}
                    </p>
                </div>
            </div>

            <p class="folder-desc">
                ${count} ${count === 1 ? "course" : "courses"}
                ${isRunningNow(folder) ? `<span class="fx-pill now">running now</span>` : ""}
            </p>

            <div class="folder-actions">
                <button
                    class="folder-open"
                    onclick="event.stopPropagation(); openFolder(${folder.id})">
                    Open
                </button>
                <button
                    onclick="event.stopPropagation(); editFolder(${folder.id})">
                    Note
                </button>
            </div>

        </div>
    `;
}


/* =========================================
   FOLDER MODAL  (only the description is editable)
========================================= */

function editFolder(folderId) {

    const folder =
        folders.find(f => f.id === folderId);

    if (!folder) {
        return;
    }

    editingFolderId = folderId;

    document.getElementById("folderModalTitle").textContent = "Folder note";
    document.getElementById("folderNameInput").value = folder.name;
    document.getElementById("folderDescriptionInput").value =
        folder.description || "";

    showFolderMessage("", "error");

    document.getElementById("folderModal").style.display = "flex";
    document.getElementById("folderDescriptionInput").focus();
}

function closeFolderModal() {

    document.getElementById("folderModal").style.display = "none";
    editingFolderId = null;

    showFolderMessage("", "error");
}

function showFolderMessage(message, type = "error") {

    const element =
        document.getElementById("folderModalMessage");

    element.textContent = message;
    element.className = `modal-message ${type}`;
}

async function saveFolder() {

    if (!editingFolderId) {
        return;
    }

    const description =
        document
            .getElementById("folderDescriptionInput")
            .value
            .trim() || null;

    const saveButton =
        document.getElementById("saveFolderBtn");

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {

        const { error } = await supabaseClient
            .from("folders")
            .update({ description })
            .eq("id", editingFolderId);

        if (error) {
            throw error;
        }

        const wasEditing = editingFolderId;

        await loadFolders();

        if (currentFolderId === wasEditing) {
            openFolder(wasEditing);
        } else {
            renderFolders();
        }

        closeFolderModal();

    } catch (error) {

        console.error("Error saving folder:", error);

        showFolderMessage(
            error.message || "Failed to save folder.",
            "error"
        );

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Note";
    }
}


/* =========================================
   LOAD BRANCHES
========================================= */

async function loadBranches() {

    const { data, error } = await supabaseClient
        .from("branches")
        .select("id, name, code")
        .order("name");

    if (error) {
        console.error("Error loading branches:", error);
        return;
    }

    branches = data || [];
    populateBranchDropdowns();
}


/* =========================================
   BRANCH DROPDOWNS
========================================= */

function populateBranchDropdowns() {

    const checkboxList =
        document.getElementById("branchCheckboxList");

    const filter =
        document.getElementById("courseBranchFilter");

    checkboxList.innerHTML = "";

    filter.innerHTML = `
        <option value="">
            All Departments
        </option>
    `;

    branches.forEach(branch => {

        checkboxList.innerHTML += `
            <label class="branch-checkbox-item">
                <input
                    type="checkbox"
                    class="branch-option"
                    value="${branch.id}">
                ${escapeHtml(branch.name)}
                (${escapeHtml(branch.code)})
            </label>
        `;

        filter.innerHTML += `
            <option value="${branch.id}">
                ${escapeHtml(branch.name)}
                (${escapeHtml(branch.code)})
            </option>
        `;
    });
}


/* =========================================
   ALL BRANCHES TOGGLE
========================================= */

function toggleAllBranches() {

    const isAllChecked =
        document
            .getElementById("allBranchesCheckbox")
            .checked;

    const checkboxList =
        document.getElementById("branchCheckboxList");

    checkboxList.classList.toggle(
        "disabled",
        isAllChecked
    );

    if (isAllChecked) {
        checkboxList
            .querySelectorAll(".branch-option")
            .forEach(box => {
                box.checked = false;
            });
    }
}


/* =========================================
   GET SELECTED BRANCH IDS
========================================= */

function getSelectedBranchIds() {
    return Array.from(
        document.querySelectorAll(
            "#branchCheckboxList .branch-option:checked"
        )
    ).map(box => Number(box.value));
}


/* =========================================
   LOAD SEMESTERS
========================================= */

async function loadSemesters() {

    const { data, error } = await supabaseClient
        .from("semesters")
        .select("id, semester_number, name")
        .order("semester_number");

    if (error) {
        console.error("Error loading semesters:", error);
        return;
    }

    semesters = data || [];
    populateSemesterDropdowns();
}


/* =========================================
   SEMESTER FILTER  (only the semesters of the open folder)
========================================= */

function populateSemesterDropdowns() {
    populateSemesterFilter(null);
}

function populateSemesterFilter(type) {

    const filter =
        document.getElementById("courseSemesterFilter");

    filter.innerHTML = `<option value="">All Semesters</option>` +
        semesters
            .filter(s =>
                !type || (s.semester_number % 2 === 1) === (type === "odd"))
            .map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
            .join("");
}


/* =========================================
   LOAD BATCHES
========================================= */

async function loadBatches() {

    const { data, error } = await supabaseClient
        .from("batches")
        .select("id, label, admission_year, graduation_year, regulation_id")
        .order("admission_year", { ascending: false });

    if (error) {
        console.error("Error loading batches:", error);
        return;
    }

    batches = data || [];
}

function populateBatchFilter(folder) {

    const filter =
        document.getElementById("courseBatchFilter");

    filter.innerHTML = `<option value="">All Batches</option>` +
        eligibleBatches(folder)
            .map(({ batch, number }) => `
                <option value="${batch.id}">
                    ${escapeHtml(batch.label)} (Sem ${number})
                </option>
            `)
            .join("");
}


/* =========================================
   LOAD ACADEMIC YEARS
========================================= */

async function loadAcademicYears() {

    const { data, error } = await supabaseClient
        .from("academic_years")
        .select("id, label, is_current, start_date")
        .order("start_date", { ascending: false });

    if (error) {
        console.error("Error loading academic years:", error);
        return;
    }

    academicYears = data || [];
    populateAcademicYearDropdowns();
}

function populateAcademicYearDropdowns() {
    // years are only needed to label folders and work out semesters
}


/* =========================================
   LOAD REGULATIONS
========================================= */

async function loadRegulations() {

    const { data, error } = await supabaseClient
        .from("regulations")
        .select("id, code, name")
        .order("code");

    if (error) {
        console.error("Error loading regulations:", error);
        return;
    }

    regulations = data || [];
    populateRegulationDropdowns();
}

function populateRegulationDropdowns() {
    // regulation now comes from the batch
}


/* =========================================
   LOAD COURSES

   `courses` holds COURSE OFFERINGS:
   course + academic year + regulation + semester + branches.
   Each card on the page is one offering.
========================================= */

async function loadCourses() {

    const { data, error } = await supabaseClient
        .from("course_offerings")
        .select(`
            id,
            course_id,
            academic_year_id,
            regulation_id,
            semester_id,
            folder_id,
            batch_id,
            is_published,
            created_at,
            courses ( course_name, course_code ),
            course_offering_branches ( branch_id )
        `)
        .order("id", {
            ascending: false
        });

    if (error) {
        console.error("Error loading courses:", error);
        showCourseMessage(
            "Failed to load courses.",
            "error"
        );
        return;
    }

    courses = (data || []).map(row => {

        const branchIds =
            (row.course_offering_branches || [])
                .map(link => link.branch_id);

        return {
            offering_id: row.id,
            course_id: row.course_id,
            course_name: row.courses?.course_name || "(unnamed course)",
            course_code: row.courses?.course_code || null,
            folder_id: row.folder_id,
            batch_id: row.batch_id,
            academic_year_id: row.academic_year_id,
            regulation_id: row.regulation_id,
            semester_id: row.semester_id,
            is_published: row.is_published,
            branch_ids: branchIds,
            all_branches:
                branches.length > 0 &&
                branches.every(branch => branchIds.includes(branch.id))
        };
    });

    // keep folder counts and the open folder's list up to date
    if (currentFolderId) {
        filterCourses();
    } else {
        renderFolders();
    }
}


/* =========================================
   COURSES OF THE OPEN FOLDER
========================================= */

function coursesInCurrentFolder() {
    return courses.filter(
        course => course.folder_id === currentFolderId
    );
}


/* =========================================
   RENDER COURSES
========================================= */

function renderCourses() {
    renderFilteredCourses(coursesInCurrentFolder());
}


/* =========================================
   FILTER COURSES
========================================= */

function filterCourses() {

    const search =
        document
            .getElementById("courseSearch")
            .value
            .trim()
            .toLowerCase();

    const branchId =
        document
            .getElementById("courseBranchFilter")
            .value;

    const semesterId =
        document
            .getElementById("courseSemesterFilter")
            .value;

    const batchId =
        document
            .getElementById("courseBatchFilter")
            .value;

    const filtered =
        coursesInCurrentFolder().filter(course => {

            const matchesSearch =
                !search ||
                course.course_name
                    .toLowerCase()
                    .includes(search);

            const matchesBranch =
                !branchId ||
                course.branch_ids.includes(Number(branchId));

            const matchesSemester =
                !semesterId ||
                String(course.semester_id) === semesterId;

            const matchesBatch =
                !batchId ||
                String(course.batch_id) === batchId;

            return (
                matchesSearch &&
                matchesBranch &&
                matchesSemester &&
                matchesBatch
            );
        });

    renderFilteredCourses(filtered);
}


/* =========================================
   CLEAR FILTERS
========================================= */

function clearCourseFilters() {

    document.getElementById("courseSearch").value = "";
    document.getElementById("courseBranchFilter").value = "";
    document.getElementById("courseSemesterFilter").value = "";
    document.getElementById("courseBatchFilter").value = "";

    renderCourses();
}


/* =========================================
   RENDER COURSE BRANCHES
========================================= */

function renderCourseBranches(course) {

    if (course.all_branches) {
        return `<span class="course-branch-tag all">All Branches</span>`;
    }

    if (course.branch_ids.length === 0) {
        return "";
    }

    return course.branch_ids
        .map(branchId => {

            const branch =
                branches.find(
                    branch => branch.id === branchId
                );

            return branch
                ? `<span class="course-branch-tag">${escapeHtml(branch.code)}</span>`
                : "";
        })
        .join("");
}


/* =========================================
   RENDER FILTERED COURSES
========================================= */

function renderFilteredCourses(filteredCourses) {

    const grid =
        document.getElementById("coursesGrid");

    grid.innerHTML = "";

    if (filteredCourses.length === 0) {

        const folderIsEmpty =
            coursesInCurrentFolder().length === 0;

        grid.innerHTML = `
            <div class="courses-grid empty">
                <div class="empty-state-message">
                    <strong>
                        ${folderIsEmpty
                            ? "No courses in this folder yet"
                            : "No courses found"}
                    </strong>
                    <p>
                        ${folderIsEmpty
                            ? "Click “+ Add Course” to create the first one"
                            : "Try adjusting your filters or add a new course"}
                    </p>
                </div>
            </div>
        `;

        return;
    }

    filteredCourses.forEach(course => {

        const semester =
            semesters.find(
                semester => semester.id === course.semester_id
            );

        const batch =
            batches.find(
                batch => batch.id === course.batch_id
            );

        const regulation =
            regulations.find(
                regulation => regulation.id === course.regulation_id
            );

        const card =
            document.createElement("div");

        card.className = "course-card";

        card.innerHTML = `
            <div class="course-card-header">
                <h3 class="course-card-title">
                    ${escapeHtml(course.course_name)}
                </h3>
                ${course.is_published
                    ? ""
                    : `<span class="course-branch-tag">Draft</span>`}
            </div>

            <div class="course-card-meta">

                <div class="course-meta-item">
                    <span class="course-meta-label">Batch:</span>
                    <span class="course-meta-value">
                        ${batch ? escapeHtml(batch.label) : "Unknown"}
                    </span>
                </div>

                <div class="course-meta-item">
                    <span class="course-meta-label">Regulation:</span>
                    <span class="course-meta-value">
                        ${regulation ? escapeHtml(regulation.code) : "Unknown"}
                    </span>
                </div>

                <div class="course-meta-item">
                    <span class="course-meta-label">Semester:</span>
                    <span class="course-meta-value">
                        ${semester
                            ? escapeHtml(semester.name)
                            : "Unknown"
                        }
                    </span>
                </div>

                <div class="course-meta-item">
                    <span class="course-meta-label">Branches:</span>
                    <div class="course-branches">
                        ${renderCourseBranches(course)}
                    </div>
                </div>

            </div>

            <div class="course-card-actions">

                <button
                    class="course-action-primary"
                    onclick="viewCourseVideos(${course.offering_id})">
                    Videos
                </button>

                <button
                    class="course-action-secondary"
                    onclick="editCourse(${course.offering_id})">
                    Edit
                </button>

                <button
                    class="course-action-danger"
                    onclick="deleteCourse(${course.offering_id})">
                    Delete
                </button>

            </div>
        `;

        grid.appendChild(card);
    });
}


/* =========================================
   BATCH LIST INSIDE THE COURSE MODAL
   Add  : tick one or more batches (one offering per batch)
   Edit : pick exactly one batch
========================================= */

function renderBatchOptions(folder, selectedIds, single, semesterNumber) {

    const box =
        document.getElementById("batchOptionList");

    if (!semesterNumber) {
        box.innerHTML = `<p class="field-hint">Select a semester first.</p>`;
        return;
    }

    const items = eligibleBatches(folder)
        .filter(item => item.number === semesterNumber);


    if (items.length === 0) {
        box.innerHTML = `
            <p class="field-hint">
                No batch is studying this semester in this folder. Add batches in Academic Setup.
            </p>`;
        return;
    }

    box.innerHTML = items.map(({ batch, number }) => {

        const regulation =
            regulations.find(r => r.id === batch.regulation_id);

        return `
            <label class="branch-checkbox-item">
                <input
                    type="${single ? "radio" : "checkbox"}"
                    name="courseBatchChoice"
                    class="batch-option"
                    value="${batch.id}"
                    ${selectedIds.includes(batch.id) || items.length === 1 ? "checked" : ""}>
                ${escapeHtml(batch.label)}
                — Semester ${number ?? "?"}
                ${regulation ? `(${escapeHtml(regulation.code)})` : ""}
            </label>
        `;
    }).join("");
}

function selectedSemesterNumber() {
    const id = Number(document.getElementById("courseSemesterInput").value);
    const semester = semesters.find(s => s.id === id);
    return semester ? semester.semester_number : null;
}

function populateCourseSemesterSelect(folder, selectedNumber) {

    const select = document.getElementById("courseSemesterInput");

    select.innerHTML = `<option value="">Select Semester</option>` +
        semesters
            .filter(s => (s.semester_number % 2 === 1) === (folder.semester_type === "odd"))
            .map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
            .join("");

    const chosen = semesters.find(s => s.semester_number === selectedNumber);
    select.value = chosen ? chosen.id : "";
}

function getSelectedBatchIds() {
    return Array.from(
        document.querySelectorAll("#batchOptionList .batch-option:checked")
    ).map(box => Number(box.value));
}

function showFolderInModal(folder) {

    document.getElementById("courseFolderLabel").textContent =
        `${folder.name}  —  ${termTitle(folder.semester_type)} ` +
        `(Sem ${termSemesters(folder.semester_type).join(", ")})`;

    populateCourseNameList();
}

// existing course names, so the same subject is reused, not duplicated
async function populateCourseNameList() {

    const { data } = await supabaseClient
        .from("courses")
        .select("course_name")
        .order("course_name");

    const names = [...new Set((data || []).map(row => row.course_name))];

    document.getElementById("courseNameList").innerHTML =
        names.map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
}


/* =========================================
   OPEN ADD COURSE MODAL
========================================= */

function openAddCourseModal() {

    const folder =
        folders.find(f => f.id === currentFolderId);

    if (!folder) {
        return;
    }

    editingOfferingId = null;

    document
        .getElementById("courseModalTitle")
        .textContent = "Add Course";

    showFolderInModal(folder);
    populateCourseSemesterSelect(folder, null);
    renderBatchOptions(folder, [], false, null);

    document.getElementById("courseNameInput").value = "";
    document.getElementById("coursePublishedInput").checked = true;
    document.getElementById("allBranchesCheckbox").checked = false;

    document
        .querySelectorAll(".branch-option")
        .forEach(box => {
            box.checked = false;
        });

    document
        .getElementById("branchCheckboxList")
        .classList.remove("disabled");

    document
        .getElementById("courseModalMessage")
        .textContent = "";

    document
        .getElementById("courseModal")
        .style.display = "flex";
}


/* =========================================
   EDIT COURSE  (editing one offering)
========================================= */

function editCourse(offeringId) {

    const course =
        courses.find(
            course => course.offering_id === offeringId
        );

    const folder =
        course && folders.find(f => f.id === course.folder_id);

    if (!course || !folder) {
        return;
    }

    editingOfferingId = offeringId;

    document
        .getElementById("courseModalTitle")
        .textContent = "Edit Course";

    showFolderInModal(folder);
    const editBatch = batches.find(b => b.id === course.batch_id);
    const editNumber = editBatch ? semesterNumberFor(editBatch, folder) : null;
    populateCourseSemesterSelect(folder, editNumber);
    renderBatchOptions(folder, [course.batch_id], true, editNumber);

    document.getElementById("courseNameInput").value = course.course_name;
    document.getElementById("coursePublishedInput").checked = course.is_published;
    document.getElementById("allBranchesCheckbox").checked = course.all_branches;

    document
        .querySelectorAll(".branch-option")
        .forEach(box => {
            box.checked =
                !course.all_branches &&
                course.branch_ids.includes(
                    Number(box.value)
                );
        });

    document
        .getElementById("branchCheckboxList")
        .classList.toggle(
            "disabled",
            course.all_branches
        );

    document
        .getElementById("courseModalMessage")
        .textContent = "";

    document
        .getElementById("courseModal")
        .style.display = "flex";
}


/* =========================================
   COURSE HELPERS
========================================= */

// Find the course (subject) by name, or create it. A subject is shared by
// every folder / year / batch, so it is only ever created once.
async function resolveCourse(courseName) {

    const { data: existing, error } =
        await supabaseClient
            .from("courses")
            .select("course_id")
            .ilike("course_name", courseName.replace(/[%_]/g, "\\$&"))
            .order("course_id")
            .limit(1);

    if (error) {
        throw error;
    }

    if (existing && existing.length > 0) {
        return { courseId: existing[0].course_id, created: false };
    }

    const { data: inserted, error: insertError } =
        await supabaseClient
            .from("courses")
            .insert({ course_name: courseName })
            .select("course_id")
            .single();

    if (insertError) {
        throw insertError;
    }

    return { courseId: inserted.course_id, created: true };
}

// Delete a course (subject) once no offering uses it any more.
async function removeCourseIfUnused(courseId) {

    const { count, error } =
        await supabaseClient
            .from("course_offerings")
            .select("id", { count: "exact", head: true })
            .eq("course_id", courseId);

    if (error || (count || 0) > 0) {
        return;
    }

    const { error: deleteError } =
        await supabaseClient
            .from("courses")
            .delete()
            .eq("course_id", courseId);

    if (deleteError) {
        console.warn("Could not remove unused course:", deleteError);
    }
}

// Delete rows from a table where a column is in a list; throws on error.
async function deleteWhereIn(table, column, values) {

    if (!values || values.length === 0) {
        return;
    }

    const { error } =
        await supabaseClient
            .from(table)
            .delete()
            .in(column, values);

    if (error) {
        throw error;
    }
}

function friendlyOfferingError(error) {

    if (error && error.code === "23505") {
        return "already has this course for that batch in this academic year";
    }

    return (error && error.message) || "could not be saved";
}


/* =========================================
   SAVE COURSE  (creates / updates offerings)
========================================= */

async function saveCourse() {

    const folder =
        folders.find(f => f.id === currentFolderId);

    const courseName =
        document
            .getElementById("courseNameInput")
            .value
            .trim();

    const allBranches =
        document
            .getElementById("allBranchesCheckbox")
            .checked;

    const isPublished =
        document
            .getElementById("coursePublishedInput")
            .checked;

    const branchIds =
        allBranches
            ? branches.map(branch => branch.id)
            : getSelectedBranchIds();

    const batchIds = getSelectedBatchIds();

    if (!folder) {
        showCourseMessage("Open a folder first.", "error");
        return;
    }

    if (!courseName) {
        showCourseMessage("Please enter the course name.", "error");
        return;
    }

    if (!selectedSemesterNumber()) {
        showCourseMessage("Please select a semester.", "error");
        return;
    }

    if (batchIds.length === 0) {
        showCourseMessage("Please select a batch.", "error");
        return;
    }

    if (branchIds.length === 0) {
        showCourseMessage(
            "Please select at least one branch, or check \"All Branches\".",
            "error"
        );
        return;
    }

    // semester for each batch comes from batch + folder
    const plan = [];

    for (const batchId of batchIds) {

        const batch = batches.find(b => b.id === batchId);
        const number = batch ? semesterNumberFor(batch, folder) : null;
        const semesterId = number ? semesterIdByNumber(number) : null;

        if (number !== selectedSemesterNumber()) {
            showCourseMessage("The batch does not belong to the selected semester.", "error");
            return;
        }

        if (!semesterId) {
            showCourseMessage(
                `Batch ${batch ? batch.label : ""} is not studying in this folder.`,
                "error"
            );
            return;
        }

        plan.push({ batch, semesterId });
    }

    const saveButton =
        document.getElementById("saveCourseBtn");

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {

        const { courseId, created } =
            await resolveCourse(courseName);

        if (editingOfferingId) {

            /* ---------- EDIT (one offering) ---------- */

            const current =
                courses.find(
                    course => course.offering_id === editingOfferingId
                );

            const { batch, semesterId } = plan[0];

            const { error } =
                await supabaseClient
                    .from("course_offerings")
                    .update({
                        course_id: courseId,
                        batch_id: batch.id,
                        regulation_id: batch.regulation_id,
                        semester_id: semesterId,
                        is_published: isPublished
                    })
                    .eq("id", editingOfferingId);

            if (error) {
                if (created) {
                    await removeCourseIfUnused(courseId);
                }
                throw error;
            }

            // Only touch the branch links that actually changed
            const oldIds = current ? current.branch_ids : [];

            const toRemove =
                oldIds.filter(id => !branchIds.includes(id));

            const toAdd =
                branchIds.filter(id => !oldIds.includes(id));

            if (toRemove.length > 0) {

                const { error: removeError } =
                    await supabaseClient
                        .from("course_offering_branches")
                        .delete()
                        .eq("offering_id", editingOfferingId)
                        .in("branch_id", toRemove);

                if (removeError) {
                    throw removeError;
                }
            }

            if (toAdd.length > 0) {

                const { error: addError } =
                    await supabaseClient
                        .from("course_offering_branches")
                        .insert(
                            toAdd.map(branchId => ({
                                offering_id: editingOfferingId,
                                branch_id: branchId
                            }))
                        );

                if (addError) {
                    throw addError;
                }
            }

            // The old course may now be unused (renamed)
            if (current && current.course_id !== courseId) {
                await removeCourseIfUnused(current.course_id);
            }

            showCourseMessage("Course updated successfully.", "success");

        } else {

            /* ---------- ADD (one offering per batch) ---------- */

            const done = [];
            const failed = [];

            for (const { batch, semesterId } of plan) {

                const { data: offering, error } =
                    await supabaseClient
                        .from("course_offerings")
                        .insert({
                            course_id: courseId,
                            folder_id: folder.id,
                            academic_year_id: folder.academic_year_id,
                            batch_id: batch.id,
                            regulation_id: batch.regulation_id,
                            semester_id: semesterId,
                            is_published: isPublished
                        })
                        .select("id")
                        .single();

                if (error) {
                    failed.push(`${batch.label}: ${friendlyOfferingError(error)}`);
                    continue;
                }

                const { error: linksError } =
                    await supabaseClient
                        .from("course_offering_branches")
                        .insert(
                            branchIds.map(branchId => ({
                                offering_id: offering.id,
                                branch_id: branchId
                            }))
                        );

                if (linksError) {

                    // roll back so we don't leave a course with no branches
                    await supabaseClient
                        .from("course_offerings")
                        .delete()
                        .eq("id", offering.id);

                    failed.push(`${batch.label}: ${friendlyOfferingError(linksError)}`);
                    continue;
                }

                done.push(batch.label);
            }

            if (done.length === 0) {
                if (created) {
                    await removeCourseIfUnused(courseId);
                }
                showCourseMessage(failed.join(" | "), "error");
                return;
            }

            if (failed.length > 0) {
                showCourseMessage(
                    `Created for ${done.join(", ")}. Skipped — ${failed.join(" | ")}`,
                    "error"
                );
                await loadCourses();
                return;
            }

            showCourseMessage(
                `Course created for ${done.join(", ")}.`,
                "success"
            );
        }

        await loadCourses();

        setTimeout(() => {
            closeCourseModal();
        }, 700);

    } catch (error) {

        console.error(
            "Error saving course:",
            error
        );

        showCourseMessage(
            friendlyOfferingError(error),
            "error"
        );

    } finally {

        saveButton.disabled = false;
        saveButton.textContent = "Save Course";
    }
}


/* =========================================
   DELETE COURSE  (deletes one offering)
========================================= */

async function deleteCourse(offeringId) {

    const course =
        courses.find(
            course => course.offering_id === offeringId
        );

    if (!course) {
        return;
    }

    const batch =
        batches.find(
            batch => batch.id === course.batch_id
        );

    const confirmed =
        confirm(
            `Delete "${course.course_name}"` +
            `${batch ? ` (batch ${batch.label})` : ""}?\n\n` +
            `All videos, questions and student progress for this ` +
            `offering will also be deleted.`
        );

    if (!confirmed) {
        return;
    }

    try {

        // 1. Videos of this offering and everything hanging off them
        const { data: videoRows, error: videosError } =
            await supabaseClient
                .from("videos")
                .select("video_id")
                .eq("offering_id", offeringId);

        if (videosError) {
            throw videosError;
        }

        const videoIds =
            (videoRows || []).map(row => row.video_id);

        if (videoIds.length > 0) {

            const { data: questionRows, error: questionsError } =
                await supabaseClient
                    .from("video_questions")
                    .select("question_id")
                    .in("video_id", videoIds);

            if (questionsError) {
                throw questionsError;
            }

            const questionIds =
                (questionRows || []).map(row => row.question_id);

            await deleteWhereIn("student_question_attempts", "video_id", videoIds);
            await deleteWhereIn("question_options", "question_id", questionIds);
            await deleteWhereIn("video_questions", "video_id", videoIds);
            await deleteWhereIn("video_skips", "video_id", videoIds);
            await deleteWhereIn("student_video_progress", "video_id", videoIds);
            await deleteWhereIn("videos", "video_id", videoIds);
        }

        // 2. Branch links, then the offering itself
        const { error: linksError } =
            await supabaseClient
                .from("course_offering_branches")
                .delete()
                .eq("offering_id", offeringId);

        if (linksError) {
            throw linksError;
        }

        const { error } =
            await supabaseClient
                .from("course_offerings")
                .delete()
                .eq("id", offeringId);

        if (error) {
            throw error;
        }

        // 3. Remove the course itself if no other year uses it
        await removeCourseIfUnused(course.course_id);

        await loadCourses();

        alert("Course deleted successfully.");

    } catch (error) {

        console.error(
            "Error deleting course:",
            error
        );

        alert(
            error.message ||
            "Failed to delete course."
        );
    }
}


/* =========================================
   VIEW COURSE VIDEOS
========================================= */

function viewCourseVideos(offeringId) {
    window.location.href =
        `videos.html?offering_id=${offeringId}`;
}


/* =========================================
   CLOSE COURSE MODAL
========================================= */

function closeCourseModal() {

    document
        .getElementById("courseModal")
        .style.display = "none";

    editingOfferingId = null;

    document
        .getElementById("courseModalMessage")
        .textContent = "";
}


/* =========================================
   SHOW MODAL MESSAGE
========================================= */

function showCourseMessage(
    message,
    type = "error"
) {

    const element =
        document.getElementById(
            "courseModalMessage"
        );

    element.textContent = message;
    element.className =
        `modal-message ${type}`;
}


/* =========================================
   FORMAT DATE
========================================= */

function formatDate(dateString) {

    if (!dateString) {
        return "-";
    }

    const date =
        new Date(dateString);

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================
   ESCAPE HTML
========================================= */

function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}