# CS-411 M4 – Prompt Engineers

Team project for CS-411 Digital Education: a short interactive lesson on 1D gradient descent, with two support conditions (adaptive AI tutor vs. predefined hints), and the study we run around it.

Team: Aya Arrafi, Marc Kallergis, Clemens Möbius

## Repository layout

- `activity/gradient-descent-lab.html`: the lesson (single HTML file, M3 version). It has four stages (Explore, Theory, Missions, Transfer check), and the switch at the top right sets the condition (Adaptive AI or Predefined).
- `tests/`: pre-test, post-test and answer key (to add).
- `logs/`: AI interaction logs, one folder per team member (to add).
- `report/`: research plan as PDF (to add).

## About the lesson file

The adaptive AI tutor in this file uses Claude's in-page `sample` capability, so it only works when the page is opened inside Claude (as a shared artifact link). Outside Claude the page still works, with the predefined hints as fallback.

To use the tutor on a public site, the page has a `TUTOR_ENDPOINT` constant near the top of the script. It is empty here on purpose: put the address of a relay that keeps the API key secret, never the key itself in this repo.

## Event log

Every prediction, explanation, tutor message and the transfer score is logged. The button "Copy log as JSON" at the bottom of the page exports the log for one participant.
