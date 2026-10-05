/**
 * videos.js
 * ─────────────────────────────────────────────────────────────────
 * Two-panel video management:
 *   Left  to list of videos for a course (CRUD via Supabase)
 *   Right to interactive video editor (questions, skips, preview)
 *
 * Added:
 *   - Automatic video positions
 *   - New videos are added at the end
 *   - Move video up/down
 *   - Position is stored in videos.display_order
 *   - Automatic position normalization after deletion
 * ─────────────────────────────────────────────────────────────────
 */

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────

    let allVideos = [];
    let allCourses = [];

    let editorVideoId = null;
    let editorVideoRow = null;

    let editorQuestions = [];
    let editorSkips = [];
    let editorSettings = {
        blockForward: true,
        pauseAtQuestions: true,
        playbackSpeed: 1.00
    };

    const STANDARD_PLAYBACK_SPEEDS = [
        1.00, 1.25, 1.50, 1.75, 2.00
    ];

    let skipStartMark = null;
    let skipEndMark = null;

    const MODE = {
        EDIT: 'EDIT',
        PREVIEW: 'PREVIEW'
    };

    let currentMode = MODE.EDIT;

    const studentState = {
        currentTime: 0,
        maxReachedTime: 0,
        activeQuestionId: null,
        answeredIds: [],
        isSkipping: false,
        seekGuard: false,
        isPlaying: false
    };

    let editingVideoId = null;
    let editingQuestionId = null;

    let ytPlayer = null;
    let ytReady = false;
    let tickInterval = null;

    const presetCourseId =
        new URLSearchParams(window.location.search)
            .get('offering_id');

    let selectedCourse = null;
    let captionsEnabled = false;


    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────
    // PLAYER UI: auto-hide overlay (YouTube style) + captions
    // ─────────────────────────────────────────────────────────────
    let playerIdleTimer = null;
    let playerIdleReady = false;

    function showPlayerUI() {
        const wrapper = document.getElementById('vePlayerWrapper');
        if (!wrapper) return;
        wrapper.classList.remove('ve-player-idle');
        clearTimeout(playerIdleTimer);
        playerIdleTimer = setTimeout(() => {
            wrapper.classList.add('ve-player-idle');
        }, 1250);
    }

    function initPlayerIdleUI() {
        if (playerIdleReady) return;
        const wrapper = document.getElementById('vePlayerWrapper');
        if (!wrapper) return;
        playerIdleReady = true;
        wrapper.addEventListener('mousemove', showPlayerUI);
        wrapper.addEventListener('mouseenter', showPlayerUI);
        wrapper.addEventListener('touchstart', showPlayerUI, { passive: true });
        showPlayerUI();
    }

    function toggleCaptions() {
        if (!ytReady || !ytPlayer) return;
        const btn = document.getElementById('btnCC');
        try {
            if (captionsEnabled) {
                ytPlayer.unloadModule('captions');
                captionsEnabled = false;
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            } else {
                ytPlayer.loadModule('captions');
                setTimeout(() => {
                    try {
                        ytPlayer.setOption('captions', 'track', { languageCode: 'en' });
                    } catch (e) {
                        console.warn('Could not select caption language:', e);
                    }
                }, 300);
                captionsEnabled = true;
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
            }
        } catch (err) {
            console.warn('Caption control error:', err);
        }
    }

    // ─────────────────────────────────────────────────────────────
    // DATE-ONLY HELPERS (start date / end date)
    // ─────────────────────────────────────────────────────────────
    function formatDateOnly(s) {
        if (!s) return '';
        const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return formatDate(s);
        return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
    }

    function availabilityChip(v) {
        const parts = [];
        if (v.start_date) parts.push('Starts ' + formatDateOnly(v.start_date));
        if (v.end_date) parts.push('Ends ' + formatDateOnly(v.end_date));
        if (!parts.length) return '';
        return `<span class="ve-date">${window.ELIcon('calendar')} ${parts.join(' · ')}</span>`;
    }

    function validateAvailability() {
        const startEl = document.getElementById('settingStartDate');
        const endEl = document.getElementById('settingEndDate');
        const err = document.getElementById('availabilityError');
        if (!startEl || !endEl) return true;
        const start = startEl.value;
        const end = endEl.value;
        endEl.min = start || '';
        let msg = '';
        if (start && end && end < start) {
            msg = 'End date cannot be earlier than the start date.';
        }
        if (err) {
            err.textContent = msg;
            err.classList.toggle('hidden', !msg);
        }
        return !msg;
    }

    function loadAvailabilityInputs(v) {
        const startEl = document.getElementById('settingStartDate');
        const endEl = document.getElementById('settingEndDate');
        if (!startEl || !endEl) return;
        startEl.value = v.start_date ? String(v.start_date).slice(0, 10) : '';
        endEl.value = v.end_date ? String(v.end_date).slice(0, 10) : '';
        validateAvailability();
    }

    // ─────────────────────────────────────────────────────────────
    // TIMELINE (seek bar, question pins, skip blocks, skip selection)
    // ─────────────────────────────────────────────────────────────
    let skipSelectStep = 0;        // 0 = idle, 1 = pick start, 2 = pick end
    let tlDragging = false;
    let tlDragTime = 0;
    let tlRenderedDuration = -1;
    let tlRenderedMode = null;

    function tlById(id) {
        return document.getElementById(id);
    }

    function tlPct(t, dur) {
        if (!dur || dur <= 0) return 0;
        return Math.min(100, Math.max(0, (t / dur) * 100));
    }

    function renderTimeline() {
        const markers = tlById('veTimelineMarkers');
        const skips = tlById('veTimelineSkips');
        if (!markers || !skips) return;

        const dur = ytDuration();
        const editing = currentMode === MODE.EDIT;
        tlRenderedDuration = dur;
        tlRenderedMode = currentMode;

        // Question pins (admin only)
        markers.innerHTML = (editing && dur > 0)
            ? editorQuestions.map((q, i) => `
                <span class="ve-tl-pin"
                      data-time="${q.time}"
                      style="left:${tlPct(q.time, dur)}%"
                      title="Q${i + 1} · ${formatTime(q.time)} — ${escapeHtml(q.question)}"></span>
            `).join('')
            : '';

        // Skip blocks (admin only) + a pending block used while selecting
        let html = '';
        if (editing && dur > 0) {
            html += editorSkips.map(s => {
                const a = tlPct(s.start, dur);
                const b = tlPct(s.end, dur);
                return `<span class="ve-tl-skip-block"
                              style="left:${a}%;width:${Math.max(b - a, 0.4)}%"
                              title="Skip ${formatTime(s.start)} to ${formatTime(s.end)}"></span>`;
            }).join('');
        }
        html += '<span id="veTlPending" class="ve-tl-skip-block" ' +
            'style="display:none;background:var(--accent,#2c6156);opacity:.55"></span>';
        skips.innerHTML = html;
        updatePendingBlock(null);
    }

    function updatePendingBlock(hoverTime) {
        const el = tlById('veTlPending');
        if (!el) return;
        const dur = ytDuration();
        if (skipSelectStep === 0 || skipStartMark === null || !dur) {
            el.style.display = 'none';
            return;
        }
        const to = (skipSelectStep === 2 && hoverTime !== null && hoverTime !== undefined)
            ? hoverTime
            : skipStartMark;
        const a = tlPct(Math.min(skipStartMark, to), dur);
        const b = tlPct(Math.max(skipStartMark, to), dur);
        el.style.display = 'block';
        el.style.left = a + '%';
        el.style.width = Math.max(b - a, 0.4) + '%';
    }

    function updateTimelineUI() {
        const tl = tlById('veTimeline');
        if (!tl) return;
        const dur = ytDuration();
        const now = tlDragging ? tlDragTime : ytCurrentTime();

        if (dur !== tlRenderedDuration || tlRenderedMode !== currentMode) {
            renderTimeline();
        }

        const cur = tlById('veCurrentTime');
        const total = tlById('veDuration');
        const prog = tlById('veTimelineProgress');
        const thumb = tlById('veTimelineThumb');
        if (cur) cur.textContent = formatTime(now);
        if (total) total.textContent = formatTime(dur);
        const pct = tlPct(now, dur);
        if (prog) prog.style.width = pct + '%';
        if (thumb) thumb.style.left = pct + '%';
        tl.setAttribute('aria-valuemax', String(Math.floor(dur)));
        tl.setAttribute('aria-valuenow', String(Math.floor(now)));
    }

    function resetTimelineUI() {
        tlDragging = false;
        tlRenderedDuration = -1;
        tlRenderedMode = null;
        const cur = tlById('veCurrentTime');
        const total = tlById('veDuration');
        const prog = tlById('veTimelineProgress');
        const thumb = tlById('veTimelineThumb');
        if (cur) cur.textContent = '00:00';
        if (total) total.textContent = '00:00';
        if (prog) prog.style.width = '0%';
        if (thumb) thumb.style.left = '0%';
        renderTimeline();
    }

    function seekFromTimeline(t) {
        if (!ytReady) return;
        const dur = ytDuration();
        t = Math.max(0, dur > 0 ? Math.min(t, dur) : t);

        if (currentMode === MODE.PREVIEW) {
            if (studentState.activeQuestionId) return;
            if (editorSettings.blockForward && t > studentState.maxReachedTime + 0.5) {
                t = studentState.maxReachedTime;
                showToast('Forward seeking is disabled in Preview.', 'warning');
            }
        }
        ytSeekTo(t);
        updateTimelineUI();
    }

    // ── Skip selection (click start, then end on the timeline) ──
    function updateSkipSelectionUI() {
        const status = tlById('skipSelectionStatus');
        const text = tlById('skipSelectionText');
        const label = tlById('btnTopAddSkipText');
        const btn = tlById('btnTopAddSkip');
        const tl = tlById('veTimeline');

        if (status) status.classList.toggle('hidden', skipSelectStep === 0);
        if (btn) btn.classList.toggle('active', skipSelectStep > 0);
        if (tl) tl.style.cursor = skipSelectStep > 0 ? 'crosshair' : '';

        if (label) {
            label.textContent =
                skipSelectStep === 0 ? '+ Add Skip' :
                    skipSelectStep === 1 ? 'Set Start Here' : 'Set End Here';
        }
        if (text) {
            text.textContent =
                skipSelectStep === 1
                    ? 'Click a start point on the timeline (or press “Set Start Here”)'
                    : skipSelectStep === 2
                        ? `Start ${formatTime(skipStartMark)} — now click the end point`
                        : '';
        }
    }

    function beginSkipSelection() {
        if (currentMode !== MODE.EDIT) {
            showToast('Switch to Edit mode to add skips.', 'warning');
            return;
        }
        if (!ytReady || !ytDuration()) {
            showToast('Video is still loading — try again in a moment.', 'warning');
            return;
        }
        skipStartMark = null;
        skipEndMark = null;
        skipSelectStep = 1;
        updateSkipSelectionUI();
        renderTimeline();
    }

    function cancelSkipSelection() {
        skipSelectStep = 0;
        skipStartMark = null;
        skipEndMark = null;
        const a = document.getElementById('lblSkipStart');
        const b = document.getElementById('lblSkipEnd');
        if (a) a.textContent = '––:––';
        if (b) b.textContent = '––:––';
        updateSkipSelectionUI();
        updatePendingBlock(null);
    }

    function commitSkipPoint(t) {
        t = Math.round(t);

        if (skipSelectStep === 1) {
            skipStartMark = t;
            skipEndMark = null;
            skipSelectStep = 2;
            const a = document.getElementById('lblSkipStart');
            if (a) a.textContent = formatTime(t);
            ytSeekTo(t);
            showToast(`Skip start set at ${formatTime(t)}. Now pick the end point.`, 'info');
            updateSkipSelectionUI();
            updatePendingBlock(t);
            return;
        }

        if (skipSelectStep === 2) {
            if (t <= skipStartMark) {
                showToast('End point must be after the start point.', 'warning');
                return;
            }
            skipEndMark = t;
            const b = document.getElementById('lblSkipEnd');
            if (b) b.textContent = formatTime(t);
            const before = editorSkips.length;
            confirmSkip();                       // validates + adds + re-renders
            if (editorSkips.length > before) {
                cancelSkipSelection();
            } else {
                skipEndMark = null;              // stay on step 2, let them pick again
            }
        }
    }

    function onTopAddSkipClick() {
        if (skipSelectStep === 0) {
            beginSkipSelection();
        } else if (ytReady) {
            commitSkipPoint(ytCurrentTime());
        }
    }

    // ── Wiring ──
    function setupTimelineAndToolbar() {
        const tl = tlById('veTimeline');
        if (tl) {
            tl.setAttribute('tabindex', '0');
            tl.setAttribute('role', 'slider');
            tl.setAttribute('aria-label', 'Video timeline');
            tl.setAttribute('aria-valuemin', '0');
            tl.style.touchAction = 'none';

            const tip = tlById('veTimelineTooltip');

            const timeAt = e => {
                const r = tl.getBoundingClientRect();
                const dur = ytDuration();
                if (!r.width || !dur) return null;
                return dur * Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            };

            tl.addEventListener('pointerdown', e => {
                if (e.button !== undefined && e.button !== 0) return;
                if (!ytReady || !ytDuration()) {
                    showToast('Video is still loading…', 'info');
                    return;
                }
                const pin = e.target.closest ? e.target.closest('.ve-tl-pin') : null;
                if (pin && skipSelectStep === 0 && currentMode === MODE.EDIT) {
                    ytSeekTo(Number(pin.dataset.time) || 0);
                    ytPause();
                    updateTimelineUI();
                    return;
                }
                const t = timeAt(e);
                if (t === null) return;

                if (skipSelectStep > 0) {
                    commitSkipPoint(t);
                    return;
                }
                tlDragging = true;
                tlDragTime = t;
                try { tl.setPointerCapture(e.pointerId); } catch (_) { }
                updateTimelineUI();
                e.preventDefault();
            });

            tl.addEventListener('pointermove', e => {
                const t = timeAt(e);
                if (t === null) return;
                if (tip) {
                    const r = tl.getBoundingClientRect();
                    tip.textContent = formatTime(t);
                    tip.style.left = (e.clientX - r.left) + 'px';
                    tip.classList.remove('hidden');
                }
                if (tlDragging) {
                    tlDragTime = t;
                    updateTimelineUI();
                }
                if (skipSelectStep === 2) updatePendingBlock(t);
            });

            const endDrag = e => {
                if (!tlDragging) return;
                tlDragging = false;
                const t = timeAt(e);
                try { tl.releasePointerCapture(e.pointerId); } catch (_) { }
                seekFromTimeline(t === null ? tlDragTime : t);
            };
            tl.addEventListener('pointerup', endDrag);
            tl.addEventListener('pointercancel', () => {
                tlDragging = false;
                updateTimelineUI();
            });
            tl.addEventListener('pointerleave', () => {
                if (tip) tip.classList.add('hidden');
                if (skipSelectStep === 2) updatePendingBlock(null);
            });

            tl.addEventListener('keydown', e => {
                if (!ytReady) return;
                const dur = ytDuration();
                let handled = true;
                if (e.key === 'ArrowLeft') seekFromTimeline(ytCurrentTime() - 5);
                else if (e.key === 'ArrowRight') seekFromTimeline(ytCurrentTime() + 5);
                else if (e.key === 'Home') seekFromTimeline(0);
                else if (e.key === 'End') seekFromTimeline(dur);
                else handled = false;
                if (handled) e.preventDefault();
            });
        }

        // Top toolbar
        const btnQ = tlById('btnTopAddQuestion');
        if (btnQ) {
            btnQ.addEventListener('click', () => {
                cancelSkipSelection();
                ytPause();
                openQuestionModal(null, ytCurrentTime());
            });
        }
        const btnS = tlById('btnTopAddSkip');
        if (btnS) btnS.addEventListener('click', onTopAddSkipClick);
        const btnSQ = tlById('btnAddSkipQuick');
        if (btnSQ) btnSQ.addEventListener('click', onTopAddSkipClick);
        const btnC = tlById('btnCancelSkipSelection');
        if (btnC) btnC.addEventListener('click', cancelSkipSelection);

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && skipSelectStep > 0) cancelSkipSelection();
        });

        // Availability dates
        ['settingStartDate', 'settingEndDate'].forEach(id => {
            const el = tlById(id);
            if (!el) return;
            el.addEventListener('input', validateAvailability);
            el.addEventListener('change', validateAvailability);
        });
    }

    function genId(prefix) {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function formatTime(sec) {
        if (!sec || isNaN(sec) || sec < 0) {
            sec = 0;
        }

        const s = Math.floor(sec);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const ss = s % 60;

        const pad = n => String(n).padStart(2, '0');

        return h > 0
            ? `${h}:${pad(m)}:${pad(ss)}`
            : `${pad(m)}:${pad(ss)}`;
    }

    function parseTime(str) {
        if (typeof str === 'number') {
            return str >= 0 ? str : null;
        }

        if (!str || typeof str !== 'string') {
            return null;
        }

        const t = str.trim();

        if (!isNaN(t)) {
            const v = parseFloat(t);
            return v >= 0 ? v : null;
        }

        const parts = t.split(':').map(p => p.trim());

        if (
            parts.some(
                p => isNaN(p) || p === ''
            )
        ) {
            return null;
        }

        if (parts.length === 2) {
            return (
                parseInt(parts[0]) * 60 +
                parseFloat(parts[1])
            );
        }

        if (parts.length === 3) {
            return (
                parseInt(parts[0]) * 3600 +
                parseInt(parts[1]) * 60 +
                parseFloat(parts[2])
            );
        }

        return null;
    }

    function extractYtId(url) {
        if (!url) return null;

        const u = url.trim();

        if (
            /^[a-zA-Z0-9_-]{11}$/.test(u)
        ) {
            return u;
        }

        const m = u.match(
            /(?:youtu\.be\/|v\/|watch\?v=|embed\/|&v=)([a-zA-Z0-9_-]{11})/
        );

        return m ? m[1] : null;
    }

    function escapeHtml(v) {
        if (
            v === null ||
            v === undefined
        ) {
            return '';
        }

        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(s) {
        if (!s) return '–';

        return new Date(s).toLocaleDateString(
            'en-IN',
            {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }
        );
    }

    function showToast(
        msg,
        type = 'info'
    ) {
        const container =
            document.getElementById(
                'veToastContainer'
            );

        if (!container) return;

        const t =
            document.createElement('div');

        t.className =
            `ve-toast ve-toast-${type}`;

        t.textContent = msg;

        container.appendChild(t);

        setTimeout(
            () => t.classList.add('visible'),
            10
        );

        setTimeout(() => {
            t.classList.remove('visible');

            setTimeout(
                () => t.remove(),
                300
            );
        }, 3000);
    }


    // ─────────────────────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────────────────────

    document.addEventListener(
        'DOMContentLoaded',
        async () => {

            restoreAdminSession();

            setupEvents();

            await loadCourses();

            if (!presetCourseId) {
                showMissingCourseState();
                return;
            }

            selectedCourse =
                allCourses.find(
                    c =>
                        String(c.offering_id) ===
                        String(presetCourseId)
                ) || null;

            if (!selectedCourse) {
                showMissingCourseState(
                    'The selected course could not be found.'
                );
                return;
            }

            document.getElementById(
                'courseLabel'
            ).textContent =
                selectedCourse.course_name;

            document.getElementById(
                'courseDesc'
            ).textContent =
                `Videos for ${selectedCourse.course_name}`;

            document.getElementById(
                'pageSubtitle'
            ).textContent =
                `Manage videos for ${selectedCourse.course_name}`;

            await loadVideos();
        }
    );


    function showMissingCourseState(
        message =
            'Select a course from Courses to manage its videos.'
    ) {

        document.getElementById(
            'courseLabel'
        ).textContent =
            'Course Required';

        document.getElementById(
            'courseDesc'
        ).textContent = message;

        document.getElementById(
            'videosGrid'
        ).innerHTML = `
            <div class="ve-empty-state">

                <div class="ve-empty-icon">
                    ${window.ELIcon('book')}
                </div>

                <strong>
                    Select a course first
                </strong>

                <p>
                    ${escapeHtml(message)}
                </p>

                <button
                    class="primary-btn"
                    onclick="window.location.href='courses.html'">
                    ${window.ELIcon("arrowLeft")} Back to Courses
                </button>

            </div>
        `;

        document.getElementById(
            'addVideoBtn'
        ).disabled = true;
    }


    // ─────────────────────────────────────────────────────────────
    // SESSION
    // ─────────────────────────────────────────────────────────────

    function restoreAdminSession() {

        const raw =
            localStorage.getItem(
                'edulearn_user'
            );

        const role =
            localStorage.getItem(
                'edulearn_role'
            );

        if (
            !raw ||
            role !== 'admin'
        ) {
            window.location.href =
                'index.html';

            return;
        }

        try {

            const u =
                JSON.parse(raw);

            document.getElementById(
                'adminEmail'
            ).textContent =
                u.email || '';

        } catch {

            localStorage.removeItem(
                'edulearn_user'
            );

            localStorage.removeItem(
                'edulearn_role'
            );

            window.location.href =
                'index.html';
        }
    }


    function logoutAdmin() {

        localStorage.removeItem(
            'edulearn_user'
        );

        localStorage.removeItem(
            'edulearn_role'
        );

        window.location.href =
            'index.html';
    }


    // ─────────────────────────────────────────────────────────────
    // EVENT SETUP
    // ─────────────────────────────────────────────────────────────

    function setupEvents() {

        document
            .getElementById('adminLogout')
            .addEventListener(
                'click',
                logoutAdmin
            );


        // Video list
        document.getElementById('btnCC')
            .addEventListener('click', () => {
                toggleCaptions();
                showPlayerUI();
            }
            );

        document
            .getElementById('addVideoBtn')
            .addEventListener(
                'click',
                openAddVideoModal
            );

        document
            .getElementById('videoSearch')
            .addEventListener(
                'input',
                filterVideos
            );


        // Video modal

        document
            .getElementById('closeVideoModal')
            .addEventListener(
                'click',
                closeVideoModal
            );

        document
            .getElementById('cancelVideoModal')
            .addEventListener(
                'click',
                closeVideoModal
            );

        document
            .getElementById('saveVideoBtn')
            .addEventListener(
                'click',
                saveVideo
            );


        // Editor top bar

        document
            .getElementById('btnBackToList')
            .addEventListener(
                'click',
                closeEditor
            );

        document
            .getElementById('btnModeEdit')
            .addEventListener(
                'click',
                () =>
                    switchEditorMode(
                        MODE.EDIT
                    )
            );

        document
            .getElementById('btnModePreview')
            .addEventListener(
                'click',
                () =>
                    switchEditorMode(
                        MODE.PREVIEW
                    )
            );

        document
            .getElementById('btnPublishVideo')
            .addEventListener(
                'click',
                saveVideoToDB
            );


        // Player controls

        document
            .getElementById('btnPlayPause')
            .addEventListener(
                'click',
                togglePlayPause
            );

        document
            .getElementById('btnSeekBack')
            .addEventListener(
                'click',
                () => seekBy(-10)
            );

        document
            .getElementById('btnSeekFwd')
            .addEventListener(
                'click',
                () => seekBy(10)
            );

        document
            .getElementById('btnMute')
            .addEventListener(
                'click',
                toggleMute
            );

        document
            .getElementById('veVolumeSlider')
            .addEventListener(
                'input',
                e =>
                    setVolume(
                        Number(e.target.value)
                    )
            );

        document
            .getElementById('btnFullscreen')
            .addEventListener(
                'click',
                toggleFullscreen
            );

        document
            .getElementById('veClickShield')
            .addEventListener(
                'click',
                onClickShield
            );


        // Admin quick controls

        const btnAddQuestionHere =
            document.getElementById('btnAddQuestionHere');

        if (btnAddQuestionHere) {
            btnAddQuestionHere.addEventListener(
                'click',
                () => {
                    ytPause();

                    openQuestionModal(
                        null,
                        ytCurrentTime()
                    );
                }
            );
        }

        document
            .getElementById('btnSkipStart')
            .addEventListener(
                'click',
                markSkipStart
            );

        document
            .getElementById('btnSkipEnd')
            .addEventListener(
                'click',
                markSkipEnd
            );

        document
            .getElementById('btnConfirmSkip')
            .addEventListener(
                'click',
                confirmSkip
            );


        // Settings

        document
            .getElementById('settingBlockForward')
            .addEventListener(
                'change',
                e => {
                    editorSettings.blockForward =
                        e.target.checked;
                }
            );

        document
            .getElementById('settingPauseAtQuestions')
            .addEventListener(
                'change',
                e => {
                    editorSettings.pauseAtQuestions =
                        e.target.checked;
                }
            );

        document
            .getElementById('settingPlaybackSpeed')
            .addEventListener(
                'change',
                e => {
                    editorSettings.playbackSpeed =
                        normalizePlaybackSpeed(
                            Number(e.target.value)
                        );
                    updateStudentPlaybackSpeeds();
                }
            );

        document
            .getElementById('vePlaybackSpeed')
            .addEventListener(
                'change',
                e => {
                    if (currentMode === MODE.PREVIEW) {
                        setStudentPlaybackSpeed(Number(e.target.value));
                    }
                }
            );


        // Timeline


        // Question modal

        document
            .getElementById('closeQuestionModal')
            .addEventListener(
                'click',
                closeQuestionModal
            );

        document
            .getElementById('cancelQuestionModal')
            .addEventListener(
                'click',
                closeQuestionModal
            );

        document
            .getElementById('saveQuestionBtn')
            .addEventListener(
                'click',
                saveQuestion
            );

        document
            .getElementById('btnOpenQModal')
            .addEventListener(
                'click',
                () => {
                    ytPause();

                    openQuestionModal(
                        null,
                        ytCurrentTime()
                    );
                }
            );

        document
            .getElementById('qTimestamp')
            .addEventListener(
                'input',
                updateTimestampHint
            );

        document
            .getElementById('btnSyncTime')
            .addEventListener(
                'click',
                syncCurrentTime
            );


        // Student quiz

        document
            .getElementById('btnSubmitAnswer')
            .addEventListener(
                'click',
                submitAnswer
            );

        setupTimelineAndToolbar();
        initPlayerIdleUI();
    }


    // ─────────────────────────────────────────────────────────────
    // LOAD COURSES
    // ─────────────────────────────────────────────────────────────

    async function loadCourses() {

        /*
         * Videos belong to a course OFFERING
         * (course + academic year + regulation + semester).
         *
         * allCourses keeps the same shape the rest of this file
         * already uses, with course_name showing the offering's
         * course plus its academic year / regulation / semester,
         * e.g. "Data Structures · 2026-27 · R23 · Semester 3".
         */

        const { data, error } =
            await supabaseClient
                .from('course_offerings')
                .select(`
                    id,
                    courses ( course_name ),
                    academic_years ( label ),
                    regulations ( code ),
                    semesters ( name )
                `)
                .order('id');

        if (error) {
            console.error(error);
            return;
        }

        allCourses = (data || []).map(row => ({
            offering_id: row.id,
            course_name: [
                row.courses?.course_name || 'Course',
                row.academic_years?.label,
                row.regulations?.code,
                row.semesters?.name
            ].filter(Boolean).join(' · ')
        }));

        populateCourseDropdowns();
    }


    function populateCourseDropdowns() {

        /*
         * The selected course comes from:
         *
         * videos.html?offering_id=123
         *
         * Therefore the course cannot be changed
         * from this page.
         */

        const inputEl =
            document.getElementById(
                'videoCourseInput'
            );

        if (inputEl) {
            inputEl.value =
                presetCourseId || '';
        }
    }


    // ─────────────────────────────────────────────────────────────
    // LOAD VIDEOS
    // ─────────────────────────────────────────────────────────────

    async function loadVideos() {

        let query =
            supabaseClient
                .from('videos')
                .select('*')
                .order(
                    'display_order',
                    {
                        ascending: true
                    }
                )
                .order(
                    'created_at',
                    {
                        ascending: true
                    }
                )
                .order(
                    'video_id',
                    {
                        ascending: true
                    }
                );

        if (presetCourseId) {

            query =
                query.eq(
                    'offering_id',
                    presetCourseId
                );
        }

        const { data, error } =
            await query;

        if (error) {
            console.error(error);
            return;
        }

        allVideos =
            (data || []).sort(
                compareVideoOrder
            );

        renderVideos(allVideos);
    }


    // ─────────────────────────────────────────────────────────────
    // RENDER VIDEO GRID
    // ─────────────────────────────────────────────────────────────

    function renderVideos(list) {

        const grid =
            document.getElementById(
                'videosGrid'
            );

        if (
            !list ||
            list.length === 0
        ) {

            grid.innerHTML = `
                <div class="ve-empty-state">

                    <div class="ve-empty-icon">
                        ${window.ELIcon('video')}
                    </div>

                    <strong>
                        No videos found
                    </strong>

                    <p>
                        Add a video to get started
                    </p>

                </div>
            `;

            return;
        }


        /*
         * IMPORTANT:
         *
         * We sort using the real display_order.
         * Search/filtering does NOT change
         * the actual position.
         */

        const orderedList =
            [...list].sort(
                compareVideoOrder
            );


        grid.innerHTML =
            orderedList.map(
                v => {

                    const course =
                        allCourses.find(
                            c =>
                                c.offering_id ===
                                v.offering_id
                        );

                    const ytId =
                        extractYtId(
                            v.youtube_url
                        );

                    const thumb =
                        ytId
                            ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
                            : '';


                    const fullIndex =
                        allVideos.findIndex(
                            item =>
                                Number(
                                    item.video_id
                                ) ===
                                Number(
                                    v.video_id
                                )
                        );


                    const position =
                        Number(
                            v.display_order
                        ) ||
                        (fullIndex + 1);


                    const isFirst =
                        fullIndex <= 0;

                    const isLast =
                        fullIndex ===
                        allVideos.length - 1;


                    return `
                        <div
                            class="ve-video-card"
                            data-id="${v.video_id}">

                            ${thumb
                            ? `
                                        <div
                                            class="ve-video-thumb"
                                            style="background-image:url('${thumb}')">
                                        </div>
                                    `
                            : `
                                        <div
                                            class="ve-video-thumb ve-video-thumb-empty">
                                            ${window.ELIcon('video')}
                                        </div>
                                    `
                        }


                            <div class="ve-video-card-body">

                                <h3
                                    class="ve-video-card-title">

                                    ${escapeHtml(
                            v.video_title
                        )}

                                </h3>


                                <p
                                    class="ve-video-card-meta">

                                    <span class="ve-tag">
                                        Video ${position}
                                    </span>

                                    <span class="ve-tag">

                                        ${course
                            ? escapeHtml(
                                course.course_name
                            )
                            : 'No Course'
                        }

                                    </span>

                                    <span class="ve-date">
                                        Added ${formatDate(
                            v.created_at
                        )}
                                    </span>
                                    ${availabilityChip(v)}

                                </p>


                                ${v.description
                            ? `
                                            <p class="ve-video-desc">
                                                ${escapeHtml(
                                v.description
                            )}
                                            </p>
                                        `
                            : ''
                        }

                            </div>


                            <div class="ve-video-card-footer">

                                <div
                                    class="ve-video-order-controls"
                                    title="Change video position">

                                    <button
                                        class="action-btn ve-order-btn"
                                        ${isFirst
                            ? 'disabled'
                            : ''
                        }
                                        onclick="window.moveVideo(${v.video_id}, 'up')"
                                        aria-label="Move Video ${position} up">
                                        ↑
                                    </button>


                                    <span
                                        class="ve-position-label">
                                        ${position}
                                    </span>


                                    <button
                                        class="action-btn ve-order-btn"
                                        ${isLast
                            ? 'disabled'
                            : ''
                        }
                                        onclick="window.moveVideo(${v.video_id}, 'down')"
                                        aria-label="Move Video ${position} down">
                                        ↓
                                    </button>

                                </div>


                                <button
                                    class="action-btn edit-btn"
                                    onclick="window.openVideoEditor(${v.video_id})">
                                    ${window.ELIcon("edit")} Edit Video
                                </button>


                                <button
                                    class="action-btn delete-btn"
                                    onclick="window.deleteVideo(${v.video_id})">
                                    Delete
                                </button>

                            </div>

                        </div>
                    `;
                }
            ).join('');
    }


    // Expose inline functions

    window.openVideoEditor =
        openVideoEditor;

    window.deleteVideo =
        deleteVideo;

    window.moveVideo =
        moveVideo;


    // ─────────────────────────────────────────────────────────────
    // VIDEO ORDERING
    // ─────────────────────────────────────────────────────────────

    function compareVideoOrder(
        a,
        b
    ) {

        const ao =
            a.display_order === null ||
                a.display_order === undefined
                ? Number.MAX_SAFE_INTEGER
                : Number(a.display_order);

        const bo =
            b.display_order === null ||
                b.display_order === undefined
                ? Number.MAX_SAFE_INTEGER
                : Number(b.display_order);


        if (ao !== bo) {
            return ao - bo;
        }


        const at =
            new Date(
                a.created_at || 0
            ).getTime();

        const bt =
            new Date(
                b.created_at || 0
            ).getTime();


        if (at !== bt) {
            return at - bt;
        }


        return (
            Number(a.video_id) -
            Number(b.video_id)
        );
    }


    async function getCourseVideosForOrdering(
        courseId
    ) {

        const { data, error } =
            await supabaseClient
                .from('videos')
                .select(
                    'video_id, offering_id, display_order, created_at'
                )
                .eq(
                    'offering_id',
                    courseId
                );

        if (error) {
            throw error;
        }

        return (data || [])
            .sort(compareVideoOrder);
    }


    async function normalizeVideoPositions(
        courseId
    ) {

        const videos =
            await getCourseVideosForOrdering(
                courseId
            );


        for (
            let i = 0;
            i < videos.length;
            i++
        ) {

            const desired =
                i + 1;


            if (
                Number(
                    videos[i].display_order
                ) !== desired
            ) {

                const { error } =
                    await supabaseClient
                        .from('videos')
                        .update({
                            display_order:
                                desired
                        })
                        .eq(
                            'video_id',
                            videos[i].video_id
                        );


                if (error) {
                    throw error;
                }
            }
        }
    }


    async function moveVideo(
        videoId,
        direction
    ) {

        const current =
            allVideos.find(
                v =>
                    Number(
                        v.video_id
                    ) ===
                    Number(videoId)
            );


        if (!current) {
            return;
        }


        /*
         * Always get the complete course list
         * from Supabase.
         *
         * This is important when search is active.
         */

        const courseVideos =
            await getCourseVideosForOrdering(
                current.offering_id
            );


        const currentIndex =
            courseVideos.findIndex(
                v =>
                    Number(
                        v.video_id
                    ) ===
                    Number(videoId)
            );


        if (currentIndex < 0) {
            return;
        }


        const targetIndex =
            direction === 'up'
                ? currentIndex - 1
                : currentIndex + 1;


        if (
            targetIndex < 0 ||
            targetIndex >= courseVideos.length
        ) {
            return;
        }


        const other =
            courseVideos[targetIndex];


        try {

            /*
             * Temporary position prevents
             * unique constraint collisions.
             */

            const { error: tempError } =
                await supabaseClient
                    .from('videos')
                    .update({
                        display_order: -1
                    })
                    .eq(
                        'video_id',
                        videoId
                    );


            if (tempError) {
                throw tempError;
            }


            /*
             * Move the other video
             * into current position.
             */

            const {
                error: otherError
            } =
                await supabaseClient
                    .from('videos')
                    .update({
                        display_order:
                            currentIndex + 1
                    })
                    .eq(
                        'video_id',
                        other.video_id
                    );


            if (otherError) {
                throw otherError;
            }


            /*
             * Move current video
             * into target position.
             */

            const {
                error: currentError
            } =
                await supabaseClient
                    .from('videos')
                    .update({
                        display_order:
                            targetIndex + 1
                    })
                    .eq(
                        'video_id',
                        videoId
                    );


            if (currentError) {
                throw currentError;
            }


            /*
             * Normalize positions.
             */

            await normalizeVideoPositions(
                current.offering_id
            );


            await loadVideos();

            filterVideos();


            showToast(
                direction === 'up'
                    ? 'Video moved up.'
                    : 'Video moved down.',
                'success'
            );

        } catch (err) {

            console.error(err);

            alert(
                err.message ||
                'Failed to change video position.'
            );

            await loadVideos();

            filterVideos();
        }
    }


    // ─────────────────────────────────────────────────────────────
    // FILTER
    // ─────────────────────────────────────────────────────────────

    function filterVideos() {

        const search =
            document
                .getElementById(
                    'videoSearch'
                )
                .value
                .trim()
                .toLowerCase();


        /*
         * Filtering only controls visibility.
         *
         * It does NOT modify display_order.
         */

        const filtered =
            allVideos.filter(
                v =>
                    !search ||
                    (
                        v.video_title ||
                        ''
                    )
                        .toLowerCase()
                        .includes(search)
            );


        renderVideos(filtered);


        const course =
            allCourses.find(
                c =>
                    String(c.offering_id) ===
                    String(presetCourseId)
            );


        document.getElementById(
            'courseLabel'
        ).textContent =
            course
                ? course.course_name
                : 'Course Videos';


        document.getElementById(
            'courseDesc'
        ).textContent =
            course
                ? `Videos for ${course.course_name}`
                : 'Manage videos for the selected course';
    }


    // ─────────────────────────────────────────────────────────────
    // VIDEO MODAL
    // ─────────────────────────────────────────────────────────────

    function openAddVideoModal() {

        editingVideoId = null;

        document.getElementById(
            'videoModalTitle'
        ).textContent =
            'Add Video';


        document.getElementById(
            'videoTitleInput'
        ).value = '';


        document.getElementById(
            'videoUrlInput'
        ).value = '';


        document.getElementById(
            'videoDescriptionInput'
        ).value = '';


        document.getElementById(
            'videoCourseInput'
        ).value =
            presetCourseId || '';


        document.getElementById(
            'videoModalMessage'
        ).textContent = '';


        document.getElementById(
            'videoModal'
        ).style.display =
            'flex';
    }


    function openEditVideoModal(
        videoId
    ) {

        const v =
            allVideos.find(
                v =>
                    v.video_id ===
                    videoId
            );


        if (!v) return;


        editingVideoId =
            videoId;


        document.getElementById(
            'videoModalTitle'
        ).textContent =
            'Edit Video';


        document.getElementById(
            'videoTitleInput'
        ).value =
            v.video_title;


        document.getElementById(
            'videoUrlInput'
        ).value =
            v.youtube_url;


        document.getElementById(
            'videoDescriptionInput'
        ).value =
            v.description || '';


        document.getElementById(
            'videoCourseInput'
        ).value =
            presetCourseId ||
            v.offering_id;


        document.getElementById(
            'videoModalMessage'
        ).textContent =
            '';


        document.getElementById(
            'videoModal'
        ).style.display =
            'flex';
    }


    function closeVideoModal() {

        document.getElementById(
            'videoModal'
        ).style.display =
            'none';

        editingVideoId =
            null;
    }


    // ─────────────────────────────────────────────────────────────
    // SAVE VIDEO
    // ─────────────────────────────────────────────────────────────

    async function saveVideo() {

        const title =
            document
                .getElementById(
                    'videoTitleInput'
                )
                .value
                .trim();


        const url =
            document
                .getElementById(
                    'videoUrlInput'
                )
                .value
                .trim();


        const description =
            document
                .getElementById(
                    'videoDescriptionInput'
                )
                .value
                .trim();


        const courseId =
            presetCourseId ||
            document
                .getElementById(
                    'videoCourseInput'
                )
                .value;


        const msgEl =
            document.getElementById(
                'videoModalMessage'
            );


        if (!title) {
            setMsg(
                msgEl,
                'Please enter a video title.',
                'error'
            );

            return;
        }


        if (!url) {
            setMsg(
                msgEl,
                'Please enter a YouTube URL.',
                'error'
            );

            return;
        }


        if (!courseId) {
            setMsg(
                msgEl,
                'Please select a course.',
                'error'
            );

            return;
        }


        const saveBtn =
            document.getElementById(
                'saveVideoBtn'
            );


        saveBtn.disabled = true;
        saveBtn.textContent =
            'Saving…';


        try {

            if (editingVideoId) {

                /*
                 * Editing a video does not change
                 * its position.
                 */

                const { error } =
                    await supabaseClient
                        .from('videos')
                        .update({
                            video_title:
                                title,

                            youtube_url:
                                url,

                            description:
                                description ||
                                null,

                            offering_id:
                                Number(
                                    courseId
                                ),

                            updated_at:
                                new Date()
                                    .toISOString()
                        })
                        .eq(
                            'video_id',
                            editingVideoId
                        );


                if (error) {
                    throw error;
                }


                setMsg(
                    msgEl,
                    'Video updated.',
                    'success'
                );

            } else {

                /*
                 * NEW VIDEO
                 *
                 * Always goes to the last
                 * position.
                 */

                const courseVideos =
                    await getCourseVideosForOrdering(
                        Number(courseId)
                    );


                const nextPosition =
                    courseVideos.length + 1;


                const { error } =
                    await supabaseClient
                        .from('videos')
                        .insert({
                            video_title:
                                title,

                            youtube_url:
                                url,

                            description:
                                description ||
                                null,

                            offering_id:
                                Number(
                                    courseId
                                ),

                            display_order:
                                nextPosition
                        });


                if (error) {
                    throw error;
                }


                setMsg(
                    msgEl,
                    `Video created as Video ${nextPosition}.`,
                    'success'
                );
            }


            await loadVideos();

            filterVideos();


            setTimeout(
                closeVideoModal,
                700
            );


        } catch (err) {

            console.error(err);

            setMsg(
                msgEl,
                err.message ||
                'Failed to save.',
                'error'
            );

        } finally {

            saveBtn.disabled = false;

            saveBtn.textContent =
                'Save Video';
        }
    }


    // ─────────────────────────────────────────────────────────────
    // DELETE VIDEO
    // ─────────────────────────────────────────────────────────────

    async function deleteVideo(
        videoId
    ) {

        const v =
            allVideos.find(
                v =>
                    v.video_id ===
                    videoId
            );


        if (
            !v ||
            !confirm(
                `Delete "${v.video_title}"?\n\n` +
                `All questions and skips will also be removed.`
            )
        ) {
            return;
        }


        try {

            // Delete questions

            await supabaseClient
                .from('video_questions')
                .delete()
                .eq(
                    'video_id',
                    videoId
                );


            // Delete skips

            await supabaseClient
                .from('video_skips')
                .delete()
                .eq(
                    'video_id',
                    videoId
                );


            // Delete video

            const { error } =
                await supabaseClient
                    .from('videos')
                    .delete()
                    .eq(
                        'video_id',
                        videoId
                    );


            if (error) {
                throw error;
            }


            /*
             * Re-number remaining videos.
             */

            await normalizeVideoPositions(
                v.offering_id
            );


            if (
                editorVideoId ===
                videoId
            ) {
                closeEditor();
            }


            await loadVideos();

            filterVideos();


            showToast(
                'Video deleted and positions updated.',
                'success'
            );


        } catch (err) {

            console.error(err);

            alert(
                err.message ||
                'Failed to delete video.'
            );
        }
    }


    function setMsg(
        el,
        msg,
        type
    ) {

        el.textContent =
            msg;

        el.className =
            `modal-message ${type}`;
    }


    // ─────────────────────────────────────────────────────────────
    // OPEN / CLOSE EDITOR
    // ─────────────────────────────────────────────────────────────

    async function openVideoEditor(
        videoId
    ) {

        const v =
            allVideos.find(
                v =>
                    v.video_id ===
                    videoId
            );


        if (!v) return;


        editorVideoId =
            videoId;

        editorVideoRow =
            v;


        editorQuestions =
            [];

        editorSkips =
            [];

        skipStartMark =
            null;

        skipEndMark =
            null;

        currentMode =
            MODE.EDIT;

        resetStudentState();
        cancelSkipSelection();
        switchEditorMode(MODE.EDIT);


        await loadQuestionsFromDB(
            videoId
        );

        await loadSkipsFromDB(
            videoId
        );


        editorSettings.blockForward =
            v.block_forward_seek !==
            false;

        editorSettings.pauseAtQuestions =
            v.pause_at_questions !==
            false;

        editorSettings.playbackSpeed =
            normalizePlaybackSpeed(
                Number(v.playback_speed) || 1.00
            );


        document.getElementById(
            'settingBlockForward'
        ).checked =
            editorSettings.blockForward;


        document.getElementById(
            'settingPauseAtQuestions'
        ).checked =
            editorSettings.pauseAtQuestions;

        document.getElementById(
            'settingPlaybackSpeed'
        ).value =
            editorSettings.playbackSpeed.toFixed(2);

        loadAvailabilityInputs(v);
        updateStudentPlaybackSpeeds();


        document.getElementById(
            'editorVideoTitle'
        ).textContent =
            v.video_title;


        const course =
            allCourses.find(
                c =>
                    c.offering_id ===
                    v.offering_id
            );


        document.getElementById(
            'editorVideoMeta'
        ).textContent =
            course
                ? course.course_name
                : '';


        document.getElementById(
            'veListPanel'
        ).classList.add(
            've-panel-collapsed'
        );


        document.getElementById(
            'veEditorPanel'
        ).classList.remove(
            'hidden'
        );


        setModeBadge(
            MODE.EDIT
        );


        renderEditorUI();
        resetTimelineUI();


        const ytId =
            extractYtId(
                v.youtube_url
            );


        if (ytId) {

            initYouTubePlayer(
                ytId
            );

        } else {

            showToast(
                'Could not extract YouTube video ID from URL.',
                'warning'
            );
        }


        if (tickInterval) {
            clearInterval(
                tickInterval
            );
        }


        tickInterval =
            setInterval(
                tick,
                200
            );
    }


    function closeEditor() {
        cancelSkipSelection();
        resetTimelineUI();

        if (tickInterval) {

            clearInterval(
                tickInterval
            );

            tickInterval =
                null;
        }


        ytPause();

        destroyYouTubePlayer();


        editorVideoId =
            null;

        editorVideoRow =
            null;


        document.getElementById(
            'veListPanel'
        ).classList.remove(
            've-panel-collapsed'
        );


        document.getElementById(
            'veEditorPanel'
        ).classList.add(
            'hidden'
        );
    }


    // ─────────────────────────────────────────────────────────────
    // LOAD QUESTIONS
    // ─────────────────────────────────────────────────────────────

    async function loadQuestionsFromDB(
        videoId
    ) {

        const { data, error } =
            await supabaseClient
                .from('video_questions')
                .select(
                    'question_id, timestamp_seconds, question_text, explanation, question_options(option_id, option_text, option_order, is_correct)'
                )
                .eq(
                    'video_id',
                    videoId
                )
                .order(
                    'timestamp_seconds'
                );


        if (error) {
            console.error(error);
            return;
        }


        editorQuestions =
            (data || []).map(
                q => {

                    const opts =
                        (
                            q.question_options ||
                            []
                        ).sort(
                            (a, b) =>
                                a.option_order -
                                b.option_order
                        );


                    const correct =
                        opts.findIndex(
                            o =>
                                o.is_correct
                        );


                    return {

                        id:
                            String(
                                q.question_id
                            ),

                        dbId:
                            q.question_id,

                        time:
                            q.timestamp_seconds,

                        question:
                            q.question_text,

                        explanation:
                            q.explanation ||
                            '',

                        options:
                            opts.map(
                                o =>
                                    o.option_text
                            ),

                        correctAnswer:
                            correct >= 0
                                ? correct
                                : 0,

                        optionIds:
                            opts.map(
                                o =>
                                    o.option_id
                            )
                    };
                }
            );
    }


    async function loadSkipsFromDB(
        videoId
    ) {

        const { data, error } =
            await supabaseClient
                .from('video_skips')
                .select(
                    'skip_id, start_time_seconds, end_time_seconds'
                )
                .eq(
                    'video_id',
                    videoId
                )
                .order(
                    'start_time_seconds'
                );


        if (error) {
            console.error(error);
            return;
        }


        editorSkips =
            (data || []).map(
                s => ({

                    id:
                        String(
                            s.skip_id
                        ),

                    dbId:
                        s.skip_id,

                    start:
                        s.start_time_seconds,

                    end:
                        s.end_time_seconds

                })
            );
    }


    // ─────────────────────────────────────────────────────────────
    // SAVE EDITOR DATA
    // ─────────────────────────────────────────────────────────────

    async function saveVideoToDB() {

        if (!editorVideoId) {
            return;
        }

        if (!validateAvailability()) {
            showToast('End date cannot be earlier than the start date.', 'error');
            return;
        }
        const startDateValue = document.getElementById('settingStartDate').value || null;
        const endDateValue = document.getElementById('settingEndDate').value || null;



        const btn =
            document.getElementById(
                'btnPublishVideo'
            );


        btn.disabled = true;

        btn.textContent =
            'Saving…';


        try {

            // 1. Save settings (including start / end date)
            const { error: settingsErr } = await supabaseClient
                .from('videos')
                .update({
                    block_forward_seek: editorSettings.blockForward,
                    pause_at_questions: editorSettings.pauseAtQuestions,
                    playback_speed: editorSettings.playbackSpeed,
                    start_date: startDateValue,
                    end_date: endDateValue,
                    updated_at: new Date().toISOString()
                })
                .eq('video_id', editorVideoId);

            if (settingsErr) {
                if (/start_date|end_date/i.test(String(settingsErr.message || ''))) {
                    throw new Error(
                        'The "videos" table needs start_date and end_date columns (type: date). ' +
                        'Add them in Supabase, then save again.'
                    );
                }
                console.warn('Video settings were not saved:', settingsErr);
            } else if (editorVideoRow) {
                editorVideoRow.start_date = startDateValue;
                editorVideoRow.end_date = endDateValue;
                editorVideoRow.block_forward_seek = editorSettings.blockForward;
                editorVideoRow.pause_at_questions = editorSettings.pauseAtQuestions;
                editorVideoRow.playback_speed = editorSettings.playbackSpeed;
            }


            // 2. Delete existing questions

            await supabaseClient
                .from('question_options')
                .delete()
                .in(
                    'question_id',

                    (
                        await supabaseClient
                            .from(
                                'video_questions'
                            )
                            .select(
                                'question_id'
                            )
                            .eq(
                                'video_id',
                                editorVideoId
                            )
                    )
                        .data
                        ?.map(
                            r =>
                                r.question_id
                        ) || []
                );


            await supabaseClient
                .from('video_questions')
                .delete()
                .eq(
                    'video_id',
                    editorVideoId
                );


            // 3. Insert questions

            for (
                const q of editorQuestions
            ) {

                const {
                    data: qInserted,
                    error: qErr
                } =
                    await supabaseClient
                        .from(
                            'video_questions'
                        )
                        .insert({
                            video_id:
                                editorVideoId,

                            timestamp_seconds:
                                Math.round(
                                    q.time
                                ),

                            question_text:
                                q.question,

                            explanation:
                                q.explanation ||
                                null
                        })
                        .select(
                            'question_id'
                        )
                        .single();


                if (qErr) {
                    throw qErr;
                }


                const optRows =
                    q.options.map(
                        (
                            text,
                            i
                        ) => ({

                            question_id:
                                qInserted.question_id,

                            option_text:
                                text,

                            option_order:
                                i,

                            is_correct:
                                i ===
                                q.correctAnswer

                        })
                    );


                const {
                    error: optErr
                } =
                    await supabaseClient
                        .from(
                            'question_options'
                        )
                        .insert(
                            optRows
                        );


                if (optErr) {
                    throw optErr;
                }
            }


            // 4. Delete skips

            await supabaseClient
                .from('video_skips')
                .delete()
                .eq(
                    'video_id',
                    editorVideoId
                );


            // 5. Insert skips

            if (
                editorSkips.length > 0
            ) {

                const skipRows =
                    editorSkips.map(
                        s => ({

                            video_id:
                                editorVideoId,

                            start_time_seconds:
                                Math.round(
                                    s.start
                                ),

                            end_time_seconds:
                                Math.round(
                                    s.end
                                )

                        })
                    );


                const {
                    error: skipErr
                } =
                    await supabaseClient
                        .from(
                            'video_skips'
                        )
                        .insert(
                            skipRows
                        );


                if (skipErr) {
                    throw skipErr;
                }
            }


            await loadQuestionsFromDB(
                editorVideoId
            );

            await loadSkipsFromDB(
                editorVideoId
            );


            filterVideos();
            renderEditorUI();


            showToast(
                `Saved: ${editorQuestions.length} question(s), ${editorSkips.length} skip(s)`,
                'success'
            );


        } catch (err) {

            console.error(err);

            showToast(
                err.message ||
                'Save failed.',
                'error'
            );


        } finally {

            btn.disabled = false;

            btn.innerHTML = window.ELIcon('save') + ' Save to Database';
        }
    }


    // ─────────────────────────────────────────────────────────────
    // EDITOR MODE
    // ─────────────────────────────────────────────────────────────

    function switchEditorMode(
        mode
    ) {

        currentMode =
            mode;
        cancelSkipSelection();
        const availCard = document.getElementById('veAvailabilityCard');
        if (availCard) availCard.classList.toggle('hidden', mode !== MODE.EDIT);
        const topToolbar = document.getElementById('veTopEditorToolbar');
        if (topToolbar) topToolbar.classList.toggle('hidden', mode !== MODE.EDIT);
        renderTimeline();

        setModeBadge(
            mode
        );


        document
            .getElementById(
                'btnModeEdit'
            )
            .classList.toggle(
                'active',
                mode === MODE.EDIT
            );


        document
            .getElementById(
                'btnModePreview'
            )
            .classList.toggle(
                'active',
                mode === MODE.PREVIEW
            );


        document
            .getElementById(
                'veAdminControls'
            )
            .classList.toggle(
                'hidden',
                mode !== MODE.EDIT
            );


        document
            .getElementById(
                'veSettingsCard'
            )
            .classList.toggle(
                'hidden',
                mode !== MODE.EDIT
            );


        document
            .getElementById(
                'veQuestionsPanel'
            )
            .classList.toggle(
                've-side-card-preview',
                mode === MODE.PREVIEW
            );


        if (
            mode === MODE.PREVIEW
        ) {

            resetStudentState();

            closeQuizOverlay();

            const speedControl =
                document.getElementById('vePlaybackSpeedControl');

            if (speedControl) {
                speedControl.classList.remove('hidden');
            }

            updateStudentPlaybackSpeeds();
            setStudentPlaybackSpeed(1.00);

            ytPause();

            showToast(
                'Student Preview mode — restrictions active.',
                'info'
            );

        } else {

            const speedControl =
                document.getElementById('vePlaybackSpeedControl');

            if (speedControl) {
                speedControl.classList.add('hidden');
            }

            closeQuizOverlay();
        }
    }


    function setModeBadge(
        mode
    ) {

        const badge =
            document.getElementById(
                'veModeBadge'
            );


        if (
            mode === MODE.EDIT
        ) {

            badge.textContent =
                'Edit Mode';

            badge.className =
                've-mode-badge ve-mode-edit';

        } else {

            badge.textContent =
                'Student Preview';

            badge.className =
                've-mode-badge ve-mode-preview';
        }
    }


    function resetStudentState() {

        studentState.currentTime =
            0;

        studentState.maxReachedTime =
            0;

        studentState.activeQuestionId =
            null;

        studentState.answeredIds =
            [];

        studentState.isSkipping =
            false;

        studentState.seekGuard =
            false;

        studentState.isPlaying =
            false;
    }


    // ─────────────────────────────────────────────────────────────
    // YOUTUBE PLAYER
    // ─────────────────────────────────────────────────────────────

    function initYouTubePlayer(
        videoId
    ) {

        destroyYouTubePlayer();

        ytReady = false;


        if (
            window.YT &&
            window.YT.Player
        ) {

            createPlayer(
                videoId
            );

        } else {

            window._pendingYtVideoId =
                videoId;
        }
    }


    window.onYouTubeIframeAPIReady =
        function () {

            if (
                window._pendingYtVideoId
            ) {

                createPlayer(
                    window._pendingYtVideoId
                );

                window._pendingYtVideoId =
                    null;
            }
        };


    function createPlayer(
        videoId
    ) {

        ytPlayer =
            new window.YT.Player(
                'veYoutubePlayer',
                {

                    height: '100%',

                    width: '100%',

                    videoId,

                    playerVars: {
                        playsinline: 1,
                        rel: 0,
                        controls: 0,
                        disablekb: 1,
                        fs: 0,
                        iv_load_policy: 3,
                        modestbranding: 1,

                        // Captions disabled by default
                        cc_load_policy: 0
                    },

                    events: {

                        onReady: () => {
                            ytReady = true;
                            ytPlayer.setPlaybackRate(1.00);
                            updateStudentPlaybackSpeeds();
                        },

                        onStateChange: e => {

                            const playing =
                                e.data ===
                                window.YT
                                    .PlayerState
                                    .PLAYING;


                            if (
                                currentMode ===
                                MODE.PREVIEW
                            ) {

                                studentState
                                    .isPlaying =
                                    playing;
                            }


                            document
                                .getElementById(
                                    'vePlayIcon'
                                )
                                .innerHTML =
                                playing ? window.ELIcon('pause') : window.ELIcon('play');
                        },

                        onError: () =>
                            showToast(
                                'YouTube: video cannot be embedded or is unavailable.',
                                'warning'
                            )
                    }
                }
            );
    }


    function destroyYouTubePlayer() {

        if (
            ytPlayer &&
            typeof ytPlayer.destroy ===
            'function'
        ) {

            try {
                ytPlayer.destroy();
            } catch (e) {
                // ignore
            }
        }


        ytPlayer = null;

        ytReady = false;


        // Reset CC state so a previous video's captions setting
        // never carries over into the next one.
        captionsEnabled = false;

        const ccBtn =
            document.getElementById(
                'btnCC'
            );

        if (ccBtn) {
            ccBtn.classList.remove(
                'active'
            );

            ccBtn.setAttribute(
                'aria-pressed',
                'false'
            );
        }


        const wrapper =
            document.getElementById(
                'vePlayerWrapper'
            );


        const existing =
            document.getElementById(
                'veYoutubePlayer'
            );


        if (existing) {
            existing.remove();
        }


        const fresh =
            document.createElement(
                'div'
            );


        fresh.id =
            'veYoutubePlayer';


        wrapper.insertBefore(
            fresh,
            wrapper.firstChild
        );
    }


    function ytPlay() {

        if (
            ytReady &&
            ytPlayer
        ) {
            ytPlayer.playVideo();
        }
    }


    function ytPause() {

        if (
            ytReady &&
            ytPlayer
        ) {
            ytPlayer.pauseVideo();
        }
    }


    function ytSeekTo(s) {

        if (
            ytReady &&
            ytPlayer
        ) {

            ytPlayer.seekTo(
                Math.max(0, s),
                true
            );
        }
    }


    function ytCurrentTime() {

        return (
            ytReady &&
            ytPlayer
        )
            ? (
                ytPlayer.getCurrentTime() ||
                0
            )
            : 0;
    }


    function ytDuration() {

        return (
            ytReady &&
            ytPlayer
        )
            ? (
                ytPlayer.getDuration() ||
                0
            )
            : 0;
    }


    function ytMute() {

        if (
            ytReady &&
            ytPlayer
        ) {
            ytPlayer.mute();
        }
    }


    function ytUnMute() {

        if (
            ytReady &&
            ytPlayer
        ) {
            ytPlayer.unMute();
        }
    }


    function ytIsMuted() {

        return (
            ytReady &&
            ytPlayer
        )
            ? ytPlayer.isMuted()
            : false;
    }


    function ytSetVol(v) {

        if (
            ytReady &&
            ytPlayer
        ) {
            ytPlayer.setVolume(v);
        }
    }


    // ─────────────────────────────────────────────────────────────
    // PLAYBACK SPEED
    // ─────────────────────────────────────────────────────────────

    function normalizePlaybackSpeed(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return 1.00;
        return STANDARD_PLAYBACK_SPEEDS.includes(numeric)
            ? numeric
            : 1.00;
    }

    function getMaximumPlaybackSpeed() {
        return normalizePlaybackSpeed(editorSettings.playbackSpeed);
    }

    function updateStudentPlaybackSpeeds() {
        const select = document.getElementById('vePlaybackSpeed');
        if (!select) return;
        const maxSpeed = getMaximumPlaybackSpeed();
        select.innerHTML = '';
        STANDARD_PLAYBACK_SPEEDS
            .filter(speed => speed <= maxSpeed)
            .forEach(speed => {
                const option = document.createElement('option');
                option.value = speed.toFixed(2);
                option.textContent = `${speed}×`;
                select.appendChild(option);
            });
        select.value = '1.00';
    }

    function setStudentPlaybackSpeed(requestedSpeed) {
        if (!ytReady || !ytPlayer) return;
        const maxSpeed = getMaximumPlaybackSpeed();
        let speed = normalizePlaybackSpeed(Number(requestedSpeed));
        if (speed > maxSpeed) speed = maxSpeed;
        ytPlayer.setPlaybackRate(speed);
        const select = document.getElementById('vePlaybackSpeed');
        if (select) select.value = speed.toFixed(2);
    }

    function enforceMaximumPlaybackSpeed() {
        if (currentMode !== MODE.PREVIEW || !ytReady || !ytPlayer) return;
        const maxSpeed = getMaximumPlaybackSpeed();
        const currentSpeed = ytPlayer.getPlaybackRate();
        if (currentSpeed > maxSpeed) {
            ytPlayer.setPlaybackRate(maxSpeed);
            const select = document.getElementById('vePlaybackSpeed');
            if (select) select.value = maxSpeed.toFixed(2);
        }
    }


    // ─────────────────────────────────────────────────────────────
    // PLAYER CONTROLS
    // ─────────────────────────────────────────────────────────────

    function togglePlayPause() {

        if (!ytReady) return;

        const state =
            ytPlayer.getPlayerState();


        if (
            state ===
            window.YT.PlayerState.PLAYING
        ) {

            ytPause();

        } else {

            ytPlay();
        }
    }


    function seekBy(
        delta
    ) {

        if (!ytReady) return;


        if (
            currentMode ===
            MODE.PREVIEW &&
            editorSettings.blockForward &&
            delta > 0
        ) {

            showToast(
                'Forward seeking is disabled in Student Preview.',
                'warning'
            );

            return;
        }


        ytSeekTo(
            ytCurrentTime() +
            delta
        );
    }


    function toggleMute() {

        const btn =
            document.getElementById(
                'btnMute'
            );


        if (
            ytIsMuted()
        ) {

            ytUnMute();

            btn.innerHTML = window.ELIcon('volume');

        } else {

            ytMute();

            btn.innerHTML = window.ELIcon('mute');
        }
    }


    function setVolume(
        val
    ) {

        if (
            val === 0
        ) {

            ytMute();

            document.getElementById('btnMute').innerHTML = window.ELIcon('mute');

        } else {

            ytUnMute();

            ytSetVol(
                val
            );

            document.getElementById('btnMute').innerHTML = window.ELIcon('volume');
        }
    }


    function toggleFullscreen() {

        const wrapper =
            document.getElementById(
                'vePlayerWrapper'
            );


        if (
            !document.fullscreenElement
        ) {

            wrapper
                .requestFullscreen()
                .catch(
                    () => { }
                );

        } else {

            document
                .exitFullscreen()
                .catch(
                    () => { }
                );
        }
    }


    function onClickShield() {

        if (!ytReady) return;


        const state =
            ytPlayer.getPlayerState();


        const playing =
            state ===
            window.YT.PlayerState.PLAYING;


        if (playing) {
            ytPause();
        } else {
            ytPlay();
        }


        const ind =
            document.getElementById(
                'vePlayIndicator'
            );


        ind.innerHTML = playing ? window.ELIcon('pause') : window.ELIcon('play');


        ind.classList.remove(
            'hidden'
        );


        setTimeout(
            () =>
                ind.classList.add(
                    'hidden'
                ),
            450
        );
    }


    // ─────────────────────────────────────────────────────────────
    // TICK LOOP
    // ─────────────────────────────────────────────────────────────

    function tick() {

        if (!ytReady) return;
        updateTimelineUI();

        enforceMaximumPlaybackSpeed();

        const now =
            ytCurrentTime();


        if (
            currentMode ===
            MODE.EDIT
        ) {
            return;
        }


        if (
            studentState
                .activeQuestionId
        ) {
            return;
        }


        studentState.currentTime =
            now;


        // Forward block

        if (
            editorSettings.blockForward &&
            !studentState.isSkipping
        ) {

            const drift = 1.8;


            if (
                now >
                studentState.maxReachedTime +
                drift
            ) {

                if (
                    !studentState.seekGuard
                ) {

                    studentState.seekGuard =
                        true;

                    ytSeekTo(
                        studentState.maxReachedTime
                    );


                    showToast(
                        'Forward seeking is disabled in Preview.',
                        'warning'
                    );


                    setTimeout(
                        () => {
                            studentState.seekGuard =
                                false;
                        },
                        600
                    );


                    return;
                }

            } else if (
                now >
                studentState.maxReachedTime
            ) {

                studentState.maxReachedTime =
                    now;
            }

        } else if (
            !editorSettings.blockForward
        ) {

            studentState.maxReachedTime =
                Math.max(
                    studentState.maxReachedTime,
                    now
                );
        }


        // Auto-skip

        if (
            !studentState.isSkipping
        ) {

            for (
                const s of editorSkips
            ) {

                if (
                    now >= s.start &&
                    now < s.end
                ) {

                    studentState.isSkipping =
                        true;

                    studentState.maxReachedTime =
                        Math.max(
                            studentState.maxReachedTime,
                            s.end
                        );


                    ytSeekTo(
                        s.end
                    );


                    showToast(
                        `Skipped section (${formatTime(s.start)} to ${formatTime(s.end)})`,
                        'info'
                    );


                    setTimeout(
                        () => {
                            studentState.isSkipping =
                                false;
                        },
                        600
                    );


                    return;
                }
            }
        }


        // Questions

        const tol = 0.65;


        for (
            const q of editorQuestions
        ) {

            if (
                now >= q.time &&
                now < q.time + tol &&
                !studentState
                    .answeredIds
                    .includes(q.id)
            ) {

                triggerStudentQuestion(
                    q
                );

                return;
            }
        }
    }


    // ─────────────────────────────────────────────────────────────
    // (Visual timeline removed. Question/skip engine, forward-seek
    // restriction, auto-skip, and pause-at-question logic all live
    // in tick() below and are untouched.)
    // ─────────────────────────────────────────────────────────────
    // SKIP SECTION MANAGEMENT
    // ─────────────────────────────────────────────────────────────

    function markSkipStart() {

        skipStartMark =
            ytCurrentTime();


        document.getElementById(
            'lblSkipStart'
        ).textContent =
            formatTime(
                skipStartMark
            );


        showToast(
            `Skip Start marked at ${formatTime(skipStartMark)}`,
            'info'
        );
    }


    function markSkipEnd() {

        skipEndMark =
            ytCurrentTime();


        document.getElementById(
            'lblSkipEnd'
        ).textContent =
            formatTime(
                skipEndMark
            );


        showToast(
            `Skip End marked at ${formatTime(skipEndMark)}`,
            'info'
        );
    }


    function confirmSkip() {

        const start =
            skipStartMark;

        const end =
            skipEndMark;

        const dur =
            ytDuration();


        if (
            start === null ||
            end === null
        ) {

            showToast(
                'Mark both Skip Start and Skip End first.',
                'warning'
            );

            return;
        }


        if (
            end <= start
        ) {

            showToast(
                'Skip End must be after Skip Start.',
                'warning'
            );

            return;
        }


        if (
            dur &&
            end > dur
        ) {

            showToast(
                `Skip End exceeds video length (${formatTime(dur)}).`,
                'warning'
            );

            return;
        }


        const overlap =
            editorSkips.some(
                s =>
                    Math.max(
                        start,
                        s.start
                    ) <
                    Math.min(
                        end,
                        s.end
                    )
            );


        if (overlap) {

            showToast(
                'Skip overlaps an existing section.',
                'warning'
            );

            return;
        }


        const conflict =
            editorQuestions.find(
                q =>
                    q.time >= start &&
                    q.time < end
            );


        if (conflict) {

            showToast(
                `Question at ${formatTime(conflict.time)} is inside this skip section.`,
                'warning'
            );

            return;
        }


        editorSkips.push({
            id: genId('skip'),
            start,
            end
        });


        editorSkips.sort(
            (a, b) =>
                a.start - b.start
        );


        skipStartMark = null;
        skipEndMark = null;


        document.getElementById(
            'lblSkipStart'
        ).textContent =
            '––:––';


        document.getElementById(
            'lblSkipEnd'
        ).textContent =
            '––:––';


        renderEditorUI();


        showToast(
            `Added skip: ${formatTime(start)} to ${formatTime(end)}`,
            'info'
        );
    }


    function deleteSkip(
        id
    ) {

        editorSkips =
            editorSkips.filter(
                s =>
                    s.id !== id
            );


        renderEditorUI();


        showToast(
            'Skip section removed.',
            'info'
        );
    }


    window.deleteSkip =
        deleteSkip;


    // ─────────────────────────────────────────────────────────────
    // QUESTION MODAL
    // ─────────────────────────────────────────────────────────────

    function openQuestionModal(
        question,
        preselectTime
    ) {

        editingQuestionId =
            question
                ? question.id
                : null;


        document.getElementById(
            'questionModalTitle'
        ).textContent =
            question
                ? 'Edit Question'
                : 'Add Question';


        document.getElementById(
            'qEditId'
        ).value =
            question
                ? question.id
                : '';


        document.getElementById(
            'qText'
        ).value =
            question
                ? question.question
                : '';


        document.getElementById(
            'qExplanation'
        ).value =
            question
                ? (
                    question.explanation ||
                    ''
                )
                : '';


        document.getElementById(
            'qModalError'
        ).classList.add(
            'hidden'
        );


        document.getElementById(
            'qModalError'
        ).textContent =
            '';


        const ts =
            question
                ? question.time
                : (
                    preselectTime !==
                        undefined
                        ? preselectTime
                        : ytCurrentTime()
                );


        document.getElementById(
            'qTimestamp'
        ).value =
            formatTime(ts);


        updateTimestampHint();


        const opts =
            question
                ? question.options
                : [
                    '',
                    '',
                    '',
                    ''
                ];


        [
            'qOpt0',
            'qOpt1',
            'qOpt2',
            'qOpt3'
        ].forEach(
            (
                id,
                i
            ) => {

                document.getElementById(
                    id
                ).value =
                    opts[i] || '';
            }
        );


        const correct =
            question
                ? question.correctAnswer
                : 0;


        document.getElementById(
            `optRadio${correct}`
        ).checked =
            true;


        updateSyncTimeDisplay();


        document.getElementById(
            'questionModal'
        ).style.display =
            'flex';
    }


    function closeQuestionModal() {

        document.getElementById(
            'questionModal'
        ).style.display =
            'none';


        editingQuestionId =
            null;
    }


    function syncCurrentTime() {

        document.getElementById(
            'qTimestamp'
        ).value =
            formatTime(
                ytCurrentTime()
            );


        updateTimestampHint();
    }


    function updateSyncTimeDisplay() {

        document.getElementById(
            'syncCurrentTime'
        ).textContent =
            formatTime(
                ytCurrentTime()
            );
    }


    function updateTimestampHint() {

        const val =
            document.getElementById(
                'qTimestamp'
            ).value;


        const sec =
            parseTime(val);


        const hint =
            document.getElementById(
                'qTimestampHint'
            );


        hint.textContent =
            sec !== null
                ? `Will trigger at ${formatTime(sec)}`
                : 'Invalid time format';
    }


    function saveQuestion() {

        const id =
            document.getElementById(
                'qEditId'
            ).value;


        const time =
            parseTime(
                document.getElementById(
                    'qTimestamp'
                ).value
            );


        const question =
            document.getElementById(
                'qText'
            ).value
                .trim();


        const explanation =
            document.getElementById(
                'qExplanation'
            ).value
                .trim();


        const options =
            [
                'qOpt0',
                'qOpt1',
                'qOpt2',
                'qOpt3'
            ].map(
                id =>
                    document.getElementById(
                        id
                    ).value.trim()
            );


        const correct =
            Number(
                document.querySelector(
                    'input[name="qCorrect"]:checked'
                )?.value ?? 0
            );


        const dur =
            ytDuration();


        const errEl =
            document.getElementById(
                'qModalError'
            );


        const fail =
            msg => {

                errEl.textContent =
                    msg;

                errEl.classList.remove(
                    'hidden'
                );
            };


        if (
            time === null ||
            isNaN(time) ||
            time < 0
        ) {

            fail(
                'Please enter a valid timestamp.'
            );

            return;
        }


        if (
            dur > 0 &&
            time > dur
        ) {

            fail(
                `Timestamp exceeds video length (${formatTime(dur)}).`
            );

            return;
        }


        if (!question) {

            fail(
                'Question text cannot be empty.'
            );

            return;
        }


        if (
            options.some(
                o => !o
            )
        ) {

            fail(
                'All four options must be filled in.'
            );

            return;
        }


        const inSkip =
            editorSkips.find(
                s =>
                    time >= s.start &&
                    time < s.end
            );


        if (inSkip) {

            fail(
                `Timestamp falls inside a skip section (${formatTime(inSkip.start)} to ${formatTime(inSkip.end)}).`
            );

            return;
        }


        if (id) {

            const idx =
                editorQuestions.findIndex(
                    q =>
                        q.id === id
                );


            if (idx !== -1) {

                editorQuestions[idx] = {
                    ...editorQuestions[idx],

                    time,

                    question,

                    explanation,

                    options,

                    correctAnswer:
                        correct
                };
            }

        } else {

            editorQuestions.push({
                id: genId('q'),
                time,
                question,
                explanation,
                options,
                correctAnswer: correct
            });
        }


        editorQuestions.sort(
            (a, b) =>
                a.time - b.time
        );


        renderEditorUI();

        closeQuestionModal();


        showToast(
            id
                ? 'Question updated.'
                : 'Question added.',
            'success'
        );
    }


    function deleteQuestion(
        id
    ) {

        if (
            !confirm(
                'Delete this question?'
            )
        ) {
            return;
        }


        editorQuestions =
            editorQuestions.filter(
                q =>
                    q.id !== id
            );


        renderEditorUI();


        showToast(
            'Question deleted.',
            'info'
        );
    }


    window.deleteQuestion =
        deleteQuestion;


    function gotoQuestion(
        id
    ) {

        const q =
            editorQuestions.find(
                q =>
                    q.id === id
            );


        if (q) {

            ytSeekTo(
                q.time
            );

            ytPause();
        }
    }


    window.gotoQuestion =
        gotoQuestion;


    function editQuestion(
        id
    ) {

        const q =
            editorQuestions.find(
                q =>
                    q.id === id
            );


        if (q) {

            ytPause();

            openQuestionModal(
                q
            );
        }
    }


    window.editQuestion =
        editQuestion;


    // ─────────────────────────────────────────────────────────────
    // STUDENT QUIZ
    // ─────────────────────────────────────────────────────────────

    function triggerStudentQuestion(
        q
    ) {

        studentState.activeQuestionId =
            q.id;


        if (
            editorSettings.pauseAtQuestions
        ) {
            ytPause();
        }


        document.getElementById(
            'veQuizTimestamp'
        ).textContent =
            formatTime(
                q.time
            );


        document.getElementById(
            'veQuizQuestion'
        ).textContent =
            q.question;


        const optContainer =
            document.getElementById(
                'veQuizOptions'
            );


        optContainer.innerHTML =
            q.options.map(
                (
                    opt,
                    i
                ) => `

                    <label
                        class="ve-quiz-option">

                        <input
                            type="radio"
                            name="veStudentAnswer"
                            value="${i}">

                        <span
                            class="ve-opt-letter">
                            ${'ABCD'[i]}
                        </span>

                        <span>
                            ${escapeHtml(opt)}
                        </span>

                    </label>

                `
            ).join('');


        document.getElementById(
            'veQuizFeedback'
        ).classList.add(
            'hidden'
        );


        document.getElementById(
            'btnSubmitAnswer'
        ).disabled =
            false;


        document.getElementById(
            'veQuizOverlay'
        ).classList.remove(
            'hidden'
        );
    }


    function closeQuizOverlay() {

        document.getElementById(
            'veQuizOverlay'
        ).classList.add(
            'hidden'
        );


        studentState.activeQuestionId =
            null;
    }


    function submitAnswer() {

        const selected =
            document.querySelector(
                'input[name="veStudentAnswer"]:checked'
            );


        if (!selected) {

            showToast(
                'Please select an answer.',
                'warning'
            );

            return;
        }


        const q =
            editorQuestions.find(
                q =>
                    q.id ===
                    studentState.activeQuestionId
            );


        if (!q) return;


        const chosenIdx =
            parseInt(
                selected.value,
                10
            );


        const feedback =
            document.getElementById(
                'veQuizFeedback'
            );


        feedback.classList.remove(
            'hidden'
        );


        if (
            chosenIdx ===
            q.correctAnswer
        ) {

            feedback.className =
                've-quiz-feedback ve-feedback-correct';


            feedback.textContent =
                'Correct! ' +
                (
                    q.explanation ||
                    'Well done!'
                );


            studentState
                .answeredIds
                .push(q.id);


            document.getElementById(
                'btnSubmitAnswer'
            ).disabled =
                true;


            setTimeout(
                () => {

                    closeQuizOverlay();

                    ytPlay();

                },
                1400
            );

        } else {

            feedback.className =
                've-quiz-feedback ve-feedback-wrong';


            feedback.textContent =
                'Incorrect — try again.';
        }
    }


    // ─────────────────────────────────────────────────────────────
    // RENDER EDITOR SIDEBAR
    // ─────────────────────────────────────────────────────────────

    function renderEditorUI() {

        renderQuestionsPanel();

        renderSkipsPanel();
        renderTimeline();
    }


    function renderQuestionsPanel() {

        document.getElementById(
            'questionsCount'
        ).textContent =
            editorQuestions.length;


        const list =
            document.getElementById(
                'questionsList'
            );


        if (
            editorQuestions.length === 0
        ) {

            list.innerHTML =
                '<div class="ve-inner-empty">No questions yet. Use "+ Add Question" above the video.</div>';

            return;
        }


        list.innerHTML =
            editorQuestions.map(
                (
                    q,
                    i
                ) => `

                    <div
                        class="ve-item-card">

                        <div
                            class="ve-item-top">

                            <span
                                class="ve-time-tag">

                                ${formatTime(
                    q.time
                )}

                            </span>

                            <span
                                class="ve-item-num">

                                Q${i + 1}

                            </span>

                        </div>


                        <p
                            class="ve-item-text">

                            ${escapeHtml(
                    q.question
                )}

                        </p>


                        <div
                            class="ve-item-actions">

                            <button
                                class="action-btn edit-btn"
                                onclick="gotoQuestion('${q.id}')">

                                Go To

                            </button>


                            <button
                                class="action-btn edit-btn"
                                onclick="editQuestion('${q.id}')">

                                Edit

                            </button>


                            <button
                                class="action-btn delete-btn"
                                onclick="deleteQuestion('${q.id}')">

                                Delete

                            </button>

                        </div>

                    </div>
                `
            ).join('');
    }


    function renderSkipsPanel() {

        document.getElementById(
            'skipsCount'
        ).textContent =
            editorSkips.length;


        const list =
            document.getElementById(
                'skipsList'
            );


        if (
            editorSkips.length === 0
        ) {

            list.innerHTML =
                '<div class="ve-inner-empty">No skip sections yet. Use "+ Add Skip", then click a start and end point on the timeline.</div>';

            return;
        }


        list.innerHTML =
            editorSkips.map(
                s => `

                    <div
                        class="ve-item-card">

                        <div
                            class="ve-item-top">

                            <span
                                class="ve-time-tag ve-skip-tag">

                                ${formatTime(
                    s.start
                )}

                                to

                                ${formatTime(
                    s.end
                )}

                            </span>


                            <span
                                class="ve-item-num">

                                ${formatTime(
                    s.end -
                    s.start
                )}

                            </span>

                        </div>


                        <div
                            class="ve-item-actions">

                            <button
                                class="action-btn edit-btn"
                                onclick="(function(){if(window.veYtSeekTo)window.veYtSeekTo(${s.start});})()">

                                Go To

                            </button>


                            <button
                                class="action-btn delete-btn"
                                onclick="deleteSkip('${s.id}')">

                                Delete

                            </button>

                        </div>

                    </div>

                `
            ).join('');
    }


    // Expose seekTo for inline skip GoTo

    window.veYtSeekTo =
        s => {

            ytSeekTo(s);

            ytPause();
        };

})();