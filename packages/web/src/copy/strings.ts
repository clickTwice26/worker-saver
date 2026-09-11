/**
 * Interface copy.
 *
 * Held in one file rather than scattered through components so wording can be
 * reviewed as a whole — the product's credibility rests as much on how it
 * phrases a risk score as on how it calculates one.
 */

export const copy = {
  // --- brand ---------------------------------------------------------------
  appName: 'ALE Insight',
  tagline: 'Plan worker training before the automation arrives',
  demoBadge: 'Demo data',

  // --- landing -------------------------------------------------------------
  heroKicker: 'For ready-made garment factories',
  heroTitle: 'Know who needs retraining before the machine lands',
  heroBody:
    'Give two things: the machines your factory plans to buy, and how many workers you have in each ' +
    'role. The system returns who is exposed, the date training has to begin, and what it will cost.',
  heroCta: 'Open the dashboard',
  heroCtaSecondary: 'How it works',

  whoTitle: 'Who it is for',
  whoLede:
    'Three people look at the same plan for different reasons. Each of them gets the view that answers ' +
    'their own question.',
  path1Title: 'Production manager',
  path1Body:
    'You know which machines are coming. You need to know who to train, in what order, and by when — ' +
    'against the training capacity you actually have.',
  path1Link: 'Open the transition plan',
  path2Title: 'Brand & compliance',
  path2Body:
    'You need evidence that a supplier saw the change coming and acted on it: dated training ' +
    'commitments, not a statement of intent.',
  path2Link: 'See the buyer report',
  path3Title: 'Planning & finance',
  path3Body:
    'You need the purchase case: capital outlay, payback period, and what each machine creates as well ' +
    'as what it removes.',
  path3Link: 'Open the machine catalogue',

  howLede:
    'Two inputs, one schedule. No worker list, no names, and no machine learning — the knowledge base ' +
    'is the intelligence and the engine is arithmetic.',

  problemTitle: 'The problem',
  problemBody:
    'Today this transition is handled reactively — the machine arrives, and only then does management ' +
    'decide who stays and who is let go. There is no tool for planning it in advance.',
  stat1Value: '4 million',
  stat1Label: 'RMG workers in Bangladesh, most of them women',
  stat2Value: '60%',
  stat2Label: 'of current female RMG employment could be displaced by 2041 without intervention',
  stat3Value: '80%',
  stat3Label: 'of surveyed Dhaka factories planned semi-automated machine purchases within two years',
  statsSource:
    'Sources: CPD 2026 policy brief; 2023 survey of Dhaka factories — carried from the project research ' +
    'documents and re-verified against primary sources during phase 0.',

  howTitle: 'How it works',
  how1Title: 'Enter headcounts by role',
  how1Body: 'Eight to sixteen rows. No worker-by-worker list, and no names required.',
  how2Title: 'Enter the machine roadmap',
  how2Body: 'What is arriving, when, and which role it affects.',
  how3Title: 'Get the training schedule',
  how3Body: 'When to start, how many per cohort, what it costs — and a report you can hand your buyer.',

  modelTitle: 'The ALE model',
  modelATitle: 'Anticipate',
  modelABody: 'See the problem before it arrives, and plan for it in advance.',
  modelLTitle: 'Lead',
  modelLBody: 'Talk to people honestly before the change, not after it.',
  modelETitle: 'Evolve',
  modelEBody: 'Build a system that keeps improving, and treat competitors as collaborators.',

  guardTitle: 'What this tool will never produce',
  guardBody:
    'The list that says "train these 40 people first" is the same list that says "these 40 are the most ' +
    'replaceable". So the rule lives in the database, not in a policy document: no risk score can exist ' +
    'without a recommended transition attached, and the only exportable document is the training plan — ' +
    'never a ranked displaceability register.',

  landingCtaTitle: 'Try it with a demo factory',
  landingCtaBody:
    'Three sample factories are seeded — different product mixes, different rosters, different answers.',

  // --- app navigation ------------------------------------------------------
  navOverview: 'Overview',
  navSetup: 'Setup',
  navPlan: 'Plan',
  navKnowledge: 'Knowledge base',
  navReport: 'Report',
  backToSite: 'Back to site',
  factory: 'Factory',

  // --- overview ------------------------------------------------------------
  overviewIntro: 'Where the factory stands right now.',
  riskByRoleTitle: 'Risk by role',
  riskByRoleHint: 'Bar length is the risk score; the figures beside it are score and headcount.',
  trainingLoadTitle: 'Monthly training load',
  trainingLoadHint: 'Seats required each month.',
  upcomingTitle: 'Upcoming arrivals',
  noPlans: 'No machine plans have been added yet.',

  // --- setup ---------------------------------------------------------------
  setupTitle: 'Factory inputs',
  setupIntro:
    'Give headcounts by role and your machine purchase plan. No worker-by-worker list required.',
  rosterTitle: 'Workers by role',
  rosterHint: 'A handful of rows, not several thousand.',
  machineryTitle: 'Machine roadmap',
  machineryHint: 'What is arriving, when, and which role it affects.',
  role: 'Role',
  workers: 'Workers',
  machineName: 'Machine',
  affectedRole: 'Role affected',
  arrivalDate: 'Arrival date',
  arrivalDateHint: 'Training deadlines are counted back from this date.',
  units: 'Units',
  displacedPerUnit: 'Displaced per unit',
  add: 'Add',
  save: 'Save',
  remove: 'Remove',
  runAnalysis: 'Run analysis',
  running: 'Running…',

  // --- plan ----------------------------------------------------------------
  planTitle: 'Transition plan',
  workforceModelled: 'Workforce modelled',
  weightedRisk: 'Weighted risk',
  workersAffected: 'Workers affected',
  trainingCost: 'Training cost',
  rolesTracked: 'roles tracked',
  overdueWarning: 'training windows already missed',
  findingsTitle: 'Which role, by when, and what to run',
  calendarTitle: 'Month-by-month training calendar',
  noFindings: 'No findings yet. Add a machine plan and run the analysis.',
  seats: 'seats',
  month: 'Month',
  startBy: 'Start by',
  arrives: 'Arrives',
  cohorts: 'cohorts',
  training: 'Training',
  weeks: 'weeks',
  why: 'Why this score',
  source: 'Source',

  // --- knowledge base ------------------------------------------------------
  knowledgeTitle: 'Knowledge base',
  knowledgeIntro:
    'The reasoning and the provenance behind every risk score. When a manager asks "why 74", the answer ' +
    'is here — and every row currently rests on an estimate, which the product states rather than hides.',
  machineTrigger: 'Machine trigger',
  riskScore: 'Risk',
  programs: 'Training programmes',
  duration: 'Duration',
  capacity: 'Seats / month',
  perSeat: 'Per seat',
  provider: 'Provider',
  deptCutting: 'Cutting room',
  deptSewing: 'Sewing floor',
  deptFinishing: 'Finishing & washing',
  deptSupport: 'Support',
  deptTechnical: 'Technical',

  // --- machines ------------------------------------------------------------
  navMachines: 'Machines',
  machinesTitle: 'Machine catalogue',
  machinesIntro:
    'The reference data behind every displacement figure. Because these numbers live here, the product ' +
    'computes what a machine will do to a roster instead of asking the factory to estimate it — and ' +
    'records what the machine creates, not only what it removes.',
  machine: 'Machine',
  category: 'Category',
  capitalCost: 'Capital cost',
  operatorsNeeded: 'Operators / unit',
  replaces: 'Replaces',
  installLead: 'Install lead',
  automationLevel: 'Automation',
  displaces: 'Displaces',
  creates: 'Creates',
  netChange: 'Net change',
  perUnit: 'per unit',
  payback: 'Payback',
  months: 'months',
  capitalOutlay: 'Capital outlay',
  monthlySaving: 'Monthly wage saving',
  retrainingRatio: 'Retraining vs one year of wages',
  healthSafety: 'Health & safety',
  derivedNote: 'Derived from the machine catalogue',
  overriddenNote: 'Figure supplied by the factory, overriding the catalogue',
  operationsCovered: 'Operations absorbed',
  economicsTitle: 'Purchase economics',
  economicsHint: 'What each arrival costs, what it saves, and how long it takes to repay.',
  netEffectTitle: 'Net workforce change',
  netEffectHint: 'Displacement minus the posts each machine creates to run and service it.',
  workersCreatedLabel: 'Posts created',
  seatsUpcoming: 'Scheduled ahead',
  seatsPast: 'Window already missed',

  // --- import --------------------------------------------------------------
  navImport: 'Import data',
  importTitle: 'Import your data',
  importIntro:
    'Upload CSV exports from your own systems. Every row is validated and anything that fails comes ' +
    'back with its line number and the reason, so a file with a few bad rows is corrected rather than ' +
    'rejected whole.',
  importUpload: 'Upload a file',
  importKind: 'What is in this file',
  importChoose: 'Choose CSV file',
  importing: 'Importing…',
  importRequired: 'Required columns',
  importOptional: 'Optional',
  importLine: 'Line',
  importProblem: 'Problem',
  datasetsTitle: 'Datasets on the server',
  datasetsHint:
    'Generated CSVs already sitting on the server. Imported in place, so a large file never has to ' +
    'travel through the browser. Generate more with: npm run generate:data',
  datasetsNone:
    'No generated datasets found. Run `npm run generate:data -- --workers 1000000 --outcomes 1000000` ' +
    'to create one.',
  datasetImport: 'Import',
  datasetImporting: 'Importing…',
  datasetRows: 'rows',
  datasetSize: 'size',
  datasetSlow: 'A million-row dataset takes around a minute. The page stays responsive.',
  importHistory: 'Import history',
  importNoHistory: 'Nothing imported yet.',
  importFile: 'File',
  importAccepted: 'Accepted',
  importRejected: 'Rejected',

  // --- model ---------------------------------------------------------------
  navModel: 'Prediction model',
  modelTitle2: 'Prediction model',
  modelIntro:
    'A model is trained on what actually happened after past arrivals — nothing else. Until enough ' +
    'outcomes are recorded, the rule engine produces every score, and this page says so.',
  modelTrain: 'Train on recorded outcomes',
  modelTraining: 'Training…',
  modelState_no_data: 'No outcomes recorded',
  modelState_insufficient_data: 'Not enough outcomes yet',
  modelState_trained_not_active: 'Trained, but not in use',
  modelState_active: 'Model in production',
  modelOutcomes: 'Outcomes recorded',
  modelOutcomesNote: 'the only source of labels',
  modelRowsFitted: 'sampled for fitting',
  modelDisplaced: 'Displaced',
  modelRetained: 'Retained or redeployed',
  modelAuc: 'AUC (cross-validated)',
  modelBaseline: 'rules:',
  modelNotTrained: 'not trained yet',
  modelProgress: 'Progress toward a first model',
  modelProgressHint: 'Training needs 40 recorded outcomes with at least 8 of each result.',
  modelMoreNeeded: 'more needed',
  modelMetrics: 'Model metrics',
  modelMetricsHint: 'Measured on held-out folds, never on the rows the model was fitted to.',
  modelAlgorithm: 'Algorithm',
  modelBaselineAuc: 'Rule-engine AUC on the same folds',
  modelBrier: 'Brier score (lower is better)',
  modelAccuracy: 'Accuracy',
  modelSamples: 'Training rows',
  modelFolds: 'Validation',
  modelInProduction: 'Producing scores',
  modelActive: 'Active',
  modelInactive: 'Rules still in use',
  modelInfluence: 'What the model weighs',
  modelInfluenceHint: 'Standardised coefficients. Positive pushes toward displacement.',
  modelInfluenceFoot:
    'Comparable across features because the inputs were standardised before fitting. These are ' +
    'associations in your recorded data, not causes.',
  modelOutcomesByRole: 'Recorded outcomes by role',
  modelNoOutcomes: 'No outcomes recorded yet. Import them from the Import page.',
  modelOutcome: 'Outcome',
  modelCount: 'Count',
  targetDisplacement: 'Displacement risk',
  targetRetraining: 'Retraining success',
  modelPrecision: 'Precision',
  modelRecall: 'Recall',
  modelF1: 'F1',
  modelHyperparameters: 'Hyperparameters',
  modelCandidates: 'Candidates compared',
  modelCandidatesHint: 'Every configuration is cross-validated; the best one is kept and the rest are recorded.',
  modelSelected: 'Selected',
  modelLearningCurve: 'Learning curve',
  modelLearningCurveHint: 'Cross-validated AUC at increasing sample sizes.',
  modelLearningCurveFoot:
    'Still climbing at the right-hand end means recording more outcomes will keep improving the model. ' +
    'Flat means the limit is which features you collect, not how many rows.',
  modelCalibration: 'Calibration',
  modelCalibrationHint: 'Does a predicted 0.70 actually happen 70% of the time?',
  modelPredicted: 'Predicted',
  modelObserved: 'Observed',
  modelGap: 'Gap',
  scoredByModel: 'Scored by model',
  scoredByRules: 'Scored by rules',

  // --- getting started -----------------------------------------------------
  setupFactoryTitle: 'Create your first factory',
  setupFactoryIntro:
    'Nothing is pre-loaded. Create a factory, then import your roster and your machine roadmap.',
  factoryName: 'Factory name',
  factoryLocation: 'Location',
  factoryProductMix: 'Product mix',
  createFactory: 'Create factory',
  creating: 'Creating…',

  // --- bands and status ----------------------------------------------------
  high: 'High',
  moderate: 'Moderate',
  low: 'Low',
  onTrack: 'On track',
  startsSoon: 'Starts soon',
  overdue: 'Overdue',
  estimated: 'Estimated',
  sourced: 'Sourced',

  // --- report --------------------------------------------------------------
  reportTitle: 'Buyer transition report',
  reportIntro:
    'The document a factory hands its buyer: evidence that the machine was known about and the people ' +
    'were trained ahead of it.',
  commitments: 'Training commitments',
  completesBy: 'Completes by',
  cost: 'Cost',
  print: 'Print / PDF',
  disclosure: 'Disclosure',
  generatedAt: 'Generated',
  total: 'Total',

  // --- states --------------------------------------------------------------
  loading: 'Loading…',
  errorTitle: 'Something went wrong',
  retry: 'Try again',
} as const;

export type CopyKey = keyof typeof copy;
