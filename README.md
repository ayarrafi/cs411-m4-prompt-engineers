# CS-411 M4 – Prompt Engineers

Team project for CS-411 Digital Education: an interactive lesson on 1D gradient descent and a controlled comparison of adaptive AI tutoring with predefined support.

Team: Aya Arrafi, Marc Kallergis, Clemens Möbius

## Run the study application

```sh
cd activity
node server.mjs
```

Open `http://127.0.0.1:8080/?condition=control&pid=P01`. For AI, use `condition=ai` and configure the server-side relay first. Both conditions use the same consent, official tests, four-stage lesson, feedback, and exports. Participants cannot switch conditions through the interface.

See [activity/README.md](activity/README.md) for deployment, AI configuration, timing/assignment limitations, research data formats, blinded manual grading, test commands, and researcher decisions needed before recruitment.

## Repository layout

- `activity/gradient-descent-lab.html`: original visual shell and canvas, now loaded with separate scripts.
- `activity/lesson.js` and `math.js`: retained lesson, plots, missions, and numerical calculations.
- `activity/study.js`, `study-core.js`, `study.css`: study progression, assessments, scoring, timers, recovery, and exports.
- `activity/server.mjs`, `tutor-provider.mjs`, `tutor-instructions.txt`: authenticated same-origin AI relay and pedagogical instructions. Provider API keys stay in server environment variables.
- `activity/grade.mjs`: offline blinded review/manual grading utility.
- `activity/tests/`: Node regression tests and Chrome/Playwright participant-flow tests.

Participant JSON, summary CSV, and event CSV are downloaded locally. There is no research collection backend; the team must provide a secure delivery channel. Do not commit research exports or credentials to this repository.
