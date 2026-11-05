# Gradient Descent Lab — controlled study

This increment preserves the original canvas, visual design, four stages, missions, and Predict → Observe → Explain lesson. It adds consent, official pre/post-tests, feedback, recovery, timing, exports, and a server-side tutor relay. **Do not recruit participants until the configuration and researcher decisions below are completed.** No live AI credentials or hosting service are included.

## Run locally

Requires Node.js 22 or later; no npm dependencies or build step.

```sh
cd activity
node server.mjs
```

Open `http://127.0.0.1:8080/?condition=control&pid=P01` or `http://127.0.0.1:8080/?condition=ai&pid=P02`. Without AI configuration, AI requests explicitly fail and flag the session. The control condition works without an AI service. Use a different browser profile/private window for each test participant. There is deliberately no condition switcher or restart button. A completed participant can remove their recovery copy after downloading/delivering the data. For development only, clear this origin's local storage to start a fresh test.

The same origin retains one session. Returning with another condition link resumes the stored condition and logs/flags the mismatch. Web Locks prevent conflicting tabs in supported browsers. When Web Locks are unavailable, the session is flagged; instruct participants to use one tab. Modern Chrome, Firefox, or Safari with JavaScript and storage is required. Do not open the HTML via `file://`.

## Deploy both conditions

1. Deploy the `activity` directory on a Node-capable host. Start with `node server.mjs`; set `HOST=0.0.0.0` and the host's `PORT` as needed. Put it behind HTTPS. The built-in static-file allowlist serves only the six browser assets, never server code, prompts, or research files.
2. Set `APP_ORIGIN` to the exact public origin, with scheme and no trailing slash (for local tests: `http://127.0.0.1:8080`). Use the same public origin for both groups and `/api/tutor`; no CORS proxy is needed. A reverse proxy must preserve the browser Origin header.
3. The research team randomly assigns IDs/conditions **outside the application**. Send separate links using `?condition=control&pid=ANONYMOUS_ID` and `?condition=ai&pid=ANONYMOUS_ID&token=INDIVIDUAL_RELAY_CODE`.
4. For AI participants, configure the relay below. The relay code is an application access code, never a provider API key. The browser removes it from the address bar and stores it only in that tab's session storage. Configure hosting access logs to redact query strings. Provider credentials must remain in server secrets.
5. Test the actual public link in an ordinary browser before recruitment, including reload, AI retry, expiry, and download/delivery. Freeze the application version and chosen model for the study.

Static-only hosting can run the study and control support, but **cannot deliver the AI condition** without routing `/api/tutor` to this server (or an equivalent authenticated same-origin relay). Do not call a static-only AI deployment operational.

URL parameters and local storage are **not tamper-proof assignment or assessment security**. A technically knowledgeable participant can inspect answer keys, edit storage, change the clock, clear the session, or call the relay with a valid code. No server-side participant/session database is implemented. If adversarial enforcement is required, implement server-issued assignments, phase authorization, and durable rate limits before recruitment. The existing relay denies assessment stage requests but cannot verify the real browser phase. Control participants are not issued relay codes.

## Configure and test AI

Set these environment variables through your host's secret/configuration controls:

| Variable | Meaning |
| --- | --- |
| `ANTHROPIC_API_KEY` | Provider key, server secret only |
| `TUTOR_MODEL` | Explicit model ID approved and available in your account; no assumed default |
| `STUDY_AI_TOKENS` | Comma-separated random access codes, one per AI participant |
| `APP_ORIGIN` | Exact browser origin allowed to call the relay |

Generate each code locally with `node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"`. Do not commit credentials, participant codes, or research exports. Use the secret manager or environment of the server process rather than putting keys in HTML or a client configuration file.

`server.mjs` handles same-origin checks, token checks, 32 KB payloads, stage validation, concurrency (8), and per-code limits (12 requests/minute, 250 per process lifetime). Limits reset on process restart and are per process: deploy one instance for this small pilot, configure provider spending limits, and add a persistent gateway limiter for larger deployments. No request bodies, codes, IP addresses, or conversations are logged by this server; review your host/provider's logging and retention separately.

`tutor-provider.mjs` implements the [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages), with a 20-second provider timeout. `tutor-instructions.txt` contains the preserved pedagogical prompt plus assessment restrictions. Model/provider changes belong in this adapter, not lesson code. The client waits at most 25 seconds. Failed requests show an explicit unavailable status and Retry button; there is **no fixed-response fallback**. Any interruption flags `reviewRequired` with `ai_assistance_interrupted`, while the common activity timer continues. A later success does not erase the interruption. Researchers decide exclusion rules before seeing outcomes.

To check the actual integration, configure real secrets, start an AI test session, finish the pre-test, and ask the tutor in exploration. Verify a concise contextual response, a `mode: ai` event, and no review flag. Then disable/reject the relay and verify the visible error, retry, `fallback: false`, and review flag. Automated browser tests mock successful AI responses; they do not establish provider availability or tutor quality.

## Study protocol and comparability

- Consent → pre-test → learning (maximum 30 wall-clock minutes) → explicit learning-ended screen → post-test → qualitative feedback → export.
- Pre/post-tests suggest 5–7 minutes and feedback suggests 5 minutes, but **only learning has a hard cap**. This avoids silently submitting unfinished assessment responses. All phase wall durations are recorded.
- At 30 minutes, the simulation stops, pending AI is aborted, work is saved, and incomplete steps/status are recorded. The participant explicitly starts the post-test from the ended screen. Closing/backgrounding does not pause the maximum. A delayed timer is enforced at the next callback or reload; recorded wall time can therefore exceed 30 minutes and is not claimed as allowed active lesson time.
- `activeMs` estimates visible, focused time with an interaction in the last 60 seconds; each heartbeat contributes at most two seconds. It is a conservative heuristic, **not measured attention**. Background/foreground events are logged. Browser/system clock changes remain a limitation.
- Both groups receive identical controls, functions, predictions, mission criteria, internal transfer check, official tests, timings, and correctness feedback.
- Control participants can reveal the same ordered predefined hints at each step. Theory/mission hints unlock after the first predicted run so direct solutions are not revealed before a prediction; exploration hints are available immediately. Mission hints include all four diagnostic categories for every mission. Hint selection does not depend on accumulated failures, messages, or inferred needs. Basic outcome feedback and model explanations after submitted explanations are fixed.
- The AI group receives context-aware tutor responses using stage, settings, attempts, predictions, behavior signals, explanations, and recent conversation. Hint specificity increases with difficulty. There are no AI calls in the official assessments or independent internal transfer check.
- The original shifted quadratic worked example now uses x₀ = 5 and η = 0.1 (x₁ = 4.2), avoiding the post-test's x₀ = 4, η = 0.25 example. Other conceptual overlap is intentional learning content.
- Corrected constant-amplitude oscillation classification, clamped fixed sliders (including transfer settings), an overly broad mission learning-rate range, and claims that every finite gradient step decreases the objective or cannot cross a valley.

## Scoring and research exports

Downloads are available throughout, including incomplete/error sessions. There is **no research collection backend**. Participants must download the participant JSON and deliver it through the team's approved secure channel. Filenames include anonymous ID and session identifier. Keep exports outside this repository.

1. **Participant JSON:** version, session/participant IDs, assigned condition, consent, prior experience, exact written answers/drafts/notes, submitted tests and scores, lesson snapshot and original event log, qualitative responses, phase timestamps/active estimates, interruption flags, unified events, rubric, and gains.
2. **Summary CSV:** one participant row, separately scored Q1/Q2/Q3A/Q3B/Q4, objective subtotal, pending manual fields, phase durations, completion status, prior experience, external assistance, review reasons, and valid gains. CSV uses quoted fields and guards spreadsheet formula prefixes. JSON is the canonical lossless source.
3. **Events CSV:** one event per row with session/participant/condition identifiers, sequence, timestamp, phase, type, and JSON detail. Covers settings, predictions/accuracy, runs, attempts, explanations, voluntary hint reveals, tutor requests/responses/interruption status, refreshes, visibility, and errors. The original lesson log is also retained in the snapshot.

Each official test has **5 automatically scored points + 4 manually graded points = 9**. Q3B is checked against the correct numerical result independently of Q3A, tolerance 0.000001. Q3C remains pending manual grading: one point only for the correct direction **and** valid justification. Q5 remains pending, with three separate 0/1 rubric items (gradient role, iteration, minimization). No AI/manual-score inference occurs. The internal transfer score (0–3) is separate and never added to the official score. Optional notes and feedback are unscored.

Offline manual review utility:

```sh
node grade.mjs /secure/participant.json > /secure/blinded-review.json
node grade.mjs /secure/participant.json /secure/grades.json > /secure/graded-participant.json
```

The first command omits condition, tutor data, and automatic marks; it retains the session key and pre/post labels. Give this file to a grader who has no condition mapping. Free text can self-disclose support, so this is not guaranteed blinding. The team should assess reasoning independently of the selected option. Grade input format:

```json
{"sessionId":"COPY_FROM_REVIEW","pre":{"q3c":1,"q5":[1,0,1]},"post":{"q3c":1,"q5":[1,1,1]}}
```

The second command validates all manual rubric scores and recomputes totals and gains. Raw gain is post minus pre; normalized gain is `(post-pre)/(9-pre)`. Gains stay null until both complete totals exist; normalized gain stays null for pre = 9. Original participant files remain unchanged. Use sessionId to deduplicate repeated downloads; do not treat every download as a new participant.

## Reliability and privacy

Drafts save on input and lesson state saves after interactions/once a second. Refresh resumes submitted assessments without reopening them; incomplete forms retain raw text. A run interrupted mid-animation is logged and returns to prediction/setup; it is not counted as a completed attempt. Interrupted AI requests are flagged. Storage failures show a persistent warning and leave export available. Corrupt recovery data is not overwritten and can be downloaded for the researcher. Recovery data remains on that browser profile until explicitly removed after completion. No analytics, cookies, external fonts, names, or email collection are added.

## Tests

From `activity`:

```sh
node --test tests/*.test.*
python3 tests/browser.py
```

Browser tests require the Python `playwright` package and installed Chrome (`CHROME_PATH` overrides the macOS default); neither is a runtime dependency. Tests launch an isolated browser and local server, never a participant's normal browser profile. The browser suite covers complete control/AI flows (AI success mocked), incorrect/correct attempts, optional notes omitted, manual scoring pending, raw whitespace, refresh, assignment mismatch, locked duplicate tabs, timer expiry on refresh, unavailable AI, JSON/CSV downloads, mobile overflow, and basic keyboard focus. Node tests cover numerical classifications/edge cases, independent scoring, valid gains, CSV safety, relay access/stage/rate-limit guards, and the provider adapter. Automated checks do not replace screen-reader usability review or an actual provider pilot.

## Researcher decisions before recruitment

Supply the investigator contact and information sheet; decide and disclose the actual AI provider/model, retention/deletion policy, withdrawal method, and secure file-delivery channel. Approve consent wording through the course/institutional process that applies to this study. Pre-register how AI interruption, external assistance, incomplete learning, and timing anomalies affect analysis. Approve manual Q3C grading, blinded Q5 rubric grading, suggested assessment times without hard cutoffs, and the small worked-example change. Pilot tutor quality, mobile use, accessibility, and real deployment with representative students. Nothing has been published automatically.
