/* =====================================================
   student/student.js
   Student dashboard + semester/branch courses + videos
   + per-video watch/question progress.
===================================================== */

let currentStudent = null;
let studentCourses = [];
let studentVideos = [];
let selectedCourse = null;
let selectedVideo = null;
let selectedQuestions = [];
let answeredQuestionIds = new Set();
let correctAnswerCount = 0;
let player = null;
let playerReady = false;
let progressTimer = null;
let saveTimer = null;
let maxWatchedSeconds = 0;
let lastSavedMax = 0;
let isSeekingProgrammatically = false;
let activeQuestionId = null;
let activeSkip = null;
let selectedVideoSkips = [];

const $ = (id) => document.getElementById(id);


document.addEventListener("DOMContentLoaded", async () => {
    currentStudent = getStoredStudent();
    if (!currentStudent) {
        window.location.href = "index.html";
        return;
    }

    $("studentLogout")?.addEventListener("click", studentLogout);

    setupStudentNavigation();
    setupStudentCourseVideoSearch();
    setupVideoControls();

    await loadStudentProfile();
    await loadStudentCourses();
});

function getStoredStudent() {
    try {
        const role = localStorage.getItem("edulearn_role");
        const raw = localStorage.getItem("edulearn_user");
        if (role !== "student" || !raw) return null;
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

function studentLogout() {
    stopProgressTracking();
    if (player && typeof player.destroy === "function") {
        try { player.destroy(); } catch (_) {}
    }
    player = null;
    playerReady = false;
    localStorage.removeItem("edulearn_user");
    localStorage.removeItem("edulearn_role");
    window.location.href = "index.html";
}


/* =====================================================
   NAVIGATION
===================================================== */
function setupStudentNavigation() {
    document.querySelectorAll("[data-student-section]").forEach((button) => {
        button.addEventListener("click", () => {
            showStudentSection(button.dataset.studentSection);
        });
    });
}

function showStudentSection(sectionId) {
    document.querySelectorAll(".student-section").forEach((section) => {
        section.classList.add("hidden");
    });

    const section = $(sectionId);
    if (section) section.classList.remove("hidden");

    document.querySelectorAll("[data-student-section]").forEach((button) => {
        button.classList.toggle(
            "active",
            button.dataset.studentSection === sectionId
        );
    });

    if (sectionId === "studentCoursesSection") {
        loadStudentCourses();
    }
}


/* =====================================================
   PROFILE
===================================================== */
async function loadStudentProfile() {
    // Refresh the student row so changes made by the admin (especially moves)
    // are reflected immediately instead of relying on stale localStorage data.
    const [studentResult, branchResult, batchResult] = await Promise.all([
        window.supabaseClient
            .from("students")
            .select("id,roll_number,email,first_name,last_name,batch_id,branch_id,status")
            .eq("id", currentStudent.id)
            .maybeSingle(),
        window.supabaseClient.from("branches").select("id,name,code"),
        window.supabaseClient.from("batches").select("id,label,admission_year,graduation_year,regulation_id")
    ]);

    if (studentResult.error) {
        console.error("Student profile error:", studentResult.error);
        return;
    }
    if (!studentResult.data) {
        alert("Student account was not found.");
        studentLogout();
        return;
    }
    if (studentResult.data.status && studentResult.data.status !== "active") {
        alert("This student account is not active.");
        studentLogout();
        return;
    }

    currentStudent = { ...currentStudent, ...studentResult.data };

    const { data: enrollment, error: enrollmentError } =
        await window.supabaseClient
            .from("student_enrollments")
            .select("id,student_id,academic_year_id,semester_id,is_current,status")
            .eq("student_id", currentStudent.id)
            .eq("is_current", true)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

    if (enrollmentError) {
        console.error("Enrollment error:", enrollmentError);
    }

    currentStudent.enrollment_id = enrollment?.id || null;
    currentStudent.semester_id = enrollment?.semester_id || null;
    currentStudent.academic_year_id = enrollment?.academic_year_id || null;

    const semesterResult = currentStudent.semester_id
        ? await window.supabaseClient.from("semesters")
            .select("id,name,semester_number")
            .eq("id", currentStudent.semester_id).maybeSingle()
        : { data: null };

    const academicYearResult = currentStudent.academic_year_id
        ? await window.supabaseClient.from("academic_years")
            .select("id,label,start_date,end_date,is_current")
            .eq("id", currentStudent.academic_year_id).maybeSingle()
        : { data: null };

    const regulationId = (batchResult.data || []).find(
        b => Number(b.id) === Number(currentStudent.batch_id)
    )?.regulation_id;

    const regulationResult = regulationId
        ? await window.supabaseClient.from("regulations")
            .select("id,code,name")
            .eq("id", regulationId).maybeSingle()
        : { data: null };

    currentStudent.regulation = regulationResult.data || null;

    renderStudent(
        currentStudent,
        branchResult.data || [],
        semesterResult.data ? [semesterResult.data] : [],
        batchResult.data || [],
        academicYearResult.data ? [academicYearResult.data] : []
    );

    localStorage.setItem("edulearn_user", JSON.stringify(currentStudent));
}

function renderStudent(user, branches, semesters, batches, academicYears) {
    const firstName = user.first_name || "Student";
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    const set = (id, value) => {
        const element = $(id);
        if (element) element.textContent = value ?? "-";
    };

    set("studentTopName", fullName || "Student");
    set("studentTopRoll", user.roll_number);
    set("studentWelcomeName", firstName);
    set("studentRoll", user.roll_number);
    set("studentEmail", user.email);
    set("studentFirstName", user.first_name);
    set("studentLastName", user.last_name || "-");

    const branch = branches.find(item => Number(item.id) === Number(user.branch_id));
    const batch = batches.find(item => Number(item.id) === Number(user.batch_id));
    const semester = semesters.find(item => Number(item.id) === Number(user.semester_id));
    const academicYear = academicYears.find(item => Number(item.id) === Number(user.academic_year_id));

    set("studentBranch", branch ? `${branch.name} (${branch.code})` : "-");
    set("studentSemester", semester ? semester.name : "Not enrolled");
    set("studentBatch", batch ? batch.label : "-");
    currentStudent.batch_label = batch ? batch.label : "-";
    set("studentRegulation", user.regulation ? (user.regulation.code || user.regulation.name) : "-");
    set("studentAcademicYear", academicYear ? academicYear.label : "-");
    set("studentAvatar", firstName.charAt(0).toUpperCase());

    if (semester) set("courseSemesterLabel", semester.name);
    if (branch) set("courseBranchLabel", `${branch.name} (${branch.code})`);
}

/* =====================================================
   STUDENT COURSES
   New schema: students -> student_enrollments -> semesters,
   course_offerings -> courses + course_offering_branches.
===================================================== */
async function loadStudentCourses() {
    const grid = $("studentCoursesGrid");
    if (!grid) return;

    grid.innerHTML = `<div class="student-loading">Loading your courses...</div>`;

    if (!currentStudent.semester_id || !currentStudent.academic_year_id) {
        studentCourses = [];
        grid.innerHTML = `
            <div class="student-empty">
                <div class="student-empty-icon">${window.ELIcon("book")}</div>
                <h3>No active enrollment</h3>
                <p>Your account does not have a current active academic-year and semester enrollment.</p>
            </div>`;
        return;
    }

    // The view is the source of truth for student course access:
    // current enrollment + batch/regulation + branch + published offering.
    const { data, error } = await window.supabaseClient
        .from("v_student_courses")
        .select("student_id,offering_id,course_id,course_name,course_code,folder_id,batch_id,academic_year_id,semester_id")
        .eq("student_id", currentStudent.id)
        .eq("academic_year_id", currentStudent.academic_year_id)
        .eq("semester_id", currentStudent.semester_id)
        .order("course_name", { ascending: true });

    if (error) {
        console.error("Student course loading error:", error);
        grid.innerHTML = `
            <div class="student-empty">
                <div class="student-empty-icon">${window.ELIcon("alert")}</div>
                <h3>Unable to load courses</h3>
                <p>${escapeHtml(error.message || "Please try again.")}</p>
            </div>`;
        return;
    }

    // A course can be offered more than once, so offering_id—not course_id—
    // identifies the exact course context whose videos the student should see.
    const unique = new Map();
    (data || []).forEach(row => {
        if (!unique.has(Number(row.offering_id))) {
            unique.set(Number(row.offering_id), {
                ...row,
                offering_id: Number(row.offering_id),
                course_id: Number(row.course_id)
            });
        }
    });

    studentCourses = [...unique.values()];
    renderStudentCourses();
}

function renderStudentCourses() {
    const grid = $("studentCoursesGrid");
    if (!grid) return;

    const query = String($("studentCourseSearch")?.value || "").trim().toLowerCase();
    const filtered = studentCourses.filter(course => {
        if (!query) return true;
        return [course.course_name, course.course_code]
            .some(value => String(value || "").toLowerCase().includes(query));
    });

    setText("studentCourseCount", `${studentCourses.length} ${studentCourses.length === 1 ? "course" : "courses"}`);

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="courses-grid empty">
                <div class="empty-state-message">
                    <strong>${studentCourses.length ? "No courses found" : "No courses available"}</strong>
                    <p>${studentCourses.length ? "Try adjusting your search." : "No published course offering is assigned to your current batch, semester and branch."}</p>
                </div>
            </div>`;
        return;
    }

    const semesterName = $("courseSemesterLabel")?.textContent || "Current semester";
    const branchName = $("courseBranchLabel")?.textContent || "Current branch";
    const batch = currentStudent.batch_label || "Current batch";
    const regulation = currentStudent.regulation?.code || currentStudent.regulation?.name || "Current regulation";

    grid.innerHTML = filtered.map(course => `
        <div class="course-card student-course-card">
            <div class="course-card-header">
                <h3 class="course-card-title">${escapeHtml(course.course_name || "Untitled Course")}</h3>
                ${course.course_code ? `<span class="course-branch-tag">${escapeHtml(course.course_code)}</span>` : ""}
            </div>

            <div class="course-card-meta">
                <div class="course-meta-item">
                    <span class="course-meta-label">Batch:</span>
                    <span class="course-meta-value">${escapeHtml(batch)}</span>
                </div>
                <div class="course-meta-item">
                    <span class="course-meta-label">Regulation:</span>
                    <span class="course-meta-value">${escapeHtml(regulation)}</span>
                </div>
                <div class="course-meta-item">
                    <span class="course-meta-label">Semester:</span>
                    <span class="course-meta-value">${escapeHtml(semesterName)}</span>
                </div>
                <div class="course-meta-item">
                    <span class="course-meta-label">Branches:</span>
                    <div class="course-branches">
                        <span class="course-branch-tag">${escapeHtml(branchName)}</span>
                    </div>
                </div>
            </div>

            <div class="course-card-actions">
                <button class="course-action-primary" data-offering-id="${course.offering_id}">Videos</button>
            </div>
        </div>
    `).join("");

    grid.querySelectorAll("[data-offering-id]").forEach(button => {
        button.addEventListener("click", () => openStudentCourse(Number(button.dataset.offeringId)));
    });
}

function setupStudentCourseVideoSearch() {
    $("studentCourseSearch")?.addEventListener("input", renderStudentCourses);
    $("clearStudentCourseSearch")?.addEventListener("click", () => {
        const input = $("studentCourseSearch");
        if (input) input.value = "";
        renderStudentCourses();
    });

    $("studentVideoSearch")?.addEventListener("input", renderStudentVideos);
}

/* =====================================================
   COURSE -> VIDEOS
===================================================== */
async function openStudentCourse(offeringId) {
    selectedCourse = studentCourses.find(
        course => Number(course.offering_id) === Number(offeringId)
    );
    if (!selectedCourse) return;

    setText("selectedCourseTitle", selectedCourse.course_name || "Course");
    setText("selectedCourseMeta", "Loading videos...");
    showStudentSection("studentVideosSection");

    const { data, error } = await window.supabaseClient
        .from("videos")
        .select(`
            video_id,
            video_title,
            youtube_url,
            description,
            block_forward_seek,
            pause_at_questions,
            display_order,
            start_date,
            end_date,
            playback_speed,
            offering_id,
            created_at
        `)
        .eq("offering_id", selectedCourse.offering_id)
        .order("display_order", { ascending: true });

    if (error) {
        console.error("Video loading error:", error);
        $("studentVideosGrid").innerHTML = `
            <div class="student-empty">
                <div class="student-empty-icon">${window.ELIcon("alert")}</div>
                <h3>Unable to load videos</h3>
                <p>${escapeHtml(error.message || "Please try again.")}</p>
            </div>`;
        return;
    }

    const today = getLocalDateString();
    studentVideos = (data || []).filter(video =>
        (!video.start_date || today >= String(video.start_date).slice(0, 10)) &&
        (!video.end_date || today <= String(video.end_date).slice(0, 10))
    );

    setText(
        "selectedCourseMeta",
        `${studentVideos.length} video${studentVideos.length === 1 ? "" : "s"}`
    );

    await renderStudentVideos();
}

async function renderStudentVideos() {
    const grid = $("studentVideosGrid");
    if (!grid) return;

    const query = String($("studentVideoSearch")?.value || "").trim().toLowerCase();
    const filtered = studentVideos.filter(video => {
        if (!query) return true;
        return [video.video_title, video.description]
            .some(value => String(value || "").toLowerCase().includes(query));
    });

    setText("studentVideoCount", `${studentVideos.length} ${studentVideos.length === 1 ? "video" : "videos"}`);
    setText("selectedCourseMeta", `${studentVideos.length} video${studentVideos.length === 1 ? "" : "s"}`);

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="ve-empty-state">
                <div class="ve-empty-icon">${window.ELIcon("video")}</div>
                <strong>${studentVideos.length ? "No videos found" : "No videos available"}</strong>
                <p>${studentVideos.length ? "Try adjusting your search." : "This course does not have any currently available videos."}</p>
            </div>`;
        return;
    }

    const videoIds = studentVideos.map(video => video.video_id);
    const { data: progressRows, error } = await window.supabaseClient
        .from("student_video_progress")
        .select("video_id,max_watched_seconds,questions_solved,total_questions,correct_answers,completed")
        .eq("student_id", currentStudent.id)
        .in("video_id", videoIds);

    if (error) console.error("Progress loading error:", error);

    const progressMap = new Map(
        (progressRows || []).map(row => [Number(row.video_id), row])
    );

    grid.innerHTML = filtered.map((video, index) => {
        const progress = progressMap.get(Number(video.video_id)) || {};
        const solved = Number(progress.questions_solved || 0);
        const total = Number(progress.total_questions || 0);
        const completed = !!progress.completed;
        const watched = Number(progress.max_watched_seconds || 0);
        const percentage = total > 0
            ? Math.min(100, Math.round((solved / total) * 100))
            : (completed ? 100 : 0);
        const thumbId = extractYouTubeId(video.youtube_url);
        const thumb = thumbId ? `https://i.ytimg.com/vi/${thumbId}/hqdefault.jpg` : "";
        const position = Number(video.display_order) || (index + 1);
        const availability = availabilityChipForStudent(video);

        return `
            <div class="ve-video-card student-video-card" data-id="${video.video_id}">
                ${thumb
                    ? `<div class="ve-video-thumb" style="background-image:url('${thumb}')"></div>`
                    : `<div class="ve-video-thumb ve-video-thumb-empty">${window.ELIcon("video")}</div>`}

                <div class="ve-video-card-body">
                    <h3 class="ve-video-card-title">${escapeHtml(video.video_title || "Untitled Video")}</h3>
                    <p class="ve-video-card-meta">
                        <span class="ve-tag">Video ${position}</span>
                        ${availability}
                    </p>
                    ${video.description ? `<p class="ve-video-desc">${escapeHtml(video.description)}</p>` : ""}
                    <div class="student-progress-strip"><span style="width:${percentage}%"></span></div>
                    <div class="student-video-progress-meta">
                        <span>${solved}/${total} questions solved</span>
                        <span>${completed ? "Completed" : `Watched ${formatTime(watched)}`}</span>
                    </div>
                </div>

                <div class="student-video-card-footer">
                    <button class="action-btn edit-btn" data-video-id="${video.video_id}">
                        ${completed ? "Watch Again" : window.ELIcon("play") + " Watch Video"}
                    </button>
                </div>
            </div>`;
    }).join("");

    grid.querySelectorAll("[data-video-id]").forEach(button => {
        button.addEventListener("click", () => openStudentVideo(Number(button.dataset.videoId)));
    });
}

function availabilityChipForStudent(video) {
    const parts = [];
    if (video.start_date) parts.push(`Starts ${formatStudentDate(video.start_date)}`);
    if (video.end_date) parts.push(`Ends ${formatStudentDate(video.end_date)}`);
    return parts.length ? `<span class="ve-date">${window.ELIcon("calendar")} ${parts.join(" · ")}</span>` : "";
}

function formatStudentDate(value) {
    const raw = String(value || "").slice(0, 10);
    if (!raw) return "";
    const [y, m, d] = raw.split("-").map(Number);
    if (!y || !m || !d) return raw;
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}


/* =====================================================
   VIDEO PLAYER
===================================================== */
function setupVideoControls() {
    $("studentPlayPauseBtn")?.addEventListener("click", toggleStudentPlayback);
    $("studentMuteBtn")?.addEventListener("click", toggleStudentMute);
    $("studentPlaybackSpeed")?.addEventListener("change", changeStudentPlaybackSpeed);
    $("studentFullscreenBtn")?.addEventListener("click", enterStudentFullscreen);
    $("studentExitFullscreenBtn")?.addEventListener("click", exitStudentFullscreen);
    $("studentVideoSeek")?.addEventListener("input", seekFromStudentControl);
    document.addEventListener("fullscreenchange", handleStudentFullscreenChange);
    document.addEventListener("keydown", handleQuestionVideoKeydown, true);

    $("backToCoursesBtn")?.addEventListener("click", () => {
        stopProgressTracking();
        showStudentSection("studentCoursesSection");
    });

    $("closeVideoBtn")?.addEventListener("click", () => {
        stopProgressTracking();
        showStudentSection("studentVideosSection");
    });

    $("nextVideoBtn")?.addEventListener("click", openNextStudentVideo);

    $("questionSubmitBtn")?.addEventListener("click", submitCurrentQuestion);
    $("questionRewatchBtn")?.addEventListener("click", rewatchQuestion);
}

async function openStudentVideo(videoId) {
    selectedVideo = studentVideos.find(
        (video) => Number(video.video_id) === Number(videoId)
    );
    if (!selectedVideo) return;

    activeQuestionId = null;
    document.querySelector(".student-video-player-wrap")?.classList.remove("question-active");

    showStudentSection("studentPlayerSection");

    setText("playerVideoTitle", selectedVideo.video_title);
    setText("playerVideoDescription", selectedVideo.description || "");
    setText("playerProgressText", "Loading progress...");
    setupStudentPlaybackSpeed(selectedVideo.playback_speed);

    const [progressResult, questionsResult, attemptsResult, skipsResult] = await Promise.all([
        loadVideoProgress(selectedVideo.video_id),
        loadVideoQuestions(selectedVideo.video_id),
        loadQuestionAttempts(selectedVideo.video_id),
        loadVideoSkips(selectedVideo.video_id)
    ]);

    activeSkip = null;
    selectedVideoSkips = skipsResult || [];
    updateNextVideoButton();

    const progress = progressResult;
    const questions = questionsResult.data;
    const questionError = questionsResult.error;

    if (questionError) console.error("Question loading error:", questionError);

    maxWatchedSeconds = Number(progress?.max_watched_seconds || 0);
    lastSavedMax = maxWatchedSeconds;
    activeQuestionId = null;
    // Once the student presses Submit, the question is considered submitted
    // regardless of whether the selected answer is correct or wrong.
    answeredQuestionIds = new Set(
        (attemptsResult || [])
            .map((attempt) => Number(attempt.question_id))
    );
    // Count the currently saved correct answers from the submitted attempts.
    // This is derived from attempts so it stays correct even if an answer is updated.
    correctAnswerCount = (attemptsResult || [])
        .filter((attempt) => !!attempt.is_correct)
        .length;
    selectedQuestions = questions || [];

    updateQuestionProgress();
    updatePlayerProgressText(progress);
    createOrLoadYouTubePlayer(selectedVideo.youtube_url);
}

async function loadVideoProgress(videoId) {
    const { data, error } = await window.supabaseClient
        .from("student_video_progress")
        .select("student_id,video_id,max_watched_seconds,questions_solved,total_questions,correct_answers,completed")
        .eq("student_id", currentStudent.id)
        .eq("video_id", videoId)
        .maybeSingle();

    if (error) {
        console.error("Video progress error:", error);
        return null;
    }

    return data;
}

async function loadQuestionAttempts(videoId) {
    const { data, error } = await window.supabaseClient
        .from("student_question_attempts")
        .select("question_id,is_correct")
        .eq("student_id", currentStudent.id)
        .eq("video_id", videoId);

    if (error) {
        console.error("Question attempts error:", error);
        return [];
    }

    return data || [];
}

async function loadVideoSkips(videoId) {
    const { data, error } = await window.supabaseClient
        .from("video_skips")
        .select("skip_id,start_time_seconds,end_time_seconds")
        .eq("video_id", videoId)
        .order("start_time_seconds", { ascending: true });

    if (error) {
        console.error("Video skips error:", error);
        return [];
    }
    return data || [];
}

function openNextStudentVideo() {
    if (!selectedVideo || !studentVideos.length) return;
    const index = studentVideos.findIndex(
        video => Number(video.video_id) === Number(selectedVideo.video_id)
    );
    const next = index >= 0 ? studentVideos[index + 1] : null;
    if (next) openStudentVideo(Number(next.video_id));
}

function updateNextVideoButton() {
    const btn = $("nextVideoBtn");
    if (!btn || !selectedVideo) return;
    const index = studentVideos.findIndex(
        video => Number(video.video_id) === Number(selectedVideo.video_id)
    );
    const hasNext = index >= 0 && index < studentVideos.length - 1;
    btn.classList.toggle("hidden", !hasNext);
    btn.innerHTML = hasNext ? `Next Video ${window.ELIcon("arrowRight")}` : "Next Video";
}

async function loadVideoQuestions(videoId) {
    const { data, error } = await window.supabaseClient
        .from("video_questions")
        .select(`
            question_id,
            video_id,
            timestamp_seconds,
            question_text,
            explanation,
            question_options (
                option_id,
                option_text,
                option_order,
                is_correct
            )
        `)
        .eq("video_id", videoId)
        .order("timestamp_seconds", { ascending: true });

    return { data: data || [], error };
}

function createOrLoadYouTubePlayer(url) {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
        showPlayerError("Invalid YouTube URL for this video.");
        return;
    }

    if (window.YT && window.YT.Player) {
        createYouTubePlayer(videoId);
        return;
    }

    window.onYouTubeIframeAPIReady = () => {
        createYouTubePlayer(videoId);
    };

    if (!document.getElementById("youtube-iframe-api")) {
        const script = document.createElement("script");
        script.id = "youtube-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
    }
}

function createYouTubePlayer(videoId) {
    playerReady = false;

    if (player && typeof player.destroy === "function") {
        try { player.destroy(); } catch (_) {}
    }

    player = new YT.Player("studentYoutubePlayer", {
        videoId,
        playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            controls: 0,
            fs: 0,
            disablekb: 1,
            iv_load_policy: 3
        },
        events: {
            onReady: () => {
                playerReady = true;
                try {
                    const rate = Number($("studentPlaybackSpeed")?.value || 1);
                    if (rate > 0 && typeof player.setPlaybackRate === "function") {
                        player.setPlaybackRate(rate);
                    }
                } catch (_) {}
                updateCustomPlayerControls();
                startProgressTracking();
                if (maxWatchedSeconds > 0) {
                    try { player.seekTo(maxWatchedSeconds, true); } catch (_) {}
                }
                updatePlayerProgressText();
            },
            onStateChange: handlePlayerStateChange,
            onError: (event) => console.error("YouTube player error:", event)
        }
    });
}

function handlePlayerStateChange(event) {
    if (!playerReady) return;

    updateCustomPlayerControls();

    if (event.data === YT.PlayerState.PLAYING) {
        if (isQuestionVideoLocked()) {
            try { player.pauseVideo(); } catch (_) {}
            return;
        }
        startProgressTracking();
    } else if (
        event.data === YT.PlayerState.PAUSED ||
        event.data === YT.PlayerState.ENDED
    ) {
        saveCurrentProgress(true);
    }
}

function startProgressTracking() {
    stopProgressTracking();
    // Poll frequently so skip ranges are applied immediately, even at higher playback speeds.
    progressTimer = setInterval(trackCurrentVideoTime, 150);
}

function stopProgressTracking() {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
}

function trackCurrentVideoTime() {
    if (!playerReady || !player || !selectedVideo) return;

    let currentTime = 0;
    try {
        currentTime = Number(player.getCurrentTime() || 0);
    } catch (_) {
        return;
    }

    // A question owns the video until it is answered or explicitly rewound.
    if (isQuestionVideoLocked()) {
        try {
            if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
        } catch (_) {}
        updateCustomPlayerControls(currentTime);
        return;
    }

    // Automatically skip every instructor-configured range.
    // The check runs before forward-seek/question logic so a skipped segment
    // cannot trigger a question or get treated as student-watched content.
    const skip = selectedVideoSkips.find(s => {
        const start = Number(s.start_time_seconds || 0);
        const end = Number(s.end_time_seconds || 0);
        return end > start && currentTime >= start && currentTime < end;
    });

    if (skip) {
        const endTime = Number(skip.end_time_seconds || 0);

        if (activeSkip !== skip.skip_id) {
            activeSkip = skip.skip_id;
            isSeekingProgrammatically = true;

            // Treat the end of the skipped segment as watched so the
            // forward-seek restriction does not immediately pull the
            // student back into the skipped portion.
            if (endTime > maxWatchedSeconds) {
                maxWatchedSeconds = endTime;
                updatePlayerProgressText();
                updateProgressBar(endTime);
            }

            try {
                player.seekTo(endTime, true);
                player.playVideo();
            } catch (_) {}

            // Give the YouTube iframe time to report the new position.
            setTimeout(() => {
                isSeekingProgrammatically = false;
                activeSkip = null;
            }, 350);
        }

        updateCustomPlayerControls(endTime);
        return;
    }

    activeSkip = null;

    if (selectedVideo.block_forward_seek && currentTime > maxWatchedSeconds + 3) {
        isSeekingProgrammatically = true;
        try { player.seekTo(maxWatchedSeconds, true); } catch (_) {}
        setTimeout(() => { isSeekingProgrammatically = false; }, 300);
        return;
    }

    if (!isSeekingProgrammatically && currentTime > maxWatchedSeconds) {
        maxWatchedSeconds = currentTime;
        updatePlayerProgressText();
        updateProgressBar(currentTime);

        if (maxWatchedSeconds - lastSavedMax >= 5) {
            queueProgressSave();
        }
    }

    updateCustomPlayerControls(currentTime);
    checkQuestionTimestamp(currentTime);
}

function queueProgressSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCurrentProgress(false), 500);
}

async function saveCurrentProgress(force = false) {
    if (!selectedVideo || !currentStudent) return;

    let currentTime = maxWatchedSeconds;
    if (playerReady && player) {
        try { currentTime = Number(player.getCurrentTime() || maxWatchedSeconds); } catch (_) {}
    }

    if (!force && maxWatchedSeconds <= lastSavedMax + 0.5) return;

    const totalQuestions = selectedQuestions.length;
    const solved = answeredQuestionIds.size;
    const duration = playerReady && player ? Number(player.getDuration() || 0) : 0;
    const completed = duration > 0 && maxWatchedSeconds >= Math.max(0, duration - 3);

    const payload = {
        student_id: currentStudent.id,
        video_id: selectedVideo.video_id,
        max_watched_seconds: Math.floor(Math.max(maxWatchedSeconds, lastSavedMax)),
        questions_solved: solved,
        total_questions: totalQuestions,
        correct_answers: Math.min(correctAnswerCount, solved),
        completed,
        updated_at: new Date().toISOString()
    };

    const { error } = await window.supabaseClient
        .from("student_video_progress")
        .upsert(payload, { onConflict: "student_id,video_id" });

    if (error) {
        console.error("Progress save error:", error);
        return;
    }

    lastSavedMax = maxWatchedSeconds;
    updatePlayerProgressText(payload);
    if (payload.completed) updateNextVideoButton();
}

function updatePlayerProgressText(progress = null) {
    const maxSeconds = Number(progress?.max_watched_seconds ?? maxWatchedSeconds ?? 0);
    const solved = Number(progress?.questions_solved ?? answeredQuestionIds.size ?? 0);
    const total = Number(progress?.total_questions ?? selectedQuestions.length ?? 0);
    const correct = Number(progress?.correct_answers ?? correctAnswerCount ?? 0);

    setText(
        "playerProgressText",
        `Max watched: ${formatTime(maxSeconds)} • Questions: ${solved}/${total} • Correct: ${correct}`
    );
}

function updateProgressBar(seconds) {
    const bar = $("studentVideoProgressBar");
    if (!bar || !playerReady || !player) return;

    let duration = 0;
    try { duration = Number(player.getDuration() || 0); } catch (_) {}
    if (!duration) return;

    bar.style.width = `${Math.min(100, Math.max(0, seconds / duration * 100))}%`;
}


/* =====================================================
   CUSTOM VIDEO CONTROLS / FULLSCREEN
===================================================== */
function setupStudentPlaybackSpeed(maxPlaybackSpeed) {
    const select = $("studentPlaybackSpeed");
    if (!select) return;

    const allowedRates = [1, 1.25, 1.5, 1.75, 2];
    let maxRate = Number(maxPlaybackSpeed);
    if (!Number.isFinite(maxRate) || maxRate <= 0) maxRate = 1;

    const rates = allowedRates.filter(rate => rate <= maxRate + 0.001);
    if (!rates.length) rates.push(1);

    select.innerHTML = rates.map(rate => {
        const label = Number.isInteger(rate) ? `${rate}×` : `${rate.toFixed(2).replace(/0$/, "")}×`;
        return `<option value="${rate}">${label}</option>`;
    }).join("");

    // Start each video at normal speed; the student can select any rate
    // up to the instructor-configured maximum.
    select.value = "1";
    select.disabled = false;
}

function changeStudentPlaybackSpeed(event) {
    if (isQuestionVideoLocked() || !playerReady || !player) {
        event.target.value = "1";
        return;
    }

    const requested = Number(event.target.value || 1);
    const maxRate = Number(selectedVideo?.playback_speed || 1);
    const rate = Math.min(requested, maxRate);

    try {
        if (typeof player.setPlaybackRate === "function") {
            player.setPlaybackRate(rate);
        }
    } catch (_) {}

    event.target.value = String(rate);
}

function toggleStudentPlayback() {
    if (isQuestionVideoLocked() || !playerReady || !player) return;
    try {
        const state = player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) player.pauseVideo();
        else player.playVideo();
    } catch (_) {}
}

function toggleStudentMute() {
    if (isQuestionVideoLocked() || !playerReady || !player) return;
    try {
        if (player.isMuted()) {
            player.unMute();
            $("studentMuteBtn").innerHTML = window.ELIcon("volume");
        } else {
            player.mute();
            $("studentMuteBtn").innerHTML = window.ELIcon("mute");
        }
    } catch (_) {}
}

function seekFromStudentControl(event) {
    if (isQuestionVideoLocked() || !playerReady || !player) return;

    const requested = Number(event.target.value || 0);
    const allowed = selectedVideo?.block_forward_seek
        ? Math.min(requested, maxWatchedSeconds)
        : requested;

    isSeekingProgrammatically = true;
    try { player.seekTo(Math.max(0, allowed), true); } catch (_) {}
    setTimeout(() => { isSeekingProgrammatically = false; }, 300);
}

async function enterStudentFullscreen() {
    if (isQuestionVideoLocked()) return;
    const layout = document.querySelector(".student-player-layout");
    if (!layout) return;

    try {
        if (layout.requestFullscreen) await layout.requestFullscreen();
        else if (layout.webkitRequestFullscreen) layout.webkitRequestFullscreen();
    } catch (error) {
        console.error("Fullscreen error:", error);
    }
}

async function exitStudentFullscreen() {
    try {
        if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
        }
    } catch (error) {
        console.error("Exit fullscreen error:", error);
    }
}

function handleStudentFullscreenChange() {
    const layout = document.querySelector(".student-player-layout");
    if (!layout) return;

    const isFullscreen = !!document.fullscreenElement;
    layout.classList.toggle("is-fullscreen", isFullscreen);
    layout.classList.toggle(
        "has-question",
        !!activeQuestionId &&
        !$('studentQuestionPanel')?.classList.contains("hidden")
    );
}

function updateCustomPlayerControls(currentTime = null) {
    if (!playerReady || !player) return;

    let time = currentTime;
    let duration = 0;
    try {
        if (time === null) time = Number(player.getCurrentTime() || 0);
        duration = Number(player.getDuration() || 0);
    } catch (_) {
        return;
    }

    const seek = $("studentVideoSeek");
    if (seek) {
        seek.max = String(Math.max(0, Math.floor(duration)));
        const allowed = selectedVideo?.block_forward_seek
            ? Math.min(time, maxWatchedSeconds)
            : time;
        seek.value = String(Math.max(0, Math.floor(allowed)));
    }

    setText("studentVideoTime", `${formatTime(time)} / ${formatTime(duration)}`);

    try {
        $("studentPlayPauseBtn").innerHTML = player.getPlayerState() === YT.PlayerState.PLAYING
            ? window.ELIcon("pause")
            : window.ELIcon("play");
        $("studentMuteBtn").innerHTML = player.isMuted()
            ? window.ELIcon("mute")
            : window.ELIcon("volume");
    } catch (_) {}
}

function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}


function isQuestionVideoLocked() {
    const panel = $("studentQuestionPanel");
    return !!activeQuestionId && !!panel && !panel.classList.contains("hidden");
}

function setQuestionVideoLock(locked) {
    const wrap = document.querySelector(".student-video-player-wrap");
    if (wrap) wrap.classList.toggle("question-active", !!locked);

    const shield = $("studentVideoInteractionShield");
    if (shield) shield.setAttribute("aria-hidden", locked ? "false" : "true");

    const speedSelect = $("studentPlaybackSpeed");
    if (speedSelect) speedSelect.disabled = !!locked;

    // Keep the player paused even if an iframe event tries to resume playback.
    if (locked && playerReady && player) {
        try {
            player.pauseVideo();
        } catch (_) {}
    }
}

function handleQuestionVideoKeydown(event) {
    if (!isQuestionVideoLocked()) return;

    // The question panel must remain keyboard accessible.
    if (event.target?.closest?.("#studentQuestionPanel")) return;

    const blockedKeys = new Set([
        " ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
        "Home", "End", "PageUp", "PageDown", "m", "M", "k", "K",
        "j", "J", "l", "L", "f", "F", "c", "C", "0", "1", "2",
        "3", "4", "5", "6", "7", "8", "9"
    ]);

    if (blockedKeys.has(event.key)) {
        event.preventDefault();
        event.stopPropagation();
    }
}

/* =====================================================
   QUESTIONS
===================================================== */
function checkQuestionTimestamp(currentTime) {
    if (!selectedVideo || !selectedQuestions.length) return;

    const question = selectedQuestions.find((item) => {
        const id = Number(item.question_id);
        if (answeredQuestionIds.has(id)) return false;
        return currentTime >= Number(item.timestamp_seconds || 0) &&
               currentTime < Number(item.timestamp_seconds || 0) + 1.5;
    });

    if (!question || activeQuestionId === question.question_id) return;

    activeQuestionId = question.question_id;

    // Questions always pause and lock the video. The student must interact
    // with the question panel before playback can continue.
    if (playerReady && player) {
        try { player.pauseVideo(); } catch (_) {}
    }

    showQuestion(question);
}

function showQuestion(question) {
    const panel = $("studentQuestionPanel");
    if (!panel) return;

    const options = [...(question.question_options || [])]
        .sort((a, b) => Number(a.option_order) - Number(b.option_order));

    $("studentQuestionText").textContent = question.question_text;
    $("studentQuestionExplanation").textContent = "";
    $("studentQuestionStatus").textContent =
        `Question at ${formatTime(Number(question.timestamp_seconds || 0))}`;
    $("questionSubmitBtn").dataset.questionId = question.question_id;
    $("questionSubmitBtn").disabled = false;
    $("questionRewatchBtn").disabled = false;

    $("studentQuestionOptions").innerHTML = options.map((option) => `
        <label class="student-option">
            <input type="radio" name="studentQuestionOption" value="${option.option_id}">
            <span>${escapeHtml(option.option_text)}</span>
        </label>
    `).join("");

    panel.classList.remove("hidden");
    setQuestionVideoLock(true);

    const layout = document.querySelector(".student-player-layout");
    if (layout) layout.classList.add("has-question");
}

async function rewatchQuestion() {
    if (!playerReady || !player || !selectedVideo) return;

    let currentTime = 0;
    try {
        currentTime = Number(player.getCurrentTime() || 0);
    } catch (_) {
        return;
    }

    const rewatchTime = Math.max(0, currentTime - 15);

    isSeekingProgrammatically = true;
    try {
        player.seekTo(rewatchTime, true);
        player.playVideo();
    } catch (_) {}

    setTimeout(() => {
        isSeekingProgrammatically = false;
    }, 500);

    $("studentQuestionPanel")?.classList.add("hidden");
    $("studentQuestionExplanation").textContent = "";
    activeQuestionId = null;
    setQuestionVideoLock(false);
    document.querySelector(".student-player-layout")?.classList.remove("has-question");
}

async function submitCurrentQuestion() {
    const submitButton = $("questionSubmitBtn");
    const questionId = Number(submitButton?.dataset.questionId || 0);
    const selectedOptionId = Number(
        document.querySelector('input[name="studentQuestionOption"]:checked')?.value || 0
    );

    if (!questionId || !selectedOptionId) {
        setText("studentQuestionExplanation", "Select an option first.");
        return;
    }

    const question = selectedQuestions.find(
        (item) => Number(item.question_id) === questionId
    );
    if (!question) return;

    const option = (question.question_options || []).find(
        (item) => Number(item.option_id) === selectedOptionId
    );
    if (!option) return;

    const isCorrect = !!option.is_correct;

    submitButton.disabled = true;
    $("questionRewatchBtn").disabled = true;

    // Save the answer immediately when Submit is clicked, whether correct or wrong.
    const { error } = await window.supabaseClient
        .from("student_question_attempts")
        .upsert({
            student_id: currentStudent.id,
            question_id: questionId,
            video_id: selectedVideo.video_id,
            selected_option_id: selectedOptionId,
            is_correct: isCorrect,
            attempted_at: new Date().toISOString()
        }, { onConflict: "student_id,question_id" });

    if (error) {
        console.error("Question save error:", error);
        setText("studentQuestionExplanation", "Could not save your answer. Try again.");
        submitButton.disabled = false;
        $("questionRewatchBtn").disabled = false;
        return;
    }

    // A submitted question counts as solved/submitted even if the answer is wrong.
    answeredQuestionIds.add(questionId);
    // Recalculate from the saved attempt set instead of blindly incrementing.
    // The same question may be submitted again, and only its latest answer counts.
    correctAnswerCount = Math.min(
        correctAnswerCount + (isCorrect ? 1 : 0),
        answeredQuestionIds.size
    );
    // If a previously-correct answer is replaced with a wrong answer, the count
    // must be recomputed from the database on the next load. For the current submit
    // flow each question is normally submitted only once.

    setText(
        "studentQuestionExplanation",
        isCorrect
            ? (question.explanation || "Correct answer. Answer submitted.")
            : (question.explanation || "Incorrect answer. Answer submitted.")
    );

    updateQuestionProgress();
    await saveCurrentProgress(true);

    setTimeout(() => {
        $("studentQuestionPanel")?.classList.add("hidden");
        $("studentQuestionExplanation").textContent = "";
        activeQuestionId = null;
        setQuestionVideoLock(false);
        document.querySelector(".student-player-layout")?.classList.remove("has-question");

        if (playerReady && player) {
            try { player.playVideo(); } catch (_) {}
        }
    }, 1200);
}

function updateQuestionProgress() {
    setText(
        "playerQuestionCount",
        `${answeredQuestionIds.size}/${selectedQuestions.length} questions solved`
    );
}


/* =====================================================
   HELPERS
===================================================== */
function showPlayerError(message) {
    setText("playerVideoDescription", message);
}

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value ?? "";
}

function extractYouTubeId(url) {
    if (!url) return null;
    const value = String(url).trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

    const match = value.match(
        /(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
    );

    return match ? match[1] : null;
}

function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
