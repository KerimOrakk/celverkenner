import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { track } from '../analytics.js';
import CellViewer from '../components/CellViewer.jsx';
import SiteHeader from '../components/SiteHeader.jsx';
import { useCellData } from '../hooks/useCellData.js';
import { useCells } from '../hooks/useCells.js';
import { useLang } from '../i18n/index.jsx';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import { renderResultCard, shareResultCard } from '../share.js';

const MODES = ['find', 'name', 'cell'];
const QUESTIONS = { find: 10, name: 10, cell: 8 };
const PENALTY_S = 3; // per wrong answer
const SKIP_S = 5;
const EXCLUDED = new Set(['ribosomen', 'hemoglobine']); // too small to click fairly
const BEST_KEY = 'celverkenner:quiz-best';

const formatTime = (ms) => {
  const total = Math.max(0, ms) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = (total - minutes * 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${seconds}`;
};

function readBest(key) {
  try {
    return JSON.parse(window.localStorage.getItem(BEST_KEY) ?? '{}')[key] ?? null;
  } catch {
    return null;
  }
}

function writeBest(key, ms) {
  try {
    const all = JSON.parse(window.localStorage.getItem(BEST_KEY) ?? '{}');
    all[key] = ms;
    window.localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

const shuffle = (list) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Organelle questions: cells stay grouped (fewer 3D rebuilds), organelles
 * within a cell are drawn without direct repeats, half the questions ask by
 * name and half by function. For "name" mode every question gets four
 * answer options from the same cell.
 */
function buildOrganelleQuestions(mode, cellIds, cellOrganelles) {
  const total = QUESTIONS[mode];
  const order = shuffle(cellIds);
  const perCell = Math.floor(total / order.length);
  let remainder = total - perCell * order.length;
  const questions = [];
  let previous = null;
  // Wrong answers come from the same cell; a cell with few parts (red blood
  // cell) borrows names from the other chosen cells.
  const everything = [...new Map([...cellOrganelles.values()].flat().map((o) => [o.id, o])).values()];
  order.forEach((cellId) => {
    const all = cellOrganelles.get(cellId);
    const pool = mode === 'find' ? all.filter((o) => !EXCLUDED.has(o.id)) : all;
    const count = perCell + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    let deck = shuffle(pool);
    for (let i = 0; i < count; i += 1) {
      if (deck.length === 0) deck = shuffle(pool);
      let pick = deck.pop();
      if (previous && pick.id === previous && deck.length > 0) {
        deck.unshift(pick);
        pick = deck.pop();
      }
      previous = pick.id;
      let distractors = shuffle(all.filter((o) => o.id !== pick.id)).slice(0, 3);
      if (distractors.length < 3) {
        const used = new Set([pick.id, ...distractors.map((o) => o.id)]);
        distractors = distractors.concat(shuffle(everything.filter((o) => !used.has(o.id))).slice(0, 3 - distractors.length));
      }
      questions.push({
        mode,
        cellId,
        organelle: pick,
        byName: mode === 'find' && (Math.random() < 0.5 || !pick.explanation),
        options: mode === 'name' ? shuffle([pick, ...distractors]).map((o) => ({ id: o.id, label: o.name })) : null,
        answerId: pick.id,
      });
    }
  });
  return questions;
}

/** "Which cell is this?": random cells, half of them seen from the inside. */
function buildCellQuestions(cellIds, cells) {
  const questions = [];
  let previous = null;
  for (let i = 0; i < QUESTIONS.cell; i += 1) {
    const candidates = cellIds.filter((id) => id !== previous);
    const cellId = candidates[Math.floor(Math.random() * candidates.length)];
    previous = cellId;
    questions.push({
      mode: 'cell',
      cellId,
      inside: i % 2 === 1,
      options: cellIds.map((id) => ({ id, label: cells.find((cell) => cell.id === id)?.name ?? id })),
      answerId: cellId,
    });
  }
  return questions;
}

/**
 * Loads the organelle lists of the chosen cells (from cache when possible).
 * Hooks cannot run in a loop, so this supports up to four cells: the four
 * the app ships with.
 */
function useCellOrganelles(cellIds) {
  const a = useCellData(cellIds[0]);
  const b = useCellData(cellIds[1]);
  const c = useCellData(cellIds[2]);
  const d = useCellData(cellIds[3]);
  const results = [a, b, c, d].slice(0, cellIds.length);
  const ready = results.every((r) => r.status === 'ready');
  const map = useMemo(
    () => new Map(results.filter((r) => r.status === 'ready').map((r) => [r.cell.id, r.organelles])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, cellIds.join(',')],
  );
  return { ready, map };
}

export default function QuizPage() {
  const { t, lang } = useLang();
  const { cells, source } = useCells();
  const [searchParams] = useSearchParams();

  // A shared link (/quiz?mode=name&cells=hartcel,plantencel&t=45300) pre-fills the choice.
  const linkMode = MODES.includes(searchParams.get('mode')) ? searchParams.get('mode') : null;
  const linkCells = (searchParams.get('cells') ?? '').split(',').filter(Boolean);
  const challengeMs = Number(searchParams.get('t')) || null;

  const [mode, setMode] = useState(linkMode ?? 'find');
  const [chosen, setChosen] = useState(new Set(linkCells));
  const [shareState, setShareState] = useState(null);
  const [phase, setPhase] = useState('setup'); // setup | play | done
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState([]); // { text }
  const [penaltyMs, setPenaltyMs] = useState(0);
  const [feedback, setFeedback] = useState(null); // { kind: 'ok' | 'wrong', text, blocking }
  const [flashId, setFlashId] = useState(null);
  const [stageReady, setStageReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);

  const chosenIds = useMemo(() => cells.map((cell) => cell.id).filter((id) => chosen.has(id)), [cells, chosen]);
  const minCells = mode === 'cell' ? 2 : 1;
  const selectionKey = `${lang}:${mode}:${chosenIds.join('+')}`;
  const best = readBest(selectionKey);
  const { ready: dataReady, map: cellOrganelles } = useCellOrganelles(chosenIds);

  useEffect(() => {
    document.title = t('title.quiz');
  }, [t]);

  const question = questions[index] ?? null;
  const cellData = useCellData(question?.cellId);

  // ---- timer: runs while playing and the stage is ready (not during a cell rebuild)
  const runningSince = useRef(null);
  const bankedMs = useRef(0);
  const running = phase === 'play' && stageReady && !feedback?.blocking;
  useEffect(() => {
    if (!running) {
      if (runningSince.current != null) {
        bankedMs.current += performance.now() - runningSince.current;
        runningSince.current = null;
      }
      return undefined;
    }
    runningSince.current = performance.now();
    const timer = setInterval(() => setElapsed(bankedMs.current + performance.now() - runningSince.current), 100);
    return () => clearInterval(timer);
  }, [running]);
  const totalMs = elapsed + penaltyMs;

  const start = () => {
    setQuestions(mode === 'cell' ? buildCellQuestions(chosenIds, cells) : buildOrganelleQuestions(mode, chosenIds, cellOrganelles));
    setIndex(0);
    setMistakes([]);
    setPenaltyMs(0);
    setFeedback(null);
    setFlashId(null);
    setElapsed(0);
    bankedMs.current = 0;
    runningSince.current = null;
    setStageReady(false);
    setResult(null);
    setPhase('play');
  };

  const finish = useCallback(
    (finalMistakes, finalPenalty) => {
      const ms = bankedMs.current + (runningSince.current != null ? performance.now() - runningSince.current : 0);
      const total = ms + finalPenalty;
      const previousBest = readBest(selectionKey);
      const isBest = previousBest == null || total < previousBest;
      if (isBest) writeBest(selectionKey, total);
      setResult({ total, mistakes: finalMistakes, isBest });
      setShareState(null);
      setPhase('done');
      track('quiz-klaar', { spelvorm: mode, cellen: chosenIds.join('+'), tijd: Math.round(total / 1000), fouten: finalMistakes.length });
    },
    [selectionKey, mode, chosenIds],
  );

  const shareUrl = () => {
    const params = new URLSearchParams({ mode, cells: chosenIds.join(','), t: String(Math.round(result?.total ?? 0)) });
    return `${window.location.origin}/quiz?${params}`;
  };

  const share = async () => {
    if (!result) return;
    setShareState('busy');
    const m = result.mistakes.length;
    const cellNames = chosenIds.map((id) => cells.find((cell) => cell.id === id)?.name ?? id).join(' · ');
    const url = shareUrl();
    try {
      const blob = await renderResultCard({
        title: t('app.name'),
        mode: t(`quiz.mode.${mode}`),
        time: formatTime(result.total),
        cells: cellNames,
        mistakesLine: m === 0 ? t('quiz.share.flawless') : t(m === 1 ? 'quiz.resultMistakes' : 'quiz.resultMistakesPlural', { m, p: Math.round(penaltyMs / 1000) }),
        footer: t('quiz.share.footer'),
        url,
      });
      const outcome = await shareResultCard(blob, {
        title: t('quiz.share.title'),
        text: t('quiz.share.text', { time: formatTime(result.total), mode: t(`quiz.mode.${mode}`) }),
        url,
        filename: 'celverkenner-quiz.png',
      });
      setShareState(outcome);
      track('quiz-gedeeld', { spelvorm: mode, via: outcome });
    } catch {
      setShareState('failed');
    }
  };

  const next = useCallback(
    (finalMistakes, finalPenalty) => {
      setFeedback(null);
      setFlashId(null);
      if (index + 1 >= questions.length) {
        finish(finalMistakes, finalPenalty);
        return;
      }
      const current = questions[index];
      const upcoming = questions[index + 1];
      if (upcoming.cellId !== current.cellId || upcoming.inside !== current.inside) setStageReady(false);
      setIndex(index + 1);
    },
    [index, questions, finish],
  );

  // One line for the review list at the end: what was asked, what was right, what went wrong.
  const reviewEntry = (q, chosenLabel) => {
    const what = chosenLabel ? t('quiz.reviewClicked', { name: chosenLabel }) : t('quiz.reviewSkipped');
    if (q.mode === 'cell') {
      const name = cells.find((cell) => cell.id === q.cellId)?.name ?? q.cellId;
      return { text: t('quiz.reviewName', { answer: name, what }) };
    }
    if (q.mode === 'name' || q.byName) return { text: t('quiz.reviewName', { answer: q.organelle.name, what }) };
    return { text: t('quiz.reviewFunction', { fn: q.organelle.explanation, answer: q.organelle.name, what }) };
  };

  const labelOf = (id) => {
    if (question.mode === 'cell') return cells.find((cell) => cell.id === id)?.name ?? null;
    return cellData.status === 'ready' ? (cellData.organelles.find((o) => o.id === id)?.name ?? null) : null;
  };

  const answer = (id) => {
    if (phase !== 'play' || !question || feedback?.blocking) return;
    if (id === question.answerId) {
      setFeedback({ kind: 'ok', text: t('quiz.correct'), blocking: true });
      if (question.mode !== 'cell') setFlashId(id);
      setTimeout(() => next(mistakes, penaltyMs), 700);
      return;
    }
    const newMistakes = [...mistakes, reviewEntry(question, labelOf(id))];
    const newPenalty = penaltyMs + PENALTY_S * 1000;
    setMistakes(newMistakes);
    setPenaltyMs(newPenalty);
    const wrongName = labelOf(id);
    if (question.mode === 'find') {
      // Keep looking: the same task stays on screen.
      setFeedback({ kind: 'wrong', text: wrongName ? t('quiz.wrong', { name: wrongName }) : t('quiz.wrongUnknown') });
      return;
    }
    // Multiple choice: show the right answer briefly, then move on.
    const correctName = labelOf(question.answerId);
    setFeedback({ kind: 'wrong', text: t('quiz.wrongAnswer', { name: correctName }), blocking: true });
    setTimeout(() => next(newMistakes, newPenalty), 1400);
  };

  const skip = () => {
    if (phase !== 'play' || !question || feedback?.blocking) return;
    const newMistakes = [...mistakes, reviewEntry(question, null)];
    const newPenalty = penaltyMs + SKIP_S * 1000;
    setMistakes(newMistakes);
    setPenaltyMs(newPenalty);
    next(newMistakes, newPenalty);
  };

  // -------------------------------------------------------------- setup screen
  if (phase === 'setup') {
    const canStart = chosenIds.length >= minCells && dataReady;
    return (
      <div className="page">
        <SiteHeader source={source} title={t('nav.quiz')} />
        <main className="page__main quiz-setup">
          <div className="page__intro">
            <h1 className="page__title">{t('quiz.title')}</h1>
            <p className="page__lead">{t('quiz.lead', { penalty: PENALTY_S })}</p>
            {challengeMs && (
              <p className="quiz-challenge">{t('quiz.challenge', { time: formatTime(challengeMs) })}</p>
            )}
          </div>

          <fieldset className="quiz-modes">
            <legend className="quiz-setup__legend">{t('quiz.pickMode')}</legend>
            {MODES.map((item) => (
              <label key={item} className={`quiz-mode${mode === item ? ' is-checked' : ''}`}>
                <input
                  type="radio"
                  name="quiz-mode"
                  value={item}
                  className="visually-hidden"
                  checked={mode === item}
                  onChange={() => setMode(item)}
                />
                <span className="quiz-mode__name">{t(`quiz.mode.${item}`)}</span>
                <span className="quiz-mode__text">{t(`quiz.mode.${item}.text`, { n: QUESTIONS[item] })}</span>
              </label>
            ))}
          </fieldset>

          <fieldset className="cell-choice quiz-setup__cells">
            <legend className="quiz-setup__legend">{t('quiz.pickCells')}</legend>
            {cells.map((cell) => {
              const checked = chosen.has(cell.id);
              return (
                <label key={cell.id} className={`cell-option${checked ? ' is-checked' : ''}`}>
                  <input
                    type="checkbox"
                    className="visually-hidden"
                    checked={checked}
                    onChange={() =>
                      setChosen((current) => {
                        const nextSet = new Set(current);
                        if (nextSet.has(cell.id)) nextSet.delete(cell.id);
                        else nextSet.add(cell.id);
                        return nextSet;
                      })
                    }
                  />
                  <span className="cell-option__radio cell-option__radio--check" aria-hidden="true" />
                  <span className="cell-option__text">
                    <span className="cell-option__name">{cell.name}</span>
                    <span className="cell-option__tagline">{cell.tagline}</span>
                  </span>
                  <span className="cell-option__type">{cell.type_label}</span>
                </label>
              );
            })}
          </fieldset>
          <p className="quiz-setup__hint">
            {chosenIds.length < minCells
              ? t(minCells === 2 ? 'quiz.pickHintTwo' : 'quiz.pickHint')
              : best != null
                ? t('quiz.best', { time: formatTime(best) })
                : ''}
          </p>

          <div className="home__actions">
            <Button onClick={start} disabled={!canStart}>
              {chosenIds.length >= minCells && !dataReady ? t('loading') : t('quiz.start')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------- result screen
  if (phase === 'done' && result) {
    const m = result.mistakes.length;
    const penaltySeconds = Math.round(penaltyMs / 1000);
    return (
      <div className="page">
        <SiteHeader source={source} title={t('nav.quiz')} />
        <main className="page__main quiz-result">
          <p className="quiz-result__done">{t('quiz.done')}</p>
          <p className="quiz-result__time">{formatTime(result.total)}</p>
          <p className="page__lead">
            {t(mode === 'cell' ? 'quiz.resultCells' : 'quiz.result', { n: questions.length, time: formatTime(result.total) })}
          </p>
          {m > 0 && (
            <p className="quiz-result__mistakes">
              {t(m === 1 ? 'quiz.resultMistakes' : 'quiz.resultMistakesPlural', { m, p: penaltySeconds })}
            </p>
          )}
          {result.isBest && <p className="quiz-result__best">{t('quiz.newBest')}</p>}
          {challengeMs && (
            <p className={`quiz-result__challenge${result.total < challengeMs ? ' is-won' : ''}`}>
              {t(result.total < challengeMs ? 'quiz.challengeWon' : 'quiz.challengeLost', { time: formatTime(challengeMs) })}
            </p>
          )}

          {m > 0 && (
            <section className="quiz-result__review">
              <h2>{t('quiz.review')}</h2>
              <ul>
                {result.mistakes.map((entry, i) => (
                  <li key={i}>{entry.text}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="home__actions">
            <Button onClick={start}>{t('quiz.again')}</Button>
            <Button variant="outline" onClick={share} disabled={shareState === 'busy'}>
              {t('quiz.share.button')}
            </Button>
            <Button variant="quiet" onClick={() => setPhase('setup')}>
              {t('quiz.other')}
            </Button>
          </div>
          {shareState && shareState !== 'busy' && shareState !== 'cancelled' && (
            <p className="quiz-result__share-note" role="status">
              {t(`quiz.share.${shareState}`)}
            </p>
          )}
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------- playing
  const ready = cellData.status === 'ready';
  const isCellQuiz = question.mode === 'cell';
  const viewerMode = isCellQuiz && question.inside ? 'intracellular' : 'viewer';
  const promptText =
    question.mode === 'find'
      ? question.byName
        ? t('quiz.clickName', { name: question.organelle.name })
        : null
      : t(question.mode === 'name' ? 'quiz.askName' : 'quiz.askCell');

  return (
    <div className="experience experience--quiz">
      <SiteHeader source={ready ? cellData.source : null} title={t('nav.quiz')} />
      <div className="experience__body">
        <aside className="experience__sidebar quiz-side">
          <div className="quiz-side__stats">
            <div>
              <span className="quiz-side__label">{t('quiz.time')}</span>
              <span className="quiz-side__value quiz-side__value--time">{formatTime(totalMs)}</span>
            </div>
            <div>
              <span className="quiz-side__label">{t('quiz.mistakes')}</span>
              <span className="quiz-side__value">{mistakes.length}</span>
            </div>
          </div>

          <div className={`quiz-card${feedback ? ` quiz-card--${feedback.kind}` : ''}`} key={index}>
            <p className="quiz-card__count">
              {t('quiz.question', { i: index + 1, n: questions.length })}
              {!isCellQuiz && ready ? ` · ${cellData.cell.name}` : ''}
            </p>
            <p className="quiz-card__prompt">
              {promptText ?? (
                <>
                  <span className="quiz-card__lead">{t('quiz.clickFunction')}</span>
                  <span className="quiz-card__function">{question.organelle.explanation}</span>
                </>
              )}
            </p>

            {question.options && (
              <div className="quiz-options">
                {question.options.map((option) => {
                  const reveal = feedback?.blocking && option.id === question.answerId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`quiz-option${reveal ? ' is-correct' : ''}`}
                      onClick={() => answer(option.id)}
                      disabled={Boolean(feedback?.blocking)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}

            {feedback && (
              <p className={`quiz-card__feedback quiz-card__feedback--${feedback.kind}`} role="status">
                {feedback.text}
              </p>
            )}
            {!feedback && question.mode === 'find' && <p className="quiz-card__hint">{t('quiz.hint')}</p>}
            {!feedback && question.mode === 'name' && <p className="quiz-card__hint">{t('quiz.hintName')}</p>}
            {!feedback && isCellQuiz && (
              <p className="quiz-card__hint">{t(question.inside ? 'quiz.hintInside' : 'quiz.hintOutside')}</p>
            )}
          </div>

          <div className="quiz-side__actions">
            <Button variant="outline" size="sm" onClick={skip} disabled={Boolean(feedback?.blocking)}>
              {t('quiz.skip', { s: SKIP_S })}
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setPhase('setup')}>
              {t('quiz.stop')}
            </Button>
          </div>
        </aside>

        <main className="stage">
          {ready ? (
            <CellViewer
              key={viewerMode}
              cell={cellData.cell}
              definitions={cellData.definitions}
              mode={viewerMode}
              autoRotate
              open
              showNames={false}
              flyOnSelect={question.mode === 'name'}
              selectedId={question.mode === 'name' ? question.answerId : flashId}
              onSelect={(id) => id && question.mode === 'find' && answer(id)}
              onCounts={() => setStageReady(true)}
            />
          ) : (
            <Spinner label={t('quiz.loading')} />
          )}
          {ready && !stageReady && <Spinner label={t('quiz.loading')} />}
          {feedback && <div className={`quiz-flash quiz-flash--${feedback.kind}`} aria-hidden="true" />}
        </main>
      </div>
    </div>
  );
}
