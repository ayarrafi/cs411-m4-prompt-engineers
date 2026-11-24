# Teaching feedback checklist

Checked against the pulled repository on 2026-11-24. Checked items describe local implementation, not a deployed change or proof of learning effectiveness.

- [x] Define the tutor's intended role and assistance boundaries in `tutor-instructions.txt`.
- [x] Withhold exact minima and pre-explanation answer keys from provider context, even at hint level 3.
- [x] Render AI tutor LaTeX locally, with untrusted HTML/URLs disabled and readable invalid-math handling.
- [ ] Review synthetic live tutor responses against the new boundaries; prompt instructions do not guarantee model compliance.
- [ ] Deploy the changes and verify an AI interaction on the hosted service.
- [ ] Update RQ1 and study conditions to define the intervention precisely (wording below).
- [ ] State that the comparison evaluates the combined guided tutoring intervention, not the separate causal effect of conversation, hints, or feedback. If isolating an affordance is required, redesign the conditions before recruitment.
- [ ] Replace vague RQ2 terms with measurable behaviors and predefined metrics below.
- [ ] Agree judgeable recruitment inclusion/exclusion criteria and screening questions. For example: BA3 enrollment; completed a course covering derivatives; no previous course assignment or project implementing gradient descent. These are proposals, not current screening rules.
- [ ] Update the report's Mann–Whitney plan to the instructor's requested ANOVA; specify the outcome, factors, assumptions, missing-data handling and effect size with the teaching staff before analysis.
- [ ] Predefine handling of AI outages, incomplete sessions, external assistance and perfect pre-test scores before inspecting group outcomes.
- [ ] Implement the proposed derived JSON process summary, with tests and metric definitions; the current raw events already support most metrics.
- [ ] Pilot the complete submission flow and confirm the researcher can retrieve the JSON from Firebase Storage.

## Suggested report wording

**Tutor role / RQ1:** Does a guided AI reasoning coach, which adjusts the specificity of prompts to students' predictions, simulation outcomes and previous attempts, improve normalized pre-to-post learning gain compared with predefined non-conversational support in the same gradient-descent activity? The coach elicits prediction, observation and explanation, gives one next-step cue at a time, and is instructed not to supply computed answers or successful parameter settings. This evaluates a combined tutoring intervention; it does not isolate individual AI affordances.

**RQ2:** How do the conditions differ in simulation attempts, parameter changes between consecutive runs, prediction accuracy, and help-seeking frequency? Use open-ended explanations to interpret these observed behaviors, without treating click counts as proof of understanding.

## Proposed quantitative JSON summary (not yet implemented)

The pulled version automatically sends `buildPayload()` to `/api/submit`, which stores JSON in Firebase Storage. It no longer offers participant downloads. Add a derived `processMetrics` object to that payload (or compute it offline from downloaded researcher JSON). Preserve the original events. Do not send this summary or assessment records to the model.

Use `events` entries with `type: "lesson_event"` and their `detail` objects as the single source for lesson counts. Do not also count `lesson.state.log`: that duplicates records. Keep aggregate and per-step metrics, with a `metricsVersion` and explicit missing values for unavailable observations in older files.

| Proposed field | Source and definition | Interpretation / caution |
|---|---|---|
| `simulationRuns` | Count `explore_run` and `mission_run`; report theory attempts separately | More runs need not mean better learning |
| `theoryAttempts`, `theoryPredictionAccuracy` | `check_answer`; correct `ok` count divided by attempts | Null accuracy when no attempts |
| `missionAttempts`, `missionPredictionAccuracy` | `mission_run`; correct `predOK` count divided by attempts | Keep separate from target success |
| `missionSuccessRate` | Successful `mission_run` count / mission attempts | Null if no attempts |
| `changesBetweenRuns` | Compare consecutive `cfg` within each step: x0, lr, steps | Count one-variable vs multi-variable changes; avoid pooling different functions |
| `repeatedSettingsRuns` | Consecutive runs with identical settings in the same step | Repetition can be intentional verification |
| `settingInputEvents` | Count `setting_change` by control | Slider input events are not distinct decisions; prefer changes between runs |
| `explicitHelpRequests` | Count `help_request` | AI chat and control hint interactions are not equivalent |
| `followupMessages` | Count `student_msg` separately | Only available in AI; do not label all followups as help requests |
| `hintOpens`, `uniqueHintsOpened` | `hint_reveal`; deduplicate by step + index for unique count | Control only; repeated openings do not prove reading |
| `firstHelpAfterSeconds` | First help/hint event minus corresponding `step_start` | Null if none; wall time includes time away |
| `stepWallSeconds` | Consecutive `step_start` timestamps; end final step at learning end | Incomplete last step must be flagged; this is not active attention |
| `learningActiveEstimateSeconds` | `timing.learning.activeMs / 1000` | Existing heuristic based on focus, visibility and recent interaction |
| `aiResponses`, `aiFailures`, `aiAvailabilityRate` | `tutor` events by mode; rate = AI successes / (successes + unavailable) | Keep failure codes, provider/model and review flags; null for control |
| `aiTokenUsage` | Sum reported usage on successful `tutor` events | Unknown usage is not zero; record number of responses with usage |

Suggested structure (illustrative values, not participant results):

```json
{
  "processMetrics": {
    "metricsVersion": "1",
    "source": "events.lesson_event",
    "overall": { "simulationRuns": 8, "explicitHelpRequests": 2 },
    "byStep": { "m1": { "missionAttempts": 3, "missionPredictionAccuracy": 0.6667 } },
    "ai": { "responses": 4, "failures": 1, "availabilityRate": 0.8 },
    "unmeasured": ["learningGoalReading"]
  }
}
```

Learning-goal access is not currently tracked. If added, use identical goal controls in both conditions and log opens/closes, optionally visible duration; call this *access*, not proof of reading. Do not alter the control condition just to add this without updating the protocol. Preselect a small number of primary process metrics to avoid testing every logged variable after seeing results.

## Rendering maintenance

KaTeX 0.19.1 is vendored under `vendor/katex` with its MIT license; no CDN or build step is required. Scripts, CSS and fonts are served through the existing static allowlist. `tutor-math.js` uses text nodes, `trust:false`, bounded macro expansion and size, and HTML + MathML output. It renders AI tutor messages only; original response text remains in the JSON. Follow https://katex.org/docs/autorender and https://katex.org/docs/options when updating.

## Local verification

On 2026-11-24, all 17 Node tests and the Chrome browser suite passed. Browser coverage includes inline/display equations, accessible MathML, malformed math, blocked unsafe markup/links, missing-renderer fallback, actual AI-message rendering with mocked responses, both complete condition flows, submission/retry and local-data clearing, mobile layout, recovery and timer expiry. Provider replies and submission storage were mocked in these checks; no new live Groq pedagogical evaluation or hosted deployment verification was performed.
