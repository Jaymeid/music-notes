import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  Check,
  Music2,
  Play,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Volume2,
  X,
} from 'lucide-react'

const STORAGE_KEY = 'piano-flipnote-progress-v1'
const SHEET_VISIBILITY_KEY = 'piano-flipnote-show-sheet-v1'
const QUESTION_COUNT = 10
const PIANO_SAMPLE_BASE = '/audio/piano'
const audioCache = new Map()
const NATURAL_NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const TREBLE_FULL = [
  'C4',
  'D4',
  'E4',
  'F4',
  'G4',
  'A4',
  'B4',
  'C5',
  'D5',
  'E5',
  'F5',
  'G5',
  'A5',
  'B5',
  'C6',
]
const BASS_FULL = [
  'C2',
  'D2',
  'E2',
  'F2',
  'G2',
  'A2',
  'B2',
  'C3',
  'D3',
  'E3',
  'F3',
  'G3',
  'A3',
  'B3',
  'C4',
]
const TREBLE_BASICS = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
const BASS_ANCHORS = ['G3', 'A3', 'B3', 'C4']
const TREBLE_SHARPS = ['C#4', 'D#4', 'F#4', 'G#4', 'A#4', 'C#5', 'D#5', 'F#5', 'G#5', 'A#5']
const TREBLE_FLATS = ['Db4', 'Eb4', 'Gb4', 'Ab4', 'Bb4', 'Db5', 'Eb5', 'Gb5', 'Ab5', 'Bb5']
const BASS_SHARPS = ['C#2', 'D#2', 'F#2', 'G#2', 'A#2', 'C#3', 'D#3', 'F#3', 'G#3', 'A#3']
const BASS_FLATS = ['Db2', 'Eb2', 'Gb2', 'Ab2', 'Bb2', 'Db3', 'Eb3', 'Gb3', 'Ab3', 'Bb3']
const TREBLE_ACCIDENTALS = [...TREBLE_SHARPS, ...TREBLE_FLATS]
const BASS_ACCIDENTALS = [...BASS_SHARPS, ...BASS_FLATS]
const TREBLE_ACCIDENTAL_BASICS = ['C#4', 'Db4', 'D#4', 'Eb4', 'F#4', 'Gb4', 'G#4', 'Bb4']
const BASS_ACCIDENTAL_BASICS = ['C#3', 'Db3', 'D#3', 'Eb3', 'F#3', 'Gb3', 'A#3', 'Bb3']

function noteIndex(name) {
  const [, letter, octave] = name.match(/^([A-G])(?:#|b)?(\d)$/)
  return Number(octave) * NATURAL_NOTE_NAMES.length + NATURAL_NOTE_NAMES.indexOf(letter)
}

function noteFrequency(name) {
  const [, letter, accidental = '', octave] = name.match(/^([A-G])(#|b)?(\d)$/)
  const semitoneOffsets = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }
  const accidentalOffset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  const semitoneDistance =
    semitoneOffsets[letter] + accidentalOffset + (Number(octave) - 4) * 12
  return 440 * 2 ** (semitoneDistance / 12)
}

function noteLabel(name) {
  if (name === 'C4') return 'Middle C'
  if (name === 'C6') return 'High C'
  if (name.endsWith('2') || name.endsWith('3')) return `Low ${name.slice(0, -1)}`
  return name.slice(0, -1)
}

function sampleName(name) {
  const sharpToFlat = {
    'C#': 'Db',
    'D#': 'Eb',
    'F#': 'Gb',
    'G#': 'Ab',
    'A#': 'Bb',
  }
  const [, pitch, octave] = name.match(/^([A-G](?:#|b)?)(\d)$/)
  return `${sharpToFlat[pitch] ?? pitch}${octave}.wav`
}

function makeNote(name, clef) {
  const index = noteIndex(name)
  return {
    id: `${clef}-${name}`,
    name,
    label: noteLabel(name),
    frequency: noteFrequency(name),
    clef,
    step: clef === 'treble' ? 34 - index : 32 - index,
    accidental: name.includes('#') ? '♯' : name.includes('b') ? '♭' : null,
    sample: sampleName(name),
  }
}

const NOTES = [
  ...TREBLE_FULL.map((name) => makeNote(name, 'treble')),
  ...BASS_FULL.map((name) => makeNote(name, 'bass')),
  ...TREBLE_ACCIDENTALS.map((name) => makeNote(name, 'treble')),
  ...BASS_ACCIDENTALS.map((name) => makeNote(name, 'bass')),
]

const MODES = [
  {
    id: 'treble-basics',
    title: 'Treble refresher',
    subtitle: 'Middle C through high C',
    description: 'A friendly first pass for reading right-hand notes again.',
    noteIds: TREBLE_BASICS.map((name) => `treble-${name}`),
    accent: 'from-cyan-500 to-emerald-500',
  },
  {
    id: 'bass-anchors',
    title: 'Bass anchors',
    subtitle: 'Low G through middle C',
    description: 'Build confidence with left-hand landmarks around the bass staff.',
    noteIds: BASS_ANCHORS.map((name) => `bass-${name}`),
    accent: 'from-rose-500 to-amber-500',
  },
  {
    id: 'mixed-staff',
    title: 'Mixed staff',
    subtitle: 'Treble and bass together',
    description: 'A 10-card shuffle that checks both ears and staff memory.',
    noteIds: [
      ...TREBLE_BASICS.map((name) => `treble-${name}`),
      ...BASS_ANCHORS.map((name) => `bass-${name}`),
    ],
    accent: 'from-violet-500 to-cyan-500',
  },
  {
    id: 'accidental-basics',
    title: 'Sharp and flat basics',
    subtitle: 'Common black-key spellings',
    description: 'A 10-card shuffle for recognising sharps and flats on the staff.',
    noteIds: [
      ...TREBLE_ACCIDENTAL_BASICS.map((name) => `treble-${name}`),
      ...BASS_ACCIDENTAL_BASICS.map((name) => `bass-${name}`),
    ],
    accent: 'from-fuchsia-500 to-sky-500',
  },
  {
    id: 'full-treble',
    title: 'Full treble staff',
    subtitle: 'Every natural note from C4 to C6',
    description: 'A complete right-hand reading set with every note appearing once.',
    noteIds: TREBLE_FULL.map((name) => `treble-${name}`),
    exhaustive: true,
    accent: 'from-sky-500 to-blue-500',
  },
  {
    id: 'full-bass',
    title: 'Full bass staff',
    subtitle: 'Every natural note from C2 to C4',
    description: 'A complete left-hand reading set with every note appearing once.',
    noteIds: BASS_FULL.map((name) => `bass-${name}`),
    exhaustive: true,
    accent: 'from-orange-500 to-red-500',
  },
  {
    id: 'full-grand-staff',
    title: 'Full grand staff',
    subtitle: 'All bass and treble natural notes',
    description: 'The full coverage round: every natural note in both staves.',
    noteIds: [
      ...BASS_FULL.map((name) => `bass-${name}`),
      ...TREBLE_FULL.map((name) => `treble-${name}`),
    ],
    exhaustive: true,
    accent: 'from-emerald-500 to-violet-500',
  },
  {
    id: 'full-treble-accidentals',
    title: 'Treble sharps and flats',
    subtitle: 'Every sharp and flat spelling from C4 to C6',
    description: 'A complete treble accidental set with each spelling appearing once.',
    noteIds: TREBLE_ACCIDENTALS.map((name) => `treble-${name}`),
    exhaustive: true,
    accent: 'from-fuchsia-500 to-purple-500',
  },
  {
    id: 'full-bass-accidentals',
    title: 'Bass sharps and flats',
    subtitle: 'Every sharp and flat spelling from C2 to C4',
    description: 'A complete bass accidental set with each spelling appearing once.',
    noteIds: BASS_ACCIDENTALS.map((name) => `bass-${name}`),
    exhaustive: true,
    accent: 'from-amber-500 to-fuchsia-500',
  },
  {
    id: 'full-grand-accidentals',
    title: 'Grand staff accidentals',
    subtitle: 'All bass and treble sharp/flat spellings',
    description: 'The full accidental coverage round across both staves.',
    noteIds: [
      ...BASS_ACCIDENTALS.map((name) => `bass-${name}`),
      ...TREBLE_ACCIDENTALS.map((name) => `treble-${name}`),
    ],
    exhaustive: true,
    accent: 'from-cyan-500 to-fuchsia-500',
  },
]

function getStoredProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

function getStoredSheetVisibility() {
  return localStorage.getItem(SHEET_VISIBILITY_KEY) !== 'false'
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5)
}

function uniqueNotesByName(notes) {
  return Array.from(new Map(notes.map((note) => [note.name, note])).values())
}

function playGeneratedTone(note, duration = 0.9) {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return

  const audio = new AudioContext()
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(note.frequency, audio.currentTime)
  gain.gain.setValueAtTime(0.0001, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.22, audio.currentTime + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration)

  oscillator.connect(gain)
  gain.connect(audio.destination)
  oscillator.start()
  oscillator.stop(audio.currentTime + duration + 0.04)
}

function getSampleAudio(note) {
  const src = `${PIANO_SAMPLE_BASE}/${note.sample}`
  if (!audioCache.has(src)) {
    const audio = new Audio(src)
    audio.preload = 'auto'
    audioCache.set(src, audio)
  }
  return audioCache.get(src)
}

function preloadNoteSamples(notes) {
  notes.forEach((note) => getSampleAudio(note).load())
}

function playNote(note) {
  const cachedAudio = getSampleAudio(note)
  const audio = cachedAudio.cloneNode()
  audio.volume = 0.9
  audio.play().catch(() => playGeneratedTone(note))
}

function getModeNotes(mode) {
  const noteIds = new Set(mode.noteIds)
  return NOTES.filter((note) => noteIds.has(note.id))
}

function makeQuestion(note, available) {
  const distractors = shuffle(
    uniqueNotesByName(available).filter((candidate) => candidate.name !== note.name),
  ).slice(0, 3)

  return {
    id: crypto.randomUUID(),
    note,
    choices: shuffle([note, ...distractors]).map((choice) => choice.name),
  }
}

function makeQuestionPool(mode, progress) {
  const available = getModeNotes(mode)

  if (mode.exhaustive) {
    return shuffle(available).map((note) => makeQuestion(note, available))
  }

  const weighted = available.flatMap((note) => {
    const key = note.id
    const stats = progress[key]
    if (!stats?.attempts) return [note, note]
    const accuracy = stats.correct / stats.attempts
    if (accuracy < 0.55) return [note, note, note, note]
    if (accuracy < 0.75) return [note, note, note]
    return [note]
  })

  return Array.from({ length: QUESTION_COUNT }, () => {
    const note = weighted[Math.floor(Math.random() * weighted.length)]
    return makeQuestion(note, available)
  })
}

function summarizeProgress(progress) {
  const entries = Object.entries(progress)
  const attempts = entries.reduce((total, [, stat]) => total + stat.attempts, 0)
  const correct = entries.reduce((total, [, stat]) => total + stat.correct, 0)
  const weakest = entries
    .filter(([, stat]) => stat.attempts >= 2)
    .sort(([, a], [, b]) => a.correct / a.attempts - b.correct / b.attempts)
    .slice(0, 3)

  return {
    attempts,
    accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    weakest,
  }
}

function StaffPreview({ note, revealed }) {
  const noteBase = note.clef === 'treble' ? 64 : 34
  const staffTop = noteBase + 6
  const top = noteBase + note.step * 8
  const ledgerSteps =
    note.step < 0
      ? Array.from({ length: Math.ceil(Math.abs(note.step) / 2) }, (_, index) => -2 - index * 2)
      : note.step > 8
        ? Array.from({ length: Math.ceil((note.step - 8) / 2) }, (_, index) => 10 + index * 2)
        : []

  return (
    <div className="relative mx-auto h-44 w-full max-w-sm overflow-hidden rounded-md border border-slate-200 bg-white px-8 py-5 shadow-inner dark:border-slate-700 dark:bg-slate-950">
      <div
        className="absolute left-5 text-5xl font-serif text-slate-300 dark:text-slate-600"
        style={{ top: staffTop - 7 }}
      >
        {note.clef === 'treble' ? '𝄞' : '𝄢'}
      </div>
      {[0, 1, 2, 3, 4].map((line) => (
        <div
          key={line}
          className="absolute left-16 right-8 h-px bg-slate-400 dark:bg-slate-500"
          style={{ top: staffTop + line * 16 }}
        />
      ))}
      {ledgerSteps.map((step) => (
        <div
          key={step}
          className="absolute left-1/2 h-px w-16 -translate-x-1/2 bg-slate-400 dark:bg-slate-500"
          style={{ top: staffTop + step * 8 }}
        />
      ))}
      {note.accidental && (
        <div
          className="absolute left-[calc(50%-2.75rem)] -translate-y-1/2 text-3xl font-semibold text-slate-950 dark:text-white"
          style={{ top: top + 10 }}
        >
          {note.accidental}
        </div>
      )}
      <div
        className={`absolute left-1/2 h-5 w-8 -translate-x-1/2 rotate-[-18deg] rounded-full border-2 transition-all duration-300 ${
          revealed
            ? 'border-slate-950 bg-slate-950 dark:border-white dark:bg-white'
            : 'border-slate-400 bg-slate-200 dark:border-slate-500 dark:bg-slate-700'
        }`}
        style={{ top }}
      />
    </div>
  )
}

function Home({ progress, onStart, showSheet, onToggleSheet }) {
  const summary = summarizeProgress(progress)
  const quickModes = MODES.filter((mode) => !mode.exhaustive)
  const fullSetModes = MODES.filter((mode) => mode.exhaustive)

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-slate-200 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
              <Music2 size={22} />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Piano Flip Notes
              </p>
              <h1 className="text-xl font-semibold sm:text-2xl">
                Learn the notes again
              </h1>
            </div>
          </div>
        </header>

        <section className="grid gap-6 py-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="space-y-7">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                <Sparkles size={16} />
                Quick drills and full sets
              </div>
              <h2 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                Hear a note, flip the card, choose the answer.
              </h2>
              <p className="max-w-2xl leading-7 text-slate-600 dark:text-slate-300">
                Each session shuffles piano notes into quick revision cards. The
                practice mix gently adapts toward the notes that need more
                attention.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Attempts
                </p>
                <p className="mt-2 text-3xl font-semibold">{summary.attempts}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Accuracy
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {summary.accuracy}%
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleSheet}
              className="flex w-full items-center justify-between gap-4 rounded-md border border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800"
            >
              <span>
                <span className="block font-semibold">Show sheet image</span>
                <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                  {showSheet
                    ? 'Sheet side displays the staff note.'
                    : 'Sheet side hides the staff note for sound-only recall.'}
                </span>
              </span>
              {showSheet ? (
                <ToggleRight className="shrink-0 text-emerald-400" size={34} />
              ) : (
                <ToggleLeft className="shrink-0 text-slate-500" size={34} />
              )}
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Quick 10-card drills</h3>
                <BarChart3 className="text-slate-400" size={20} />
              </div>
              <div className="space-y-3">
                {quickModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onStart(mode)}
                    className="group flex w-full items-center gap-4 rounded-md border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                  >
                    <span
                      className={`h-14 w-2 rounded-full bg-gradient-to-b ${mode.accent}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{mode.title}</span>
                      <span className="block text-sm text-slate-500 dark:text-slate-400">
                        {mode.subtitle}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                        {mode.description}
                      </span>
                    </span>
                    <Play
                      className="shrink-0 text-slate-400 transition group-hover:text-slate-900 dark:group-hover:text-white"
                      size={18}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Full note sets</h3>
                <Sparkles className="text-slate-400" size={20} />
              </div>
              <div className="space-y-3">
                {fullSetModes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onStart(mode)}
                    className="group flex w-full items-center gap-4 rounded-md border border-slate-200 p-4 text-left transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                  >
                    <span
                      className={`h-14 w-2 rounded-full bg-gradient-to-b ${mode.accent}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{mode.title}</span>
                      <span className="block text-sm text-slate-500 dark:text-slate-400">
                        {mode.subtitle}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                        {mode.description}
                      </span>
                    </span>
                    <Play
                      className="shrink-0 text-slate-400 transition group-hover:text-slate-900 dark:group-hover:text-white"
                      size={18}
                    />
                  </button>
                ))}
              </div>
            </div>

            {summary.weakest.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-3 text-lg font-semibold">Needs practice</h3>
                <div className="space-y-2">
                  {summary.weakest.map(([key, stat]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800"
                    >
                      <span>{key.replace('-', ' ')}</span>
                      <span className="font-medium">
                        {Math.round((stat.correct / stat.attempts) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </section>
      </div>
    </main>
  )
}

function Practice({ mode, progress, showSheet, onSaveProgress, onExit }) {
  const [questions] = useState(() => makeQuestionPool(mode, progress))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [selected, setSelected] = useState(null)
  const [sessionAnswers, setSessionAnswers] = useState([])

  const totalQuestions = questions.length
  const complete = index >= totalQuestions
  const question = complete ? null : questions[index]
  const isCorrect = question ? selected === question.note.name : false
  const score = sessionAnswers.filter((answer) => answer.correct).length

  useEffect(() => {
    preloadNoteSamples(questions.map((item) => item.note))
  }, [questions])

  useEffect(() => {
    if (!complete && question) {
      setSelected(null)
      setFlipped(false)
    }
  }, [complete, question])

  function chooseAnswer(choice) {
    if (selected) return

    const correct = choice === question.note.name
    const key = question.note.id
    const updated = {
      ...progress,
      [key]: {
        attempts: (progress[key]?.attempts ?? 0) + 1,
        correct: (progress[key]?.correct ?? 0) + (correct ? 1 : 0),
        streak: correct ? (progress[key]?.streak ?? 0) + 1 : 0,
        misses: (progress[key]?.misses ?? 0) + (correct ? 0 : 1),
      },
    }

    setSelected(choice)
    setSessionAnswers((answers) => [
      ...answers,
      { note: question.note.name, correct },
    ])
    onSaveProgress(updated)
  }

  function nextQuestion() {
    if (index + 1 >= totalQuestions) {
      setIndex(totalQuestions)
      return
    }
    setIndex((current) => current + 1)
  }

  function restartRound() {
    setIndex(0)
    setFlipped(false)
    setSelected(null)
    setSessionAnswers([])
  }

  if (complete) {
    return (
      <main className="min-h-screen bg-stone-50 px-4 py-6 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col justify-center">
          <div className="rounded-md border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <div className="mx-auto mb-5 grid size-14 place-items-center rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <Check size={28} />
            </div>
            <p className="text-sm font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Session complete
            </p>
            <h2 className="mt-2 text-4xl font-semibold">
              {score} / {totalQuestions}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-slate-600 dark:text-slate-300">
              Nice round. Future sessions will keep leaning toward the notes
              that need repetition.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={restartRound}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Try another round
              </button>
              <button
                type="button"
                onClick={onExit}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-5 py-3 font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ArrowLeft size={18} />
                Home
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-stone-50 px-3 py-3 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:px-4">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={16} />
            Home
          </button>
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {mode.title}
            </p>
            <p className="font-semibold">
              Card {index + 1} of {totalQuestions}
            </p>
          </div>
        </header>

        <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[1fr_0.82fr] lg:items-stretch">
          <div
            role="button"
            tabIndex={0}
            aria-label={flipped ? 'Flip back to sound side' : 'Flip to sheet side'}
            onClick={() => {
              if (!selected) setFlipped((current) => !current)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                if (!selected) setFlipped((current) => !current)
              }
            }}
            className={`min-h-[390px] rounded-md border p-4 text-left shadow-xl shadow-slate-950/20 transition focus:outline-none focus:ring-2 focus:ring-cyan-400 lg:h-full ${
              selected
                ? 'border-slate-700 bg-slate-900'
                : `cursor-pointer bg-slate-900 ring-1 hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-slate-800 hover:ring-cyan-300/40 ${
                    flipped
                      ? 'border-slate-600 ring-slate-600/30'
                      : 'border-cyan-500/40 ring-cyan-400/20'
                  }`
            }`}
          >
            <div className="flex h-full flex-col justify-between gap-4">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300">
                  {flipped ? 'Sheet side' : 'Sound side'}
                </span>
                <span className="rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300">
                  {selected
                    ? 'Answered'
                    : flipped
                      ? 'Choose below'
                      : 'Answers locked'}
                </span>
              </div>

              <div className="space-y-5 text-center">
                {!flipped ? (
                  <>
                    <div className="mx-auto grid size-18 place-items-center rounded-full bg-cyan-950 text-cyan-200 ring-8 ring-cyan-400/10">
                      <Volume2 size={34} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold">
                        Listen to the note
                      </h2>
                      <p className="mt-1 text-sm text-slate-300">
                        Play it as often as you like, then flip to the sheet
                        side when you are ready.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        playNote(question.note)
                      }}
                      className="mx-auto inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 font-medium text-slate-950 transition hover:bg-slate-200"
                    >
                      <Play size={18} />
                      Play note
                    </button>
                    <div className="mx-auto max-w-sm rounded-md border border-cyan-400/40 bg-cyan-400/10 p-1">
                      <div className="rounded-[5px] bg-cyan-300 px-5 py-3 text-center font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition">
                        Flip to the sheet side
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {showSheet ? (
                      <StaffPreview note={question.note} revealed />
                    ) : (
                      <div className="mx-auto grid h-44 w-full max-w-sm place-items-center rounded-md border border-slate-700 bg-slate-950 px-8 py-5">
                        <div className="text-center">
                          <div className="mx-auto grid size-14 place-items-center rounded-full bg-slate-800 text-cyan-200">
                            <Volume2 size={26} />
                          </div>
                          <p className="mt-4 text-sm font-medium uppercase tracking-wider text-slate-500">
                            Sheet hidden
                          </p>
                          <p className="mt-2 text-slate-300">
                            Answer from the sound alone.
                          </p>
                        </div>
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-semibold">
                        Which note was that?
                      </h2>
                      <p className="mt-1 text-sm text-slate-300">
                        {question.note.clef === 'treble'
                          ? 'Treble clef'
                          : 'Bass clef'}{' '}
                        card
                      </p>
                      {!selected && (
                        <p className="mt-2 text-sm font-medium text-cyan-200">
                          Tap the card again to hear the sound side.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${((index + 1) / totalQuestions) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <aside className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-semibold">Multiple choice</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {flipped
                ? 'Choose the note you heard.'
                : 'Flip to the sheet side before answering.'}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {question.choices.map((choice) => {
                const correctChoice = choice === question.note.name
                const picked = selected === choice
                const showResult = Boolean(selected)
                const resultClass =
                  showResult && correctChoice
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
                    : showResult && picked
                      ? 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-100'
                      : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800'

                return (
                  <button
                    key={choice}
                    type="button"
                    disabled={!flipped || Boolean(selected)}
                    onClick={() => chooseAnswer(choice)}
                    className={`flex h-16 items-center justify-center rounded-md border text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${resultClass}`}
                  >
                    {choice}
                  </button>
                )
              })}
            </div>

            {selected && (
              <div className="mt-4 rounded-md bg-slate-100 p-3 dark:bg-slate-800">
                <div className="flex items-center gap-2 font-semibold">
                  {isCorrect ? (
                    <Check className="text-emerald-600" size={20} />
                  ) : (
                    <X className="text-rose-600" size={20} />
                  )}
                  {isCorrect ? 'Correct' : 'Not quite'}
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  The answer was {question.note.name}
                  {question.note.label !== question.note.name
                    ? `, ${question.note.label}.`
                    : '.'}
                </p>
                <button
                  type="button"
                  onClick={nextQuestion}
                  className="mt-3 w-full rounded-md bg-slate-950 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  {index + 1 === totalQuestions ? 'Finish session' : 'Next card'}
                </button>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  )
}

function App() {
  const [progress, setProgress] = useState(getStoredProgress)
  const [activeMode, setActiveMode] = useState(null)
  const [showSheet, setShowSheet] = useState(getStoredSheetVisibility)

  function saveProgress(nextProgress) {
    setProgress(nextProgress)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProgress))
  }

  function toggleSheetVisibility() {
    setShowSheet((current) => {
      const next = !current
      localStorage.setItem(SHEET_VISIBILITY_KEY, String(next))
      return next
    })
  }

  if (activeMode) {
    return (
      <Practice
        mode={activeMode}
        progress={progress}
        showSheet={showSheet}
        onSaveProgress={saveProgress}
        onExit={() => setActiveMode(null)}
      />
    )
  }

  return (
    <Home
      progress={progress}
      onStart={setActiveMode}
      showSheet={showSheet}
      onToggleSheet={toggleSheetVisibility}
    />
  )
}

export default App
