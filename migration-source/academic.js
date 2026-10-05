// academic.js
// Manage academic years, regulations and batches.

let academicYears = [];
let regulations = [];
let batches = [];
let batchStudentCounts = {};

let editingBatchId = null;


/* =========================================
   INITIALIZATION
========================================= */

document.addEventListener("DOMContentLoaded", async () => {

    restoreAdminSession();
    setupEvents();

    await loadAll();
});

async function loadAll() {
    await loadAcademicYears();
    await loadRegulations();
    await loadBatches();
}


/* =========================================
   ADMIN SESSION (same as the other admin pages)
========================================= */

function restoreAdminSession() {

    const storedUser = localStorage.getItem("edulearn_user");
    const storedRole = localStorage.getItem("edulearn_role");

    if (!storedUser || storedRole !== "admin") {
        window.location.href = "index.html";
        return;
    }

    try {
        const user = JSON.parse(storedUser);
        document.getElementById("adminEmail").textContent = user.email || "";
    } catch (error) {
        localStorage.removeItem("edulearn_user");
        localStorage.removeItem("edulearn_role");
        window.location.href = "index.html";
    }
}

function logoutAdmin() {
    localStorage.removeItem("edulearn_user");
    localStorage.removeItem("edulearn_role");
    window.location.href = "index.html";
}


/* =========================================
   EVENTS
========================================= */

function setupEvents() {

    document.getElementById("adminLogout").addEventListener("click", logoutAdmin);

    // academic years
    document.getElementById("addYearBtn").addEventListener("click", openYearModal);
    document.getElementById("closeYearModal").addEventListener("click", closeYearModal);
    document.getElementById("cancelYearModal").addEventListener("click", closeYearModal);
    document.getElementById("saveYearBtn").addEventListener("click", saveYear);

    // regulations
    document.getElementById("addRegulationBtn").addEventListener("click", openRegulationModal);
    document.getElementById("closeRegulationModal").addEventListener("click", closeRegulationModal);
    document.getElementById("cancelRegulationModal").addEventListener("click", closeRegulationModal);
    document.getElementById("saveRegulationBtn").addEventListener("click", saveRegulation);

    // batches
    document.getElementById("addBatchBtn").addEventListener("click", () => openBatchModal(null));
    document.getElementById("closeBatchModal").addEventListener("click", closeBatchModal);
    document.getElementById("cancelBatchModal").addEventListener("click", closeBatchModal);
    document.getElementById("saveBatchBtn").addEventListener("click", saveBatch);

    // click on the dark background closes a modal
    ["yearModal", "regulationModal", "batchModal"].forEach(id => {
        document.getElementById(id).addEventListener("click", function (event) {
            if (event.target === this) {
                this.style.display = "none";
            }
        });
    });
}


/* =========================================
   SMALL HELPERS
========================================= */

function showMessage(elementId, message, type = "error") {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `modal-message ${type}`;
}

function explainError(error, fallback) {

    if (error && error.code === "23503") {
        return "This is still in use (students, courses or batches refer to it), so it cannot be deleted.";
    }

    if (error && error.code === "23505") {
        return "This already exists.";
    }

    return (error && error.message) || fallback;
}

function formatDate(value) {

    if (!value) {
        return "-";
    }

    return new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

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


/* =========================================
   ACADEMIC YEARS
========================================= */

async function loadAcademicYears() {

    const { data, error } = await supabaseClient
        .from("academic_years")
        .select("id, label, start_date, end_date, is_current")
        .order("start_date", { ascending: false });

    if (error) {
        console.error("Error loading academic years:", error);
        document.getElementById("yearsTable").innerHTML =
            `<tr><td colspan="5" class="as-empty">Could not load academic years (${escapeHtml(error.message)}).</td></tr>`;
        return;
    }

    academicYears = data || [];
    renderYears();
}

function renderYears() {

    const tbody = document.getElementById("yearsTable");

    if (academicYears.length === 0) {
        tbody.innerHTML =
            `<tr><td colspan="5" class="as-empty">No academic years yet. Add one and mark it as current.</td></tr>`;
        return;
    }

    tbody.innerHTML = academicYears.map(year => `
        <tr>
            <td><strong>${escapeHtml(year.label)}</strong></td>
            <td>${formatDate(year.start_date)}</td>
            <td>${formatDate(year.end_date)}</td>
            <td>${year.is_current ? `<span class="as-badge">Current</span>` : "-"}</td>
            <td>
                <div class="as-actions">
                    ${year.is_current
                        ? ""
                        : `<button onclick="setCurrentYear(${year.id})">Set as current</button>`}
                    <button class="as-danger" onclick="deleteYear(${year.id})">Delete</button>
                </div>
            </td>
        </tr>
    `).join("");
}

function openYearModal() {

    document.getElementById("yearLabelInput").value = "";
    document.getElementById("yearStartInput").value = "";
    document.getElementById("yearEndInput").value = "";
    document.getElementById("yearCurrentInput").checked = academicYears.length === 0;

    showMessage("yearMessage", "");

    document.getElementById("yearModal").style.display = "flex";
    document.getElementById("yearLabelInput").focus();
}

function closeYearModal() {
    document.getElementById("yearModal").style.display = "none";
}

async function makeOnlyCurrent(yearId) {

    // only one year may be current, so clear the others first
    const { error: clearError } = await supabaseClient
        .from("academic_years")
        .update({ is_current: false })
        .eq("is_current", true);

    if (clearError) {
        throw clearError;
    }

    const { error } = await supabaseClient
        .from("academic_years")
        .update({ is_current: true })
        .eq("id", yearId);

    if (error) {
        throw error;
    }
}

async function saveYear() {

    const label = document.getElementById("yearLabelInput").value.trim();
    const start = document.getElementById("yearStartInput").value;
    const end = document.getElementById("yearEndInput").value;
    const makeCurrent = document.getElementById("yearCurrentInput").checked;

    if (!label || !start || !end) {
        showMessage("yearMessage", "Please fill the label, start date and end date.");
        return;
    }

    if (end <= start) {
        showMessage("yearMessage", "The end date must be after the start date.");
        return;
    }

    const button = document.getElementById("saveYearBtn");
    button.disabled = true;

    try {

        const { data, error } = await supabaseClient
            .from("academic_years")
            .insert({
                label,
                start_date: start,
                end_date: end,
                is_current: false
            })
            .select("id")
            .single();

        if (error) {
            throw error;
        }

        if (makeCurrent) {
            await makeOnlyCurrent(data.id);
        }

        closeYearModal();
        await loadAcademicYears();

    } catch (error) {

        console.error("Error saving academic year:", error);
        showMessage("yearMessage", explainError(error, "Failed to save academic year."));

    } finally {
        button.disabled = false;
    }
}

async function setCurrentYear(yearId) {

    const year = academicYears.find(item => item.id === yearId);

    if (!year || !confirm(`Make ${year.label} the current academic year?`)) {
        return;
    }

    try {
        await makeOnlyCurrent(yearId);
        await loadAcademicYears();
    } catch (error) {
        console.error("Error changing current year:", error);
        alert(explainError(error, "Failed to change the current academic year."));
        await loadAcademicYears();
    }
}

async function deleteYear(yearId) {

    const year = academicYears.find(item => item.id === yearId);

    if (!year || !confirm(`Delete the academic year ${year.label}?`)) {
        return;
    }

    const { error } = await supabaseClient
        .from("academic_years")
        .delete()
        .eq("id", yearId);

    if (error) {
        console.error("Error deleting academic year:", error);
        alert(explainError(error, "Failed to delete academic year."));
        return;
    }

    await loadAcademicYears();
}


/* =========================================
   REGULATIONS
========================================= */

async function loadRegulations() {

    const { data, error } = await supabaseClient
        .from("regulations")
        .select("id, code, name")
        .order("code");

    if (error) {
        console.error("Error loading regulations:", error);
        document.getElementById("regulationsTable").innerHTML =
            `<tr><td colspan="3" class="as-empty">Could not load regulations (${escapeHtml(error.message)}).</td></tr>`;
        return;
    }

    regulations = data || [];
    renderRegulations();
}

function renderRegulations() {

    const tbody = document.getElementById("regulationsTable");

    if (regulations.length === 0) {
        tbody.innerHTML =
            `<tr><td colspan="3" class="as-empty">No regulations yet. Add one, for example R23.</td></tr>`;
        return;
    }

    tbody.innerHTML = regulations.map(regulation => `
        <tr>
            <td><strong>${escapeHtml(regulation.code)}</strong></td>
            <td>${escapeHtml(regulation.name || "-")}</td>
            <td>
                <div class="as-actions">
                    <button class="as-danger" onclick="deleteRegulation(${regulation.id})">Delete</button>
                </div>
            </td>
        </tr>
    `).join("");
}

function openRegulationModal() {

    document.getElementById("regulationCodeInput").value = "";
    document.getElementById("regulationNameInput").value = "";

    showMessage("regulationMessage", "");

    document.getElementById("regulationModal").style.display = "flex";
    document.getElementById("regulationCodeInput").focus();
}

function closeRegulationModal() {
    document.getElementById("regulationModal").style.display = "none";
}

async function saveRegulation() {

    const code = document.getElementById("regulationCodeInput").value.trim().toUpperCase();
    const name = document.getElementById("regulationNameInput").value.trim() || null;

    if (!code) {
        showMessage("regulationMessage", "Please enter the regulation code.");
        return;
    }

    const button = document.getElementById("saveRegulationBtn");
    button.disabled = true;

    try {

        const { error } = await supabaseClient
            .from("regulations")
            .insert({ code, name });

        if (error) {
            throw error;
        }

        closeRegulationModal();
        await loadRegulations();

    } catch (error) {

        console.error("Error saving regulation:", error);
        showMessage(
            "regulationMessage",
            error.code === "23505"
                ? "A regulation with this code already exists."
                : explainError(error, "Failed to save regulation.")
        );

    } finally {
        button.disabled = false;
    }
}

async function deleteRegulation(regulationId) {

    const regulation = regulations.find(item => item.id === regulationId);

    if (!regulation || !confirm(`Delete the regulation ${regulation.code}?`)) {
        return;
    }

    const { error } = await supabaseClient
        .from("regulations")
        .delete()
        .eq("id", regulationId);

    if (error) {
        console.error("Error deleting regulation:", error);
        alert(explainError(error, "Failed to delete regulation."));
        return;
    }

    await loadRegulations();
}


/* =========================================
   BATCHES
========================================= */

async function loadBatches() {

    const { data, error } = await supabaseClient
        .from("batches")
        .select("id, label, admission_year, graduation_year, regulation_id")
        .order("admission_year", { ascending: false });

    if (error) {
        console.error("Error loading batches:", error);
        document.getElementById("batchesTable").innerHTML =
            `<tr><td colspan="4" class="as-empty">Could not load batches (${escapeHtml(error.message)}).</td></tr>`;
        return;
    }

    batches = data || [];

    // number of students in each batch
    batchStudentCounts = {};

    await Promise.all(batches.map(async batch => {

        const { count } = await supabaseClient
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("batch_id", batch.id);

        batchStudentCounts[batch.id] = count || 0;
    }));

    renderBatches();
}

function renderBatches() {

    const tbody = document.getElementById("batchesTable");

    if (batches.length === 0) {
        tbody.innerHTML =
            `<tr><td colspan="4" class="as-empty">No batches yet. Add one, for example 2026-2030.</td></tr>`;
        return;
    }

    tbody.innerHTML = batches.map(batch => {

        const regulation =
            regulations.find(item => item.id === batch.regulation_id);

        return `
            <tr>
                <td><strong>${escapeHtml(batch.label)}</strong></td>
                <td>${regulation ? escapeHtml(regulation.code) : "-"}</td>
                <td>${batchStudentCounts[batch.id] ?? 0}</td>
                <td>
                    <div class="as-actions">
                        <button onclick="openBatchModal(${batch.id})">Change regulation</button>
                        <button class="as-danger" onclick="deleteBatch(${batch.id})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function openBatchModal(batchId) {

    editingBatchId = batchId;

    const select = document.getElementById("batchRegulationInput");

    select.innerHTML = regulations
        .map(regulation => `
            <option value="${regulation.id}">${escapeHtml(regulation.code)}</option>
        `)
        .join("");

    const yearInput = document.getElementById("batchYearInput");
    const durationInput = document.getElementById("batchDurationInput");

    if (batchId) {

        const batch = batches.find(item => item.id === batchId);

        document.getElementById("batchModalTitle").textContent = `Edit Batch ${batch.label}`;

        yearInput.value = batch.admission_year;
        durationInput.value = batch.graduation_year - batch.admission_year;
        select.value = batch.regulation_id;

        // only the regulation can change; the years define the batch
        yearInput.disabled = true;
        durationInput.disabled = true;

    } else {

        document.getElementById("batchModalTitle").textContent = "Add Batch";

        const current = academicYears.find(item => item.is_current);

        yearInput.value = current ? new Date(current.start_date).getFullYear() : "";
        durationInput.value = 4;

        yearInput.disabled = false;
        durationInput.disabled = false;
    }

    showMessage("batchMessage", "");

    document.getElementById("batchModal").style.display = "flex";
}

function closeBatchModal() {
    document.getElementById("batchModal").style.display = "none";
    editingBatchId = null;
}

async function saveBatch() {

    const admissionYear = Number(document.getElementById("batchYearInput").value);
    const duration = Number(document.getElementById("batchDurationInput").value);
    const regulationId = Number(document.getElementById("batchRegulationInput").value);

    if (!regulationId) {
        showMessage("batchMessage", "Please add a regulation first, then pick it here.");
        return;
    }

    if (!editingBatchId && (!admissionYear || !duration)) {
        showMessage("batchMessage", "Please enter the admission year and programme length.");
        return;
    }

    const button = document.getElementById("saveBatchBtn");
    button.disabled = true;

    try {

        if (editingBatchId) {

            const { error } = await supabaseClient
                .from("batches")
                .update({ regulation_id: regulationId })
                .eq("id", editingBatchId);

            if (error) {
                throw error;
            }

        } else {

            const graduationYear = admissionYear + duration;

            const { error } = await supabaseClient
                .from("batches")
                .insert({
                    label: `${admissionYear}-${graduationYear}`,
                    admission_year: admissionYear,
                    graduation_year: graduationYear,
                    regulation_id: regulationId
                });

            if (error) {
                throw error;
            }
        }

        closeBatchModal();
        await loadBatches();

    } catch (error) {

        console.error("Error saving batch:", error);
        showMessage(
            "batchMessage",
            error.code === "23505"
                ? "A batch for this admission year already exists."
                : explainError(error, "Failed to save batch.")
        );

    } finally {
        button.disabled = false;
    }
}

async function deleteBatch(batchId) {

    const batch = batches.find(item => item.id === batchId);

    if (!batch) {
        return;
    }

    if ((batchStudentCounts[batchId] || 0) > 0) {
        alert(`Batch ${batch.label} still has ${batchStudentCounts[batchId]} student(s). Move or delete them first.`);
        return;
    }

    if (!confirm(`Delete the batch ${batch.label}?`)) {
        return;
    }

    const { error } = await supabaseClient
        .from("batches")
        .delete()
        .eq("id", batchId);

    if (error) {
        console.error("Error deleting batch:", error);
        alert(explainError(error, "Failed to delete batch."));
        return;
    }

    await loadBatches();
}
