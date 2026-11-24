# Derived process metrics (version 1.0.0)

`process-metrics.js` exposes pure `derive(session)` in Node and `ProcessMetrics.derive(session)` in the browser. The result contains `processMetrics` and `qualitativeSegments`. It does not mutate input, add raw events, change tutor/control behavior or send data to the AI. `study.js` includes the result in the existing submission JSON. `grade.mjs` recalculates it after manual grading, preventing stale scores.

To enrich previously downloaded JSON, from `activity/`:

```sh
node analyze-session.mjs participant.json > participant-enriched.json
```

Use a different output filename (shell redirection would otherwise erase the input). No network or credentials are needed. Existing fields, including raw logs and technical token usage, are retained. Existing CSV export remains unchanged; metrics are in JSON.

## Source and missingness

Use `events[type=lesson_event].detail`; fall back to `lesson.state.log` when no primary lesson events are present. Never combine both copies. Study-wide events (refresh, visibility, submission) require the outer `events` array. An absent source yields null counts; an available empty source has zero observed events and is flagged for review. Rates with zero denominators are null. Missing values are not converted to zero. This summarizes recorded behavior, not behavior the app failed to log.

Event array order is authoritative, checked against timestamps and sequence numbers. Malformed/nonchronological records flag review and disable sequence-dependent metrics. Variants and step re-entry break comparison sequences. Missing task IDs disable sequence metrics. Partial event histories cannot always be detected; inspect `dataQualityIssues`, raw records and the source alongside results.

## Definitions and denominators

| Fields | Definition |
|---|---|
| `preScore`, `postScore`, `normalizedGain` | Final scores only; pending manual grading leaves dependent fields null. Gain = (post − pre)/(9 − pre), null for pre=9. Legacy numeric totals are accepted unless explicitly marked pending. |
| `preObjectiveScore`, `postObjectiveScore` | Existing objective totals, separately preserved. |
| `transferScore` | Internal lesson assessment score; snapshot first, otherwise last assessment event. Never confused with official post-test. |
| `activeLearningTimeSeconds` | Existing `activeMs / 1000` browser-interaction estimate, not attention. |
| `totalStudyTimeSeconds` | Pre-test start to feedback end; creation time is a fallback start. Null without a known end; excludes later submission retries. |
| `meanMissionTimeSeconds`, `medianMissionTimeSeconds` | Wall time from mission `step_start` to the next step or explicit learning end. Includes away time and timed-out partial missions; check timeout flags. `missionTimeSampleCount` gives the denominator. Unknown durations excluded. |
| `totalSimulationRuns` | Logged exploration runs + theory `check_answer` runs + mission runs. Does not count unlogged rule animations, internal transfer visualizations or interrupted runs. |
| `explorationRuns`, `missionRuns`, `totalMissionAttempts` | Respective event counts; mission attempts and mission runs are equal. |
| `missionAttemptedCount`, `missionSuccessCount`, `missionSuccessRate` | Unique attempted mission IDs, unique IDs with at least one success, and their ratio. Not the fraction of successful attempts. |
| `meanAttemptsPerMission` | Mission run count / unique attempted missions. Unattempted missions excluded. |
| `predictionCount`, `correctPredictionCount`, `predictionAccuracy` | Submitted predictions in theory/mission run events; correct/count. Missing correctness makes correct count and accuracy null. |
| `meanPredictionLatencySeconds` | Average valid recorded seconds before prediction, using theory attempts and only first mission attempts (`signals.runs === 1`). Current mission code can reuse timestamps on later attempts, so those are excluded. `predictionLatencySampleCount` reports coverage. |
| `predictionRevisionCount`, `predictionRevisionRate` | Changed predictions on consecutive observed attempts in the same task variant. Denominator `predictionRevisionOpportunities`: consecutive pairs with both predictions present. Each preceding attempt provides new observation; different variants/tasks are never paired. Does not measure edits before a run. |
| `learningRateChangeCount`, `startingPointChangeCount` | Changes between consecutive exploration/mission runs within the same task variant, not slider-input counts. |
| `exactRepeatRunCount`, `exactRepeatRunRate` | Identical x0, learning rate AND iteration count / `comparableRunPairCount`. Theory lacks run settings and is excluded. Missing settings in eligible pairs make affected metrics null. |
| `divergenceOrOscillationOpportunities` | Runs with observed `diverge` or `oscillate`. |
| `appropriateLearningRateAdjustments`, `appropriateLearningRateAdjustmentRate` | Opportunities followed by a smaller learning rate on the next same-task run / all opportunities, including a final opportunity with no subsequent run. Unknown required settings make response count/rate null. |
| `localMinimumOpportunities` | Mission runs with observed `local` (missions target global minima). |
| `appropriateStartingPointAdjustments`, `appropriateStartingPointAdjustmentRate` | Opportunities followed by a changed x0 on the next same-task run / all opportunities. This is an observable changed-start proxy, NOT proof of intent, crossing a basin boundary or successful escape. |
| `helpRequestCount`, `helpRequestsPerMission` | Explicit `help_request` count; mission-specific requests / unique attempted missions for the latter. Follow-up chat and hint opens are separate. |
| `studentChatMessageCount` | Typed exploration help messages plus `student_msg`; excludes the fixed `stuck`/`hint` button messages and submitted explanations. |
| `predefinedHintOpenCount` | `hint_reveal` events, including repeated openings. No claim of reading. |
| `aiResponseCount`, `aiFailureCount`, `aiFailureRate` | Tutor events with mode ai/unavailable; failures / (successes + failures). Cancellations without a response are excluded. Zero AI events gives a null rate. |
| `maxHintDepth`, `meanHintDepth` | Supplied `context.hintLevel` on AI request events. Null when unavailable or control; does not measure whether the model followed that depth. |
| `helpEpisodes` | Consecutive explicit requests, hint opens, follow-up messages or delivered tutor replies within a task variant, grouped until the next attempt. Includes automatic feedback. Unavailable replies alone are not delivered help. |
| `postHelpImprovementCount`, `postHelpImprovementRate` | Episodes whose next same-task attempt changes incorrect→correct prediction, failure→success, or satisfies the adjustment rule above. At most one improvement per episode. Denominator `evaluableHelpEpisodes`: episodes with a prior attempt, next attempt and at least one comparable signal. Baseline-free or unanswered episodes remain in `helpEpisodes` but are excluded from the rate. Association, not evidence that help caused learning. |
| `browserRefreshCount`, `visibilityChangeCount` | Corresponding outer events. Visibility is not attention. |
| `timeoutCount` | Learning session time-limit expiry (not API timeout). |
| `incompleteStepCount` | Length of existing incomplete step list; null if unavailable. |
| `aiUnavailableCount` | Same unavailable response count as `aiFailureCount`. |
| `hasExternalAssistance` | Yes→true, No→false, missing/prefer-not-to-say→null. |
| `needsReview` | Existing review flag or detected missing assessment/events/task IDs, invalid ordering, missing correctness, timeout/incomplete steps, AI interruption or reported outside assistance. Manual-grading pending alone does not mean the assessment was unsubmitted. |

`derivationNotes` and `dataQualityIssues` explain limitations. Token usage stays in original technical metadata; it is not a learning metric. No gaze, learning-goal reading, conceptual mastery or qualitative themes are inferred.

## Qualitative records

`qualitativeSegments` extracts prediction reasons, submitted explanations, typed student chat, tutor messages, questionnaire text, internal transfer explanation and assessment free text. Each has `segmentType`, `text`, `timestamp`, `phase`, `missionId`, `context`, `linkedOutcome` and `linkedNextAction`.

Links remain inside a task variant: latest observable attempt and next recorded setting change or attempt. Malformed chronology disables links. Questionnaire/assessment timestamps are submission times, not typing times, and have no speculative task links. Text is retained verbatim. These are extracts for human coding, not automatic themes or labels. Unknown fields remain null. No additional identifying information is collected.
