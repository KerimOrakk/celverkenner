import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CellViewer from '../components/CellViewer.jsx';
import SiteHeader from '../components/SiteHeader.jsx';
import { useCellData } from '../hooks/useCellData.js';
import { useCells } from '../hooks/useCells.js';
import { useLang } from '../i18n/index.jsx';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';

const QUESTIONS = 10;
const PENALTY_S = 3; // per wrong click
const SKIP_S = 5;
const EXCLUDED = new Set(['ribosomen']); // too small to click fairly
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
 * Build the question list: cells stay grouped (fewer reloads), organelles
 * within a cell are drawn without direct repeats, half the questions ask by
 * name, half by function.
 */
function buildQuestions(cellIds, cellOrganelles) {
  const order = shuffle(cellIds);
  const perCell = Math.floor(QUESTIONS / order.length);
  let remainder = QUESTIONS - perCell * order.length;
  const questions = [];
  let previous = null;
  order.forEach((cellId) => {
    const pool = cellOrganelles.get(cellId).filter((o) => !EXCLUDED.has(o.id));
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
      questions.push({ cellId, organelle: pick, byName: Math.random() < 0.5 || !pick.explanation });
    }
  });
  return questions;
}

/**
 * Loads the organelle lists of the chosen cells (from cache when possible).
 * Hooks cannot run in a loop, so this supports up to three cells: the three
 * the app ships with.
 */
function useCellOrganelles(cellIds) {
  const a = useCellData(cellIds[0]);
  const b = useCellData(cellIds[1]);
  const c = useCellData(cellIds[2]);
  const results = [a, b, c].slice(0, cellIds.length);
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

  const [chosen, setChosen] = useState(new Set());
  const [phase, setPhase] = useState('setup'); // setup | play | done
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState([]); // { prompt, answer }
  const [penaltyMs, setPenaltyMs] = useState(0);
  const [feedback, setFeedback] = useState(null); // { kind: 'ok' | 'wrong', text }
  const [flashId, setFlashId] = useState(null);
  const [stageReady, setStageReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);

  const chosenIds = useMemo(() => cells.map((cell) => cell.id).filter((id) => chosen.has(id)), [cells, chosen]);
  const selectionKey = `${lang}:${chosenIds.join('+')}`;
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
    setQuestions(buildQuestions(chosenIds, cellOrganelles));
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
      setPhase('done');
    },
    [selectionKey],
  );

  const next = useCallback(
    (finalMistakes, finalPenalty) => {
      setFeedback(null);
      setFlashId(null);
      if (index + 1 >= questions.length) {
        finish(finalMistakes, finalPenalty);
        return;
      }
      if (questions[index + 1].cellId !== questions[index].cellId) setStageReady(false);
      setIndex(index + 1);
    },
    [index, questions, finish],
  );

  const answer = (organelleId) => {
    if (phase !== 'play' || !question || feedback?.blocking) return;
    if (organelleId === question.organelle.id) {
      setFeedback({ kind: 'ok', text: t('quiz.correct'), blocking: true });
      setFlashId(organelleId);
      setTimeout(() => next(mistakes, penaltyMs), 700);
      return;
    }
    const clicked = cellData.status === 'ready' ? cellData.organelles.find((o) => o.id === organelleId) : null;
    const newMistakes = [...mistakes, reviewEntry(question, clicked?.name ?? null)];
    const newPenalty = penaltyMs + PENALTY_S * 1000;
    setMistakes(newMistakes);
    setPenaltyMs(newPenalty);
    setFeedback({ kind: 'wrong', text: clicked ? t('quiz.wrong', { name: clicked.name }) : t('quiz.wrongUnknown') });
  };

  const skip = () => {
    if (phase !== 'play' || !question || feedback?.blocking) return;
    const newMistakes = [...mistakes, reviewEntry(question, null)];
    const newPenalty = penaltyMs + SKIP_S * 1000;
    setMistakes(newMistakes);
    setPenaltyMs(newPenalty);
    next(newMistakes, newPenalty);
  };

  // One line for the review list at the end: what was asked, what was right, what went wrong.
  function reviewEntry(q, clickedName) {
    const what = clickedName ? t('quiz.reviewClicked', { name: clickedName }) : t('quiz.reviewSkipped');
    const text = q.byName
      ? t('quiz.reviewName', { answer: q.organelle.name, what })
      : t('quiz.reviewFunction', { fn: q.organelle.explanation, answer: q.organelle.name, what });
    return { text };
  }

  // -------------------------------------------------------------- setup screen
  if (phase === 'setup') {
    return (
      <div className="page">
        <SiteHeader source={source} title={t('nav.quiz')} />
        <main className="page__main quiz-setup">
          <div className="page__intro">
            <h1 className="page__title">{t('quiz.title')}</h1>
            <p className="page__lead">{t('quiz.lead', { n: QUESTIONS, penalty: PENALTY_S })}</p>
          </div>

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
            {chosenIds.length === 0 ? t('quiz.pickHint') : best != null ? t('quiz.best', { time: formatTime(best) }) : ''}
          </p>

          <div className="home__actions">
            <Button onClick={start} disabled={chosenIds.length === 0 || !dataReady}>
              {chosenIds.length > 0 && !dataReady ? t('loading') : t('quiz.start')}
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
          <p className="page__lead">{t('quiz.result', { n: QUESTIONS, time: formatTime(result.total) })}</p>
          {m > 0 && (
            <p className="quiz-result__mistakes">
              {t(m === 1 ? 'quiz.resultMistakes' : 'quiz.resultMistakesPlural', { m, p: penaltySeconds })}
            </p>
          )}
          {result.isBest && <p className="quiz-result__best">{t('quiz.newBest')}</p>}

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
            <Button variant="outline" onClick={() => setPhase('setup')}>
              {t('quiz.other')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------- playing
  const ready = cellData.status === 'ready';
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
              {t('quiz.question', { i: index + 1, n: questions.length })} · {ready ? cellData.cell.name : ''}
            </p>
            <p className="quiz-card__prompt">
              {question.byName ? (
                t('quiz.clickName', { name: question.organelle.name })
              ) : (
                <>
                  <span className="quiz-card__lead">{t('quiz.clickFunction')}</span>
                  <span className="quiz-card__function">{question.organelle.explanation}</span>
                </>
              )}
            </p>
            {feedback && (
              <p className={`quiz-card__feedback quiz-card__feedback--${feedback.kind}`} role="status">
                {feedback.text}
              </p>
            )}
            {!feedback && <p className="quiz-card__hint">{t('quiz.hint')}</p>}
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
              cell={cellData.cell}
              definitions={cellData.definitions}
              mode="viewer"
              autoRotate
              open
              showNames={false}
              flyOnSelect={false}
              selectedId={flashId}
              onSelect={(id) => id && answer(id)}
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
