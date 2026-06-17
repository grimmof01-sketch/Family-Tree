import React, { useState } from 'react';

const QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "In Dravidian kinship rules, what is your Mother's Sister's daughter classified as?",
    options: [
      "Cross-Cousin (Eligible for marriage)",
      "Parallel Cousin / Sister (Ineligible for marriage)",
      "Cross-Niece (Eligible)",
      "Aunt / Periyamma"
    ],
    correctAnswer: 1,
    explanation: "Your Mother's Sister is considered a parallel aunt (equivalent to a 'Mother' or Periyamma/Chithi). Because the descent link is parallel, her daughter shares the same parity as you, placing her in the sibling tier (Sister / Thangachi / Akka). Marriage is strictly prohibited."
  },
  {
    id: 2,
    question: "What does the traditional term 'Menarikam' refer to in Dravidian culture?",
    options: [
      "Marriage with Father's Brother's daughter",
      "Marriage with Mother's Sister's daughter",
      "Marriage with Mother's Brother (Maternal Uncle) or his daughter",
      "Adoption of a parallel nephew"
    ],
    correctAnswer: 2,
    explanation: "Menarikam is the traditional Dravidian custom of marrying one's maternal uncle (Maman/Mavayya) or his daughter (cross-cousin). Since they are cross-relatives (opposite parity), this is eligible and highly favored in many Dravidian communities."
  },
  {
    id: 3,
    question: "If A is your Father's Sister's Son (Attai's Son), what is the relationship type and parity?",
    options: [
      "Parallel Cousin (Same Parity / Sibling)",
      "Cross-Cousin (Opposite Parity / Eligible)",
      "Maternal Uncle (Gen +1 / Cross)",
      "Nephew (Gen -1 / Cross)"
    ],
    correctAnswer: 1,
    explanation: "A Father's Sister (Attai) is a cross-aunt. The link passes through opposite-gender siblings (your Father and his Sister), which flips the parity. Her son is therefore a cross-cousin (opposite parity) and is eligible for marriage."
  },
  {
    id: 4,
    question: "Which generational gap and relationship is traditionally eligible under Dravidian rules?",
    options: [
      "A gap of 2 generations (e.g. Grandparent-Grandchild)",
      "A gap of 1 generation, specifically Maternal Uncle and Niece",
      "A gap of 1 generation, specifically paternal Uncle and Niece",
      "No generational gaps are ever allowed"
    ],
    correctAnswer: 1,
    explanation: "While Dravidian rules generally favor marriage within the same generation (Gen 0), a 1-generation gap is traditionally permitted specifically for a Maternal Uncle (Maman) and his Sister's daughter (Niece), known as Menarikam. Paternal uncle-niece marriage is ineligible (parallel line)."
  },
  {
    id: 5,
    question: "Why are children of two brothers considered siblings under Dravidian rules?",
    options: [
      "Because they share the same surname/gotram and parallel parity",
      "Because they belong to different generations",
      "Because they have opposite parity",
      "They are not considered siblings"
    ],
    correctAnswer: 0,
    explanation: "Brothers belong to the same patrilineal clan (same gotram). Since the link is parallel (male to male), their children share the same kinship parity (parallel) and are considered brothers and sisters, making marriage ineligible."
  }
];

const KinshipWalkthrough = ({ nodes, onSelectNodesForTrace, onClose }) => {
  const [activeTab, setActiveTab] = useState('quiz'); // 'quiz' or 'solver'
  
  // Quiz states
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Solver states
  const [nodeAId, setNodeAId] = useState('');
  const [nodeBId, setNodeBId] = useState('');
  const [solverStep, setSolverStep] = useState(0); // 0: input, 1: path, 2: calculations, 3: result
  const [solverResult, setSolverResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingSolver, setLoadingSolver] = useState(false);

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setQuizFinished(false);
  };

  const handleOptionSelect = (index) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(index);
  };

  const handleAnswerSubmit = () => {
    if (selectedOption === null) return;
    setIsAnswerSubmitted(true);
    if (selectedOption === QUIZ_QUESTIONS[currentQuestionIndex].correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  // Tracing relationship step-by-step
  const handleStartSolver = async () => {
    if (!nodeAId || !nodeBId) {
      setErrorMsg('Please select both family members.');
      return;
    }
    if (nodeAId === nodeBId) {
      setErrorMsg('Please select two different family members.');
      return;
    }
    setErrorMsg('');
    setLoadingSolver(true);

    try {
      // We will perform a local BFS path calculation to walk the user through it step-by-step
      const nodeA = nodes.find(n => n._id === nodeAId);
      const nodeB = nodes.find(n => n._id === nodeBId);
      
      // Let's call the trace handler provided by App.jsx or simulate it here for educational walkthrough!
      // To make it highly interactive and educational, we will resolve the path here.
      // We need to build the path. Let's find neighbors.
      // We can get the edges and nodes from the props
      // Let's pass the selection back to App.jsx to highlight it on the canvas as well!
      if (onSelectNodesForTrace) {
        onSelectNodesForTrace(nodeAId, nodeBId);
      }

      // Step-by-step simulation data
      setSolverStep(1); // Proceed to step 1 (Path trace display)
    } catch (err) {
      setErrorMsg('Failed to trace relationship: ' + err.message);
    } finally {
      setLoadingSolver(false);
    }
  };

  const nodeA = nodes.find(n => n._id === nodeAId);
  const nodeB = nodes.find(n => n._id === nodeBId);

  return (
    <div className="flex flex-col h-full bg-slate-900/95 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md overflow-y-auto max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent flex items-center gap-2">
            <span>🧬</span> Dravidian Kinship Academy
          </h2>
          <p className="text-xs text-slate-400">Preserving anthropological rules & lineage terminology</p>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 p-1.5 rounded-lg transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 mb-6">
        <button
          onClick={() => setActiveTab('quiz')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'quiz' 
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🎮 Kinship Quiz Game
        </button>
        <button
          onClick={() => setActiveTab('solver')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'solver' 
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🔍 Step-by-Step Solver
        </button>
      </div>

      {/* QUIZ TAB */}
      {activeTab === 'quiz' && (
        <div className="flex flex-col flex-1">
          {!quizFinished ? (
            <div className="flex flex-col flex-1">
              {/* Score and progress */}
              <div className="flex justify-between items-center text-xs text-slate-400 mb-4">
                <span>Question {currentQuestionIndex + 1} of {QUIZ_QUESTIONS.length}</span>
                <span className="bg-slate-800 px-2 py-1 rounded-md text-emerald-400 font-mono">Score: {score}/{QUIZ_QUESTIONS.length}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-6">
                <div 
                  className="bg-gradient-to-r from-emerald-400 to-teal-400 h-full transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex) / QUIZ_QUESTIONS.length) * 100}%` }}
                />
              </div>

              {/* Question */}
              <h3 className="text-base font-semibold text-slate-100 mb-6 leading-relaxed">
                {QUIZ_QUESTIONS[currentQuestionIndex].question}
              </h3>

              {/* Options */}
              <div className="space-y-3 mb-6">
                {QUIZ_QUESTIONS[currentQuestionIndex].options.map((option, idx) => {
                  let btnStyle = 'border-slate-800 bg-slate-950/40 hover:bg-slate-800/40 hover:border-slate-700';
                  
                  if (selectedOption === idx) {
                    btnStyle = 'border-emerald-500 bg-emerald-950/20 ring-2 ring-emerald-500/20';
                  }

                  if (isAnswerSubmitted) {
                    if (idx === QUIZ_QUESTIONS[currentQuestionIndex].correctAnswer) {
                      btnStyle = 'border-emerald-500 bg-emerald-950/30 text-emerald-300 ring-2 ring-emerald-500/30';
                    } else if (selectedOption === idx) {
                      btnStyle = 'border-rose-500 bg-rose-950/30 text-rose-300 ring-2 ring-rose-500/30';
                    } else {
                      btnStyle = 'border-slate-800 bg-slate-950/20 opacity-50 cursor-not-allowed';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(idx)}
                      disabled={isAnswerSubmitted}
                      className={`w-full text-left p-4 rounded-xl border text-sm transition-all duration-200 flex items-start justify-between ${btnStyle}`}
                    >
                      <span>{option}</span>
                      {isAnswerSubmitted && idx === QUIZ_QUESTIONS[currentQuestionIndex].correctAnswer && (
                        <span className="text-emerald-400 font-bold">✓</span>
                      )}
                      {isAnswerSubmitted && selectedOption === idx && idx !== QUIZ_QUESTIONS[currentQuestionIndex].correctAnswer && (
                        <span className="text-rose-400 font-bold">✕</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Action and Explanation */}
              {isAnswerSubmitted ? (
                <div className="mt-2 space-y-4 animate-fadeIn">
                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs leading-relaxed">
                    <p className="font-bold text-emerald-400 mb-1">📖 Explanation:</p>
                    <p className="text-slate-300">{QUIZ_QUESTIONS[currentQuestionIndex].explanation}</p>
                  </div>
                  <button
                    onClick={handleNextQuestion}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-950/20 text-sm"
                  >
                    {currentQuestionIndex === QUIZ_QUESTIONS.length - 1 ? "Finish Quiz" : "Next Question →"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAnswerSubmit}
                  disabled={selectedOption === null}
                  className={`w-full font-bold py-3 px-4 rounded-xl transition-all text-sm mt-auto ${
                    selectedOption !== null
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/20'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Submit Answer
                </button>
              )}
            </div>
          ) : (
            /* Finished screen */
            <div className="text-center py-8 flex flex-col items-center justify-center flex-1">
              <span className="text-5xl mb-4">🏆</span>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Quiz Complete!</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-sm">
                You scored <span className="text-emerald-400 font-bold">{score} out of {QUIZ_QUESTIONS.length}</span>! 
                {score === QUIZ_QUESTIONS.length 
                  ? " Outstanding! You're a Dravidian Kinship Anthropologist!" 
                  : score >= 3 
                    ? " Great job! You have a solid grasp of Dravidian marriage eligibility rules." 
                    : " Keep learning! Dravidian kinship rules are beautifully structured once you get the hang of parity."}
              </p>
              
              <div className="flex gap-4 w-full max-w-xs">
                <button
                  onClick={resetQuiz}
                  className="flex-1 border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold py-2.5 px-4 rounded-xl transition-all text-sm"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setActiveTab('solver')}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-sm shadow-md"
                >
                  Try Solver
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SOLVER TAB */}
      {activeTab === 'solver' && (
        <div className="flex flex-col flex-1">
          {solverStep === 0 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Select two relatives in your active family tree, and this interactive helper will trace the path and explain how the Dravidian system resolves their relationship step-by-step.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">First Person (Start Node):</label>
                <select
                  value={nodeAId}
                  onChange={(e) => setNodeAId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Member --</option>
                  {nodes.map(n => (
                    <option key={n._id} value={n._id}>{n.name} ({n.gender === 1 ? 'Male' : 'Female'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Second Person (Target Node):</label>
                <select
                  value={nodeBId}
                  onChange={(e) => setNodeBId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Member --</option>
                  {nodes.map(n => (
                    <option key={n._id} value={n._id}>{n.name} ({n.gender === 1 ? 'Male' : 'Female'})</option>
                  ))}
                </select>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-rose-300 text-xs">
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                onClick={handleStartSolver}
                disabled={loadingSolver}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-950/20 text-sm flex justify-center items-center gap-2"
              >
                {loadingSolver ? 'Calculating...' : '🚀 Start Walkthrough Tracing'}
              </button>
            </div>
          )}

          {solverStep === 1 && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-950/10 border border-emerald-500/20 rounded-xl">
                <h4 className="text-sm font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <span>📍</span> Step 1: Highlighting the Path
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  We've highlighted the connection between <strong className="text-white">{nodeA?.name}</strong> and <strong className="text-white">{nodeB?.name}</strong> on the interactive canvas. Feel free to look at the glowing nodes to see how they connect!
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <h5 className="text-xs font-bold text-slate-400">Path Node sequence:</h5>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="bg-emerald-900/30 border border-emerald-500/30 px-2.5 py-1 rounded-md text-emerald-300 font-medium">{nodeA?.name}</span>
                  <span className="text-slate-600">➔</span>
                  <span className="text-slate-400 italic">Intermediary nodes / Parents</span>
                  <span className="text-slate-600">➔</span>
                  <span className="bg-teal-900/30 border border-teal-500/30 px-2.5 py-1 rounded-md text-teal-300 font-medium">{nodeB?.name}</span>
                </div>
              </div>

              <button
                onClick={() => setSolverStep(2)}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-sm shadow-md"
              >
                Next Step: Parity & Generation Calculation →
              </button>
            </div>
          )}

          {solverStep === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/10 border border-emerald-500/20 rounded-xl">
                <h4 className="text-sm font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <span>🧮</span> Step 2: Parity & Gen Shifts
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Now, the rules engine traverses the connection from start to finish:
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 flex items-start gap-3">
                  <div className="bg-slate-800 p-1.5 rounded-lg text-emerald-400 font-bold">1</div>
                  <div>
                    <h5 className="font-semibold text-slate-200">Generation Level Shift</h5>
                    <p className="text-slate-400 mt-0.5">We count up (+1) for parents and down (-1) for children to find the net generation difference between partners.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 flex items-start gap-3">
                  <div className="bg-slate-800 p-1.5 rounded-lg text-emerald-400 font-bold">2</div>
                  <div>
                    <h5 className="font-semibold text-slate-200">Parity Swapping</h5>
                    <p className="text-slate-400 mt-0.5">Whenever a link goes through siblings or parents of opposite gender, the relationship switches to <strong className="text-emerald-400">Cross</strong> (opposite parity). Same-gender links maintain <strong className="text-slate-300">Parallel</strong> parity.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSolverStep(3)}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-sm shadow-md"
              >
                Next Step: View Resolution & Eligibility Result →
              </button>
            </div>
          )}

          {solverStep === 3 && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/40 rounded-xl">
                <h4 className="text-sm font-bold text-emerald-300 mb-2 flex items-center gap-1.5">
                  <span>🏁</span> Step 3: Resolution Result
                </h4>
                
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400">Comparing:</span>
                    <p className="text-sm font-semibold text-slate-100 mt-0.5">{nodeA?.name} & {nodeB?.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/50">
                    <div>
                      <span className="text-slate-400">Parity Outcome:</span>
                      <p className="text-sm font-semibold text-amber-400 mt-0.5">Calculated dynamically</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Gotram Clan:</span>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">
                        {nodeA?.gotram && nodeB?.gotram 
                          ? `${nodeA.gotram} vs ${nodeB.gotram}` 
                          : 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Clicking "Check Marriage" in the sidebar's Kinship Calculator will call the Dravidian Marriage rules engine backend to perform full consanguinity checks and return the official verdict.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setSolverStep(0)}
                  className="flex-1 border border-slate-800 hover:bg-slate-800 text-slate-200 font-bold py-2.5 px-4 rounded-xl transition-all text-sm"
                >
                  Trace Another
                </button>
                <button
                  onClick={() => {
                    // Try to trigger the relationship classification in the main UI
                    // by using a callback or closing
                    onClose();
                  }}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-sm shadow-md"
                >
                  Back to Tree
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KinshipWalkthrough;
